// Alchemy chains: what an alchemy action gives can be worth more processed
// further than sold – Pearl → … → Sunstone → Philosopher's Stone, or catalysts
// transmuted up to a Prime Catalyst. For a row, every item its outputs lead to
// is either sold, or coinified, decomposed or transmuted again (with the row's
// teas), whichever gives the most gold an hour over the whole chain.
//
// The choice is a ratio (gold over time), solved the Dinkelbach way: with a
// rate r, an item is processed further only when that gives more than selling
// it after paying r for every hour it takes; r is then set to the gold an hour
// of the chain those choices make, until the choices settle. An hour is never
// charged below 0 – a chain that loses gold doesn't get to spend time on
// Alchemy just to lose less an hour.

import { ALCHEMY_KINDS, alchemyHrid, evaluateAlchemy } from "./alchemy.js";

const COIN = "/items/coin";
// How far a chain looks, and how many items it may involve.
const MAX_DEPTH = 6;
const MAX_ITEMS = 150;
const SWEEPS = 60;
const ROUNDS = 8;

// One further step on an item: per action, the net units of the item it uses
// (its bulk less what comes back), the other outputs, the coins and catalyst it
// costs, the hours and the XP. evaluateAlchemy picks the catalyst (the most gold).
function stepsFor(itemHrid, who, data, market, teas, cache) {
    if (cache.has(itemHrid)) return cache.get(itemHrid);
    const steps = [];
    const detail = data.itemDetailMap[itemHrid];
    const a = detail?.alchemyDetail;
    if (a) {
        const kinds = [];
        if (a.isCoinifiable && detail.sellPrice > 0) kinds.push("coinify");
        if (a.decomposeItems?.length) kinds.push("decompose");
        if (a.transmuteDropTable?.length && a.transmuteSuccessRate > 0) kinds.push("transmute");
        for (const kind of kinds) {
            const action = { hrid: alchemyHrid(kind, itemHrid), kind, itemHrid, enhancementLevel: 0, levelRequirement: { level: detail.itemLevel || 1 } };
            const r = evaluateAlchemy(action, who, data, market, teas, { itemPrice: 0 });
            const net = r.inputs[0]?.count || 0;
            if (!r.successRate || !(net > 1e-9) || !(r.actionsPerHour > 0)) continue;
            const paid = r.inputs.slice(1).reduce((sum, i) => sum + i.value, 0);
            steps.push({
                kind,
                itemHrid,
                net,
                outputs: r.outputs.map((o) => ({ itemHrid: o.itemHrid, count: o.count })),
                paid,
                hours: 1 / r.actionsPerHour,
                xp: r.xpPerAction,
                catalyst: r.catalyst?.itemHrid || null,
                successRate: r.successRate,
            });
        }
    }
    cache.set(itemHrid, steps);
    return steps;
}

// The items a row's outputs can lead to, up to MAX_DEPTH steps on.
function reachable(entry, steps) {
    const seen = new Set();
    let frontier = entry.outputs.map((o) => o.itemHrid).filter((h) => h !== COIN);
    for (let depth = 0; depth < MAX_DEPTH && frontier.length && seen.size < MAX_ITEMS; depth++) {
        const next = [];
        for (const hrid of frontier) {
            if (seen.has(hrid) || seen.size >= MAX_ITEMS) continue;
            seen.add(hrid);
            for (const step of steps(hrid)) for (const o of step.outputs) if (o.itemHrid !== COIN && !seen.has(o.itemHrid)) next.push(o.itemHrid);
        }
        frontier = next;
    }
    return [...seen];
}

// With the hour charged at `charge`: each item's worth (sold or processed
// further) and the step chosen for it (null: sold).
function choose(items, sell, steps, charge, teaPerHour) {
    const worth = new Map(items.map((h) => [h, sell(h)]));
    const value = (h) => (h === COIN ? 1 : worth.has(h) ? worth.get(h) : sell(h));
    const choice = new Map();
    for (let sweep = 0; sweep < SWEEPS; sweep++) {
        let moved = 0;
        for (const h of items) {
            let best = sell(h);
            let pick = null;
            for (const step of steps(h)) {
                const v = (step.outputs.reduce((sum, o) => sum + o.count * value(o.itemHrid), 0) - step.paid - (teaPerHour + charge) * step.hours) / step.net;
                if (v > best + 1e-9) {
                    best = v;
                    pick = step;
                }
            }
            moved = Math.max(moved, Math.abs(best - worth.get(h)) / Math.max(1, Math.abs(best)));
            worth.set(h, best);
            choice.set(h, pick);
        }
        if (moved < 1e-9) break;
    }
    // A loop that pays for ever (prices out of line) isn't a plan.
    for (const v of worth.values()) if (!Number.isFinite(v) || v > 1e15) return null;
    return choice;
}

// With the steps chosen: per unit of each item, the gold it brings (no teas,
// no hours charged), the hours and the XP it takes further, and how many of
// each further action one unit leads to.
function follow(items, sell, choice) {
    const gold = new Map();
    const hours = new Map();
    const xp = new Map();
    const val = (map, h, sold) => (h === COIN ? (map === gold ? 1 : 0) : map.has(h) ? map.get(h) : sold(h));
    for (const h of items) {
        gold.set(h, sell(h));
        hours.set(h, 0);
        xp.set(h, 0);
    }
    const none = () => 0;
    for (let sweep = 0; sweep < SWEEPS; sweep++) {
        let moved = 0;
        for (const h of items) {
            const step = choice.get(h);
            if (!step) continue;
            const g = (step.outputs.reduce((sum, o) => sum + o.count * val(gold, o.itemHrid, sell), 0) - step.paid) / step.net;
            const t = (step.hours + step.outputs.reduce((sum, o) => sum + o.count * val(hours, o.itemHrid, none), 0)) / step.net;
            const x = (step.xp + step.outputs.reduce((sum, o) => sum + o.count * val(xp, o.itemHrid, none), 0)) / step.net;
            moved = Math.max(moved, Math.abs(g - gold.get(h)) / Math.max(1, Math.abs(g)), Math.abs(t - hours.get(h)) / Math.max(1e-9, t));
            gold.set(h, g);
            hours.set(h, t);
            xp.set(h, x);
        }
        if (moved < 1e-9) break;
    }
    return { gold: (h) => val(gold, h, sell), hours: (h) => val(hours, h, none), xp: (h) => val(xp, h, none) };
}

// How many of each further action, and of each item sold, one action of the row leads to.
function flows(entry, items, choice) {
    const amount = new Map();
    for (const o of entry.outputs) if (o.itemHrid !== COIN) amount.set(o.itemHrid, (amount.get(o.itemHrid) || 0) + o.count);
    const actions = new Map();
    const sold = new Map();
    // Push the amounts through the chosen steps (they shrink: items are lost or sold on the way).
    for (let sweep = 0; sweep < SWEEPS * 4; sweep++) {
        let pushed = false;
        for (const h of [...amount.keys()]) {
            const n = amount.get(h);
            if (n < 1e-12) continue;
            amount.set(h, 0);
            const step = choice.get(h);
            if (!step) {
                sold.set(h, (sold.get(h) || 0) + n);
                continue;
            }
            pushed = true;
            const times = n / step.net;
            actions.set(h, { step, count: (actions.get(h)?.count || 0) + times });
            for (const o of step.outputs) if (o.itemHrid !== COIN) amount.set(o.itemHrid, (amount.get(o.itemHrid) || 0) + o.count * times);
        }
        if (!pushed) break;
    }
    return { actions: [...actions.values()], sold: [...sold].map(([itemHrid, count]) => ({ itemHrid, count })) };
}

// The row as a chain, or null when processing nothing further pays. The
// result is the row with gold, XP and the actions an hour of the whole chain:
// actionsPerHour is the row's own actions per hour of the chain, so a job of N
// of them takes the chain's hours; revenuePerAction values each output at what
// the chain makes of it. single: the row as it was (one step, every output sold).
// caches: a Map shared between rows (the further steps, by tea setup).
export function alchemyChain(entry, who, data, market, caches = new Map()) {
    if (!entry?.valid || !(entry.actionsPerHour > 0)) return null;
    const teaKey = entry.teas.join(",");
    if (!caches.has(teaKey)) caches.set(teaKey, new Map());
    const cache = caches.get(teaKey);
    const steps = (h) => stepsFor(h, who, data, market, entry.teas, cache);
    const sellCache = new Map();
    const sell = (h) => {
        if (h === COIN) return 1;
        if (!sellCache.has(h)) sellCache.set(h, entry.outputs.find((o) => o.itemHrid === h)?.price ?? market.sell(h).price ?? 0);
        return sellCache.get(h);
    };
    const items = reachable(entry, steps);
    if (!items.some((h) => steps(h).length)) return null;
    const ownHours = 1 / entry.actionsPerHour;
    const ownCost = entry.costPerAction;
    let rate = Math.max(0, entry.profitPerHour);
    let result = null;
    let last = null;
    for (let round = 0; round < ROUNDS; round++) {
        const choice = choose(items, sell, steps, Math.max(0, rate), entry.teaPerHour);
        if (!choice) return null;
        const key = items.map((h) => choice.get(h)?.kind || "").join("|");
        if (key === last) break;
        last = key;
        const f = follow(items, sell, choice);
        const revenue = entry.outputs.reduce((sum, o) => sum + o.count * f.gold(o.itemHrid), 0);
        const hours = ownHours + entry.outputs.reduce((sum, o) => sum + o.count * f.hours(o.itemHrid), 0);
        const xp = entry.xpPerAction + entry.outputs.reduce((sum, o) => sum + o.count * f.xp(o.itemHrid), 0);
        const profitPerHour = (revenue - ownCost) / hours - entry.teaPerHour;
        result = { choice, revenue, hours, xp, profitPerHour, f };
        rate = profitPerHour;
    }
    if (!result || ![...result.choice.values()].some(Boolean) || !(result.profitPerHour > entry.profitPerHour + 1e-9)) return null;
    const { revenue, hours, xp, profitPerHour, choice, f } = result;
    const flow = flows(entry, items, choice);
    const actionsPerHour = 1 / hours;
    const further = flow.actions
        .map(({ step, count }) => ({ itemHrid: step.itemHrid, kind: step.kind, name: `${ALCHEMY_KINDS[step.kind].name} ${data.itemDetailMap[step.itemHrid]?.name || step.itemHrid}`, count, hours: count * step.hours, catalyst: step.catalyst, successRate: step.successRate }))
        .sort((a, b) => b.hours - a.hours);
    // Each output processed further: what the chain makes of one (its gold, before the teas and the hours).
    const outputs = entry.outputs.map((o) => (choice.get(o.itemHrid) ? { ...o, chainValue: f.gold(o.itemHrid), chainHours: f.hours(o.itemHrid) } : o));
    const goldPerDay = profitPerHour * 24;
    const xpPerHour = xp * actionsPerHour;
    return {
        ...entry,
        single: entry,
        outputs,
        actionsPerHour,
        ownActionsPerHour: entry.actionsPerHour,
        revenuePerAction: revenue,
        profitPerHour,
        goldPerDay,
        margin: revenue > 0 ? (revenue - ownCost - entry.teaPerHour * hours) / revenue : null,
        xpPerAction: xp,
        xpPerHour,
        xpPerDay: xpPerHour * 24,
        coinsPerXp: xpPerHour > 0 ? -profitPerHour / xpPerHour : null,
        alchemyChain: {
            share: ownHours / hours,
            further,
            sold: flow.sold.filter((s) => s.count > 1e-9).sort((a, b) => b.count * sell(b.itemHrid) - a.count * sell(a.itemHrid)),
            singleGoldPerDay: entry.goldPerDay,
        },
    };
}
