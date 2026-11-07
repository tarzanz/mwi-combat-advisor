// Planning to enhance an item you mean to use: from the +level it has now to
// each target, what it typically costs and how long it takes (the median of
// many simulated tries), what it costs with bad luck (9 tries in 10 cost less),
// the protection that costs the least on average (and from which +level), and
// the materials, protections and teas that takes against what you have.
// The odds are the Enhancing window's: your level, tool, Observatory and the
// teas in your Enhancing slots. Everything is priced at the ask, also what you
// already have.

import { MAX_TARGET, MIN_PROTECT, cheapestProtection, enhanceRates, materials, protectedCycle } from "./enhancing.js";

const TYPE = "/action_types/enhancing";
const COIN = "/items/coin";
export const TYPICAL = 0.5;
export const UNLUCKY = 0.9;
// Simulated tries: enough for steady quantiles, but no more than about STEP_BUDGET
// attempts per protection level; past MAX_MEAN attempts only the average is given.
const MIN_RUNS = 500;
const MAX_RUNS = 4000;
const STEP_BUDGET = 1e7;
const MAX_MEAN = 1e5;
const NO_XP = new Array(MAX_TARGET + 2).fill(0);

// A small seeded generator, so the same plan shows the same numbers.
export function seededRandom(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s = (s + 0x6d2b79f5) >>> 0;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

// Tries from +start: a success goes up one level (Blessed: sometimes two), a failure
// at +from or above drops one level and uses up a protection, below it back to +0.
// Until a try first gets to each of the targets (the same try whichever of them is the
// goal), the attempts and protections it took: { [target]: { attempts, protections } }.
export function simulateTries(p, blessed, start, targets, from, runs, random) {
    const top = Math.max(...targets);
    const out = Object.fromEntries(targets.map((t) => [t, { attempts: new Float64Array(runs), protections: new Float64Array(runs) }]));
    const cap = 50 * MAX_MEAN;
    for (let r = 0; r < runs; r++) {
        let level = start;
        let a = 0;
        let g = 0;
        let next = 0; // the first target not reached yet
        while (level < top && a < cap) {
            a++;
            if (random() < p[level]) level += blessed > 0 && random() < blessed ? 2 : 1;
            else if (level >= from) {
                g++;
                level--;
            } else level = 0;
            while (next < targets.length && level >= targets[next]) {
                out[targets[next]].attempts[r] = a;
                out[targets[next]].protections[r] = g;
                next++;
            }
        }
        for (; next < targets.length; next++) {
            out[targets[next]].attempts[r] = a;
            out[targets[next]].protections[r] = g;
        }
    }
    return out;
}

// The q-quantile (nearest rank) of a list.
export function quantile(values, q) {
    const sorted = Float64Array.from(values).sort();
    if (!sorted.length) return null;
    return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(q * sorted.length) - 1))];
}

// The plan for an item at +start: per target the protection, the average and the spread.
// Takes a while for items that are hard to enhance (simulated tries). Returns null when
// the item can't be enhanced or a material isn't for sale.
export function enhancePlan({ itemHrid, start = 0, who, data, market, seed = 1 }) {
    const detail = data.itemDetailMap[itemHrid];
    const inputs = detail?.enhancementCosts?.length ? materials(detail, market) : null;
    if (!inputs || start >= MAX_TARGET) return null;
    const teas = who.drinks?.[TYPE] || [];
    const { rates, blessed, cycleSeconds, effectiveLevel, multiplier } = enhanceRates(who, data, teas, detail.itemLevel || 1);
    const drinksPerAttempt = (12 * (who.concentration || 1) * cycleSeconds) / 3600;
    const teaList = teas.map((hrid) => ({ itemHrid: hrid, count: drinksPerAttempt, price: market.buy(hrid) ?? 0, tea: true }));
    // Per attempt: the materials (coins among them) and the teas drunk meanwhile.
    const perAttempt = [...inputs.map((i) => ({ itemHrid: i.itemHrid, count: i.count, price: i.price })), ...teaList];
    const attemptCost = perAttempt.reduce((sum, i) => sum + i.count * i.price, 0);
    const guard = cheapestProtection(detail, market);

    // Per target the protection level (or none) that costs the least on average.
    const meanCost = (cycle, guarded) => cycle.attempts * attemptCost + (guarded ? cycle.protections * guard.price : 0);
    const picks = [];
    for (let target = start + 1; target <= MAX_TARGET; target++) {
        const bare = protectedCycle(rates, blessed, target, target, NO_XP, start);
        let best = bare && Number.isFinite(bare.attempts) ? { from: target, cycle: bare, cost: meanCost(bare, false) } : null;
        for (let from = MIN_PROTECT; guard && from < target; from++) {
            const cycle = protectedCycle(rates, blessed, target, from, NO_XP, start);
            if (!cycle || !Number.isFinite(cycle.attempts)) continue;
            const cost = meanCost(cycle, true);
            if (!best || cost < best.cost) best = { from, cycle, cost };
        }
        if (!best) break;
        picks.push({ target, bare, ...best, guarded: best.from < target });
    }

    // The spread: simulated tries, once per protection level for all its targets –
    // those that don't take too many attempts to simulate.
    const spread = new Map();
    const groups = new Map();
    for (const pick of picks) {
        if (pick.cycle.attempts > MAX_MEAN) continue;
        const key = pick.guarded ? pick.from : "none";
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(pick);
    }
    for (const [key, list] of groups) {
        const from = key === "none" ? MAX_TARGET + 1 : key;
        const most = Math.max(...list.map((pick) => pick.cycle.attempts));
        const runs = Math.round(Math.min(MAX_RUNS, Math.max(MIN_RUNS, STEP_BUDGET / Math.max(1, most))));
        const tries = simulateTries(rates, blessed, start, list.map((pick) => pick.target), from, runs, seededRandom(seed * 7919 + (key === "none" ? 0 : key)));
        for (const pick of list) {
            const { attempts, protections } = tries[pick.target];
            const costs = attempts.map((a, i) => a * attemptCost + (pick.guarded ? protections[i] * guard.price : 0));
            const at = (q) => {
                const n = quantile(attempts, q);
                return { attempts: n, protections: pick.guarded ? quantile(protections, q) : 0, cost: quantile(costs, q), hours: (n * cycleSeconds) / 3600 };
            };
            spread.set(pick.target, { typical: at(TYPICAL), unlucky: at(UNLUCKY), runs });
        }
    }

    const targets = picks.map(({ target, bare, from, cycle, cost, guarded }) => {
        const s = spread.get(target);
        return {
            target,
            protect: guarded ? { ...guard, from } : null,
            mean: { attempts: cycle.attempts, protections: guarded ? cycle.protections : 0, cost, hours: (cycle.attempts * cycleSeconds) / 3600 },
            typical: s?.typical || null,
            unlucky: s?.unlucky || null,
            runs: s?.runs || 0,
            without: guarded && bare && Number.isFinite(bare.attempts) ? { cost: meanCost(bare, false), attempts: bare.attempts } : null,
        };
    });
    return { itemHrid, start, teas, rates, blessed, multiplier, effectiveLevel, cycleSeconds, attemptCost, perAttempt, guard, targets };
}

// The plan against what you have: per outcome the materials, protections and teas it
// takes, how many you have and are short of, and the coins that takes (the coin cost and
// buying what's short); and the highest target your coins carry typically and with bad
// luck. have(hrid): how many you have at +0 in the inventory (coins included).
export function withStock(plan, have) {
    // A copy of the item as protection: not the one being enhanced.
    const owned = (hrid) => Math.max(0, (have(hrid) || 0) - (hrid === plan.itemHrid && plan.start === 0 ? 1 : 0));
    const coins = have(COIN) || 0;
    const needs = (t, outcome) => {
        if (!outcome) return null;
        const list = plan.perAttempt.map((i) => ({ itemHrid: i.itemHrid, price: i.price, tea: !!i.tea, count: Math.ceil(i.count * outcome.attempts) }));
        if (t.protect) list.push({ itemHrid: t.protect.itemHrid, price: t.protect.price, protection: true, count: Math.ceil(outcome.protections) });
        for (const n of list) {
            n.have = n.itemHrid === COIN ? coins : owned(n.itemHrid);
            n.short = Math.max(0, n.count - n.have);
        }
        const coinsNeeded = list.reduce((sum, n) => sum + (n.itemHrid === COIN ? n.count : n.short * n.price), 0);
        return { ...outcome, list, coinsNeeded, affordable: coinsNeeded <= coins };
    };
    const targets = plan.targets.map((t) => ({ ...t, mean: needs(t, t.mean), typical: needs(t, t.typical), unlucky: needs(t, t.unlucky) }));
    const reach = (pick) => targets.reduce((top, t) => (pick(t)?.affordable ? t.target : top), null);
    return { ...plan, coins, targets, reach: { typical: reach((t) => t.typical || t.mean), unlucky: reach((t) => t.unlucky) } };
}
