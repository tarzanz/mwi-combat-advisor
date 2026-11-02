// Job results in the game's Loot & XP Log: under each finished skilling job,
// a 🧭 line with what it really gave – the log's actions, time and drops, what
// they used (worked out from the action), what you paid for it (your buy
// orders) – against the advice when the job began (kept as each job starts).
// Only what the game itself fetches when the log is opened is read.

import { onStateChange, orderBookAt, state } from "./game-state.js";
import { getClientData, itemName, marketEntry, pricesStamp } from "./game-data.js";
import { MARKET_TAX } from "./skilling.js";
import { ALCHEMY_KINDS, bulkOf, coinCost, successOutputs } from "./alchemy.js";
import { adviceName, skillingAdvice, skillingMarket } from "./skilling-ui.js";
import { visible } from "./game-nav.js";
import { esc, shortCoins } from "./format.js";
import { compactForecast, emptyLedger, groupHistory, jobGroup, jobReport, keepReport, keyOf, markSent, mergeFromPi, noteFills, runningAction, unsentForPi } from "./job-ledger.js";

const KEY = "mwia-jobs";
const COIN = "/items/coin";
const HEADING = /^loot\s*&\s*xp\s*log$/i;
const START = /^Start Time:\s*(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)/;
const MAX_FORECASTS = 60;

// sync: the Pi's job sync (pi-sync.js) when linked; changed: called when something is new for the Pi.
const j = { deps: null, ledger: null, preparing: null, timer: null, soFar: new Map(), sync: null, changed: new Set() };
// How long the log waits for the Pi before working results out without it.
const PI_WAIT_MS = 4000;

function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "null");
        if (saved && saved.purchases) return { ...emptyLedger(), ...saved, unsent: { reports: [], purchases: [], ...saved.unsent } };
        // v0.51: lots and results without a history – carried over as purchases and kept results.
        if (saved && Array.isArray(saved.lots)) {
            const L = { ...emptyLedger(), fills: saved.fills || {}, forecasts: saved.forecasts || {}, since: saved.since || Date.now() };
            for (const lot of saved.lots) L.purchases[`v051-${lot.id ?? lot.at}`] = { key: lot.key, filled: lot.qty, cost: lot.qty * lot.unit, at: lot.at, estimate: !!lot.estimate };
            for (const [key, report] of Object.entries(saved.reports || {})) if (report?.used && Number.isFinite(report.endedAt)) keepReport(L, key, { ...report, key });
            L.unsent.purchases = Object.keys(L.purchases);
            return L;
        }
    } catch {
        // storage blocked or broken: start over
    }
    return emptyLedger();
}

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(j.ledger));
    } catch {
        // storage full or blocked: kept for this page only
    }
}

// deps: settings() -> the advisor's settings, prepare() -> loads the game data and prices.
export function startJobLog(deps) {
    j.deps = deps;
    j.ledger = load();
    onStateChange(onMessage);
    if (state.character) onMessage("init_character_data", state.character);
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-jobline"))) return;
        schedule();
    }).observe(document.body, { childList: true, subtree: true });
}

function onMessage(type, data) {
    try {
        const L = j.ledger;
        if (type === "init_character_data" || type === "market_listings_updated") {
            const listings = data.myMarketListings ?? data.marketListings ?? data.endMarketListings ?? [];
            if (noteFills(L, listings, { now: Date.now(), live: type === "market_listings_updated", bookOf: (hrid, level) => orderBookAt(hrid, level)?.asks || null })) changed();
            save();
        }
        if (type === "init_character_data" || type === "actions_updated" || type === "action_completed") keepForecast();
        // A job that ended changes its line from "so far" to "ended".
        if (type === "actions_updated") schedule();
        if (type === "loot_log_updated") {
            // First what other devices worked out (through the Pi), if it answers soon.
            const synced = j.sync ? Promise.race([j.sync().catch(() => null), new Promise((r) => setTimeout(r, PI_WAIT_MS))]) : Promise.resolve();
            synced.then(() => {
                reportLog();
                schedule();
            });
        }
    } catch (error) {
        console.error("[MWI Advisor] job log", error);
    }
}

const ready = () => !!getClientData() && pricesStamp() > 0;

// Loads the game data and prices, then does it again.
function whenReady(then) {
    if (ready()) return true;
    j.preparing ||= j.deps
        ?.prepare()
        .then(() => then())
        .catch((error) => console.warn("[MWI Advisor] job log", error))
        .finally(() => (j.preparing = null));
    return false;
}

const settings = () => ({ ...(j.deps?.settings() || {}), skillingTeas: "current" });
const itemOfHash = (hash) => String(hash || "").split("::")[2] || null;
const skillOf = (actionHrid) => String(actionHrid || "").split("/")[2] || "";
// The skilling jobs worth a result: not fights, not Enhancing (luck with the +levels).
const counted = (actionHrid) => !!actionHrid && !["combat", "enhancing"].includes(skillOf(actionHrid));

// The advice for the job that runs now, kept until its log entry shows up.
function keepForecast() {
    const L = j.ledger;
    const running = runningAction(state.character?.characterActions);
    if (!running || !counted(running.actionHrid) || L.forecasts[running.id]) return;
    if (!whenReady(keepForecast)) return;
    L.forecasts[running.id] = { at: Date.now(), forecast: forecastFor(running.actionHrid, itemOfHash(running.primaryItemHash)) };
    const ids = Object.keys(L.forecasts).sort((a, b) => L.forecasts[a].at - L.forecasts[b].at);
    for (const id of ids.slice(0, Math.max(0, ids.length - MAX_FORECASTS))) delete L.forecasts[id];
    save();
}

function forecastFor(actionHrid, item) {
    try {
        const entry = skillingAdvice(actionHrid, settings(), item ? { itemHrid: item } : null);
        if (!entry?.valid) return null;
        const f = compactForecast(entry);
        if (f) {
            f.name = adviceName(entry);
            f.catalyst = entry.catalyst?.itemHrid || null;
        }
        return f;
    } catch (error) {
        console.warn("[MWI Advisor] job log forecast", error);
        return null;
    }
}

const entryKey = (e) => `${e.characterActionId}|${e.startTime}`;
const time = (text) => {
    const t = Date.parse(text);
    return Number.isFinite(t) && t > Date.UTC(2000, 0, 1) ? t : null;
};
const ended = (e) => time(e.endTime) !== null && time(e.endTime) > time(e.startTime);

// Still running: the game's log gives a running job an end too (its latest
// action), so the queue tells – the job is there until it ends.
function running(e) {
    const queue = state.character?.characterActions;
    if (!queue) return !ended(e);
    return queue.some((a) => a.id === e.characterActionId && a.actionHrid === e.actionHrid && !a.isDone);
}

// A kept result that no longer matches its entry (worked out from an older look at it).
const stale = (kept, e) => kept.actions !== (Number(e.actionCount) || 0) || kept.endedAt !== time(e.endTime);

const changed = () => {
    for (const listener of j.changed) listener();
};

// --- For the Pi (pi-sync.js) ---

// sync() -> a promise: reads the Pi and sends it what is new; called before the log's results are worked out.
export function useJobSync(sync) {
    j.sync = sync;
}
// Called when there is something new for the Pi.
export function onJobsChanged(listener) {
    j.changed.add(listener);
}
export const jobsPiSeq = () => j.ledger?.piSeq || 0;
export const jobsForPi = () => (j.ledger ? unsentForPi(j.ledger) : { reports: [], purchases: [] });
export function jobsSentToPi(sent) {
    if (!j.ledger) return;
    markSent(j.ledger, sent);
    save();
}
// What the Pi has: other devices' results and purchases.
export function jobsFromPi(wire) {
    if (!j.ledger) return;
    if (mergeFromPi(j.ledger, wire)) schedule();
    save();
}

// Works out the results of the log's finished jobs, oldest first (they take
// the oldest of your bought lots), again for one whose entry changed since;
// a running job gets a result so far, kept in memory, that uses no lots.
function reportLog() {
    const L = j.ledger;
    const log = (state.lootLog || []).filter((e) => counted(e.actionHrid) && time(e.startTime) !== null);
    const todo = log.filter((e) => (running(e) ? ended(e) : ended(e) && (!L.history[entryKey(e)] || stale(L.history[entryKey(e)], e))));
    if (!todo.length || !whenReady(() => (reportLog(), schedule()))) return;
    const data = getClientData();
    for (const e of todo.sort((a, b) => time(a.endTime) - time(b.endTime))) {
        const kept = L.forecasts[e.characterActionId]?.forecast || null;
        const item = itemOfHash(e.primaryItemHash);
        const forecast = kept || forecastFor(e.actionHrid, item);
        const job = {
            id: e.characterActionId,
            actionHrid: e.actionHrid,
            item,
            endedAt: time(e.endTime),
            actions: Number(e.actionCount) || 0,
            hours: (time(e.endTime) - time(e.startTime)) / 3600000,
            deltas: entryDeltas(e, data, forecast),
            forecast,
            forecastNow: !kept && !!forecast,
        };
        job.name = forecast?.name || jobName(e, data);
        const key = entryKey(e);
        job.key = key;
        const report = jobReport(L, job, pricesFor(forecast));
        report.catalyst = itemOfHash(e.secondaryItemHash);
        // Running: a result so far, kept in memory; it uses up none of your purchases.
        if (running(e)) {
            j.soFar.set(key, report);
            continue;
        }
        j.soFar.delete(key);
        keepReport(L, key, report);
        changed();
    }
    save();
}

// What a log entry made (its drops) and used: the action's materials for its
// actions – Alchemy: the item (its bulk), the coins, and the catalyst for
// each success (worked out from what the successes dropped).
export function entryDeltas(e, data, forecast) {
    const deltas = {};
    const add = (key, d) => (deltas[key] = (deltas[key] || 0) + d);
    for (const [key, n] of Object.entries(e.drops || {})) add(key.includes("::") ? key : keyOf(key), Number(n) || 0);
    const count = Number(e.actionCount) || 0;
    const item = itemOfHash(e.primaryItemHash);
    if (skillOf(e.actionHrid) === "alchemy") {
        const kind = e.actionHrid.split("/").pop();
        const detail = data.itemDetailMap[item];
        if (!detail || !ALCHEMY_KINDS[kind]) return deltas;
        const bulk = bulkOf(detail);
        add(keyOf(item), -bulk * count);
        const coins = coinCost(kind, detail) * count;
        if (coins) add(keyOf(COIN), -coins);
        const catalyst = itemOfHash(e.secondaryItemHash);
        if (catalyst) {
            const per = successOutputs(kind, detail).filter((o) => o.count > 0);
            const dropped = (o) => Number(e.drops?.[keyOf(o.itemHrid)]) || 0;
            // Transmute: one roll of its table a success; Decompose and Coinify: all of it, each.
            const successes = Math.min(
                count,
                Math.round(
                    kind === "transmute"
                        ? per.reduce((sum, o) => sum + dropped(o), 0) / Math.max(1e-9, per.reduce((sum, o) => sum + o.count * bulk, 0))
                        : Math.max(0, ...per.map((o) => dropped(o) / (o.count * bulk))),
                ),
            );
            add(keyOf(catalyst), -successes);
        }
        return deltas;
    }
    const action = data.actionDetailMap[e.actionHrid];
    // The advice's materials (Artisan's saving in them), else the action's own.
    const inputs = forecast?.inputs?.length ? forecast.inputs : [...(action?.inputItems || []), ...(action?.upgradeItemHrid ? [{ itemHrid: action.upgradeItemHrid, count: 1 }] : [])];
    for (const input of inputs) add(keyOf(input.itemHrid), -input.count * count);
    return deltas;
}

function jobName(e, data) {
    const item = itemOfHash(e.primaryItemHash);
    if (skillOf(e.actionHrid) === "alchemy") return `${ALCHEMY_KINDS[e.actionHrid.split("/").pop()]?.name || "Alchemy"} ${item ? itemName(item) : ""}`.trim();
    return data.actionDetailMap[e.actionHrid]?.name || e.actionHrid.split("/").pop();
}

function pricesFor(forecast) {
    const sellAt = settings().skillingSellAt === "bid" ? "bid" : "ask";
    const market = skillingMarket(sellAt);
    const advised = new Map((forecast?.inputs || []).map((i) => [i.itemHrid, i.price]));
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

// --- In the Loot & XP Log ---

function schedule() {
    if (j.timer) return;
    j.timer = setTimeout(() => {
        j.timer = null;
        decorate();
    }, 300);
}

const pad = (n) => String(n).padStart(2, "0");
// The game shows the start in local time, to the second.
export function localStamp(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function decorate() {
    const heading = [...document.querySelectorAll("div,h1,h2,h3,span")].find((el) => el.children.length === 0 && HEADING.test(el.textContent.trim()) && visible(el));
    if (!heading || !state.lootLog) return;
    const byStart = new Map(state.lootLog.filter((e) => counted(e.actionHrid) && time(e.startTime) !== null).map((e) => [localStamp(time(e.startTime)), e]));
    for (const el of document.querySelectorAll("div,span,p")) {
        if (el.children.length !== 0) continue;
        const match = START.exec(el.textContent.trim());
        const e = match && byStart.get(match[1]);
        if (!e) continue;
        // The entry's card: the first box around the start that holds its duration too.
        let card = el.parentElement;
        for (let i = 0; i < 3 && card && !/Duration/.test(card.textContent); i++) card = card.parentElement;
        if (!card) continue;
        const key = entryKey(e);
        const report = j.ledger.reports[key];
        const kept = j.ledger.history[key];
        const soFar = j.soFar.get(key);
        const html = running(e)
            ? soFar && soFar.actions === (Number(e.actionCount) || 0)
                ? lineHtml(soFar, "running")
                : `<div class="mwia-dim">🧭 running – the result comes when it ends</div>`
            : report && kept && !stale(kept, e)
            ? lineHtml(report)
            : soFar
            ? lineHtml(soFar, "ended")
            : `<div class="mwia-dim">🧭 working it out…</div>`;
        let line = [...card.children].find((c) => c.classList.contains("mwia-jobline"));
        if (!line) {
            line = document.createElement("div");
            line.className = "mwia-jobline";
            card.appendChild(line);
        }
        if (line.dataset.html !== html) {
            const open = line.querySelector("details")?.open;
            line.dataset.html = html;
            line.innerHTML = html;
            if (open) line.querySelector("details").open = true;
        }
    }
}

const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const signed = (n) => (n >= 0 ? "+" : "−") + shortCoins(Math.abs(n));
const pct = (x) => (x === null || x === undefined ? "–" : `${(x * 100).toFixed(1)}%`);
const qty = (n) => (Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n).toLocaleString("en-US") : n.toLocaleString("en-US", { maximumFractionDigits: 1 }));
const levelText = (level) => (level ? ` +${level}` : "");
function duration(hours) {
    const minutes = Math.round(hours * 60);
    return minutes < 60 ? `${minutes} min` : `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

// state: "running" – a result so far; "ended" – so far, until the log is fetched again.
export function lineHtml(r, state = null) {
    const f = r.forecast;
    const head = `🧭 ${state ? `<span class="mwia-dim">${state === "running" ? "so far" : "ended – tap Refresh"}:</span> ` : ""}<b class="${r.profit >= 0 ? "mwia-ok" : "mwia-bad"}">${signed(r.profit)}</b>${r.perHour !== null ? ` · ${coins(r.perHour)}/h` : ""} · margin ${pct(r.margin)}${f ? ` <span class="mwia-dim">(${pct(f.margin)} expected)</span>` : ""}`;
    const lines = [];
    if (f) {
        lines.push(`Expected for these ${qty(f.actions)} actions${f.now ? " (advice worked out now – the job began before the advisor saw it)" : ""}: <b>${signed(f.profit)}</b> at a ${pct(f.margin)} margin, ${coins(f.perHour)}/h.`);
        const names = { yield: "what came out", prices: "what it sells for now", usage: "what it used", bought: "what the materials cost", teas: "teas" };
        const parts = Object.entries(f.parts).filter(([, v]) => Math.abs(v) >= Math.max(1, Math.abs(r.revenue) * 0.002)).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));
        if (parts.length) lines.push(`Where the difference came from: ${parts.map(([k, v]) => `${names[k]} <span class="${v >= 0 ? "mwia-ok" : "mwia-bad"}">${signed(v)}</span>`).join(" · ")}.`);
        if (r.actionsPerHour) lines.push(`Speed: ${qty(Math.round(r.actionsPerHour))} actions/h (${qty(Math.round(f.actionsPerHour))} expected) · ${duration(r.hours)}.`);
        if ((f.catalyst || null) !== (r.catalyst || null)) lines.push(`<span class="mwia-dim">The advice counted on ${f.catalyst ? esc(itemName(f.catalyst)) : "no catalyst"}; the job used ${r.catalyst ? esc(itemName(r.catalyst)) : "none"}.</span>`);
    } else lines.push("No advice to compare with.");
    if (r.made.length) lines.push(`Made: ${r.made.map((m) => `${qty(m.qty)} ${esc(itemName(m.itemHrid))}${levelText(m.level)} × ${coins(m.unit)} = ${coins(m.total)}`).join(" · ")}.`);
    if (r.used.length) lines.push(`Used: ${r.used.map((u) => `${qty(u.qty)} ${esc(itemName(u.itemHrid))}${levelText(u.level)} × ${coins(u.unit)} = ${coins(u.total)}${u.bought > 0 ? ` <span class="mwia-dim">(${u.bought >= u.qty - 1e-6 ? "all" : qty(u.bought)} at what you paid${u.boughtEstimate ? ", bought at once: priced up the order book seen" : ""})</span>` : ""}`).join(" · ")}${r.teas >= 1 ? ` · teas ≈ ${coins(r.teas)}` : ""}.`);
    const earlier = groupHistory(j.ledger, jobGroup(r.actionHrid, r.item), r.key);
    if (earlier) lines.push(`Earlier jobs like this: ${earlier.jobs}${earlier.days >= 1 ? ` over ${Math.round(earlier.days)} day${Math.round(earlier.days) === 1 ? "" : "s"}` : ""} – margin ${pct(earlier.margin)}${earlier.expectedMargin !== null ? ` (${pct(earlier.expectedMargin)} expected)` : ""}${earlier.perHour !== null ? `, ${coins(earlier.perHour)}/h` : ""}, <span class="${earlier.profit >= 0 ? "mwia-ok" : "mwia-bad"}">${signed(earlier.profit)}</span> in all.`);
    if (state === "running") lines.push(`<span class="mwia-dim">Still running: what the log said when it was last fetched (tap Refresh for now); your purchases aren't used up until it ends.</span>`);
    if (state === "ended") lines.push(`<span class="mwia-dim">It has ended since the log was fetched: tap Refresh for the whole job.</span>`);
    const age = Math.max(0, Math.round((r.pricedAt - r.endedAt) / 60000));
    lines.push(`<span class="mwia-dim">Made at the market ${age > 5 ? `${duration(age / 60)} after it ended (when first seen)` : "as it ended"}, the ${Math.round(MARKET_TAX * 100)}% tax off; used at what you paid, else the advice's price${r.teas >= 1 ? "; teas at the advice's rate" : ""}${skillOf(r.actionHrid) === "alchemy" ? "; the catalyst one per success, from what the successes dropped" : "; materials as the action takes them (Artisan's saving as expected)"}.</span>`);
    return `<details><summary>${head}</summary>${lines.map((l) => `<p>${l}</p>`).join("")}</details>`;
}
