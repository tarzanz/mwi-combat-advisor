// What a finished skilling job really gave: what it used (at what you paid,
// where your buy orders show it), what it made (at the market, the tax off),
// the time it took, and where that differs from the advice when it began.
// The game's Loot & XP Log says how many actions, how long and what dropped;
// job-log.js adds what they used. Pure: the messages, prices and storage come
// from job-log.js.

export const MAX_REPORTS = 60;
// Kept results in short (with what they used): the history, and what used up your purchases.
export const MAX_HISTORY = 1000;
const LOT_MS = 30 * 24 * 3600 * 1000;
// A buy order filling this soon after it is first seen took listings at once,
// cheapest first, not at its own price.
const INSTANT_MS = 2 * 60 * 1000;
const COIN = "/items/coin";

export const keyOf = (hrid, level = 0) => `${hrid}::${Number(level) || 0}`;
export function splitKey(key) {
    const i = key.lastIndexOf("::");
    return { itemHrid: key.slice(0, i), level: Number(key.slice(i + 2)) || 0 };
}

// purchases: per buy order what it filled and cost; fills: your buy orders as
// last seen here; forecasts: the advice per game action id when it began;
// reports: per log entry (the latest MAX_REPORTS); history: every result in
// short; unsent: what the Pi doesn't have yet; piSeq: how far the Pi was read.
export function emptyLedger(now = Date.now()) {
    return { since: now, purchases: {}, fills: {}, forecasts: {}, reports: {}, history: {}, unsent: { reports: [], purchases: [] }, piSeq: 0 };
}

// The action running now: the queue's first, unless it is a fight.
export function runningAction(actions) {
    const a = (actions || []).find((x) => !x.isDone);
    return a && !String(a.actionHrid || "").startsWith("/actions/combat/") ? a : null;
}

const mark = (list, id) => {
    if (!list.includes(id)) list.push(id);
};

// Your buy orders as the game lists them: what each filled since last seen is
// added to its purchase (what you paid). A fill right after an order appears
// (live: it came while the page watched) took listings at once: priced up the
// order book seen for it (bookOf(hrid, level) -> asks), else at the order's
// price. Returns whether a purchase changed.
export function noteFills(ledger, listings, { now, live, bookOf = () => null }) {
    let changed = false;
    for (const listing of listings || []) {
        if (!listing || listing.isSell) continue;
        const id = String(listing.id);
        const filled = Number(listing.filledQuantity) || 0;
        const seen = ledger.fills[id];
        const bought = ledger.purchases[id];
        // What this device or another (through the Pi) already counted.
        const prev = Math.max(seen?.filled ?? 0, bought?.filled ?? 0);
        // First seen: new if the ledger was already watching (a new order), else an old one.
        const firstSeen = seen?.seen ?? (live && now - ledger.since > INSTANT_MS ? now : 0);
        if (filled > prev) {
            const price = Number(listing.price) || 0;
            const level = Number(listing.enhancementLevel) || 0;
            const qty = filled - prev;
            let cost = qty * price;
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
                    cost = sum + left * price;
                    estimate = true;
                }
            }
            // timed: its first fill was seen as it came (live), so it can't be what an earlier job used.
            ledger.purchases[id] = { key: keyOf(listing.itemHrid, level), filled, cost: (bought?.cost ?? 0) + cost, at: bought?.at ?? now, timed: bought ? !!bought.timed : !!live, estimate: !!bought?.estimate || estimate };
            mark(ledger.unsent.purchases, id);
            changed = true;
        }
        ledger.fills[id] = { filled: Math.max(filled, prev), seen: firstSeen, at: now };
    }
    prune(ledger, now);
    return changed;
}

function prune(ledger, now) {
    for (const [id, f] of Object.entries(ledger.fills)) if (now - f.at > LOT_MS) delete ledger.fills[id];
    for (const [id, b] of Object.entries(ledger.purchases)) if (now - b.at > LOT_MS) delete ledger.purchases[id];
}

// Your purchases as lots, oldest first, less what the kept results used of
// them (each from what was bought by its end – as far as known: a purchase
// first seen when the game loaded may have filled any time before –, oldest
// first) – the same on every device that has the same results. except: a result left out (worked out again).
export function lotsLeft(ledger, except = null) {
    const lots = Object.values(ledger.purchases)
        .filter((b) => b.filled > 0)
        .map((b) => ({ key: b.key, qty: b.filled, left: b.filled, unit: b.cost / b.filled, at: b.at, timed: !!b.timed, estimate: !!b.estimate }))
        .sort((a, b) => a.at - b.at);
    const results = Object.entries(ledger.history).filter(([key]) => key !== except).map(([, h]) => h).sort((a, b) => a.endedAt - b.endedAt);
    for (const h of results) for (const [key, qty] of h.used || []) takeLots(lots, key, qty, h.endedAt);
    return lots;
}

// Takes qty of key from lots bought by `by`, oldest first: { qty, cost, estimate } of what they covered.
function takeLots(lots, key, qty, by = Infinity) {
    let left = qty;
    let cost = 0;
    let estimate = false;
    for (const lot of lots) {
        if (lot.key !== key || lot.left <= 1e-9 || (lot.timed && lot.at > by)) continue;
        const take = Math.min(left, lot.left);
        lot.left -= take;
        left -= take;
        cost += take * lot.unit;
        estimate ||= lot.estimate;
        if (left <= 1e-9) break;
    }
    return { qty: qty - Math.max(0, left), cost, estimate };
}

// The same sort of job: the action, and for Alchemy the item.
export const jobGroup = (actionHrid, item) => (String(actionHrid).startsWith("/actions/alchemy/") ? `${actionHrid}#${item}` : actionHrid);

// A result in short, for the history and for what it used of your purchases.
export function summarize(r) {
    return {
        group: jobGroup(r.actionHrid, r.item),
        name: r.name,
        endedAt: r.endedAt,
        hours: r.hours,
        actions: r.actions,
        revenue: r.revenue,
        profit: r.profit,
        expectedMargin: r.forecast?.margin ?? null,
        used: r.used.filter((u) => u.itemHrid !== COIN).map((u) => [keyOf(u.itemHrid, u.level), u.qty]),
    };
}

// Keeps a result: in full (the latest MAX_REPORTS) and in short; sent: it came from the Pi.
export function keepReport(ledger, key, report, { sent = false } = {}) {
    ledger.reports[key] = report;
    ledger.history[key] = summarize(report);
    if (!sent) mark(ledger.unsent.reports, key);
    const full = Object.keys(ledger.reports).sort((a, b) => ledger.reports[a].endedAt - ledger.reports[b].endedAt);
    for (const k of full.slice(0, Math.max(0, full.length - MAX_REPORTS))) delete ledger.reports[k];
    const all = Object.keys(ledger.history).sort((a, b) => ledger.history[a].endedAt - ledger.history[b].endedAt);
    for (const k of all.slice(0, Math.max(0, all.length - MAX_HISTORY))) delete ledger.history[k];
}

// Which of two results for one log entry wins: the one that saw more of the job.
export const newerReport = (incoming, kept) => !kept || incoming.actions > kept.actions || incoming.endedAt > kept.endedAt;

// What the Pi sent ({ seq, reports: [{ key, report }], purchases: [{ uid, purchase }] }) into the ledger.
export function mergeFromPi(ledger, wire) {
    let changed = false;
    for (const { key, report } of wire.reports || []) {
        if (!key || !report || !Number.isFinite(report.endedAt)) continue;
        if (newerReport(report, ledger.history[key])) {
            keepReport(ledger, key, report, { sent: true });
            changed = true;
        }
    }
    for (const { uid, purchase } of wire.purchases || []) {
        if (!uid || !purchase || !(purchase.filled > 0)) continue;
        const mine = ledger.purchases[uid];
        if (!mine || purchase.filled > mine.filled) {
            ledger.purchases[uid] = { key: purchase.key, filled: purchase.filled, cost: purchase.cost, at: purchase.at, timed: !!purchase.timed, estimate: !!purchase.estimate };
            changed = true;
        }
    }
    if (Number.isFinite(wire.seq)) ledger.piSeq = Math.max(ledger.piSeq || 0, wire.seq);
    return changed;
}

// What the Pi doesn't have yet: { reports: [{ key, report }], purchases: [{ uid, purchase }] }.
export function unsentForPi(ledger) {
    return {
        reports: ledger.unsent.reports.filter((k) => ledger.reports[k]).map((key) => ({ key, report: ledger.reports[key] })),
        purchases: ledger.unsent.purchases.filter((id) => ledger.purchases[id]).map((uid) => ({ uid, purchase: ledger.purchases[uid] })),
    };
}

export function markSent(ledger, { reports = [], purchases = [] }) {
    ledger.unsent.reports = ledger.unsent.reports.filter((k) => !reports.includes(k) && ledger.reports[k]);
    ledger.unsent.purchases = ledger.unsent.purchases.filter((id) => !purchases.includes(id) && ledger.purchases[id]);
}

// How the earlier jobs of a group went: { jobs, days, profit, perHour, margin, expectedMargin } or null.
export function groupHistory(ledger, group, except = null) {
    const list = Object.entries(ledger.history).filter(([key, h]) => key !== except && h.group === group).map(([, h]) => h);
    if (!list.length) return null;
    const sum = (f) => list.reduce((s, h) => s + (f(h) || 0), 0);
    const revenue = sum((h) => h.revenue);
    const hours = sum((h) => h.hours);
    const profit = sum((h) => h.profit);
    const expected = list.filter((h) => Number.isFinite(h.expectedMargin));
    return {
        jobs: list.length,
        days: (Math.max(...list.map((h) => h.endedAt)) - Math.min(...list.map((h) => h.endedAt))) / 86400000,
        profit,
        perHour: hours > 0 ? profit / hours : null,
        margin: revenue > 0 ? profit / revenue : null,
        expectedMargin: expected.length ? expected.reduce((s, h) => s + h.expectedMargin, 0) / expected.length : null,
    };
}

// A finished job's result. job: { id, name, actionHrid, item, endedAt,
// actions, hours, deltas: { key: made (+) or used (−) }, forecast }. prices:
// { value(hrid, level) -> a unit made is worth (the tax off), cost(hrid, level)
// -> a unit used costs when you didn't buy it }.
// job.key: its log entry (a kept result for it is left out of what used your purchases).
// Uses up nothing itself: keepReport does, by keeping it.
export function jobReport(ledger, job, prices, now = Date.now()) {
    const f = job.forecast;
    const actions = job.actions;
    const hours = job.hours;
    const made = [];
    const used = [];
    const lots = lotsLeft(ledger, job.key);
    for (const [key, d] of Object.entries(job.deltas)) {
        if (Math.abs(d) < 1e-9) continue;
        const { itemHrid, level } = splitKey(key);
        if (d > 0) {
            const unit = itemHrid === COIN ? 1 : prices.value(itemHrid, level) ?? 0;
            made.push({ itemHrid, level, qty: d, unit, total: d * unit });
        } else {
            const qty = -d;
            const fromLots = itemHrid === COIN ? { qty: 0, cost: 0, estimate: false } : takeLots(lots, key, qty, job.endedAt);
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
        key: job.key,
        name: job.name,
        actionHrid: job.actionHrid,
        item: job.item,
        endedAt: job.endedAt,
        pricedAt: now,
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
        // now: worked out when the result was (the job began unseen); settled: from its first action (else as it was queued).
        forecast: f ? { ...compare(f, made, used, teas, hours, actions), now: !!job.forecastNow, settled: job.forecastSettled ?? null, catalyst: f.catalyst ?? null, teas: f.teas ?? null } : null,
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
