// Follows skilling jobs as they run and works out afterwards what each one
// really gave: what it used (at what you paid, where your buy orders show it),
// what it made (at the market when it ended, the tax off), the time it took,
// and where that differs from the advice when it began.
// Pure: the game messages, prices and storage come from job-log.js.

export const MAX_DONE = 30;
const LOT_MS = 30 * 24 * 3600 * 1000;
const MAX_LOTS = 300;
// A buy order filling this soon after it is first seen took listings at once,
// cheapest first, not at its own price.
const INSTANT_MS = 2 * 60 * 1000;
// Missed actions are scaled from the live ones only with at least this many.
const MIN_LIVE_TO_SCALE = 5;
const COIN = "/items/coin";

export const keyOf = (hrid, level = 0) => `${hrid}::${Number(level) || 0}`;
export function splitKey(key) {
    const i = key.lastIndexOf("::");
    return { itemHrid: key.slice(0, i), level: Number(key.slice(i + 2)) || 0 };
}

export function emptyLedger(now = Date.now()) {
    return { since: now, active: null, done: [], lots: [], fills: {} };
}

// The action running now: the queue's first, unless it is a fight.
export function runningAction(actions) {
    const a = (actions || []).find((x) => !x.isDone);
    return a && !String(a.actionHrid || "").startsWith("/actions/combat/") ? a : null;
}

const itemOfHash = (hash) => String(hash || "").split("::")[2] || null;
const countOf = (action) => Number(action?.currentCount) || 0;

// inv: the inventory as { key: count } when the job is first seen.
export function startJob(action, { now, inv, forecast = null }) {
    return {
        id: action.id,
        actionHrid: action.actionHrid,
        item: itemOfHash(action.primaryItemHash),
        target: Number(action.enhancingMaxLevel) || null,
        startedAt: now,
        firstAt: null,
        lastAt: null,
        endAt: null,
        startCount: countOf(action),
        lastCount: countOf(action),
        maxCount: action.hasMaxCount ? Number(action.maxCount) || null : null,
        live: 0, // actions seen as they happened
        gap: 0, // actions read from the inventory when the game came back
        missed: 0, // actions nobody saw: estimated
        deltas: {}, // key -> change, from live actions
        gapDeltas: {}, // key -> change, from the inventory after a gap
        inv: { ...inv },
        forecast,
    };
}

const add = (into, key, delta) => {
    into[key] = (into[key] || 0) + delta;
    if (Math.abs(into[key]) < 1e-9) delete into[key];
};

// One action_completed: changes: [{ key, delta }] of the inventory (teas left
// out); count: the action's currentCount after it, if the game sent it.
export function noteAction(job, changes, { now, count = null }) {
    for (const { key, delta } of changes) {
        add(job.deltas, key, delta);
        job.inv[key] = (job.inv[key] || 0) + delta;
    }
    const done = count !== null && count >= job.lastCount ? count - job.lastCount : 1;
    job.live += Math.max(1, done);
    if (count !== null) job.lastCount = Math.max(job.lastCount, count);
    job.firstAt ??= now;
    job.lastAt = now;
}

// Inventory changes that aren't the job (market claims, other windows): kept
// in the job's picture of the inventory so a later gap is read right.
export function noteOther(job, changes) {
    for (const { key, delta } of changes) job.inv[key] = (job.inv[key] || 0) + delta;
}

// The game came back after the page slept (init_character_data). inv: the
// inventory now; queue: the actions now. Clean when nothing but this job can
// have changed the inventory meanwhile: it still runs first, or it ended and
// the next one hasn't done anything yet. Returns "running" or "ended".
export function noteReturn(job, { inv, queue, now, isPrimary }) {
    const mine = (queue || []).find((a) => a.id === job.id && !a.isDone);
    const first = runningAction(queue);
    const clean = mine ? first?.id === job.id : !first || countOf(first) === 0;
    let actions = mine ? Math.max(0, countOf(mine) - job.lastCount) : job.maxCount !== null ? Math.max(0, job.maxCount - job.lastCount) : null;
    if (clean) {
        const diff = {};
        for (const key of new Set([...Object.keys(job.inv), ...Object.keys(inv)])) {
            const d = (inv[key] || 0) - (job.inv[key] || 0);
            if (Math.abs(d) > 1e-9) diff[key] = d;
        }
        // An ended job without a set count: how many, from what it used of its main material.
        if (actions === null) actions = isPrimary ? isPrimary(diff) : 0;
        if (actions > 0) {
            for (const [key, d] of Object.entries(diff)) add(job.gapDeltas, key, d);
            job.gap += actions;
        }
    } else if (actions > 0) job.missed += actions;
    job.inv = { ...inv };
    if (mine) {
        job.lastCount = countOf(mine);
        if (actions > 0) job.lastAt = now;
        return "running";
    }
    return "ended";
}

// The job left the queue. seen: while the page watched (it ended at its last action).
export function endJob(job, { now, seen }) {
    job.endAt = seen ? job.lastAt ?? now : null;
    job.endedAt = now;
    return job;
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
            ledger.lots.push({ key: keyOf(listing.itemHrid, level), qty, left: qty, unit, at: now, estimate });
        }
        ledger.fills[id] = { filled: Math.max(filled, prev), seen: firstSeen, at: now };
    }
    pruneLots(ledger, now);
}

function pruneLots(ledger, now) {
    ledger.lots = ledger.lots.filter((l) => l.left > 1e-9 && now - l.at < LOT_MS).slice(-MAX_LOTS);
    for (const [id, f] of Object.entries(ledger.fills)) if (now - f.at > LOT_MS) delete ledger.fills[id];
}

// Takes qty of key from your lots, oldest first: { qty, cost, estimate } of what they covered.
function takeLots(ledger, key, qty) {
    let left = qty;
    let cost = 0;
    let estimate = false;
    for (const lot of ledger.lots) {
        if (lot.key !== key || lot.left <= 0) continue;
        const take = Math.min(left, lot.left);
        lot.left -= take;
        left -= take;
        cost += take * lot.unit;
        estimate ||= lot.estimate;
        if (left <= 1e-9) break;
    }
    return { qty: qty - Math.max(0, left), cost, estimate };
}

// The ended job's result. prices: { value(hrid, level) -> a unit made is worth
// (the tax off), cost(hrid, level) -> a unit used costs when you didn't buy it
// (the market when the job began) }. Takes what it used from your lots.
export function jobReport(ledger, job, prices, now = Date.now()) {
    const f = job.forecast;
    const deltas = { ...job.deltas };
    for (const [key, d] of Object.entries(job.gapDeltas)) add(deltas, key, d);
    // Actions nobody saw: like the live ones (enough of them), else as the advice expected.
    let missedFrom = null;
    if (job.missed > 0) {
        if (job.live >= MIN_LIVE_TO_SCALE) {
            for (const [key, d] of Object.entries(job.deltas)) add(deltas, key, (d * job.missed) / job.live);
            missedFrom = "live";
        } else if (f) {
            for (const o of f.outputs) add(deltas, keyOf(o.itemHrid), o.count * job.missed);
            for (const i of f.inputs) add(deltas, keyOf(i.itemHrid), -i.count * job.missed);
            missedFrom = "advice";
        }
    }
    const actions = job.live + job.gap + job.missed;
    const made = [];
    const used = [];
    for (const [key, d] of Object.entries(deltas)) {
        const { itemHrid, level } = splitKey(key);
        if (d > 0) {
            const unit = itemHrid === COIN ? 1 : prices.value(itemHrid, level) ?? 0;
            made.push({ itemHrid, level, qty: d, unit, total: d * unit });
        } else {
            const qty = -d;
            const fromLots = itemHrid === COIN ? { qty: 0, cost: 0, estimate: false } : takeLots(ledger, key, qty);
            const rest = qty - fromLots.qty;
            const restUnit = itemHrid === COIN ? 1 : prices.cost(itemHrid, level) ?? 0;
            const total = fromLots.cost + rest * restUnit;
            used.push({ itemHrid, level, qty, unit: total / qty, total, bought: fromLots.qty, boughtEstimate: fromLots.estimate });
        }
    }
    made.sort((a, b) => b.total - a.total);
    used.sort((a, b) => b.total - a.total);
    // The time: from the first action to the last as seen, else the actions at the speed seen (or advised).
    const span = job.firstAt !== null && job.endAt !== null ? (job.endAt - job.firstAt) / 3600000 : null;
    const liveRate = job.live >= 3 && job.lastAt > job.firstAt ? (job.live - 1) / ((job.lastAt - job.firstAt) / 3600000) : null;
    const rate = liveRate ?? f?.actionsPerHour ?? null;
    let hours;
    let timeFrom;
    if (span !== null && job.missed === 0 && job.gap === 0 && rate) {
        hours = span + 1 / rate; // the first action took a cycle too
        timeFrom = "seen";
    } else if (rate) {
        hours = actions / rate;
        timeFrom = liveRate ? "speed" : "advice";
    } else {
        hours = Math.max(0, ((job.endAt ?? job.endedAt ?? now) - job.startedAt) / 3600000);
        timeFrom = "clock";
    }
    const teas = f ? f.teaPerHour * hours : 0;
    const revenue = made.reduce((s, m) => s + m.total, 0);
    const cost = used.reduce((s, u) => s + u.total, 0) + teas;
    const profit = revenue - cost;
    const report = {
        id: job.id,
        name: job.name,
        actionHrid: job.actionHrid,
        item: job.item,
        endedAt: job.endedAt ?? now,
        actions,
        live: job.live,
        gap: job.gap,
        missed: job.missed,
        missedFrom,
        hours,
        timeFrom,
        made,
        used,
        teas,
        revenue,
        cost,
        profit,
        margin: revenue > 0 ? profit / revenue : null,
        perHour: hours > 0 ? profit / hours : null,
        actionsPerHour: hours > 0 ? actions / hours : null,
        forecast: f ? compare(f, made, used, teas, hours, actions) : null,
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
