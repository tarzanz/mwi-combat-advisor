// Skilling upgrades that pay back: tools, clothes, jewellery, charms, capes
// (also enhanced +N copies for sale) and the skill's house room. Each is
// tried in place of what you wear now, and measured by how much more the
// skill's best action earns a day; payback = price / extra gold a day.

import { evaluateAction, limitSales, skillType, skillingActions } from "./skilling.js";

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
    if (GATHERING_SKILLS.has(skill)) add("/buff_types/gathering", value("gatheringQuantity"));
    return { buffs, concentration: value("drinkConcentration") };
}

const negate = (buffs) => buffs.map((b) => ({ ...b, flatBoost: -b.flatBoost }));
const location = (itemHrid, data) => "/item_locations/" + (data.itemDetailMap[itemHrid]?.equipmentDetail?.type || "").split("/").pop();

// The skill's best action, gold and XP a day, with these buffs.
function bestDay(actions, who, data, market, sellCap) {
    let best = null;
    for (const action of actions) {
        const r = limitSales(evaluateAction(action, who, data, market), sellCap);
        if (r.valid && (!best || r.goldPerDay > best.goldPerDay)) best = r;
    }
    return best;
}

// equipped: location -> { itemHrid, enhancementLevel }; owned: itemHrid -> [enhancement levels in the inventory];
// listings: itemHrid -> [{ enhancementLevel, price }] for sale; houseLevels: houseRoomHrid -> level.
export function rankUpgrades(who, data, market, skill, { equipped, owned, listings, houseLevels, sellCap = 0, gameEquipmentBuffs = null }) {
    const type = skillType(skill);
    const actions = skillingActions(data).filter((a) => a.type === type && (who.levels[a.levelRequirement.skillHrid] ?? 1) >= a.levelRequirement.level);
    const base = bestDay(actions, who, data, market, sellCap);
    if (!base) return { base: null, upgrades: [], check: null };
    const withBuffs = (extra, concentration = 0) => ({
        ...who,
        buffs: { ...(who.buffs || {}), [type]: [...(who.buffs?.[type] || []), ...extra] },
        concentration: who.concentration + concentration,
    });
    const meets = (itemHrid) => (data.itemDetailMap[itemHrid]?.equipmentDetail?.levelRequirements || []).every((req) => (who.levels[req.skillHrid] ?? 0) >= req.level);

    const upgrades = [];
    for (const item of Object.values(data.itemDetailMap)) {
        const detail = item.equipmentDetail;
        if (!detail?.noncombatStats || !meets(item.hrid)) continue;
        if (!itemSkillBuffs(item.hrid, 0, skill, data).buffs.length && !detail.noncombatStats.drinkConcentration) continue;
        const slot = location(item.hrid, data);
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
            const after = bestDay(actions, withBuffs([...negate(old.buffs), ...next.buffs], next.concentration - old.concentration), data, market, sellCap);
            const gain = after.goldPerDay - base.goldPerDay;
            if (gain <= 1) continue;
            upgrades.push({
                kind: "item",
                itemHrid: item.hrid,
                enhancementLevel: offer.enhancementLevel,
                owned: !!offer.owned,
                price: offer.price,
                replaces: current,
                gainPerDay: gain,
                xpPerDay: after.xpPerDay - base.xpPerDay,
                paybackDays: offer.price / gain,
                bestAction: after.action,
            });
        }
    }

    // The skill's house room, one level up.
    const room = Object.values(data.houseRoomDetailMap || {}).find((r) => r.skillHrid === "/skills/" + skill);
    const level = room ? houseLevels[room.hrid] || 0 : MAX_HOUSE_LEVEL;
    if (room && level < MAX_HOUSE_LEVEL) {
        const step = [...(room.actionBuffs || []), ...(room.globalBuffs || [])].map((b) => ({ typeHrid: b.typeHrid, flatBoost: level === 0 ? b.flatBoost : b.flatBoostLevelBonus, ratioBoost: 0 }));
        const after = bestDay(actions, withBuffs(step), data, market, sellCap);
        const costs = room.upgradeCostsMap?.[String(level + 1)] || [];
        const priced = costs.map((c) => ({ itemHrid: c.itemHrid, count: c.count, price: market.buy(c.itemHrid) }));
        const price = priced.some((c) => c.price === null) ? null : priced.reduce((sum, c) => sum + c.count * c.price, 0);
        const gain = after.goldPerDay - base.goldPerDay;
        if (gain > 1) {
            upgrades.push({ kind: "house", roomHrid: room.hrid, name: room.name, level: level + 1, price, materials: priced, gainPerDay: gain, xpPerDay: after.xpPerDay - base.xpPerDay, paybackDays: price === null ? null : price / gain, bestAction: after.action });
        }
    }
    upgrades.sort((a, b) => (a.paybackDays ?? Infinity) - (b.paybackDays ?? Infinity));

    // How well the equipment stats match what the game says your gear gives (action speed).
    let check = null;
    if (gameEquipmentBuffs) {
        const game = (gameEquipmentBuffs[type] || []).filter((b) => b.typeHrid === "/buff_types/action_speed").reduce((sum, b) => sum + (b.flatBoost || 0) + (b.ratioBoost || 0), 0);
        const mine = Object.values(equipped).reduce((sum, e) => sum + itemSkillBuffs(e.itemHrid, e.enhancementLevel, skill, data).buffs.filter((b) => b.typeHrid === "/buff_types/action_speed").reduce((s, b) => s + b.flatBoost, 0), 0);
        check = { game, mine, matches: Math.abs(game - mine) < 0.005 };
    }
    return { base, upgrades, check };
}
