// Alchemy: coinify, decompose or transmute an item bought on the market. The
// game rules (checked against the game's own Alchemy window):
// - 20 s / (1 + speed); efficiency +1% per level above the item's level, plus buffs;
// - success = base × (1 + catalyst + success buffs + 0.9 / item level × (level − item level) below the item);
//   base 70% coinify, 60% decompose, the item's own rate for transmute;
// - one action takes the item's bulk size (e.g. 10 essences) and gives that many times the outputs;
// - decompose costs 5 × (10 + item level) coins, transmute max(50, sell price / 5), each × bulk;
// - XP (1.0 coinify, 1.4 decompose, 1.6 transmute) × (10 + item level) × (1 + wisdom), a tenth on a failure;
// - every action may drop Alchemy Essence ((100 + item level) / 1800) and an Artisan's Crate.
// On a failure the item and the coins are lost; a catalyst is used up only on a success.

import { teaBuffs, totals } from "./skilling.js";

export const ALCHEMY = "alchemy";
const TYPE = "/action_types/alchemy";
const SKILL = "/skills/alchemy";
export const ALCHEMY_FUNCTION = "/action_functions/alchemy";
const BASE_SECONDS = 20;
const MIN_CYCLE_SECONDS = 3;
const FAIL_XP = 0.1;
const COIN = "/items/coin";
const ESSENCE = "/items/alchemy_essence";

export const ALCHEMY_KINDS = {
    coinify: { name: "Coinify", hrid: "/actions/alchemy/coinify", rate: 0.7, xp: 1.0, catalyst: "/items/catalyst_of_coinification" },
    decompose: { name: "Decompose", hrid: "/actions/alchemy/decompose", rate: 0.6, xp: 1.4, catalyst: "/items/catalyst_of_decomposition" },
    transmute: { name: "Transmute", hrid: "/actions/alchemy/transmute", rate: null, xp: 1.6, catalyst: "/items/catalyst_of_transmutation" },
};
const PRIME = "/items/prime_catalyst";
const CATALYST_BONUS = { kind: 0.15, prime: 0.25 };

// The success bonus (negative) for an item above your level.
export function levelPenalty(level, itemLevel) {
    return level < itemLevel && itemLevel > 0 ? (0.9 / itemLevel) * (level - itemLevel) : 0;
}

export function coinCost(kind, detail) {
    const bulk = bulkOf(detail);
    if (kind === "decompose") return 5 * (10 + (detail.itemLevel || 0)) * bulk;
    if (kind === "transmute") return Math.max(50, Math.floor((detail.sellPrice || 0) / 5)) * bulk;
    return 0;
}

const bulkOf = (detail) => Math.max(1, Math.floor(detail.alchemyDetail?.bulkMultiplier || 1));
const meanCount = (drop) => (Number(drop.dropRate ?? 1) || 0) * ((Number(drop.minCount ?? 1) + Number(drop.maxCount ?? 1)) / 2);

// What one successful action gives, before the bulk size.
function successOutputs(kind, detail) {
    const a = detail.alchemyDetail;
    if (kind === "coinify") return [{ itemHrid: COIN, count: 5 * (detail.sellPrice || 0) }];
    if (kind === "decompose") return (a.decomposeItems || []).map((d) => ({ itemHrid: d.itemHrid, count: d.count }));
    return (a.transmuteDropTable || []).map((d) => ({ itemHrid: d.itemHrid, count: meanCount(d) }));
}

// The Artisan's Crate an action may drop, by the item's level.
export function crateDrop(itemLevel) {
    if (itemLevel < 35) return { itemHrid: "/items/small_artisans_crate", rate: (100 + itemLevel) / 144000 };
    if (itemLevel < 70) return { itemHrid: "/items/medium_artisans_crate", rate: (65 + itemLevel) / 216000 };
    return { itemHrid: "/items/large_artisans_crate", rate: (30 + itemLevel) / 288000 };
}

// Every item × alchemy action the market lets you do: the item for sale, and
// for decompose and transmute something to get out of it.
export function alchemyActions(data, market) {
    const list = [];
    for (const detail of Object.values(data.itemDetailMap)) {
        const a = detail.alchemyDetail;
        if (!a || !detail.isTradable || market.buy(detail.hrid) === null) continue;
        const kinds = [];
        if (a.isCoinifiable && detail.sellPrice > 0) kinds.push("coinify");
        if (a.decomposeItems?.length) kinds.push("decompose");
        if (a.transmuteDropTable?.length && a.transmuteSuccessRate > 0) kinds.push("transmute");
        for (const kind of kinds) {
            const k = ALCHEMY_KINDS[kind];
            const main = kind === "coinify" ? COIN : successOutputs(kind, detail).filter((o) => o.itemHrid !== detail.hrid).sort((x, y) => y.count - x.count)[0]?.itemHrid;
            list.push({
                hrid: `${k.hrid}#${detail.hrid}`,
                name: `${k.name} ${detail.name}`,
                kind,
                itemHrid: detail.hrid,
                type: TYPE,
                function: ALCHEMY_FUNCTION,
                levelRequirement: { skillHrid: SKILL, level: detail.itemLevel || 1 },
                baseTimeCost: BASE_SECONDS * 1e9,
                outputItems: main ? [{ itemHrid: main, count: 1 }] : [],
                sortIndex: detail.sortIndex || 0,
            });
        }
    }
    return list.sort((a, b) => a.levelRequirement.level - b.levelRequirement.level || a.sortIndex - b.sortIndex);
}

// One item × action with one tea setup; the catalyst (none, the action's own,
// or Prime) that scores best is picked (gold a day by default).
export function evaluateAlchemy(action, who, data, market, teas, { score = (r) => r.goldPerDay } = {}) {
    const detail = data.itemDetailMap[action.itemHrid];
    const kind = action.kind;
    const k = ALCHEMY_KINDS[kind];
    const buff = totals([...(who.buffs?.[TYPE] || []), ...teaBuffs(teas, who.concentration, data)]);
    const fraction = (type) => buff(type).flat + buff(type).ratio;
    const level = who.levels[SKILL] ?? 1;
    const levelBuff = buff("/buff_types/alchemy_level");
    const effectiveLevel = (1 + levelBuff.ratio) * level + levelBuff.flat;
    const itemLevel = detail.itemLevel || 1;
    const bulk = bulkOf(detail);

    const levelEfficiency = Math.max(0, effectiveLevel - itemLevel) / 100;
    const efficiency = fraction("/buff_types/efficiency") + levelEfficiency;
    const speed = fraction("/buff_types/action_speed");
    const cycleSeconds = Math.max(MIN_CYCLE_SECONDS, BASE_SECONDS / (1 + speed));
    const actionsPerHour = (3600 / cycleSeconds) * (1 + efficiency);
    const baseRate = kind === "transmute" ? detail.alchemyDetail.transmuteSuccessRate : k.rate;
    const penalty = levelPenalty(effectiveLevel, itemLevel);
    const successBuff = fraction("/buff_types/alchemy_success");
    const wisdom = fraction("/buff_types/wisdom");
    const xpBase = k.xp * (10 + itemLevel) * (1 + wisdom);

    const price = market.buy(action.itemHrid);
    const coins = coinCost(kind, detail);
    const drinksPerHour = 12 * who.concentration;
    const teaCosts = teas.map((hrid) => {
        const p = market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
        return { itemHrid: hrid, price: p, perHour: p * drinksPerHour };
    });
    const teaPerHour = teaCosts.reduce((sum, t) => sum + t.perHour, 0);
    const essence = { itemHrid: ESSENCE, count: ((100 + itemLevel) / 1800) * (1 + fraction("/buff_types/essence_find")) };
    const crate = crateDrop(itemLevel);
    const rare = { itemHrid: crate.itemHrid, count: crate.rate * (1 + fraction("/buff_types/rare_find")) };

    const catalysts = [{ itemHrid: null, bonus: 0 }];
    for (const [hrid, bonus] of [[k.catalyst, CATALYST_BONUS.kind], [PRIME, CATALYST_BONUS.prime]]) {
        if (market.buy(hrid) !== null) catalysts.push({ itemHrid: hrid, bonus, price: market.buy(hrid) });
    }

    let best = null;
    for (const catalyst of catalysts) {
        const successRate = Math.min(1, Math.max(0, baseRate * (1 + catalyst.bonus + successBuff + penalty)));
        const outputs = [];
        const add = (itemHrid, count, kindOf) => {
            if (count <= 0) return;
            const sell = itemHrid === COIN ? { price: 1, source: "coin" } : market.sell(itemHrid);
            outputs.push({ itemHrid, count, kind: kindOf, price: sell.price, sell, value: count * sell.price });
        };
        // A transmute that gives the item back saves buying one.
        let selfBack = 0;
        for (const o of successOutputs(kind, detail)) {
            if (o.itemHrid === action.itemHrid) selfBack += o.count * bulk * successRate;
            else add(o.itemHrid, o.count * bulk * successRate, "product");
        }
        add(essence.itemHrid, essence.count, "essence");
        add(rare.itemHrid, rare.count, "rare");
        const inputs = [{ itemHrid: action.itemHrid, count: bulk - selfBack, price, value: (bulk - selfBack) * (price || 0) }];
        if (coins) inputs.push({ itemHrid: COIN, count: coins, price: 1, value: coins });
        if (catalyst.itemHrid) inputs.push({ itemHrid: catalyst.itemHrid, count: successRate, price: catalyst.price, value: successRate * catalyst.price, catalyst: true });

        const revenuePerAction = outputs.reduce((sum, o) => sum + o.value, 0);
        const costPerAction = inputs.reduce((sum, i) => sum + i.value, 0);
        const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
        const xpPerAction = xpBase * (successRate + FAIL_XP * (1 - successRate));
        const main = outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0] || null;
        const warnings = [];
        if (main && main.sell.note) warnings.push({ kind: main.sell.note, itemHrid: main.itemHrid, ask: main.sell.ask, bid: main.sell.bid });
        const r = {
            action,
            hrid: action.hrid,
            skill: SKILL,
            teas,
            level,
            effectiveLevel,
            requiredLevel: itemLevel,
            efficiency,
            levelEfficiency,
            speed,
            baseSeconds: BASE_SECONDS,
            cycleSeconds,
            actionsPerHour,
            quantity: 0,
            artisan: 0,
            processing: 0,
            outputs,
            inputs,
            teaCosts,
            drinksPerHour,
            revenuePerAction,
            costPerAction,
            teaPerHour,
            profitPerHour,
            margin: revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null,
            mainCount: main ? main.count : bulk,
            xpPerAction,
            xpPerHour: actionsPerHour * xpPerAction,
            valid: price !== null && successRate > 0 && (!!main || kind === "coinify"),
            warnings,
            buffsKnown: !!who.buffs,
            bulk,
            coinCost: coins,
            baseRate,
            successRate,
            penalty,
            successBuff,
            catalyst,
            wisdom,
            hoursPerDay: 24,
            capped: false,
            goldPerDay: profitPerHour * 24,
            xpPerDay: actionsPerHour * xpPerAction * 24,
        };
        r.coinsPerXp = r.xpPerHour > 0 ? -r.profitPerHour / r.xpPerHour : null;
        if (!best || score(r) > score(best) + 1e-12) best = r;
    }
    return best;
}
