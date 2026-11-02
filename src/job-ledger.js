// What a finished skilling job really gave: what it used (at what you paid,
// where your buy orders show it), what it made (at the market, the tax off),
// the time it took, and where that differs from the advice when it began.
// The game's Loot & XP Log says how many actions, how long and what dropped;
// job-log.js adds what they used. Pure: the messages, prices and storage come
// from job-log.js.

export const MAX_REPORTS = 60;
const LOT_MS = 30 * 24 * 3600 * 1000;
const MAX_LOTS = 300;
// A buy order filling this soon after it is first seen took listings at once,
// cheapest first, not at its own price.
const INSTANT_MS = 2 * 60 * 1000;
const COIN = "/items/coin";

export const keyOf = (hrid, level = 0) => `${hrid}::${Number(level) || 0}`;
export function splitKey(key) {
    const i = key.lastIndexOf("::");
    return { itemHrid: key.slice(0, i), level: Number(key.slice(i + 2)) || 0 };
}

// lots: what you bought, fills: your buy orders as last seen, forecasts: the
// advice per game action id when it began, reports: per log entry.
export function emptyLedger(now = Date.now()) {
    return { since: now, lots: [], fills: {}, forecasts: {}, reports: {} };
}

// The action running now: the queue's first, unless it is a fight.
export function runningAction(actions) {
    const a = (actions || []).find((x) => !x.isDone);
    return a && !String(a.actionHrid || "").startsWith("/actions/combat/") ? a : null;
}

// Your buy orders as the game lists them: what each filled since last seen
// becomes a lot (what you paid a unit). A fill right after an order appears
// (live: it came while the page watched) took listings at once: priced up the
// order book seen for it (bookOf(hrid, level) -> asks), else at the order's price.
export function noteFills(ledger, listings, { now, live, bookOf = () => null }) {
    for (const listing of listings || []) {
        if (!listing || listing.isSell) continue;
        const id = String(listing.id);
        const filled = Number(listing.filledQuantity) || 0;
        const seen = ledger.fills[id];
        const prev = seen?.filled ?? 0;
        // First seen: new if the ledger was already watching (a new order), else an old one.
        const firstSeen = seen?.seen ?? (live && now - ledger.since > INSTANT_MS ? now : 0);
        if (filled > prev) {
            const price = Number(listing.price) || 0;
            const level = Number(listing.enhancementLevel) || 0;
            const qty = filled - prev;
            let unit = price;
            let estimate = false;
            if (firstSeen && now - firstSeen <= INSTANT_MS) {
                const asks = (bookOf(listing.itemHrid, level) || []).filter((o) => o.price > 0 && o.price <= price).sort((a, b) => a.price - b.price);
                let skip = prev;
                let left = qty;
                let sum = 0;
                for (const o of asks) {
                    let q = o.quantity;
                    const s = Math.min(skip, q);
                    skip -= s;
                    q -= s;
                    const take = Math.min(left, q);
                    sum += take * o.price;
                    left -= take;
                    if (left <= 0) break;
                }
                if (left < qty) {
                    unit = (sum + left * price) / qty;
                    estimate = true;
                }
            }
            ledger.lotSeq = (ledger.lotSeq || 0) + 1;
            ledger.lots.push({ id: ledger.lotSeq, key: keyOf(listing.itemHrid, level), qty, left: qty, unit, at: now, estimate });
        }
        ledger.fills[id] = { filled: Math.max(filled, prev), seen: firstSeen, at: now };
    }
    pruneLots(ledger, now);
}

function pruneLots(ledger, now) {
    // Used-up lots stay while young: a result worked out again gives back what it took.
    ledger.lots = ledger.lots.filter((l) => now - l.at < LOT_MS).slice(-MAX_LOTS);
    for (const [id, f] of Object.entries(ledger.fills)) if (now - f.at > LOT_MS) delete ledger.fills[id];
}

// Takes qty of key from your lots, oldest first: { qty, cost, estimate } of
// what they covered; took gets [lot id, qty] of each.
function takeLots(ledger, key, qty, took = []) {
    let left = qty;
    let cost = 0;
    let estimate = false;
    for (const lot of ledger.lots) {
        if (lot.key !== key || lot.left <= 1e-9) continue;
        const take = Math.min(left, lot.left);
        lot.left -= take;
        if (lot.id) took.push([lot.id, take]);
        left -= take;
        cost += take * lot.unit;
        estimate ||= lot.estimate;
        if (left <= 1e-9) break;
    }
    return { qty: qty - Math.max(0, left), cost, estimate };
}

// Gives back to your lots what a result took (to work it out again).
export function giveBackLots(ledger, took) {
    for (const [id, qty] of took || []) {
        const lot = ledger.lots.find((l) => l.id === id);
        if (lot) lot.left = Math.min(lot.qty, lot.left + qty);
    }
}

// A copy of the ledger's lots to work a result out on without using them up.
export const dryLedger = (ledger) => ({ ...ledger, lots: ledger.lots.map((l) => ({ ...l })) });

// A finished job's result. job: { id, name, actionHrid, item, endedAt,
// actions, hours, deltas: { key: made (+) or used (−) }, forecast }. prices:
// { value(hrid, level) -> a unit made is worth (the tax off), cost(hrid, level)
// -> a unit used costs when you didn't buy it }. Takes what it used from your lots.
export function jobReport(ledger, job, prices, now = Date.now()) {
    const f = job.forecast;
    const actions = job.actions;
    const hours = job.hours;
    const made = [];
    const used = [];
    const took = [];
    for (const [key, d] of Object.entries(job.deltas)) {
        if (Math.abs(d) < 1e-9) continue;
        const { itemHrid, level } = splitKey(key);
        if (d > 0) {
            const unit = itemHrid === COIN ? 1 : prices.value(itemHrid, level) ?? 0;
            made.push({ itemHrid, level, qty: d, unit, total: d * unit });
        } else {
            const qty = -d;
            const fromLots = itemHrid === COIN ? { qty: 0, cost: 0, estimate: false } : takeLots(ledger, key, qty, took);
            const rest = qty - fromLots.qty;
            const restUnit = itemHrid === COIN ? 1 : prices.cost(itemHrid, level) ?? 0;
            const total = fromLots.cost + rest * restUnit;
            used.push({ itemHrid, level, qty, unit: total / qty, total, bought: fromLots.qty, boughtEstimate: fromLots.estimate });
        }
    }
    made.sort((a, b) => b.total - a.total);
    used.sort((a, b) => b.total - a.total);
    const teas = f ? f.teaPerHour * hours : 0;
    const revenue = made.reduce((s, m) => s + m.total, 0);
    const cost = used.reduce((s, u) => s + u.total, 0) + teas;
    const profit = revenue - cost;
    const report = {
        id: job.id,
        name: job.name,
        actionHrid: job.actionHrid,
        item: job.item,
        endedAt: job.endedAt,
        pricedAt: now,
        took,
        actions,
        hours,
        made,
        used,
        teas,
        revenue,
        cost,
        profit,
        margin: revenue > 0 ? profit / revenue : null,
        perHour: hours > 0 ? profit / hours : null,
        actionsPerHour: hours > 0 ? actions / hours : null,
        forecast: f ? { ...compare(f, made, used, teas, hours, actions), now: !!job.forecastNow } : null,
    };
    return report;
}

// Against the advice: as many actions as the main material used says (the
// game may count actions differently), and where the difference came from:
// what came out (luck), what it sold for, what it used and what that cost.
function compare(f, made, used, teas, hours, actions) {
    const primary = f.inputs.filter((i) => i.itemHrid !== COIN && !i.catalyst).sort((a, b) => b.count * b.price - a.count * a.price)[0];
    const usedOf = (hrid) => used.find((u) => u.itemHrid === hrid && u.level === 0);
    const n = primary && usedOf(primary.itemHrid) ? usedOf(primary.itemHrid).qty / primary.count : actions;
    const parts = { yield: 0, prices: 0, usage: 0, bought: 0, teas: 0 };
    const outs = new Map(f.outputs.map((o) => [o.itemHrid, o]));
    for (const m of made) {
        const o = m.level === 0 ? outs.get(m.itemHrid) : null;
        const expected = o ? o.count * n : 0;
        parts.yield += (m.qty - expected) * m.unit;
        if (o) parts.prices += expected * (m.unit - o.price);
    }
    for (const o of f.outputs) {
        if (!made.some((m) => m.itemHrid === o.itemHrid && m.level === 0)) parts.yield -= o.count * n * o.price;
    }
    const ins = new Map(f.inputs.map((i) => [i.itemHrid, i]));
    for (const u of used) {
        const i = u.level === 0 ? ins.get(u.itemHrid) : null;
        const expected = i ? i.count * n : 0;
        const price = i ? i.price : u.unit;
        parts.usage -= (u.qty - expected) * price;
        parts.bought -= u.qty * (u.unit - price);
    }
    for (const i of f.inputs) {
        if (!used.some((u) => u.itemHrid === i.itemHrid && u.level === 0)) parts.usage += i.count * n * i.price;
    }
    const expectedTeas = f.actionsPerHour > 0 ? (f.teaPerHour / f.actionsPerHour) * n : 0;
    parts.teas = expectedTeas - teas;
    const profit = f.profitPerAction * n;
    return { actions: n, profit, margin: f.margin, perHour: f.profitPerHour, actionsPerHour: f.actionsPerHour, parts };
}

// What the advice expected, kept small for storage.
export function compactForecast(entry) {
    if (!entry || !(entry.actionsPerHour > 0)) return null;
    return {
        name: entry.name,
        actionsPerHour: entry.actionsPerHour,
        teaPerHour: entry.teaPerHour || 0,
        profitPerHour: entry.profitPerHour,
        profitPerAction: entry.profitPerHour / entry.actionsPerHour,
        margin: entry.margin ?? null,
        inputs: (entry.inputs || []).filter((i) => i.count > 0).map((i) => ({ itemHrid: i.itemHrid, count: i.count, price: i.price || 0, ...(i.catalyst ? { catalyst: true } : {}) })),
        outputs: (entry.outputs || []).filter((o) => o.count > 0).map((o) => ({ itemHrid: o.itemHrid, count: o.count, price: o.price || 0 })),
    };
}
