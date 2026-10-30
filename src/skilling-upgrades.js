// Skilling upgrades that pay back: tools, clothes, jewellery, charms, capes
// (also enhanced +N copies for sale) and the skill's house room. Each is
// tried in place of what you wear now, and measured by how much more the
// action you'd make earns a day (the top of the Skilling list, or the skill's
// best action); payback = what it costs, less what it sells for again at the
// bid, / extra gold a day. Enhancing and Alchemy mostly cost gold: there the
// XP an upgrade adds counts at the coins per XP of the top row (what that XP
// would cost you otherwise), so a charm that only adds XP pays back too.

import { MARKET_TAX, SKILLING_SKILLS, bestTeas, drinkSlots, daily, evaluateAction, skillType, skillingActions } from "./skilling.js";
import { ENHANCING, enhancingActions, evaluateEnhance } from "./enhancing.js";
import { ALCHEMY, alchemyActions, evaluateAlchemy } from "./alchemy.js";

const MAX_HOUSE_LEVEL = 8;
export const UPGRADES_SHOWN = 10;
const GATHERING_SKILLS = new Set(["milking", "foraging", "woodcutting"]);

// What an item's skilling stats do for one skill, as buffs, plus drink concentration.
export function itemSkillBuffs(itemHrid, enhancementLevel, skill, data) {
    const detail = data.itemDetailMap[itemHrid]?.equipmentDetail;
    const stats = detail?.noncombatStats || {};
    const bonuses = detail?.noncombatEnhancementBonuses || {};
    const multiplier = data.enhancementLevelTotalBonusMultiplierTable?.[enhancementLevel || 0] || 0;
    const value = (stat) => (stats[stat] || 0) + (bonuses[stat] || 0) * multiplier;
    const buffs = [];
    const add = (typeHrid, amount) => amount && buffs.push({ typeHrid, flatBoost: amount, ratioBoost: 0 });
    add("/buff_types/action_speed", value(skill + "Speed") + value("skillingSpeed"));
    add("/buff_types/efficiency", value(skill + "Efficiency") + value("skillingEfficiency"));
    add("/buff_types/wisdom", value(skill + "Experience") + value("skillingExperience"));
    add("/buff_types/rare_find", value(skill + "RareFind") + value("skillingRareFind"));
    add("/buff_types/essence_find", value(skill + "EssenceFind") + value("skillingEssenceFind"));
    add(`/buff_types/${skill}_success`, value(skill + "Success"));
    if (GATHERING_SKILLS.has(skill)) add("/buff_types/gathering", value("gatheringQuantity"));
    return { buffs, concentration: value("drinkConcentration") };
}

const negate = (buffs) => buffs.map((b) => ({ ...b, flatBoost: -b.flatBoost }));
const location = (itemHrid, data) => "/item_locations/" + (data.itemDetailMap[itemHrid]?.equipmentDetail?.type || "").split("/").pop();

// The skill's best action, gold and XP a day, with these buffs.
function bestDay(actions, who, data, market) {
    let best = null;
    for (const action of actions) {
        const r = daily(evaluateAction(action, who, data, market));
        if (r.valid && (!best || r.goldPerDay > best.goldPerDay)) best = r;
    }
    return best;
}

// The same with the best teas for its slots: a pouch with an extra slot only
// pays off with a tea to put in it, so both sides use the best setup.
function bestDayWithTeas(actions, who, data, market) {
    let best = null;
    for (const action of actions) {
        const evaluate = (teas) => daily(evaluateAction(action, who, data, market, teas));
        const r = bestTeas(action, who, data, market, evaluate).result;
        if (r.valid && (!best || r.goldPerDay > best.goldPerDay)) best = r;
    }
    return best;
}

// The skill's actions your levels allow – only actionHrid when given and allowed.
function skillActions(who, data, skill, actionHrid = null) {
    const type = skillType(skill);
    const actions = skillingActions(data).filter((a) => a.type === type && (who.levels[a.levelRequirement.skillHrid] ?? 1) >= a.levelRequirement.level);
    const chosen = actionHrid && actions.find((a) => a.hrid === actionHrid);
    return chosen ? [chosen] : actions;
}

// How a day of the skill is measured, with some buffs (day) or the best teas
// for its slots (dayWithTeas), and what a day is worth.
// Gathering and production: the gold a day of the skill's actions (or actionHrid).
// Enhancing and Alchemy: the item action actionHrid – the top row – with its
// target or catalyst picked again for the most worth; XP is worth xpPrice
// coins (the top row's coins per XP, none when it earns gold).
// leveling: { resale, owned, xpPrice } as for rankSkilling.
function measure(who, data, market, skill, actionHrid, leveling) {
    if (skill !== ENHANCING && skill !== ALCHEMY) {
        const actions = skillActions(who, data, skill, actionHrid);
        return { worth: (r) => r.goldPerDay, xpPrice: 0, day: (w) => bestDay(actions, w, data, market), dayWithTeas: (w) => bestDayWithTeas(actions, w, data, market) };
    }
    const enhancing = skill === ENHANCING;
    const action = actionHrid && (enhancing ? enhancingActions(data, market, leveling.owned) : alchemyActions(data, market)).find((a) => a.hrid === actionHrid);
    if (!action) return null;
    const evaluate = (w, teas, score) => (enhancing ? evaluateEnhance(action, w, data, market, teas, { resale: leveling.resale, owned: leveling.owned, score }) : evaluateAlchemy(action, w, data, market, teas, { score }));
    const plain = evaluate(who, who.drinks[action.type] || [], (r) => -(r.coinsPerXp ?? Infinity));
    const xpPrice = Math.max(0, leveling.xpPrice ?? plain.coinsPerXp ?? 0);
    const worth = (r) => r.goldPerDay + xpPrice * r.xpPerDay;
    const valid = (r) => (r.valid ? r : null);
    return {
        worth,
        xpPrice,
        day: (w) => valid(evaluate(w, w.drinks[action.type] || [], worth)),
        dayWithTeas: (w) => valid(bestTeas(action, w, data, market, (teas, score) => evaluate(w, teas, score), worth).result),
    };
}

// What an item brings back when sold again: the best bid for its +level after
// tax; with nobody buying that level, the bid at the nearest lower level (a +2
// is worth at least a +0, though it has to be listed to sell); else the vendor
// price. bidLevel: the level whose bid was used, null for the vendor price.
// bids(hrid): [{ enhancementLevel, bid }] for every level someone is buying.
function resaleValue(itemHrid, level, ownBid, data, bids = null) {
    if (ownBid > 0) return { value: ownBid * (1 - MARKET_TAX), bidLevel: level };
    const lower = (bids?.(itemHrid) || []).filter((b) => b.bid > 0 && b.enhancementLevel < level).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
    if (lower) return { value: lower.bid * (1 - MARKET_TAX), bidLevel: lower.enhancementLevel };
    return { value: data.itemDetailMap[itemHrid]?.sellPrice || 0, bidLevel: null };
}

// What wearing one item instead of another (or nothing) changes on the action
// you'd make (actionHrid, else the skill's best): gold and XP a day, with the teas you have now.
export function swapGain(who, data, market, skill, current, itemHrid, enhancementLevel = 0, actionHrid = null) {
    const type = skillType(skill);
    const actions = skillActions(who, data, skill, actionHrid);
    const base = bestDay(actions, who, data, market);
    if (!base) return null;
    const old = current ? itemSkillBuffs(current.itemHrid, current.enhancementLevel, skill, data) : { buffs: [], concentration: 0 };
    const next = itemSkillBuffs(itemHrid, enhancementLevel, skill, data);
    const after = bestDay(actions, { ...who, buffs: { ...(who.buffs || {}), [type]: [...(who.buffs?.[type] || []), ...negate(old.buffs), ...next.buffs] }, concentration: who.concentration + next.concentration - old.concentration }, data, market);
    return { gainPerDay: after.goldPerDay - base.goldPerDay, xpPerDay: after.xpPerDay - base.xpPerDay, bestAction: after.action };
}

// equipped: location -> { itemHrid, enhancementLevel }; owned: itemHrid -> [enhancement levels in the inventory];
// listings: itemHrid -> [{ enhancementLevel, price }] for sale; houseLevels: houseRoomHrid -> level.
// listings carry the bid for the level too; actionHrid: the action to measure on.
// leveling (Enhancing and Alchemy): { resale, owned, xpPrice }, see measure.
// gainPerDay is the worth a day gained: the gold, plus the XP at xpPrice.
export function rankUpgrades(who, data, market, skill, { equipped, owned, listings, bids = null, houseLevels, gameEquipmentBuffs = null, actionHrid = null, leveling = {} }) {
    const type = skillType(skill);
    const m = measure(who, data, market, skill, actionHrid, leveling);
    const base = m?.day(who);
    if (!base) return { base: null, upgrades: [], check: null };
    const { worth, xpPrice } = m;
    const withBuffs = (extra, concentration = 0, slots = who.slots[type]) => ({
        ...who,
        buffs: { ...(who.buffs || {}), [type]: [...(who.buffs?.[type] || []), ...extra] },
        concentration: who.concentration + concentration,
        slots: { ...who.slots, [type]: slots },
    });
    const POUCH_SLOT = "/item_locations/pouch";
    let teaBase = null; // the best-tea day with today's slots, worked out when a pouch needs it
    const meets = (itemHrid) => (data.itemDetailMap[itemHrid]?.equipmentDetail?.levelRequirements || []).every((req) => (who.levels[req.skillHrid] ?? 0) >= req.level);

    const upgrades = [];
    for (const item of Object.values(data.itemDetailMap)) {
        const detail = item.equipmentDetail;
        if (!detail?.noncombatStats || !meets(item.hrid)) continue;
        const slot = location(item.hrid, data);
        const slotsAfter = slot === POUCH_SLOT ? drinkSlots(item.hrid, data) : who.slots[type];
        const moreSlots = slotsAfter > who.slots[type];
        if (!itemSkillBuffs(item.hrid, 0, skill, data).buffs.length && !detail.noncombatStats.drinkConcentration && !moreSlots) continue;
        const current = equipped[slot] || null;
        const old = current ? itemSkillBuffs(current.itemHrid, current.enhancementLevel, skill, data) : { buffs: [], concentration: 0 };
        const offers = [...(owned[item.hrid] || []).map((level) => ({ enhancementLevel: level, price: 0, owned: true })), ...(listings(item.hrid) || [])];
        const seen = new Set();
        for (const offer of offers) {
            const key = offer.enhancementLevel;
            if (seen.has(key)) continue; // owned first, then the cheapest listing
            seen.add(key);
            if (current && current.itemHrid === item.hrid && current.enhancementLevel >= offer.enhancementLevel) continue;
            const next = itemSkillBuffs(item.hrid, offer.enhancementLevel, skill, data);
            const changed = withBuffs([...negate(old.buffs), ...next.buffs], next.concentration - old.concentration, Math.max(slotsAfter, who.drinks[type]?.length || 0));
            let after;
            let from = base;
            if (slotsAfter !== who.slots[type]) {
                teaBase ||= m.dayWithTeas(who);
                from = teaBase;
                after = m.dayWithTeas(changed);
            } else after = m.day(changed);
            if (!after || !from) continue;
            const gain = worth(after) - worth(from);
            if (gain <= 1) continue;
            const sold = offer.owned ? { value: 0, bidLevel: null } : resaleValue(item.hrid, offer.enhancementLevel, offer.bid, data, bids);
            const resale = sold.value;
            const cost = Math.max(0, offer.price - resale);
            upgrades.push({
                kind: "item",
                itemHrid: item.hrid,
                enhancementLevel: offer.enhancementLevel,
                owned: !!offer.owned,
                price: offer.price,
                resale,
                resaleLevel: sold.bidLevel,
                cost,
                replaces: current,
                gainPerDay: gain,
                goldPerDay: after.goldPerDay - from.goldPerDay,
                xpPerDay: after.xpPerDay - from.xpPerDay,
                paybackDays: cost / gain,
                bestAction: after.action,
                target: after.target ?? null,
                extraSlots: slotsAfter - who.slots[type],
                teas: slotsAfter !== who.slots[type] ? after.teas : null,
            });
        }
    }

    // The skill's house room, one level up.
    const room = Object.values(data.houseRoomDetailMap || {}).find((r) => r.skillHrid === "/skills/" + skill);
    const level = room ? houseLevels[room.hrid] || 0 : MAX_HOUSE_LEVEL;
    if (room && level < MAX_HOUSE_LEVEL) {
        // The Observatory's success is a ratio; the rest flat.
        const step = [...(room.actionBuffs || []), ...(room.globalBuffs || [])].map((b) => ({ typeHrid: b.typeHrid, flatBoost: (level === 0 ? b.flatBoost : b.flatBoostLevelBonus) || 0, ratioBoost: (level === 0 ? b.ratioBoost : b.ratioBoostLevelBonus) || 0 }));
        const after = m.day(withBuffs(step));
        const costs = room.upgradeCostsMap?.[String(level + 1)] || [];
        const priced = costs.map((c) => ({ itemHrid: c.itemHrid, count: c.count, price: market.buy(c.itemHrid) }));
        const price = priced.some((c) => c.price === null) ? null : priced.reduce((sum, c) => sum + c.count * c.price, 0);
        const gain = after ? worth(after) - worth(base) : 0;
        if (gain > 1) {
            upgrades.push({ kind: "house", roomHrid: room.hrid, name: room.name, level: level + 1, price, materials: priced, gainPerDay: gain, goldPerDay: after.goldPerDay - base.goldPerDay, xpPerDay: after.xpPerDay - base.xpPerDay, paybackDays: price === null ? null : price / gain, bestAction: after.action, target: after.target ?? null });
        }
    }
    // Each +level against the next lower one of the same item on offer: what the step costs and adds.
    for (const u of upgrades) {
        if (u.kind !== "item") continue;
        const lower = upgrades.filter((o) => o.kind === "item" && o.itemHrid === u.itemHrid && o.enhancementLevel < u.enhancementLevel).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
        if (!lower) continue;
        const gain = u.gainPerDay - lower.gainPerDay;
        const cost = u.cost - lower.cost;
        u.step = { from: lower.enhancementLevel, price: u.price - lower.price, cost, gainPerDay: gain, paybackDays: gain > 1 ? Math.max(0, cost) / gain : null };
    }
    upgrades.sort((a, b) => (a.paybackDays ?? Infinity) - (b.paybackDays ?? Infinity));

    // How well the equipment stats match what the game says your gear gives (action speed).
    let check = null;
    if (gameEquipmentBuffs) {
        const game = (gameEquipmentBuffs[type] || []).filter((b) => b.typeHrid === "/buff_types/action_speed").reduce((sum, b) => sum + (b.flatBoost || 0) + (b.ratioBoost || 0), 0);
        const mine = Object.values(equipped).reduce((sum, e) => sum + itemSkillBuffs(e.itemHrid, e.enhancementLevel, skill, data).buffs.filter((b) => b.typeHrid === "/buff_types/action_speed").reduce((s, b) => s + b.flatBoost, 0), 0);
        check = { game, mine, matches: Math.abs(game - mine) < 0.005 };
    }
    return { base, upgrades, check, xpPrice };
}

// Tools whose next tier your skill level now allows: for every tool slot, the
// highest-tier tool you can use, when it is above the one you wear. Gold and XP
// a day for the gathering and production skills; price from the cheapest ask.
// equipped: location -> { itemHrid, enhancementLevel }; owned: itemHrid -> [levels].
// actionFor(skill): the action to measure a skill on (the top of its Skilling list), or null for its best.
export function toolTiers(who, data, market, { equipped, owned, actionFor = () => null }) {
    const tiers = new Map(); // tool type -> [{ itemHrid, skillHrid, level }]
    for (const item of Object.values(data.itemDetailMap)) {
        const detail = item.equipmentDetail;
        const req = detail?.levelRequirements?.[0];
        if (!detail || !/_tool$/.test(detail.type) || !req) continue;
        if (!tiers.has(detail.type)) tiers.set(detail.type, []);
        tiers.get(detail.type).push({ itemHrid: item.hrid, skillHrid: req.skillHrid, level: req.level });
    }
    const notices = [];
    for (const [type, tools] of tiers) {
        const slot = location(tools[0].itemHrid, data);
        const current = equipped[slot] || null;
        const meets = (tool) => (data.itemDetailMap[tool.itemHrid].equipmentDetail.levelRequirements || []).every((r) => (who.levels[r.skillHrid] ?? 0) >= r.level);
        const best = tools.filter(meets).sort((a, b) => b.level - a.level)[0];
        const wearing = current ? tools.find((tool) => tool.itemHrid === current.itemHrid) : null;
        if (!best || (wearing && wearing.level >= best.level)) continue;
        const skill = best.skillHrid.split("/").pop();
        const gain = SKILLING_SKILLS.includes(skill) ? swapGain(who, data, market, skill, current, best.itemHrid, 0, actionFor(skill)) : null;
        const isOwned = !!owned[best.itemHrid]?.length;
        const price = isOwned ? 0 : market.buy(best.itemHrid);
        const resale = isOwned ? 0 : resaleValue(best.itemHrid, 0, market.sell(best.itemHrid).bid, data).value;
        notices.push({
            type,
            skill,
            skillLevel: who.levels[best.skillHrid] ?? 0,
            current,
            itemHrid: best.itemHrid,
            level: best.level,
            owned: isOwned,
            price,
            gainPerDay: gain?.gainPerDay ?? null,
            xpPerDay: gain?.xpPerDay ?? null,
            paybackDays: gain && gain.gainPerDay > 1 && price !== null ? Math.max(0, price - resale) / gain.gainPerDay : null,
        });
    }
    return notices.sort((a, b) => a.skill.localeCompare(b.skill));
}
