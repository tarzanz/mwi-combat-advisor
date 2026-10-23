// Gold and XP per day for gathering and production, worked out from the
// character's own levels, buffs and teas and priced on the market. The game
// rules (level efficiency, speed, the 3 s floor, 12 drinks an hour, the 4%
// market tax, tea effects) are the same ones MWITools uses.

export const SKILLING_SKILLS = ["milking", "foraging", "woodcutting", "cheesesmithing", "crafting", "tailoring", "cooking", "brewing"];

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
const DEFAULT_DRINK_SLOTS = 3;
export const NEAR_LEVELS = 10;
const HOURS_PER_DAY = 24;
// A product whose cheapest seller asks this many times the best bid is hard to sell at the ask.
const WIDE_SPREAD = 1.5;

const INVENTORY = "/item_locations/inventory";
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
    for (const skill of SKILLING_SKILLS) {
        const list = character.actionTypeDrinkSlotsMap?.[skillType(skill)];
        drinks[skillType(skill)] = (list || []).map((slot) => slot?.itemHrid).filter(Boolean);
        slots[skillType(skill)] = list?.length || DEFAULT_DRINK_SLOTS;
    }
    return { levels, experience, buffs, drinks, slots, concentration: drinkConcentration(character, items, data) };
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

function totals(buffs) {
    const sum = new Map();
    for (const buff of buffs) {
        const entry = sum.get(buff.typeHrid) || { flat: 0, ratio: 0 };
        entry.flat += Number(buff.flatBoost) || 0;
        entry.ratio += Number(buff.ratioBoost) || 0;
        sum.set(buff.typeHrid, entry);
    }
    return (type) => sum.get(type) || { flat: 0, ratio: 0 };
}

function teaBuffs(teas, concentration, data) {
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
export function marketPricer(entryOf, data, sellAt = "ask") {
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
            else if (sellAt === "ask" && ask) result = { price: ask * (1 - tax), ask, bid, source: "ask", note: bid ? (ask > WIDE_SPREAD * bid ? "spread" : null) : "nobids" };
            else if (bid) result = { price: bid * (1 - tax), ask, bid, source: "bid", note: sellAt === "ask" ? "noasks" : null };
            else if (ask) result = { price: ask * (1 - tax), ask, bid, source: "ask", note: "nobids" };
            else result = { price: vendor(hrid), ask, bid, source: "vendor", note: vendor(hrid) ? "vendor" : "unsellable" };
            if (result.source === "bag") result.price /= 10;
            cache.set(hrid, result);
            return result;
        },
    };
    return this_;
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
        outputs.push({ itemHrid, count, kind, price: sell.price, sell, value: count * sell.price });
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

// The market can only take so many of one crafted item a day: past the cap,
// the action runs only part of the day. Raw materials sell in bulk and aren't capped.
export function limitSales(result, sellCap) {
    const made = result.action.function === "/action_functions/production" ? result.mainCount * result.actionsPerHour : 0;
    const hoursPerDay = sellCap > 0 && made > 0 && made * HOURS_PER_DAY > sellCap ? sellCap / made : HOURS_PER_DAY;
    return { ...result, hoursPerDay, capped: hoursPerDay < HOURS_PER_DAY, goldPerDay: result.profitPerHour * hoursPerDay, xpPerDay: result.xpPerHour * hoursPerDay };
}

// The tea setup that scores best (gold a day by default), and what each of its teas adds.
export function bestTeas(action, who, data, market, evaluate, score = (r) => r.goldPerDay) {
    const type = action.type;
    const candidates = usableTeas(data, type).filter((hrid) => market.buy(hrid) !== null || (who.drinks[type] || []).includes(hrid));
    let best = null;
    for (const teas of teaSetups(data, type, who.slots[type], candidates)) {
        const result = evaluate(teas);
        if (!best || score(result) > score(best) + 1e-12) best = result;
    }
    const worth = best.teas.map((hrid) => {
        const without = evaluate(best.teas.filter((t) => t !== hrid));
        return { itemHrid: hrid, gainPerDay: best.goldPerDay - without.goldPerDay, xpPerDay: best.xpPerDay - without.xpPerDay };
    });
    return { result: best, worth };
}

// XP ↔ gold focus: each counts as a share of the most any action in the list gives.
function focusScore(goldWeight, refs) {
    return (r) => (goldWeight * r.goldPerDay) / refs.gold + ((1 - goldWeight) * r.xpPerDay) / refs.xp;
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

// How many to make: what the market takes over the planned days (your sales
// limit, or the buy orders that pay above break-even), less what you already
// hold or have listed, and no more than your coins buy materials for.
export function suggestCount(entry, { stock, book, sellCap = 0, days = 1, coins = Infinity, have = () => 0, minJobHours = 0, sellAt = "ask" }) {
    // Never longer than the days planned for, however big the market looks.
    if (entry.action.function !== "/action_functions/production" || !entry.valid || entry.profitPerHour <= 0 || !entry.mainCount) return null;
    const breakEven = breakEvenPrice(entry);
    const profitableBids = book ? book.bids.filter((o) => o.price >= breakEven).reduce((sum, o) => sum + o.quantity, 0) : null;
    // Listing at the ask: as many as others are selling at about that price.
    const asks = book && sellAt === "ask" ? othersNearLowestAsk(book, stock) : null;
    const fromCap = sellCap > 0 ? sellCap * days : null;
    const demand = Math.max(fromCap ?? 0, profitableBids ?? 0, asks?.quantity ?? 0);
    const result = { breakEven, profitableBids, nearAsks: asks?.quantity ?? null, lowestAsk: asks?.lowest ?? null, fromCap, bookAt: book?.at ?? null, stock, demand, known: fromCap !== null || profitableBids !== null };
    if (!result.known) return result;
    const units = Math.max(0, demand - stock.inventory - stock.listed);
    let count = Math.ceil(units / entry.mainCount - 1e-9);
    const longest = Math.floor(days * HOURS_PER_DAY * entry.actionsPerHour);
    const limitedByDays = count > longest;
    if (limitedByDays) count = longest;
    // Materials bought for n actions, using what is in the inventory first.
    const spend = (n) => entry.inputs.reduce((sum, input) => sum + Math.max(0, input.count * n - have(input.itemHrid)) * (input.price || 0), 0);
    let limitedByCoins = false;
    if (spend(count) > coins) {
        let low = 0;
        let high = count;
        while (low < high) {
            const mid = Math.ceil((low + high) / 2);
            if (spend(mid) <= coins) low = mid;
            else high = mid - 1;
        }
        count = low;
        limitedByCoins = true;
    }
    const hours = count / entry.actionsPerHour;
    return { ...result, units, count, hours, limitedByCoins, limitedByDays, days, short: minJobHours > 0 && hours < minJobHours };
}

const sameTeas = (a, b) => a.length === b.length && a.every((hrid) => b.includes(hrid));

// The Skilling tab: what the character can do now, ranked by gold, and what unlocks soon.
export function rankSkilling(who, data, market, { skill = "all", teaMode = "current", sellCap = 0, plan = null, goldWeight = 1 } = {}) {
    const evaluator = (action, level) => (teas) => limitSales(evaluateAction(action, who, data, market, teas, level), sellCap);
    const wanted = (action) => skill === "all" || action.type === skillType(skill);
    const doable = [];
    const near = [];
    for (const action of skillingActions(data)) {
        if (!wanted(action)) continue;
        const level = who.levels[action.levelRequirement.skillHrid] ?? 1;
        const required = action.levelRequirement.level;
        if (required <= level) {
            const evaluate = evaluator(action, level);
            doable.push({ action, evaluate, current: evaluate(who.drinks[action.type] || []) });
        } else if (required <= level + NEAR_LEVELS) {
            near.push(action);
        }
    }
    // The focus compares each action with the most gold and XP any of them gives with your teas.
    const refs = { gold: 1, xp: 1 };
    for (const { current } of doable) {
        if (!current.valid) continue;
        refs.gold = Math.max(refs.gold, current.goldPerDay);
        refs.xp = Math.max(refs.xp, current.xpPerDay);
    }
    const score = focusScore(goldWeight, refs);
    const available = doable.map(({ action, evaluate, current }) => {
        const best = bestTeas(action, who, data, market, evaluate, score);
        const shown = teaMode === "best" ? best.result : current;
        const suggestion = plan ? suggestCount(shown, { ...plan, stock: plan.stock(shown.action), book: plan.book(shown.action), sellCap }) : null;
        const entry = { ...shown, teaMode, current, best, suggestion, score: score(shown), betterTeas: !sameTeas(best.result.teas, current.teas) && score(best.result) > score(current) + 1e-9 };
        if (plan) {
            // Teas for the suggested job; a gathering job runs for the days planned.
            const hours = suggestion?.count ? suggestion.count / best.result.actionsPerHour : action.function === "/action_functions/gathering" ? plan.days * HOURS_PER_DAY : 0;
            entry.teaPlan = teaPurchase(entry, { hours, have: plan.have });
        }
        return entry;
    });
    // Jobs too short to be worth the trip to the market go last.
    available.sort((a, b) => b.valid - a.valid || !!a.suggestion?.short - !!b.suggestion?.short || b.score - a.score);

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

