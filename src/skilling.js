// Gold and XP per day for gathering and production, worked out from the
// character's own levels, buffs and teas and priced on the market. The game
// rules (level efficiency, speed, the 3 s floor, 12 drinks an hour, the 4%
// market tax, tea effects) are the same ones MWITools uses. Enhancing and
// Alchemy have their own rules (enhancing.js, alchemy.js) and join the list
// when picked.

import { experienceOf, levelsPerDay } from "./levels.js";
import { ALCHEMY, ALCHEMY_FUNCTION, alchemyActions, evaluateAlchemy } from "./alchemy.js";
import { ENHANCE_FUNCTION, ENHANCING, enhancingActions, evaluateEnhance } from "./enhancing.js";

export const SKILLING_SKILLS = ["milking", "foraging", "woodcutting", "cheesesmithing", "crafting", "tailoring", "cooking", "brewing"];
// Skills you mostly pay to level: shown when picked, not in "All skills".
export const LEVELING_SKILLS = ["alchemy", "enhancing"];

// Every buff source the game sends per action type, except the drinks: teas
// are added from the drink slots, so other tea setups can be tried.
const BUFF_SOURCES = [
    "mooPassActionTypeBuffsMap",
    "communityActionTypeBuffsMap",
    "houseActionTypeBuffsMap",
    "guildActionTypeBuffsMap",
    "achievementActionTypeBuffsMap",
    "equipmentActionTypeBuffsMap",
    "personalActionTypeBuffsMap",
];

export const MARKET_TAX = 0.04;
const COWBELL_BAG_TAX = 0.18;
// Below this share of the revenue as profit, a small price drop wipes it out.
export const RISKY_MARGIN = 0.05;
export const DRINKS_PER_HOUR = 12;
const MIN_CYCLE_SECONDS = 3;
export const NEAR_LEVELS = 10;
const HOURS_PER_DAY = 24;
// A product whose cheapest seller asks this many times the best bid is hard to sell at the ask.
export const WIDE_SPREAD = 1.5;

const INVENTORY = "/item_locations/inventory";
const COIN = "/items/coin";
const POUCH = "/item_locations/pouch";
const TOTAL_LEVEL = "/skills/total_level";
const BUFF = {
    efficiency: "/buff_types/efficiency",
    speed: "/buff_types/action_speed",
    actionLevel: "/buff_types/action_level",
    gathering: "/buff_types/gathering",
    gourmet: "/buff_types/gourmet",
    artisan: "/buff_types/artisan",
    processing: "/buff_types/processing",
    wisdom: "/buff_types/wisdom",
    essence: "/buff_types/essence_find",
    rare: "/buff_types/rare_find",
};

const skillName = (skillHrid) => skillHrid.split("/").pop();
export const skillType = (skill) => "/action_types/" + skill;

// What the calculation needs from init_character_data and the items.
export function skillingCharacter(character, items, data) {
    const levels = {};
    const experience = {};
    for (const skill of character.characterSkills || []) {
        levels[skill.skillHrid] = skill.level;
        experience[skill.skillHrid] = skill.experience ?? null;
    }
    // Pouches ask for a total level; worked out when the game doesn't send it.
    levels[TOTAL_LEVEL] ??= Object.values(levels).reduce((sum, level) => sum + (Number(level) || 0), 0);
    const known = BUFF_SOURCES.filter((key) => character[key]);
    let buffs = null;
    if (known.length) {
        buffs = {};
        for (const key of known) {
            for (const [type, list] of Object.entries(character[key] || {})) {
                if (Array.isArray(list)) (buffs[type] ||= []).push(...list);
            }
        }
    }
    const drinks = {};
    const slots = {};
    const pouch = [...items.values()].find((item) => item.itemLocationHrid === POUCH && item.itemHrid)?.itemHrid || null;
    const pouchSlots = drinkSlots(pouch, data);
    for (const skill of [...SKILLING_SKILLS, ...LEVELING_SKILLS]) {
        const list = character.actionTypeDrinkSlotsMap?.[skillType(skill)];
        drinks[skillType(skill)] = (list || []).map((slot) => slot?.itemHrid).filter(Boolean);
        // The game's list can hold locked slots too; a tea you already use always counts.
        slots[skillType(skill)] = Math.max(pouchSlots, drinks[skillType(skill)].length);
    }
    // The raw buff lists, the gear worn and the house: Enhancing fills in what the game doesn't send.
    const sources = Object.fromEntries(known.map((key) => [key, character[key]]));
    const equipped = [...items.values()].filter((item) => item.itemHrid && item.itemLocationHrid !== INVENTORY).map((item) => ({ itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 }));
    const houseLevels = {};
    for (const [hrid, room] of Object.entries(character.characterHouseRoomMap || {})) houseLevels[hrid] = room?.level || 0;
    return { levels, experience, buffs, drinks, slots, pouch, concentration: drinkConcentration(character, items, data), sources, equipped, houseLevels };
}

// Drink slots: one, plus what the pouch adds (the same number as in combat).
export function drinkSlots(pouchHrid, data) {
    return 1 + (data.itemDetailMap[pouchHrid]?.equipmentDetail?.combatStats?.drinkSlots || 0);
}

// Guzzling Pouch: drinks work harder and run out faster.
function drinkConcentration(character, items, data) {
    const given = Number(character.noncombatStats?.drinkConcentration);
    if (Number.isFinite(given)) return 1 + Math.max(0, given);
    const multipliers = data.enhancementLevelTotalBonusMultiplierTable || [];
    let total = 0;
    for (const item of items.values()) {
        if (!item.itemHrid || item.itemLocationHrid === INVENTORY) continue;
        const detail = data.itemDetailMap[item.itemHrid]?.equipmentDetail;
        const base = detail?.noncombatStats?.drinkConcentration || 0;
        const bonus = detail?.noncombatEnhancementBonuses?.drinkConcentration || 0;
        total += base + bonus * (multipliers[item.enhancementLevel || 0] || 0);
    }
    return 1 + total;
}

export function skillingActions(data) {
    const types = new Set(SKILLING_SKILLS.map(skillType));
    return Object.values(data.actionDetailMap)
        .filter((action) => types.has(action.type) && action.levelRequirement && /\/(gathering|production)$/.test(action.function))
        .sort((a, b) => a.levelRequirement.level - b.levelRequirement.level || a.sortIndex - b.sortIndex);
}

// Raw material -> its processed product (Processing Tea turns some of the cotton into fabric).
const processingCache = new WeakMap();
function processedProducts(data) {
    let map = processingCache.get(data);
    if (map) return map;
    map = new Map();
    for (const action of Object.values(data.actionDetailMap)) {
        if (!/(fabric|lumber|cheese)$/.test(action.hrid)) continue;
        const input = action.inputItems?.[0];
        const output = action.outputItems?.[0];
        if (input?.count > 0 && output) map.set(input.itemHrid, { itemHrid: output.itemHrid, inputCount: input.count });
    }
    processingCache.set(data, map);
    return map;
}

export function usableTeas(data, type) {
    return Object.values(data.itemDetailMap)
        .filter((item) => item.consumableDetail?.usableInActionTypeMap?.[type] && item.consumableDetail.buffs?.length && !item.consumableDetail.usableInActionTypeMap["/action_types/combat"])
        .map((item) => item.hrid);
}

export function totals(buffs) {
    const sum = new Map();
    for (const buff of buffs) {
        const entry = sum.get(buff.typeHrid) || { flat: 0, ratio: 0 };
        entry.flat += Number(buff.flatBoost) || 0;
        entry.ratio += Number(buff.ratioBoost) || 0;
        sum.set(buff.typeHrid, entry);
    }
    return (type) => sum.get(type) || { flat: 0, ratio: 0 };
}

export function teaBuffs(teas, concentration, data) {
    const list = [];
    for (const hrid of teas) {
        for (const buff of data.itemDetailMap[hrid]?.consumableDetail?.buffs || []) {
            list.push({ typeHrid: buff.typeHrid, flatBoost: (buff.flatBoost || 0) * concentration, ratioBoost: (buff.ratioBoost || 0) * concentration });
        }
    }
    return list;
}

// Prices: inputs and teas are bought at the cheapest ask; products sell at
// the ask (a listing) or the best bid (instant), minus the market tax.
// Crates and caches are worth what they hold; a cowbell a tenth of a bag.
// usualAsk(hrid): the item's 7-day median ask, or null without enough history.
// Listing at the ask is never valued above it: a lone listing far above the
// usual price (a troll order at 999B) would otherwise look like a fortune.
// Without history, an ask far above the best bid is valued at WIDE_SPREAD × the bid.
// soldOf(hrid): how many sell a day (from the price history), or null. A price
// from the market then carries it (sold) and the floor: what the rest goes
// for once the market has taken its day – the bid when listing, else the shop.
export function marketPricer(entryOf, data, sellAt = "ask", usualAsk = () => null, soldOf = () => null) {
    const cache = new Map();
    const contents = (hrid) => (data.openableLootDropMap?.[hrid] || []).reduce((sum, drop) => sum + meanCount(drop) * (drop.itemHrid === hrid ? 0 : this_.sell(drop.itemHrid).price), 0);
    const vendor = (hrid) => data.itemDetailMap[hrid]?.sellPrice || 0;
    const tradable = (hrid) => !!data.itemDetailMap[hrid]?.isTradable;
    const this_ = {
        buy(hrid) {
            if (hrid === "/items/coin") return 1;
            const entry = tradable(hrid) ? entryOf(hrid) : null;
            return entry?.a > 0 ? entry.a : null;
        },
        sell(hrid) {
            if (cache.has(hrid)) return cache.get(hrid);
            const entry = (tradable(hrid) && entryOf(hrid)) || {};
            const ask = entry.a > 0 ? entry.a : null;
            const bid = entry.b > 0 ? entry.b : null;
            const tax = hrid === "/items/bag_of_10_cowbells" ? COWBELL_BAG_TAX : MARKET_TAX;
            cache.set(hrid, { price: 0 }); // a crate that holds itself
            let result;
            if (hrid === "/items/coin") result = { price: 1, ask: 1, bid: 1, source: "coin" };
            else if (hrid === "/items/cowbell") result = { ...this_.sell("/items/bag_of_10_cowbells"), source: "bag" };
            else if (!ask && !bid && data.openableLootDropMap?.[hrid]) result = { price: contents(hrid), ask, bid, source: "contents" };
            else if (sellAt === "ask" && ask) {
                const usual = usualAsk(hrid);
                const ceiling = usual > 0 ? usual : bid ? WIDE_SPREAD * bid : Infinity;
                result = { price: Math.min(ask, ceiling) * (1 - tax), ask, bid, source: "ask", capped: ask > ceiling ? (usual > 0 ? "usual" : "spread") : null, note: bid ? (ask > WIDE_SPREAD * bid ? "spread" : null) : "nobids" };
            }
            else if (bid) result = { price: bid * (1 - tax), ask, bid, source: "bid", note: sellAt === "ask" ? "noasks" : null };
            else if (ask) result = { price: ask * (1 - tax), ask, bid, source: "ask", note: "nobids" };
            else result = { price: vendor(hrid), ask, bid, source: "vendor", note: vendor(hrid) ? "vendor" : "unsellable" };
            // A cowbell is a tenth of a bag; the bag's sales aren't its own.
            if (result.source === "bag") result = { ...result, price: result.price / 10, sold: undefined, floor: undefined };
            if (result.source === "ask" || result.source === "bid") {
                result.sold = soldOf(hrid);
                const floor = result.source === "ask" && bid ? bid * (1 - tax) : vendor(hrid);
                result.floor = Math.min(floor, result.price);
            }
            cache.set(hrid, result);
            return result;
        },
    };
    return this_;
}

// The market takes only so many a day: of made a day, what it doesn't take
// goes for the floor. Returns the mean price and, when it binds, salesCap
// { perDay, made, floor }.
export function salesLimited(sell, made) {
    if (!Number.isFinite(sell.sold) || sell.sold < 0 || sell.floor === undefined || !(made > sell.sold)) return { price: sell.price, salesCap: null };
    const share = sell.sold / made;
    return { price: share * sell.price + (1 - share) * sell.floor, salesCap: { perDay: sell.sold, made, floor: sell.floor } };
}

const meanCount = (drop) => (Number(drop.dropRate ?? 1) || 0) * ((Number(drop.minCount ?? 1) + Number(drop.maxCount ?? 1)) / 2);

// One action with one tea setup. Everything is per hour; the UI multiplies by 24.
export function evaluateAction(action, who, data, market, teas = who.drinks[action.type] || [], level = who.levels[action.levelRequirement.skillHrid] ?? 1) {
    const skill = action.levelRequirement.skillHrid;
    const buff = totals([...(who.buffs?.[action.type] || []), ...teaBuffs(teas, who.concentration, data)]);
    const fraction = (type) => buff(type).flat + buff(type).ratio;

    const levelBuff = buff(`/buff_types/${skillName(skill)}_level`);
    const effectiveLevel = (1 + levelBuff.ratio) * level + levelBuff.flat;
    const requiredLevel = action.levelRequirement.level + buff(BUFF.actionLevel).flat;
    const levelEfficiency = Math.max(0, effectiveLevel - requiredLevel) / 100;
    const efficiency = buff(BUFF.efficiency).flat + levelEfficiency;
    const speed = fraction(BUFF.speed);
    const baseSeconds = action.baseTimeCost / 1e9;
    const cycleSeconds = Math.max(MIN_CYCLE_SECONDS, baseSeconds / (1 + speed));
    const actionsPerHour = (3600 / cycleSeconds) * (1 + efficiency);

    const quantity = Math.max(0, fraction(BUFF.gathering) + fraction(BUFF.gourmet));
    const processing = Math.min(1, Math.max(0, fraction(BUFF.processing)));
    const artisan = Math.min(1, Math.max(0, fraction(BUFF.artisan)));
    const products = processing > 0 ? processedProducts(data) : null;

    const outputs = [];
    const addOutput = (itemHrid, count, kind) => {
        if (count <= 0) return;
        const sell = market.sell(itemHrid);
        const { price, salesCap } = salesLimited(sell, count * actionsPerHour * HOURS_PER_DAY);
        outputs.push({ itemHrid, count, kind, price, sell, value: count * price, salesCap });
    };
    const base = action.outputItems?.length ? action.outputItems.map((o) => ({ itemHrid: o.itemHrid, count: o.count })) : (action.dropTable || []).map((d) => ({ itemHrid: d.itemHrid, count: meanCount(d) }));
    for (const output of base) {
        const count = output.count * (1 + quantity);
        const processed = products?.get(output.itemHrid);
        addOutput(output.itemHrid, processed ? count * (1 - processing) : count, "product");
        if (processed) addOutput(processed.itemHrid, (count * processing) / processed.inputCount, "processed");
    }
    for (const drop of action.essenceDropTable || []) addOutput(drop.itemHrid, meanCount(drop) * (1 + fraction(BUFF.essence)), "essence");
    for (const drop of action.rareDropTable || []) addOutput(drop.itemHrid, meanCount(drop) * (1 + fraction(BUFF.rare)), "rare");

    const inputs = (action.inputItems || []).map((input) => ({ itemHrid: input.itemHrid, count: input.count * (1 - artisan) }));
    if (action.upgradeItemHrid) inputs.push({ itemHrid: action.upgradeItemHrid, count: 1, upgrade: true });
    const missing = [];
    for (const input of inputs) {
        input.price = market.buy(input.itemHrid);
        if (input.price === null) missing.push(input.itemHrid);
        input.value = input.count * (input.price || 0);
    }

    const drinksPerHour = DRINKS_PER_HOUR * who.concentration;
    const teaCosts = teas.map((hrid) => {
        const price = market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
        return { itemHrid: hrid, price, perHour: price * drinksPerHour };
    });

    const revenuePerAction = outputs.reduce((sum, o) => sum + o.value, 0);
    const costPerAction = inputs.reduce((sum, i) => sum + i.value, 0);
    const teaPerHour = teaCosts.reduce((sum, t) => sum + t.perHour, 0);
    const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
    const margin = revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null;
    const xpPerAction = (action.experienceGain?.value || 0) * (1 + fraction(BUFF.wisdom));

    const main = outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0] || null;
    const warnings = [];
    if (missing.length) warnings.push({ kind: "noinput", items: missing });
    if (main && main.sell.note) warnings.push({ kind: main.sell.note, itemHrid: main.itemHrid, ask: main.sell.ask, bid: main.sell.bid });
    if (costPerAction > 0 && profitPerHour > 0 && margin < RISKY_MARGIN) warnings.push({ kind: "margin", margin });

    return {
        action,
        hrid: action.hrid,
        skill,
        teas,
        level,
        requiredLevel,
        effectiveLevel,
        efficiency,
        levelEfficiency,
        speed,
        baseSeconds,
        cycleSeconds,
        actionsPerHour,
        quantity,
        artisan,
        processing,
        outputs,
        inputs,
        teaCosts,
        drinksPerHour,
        revenuePerAction,
        costPerAction,
        teaPerHour,
        profitPerHour,
        margin,
        mainCount: main?.count || 0,
        salesCap: main?.salesCap || null,
        xpPerAction,
        xpPerHour: actionsPerHour * xpPerAction,
        valid: missing.length === 0 && !!main && main.sell.note !== "unsellable",
        warnings,
        buffsKnown: !!who.buffs,
    };
}

// Every tea setup that fits the slots (teas sharing a buff don't stack: Foraging and Super Foraging Tea).
function teaSetups(data, type, slots, candidates) {
    const unique = (hrid) => data.itemDetailMap[hrid]?.consumableDetail?.buffs?.[0]?.uniqueHrid || hrid;
    const setups = [[]];
    const grow = (start, chosen) => {
        if (chosen.length >= slots) return;
        for (let i = start; i < candidates.length; i++) {
            if (chosen.some((hrid) => unique(hrid) === unique(candidates[i]))) continue;
            const next = [...chosen, candidates[i]];
            setups.push(next);
            grow(i + 1, next);
        }
    };
    grow(0, []);
    return setups;
}

// An action run all day.
export const daily = (result) => ({ ...result, goldPerDay: result.profitPerHour * HOURS_PER_DAY, xpPerDay: result.xpPerHour * HOURS_PER_DAY });

// The tea setup that scores best (gold a day by default), and what each of its teas adds.
// evaluate(teas, score): the score lets Enhancing and Alchemy pick their target and catalyst by it.
export function bestTeas(action, who, data, market, evaluate, score = (r) => r.goldPerDay) {
    const type = action.type;
    const candidates = usableTeas(data, type).filter((hrid) => market.buy(hrid) !== null || (who.drinks[type] || []).includes(hrid));
    let best = null;
    for (const teas of teaSetups(data, type, who.slots[type], candidates)) {
        const result = evaluate(teas, score);
        if (!best || score(result) > score(best) + 1e-12) best = result;
    }
    const worth = best.teas.map((hrid) => {
        const without = evaluate(best.teas.filter((t) => t !== hrid), score);
        return { itemHrid: hrid, gainPerDay: best.goldPerDay - without.goldPerDay, xpPerDay: best.xpPerDay - without.xpPerDay };
    });
    return { result: best, worth };
}

// XP ↔ gold focus: each counts as a share of the most any action in the list gives.
// xpOf: XP a day, or the levels it gives (see levelProgress).
const XP_PER_DAY = (r) => r.xpPerDay;
function focusScore(goldWeight, refs, xpOf = XP_PER_DAY) {
    return (r) => (goldWeight * r.goldPerDay) / refs.gold + ((1 - goldWeight) * xpOf(r)) / refs.xp;
}

// Total level: a day's XP counted as the levels it gives the action's skill from
// where it is now, so a low skill's cheap levels rank first. Plain XP without the table.
export function levelProgress(who, data, countLevels) {
    const table = data.levelExperienceTable;
    if (!countLevels || !Array.isArray(table)) return XP_PER_DAY;
    return (r) => {
        const level = who.levels[r.skill] ?? 1;
        return levelsPerDay(table, experienceOf(table, who.experience[r.skill], level), r.xpPerDay);
    };
}

// Levelling (Enhancing, Alchemy): time against money. Money is the coins per
// XP against the cheapest in the list, time the days per XP against the
// fastest; the focus weighs the two, so "Gold only" is the cheapest way to the
// XP and "XP only" the fastest, whatever it costs.
export const coinsPerXp = (r) => coinsPer(r, XP_PER_DAY);
// Coins per XP, or per level when counting levels.
const coinsPer = (r, xpOf) => (r.valid && xpOf(r) > 0 ? -r.goldPerDay / xpOf(r) : Infinity);
function timeMoneyScore(goldWeight, refs, xpOf = XP_PER_DAY) {
    const costScale = Math.max(1e-9, Math.abs(Number.isFinite(refs.cost) ? refs.cost : 1));
    return (r) => {
        const xp = xpOf(r);
        return xp > 0 && r.valid !== false ? -((goldWeight * -r.goldPerDay) / xp / costScale + ((1 - goldWeight) * refs.xp) / xp) : -Infinity;
    };
}

// Teas to buy for a job: the best setup's teas for as many hours as the job
// takes, less what is already in the inventory.
export function teaPurchase(entry, { hours, have = () => 0 }) {
    const teas = entry.best.result.teas;
    if (!teas.length || !(hours > 0)) return null;
    const perTea = Math.ceil(hours * entry.best.result.drinksPerHour);
    const items = teas.map((hrid) => ({ hrid, quantity: perTea - have(hrid), have: have(hrid) })).filter((item) => item.quantity > 0);
    return { hours, perTea, items };
}

// How much of an item you already have on the way to buyers: in the inventory and on your own sell orders.
export function heldStock(character, items, itemHrid) {
    let inventory = 0;
    for (const item of items.values()) {
        if (item.itemHrid === itemHrid && item.itemLocationHrid === INVENTORY && !item.enhancementLevel) inventory += item.count || 0;
    }
    let listed = 0;
    const listings = [];
    for (const listing of character.myMarketListings || []) {
        if (listing.itemHrid !== itemHrid || !listing.isSell || listing.enhancementLevel) continue;
        const quantity = Math.max(0, (listing.orderQuantity || 0) - (listing.filledQuantity || 0));
        listed += quantity;
        listings.push({ price: Number(listing.price) || 0, quantity });
    }
    return { inventory, listed, listings };
}

// Sell orders this close to the lowest ask count as the market's current size.
export const ASK_WINDOW = 0.05;

// What others have listed within ASK_WINDOW of the lowest ask. The order book
// holds your own sell orders too; those are taken out.
function othersNearLowestAsk(book, stock) {
    if (!book?.asks.length) return { quantity: 0, lowest: null };
    const lowest = Math.min(...book.asks.map((o) => o.price));
    const top = lowest * (1 + ASK_WINDOW);
    const near = book.asks.filter((o) => o.price <= top).reduce((sum, o) => sum + o.quantity, 0);
    const mine = (stock.listings || []).filter((l) => l.price > 0 && l.price <= top).reduce((sum, l) => sum + l.quantity, 0);
    return { quantity: Math.max(0, near - mine), lowest };
}

// The selling price (before tax) where an item stops paying for its materials and teas.
function breakEvenPrice(entry) {
    const main = entry.outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0];
    if (!main) return null;
    const others = entry.revenuePerAction - main.value;
    return (entry.costPerAction + entry.teaPerHour / entry.actionsPerHour - others) / main.count / (1 - MARKET_TAX);
}

// A product's market, rated from the week's prices: "stable" (nearly always a
// buyer and a seller, a tight spread, a calm price that moves often), "ok", or
// "thin" (anything else, and too little history to tell).
export const LIQUIDITY = {
    stable: { both: 0.9, spread: 0.05, swing: 0.03, activity: 0.3 },
    ok: { both: 0.75, spread: 0.15, swing: 0.08, activity: 0 },
};
const LIQUIDITY_HOURS = 12;
const RATING_ORDER = { thin: 0, ok: 1, stable: 2 };
// A material's order book seen on the market within this many hours caps the job.
export const INPUT_BOOK_HOURS = 12;

export function liquidityRating(summary) {
    const l = summary?.liquidity;
    const swing = summary?.a?.swing;
    if (!l || l.hours < LIQUIDITY_HOURS || l.spread === null || swing === null) return { rating: "thin", known: false, ...l, swing: swing ?? null };
    const meets = (t) => l.both >= t.both && l.spread <= t.spread && swing <= t.swing && l.activity >= t.activity;
    return { rating: meets(LIQUIDITY.stable) ? "stable" : meets(LIQUIDITY.ok) ? "ok" : "thin", known: true, ...l, swing };
}

// Away: a defensive job of about 8 hours, a small share of the coins unless the
// market is stable and liquid, and thin margins left out. Active: short jobs,
// more of the coins, thin margins shown.
export const PLAN_MODES = {
    away: { hours: 8, coinShare: { stable: 0.6, ok: 0.3, thin: 0.1 }, hideThinMargins: true },
    active: { hours: 1, coinShare: { stable: 0.8, ok: 0.5, thin: 0.2 }, hideThinMargins: false },
};

// A margin under RISKY_MARGIN, or smaller than the price's usual swing, can vanish on an ordinary day.
export function thinMargin(entry, swing = null) {
    if (!(entry.costPerAction > 0) || entry.margin === null || !(entry.profitPerHour > 0)) return false;
    return entry.margin < RISKY_MARGIN || (swing > CALM_SWING && entry.margin < swing);
}

// A product's price swinging more than this a day makes the batch smaller:
// the price may fall before it all sells.
export const CALM_SWING = 0.05;
const MIN_SWING_SHARE = 0.4;
// Above its usual price on a swinging market: half the batch, sold while it lasts.
const HIGH_PRICE_SHARE = 0.5;
const PRICE_BAND = 0.1;

// About a day of sales: what you hold, have listed and make together, once
// the price history knows how many sell a day (liquidity.sold); else no limit.
export const SALES_DAYS = 1;
const salesDay = (liquidity) => (liquidity?.sold?.enough ? Math.floor(SALES_DAYS * liquidity.sold.perDay) : Infinity);

// How much of the batch to make given the price's swing and where it is now
// (price: { swing, diff } – the selling side's typical swing and now vs usual).
export function swingShare(price) {
    if (!price || !(price.swing > 0)) return null;
    const bySwing = Math.min(1, Math.max(MIN_SWING_SHARE, 1 - 2 * (price.swing - CALM_SWING)));
    const high = price.diff !== null && price.diff > PRICE_BAND && price.swing > CALM_SWING;
    const low = price.diff !== null && price.diff < -PRICE_BAND;
    return { swing: price.swing, diff: price.diff, bySwing, high, low, share: bySwing * (high ? HIGH_PRICE_SHARE : 1) };
}

// How many to make, without opening the market: the planned hours of crafting,
// but no more than about a day of the product's sales (salesDay) with what you
// already hold or have listed counted in, smaller on a swinging price, and
// no more than the share of your coins the worst market (the product's or a
// bought material's) allows for materials. The product's order book is shown
// alongside; a material's, seen lately, caps the job at what was listed.
// inputMarket(hrid): { liquidity, book } for a material.
// fill: the job's share of the planned hours – what the ranking goes by.
export function suggestCount(entry, { stock, book = null, hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, coins = Infinity, have = () => 0, sellAt = "ask", price = null, liquidity = null, inputMarket = null, now = Date.now() }) {
    // A craft that loses gold still costs coins for its materials (worth it for the XP), so it is planned the same way.
    if ((entry.action.function !== "/action_functions/production" && entry.action.function !== ALCHEMY_FUNCTION) || !entry.valid || !entry.mainCount) return null;
    const breakEven = breakEvenPrice(entry);
    const profitableBids = book ? book.bids.filter((o) => o.price >= breakEven).reduce((sum, o) => sum + o.quantity, 0) : null;
    const asks = book && sellAt === "ask" ? othersNearLowestAsk(book, stock) : null;
    const product = liquidity || { rating: "thin", known: false };
    const planned = Math.max(1, Math.floor(hours * entry.actionsPerHour));
    const plannedUnits = Math.min(planned * entry.mainCount, salesDay(product));
    const held = stock.inventory + stock.listed;
    let count = Math.max(0, Math.ceil((plannedUnits - held) / entry.mainCount - 1e-9));
    const swing = swingShare(price);
    if (swing && swing.share < 1) count = Math.ceil(count * swing.share);
    // Materials bought for n actions, using what is in the inventory first.
    // Coins an action costs (Alchemy) are paid from the coins, not bought.
    const toBuy = (input, n) => (input.itemHrid === COIN ? input.count * n : Math.max(0, input.count * n - have(input.itemHrid)));
    const spend = (n) => entry.inputs.reduce((sum, input) => sum + toBuy(input, n) * (input.price || 0), 0);
    // The materials you'd have to buy: their markets rate the job too, and an
    // order book seen lately caps it at what was listed near the lowest ask.
    const bought = entry.inputs.filter((input) => input.itemHrid !== COIN && input.count > 0 && input.price > 0 && toBuy(input, count) > 0);
    const inputs = bought.map((input) => {
        const market = inputMarket?.(input.itemHrid) || {};
        const fresh = market.book && now - market.book.at <= INPUT_BOOK_HOURS * 3600000 ? market.book : null;
        const asks = fresh ? othersNearLowestAsk(fresh, { listings: [] }) : null;
        return {
            itemHrid: input.itemHrid,
            perAction: input.count,
            liquidity: market.liquidity || null,
            nearAsks: asks?.quantity ?? null,
            lowestAsk: asks?.lowest ?? null,
            bookAt: fresh?.at ?? null,
            maxCount: asks ? Math.floor((have(input.itemHrid) + asks.quantity) / input.count + 1e-9) : Infinity,
        };
    });
    let limitedByBook = null;
    for (const input of inputs) {
        if (input.maxCount < count) {
            count = input.maxCount;
            limitedByBook = input.itemHrid;
        }
    }
    // The worst market of the product and its bought materials sets the coins.
    let rating = product;
    let ratedBy = null;
    for (const input of inputs) {
        if (inputMarket && RATING_ORDER[input.liquidity?.rating ?? "thin"] < RATING_ORDER[rating.rating]) {
            rating = input.liquidity || { rating: "thin", known: false };
            ratedBy = input.itemHrid;
        }
    }
    const share = coinShare[rating.rating] ?? coinShare.thin;
    const budget = coins * share;
    let limitedByCoins = false;
    if (spend(count) > budget) {
        let low = 0;
        let high = count;
        while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            if (spend(mid) <= budget) low = mid;
            else high = mid - 1;
        }
        count = low;
        limitedByCoins = true;
    }
    const jobHours = count / entry.actionsPerHour;
    // The batch: what its materials are worth, the part you still have to buy,
    // and its profit once it sells (teas for its hours included).
    const batch = {
        materials: count * entry.costPerAction,
        toBuy: spend(count),
        revenue: count * entry.revenuePerAction,
        teas: entry.teaPerHour * jobHours,
    };
    batch.profit = batch.revenue - batch.materials - batch.teas;
    return {
        known: true,
        breakEven,
        profitableBids,
        nearAsks: asks?.quantity ?? null,
        lowestAsk: asks?.lowest ?? null,
        bookAt: book?.at ?? null,
        stock,
        held,
        plannedHours: hours,
        plannedUnits,
        cappedBySales: plannedUnits < planned * entry.mainCount,
        liquidity: rating,
        productLiquidity: product,
        ratedBy,
        inputs: inputs.map((input) => ({ ...input, toBuy: Math.max(0, Math.ceil(input.perAction * count - have(input.itemHrid) - 1e-9)) })),
        limitedByBook,
        coinShare: share,
        budget,
        count,
        hours: jobHours,
        fill: Math.min(1, jobHours / hours),
        batch,
        swing,
        limitedByCoins,
    };
}

// Enhancing within your coins: the item (unless you have it) and the planned
// hours of materials and teas may take the share of your coins that the
// item's market allows. The items come back as they sell, so one at a time is
// tied up. Without the coins for the item it can't start (fill 0); short of
// the materials it runs part of the planned hours.
export function enhanceBudget(entry, { hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, coins = Infinity, inputMarket = null }) {
    if (!entry.valid || entry.action.function !== ENHANCE_FUNCTION) return null;
    const rating = inputMarket?.(entry.action.itemHrid)?.liquidity || { rating: "thin", known: false };
    const share = coinShare[rating.rating] ?? coinShare.thin;
    const budget = coins * share;
    const item = entry.base.owned ? 0 : entry.base.price;
    const perHour = entry.costPerAttempt * entry.actionsPerHour + entry.teaPerHour;
    const fill = item > budget ? 0 : perHour > 0 ? Math.min(1, (budget - item) / (perHour * hours)) : 1;
    return { rating, share, budget, item, perHour, need: item + perHour * hours, fill, hours: fill * hours, plannedHours: hours };
}

// How many to make with the whole chain (see chainBuilder) in the planned hours,
// no more than a day of sales with what you hold, smaller on a swinging price, and with what the chain still
// buys within the share of your coins its worst market allows.
export function suggestChainCount(entry, chain, { stock, hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, coins = Infinity, price = null, liquidity = null, inputMarket = null }) {
    if (!chain || !entry.mainCount || chain.profitPerHour <= 0) return null;
    const planned = Math.max(1, Math.floor(hours / chain.hoursPerAction));
    const plannedUnits = Math.min(planned * entry.mainCount, salesDay(liquidity));
    const held = stock.inventory + stock.listed;
    let count = Math.max(0, Math.ceil((plannedUnits - held) / entry.mainCount - 1e-9));
    const swing = swingShare(price);
    if (swing && swing.share < 1) count = Math.ceil(count * swing.share);
    let rating = liquidity || { rating: "thin", known: false };
    let ratedBy = null;
    for (const hrid of inputMarket ? chain.bought : []) {
        const own = inputMarket(hrid)?.liquidity || { rating: "thin", known: false };
        if (RATING_ORDER[own.rating] < RATING_ORDER[rating.rating]) {
            rating = own;
            ratedBy = hrid;
        }
    }
    const share = coinShare[rating.rating] ?? coinShare.thin;
    const budget = coins * share;
    const limitedByCoins = chain.cashPerAction > 0 && count * chain.cashPerAction > budget;
    if (limitedByCoins) count = Math.floor(budget / chain.cashPerAction);
    return { count, hours: count * chain.hoursPerAction, cash: count * chain.cashPerAction, liquidity: rating, ratedBy, coinShare: share, budget, limitedByCoins, held };
}

// Making it all yourself: every material your levels let you make or gather is
// made (by its fastest source, with that skill's teas), the rest bought. The
// time of every step adds up, so the gold is per hour of the whole chain.
function chainBuilder(who, data, market, teaMode) {
    const sources = new Map();
    for (const action of skillingActions(data)) {
        const made = action.outputItems?.length ? action.outputItems.map((o) => o.itemHrid) : (action.dropTable || []).map((d) => d.itemHrid);
        for (const hrid of made) {
            if (!sources.has(hrid)) sources.set(hrid, []);
            sources.get(hrid).push(action);
        }
    }
    const runs = new Map();
    const run = (action) => {
        if (!runs.has(action.hrid)) {
            const plain = (teas) => daily(evaluateAction(action, who, data, market, teas));
            runs.set(action.hrid, teaMode === "best" ? bestTeas(action, who, data, market, plain).result : plain(who.drinks[action.type] || []));
        }
        return runs.get(action.hrid);
    };
    const units = new Map();
    // One unit of an item made yourself: its cost (materials, teas, less the
    // other drops of the action) and the hours it takes, materials included.
    const selfMade = (itemHrid, seen) => {
        if (units.has(itemHrid)) return units.get(itemHrid);
        if (seen.has(itemHrid)) return null;
        let best = null;
        for (const action of sources.get(itemHrid) || []) {
            if ((who.levels[action.levelRequirement.skillHrid] ?? 1) < action.levelRequirement.level) continue;
            const r = run(action);
            const out = r.outputs.find((o) => o.itemHrid === itemHrid && o.kind === "product");
            if (!out || out.count <= 0) continue;
            const inner = materials(r, new Set([...seen, itemHrid]));
            if (!inner) continue;
            const ownHours = 1 / (r.actionsPerHour * out.count);
            const unit = {
                itemHrid,
                action,
                cost: (inner.cost + r.teaPerHour / r.actionsPerHour - (r.revenuePerAction - out.value)) / out.count,
                ownHours,
                hours: ownHours + inner.hours / out.count,
                steps: inner.steps.map((step) => ({ ...step, count: step.count / out.count })),
            };
            if (!best || unit.hours < best.hours) best = unit;
        }
        units.set(itemHrid, best);
        return best;
    };
    // The materials for one action: made where you can, bought otherwise.
    const materials = (r, seen) => {
        let cost = 0;
        let hours = 0;
        const steps = [];
        for (const input of r.inputs) {
            const made = selfMade(input.itemHrid, seen);
            if (made) {
                cost += made.cost * input.count;
                hours += made.hours * input.count;
                steps.push({ itemHrid: input.itemHrid, count: input.count, made });
            } else if (input.price === null) {
                return null;
            } else {
                cost += input.value;
                steps.push({ itemHrid: input.itemHrid, count: input.count, price: input.price });
            }
        }
        return { cost, hours, steps };
    };
    // Hours each made material takes, per action of the final step.
    const timeShares = (steps, factor, out) => {
        for (const step of steps) {
            if (!step.made) continue;
            const share = out.get(step.itemHrid) || { itemHrid: step.itemHrid, action: step.made.action, count: 0, hours: 0 };
            share.count += step.count * factor;
            share.hours += step.made.ownHours * step.count * factor;
            out.set(step.itemHrid, share);
            timeShares(step.made.steps, step.count * factor, out);
        }
        return out;
    };
    const boughtItems = (steps, out) => {
        for (const step of steps) {
            if (step.made) boughtItems(step.made.steps, out);
            else out.add(step.itemHrid);
        }
        return out;
    };
    return (entry) => {
        if (entry.action.function !== "/action_functions/production" || !entry.valid) return null;
        const inner = materials(entry, new Set([entry.action.outputItems?.[0]?.itemHrid]));
        if (!inner || !inner.steps.some((step) => step.made)) return null;
        const craftHours = 1 / entry.actionsPerHour;
        const hours = craftHours + inner.hours;
        const profit = entry.revenuePerAction - inner.cost - entry.teaPerHour / entry.actionsPerHour;
        return {
            hoursPerAction: hours,
            craftShare: craftHours / hours,
            shares: [...timeShares(inner.steps, 1, new Map()).values()].map((share) => ({ ...share, share: share.hours / hours })),
            bought: [...boughtItems(inner.steps, new Set())],
            profitPerHour: profit / hours,
            goldPerDay: (profit / hours) * HOURS_PER_DAY,
            cashPerAction: inner.cost,
        };
    };
}

const leveling = (action) => action.function === ENHANCE_FUNCTION || action.function === ALCHEMY_FUNCTION;
const sameTeas = (a, b) => a.length === b.length && a.every((hrid) => b.includes(hrid));

// Enhancing and Alchemy offer hundreds of items: only those that do well
// without teas – in gold, in XP or in XP per coin – and those kept are tried
// with every tea setup.
export const SHORTLIST = 40;
function shortlist(candidates, keep = () => false) {
    if (candidates.length <= 3 * SHORTLIST) return candidates;
    const tried = candidates.map((c) => {
        const gold = c.evaluate([], (r) => r.goldPerDay);
        const xp = c.evaluate([], (r) => r.xpPerDay);
        const cheap = c.evaluate([], (r) => -coinsPerXp(r));
        return { c, gold: gold.valid ? gold.goldPerDay : -Infinity, xp: xp.valid ? xp.xpPerDay : -Infinity, perCoin: -coinsPerXp(cheap) };
    });
    const kept = new Set(candidates.filter(keep));
    for (const key of ["gold", "xp", "perCoin"]) [...tried].sort((a, b) => b[key] - a[key]).slice(0, SHORTLIST).forEach((t) => kept.add(t.c));
    return candidates.filter((c) => kept.has(c));
}

// The Skilling tab: what the character can do now, ranked by gold, and what unlocks soon.
// Enhancing and Alchemy are listed only when picked. leveling: { resale(hrid, level),
// owned(hrid), fixed: { hrid, target } – an action always listed, at the target set in the game }.
export function rankSkilling(who, data, market, { skill = "all", teaMode = "current", plan = null, goldWeight = 1, countLevels = false, leveling: levelingOptions = {} } = {}) {
    const xpOf = levelProgress(who, data, countLevels);
    const evaluator = (action, level) => {
        const target = levelingOptions.fixed?.hrid === action.hrid ? levelingOptions.fixed.target : null;
        if (action.function === ENHANCE_FUNCTION) return (teas, score) => evaluateEnhance(action, who, data, market, teas, { ...levelingOptions, score, target });
        if (action.function === ALCHEMY_FUNCTION) return (teas, score) => evaluateAlchemy(action, who, data, market, teas, { score });
        return (teas) => daily(evaluateAction(action, who, data, market, teas, level));
    };
    const wanted = (action) => skill === "all" || action.type === skillType(skill);
    const doable = [];
    const near = [];
    for (const action of skillingActions(data)) {
        // A skill the character has no entry for isn't one it can train.
        if (!wanted(action) || who.levels[action.levelRequirement.skillHrid] === undefined) continue;
        const level = who.levels[action.levelRequirement.skillHrid];
        const required = action.levelRequirement.level;
        if (required <= level) {
            doable.push({ action, evaluate: evaluator(action, level) });
        } else if (required <= level + NEAR_LEVELS) {
            near.push(action);
        }
    }
    // Any item can be enhanced or alchemised; a level below the item's only lowers the odds.
    const levelingList = skill === ENHANCING || skill === ALCHEMY;
    // Items you have always stay on the shortlist.
    const owned = (c) => (levelingOptions.owned?.(c.action.itemHrid) || 0) > 0 || c.action.hrid === levelingOptions.fixed?.hrid;
    if (skill === ENHANCING) doable.push(...shortlist(enhancingActions(data, market, levelingOptions.owned).map((action) => ({ action, evaluate: evaluator(action) })), owned));
    if (skill === ALCHEMY) doable.push(...shortlist(alchemyActions(data, market).map((action) => ({ action, evaluate: evaluator(action) })), owned));
    // The focus compares each action with the most gold and XP any action can
    // give with the best teas for it – not with the teas in your slots, or
    // following the advice would change the advice. The list is ranked against
    // every action in it; teas are picked against the action's own skill, so
    // they are the same whichever skill the list shows. With a plan, "the most"
    // is what the planned hours give within your coins (stock aside, so making
    // the item doesn't move the scale): an action your coins can't carry
    // doesn't set it.
    // Levels a day are small numbers; the floor only keeps an empty list from dividing by zero.
    const XP_FLOOR = countLevels ? 1e-6 : 1;
    const refs = { gold: 1, xp: XP_FLOOR };
    const skillRefs = {};
    const NO_STOCK = { inventory: 0, listed: 0, listings: [] };
    const fillOf = (r) => {
        if (!plan) return 1;
        if (r.action.function === ENHANCE_FUNCTION) return enhanceBudget(r, plan)?.fill ?? 1;
        return suggestCount(r, { ...plan, stock: NO_STOCK, book: null, price: plan.price?.(r.action) ?? null, liquidity: plan.liquidity?.(r.action) ?? null })?.fill ?? 1;
    };
    for (const { action, evaluate } of doable) {
        const own = (skillRefs[action.type] ||= { gold: 1, xp: XP_FLOOR, cost: Infinity });
        // Levelling: "gold" is the cheapest coins per XP, not the most gold a day.
        const gold = bestTeas(action, who, data, market, evaluate, leveling(action) ? (r) => -coinsPer(r, xpOf) : (r) => r.goldPerDay).result;
        const xp = bestTeas(action, who, data, market, evaluate, xpOf).result;
        const goldDay = gold.valid ? gold.goldPerDay * fillOf(gold) : 0;
        const xpDay = xp.valid ? xpOf({ ...xp, xpPerDay: xp.xpPerDay * fillOf(xp) }) : 0;
        for (const r of [refs, own]) {
            r.gold = Math.max(r.gold, goldDay);
            r.xp = Math.max(r.xp, xpDay);
            if (leveling(action)) r.cost = Math.min(r.cost, coinsPer(gold, xpOf));
        }
    }
    const scoreFor = (r) => (levelingList ? timeMoneyScore(goldWeight, r, xpOf) : focusScore(goldWeight, r, xpOf));
    const score = scoreFor(refs);
    const chain = chainBuilder(who, data, market, teaMode);
    const available = doable.map(({ action, evaluate }) => {
        const teaScore = scoreFor(skillRefs[action.type]);
        const current = evaluate(who.drinks[action.type] || [], teaScore);
        const best = bestTeas(action, who, data, market, evaluate, teaScore);
        const shown = teaMode === "best" ? best.result : current;
        const price = plan?.price?.(shown.action) ?? null;
        const liquidity = plan?.liquidity?.(shown.action) ?? null;
        // Alchemy's products (coins, essences) aren't stock you are already selling.
        const stock = action.function === ALCHEMY_FUNCTION ? NO_STOCK : plan?.stock(shown.action);
        const suggestion = plan ? suggestCount(shown, { ...plan, stock, book: plan.book(shown.action), price, liquidity }) : null;
        // Enhancing: what your coins carry.
        const budget = plan ? enhanceBudget(shown, plan) : null;
        // Ranked by what the planned hours give: a job your coins or your stock
        // keep short earns for only part of them.
        const fill = suggestion ? suggestion.fill : budget ? budget.fill : 1;
        const chained = chain(shown);
        const entry = {
            ...shown,
            teaMode,
            current,
            best,
            suggestion,
            budget,
            chain: chained,
            // A train that makes the materials too, when that pays at least as well as buying them.
            chainSuggestion: plan && chained && chained.profitPerHour >= shown.profitPerHour ? suggestChainCount(shown, chained, { ...plan, stock: plan.stock(shown.action), price, liquidity }) : null,
            score: score({ skill: shown.skill, valid: shown.valid, goldPerDay: shown.goldPerDay * fill, xpPerDay: shown.xpPerDay * fill }),
            levelsPerDay: countLevels ? levelProgress(who, data, true)(shown) : null,
            thinMargin: !!plan?.hideThinMargins && thinMargin(shown, price?.swing ?? null),
            teaSlots: who.slots[action.type],
            pouch: who.pouch,
            betterTeas: !sameTeas(best.result.teas, current.teas) && teaScore(best.result) > teaScore(current) + 1e-9,
        };
        if (plan) {
            // Teas for the suggested job; a gathering job runs for the hours planned.
            const runs = action.function === "/action_functions/gathering" || action.function === ENHANCE_FUNCTION;
            const hours = suggestion?.count ? suggestion.count / best.result.actionsPerHour : budget ? budget.hours : runs ? plan.hours : 0;
            entry.teaPlan = teaPurchase(entry, { hours, have: plan.have });
        }
        return entry;
    });
    // Thin margins (when the plan leaves them out) go last, after everything else that pays.
    available.sort((a, b) => b.valid - a.valid || a.thinMargin - b.thinMargin || b.score - a.score);

    // Fastest XP the skill earns today, for "how long until it unlocks".
    const fastestXp = {};
    for (const entry of available) fastestXp[entry.skill] = Math.max(fastestXp[entry.skill] || 0, entry.current.xpPerHour);
    const table = data.levelExperienceTable;
    const upcoming = near.map((action) => {
        const skillHrid = action.levelRequirement.skillHrid;
        const required = action.levelRequirement.level;
        const evaluate = evaluator(action, required);
        const atUnlock = teaMode === "best" ? bestTeas(action, who, data, market, evaluate).result : evaluate(who.drinks[action.type] || []);
        const have = who.experience[skillHrid];
        const needXp = Array.isArray(table) && have !== null && table[required] !== undefined ? Math.max(0, table[required] - have) : null;
        const hours = needXp !== null && fastestXp[skillHrid] > 0 ? needXp / fastestXp[skillHrid] : null;
        return { ...atUnlock, needLevels: required - (who.levels[skillHrid] ?? 1), needXp, hoursToUnlock: hours };
    });
    upcoming.sort((a, b) => a.needLevels - b.needLevels || b.goldPerDay - a.goldPerDay);
    return { available, upcoming };
}

