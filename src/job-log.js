// The job log: follows every skilling job the game runs (not fights), and
// when one ends, shows what it really gave against the advice when it began
// (see job-ledger.js). Kept in this browser's storage.

import { onStateChange, orderBookAt, state } from "./game-state.js";
import { getClientData, itemName, marketEntry, pricesStamp } from "./game-data.js";
import { MARKET_TAX } from "./skilling.js";
import { adviceName, skillingAdvice, skillingMarket } from "./skilling-ui.js";
import { esc, shortCoins } from "./format.js";
import { MAX_DONE, compactForecast, emptyLedger, endJob, jobReport, keyOf, noteAction, noteFills, noteOther, noteReturn, runningAction, startJob } from "./job-ledger.js";

const KEY = "mwia-jobs";
const INVENTORY = "/item_locations/inventory";
const COIN = "/items/coin";

const j = { deps: null, ledger: null, preparing: null, listeners: new Set() };

function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "null");
        if (saved && Array.isArray(saved.done) && Array.isArray(saved.lots)) return { ...emptyLedger(), ...saved };
    } catch {
        // storage blocked or broken: start over
    }
    return emptyLedger();
}

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(j.ledger));
    } catch {
        // storage full or blocked: the log lives for this page only
    }
}

// deps: settings() -> the advisor's settings, prepare() -> loads the game data and prices.
export function startJobLog(deps) {
    j.deps = deps;
    j.ledger = load();
    onStateChange(onMessage);
    // Messages may have come before the panel was mounted.
    if (state.character) onMessage("init_character_data", state.character, {});
}

// Called when a report is ready (the Skilling tab re-renders).
export function onJobsChanged(listener) {
    j.listeners.add(listener);
}

const isDrink = (hrid) => getClientData()?.itemDetailMap?.[hrid]?.categoryHrid === "/item_categories/drink";
const characterId = () => state.character?.character?.id ?? null;

// The inventory as { key: count }, teas left out (they are counted at the advice's rate).
function inventoryNow() {
    const inv = {};
    for (const item of state.items.values()) {
        if (item.itemLocationHrid !== INVENTORY || !item.itemHrid || isDrink(item.itemHrid)) continue;
        const key = keyOf(item.itemHrid, item.enhancementLevel);
        inv[key] = (inv[key] || 0) + (Number(item.count) || 0);
    }
    return inv;
}

const inventoryChanges = (changes) => (changes || []).filter((c) => c.location === INVENTORY && c.itemHrid && !isDrink(c.itemHrid)).map((c) => ({ key: keyOf(c.itemHrid, c.level), delta: c.delta }));

function onMessage(type, data, extra = {}) {
    try {
        const L = j.ledger;
        if (!L) return;
        if (type === "init_character_data" || type === "market_listings_updated") {
            const listings = data.myMarketListings ?? data.marketListings ?? data.endMarketListings ?? [];
            noteFills(L, listings, { now: Date.now(), live: type === "market_listings_updated", bookOf: (hrid, level) => orderBookAt(hrid, level)?.asks || null });
        }
        if (type === "init_character_data") onReturn();
        else if (type === "action_completed") onAction(data, extra.changes);
        else if (type === "items_updated" && L.active) noteOther(L.active, inventoryChanges(extra.changes));
        else if (type === "actions_updated") onQueue();
        else if (type !== "market_listings_updated") return;
        save();
    } catch (error) {
        console.error("[MWI Advisor] job log", error);
    }
}

// The page (re)started or the game came back after the page slept.
function onReturn() {
    const L = j.ledger;
    const queue = state.character?.characterActions || [];
    if (L.active && L.active.characterId !== characterId()) L.active = null;
    if (L.active) {
        const job = L.active;
        const primary = job.forecast?.inputs.filter((i) => i.itemHrid !== COIN && !i.catalyst).sort((a, b) => b.count * b.price - a.count * a.price)[0];
        // An ended job without a set count: as many actions as its main material went down by.
        const isPrimary = (diff) => (primary ? Math.max(0, Math.round(-(diff[keyOf(primary.itemHrid)] || 0) / primary.count)) : 0);
        if (noteReturn(job, { inv: inventoryNow(), queue, now: Date.now(), isPrimary }) === "ended") finish(false);
    }
    begin(runningAction(queue));
}

function onAction(data, changes) {
    const L = j.ledger;
    const action = data.endCharacterAction || null;
    const now = Date.now();
    const mine = inventoryChanges(changes);
    if (L.active && action && action.id !== L.active.id) finish(true);
    if (!L.active) {
        const running = action && !String(action.actionHrid || "").startsWith("/actions/combat/") ? action : runningAction(state.character?.characterActions);
        if (!running) return;
        // The inventory before this action: now, less what it changed.
        const inv = inventoryNow();
        for (const { key, delta } of mine) inv[key] = (inv[key] || 0) - delta;
        begin({ ...running, currentCount: Math.max(0, (Number(running.currentCount) || 0) - 1) }, inv);
        if (!L.active) return;
    }
    noteAction(L.active, mine, { now, count: action ? Number(action.currentCount) || 0 : null });
    if ((!L.active.name || L.active.forecast?.name) && getClientData()) L.active.name = jobName(L.active);
    // Once the game data and prices are there, the advice is worked out once (it may not exist for every job).
    if (!L.active.forecast && !L.active.forecastTried) L.active.forecast = forecastFor(L.active);
    if (action?.isDone) finish(true);
}

// The queue changed: the job that ran ended if another runs now (or none).
function onQueue() {
    const L = j.ledger;
    const running = runningAction(state.character?.characterActions);
    if (L.active && running?.id !== L.active.id) finish(true);
    begin(running);
}

function begin(action, inv = null) {
    const L = j.ledger;
    if (L.active || !action) return;
    L.active = startJob(action, { now: Date.now(), inv: inv || inventoryNow() });
    L.active.characterId = characterId();
    L.active.forecast = forecastFor(L.active);
    L.active.name = jobName(L.active);
    // The name can wait for the game data, like the advice.
    if (!getClientData()) L.active.name = "";
}

function finish(seen) {
    const L = j.ledger;
    const job = L.active;
    if (!job) return;
    L.active = null;
    endJob(job, { now: Date.now(), seen });
    // A job that did nothing (stopped at once, or never seen working) isn't worth a row.
    if (job.live + job.gap + job.missed === 0) return;
    job.name ||= jobName(job);
    L.done.unshift({ job, report: null });
    L.done.length = Math.min(L.done.length, MAX_DONE);
    reportPending();
}

const ready = () => !!getClientData() && pricesStamp() > 0;

// Works out the ended jobs' results once the game data and prices are there.
function reportPending(notify = true) {
    const L = j.ledger;
    if (!L.done.some((d) => !d.report)) return;
    if (!ready()) {
        j.preparing ||= j.deps
            ?.prepare()
            .then(() => {
                reportPending();
                save();
            })
            .catch((error) => console.warn("[MWI Advisor] job log", error))
            .finally(() => (j.preparing = null));
        return;
    }
    // Oldest first: they take the oldest of your bought lots.
    for (const d of [...L.done].reverse()) {
        if (d.report) continue;
        d.report = jobReport(L, d.job, pricesFor(d.job));
        delete d.job;
    }
    save();
    if (notify) for (const listener of j.listeners) listener();
}

const settings = () => ({ ...(j.deps?.settings() || {}), skillingTeas: "current" });

function pricesFor(job) {
    const sellAt = settings().skillingSellAt === "bid" ? "bid" : "ask";
    const market = skillingMarket(sellAt);
    const advised = new Map((job.forecast?.inputs || []).map((i) => [i.itemHrid, i.price]));
    return {
        value(hrid, level) {
            if (!level) return market.sell(hrid).price;
            const e = marketEntry(hrid, level);
            const p = sellAt === "ask" ? e?.a || e?.b : e?.b || e?.a;
            return p > 0 ? p * (1 - MARKET_TAX) : getClientData()?.itemDetailMap?.[hrid]?.sellPrice || 0;
        },
        cost(hrid, level) {
            if (!level && advised.get(hrid) > 0) return advised.get(hrid);
            if (!level) return market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
            const e = marketEntry(hrid, level);
            return e?.a || e?.b || 0;
        },
    };
}

// The advice for the job when it began (not Enhancing: its result is luck with the +levels).
function forecastFor(job) {
    if (!ready() || !state.character) return null;
    job.forecastTried = true;
    if (job.actionHrid.startsWith("/actions/enhancing/")) return null;
    try {
        const entry = skillingAdvice(job.actionHrid, settings(), job.item ? { itemHrid: job.item, target: job.target } : null);
        if (!entry?.valid) return null;
        const f = compactForecast(entry);
        if (f) f.name = adviceName(entry);
        return f;
    } catch (error) {
        console.warn("[MWI Advisor] job log forecast", error);
        return null;
    }
}

function jobName(job) {
    if (job.forecast?.name) return job.forecast.name;
    const action = getClientData()?.actionDetailMap?.[job.actionHrid];
    const verb = action?.name || job.actionHrid.split("/").pop().replace(/_/g, " ");
    return job.item && !action?.inputItems ? `${verb} ${itemName(job.item)}` : verb;
}

// --- The Skilling tab's section ---

const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const signed = (n) => (n >= 0 ? "+" : "−") + shortCoins(Math.abs(n));
const pct = (x) => (x === null || x === undefined ? "–" : `${(x * 100).toFixed(1)}%`);
const qty = (n) => (Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n).toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));
const levelText = (level) => (level ? ` +${level}` : "");
function duration(hours) {
    if (!(hours > 0)) return "–";
    const minutes = Math.round(hours * 60);
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}
const ago = (at) => duration((Date.now() - at) / 3600000);

export function jobsHtml() {
    const L = j.ledger;
    if (!L || (!L.active && !L.done.length)) return "";
    reportPending(false);
    let html = `<section><h3>Recent jobs</h3><p class="mwia-dim">What each skilling job gave once it ended: what it made at the market then (the ${Math.round(MARKET_TAX * 100)}% tax off), what it used at what you paid (your buy orders, else the market when it began), against the advice when it began.</p>`;
    if (L.active) {
        const a = L.active;
        const seen = a.live + a.gap + a.missed;
        html += `<p class="mwia-dim">Following: <b>${esc(a.name || "")}</b>${seen ? ` – ${qty(seen)} action${seen === 1 ? "" : "s"} so far` : ""}.</p>`;
    }
    html += `<div class="mwia-skill-list">${L.done.map((d) => (d.report ? jobRow(d.report) : `<div class="mwia-job mwia-dim">${esc(d.job?.name || "")} – waiting for prices…</div>`)).join("")}</div></section>`;
    return html;
}

function jobRow(r) {
    const f = r.forecast;
    const vs = (actual, expected, text) => (f ? ` <span class="mwia-dim">(${text(expected)} expected)</span>` : "");
    const good = r.profit >= 0 ? "mwia-ok" : "mwia-bad";
    const summary = `<summary><span class="mwia-skill-name">${esc(r.name)} <span class="mwia-dim">×${qty(r.actions)}</span><small>${duration(r.hours)} · ended ${ago(r.endedAt)} ago · margin ${pct(r.margin)}${vs(r.margin, f?.margin, pct)}</small></span>
        <span class="mwia-skill-nums"><b class="${good}">${signed(r.profit)}</b><span class="mwia-dim">${r.perHour !== null ? `${coins(r.perHour)}/h` : ""}</span></span></summary>`;
    const lines = [];
    if (f) {
        lines.push(`Expected for these ${qty(f.actions)} actions: <b>${signed(f.profit)}</b> at a ${pct(f.margin)} margin, ${coins(f.perHour)}/h. Got ${signed(r.profit)}${r.perHour !== null ? `, ${coins(r.perHour)}/h` : ""}.`);
        const names = { yield: "what came out", prices: "what it sells for now", usage: "what it used", bought: "what the materials cost", teas: "teas" };
        const parts = Object.entries(f.parts).filter(([, v]) => Math.abs(v) >= Math.max(1, Math.abs(r.revenue) * 0.002)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
        if (parts.length) lines.push(`Where the difference came from: ${parts.map(([k, v]) => `${names[k]} <span class="${v >= 0 ? "mwia-ok" : "mwia-bad"}">${signed(v)}</span>`).join(" · ")}.`);
        if (r.actionsPerHour) lines.push(`Speed: ${qty(Math.round(r.actionsPerHour))} actions/h (${qty(Math.round(f.actionsPerHour))} expected).`);
    } else lines.push(`No advice to compare with${r.actionHrid?.startsWith("/actions/enhancing/") ? " (Enhancing: the result is mostly luck with the +levels)" : ""}.`);
    if (r.made.length) lines.push(`Made: ${r.made.map((m) => `${qty(m.qty)} ${esc(itemName(m.itemHrid))}${levelText(m.level)} × ${coins(m.unit)} = ${coins(m.total)}`).join(" · ")}.`);
    if (r.used.length) lines.push(`Used: ${r.used.map((u) => `${qty(u.qty)} ${esc(itemName(u.itemHrid))}${levelText(u.level)} × ${coins(u.unit)} = ${coins(u.total)}${u.bought > 0 ? ` <span class="mwia-dim">(${u.bought >= u.qty - 1e-6 ? "all" : qty(u.bought)} at what you paid${u.boughtEstimate ? ", bought at once: priced up the order book seen" : ""})</span>` : ""}`).join(" · ")}${r.teas >= 1 ? ` · teas ≈ ${coins(r.teas)}` : ""}.`);
    const notes = [];
    if (r.gap) notes.push(`${qty(r.gap)} of the actions ran while the page slept: read from the inventory when the game came back`);
    if (r.missed) notes.push(`${qty(r.missed)} ran unseen with other jobs after them: ${r.missedFrom === "live" ? "estimated from the ones seen" : r.missedFrom === "advice" ? "estimated from the advice" : "not counted"}`);
    if (r.timeFrom === "speed") notes.push("the time is the actions at the speed seen");
    else if (r.timeFrom === "advice") notes.push("the time is the actions at the advised speed");
    if (r.teas >= 1) notes.push("teas at the advice's rate");
    if (notes.length) lines.push(`<span class="mwia-dim">${notes.join("; ")}.</span>`);
    return `<details class="mwia-skill-row mwia-job">${summary}<div class="mwia-skill-detail">${lines.map((l) => `<p>${l}</p>`).join("")}</div></details>`;
}
