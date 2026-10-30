// Collects market prices every 30 minutes while the game is open, and shows
// an item's usual price, trend and a small chart in the game's marketplace.

import { loadPrices, marketEntry, onPricesLoaded } from "./game-data.js";
import { COLLECT_EVERY_MS, MIN_DAYS, MIN_HOURS, exportHistory, longMedians, loadHistory, priceSeries, priceSummary, recordSnapshot, trendArrow, versusUsual } from "./price-history.js";
import { esc, shortCoins } from "./format.js";
import { onPiSync, piConfig, piStatus, startPiSync, syncNow, unlinkPi } from "./pi-sync.js";
import { visible } from "./game-nav.js";

const CURRENT_ITEM = '[class*="MarketplacePanel_currentItem"]';
const FIRST_COLLECT_MS = 15 * 1000;
const SCAN_MS = 400;
const RANGES = [30, 365];
// From this many hours of prices the box shows its numbers, marked preliminary until there is enough.
const PRELIMINARY_HOURS = 2;

// exported: the prepared CSV export ({ csv, items, hours, days }), status: what the last export button did.
// open: the details under the summary line are unfolded (kept between items).
const h = { win: null, scanTimer: null, scanning: false, range: 30, open: false, listeners: new Set(), exported: null, status: "" };

const pct = (fraction) => `${fraction >= 0 ? "+" : "−"}${Math.abs(fraction * 100).toFixed(0)}%`;

// Called after new prices are recorded (the Skilling tab re-renders).
export function onHistoryChange(listener) {
    h.listeners.add(listener);
}

export function startPriceHistory(win) {
    h.win = win;
    onPricesLoaded((marketData, timestamp) => {
        recordSnapshot(marketData, timestamp)
            .then((added) => {
                if (!added) return;
                scheduleScan(true);
                for (const listener of h.listeners) listener();
            })
            .catch((error) => console.warn("[MWI Advisor] price history", error));
    });
    // Linked to a Pi: its hours come in as well, and replace the ones collected here.
    onPiSync((added) => {
        scheduleScan(true);
        if (added) for (const listener of h.listeners) listener();
    });
    startPiSync();
    loadHistory().catch((error) => console.warn("[MWI Advisor] price history", error));
    const collect = () => loadPrices(true).catch(() => {});
    setTimeout(collect, FIRST_COLLECT_MS);
    setInterval(collect, COLLECT_EVERY_MS);
    new MutationObserver(() => scheduleScan()).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    // toggle doesn't bubble: listen in the capture phase. The chart is drawn when unfolded.
    document.addEventListener("toggle", (event) => {
        if (!event.target.matches?.(".mwia-history-more") || event.target.open === h.open) return;
        h.open = event.target.open;
        scheduleScan(true);
    }, true);
}

function scheduleScan(force = false) {
    if (force) document.querySelectorAll(".mwia-history").forEach((box) => (box.dataset.version = ""));
    if (h.scanTimer) return;
    h.scanTimer = setTimeout(async () => {
        h.scanTimer = null;
        if (h.scanning) return scheduleScan();
        h.scanning = true;
        try {
            await scan();
        } finally {
            h.scanning = false;
        }
    }, SCAN_MS);
}

// The item open in the marketplace, from its icon (…#cedar_water_staff), and
// its +level from the "+6" on the icon (none: +0).
function currentItem() {
    const node = [...document.querySelectorAll(CURRENT_ITEM)].find(visible);
    const href = node?.querySelector("svg use")?.getAttribute("href") || node?.querySelector("svg use")?.getAttribute("xlink:href") || "";
    const id = href.split("#")[1];
    if (!node || !id) return null;
    const badge = [...node.querySelectorAll("*")].find((el) => !el.children.length && /^\+\d{1,2}$/.test(el.textContent.trim()));
    return { node, itemHrid: "/items/" + id, level: badge ? Number(badge.textContent.trim().slice(1)) : 0 };
}

// The item's icon sits in a row with the buy/sell buttons; the box goes above
// the first ancestor that spans (nearly) the whole marketplace, so it gets the full width.
function fullWidthRow(node) {
    const panel = node.closest('[class*="MarketplacePanel_marketplacePanel"]') || document.body;
    const width = panel.getBoundingClientRect().width;
    let row = node;
    while (row.parentElement && row.parentElement !== panel && row.getBoundingClientRect().width < 0.8 * width) row = row.parentElement;
    return row;
}

async function scan() {
    const current = currentItem();
    document.querySelectorAll(".mwia-history").forEach((box) => {
        if (!current || box.dataset.item !== `${current.itemHrid}+${current.level}` || !document.contains(box)) box.remove();
    });
    if (!current) return;
    let box = document.querySelector(".mwia-history");
    const key = `${current.itemHrid}+${current.level}|${h.range}|${h.open}|${h.exported ? "ready" : ""}|${h.status}|${JSON.stringify(piConfig() && piStatus())}`;
    if (box && box.dataset.version === key) return;
    if (!box) {
        box = document.createElement("div");
        box.className = "mwia-history";
        fullWidthRow(current.node).insertAdjacentElement("beforebegin", box);
    }
    box.dataset.item = `${current.itemHrid}+${current.level}`;
    box.dataset.version = key;
    box.innerHTML = await historyHtml(current.itemHrid, current.level);
}

// Export: one tap prepares the CSV, then Download and Copy act on it at once
// (Safari only lets a page download or copy straight from a tap).
function exportHtml() {
    const e = h.exported;
    const buttons = e
        ? `<span>${e.items} items · ${e.hours} hours · ${e.days} days · ${(e.csv.length / 1024).toFixed(0)} kB</span>
           <button data-history-export="download">⬇ Download CSV</button><button data-history-export="copy">📋 Copy</button>`
        : `<button data-history-export="prepare">⬇ Export all prices</button>`;
    return `<div class="mwia-history-ranges mwia-history-export">${buttons}</div>${h.status ? `<div class="mwia-history-note">${esc(h.status)}</div>` : ""}`;
}

async function onExport(kind) {
    if (kind === "prepare") {
        h.status = "Preparing…";
        scheduleScan(true);
        try {
            h.exported = await exportHistory();
            h.status = "";
        } catch (error) {
            h.status = "Export failed: " + error.message;
        }
    } else if (kind === "download" && h.exported) {
        const url = URL.createObjectURL(new Blob([h.exported.csv], { type: "text/csv" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = `mwi-prices-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        h.status = "Downloaded – on an iPhone it is in the Files app (Downloads).";
    } else if (kind === "copy" && h.exported) {
        try {
            await navigator.clipboard.writeText(h.exported.csv);
            h.status = "Copied – paste it where you want it.";
        } catch (error) {
            h.status = "Could not copy (" + error.message + "); use Download instead.";
        }
    }
    scheduleScan(true);
}

// Where the prices come from: this device, or the linked Pi (with this device filling in).
function sourceHtml() {
    if (!piConfig()) return `<div class="mwia-history-note">Saved every 30 min while the game is open, on this device.</div>`;
    const st = piStatus();
    const time = (t) => new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const text =
        st.ok === null ? "Linked to your Pi; reading it…"
        : st.ok ? `From your Pi: newest prices ${st.newest ? time(st.newest) : "none yet"}, read ${time(st.at)}.${st.piError ? ` It can't reach the market now (${st.piError}).` : ""}`
        : `Your Pi can't be reached (${st.error})${st.at ? `; last read ${time(st.at)}` : ""}. Prices saved on this device fill in meanwhile.`;
    // Your orders, when the Pi takes them: how the last send went.
    const orders = st.orders;
    const ordersText = !orders ? "" : orders.error ? ` Your orders couldn't be sent (${orders.error}); ${orders.waiting} waiting.` : orders.at ? ` Your orders: ${orders.waiting ? `${orders.waiting} waiting` : "all on the Pi"}, sent ${time(orders.at)}.` : "";
    return `<div class="mwia-history-note">${esc(text + ordersText)}</div>
        <div class="mwia-history-ranges"><button data-history-pi="sync">↻ Read the Pi now</button><button data-history-pi="unlink">Unlink the Pi</button></div>`;
}

function onClick(event) {
    const piButton = event.target.closest?.(".mwia-history [data-history-pi]");
    if (piButton) {
        event.preventDefault();
        event.stopPropagation();
        if (piButton.dataset.historyPi === "unlink") unlinkPi();
        else syncNow();
        return;
    }
    const exportButton = event.target.closest?.(".mwia-history [data-history-export]");
    if (exportButton) {
        event.preventDefault();
        event.stopPropagation();
        onExport(exportButton.dataset.historyExport);
        return;
    }
    const button = event.target.closest?.(".mwia-history [data-range]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    h.range = Number(button.dataset.range);
    scheduleScan(true);
}

// The box: a one-line summary, with the table, chart and export folded under it.
// Each +level has its own prices, saved since +levels were added to the history.
async function historyHtml(itemHrid, level = 0) {
    await loadHistory();
    const summary = priceSummary(itemHrid, level);
    const entry = marketEntry(itemHrid, level);
    const head = (text) => `<div class="mwia-history-head"><b>📈 Usual price${level ? ` <span class="mwia-enh">+${level}</span>` : ""}</b> <span>${text}</span></div>`;
    const saved = sourceHtml();
    const more = (title, body) => `<details class="mwia-history-more"${h.open ? " open" : ""}><summary>${title}</summary>${body}${exportHtml()}</details>`;
    if (!summary || summary.hours7 < PRELIMINARY_HOURS) {
        return head(`collecting: ${summary ? progressText(summary) : "nothing yet"}`) + more("Export", saved);
    }
    const versusText = (now, side) => {
        const versus = versusUsual(now, side.med7);
        const cls = !versus ? "" : versus.label === "above" ? "mwia-history-high" : versus.label === "below" ? "mwia-history-low" : "";
        return versus ? `<span class="${cls}">${pct(versus.diff)} ${versus.label === "near" ? "usual" : versus.label}</span>` : "";
    };
    const row = (label, now, side) => `<tr><th>${label}</th><td>${now > 0 ? shortCoins(now) : "–"}</td>
            <td>${side.med7 ? shortCoins(side.med7) : "–"} ${versusText(now, side)}</td>
            <td>${side.med30 ? shortCoins(side.med30) : "–"}</td><td>${trendArrow(side.trend)}</td></tr>`;
    const askNow = entry?.a > 0 ? entry.a : null;
    const bidNow = entry?.b > 0 ? entry.b : null;
    // Ask 366 +0% usual → · Bid 365 +2% usual · swings ±1%
    const brief = (label, now, side) => `${label} <b>${now > 0 ? shortCoins(now) : "–"}</b> ${versusText(now, side)}${trendArrow(side.trend) ? " " + trendArrow(side.trend) : ""}`;
    const swing = summary.a.swing ?? summary.b.swing;
    const line = `<div class="mwia-history-sum">${brief("Ask", askNow, summary.a)} · ${brief("Bid", bidNow, summary.b)}${swing !== null ? ` · <span title="Half of the week's prices lie within this share of the 7-day median">swings ±${Math.round(swing * 100)}%</span>` : ""}</div>`;
    const points = h.open ? await priceSeries(itemHrid, h.range, level) : [];
    const long = h.open && h.range > 31 ? await longMedians(itemHrid, level) : null;
    const longLine = long?.days ? `<div class="mwia-history-note">90 days: ask ${long.a90 ? shortCoins(long.a90) : "–"}, bid ${long.b90 ? shortCoins(long.b90) : "–"} · 1 year: ask ${long.a365 ? shortCoins(long.a365) : "–"}, bid ${long.b365 ? shortCoins(long.b365) : "–"} (${long.days} days of data)</div>` : "";
    const preliminary = !summary.enough;
    return (
        (preliminary ? head(`<b class="mwia-history-prelim">preliminary</b> · ${readyText(summary)}`) : head(`7-day median · ${summary.spanDays.toFixed(0)} days of data`)) +
        line +
        more(
            "Chart and details",
            `<table class="mwia-history-table"><tr><th></th><th>Now</th><th>7 days</th><th>30 days</th><th>Trend</th></tr>${row("Ask", askNow, summary.a)}${row("Bid", bidNow, summary.b)}</table>` +
                chartSvg(points) +
                `<div class="mwia-history-ranges">${RANGES.map((r) => `<button data-range="${r}" class="${r === h.range ? "mwia-active" : ""}">${r === 365 ? "1 y" : `${r} d`}</button>`).join("")}
          <span><i class="mwia-history-ask"></i>ask <i class="mwia-history-bid"></i>bid</span></div>` +
                longLine +
                (preliminary
                    ? `<div class="mwia-history-note">Preliminary: ${progressText(summary)}. Only ${summary.hours7} h over ${summary.spanDays.toFixed(1)} days, so one odd day can still move it. The Skilling tab warns only once it is ready.</div>`
                    : `<div class="mwia-history-note">${summary.hours7} h in the last week.</div>`) +
                saved
        )
    );
}

// The short form for the summary line: "ready in about 1 day".
function readyText(summary) {
    const parts = progressText(summary).split(" · ");
    return parts.length > 2 ? parts.slice(2).join(" · ") : "almost ready";
}

// "12 h ✓ · 0.9 of 2 days · ready in about 1 day": both are needed – enough
// hours of prices, spread over at least two days.
function progressText(summary) {
    const hoursLeft = Math.max(0, MIN_HOURS - summary.hours7);
    // A linked Pi collects around the clock.
    const open = piConfig() ? "" : " with the game open";
    const daysLeft = Math.max(0, MIN_DAYS - summary.spanDays);
    const parts = [
        hoursLeft ? `${summary.hours7} of ${MIN_HOURS} h` : `${MIN_HOURS} h ✓`,
        daysLeft ? `${summary.spanDays.toFixed(1)} of ${MIN_DAYS} days` : `${MIN_DAYS} days ✓`,
    ];
    if (daysLeft) {
        const wait = daysLeft * 24;
        parts.push(`ready in about ${wait < 20 ? Math.max(1, Math.round(wait)) + " h" : Math.round(daysLeft * 10) / 10 + " day" + (daysLeft > 1.05 ? "s" : "")}${hoursLeft ? ` and ${hoursLeft} more h${open}` : ""}`);
    } else if (hoursLeft) {
        parts.push(`${hoursLeft} more h${open}`);
    }
    return parts.join(" · ");
}

// Two lines, ask and bid, scaled together: prices up the side (highest at the
// top, lowest at the bottom), dates along the bottom.
const dateText = (t) => new Date(t * 3600 * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" });
function chartSvg(points) {
    if (points.length < 2) return "";
    const W = 300;
    const H = 64;
    const values = points.flatMap((p) => [p.a, p.b]).filter(Number.isFinite);
    const low = Math.min(...values);
    const high = Math.max(...values);
    const t0 = points[0].t;
    const span = Math.max(1, points[points.length - 1].t - t0);
    const x = (t) => ((t - t0) / span) * (W - 4) + 2;
    const y = (v) => (high === low ? H / 2 : H - 4 - ((v - low) / (high - low)) * (H - 8));
    const line = (key, cls) => {
        const path = points.filter((p) => Number.isFinite(p[key])).map((p) => `${x(p.t).toFixed(1)},${y(p[key]).toFixed(1)}`).join(" ");
        return path ? `<polyline class="${cls}" points="${path}"/>` : "";
    };
    const t1 = points[points.length - 1].t;
    return `<div class="mwia-history-plot"><div class="mwia-history-scale mwia-history-y"><span>${esc(shortCoins(high))}</span><span>${esc(shortCoins(low))}</span></div>
        <svg class="mwia-history-chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${line("b", "mwia-history-bid")}${line("a", "mwia-history-ask")}</svg>
        <span></span><div class="mwia-history-scale mwia-history-x"><span>${dateText(t0)}</span><span>${dateText((t0 + t1) / 2)}</span><span>${dateText(t1)}</span></div></div>`;
}
