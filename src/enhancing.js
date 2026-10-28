// Levelling Enhancing: enhance an item towards a target +level, again and
// again. A failure (without protection) drops the item back to +0 but keeps
// it, so the item is bought once per success at the target, while every
// attempt costs the item's enhancing materials. Reaching the target, the +N
// item is sold and a new one bought. The game rules are the ones on the wiki
// and in MWITools/Toolasha:
// - success = base rate of the +level × (1 + level bonus + success buffs);
//   level bonus 0.05% per level above the item, −50% × (1 − level / item level) below;
// - 12 s / (1 + speed), speed +1% per level above the item;
// - XP on success 1.4 × (1 + current +level) × (10 + item level) × (1 + wisdom),
//   a tenth of that on a failure;
// - Blessed Tea: a success sometimes adds two levels;
// - every attempt may drop Enhancing Essence ((100 + item level) / 1000) and an
//   Artisan's Crate ((100 + item level) / 120000 for a small one) – checked
//   against the game's Enhancing window (Cheese Helmet: 10.1% and ~0.087%).

import { MARKET_TAX, teaBuffs, totals } from "./skilling.js";

export const ENHANCING = "enhancing";
const TYPE = "/action_types/enhancing";
const SKILL = "/skills/enhancing";
export const ENHANCE_FUNCTION = "/action_functions/enhancing";
const BASE_SECONDS = 12;
export const MAX_TARGET = 20;
// Success rate of an attempt from +L (index L) to +L+1.
export const BASE_RATES = [0.5, 0.45, 0.45, 0.4, 0.4, 0.4, 0.35, 0.35, 0.35, 0.35, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
const FAIL_XP = 0.1;
const OBSERVATORY = "/house_rooms/observatory";
const OBSERVATORY_SUCCESS = 0.0005;
const SUCCESS = "/buff_types/enhancing_success";
const ESSENCE = "/items/enhancing_essence";

// The Artisan's Crate an attempt may drop, by the item's level. The small
// crate's rate is the game's; the larger ones are assumed to follow Alchemy's
// pattern (the same ratio between the sizes).
export function enhanceCrate(itemLevel) {
    if (itemLevel < 35) return { itemHrid: "/items/small_artisans_crate", rate: (100 + itemLevel) / 120000 };
    if (itemLevel < 70) return { itemHrid: "/items/medium_artisans_crate", rate: (65 + itemLevel) / 180000 };
    return { itemHrid: "/items/large_artisans_crate", rate: (30 + itemLevel) / 240000 };
}

// The success bonus from levels: a little above the item's level, a lot less below it.
export function levelBonus(level, itemLevel) {
    if (level >= itemLevel) return OBSERVATORY_SUCCESS * (level - itemLevel);
    return -0.5 * (1 - level / itemLevel);
}

// From +0 until the item first reaches the target (one "cycle"), with success
// rates p[L] and a Blessed chance b: a run starts at +0 and ends at a failure
// (back to +0) or the target. reach[L] is the chance that one run gets to +L,
// so a cycle takes 1/reach(T) runs and visits +L reach[L]/reach(T) times.
// For every target at once: { attempts[T], xp[T] } per cycle (xp from xpAt[L]).
export function enhanceCycles(p, blessed, xpAt) {
    const reach = [1];
    for (let L = 1; L <= MAX_TARGET; L++) reach[L] = reach[L - 1] * p[L - 1] * (1 - blessed) + (L >= 2 ? reach[L - 2] * p[L - 2] * blessed : 0);
    const attempts = [0];
    const xp = [0];
    let visits = 0;
    let gained = 0;
    for (let T = 1; T <= MAX_TARGET; T++) {
        const L = T - 1;
        visits += reach[L];
        gained += reach[L] * (p[L] + FAIL_XP * (1 - p[L])) * xpAt[L];
        // Reaching T or jumping past it (a blessed success from T−1) ends the cycle.
        const done = reach[L] * p[L] + (L >= 1 ? reach[L - 1] * p[L - 1] * blessed : 0);
        attempts[T] = done > 0 ? visits / done : Infinity;
        xp[T] = done > 0 ? gained / done : Infinity;
    }
    return { attempts, xp, reach };
}

// The item's enhancing materials per attempt; null when one of them isn't for sale.
function materials(detail, market) {
    const inputs = [];
    for (const cost of detail.enhancementCosts || []) {
        const price = market.buy(cost.itemHrid);
        if (price === null) return null;
        inputs.push({ itemHrid: cost.itemHrid, count: cost.count, price, value: cost.count * price });
    }
    return inputs.length ? inputs : null;
}

// Every item you could level Enhancing on: equipment with enhancing materials
// that are all for sale, and the item either for sale or in your inventory.
// owned(hrid): how many +0 copies are in the inventory.
export function enhancingActions(data, market, owned = () => 0) {
    const list = [];
    for (const detail of Object.values(data.itemDetailMap)) {
        if (!detail.equipmentDetail || !detail.enhancementCosts?.length || !detail.isTradable) continue;
        if (market.buy(detail.hrid) === null && !(owned(detail.hrid) > 0)) continue;
        if (!materials(detail, market)) continue;
        list.push({
            hrid: `/actions/enhancing/enhance#${detail.hrid}`,
            name: detail.name,
            itemHrid: detail.hrid,
            type: TYPE,
            function: ENHANCE_FUNCTION,
            levelRequirement: { skillHrid: SKILL, level: detail.itemLevel || 1 },
            baseTimeCost: BASE_SECONDS * 1e9,
            sortIndex: detail.sortIndex || 0,
        });
    }
    return list.sort((a, b) => a.levelRequirement.level - b.levelRequirement.level || a.sortIndex - b.sortIndex);
}

// Success buffs the game doesn't send for enhancing: the tool's (and other
// gear's) Enhancing Success and the Observatory, unless the game's buff lists
// already hold them.
function missingSuccess(who, data) {
    const sent = (key) => (who.sources?.[key]?.[TYPE] || []).some((b) => b.typeHrid === SUCCESS);
    let bonus = 0;
    if (!sent("equipmentActionTypeBuffsMap")) {
        const multipliers = data.enhancementLevelTotalBonusMultiplierTable || [];
        for (const item of who.equipped || []) {
            const detail = data.itemDetailMap[item.itemHrid]?.equipmentDetail;
            const base = detail?.noncombatStats?.enhancingSuccess || 0;
            const extra = detail?.noncombatEnhancementBonuses?.enhancingSuccess || 0;
            bonus += base + extra * (multipliers[item.enhancementLevel || 0] || 0);
        }
    }
    if (!sent("houseActionTypeBuffsMap")) bonus += OBSERVATORY_SUCCESS * (who.houseLevels?.[OBSERVATORY] || 0);
    return bonus;
}

// What the item is worth to you before enhancing: bought at the ask, or – one
// you already have – what it would sell for at the bid.
function baseItem(action, market, owned) {
    const have = owned(action.itemHrid) > 0;
    if (have) {
        const bid = market.sell(action.itemHrid).bid;
        return { price: bid ? bid * (1 - MARKET_TAX) : 0, owned: true };
    }
    const price = market.buy(action.itemHrid);
    return price === null ? null : { price, owned: false };
}

// Enhancing one item with one tea setup, for every target +1…+20; the target
// that scores best is returned (gold a day by default), with the others in
// `targets` for the detail. resale(hrid, level): { price (after tax), source,
// level, floor, sold (a day, or null) }. The market takes only so many a day –
// sold, else sellCap (Max sold/day) – the rest goes for the floor price.
// target: a fixed target (the one set in the game) instead of the best one.
export function evaluateEnhance(action, who, data, market, teas, { resale, owned = () => 0, score = (r) => r.goldPerDay, sellCap = 0, target: fixedTarget = null } = {}) {
    const buff = totals([...(who.buffs?.[TYPE] || []), ...teaBuffs(teas, who.concentration, data)]);
    const fraction = (type) => buff(type).flat + buff(type).ratio;
    const level = who.levels[SKILL] ?? 1;
    const levelBuff = buff("/buff_types/enhancing_level");
    const effectiveLevel = (1 + levelBuff.ratio) * level + levelBuff.flat;
    const itemLevel = action.levelRequirement.level;
    const detail = data.itemDetailMap[action.itemHrid];

    const success = fraction(SUCCESS) + missingSuccess(who, data);
    const bonus = levelBonus(effectiveLevel, itemLevel);
    const multiplier = Math.max(0, 1 + bonus + success);
    const rates = BASE_RATES.map((r) => Math.min(1, r * multiplier));
    const blessed = Math.max(0, fraction("/buff_types/blessed"));
    const levelSpeed = Math.max(0, effectiveLevel - itemLevel) / 100;
    const speed = fraction("/buff_types/action_speed") + levelSpeed;
    const cycleSeconds = BASE_SECONDS / (1 + speed);
    const actionsPerHour = 3600 / cycleSeconds;
    const wisdom = fraction("/buff_types/wisdom");
    const xpAt = rates.map((_, L) => 1.4 * (1 + L) * (10 + itemLevel) * (1 + wisdom));
    const cycles = enhanceCycles(rates, blessed, xpAt);

    const inputs = materials(detail, market) || [];
    const costPerAttempt = inputs.reduce((sum, i) => sum + i.value, 0);
    // Drops on every attempt, success or not.
    const drops = [];
    const crate = enhanceCrate(itemLevel);
    for (const [itemHrid, count, kind] of [[ESSENCE, ((100 + itemLevel) / 1000) * (1 + fraction("/buff_types/essence_find")), "essence"], [crate.itemHrid, crate.rate * (1 + fraction("/buff_types/rare_find")), "rare"]]) {
        const sell = market.sell(itemHrid);
        drops.push({ itemHrid, count, kind, price: sell.price, sell, value: count * sell.price });
    }
    const dropsPerAttempt = drops.reduce((sum, d) => sum + d.value, 0);
    const base = baseItem(action, market, owned);
    const drinksPerHour = 12 * who.concentration;
    const teaCosts = teas.map((hrid) => {
        const price = market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
        return { itemHrid: hrid, price, perHour: price * drinksPerHour };
    });
    const teaPerHour = teaCosts.reduce((sum, t) => sum + t.perHour, 0);

    const common = {
        action,
        hrid: action.hrid,
        skill: SKILL,
        teas,
        level,
        effectiveLevel,
        requiredLevel: itemLevel,
        efficiency: 0,
        levelEfficiency: 0,
        speed,
        levelSpeed,
        baseSeconds: BASE_SECONDS,
        cycleSeconds,
        actionsPerHour,
        quantity: 0,
        artisan: 0,
        processing: 0,
        teaCosts,
        drinksPerHour,
        teaPerHour,
        rates,
        multiplier,
        levelBonus: bonus,
        successBonus: success,
        blessed,
        wisdom,
        base,
        warnings: [],
        buffsKnown: !!who.buffs,
    };

    const results = [];
    for (let target = 1; target <= MAX_TARGET; target++) {
        const attempts = cycles.attempts[target];
        if (!Number.isFinite(attempts) || attempts <= 0) break;
        const sold = resale ? resale(action.itemHrid, target) : { price: 0, source: "none", level: null };
        // Per attempt: the materials, and 1/attempts of an item bought and of one sold at +target.
        const perCycle = 1 / attempts;
        const madePerDay = (actionsPerHour / attempts) * 24;
        const takes = sold.sold ?? (sellCap > 0 ? sellCap : null);
        let price = sold.price;
        let salesCap = null;
        if (takes !== null && madePerDay > takes && sold.floor !== undefined) {
            const share = takes / madePerDay;
            price = share * sold.price + (1 - share) * Math.min(sold.floor, sold.price);
            salesCap = { perDay: takes, made: madePerDay, fromSales: sold.sold !== null && sold.sold !== undefined };
        }
        const itemIn = base ? { itemHrid: action.itemHrid, count: perCycle, price: base.price, value: perCycle * base.price, upgrade: true, owned: base.owned } : null;
        const outputs = [{ itemHrid: action.itemHrid, enhancementLevel: target, count: perCycle, kind: "product", price, sell: sold, value: perCycle * price }, ...drops];
        const revenuePerAction = outputs.reduce((sum, o) => sum + o.value, 0);
        const costPerAction = costPerAttempt + (itemIn ? itemIn.value : 0);
        const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
        const xpPerAction = cycles.xp[target] / attempts;
        const r = {
            ...common,
            target,
            attempts,
            itemsPerHour: actionsPerHour / attempts,
            salesCap,
            outputs,
            inputs: itemIn ? [...inputs, itemIn] : inputs,
            costPerAttempt,
            dropsPerAttempt,
            revenuePerAction,
            costPerAction,
            profitPerHour,
            margin: revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null,
            mainCount: perCycle,
            xpPerAction,
            xpPerHour: actionsPerHour * xpPerAction,
            valid: !!base && inputs.length > 0,
            hoursPerDay: 24,
            capped: false,
            goldPerDay: profitPerHour * 24,
            xpPerDay: actionsPerHour * xpPerAction * 24,
        };
        r.coinsPerXp = r.xpPerHour > 0 ? -r.profitPerHour / r.xpPerHour : null;
        results.push(r);
    }
    let best = results[0];
    for (const r of results) if (score(r) > score(best) + 1e-12) best = r;
    if (fixedTarget) best = results.find((r) => r.target === Math.min(MAX_TARGET, fixedTarget)) || best;
    best.targets = results.map((r) => ({ target: r.target, attempts: r.attempts, goldPerDay: r.goldPerDay, xpPerDay: r.xpPerDay, coinsPerXp: r.coinsPerXp, sell: r.outputs[0].sell }));
    return best;
}
