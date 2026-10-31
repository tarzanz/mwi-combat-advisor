// The actual advice: which zone to fight in and which purchases help most.

import { askPrice, combatZones, expectedLootPerKill, getClientData, marketBids, marketEntry, marketListings, sellValue } from "./game-data.js";
import { confidenceGreater } from "./stats.js";
import { COMBAT_SKILLS, GEAR_TYPES, cloneProfile, equip, meetsRequirements, slotCounts, styleOfItem, toDTO, weaponOf, weaponStyle } from "./profile.js";
import { experienceOf, levelsPerHour } from "./levels.js";
import { resaleValue } from "./skilling-upgrades.js";
import { MAX_TARGET } from "./enhancing.js";

// Many short runs (each with its own random seed) rather than a few long ones: the
// same total time, but the spread between runs tells how sure a result is.
export const ACCURACY = {
    fast: { label: "Fast", hours: 1, seeds: 3 },
    normal: { label: "Normal", hours: 2, seeds: 4 },
    thorough: { label: "Thorough", hours: 4, seeds: 6 },
};

// A suggestion goes on the shopping list only if we are this sure it is an improvement.
export const CONFIDENCE_LEVEL = 0.9;
// Uncertain suggestions get extra runs, up to this many times the normal number of seeds.
const MAX_SEED_FACTOR = 3;
// Every suggestion is compared with the current setup, so that one gets extra runs up front.
const BASE_SEED_FACTOR = 3;
const MAX_REFINED = 40;
// With many suggestions tested at once, some useless ones pass 90% by luck. Everything
// promising below 99% gets fresh runs, so lucky ones fall back before they are trusted.
const REFINE_BELOW = 0.99;

const seedFor = (index) => (Math.imul(index + 1, 2654435761) >>> 1) || 1;

// How much a purchase must give back: % more XP/h per 1M coins spent.
export const SPENDING = {
    frugal: { label: "Frugal", minPctPerMillion: 10 },
    balanced: { label: "Balanced", minPctPerMillion: 3 },
    all: { label: "All in", minPctPerMillion: 0 },
};

// Offensive stats that only help one style; a piece whose only bonuses belong
// to other styles isn't worth simulating. Defensive stats help everyone.
const STYLE_STATS = {
    melee: ["stabAccuracy", "slashAccuracy", "smashAccuracy", "stabDamage", "slashDamage", "smashDamage", "meleeExperience", "defensiveDamage"],
    ranged: ["rangedAccuracy", "rangedDamage", "rangedExperience"],
    magic: ["magicAccuracy", "magicDamage", "magicExperience"],
};
const PHYSICAL_STATS = ["physicalAmplify", "armorPenetration"];

function offStyleStats(style) {
    const own = new Set([...STYLE_STATS[style], ...(style === "magic" ? [] : PHYSICAL_STATS)]);
    return new Set([...Object.values(STYLE_STATS).flat(), ...PHYSICAL_STATS].filter((stat) => !own.has(stat)));
}

// ---------- the goal: a mix of XP and gold ----------
//
// XP/h and profit/h (loot minus food/drink cost) are both measured against a
// reference – the current setup, or the best zone – so 0.01 always means "1% of
// the reference". goldWeight 0 = only XP counts, 1 = only profit counts.
// Running costs are inside profit, so expensive drinks lose value as gold
// weight goes up without any special handling.

const MIN_GOLD_REF = 1000; // coins/h; keeps tiny loot values from blowing up the scale

// Combat XP/h, or with "count levels" the total levels it gives an hour.
export function xpValue(result, settings) {
    return settings?.countLevels && result.levels !== null && result.levels !== undefined ? result.levels : result.xpTotal;
}

export function makeGoal(settings, reference) {
    return {
        countLevels: !!settings.countLevels,
        gold: Math.min(1, Math.max(0, Number(settings.goldWeight) || 0)),
        xpRef: Math.max(settings.countLevels ? 1e-6 : 1, reference.xp),
        goldRef: Math.max(MIN_GOLD_REF, reference.gold),
    };
}

export function score(result, goal) {
    return ((1 - goal.gold) * xpValue(result, goal)) / goal.xpRef + (goal.gold * result.profit) / goal.goldRef;
}

// Deaths per hour you accept. A death costs 150 s of waiting, which is already part
// of XP/h, so a rare death can be worth it in a zone that gives more per kill.
export const RARE_DEATHS_PER_HOUR = 0.5;

export function deathLimit(settings) {
    return settings.acceptRareDeaths ? RARE_DEATHS_PER_HOUR : 0;
}

const acceptable = (result, settings) => result.deaths <= deathLimit(settings);

// Zones are compared against the best acceptable zone on each axis.
export function zoneGoal(zoneResults, settings) {
    const safe = zoneResults.filter((z) => acceptable(z.result, settings));
    const pool = safe.length ? safe : zoneResults;
    return makeGoal(settings, {
        xp: Math.max(...pool.map((z) => xpValue(z.result, settings))),
        gold: Math.max(...pool.map((z) => z.result.loot)),
    });
}

function consumableCost(result) {
    let cost = 0;
    for (const [hrid, perHour] of Object.entries(result.consumables)) cost += perHour * (askPrice(hrid) ?? sellValue(hrid));
    return cost;
}

function lootValue(result, tier) {
    let value = 0;
    for (const [monster, perHour] of Object.entries(result.kills)) value += perHour * expectedLootPerKill(monster, tier, result);
    return value;
}

function average(results) {
    const n = results.length;
    const mean = (pick) => results.reduce((sum, r) => sum + pick(r), 0) / n;
    const meanMap = (pick) => {
        const out = {};
        for (const r of results) for (const [k, v] of Object.entries(pick(r))) out[k] = (out[k] || 0) + v / n;
        return out;
    };
    return {
        ...results[0],
        xp: meanMap((r) => r.xp),
        xpTotal: mean((r) => r.xpTotal),
        deaths: mean((r) => r.deaths),
        encounters: mean((r) => r.encounters),
        kills: meanMap((r) => r.kills),
        consumables: meanMap((r) => r.consumables),
        manaUsed: meanMap((r) => r.manaUsed),
    };
}

// The engine spawns the next encounter 3 s after the last one dies, so no setup can
// have more than 1200 encounters per hour. Close to that, you kill faster than
// monsters appear and more damage barely helps – a harder zone or tier does.
const ENEMY_RESPAWN_SECONDS = 3;
export const MAX_ENCOUNTERS_PER_HOUR = 3600 / ENEMY_RESPAWN_SECONDS;

export function isSpawnCapped(result) {
    return result.encounters >= 0.85 * MAX_ENCOUNTERS_PER_HOUR;
}

// Levels an hour the XP gives, from where each combat skill is now (null without the level table).
function combatLevelsPerHour(result, profile) {
    const table = getClientData()?.levelExperienceTable;
    if (!Array.isArray(table) || !profile) return null;
    const skills = {};
    for (const [skill, level] of Object.entries(profile.levels)) skills[skill] = { level, xp: profile.allExperience?.["/skills/" + skill] ?? null };
    return levelsPerHour(table, skills, result.xp);
}

function enrich(result, tier, profile) {
    const loot = lootValue(result, tier);
    const cost = consumableCost(result);
    return { ...result, loot, cost, profit: loot - cost, levels: combatLevelsPerHour(result, profile), killsTotal: Object.values(result.kills).reduce((a, b) => a + b, 0) };
}

// Simulates each { profile, seeds } item; every run is tagged with its seed index.
// Runs of different setups are compared as independent samples: the random streams
// part ways within a few attacks, so pairing by seed would only share one run's luck
// (say, a rare death in the base) with every suggestion.
async function simulateRuns(pool, items, zone, hours, onProgress) {
    const data = getClientData();
    const jobs = [];
    for (const item of items) {
        const player = toDTO(item.profile, data);
        for (const seed of item.seeds) {
            jobs.push({ player, zoneHrid: zone.zoneHrid, tier: zone.tier, hours, seed: seedFor(seed), extraBuffs: item.profile.extraBuffs });
        }
    }
    const results = await pool.runAll(jobs, onProgress);
    let next = 0;
    return items.map((item) => item.seeds.map((seed) => ({ ...enrich(results[next++], zone.tier, item.profile), seed })));
}

const summarize = (runs, tier, profile) => enrich(average(runs), tier, profile);

async function simulateVariants(pool, variants, zone, settings, onProgress) {
    const seeds = Array.from({ length: settings.seeds }, (_, i) => i);
    const runs = await simulateRuns(pool, variants.map((v) => ({ profile: v.profile, seeds })), zone, settings.hours, onProgress);
    return variants.map((variant, i) => ({ ...variant, result: summarize(runs[i], zone.tier, variant.profile), runs: runs[i] }));
}

export async function analyzeZones(pool, profile, settings, onProgress) {
    const variants = [];
    for (const zone of combatZones()) {
        for (let tier = 0; tier <= Math.min(settings.maxTier, zone.maxDifficulty ?? 0); tier++) {
            variants.push({ zone: { zoneHrid: zone.hrid, tier } });
        }
    }
    const data = getClientData();
    const player = toDTO(profile, data);
    const hours = Math.max(1, settings.hours / 2);
    const jobs = variants.map((v) => ({ player, zoneHrid: v.zone.zoneHrid, tier: v.zone.tier, hours, seed: seedFor(0), extraBuffs: profile.extraBuffs }));
    const results = await pool.runAll(jobs, onProgress);
    return variants.map((v, i) => ({ ...v, result: enrich(results[i], v.zone.tier, profile) }));
}

export function pickBestZone(zoneResults, settings) {
    if (!zoneResults?.length) return null;
    const goal = zoneGoal(zoneResults, settings);
    const sorted = [...zoneResults].sort((a, b) => score(b.result, goal) - score(a.result, goal));
    return sorted.find((z) => acceptable(z.result, settings)) || sorted[0];
}

// ---------- candidates ----------

// Fighting with another style starts from a weapon for it that trains the style's
// own skill: the best one you own, else the cheapest you can wear on the market.
// Better weapons of the style are then tested like any other upgrade.
export function switchStyle(profile, style, budget) {
    const data = getClientData();
    if (!style || style === weaponStyle(profile, data)) return { profile, starter: null };
    const fits = (item) =>
        styleOfItem(item) === style &&
        item.equipmentDetail.combatStats.primaryTraining === "/skills/" + style &&
        meetsRequirements(profile, item.equipmentDetail.levelRequirements);
    const weapons = new Map(Object.values(data.itemDetailMap).filter(fits).map((item) => [item.hrid, item]));
    const owned = profile.inventory
        .filter((i) => weapons.has(i.hrid))
        .sort((a, b) => (weapons.get(b.hrid).itemLevel || 0) - (weapons.get(a.hrid).itemLevel || 0) || b.enhancementLevel - a.enhancementLevel)[0];
    let starter = null;
    if (owned) {
        starter = { hrid: owned.hrid, enhancementLevel: owned.enhancementLevel, cost: 0, owned: true };
    } else {
        for (const item of weapons.values()) {
            const price = askPrice(item.hrid, 0);
            if (price === null || price > budget) continue;
            if (!starter || price < starter.cost) starter = { hrid: item.hrid, enhancementLevel: 0, cost: price, owned: false };
        }
    }
    if (!starter) return { profile, starter: null, missing: style };
    const variant = cloneProfile(profile);
    starter.slot = data.itemDetailMap[starter.hrid].equipmentDetail.type.split("/").pop();
    starter.replaces = weaponOf(profile);
    equip(variant, starter.slot, { hrid: starter.hrid, enhancementLevel: starter.enhancementLevel });
    // A shield or book in the off hand stays; a two-handed weapon takes both hands.
    return { profile: variant, starter };
}

function isUsefulFor(style, stats) {
    const offStyle = offStyleStats(style);
    return Object.entries(stats || {}).some(([key, value]) => typeof value === "number" && value > 0 && !offStyle.has(key) && key !== "attackInterval");
}

// The gear an upgrade in this slot takes off: a two-handed weapon both hands.
// Fighting as another style, the weapon is the starter (not bought yet) and the
// one you have is kept, so neither is sold.
function displaced(profile, type, starter) {
    const slots = type === "two_hand" ? ["two_hand", "main_hand", "off_hand"] : type === "main_hand" ? ["main_hand", "two_hand"] : [type];
    return slots.filter((slot) => profile.equipment[slot] && !(starter && (slot === "main_hand" || slot === "two_hand"))).map((slot) => profile.equipment[slot]);
}

// What gear you take off brings back: the best bid at its +level after tax (a
// lower level's bid with nobody buying that level), else the vendor price.
function resaleOf(gear, data) {
    const bid = marketEntry(gear.hrid, gear.enhancementLevel)?.b;
    return resaleValue(gear.hrid, gear.enhancementLevel, bid > 0 ? bid : null, data, marketBids).value;
}

// settings: { budget, starter, enhanceCost } – see gearOptions for enhanceCost.
function gearCandidates(profile, settings) {
    const { budget, starter = null, enhanceCost = null } = settings;
    const data = getClientData();
    const style = weaponStyle(profile, data);
    const candidates = [];
    for (const item of Object.values(data.itemDetailMap)) {
        const detail = item.equipmentDetail;
        if (!detail) continue;
        const type = detail.type?.split("/").pop();
        if (!GEAR_TYPES.includes(type)) continue;
        if (!meetsRequirements(profile, detail.levelRequirements)) continue;
        const stats = detail.combatStats || {};
        const weapon = type === "main_hand" || type === "two_hand";
        if (weapon) {
            if (styleOfItem(item) !== style) continue;
        } else if (!isUsefulFor(style, stats)) {
            continue;
        }
        if (type === "off_hand" && profile.equipment.two_hand) continue;

        const current = profile.equipment[type];
        // The copy you wear can be enhanced further – not a starter weapon you haven't bought.
        const worn = current?.hrid === item.hrid && !(starter && weapon) ? current : null;
        const taken = displaced(profile, type, starter);
        const resale = taken.reduce((sum, gear) => sum + resaleOf(gear, data), 0);
        let options = gearOptions(profile, item.hrid, budget, { worn, enhanceCost, resale });
        if (type === "pouch") options = options.slice(0, 1); // enhancing a pouch adds little; keep the sim count down
        for (const option of options) {
            if (current && current.hrid === item.hrid && current.enhancementLevel >= option.enhancementLevel) continue;
            const gear = { hrid: item.hrid, enhancementLevel: option.enhancementLevel };
            const variant = cloneProfile(profile);
            equip(variant, type, gear);
            // A pouch with fewer slots would only "help" by dropping a consumable you use;
            // that is offered honestly as "stop using X" instead.
            if (type === "pouch") {
                const before = slotCounts(profile, data);
                const after = slotCounts(variant, data);
                if (after.food < before.food || after.drinks < before.drinks) continue;
            }
            const candidate = {
                kind: "gear",
                slot: type,
                hrid: item.hrid,
                enhancementLevel: option.enhancementLevel,
                price: option.price,
                resale: option.resale,
                sold: option.resale ? taken : [],
                cost: option.cost,
                owned: option.owned,
                enhance: option.enhance || null,
                replaces: current || null,
                profile: variant,
            };
            candidates.push(candidate);

            // A bigger pouch is only useful with something in the new food slot, so try each food there.
            const foodSlotsNow = slotCounts(profile, data).food;
            if (type === "pouch" && slotCounts(variant, data).food > foodSlotsNow) {
                for (const food of combatConsumables("food")) {
                    if (profile.food.includes(food)) continue;
                    const withFood = cloneProfile(variant);
                    while (withFood.food.length <= foodSlotsNow) withFood.food.push(null);
                    withFood.food[foodSlotsNow] = food;
                    candidates.push({ ...candidate, extraFood: food, extraFoodSlot: foodSlotsNow, profile: withFood });
                }
            }
        }
    }
    return candidates;
}

// The copies of an item worth testing, each +level at its cheapest: the best
// one you own (free), market listings and – with enhanceCost – enhancing it
// yourself from the copy you wear (worn) or own, or from a +0 bought at the
// ask. Of those, the levels where a higher level also costs more (a +5 that is
// cheaper than a +3 makes the +3 pointless); at most MAX_LEVELS of them.
// Each option has its price and its cost: the price less the resale of what
// it replaces (sold), which counts against the budget; enhancing the copy you
// wear sells nothing.
// enhanceCost(hrid, starts) -> lookup(start, target) -> { cost, … } | null (see selfEnhanceCosts).
const MAX_LEVELS = 5;

function gearOptions(profile, hrid, budget, { worn = null, enhanceCost = null, resale = 0 } = {}) {
    const owned = profile.inventory.filter((i) => i.hrid === hrid).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
    const options = owned ? [{ enhancementLevel: owned.enhancementLevel, price: 0, resale, cost: 0, owned: true }] : [];
    const cheapest = new Map(); // +level -> cheapest offer
    const offer = (o) => {
        o.price = o.cost;
        o.resale = o.enhance?.start === "worn" ? 0 : resale;
        o.cost = Math.max(0, o.price - o.resale);
        if (o.cost > budget || (owned && o.enhancementLevel <= owned.enhancementLevel)) return;
        const known = cheapest.get(o.enhancementLevel);
        if (!known || o.cost < known.cost) cheapest.set(o.enhancementLevel, o);
    };
    for (const listing of marketListings(hrid)) offer({ enhancementLevel: listing.enhancementLevel, cost: listing.price, owned: false });
    if (enhanceCost) {
        const starts = [];
        if (worn) starts.push({ from: worn.enhancementLevel, base: 0, start: "worn" });
        if (owned) starts.push({ from: owned.enhancementLevel, base: 0, start: "owned" });
        const ask = askPrice(hrid, 0);
        if (ask !== null) starts.push({ from: 0, base: ask, start: "buy" });
        const lookup = starts.length ? enhanceCost(hrid, starts.map((s) => s.from)) : null;
        for (let target = 1; lookup && target <= MAX_TARGET; target++) {
            for (const s of starts) {
                const made = s.from < target ? lookup(s.from, target) : null;
                if (made) offer({ enhancementLevel: target, cost: s.base + made.cost, owned: false, enhance: { ...made, from: s.from, start: s.start, basePrice: s.base } });
            }
        }
    }
    const front = [];
    for (const o of [...cheapest.values()].sort((a, b) => a.cost - b.cost || b.enhancementLevel - a.enhancementLevel)) {
        if (front.length && o.enhancementLevel <= front[front.length - 1].enhancementLevel) continue;
        front.push(o);
    }
    let picked = front;
    if (front.length > MAX_LEVELS) {
        const step = (front.length - 1) / (MAX_LEVELS - 1);
        picked = Array.from({ length: MAX_LEVELS }, (_, i) => front[Math.round(i * step)]);
    }
    return [...options, ...picked];
}

function combatConsumables(kind) {
    const category = kind === "food" ? "/item_categories/food" : "/item_categories/drink";
    return Object.values(getClientData().itemDetailMap)
        .filter((item) => item.categoryHrid === category && item.consumableDetail?.usableInActionTypeMap?.["/action_types/combat"])
        .filter((item) => askPrice(item.hrid, 0) !== null)
        .map((item) => item.hrid);
}

function abilityCandidates(profile, budget) {
    const data = getClientData();
    const slots = slotCounts(profile, data);
    if (slots.abilities === 0) return [];
    const books = {};
    for (const item of Object.values(data.itemDetailMap)) {
        if (item.abilityBookDetail) books[item.abilityBookDetail.abilityHrid] = item;
    }
    const equipped = new Set(profile.abilities.filter(Boolean).map((a) => a.hrid));
    const indices = [];
    for (let i = 1; i <= slots.abilities; i++) indices.push(i);
    const empty = indices.filter((i) => !profile.abilities[i]);
    const placements = empty.length ? [empty[0]] : indices;

    const candidates = [];
    for (const ability of Object.values(data.abilityDetailMap)) {
        if (ability.isSpecialAbility || equipped.has(ability.hrid)) continue;
        let level = profile.learnedAbilities[ability.hrid];
        let cost = 0;
        const book = books[ability.hrid];
        if (!level) {
            if (!book || !meetsRequirements(profile, book.abilityBookDetail.levelRequirements)) continue;
            const price = askPrice(book.hrid, 0);
            if (price === null || price > budget) continue;
            level = 1;
            cost = price;
        }
        for (const index of placements) {
            const variant = cloneProfile(profile);
            variant.abilities[index] = { hrid: ability.hrid, level };
            candidates.push({
                kind: "ability",
                slot: "ability" + index,
                hrid: ability.hrid,
                bookHrid: book?.hrid,
                level,
                cost,
                owned: cost === 0,
                replaces: profile.abilities[index]?.hrid || null,
                profile: variant,
            });
        }
    }
    return [...candidates, ...abilityLevelCandidates(profile, budget, books)];
}

// Reading more copies of an ability's book levels it up. Books needed come from
// the game's level table and the XP each book gives.
const LEVEL_STEPS = [1, 2, 3, 5, 10, 20];

function abilityLevelCandidates(profile, budget, books) {
    const data = getClientData();
    const table = data.levelExperienceTable;
    if (!table) return [];
    const slots = slotCounts(profile, data);
    const candidates = [];
    profile.abilities.forEach((entry, index) => {
        if (!entry || (index === 0 ? !slots.special : index > slots.abilities)) return;
        const book = books[entry.hrid];
        const xpPerBook = book?.abilityBookDetail?.experienceGain;
        const price = book && askPrice(book.hrid, 0);
        if (!xpPerBook || !price) return;
        const xpNow = profile.abilityExperience[entry.hrid] ?? table[entry.level] ?? 0;
        for (const step of LEVEL_STEPS) {
            const target = entry.level + step;
            if (table[target] === undefined) break;
            const count = Math.max(1, Math.ceil((table[target] - xpNow) / xpPerBook));
            if (count * price > budget) break;
            const variant = cloneProfile(profile);
            variant.abilities[index] = { hrid: entry.hrid, level: target };
            candidates.push({
                kind: "abilityLevel",
                slot: "ability" + index,
                hrid: entry.hrid,
                bookHrid: book.hrid,
                fromLevel: entry.level,
                level: target,
                books: count,
                cost: count * price,
                owned: false,
                replaces: null,
                profile: variant,
            });
        }
    });
    return candidates;
}

function consumableCandidates(profile, kind) {
    const data = getClientData();
    const slots = slotCounts(profile, data);
    const count = kind === "food" ? slots.food : slots.drinks;
    const current = (kind === "food" ? profile.food : profile.drinks).slice(0, count);
    while (current.length < count) current.push(null);
    const empty = current.findIndex((h) => !h);
    const placements = empty !== -1 ? [empty] : current.map((_, i) => i);

    const candidates = [];
    for (const hrid of combatConsumables(kind)) {
        if (current.includes(hrid)) continue;
        for (const index of placements) {
            const variant = cloneProfile(profile);
            const list = kind === "food" ? variant.food : variant.drinks;
            while (list.length < count) list.push(null);
            list[index] = hrid;
            candidates.push({ kind, slot: kind + index, hrid, cost: 0, replaces: current[index] || null, profile: variant });
        }
    }
    // Stopping a consumable saves its cost; worth it when the focus leans towards gold.
    current.forEach((hrid, index) => {
        if (!hrid) return;
        const variant = cloneProfile(profile);
        (kind === "food" ? variant.food : variant.drinks)[index] = null;
        candidates.push({ kind, remove: true, slot: kind + index, hrid, cost: 0, replaces: hrid, profile: variant });
    });
    return candidates;
}

// The combat house rooms (Dojo, Gym, Armory, …) one level up: the coins and
// materials of the next level, materials at the ask. Every room also adds a
// little wisdom and rare find everywhere; the simulator counts that too.
function houseCandidates(profile, budget) {
    const data = getClientData();
    const candidates = [];
    for (const room of Object.values(data.houseRoomDetailMap || {})) {
        if (!room.usableInActionTypeMap?.["/action_types/combat"]) continue;
        const level = profile.houseRooms?.[room.hrid] || 0;
        const costs = room.upgradeCostsMap?.[String(level + 1)];
        if (!costs?.length) continue;
        const materials = costs.map((c) => ({ hrid: c.itemHrid, count: c.count, price: askPrice(c.itemHrid, 0) }));
        if (materials.some((m) => m.price === null)) continue;
        const cost = materials.reduce((sum, m) => sum + m.count * m.price, 0);
        if (cost > budget) continue;
        const variant = cloneProfile(profile);
        variant.houseRooms = { ...variant.houseRooms, [room.hrid]: level + 1 };
        candidates.push({ kind: "house", slot: "house:" + room.hrid, hrid: room.hrid, name: room.name, fromLevel: level, level: level + 1, cost, materials, owned: false, replaces: null, profile: variant });
    }
    return candidates;
}

// What more levels in a combat skill would give – not something to buy, but to
// weigh against what is (is a +2 sword worth more than 5 Magic levels?). Only
// the skills your style uses: never the other two styles' own skill.
export const SKILL_STEPS = [1, 5];

function skillLevelCandidates(profile) {
    const data = getClientData();
    const style = weaponStyle(profile, data);
    const top = Array.isArray(data.levelExperienceTable) ? data.levelExperienceTable.length - 1 : 200;
    const candidates = [];
    for (const skill of COMBAT_SKILLS) {
        if (["melee", "ranged", "magic"].includes(skill) && skill !== style) continue;
        const from = profile.levels[skill];
        for (const step of SKILL_STEPS) {
            if (from + step > top) break;
            const variant = cloneProfile(profile);
            variant.levels[skill] = from + step;
            candidates.push({ kind: "skillLevel", slot: "skill:" + skill, hrid: skill, fromLevel: from, level: from + step, cost: 0, owned: true, replaces: null, profile: variant });
        }
    }
    return candidates;
}

// Every order of the abilities in the normal slots: each round the first one
// whose triggers hold and whose mana is there is cast, so the order matters.
function abilityOrderCandidates(profile) {
    const slots = slotCounts(profile, getClientData());
    const indices = [];
    for (let i = 1; i <= slots.abilities; i++) if (profile.abilities[i]) indices.push(i);
    if (indices.length < 2) return [];
    const entries = indices.map((i) => profile.abilities[i]);
    const now = entries.map((e) => e.hrid).join(">");
    const candidates = [];
    for (const order of permutations(entries)) {
        const key = order.map((e) => e.hrid).join(">");
        if (key === now) continue;
        const variant = cloneProfile(profile);
        indices.forEach((slot, k) => (variant.abilities[slot] = { ...order[k] }));
        candidates.push({ kind: "abilityOrder", slot: "abilityOrder", hrid: key, order: order.map((e) => e.hrid), was: entries.map((e) => e.hrid), cost: 0, owned: true, replaces: null, profile: variant });
    }
    return candidates;
}

function permutations(list) {
    if (list.length <= 1) return [list];
    return list.flatMap((item, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [item, ...rest]));
}

// Keeps one row per item/ability: its best placement, and for a pouch the food
// for the new slot that gives (nearly) the most XP for the least running cost.
function bestPerItem(evaluated) {
    const groups = new Map();
    for (const c of evaluated) {
        const key = [c.kind, c.hrid, c.enhancementLevel ?? "", ["abilityLevel", "house", "skillLevel"].includes(c.kind) ? c.level : "", c.remove ? "remove" : ""].join("|");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    }
    return [...groups.values()].map((options) => {
        const pool = options.some((c) => c.safe) ? options.filter((c) => c.safe) : options;
        const top = pool.reduce((a, b) => (b.delta > a.delta ? b : a));
        if (!top.extraFood || top.delta <= 0) return top;
        return pool.filter((c) => c.delta >= 0.85 * top.delta).sort((a, b) => a.costPerHourDelta - b.costPerHourDelta)[0];
    });
}

export async function analyzeUpgrades(pool, profile, zone, settings, onProgress, onRefineProgress) {
    const budget = settings.budget;
    const candidates = [
        ...gearCandidates(profile, settings),
        ...abilityCandidates(profile, budget),
        ...abilityOrderCandidates(profile),
        ...houseCandidates(profile, budget),
        ...skillLevelCandidates(profile),
        ...consumableCandidates(profile, "drinks"),
        ...consumableCandidates(profile, "food"),
    ].map((c, id) => ({ ...c, id }));
    const seeds = (n) => Array.from({ length: n }, (_, i) => i);
    const items = [{ profile, seeds: seeds(settings.seeds * BASE_SEED_FACTOR) }, ...candidates.map((c) => ({ profile: c.profile, seeds: seeds(settings.seeds) }))];
    const runs = await simulateRuns(pool, items, zone, settings.hours, onProgress);
    const simulated = [{ profile }, ...candidates].map((v, i) => ({ ...v, result: summarize(runs[i], zone.tier, v.profile), runs: runs[i] }));
    const slots = slotCounts(profile, getClientData());
    const emptyAbilitySlots = [];
    for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilitySlots.push(i);
    const raw = {
        zone,
        hours: settings.hours,
        seedsPerRound: settings.seeds,
        emptyAbilitySlots,
        starter: settings.starter || null,
        baseProfile: profile,
        base: simulated[0].result,
        baseRuns: simulated[0].runs,
        candidates: simulated.slice(1),
    };
    // Two automatic rounds of extra runs for promising but uncertain suggestions.
    for (let round = 0; round < 2; round++) {
        if (!(await refineUncertain(pool, raw, settings, onRefineProgress))) break;
    }
    return raw;
}

// Suggestions worth more runs: they look like an improvement, but are not beyond doubt.
export function uncertainCandidates(raw, settings) {
    const rated = rateUpgrades(raw, settings);
    const maxRuns = raw.seedsPerRound * MAX_SEED_FACTOR;
    return [...rated.gear, ...rated.abilities, ...rated.house, ...rated.orders, ...rated.drinks, ...rated.food]
        .filter((c) => c.delta > 0 && c.safe && c.confidence < REFINE_BELOW && c.runs.length < maxRuns)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, MAX_REFINED);
}

// Gives uncertain suggestions another round of seeds. Returns how many were refined.
export async function refineUncertain(pool, raw, settings, onProgress) {
    const targets = uncertainCandidates(raw, settings).map((c) => raw.candidates.find((x) => x.id === c.id));
    if (!targets.length) return 0;
    const items = targets.map((c) => {
        const first = Math.max(...c.runs.map((r) => r.seed)) + 1;
        return { profile: c.profile, seeds: Array.from({ length: raw.seedsPerRound }, (_, i) => first + i) };
    });
    const runs = await simulateRuns(pool, items, raw.zone, raw.hours, onProgress);
    targets.forEach((c, i) => {
        c.runs = [...c.runs, ...runs[i]];
        c.result = summarize(c.runs, raw.zone.tier, c.profile);
    });
    return targets.length;
}

// Scores simulated upgrades for a goal. Cheap, so the XP/gold slider can re-rate
// an analysis instantly without simulating again.
export function rateUpgrades(raw, settings) {
    const { base } = raw;
    const goal = makeGoal(settings, { xp: xpValue(base, settings), gold: base.loot });
    const baseScore = score(base, goal);
    const baseScores = raw.baseRuns.map((r) => score(r, goal));

    // A drink or food that never triggers (e.g. a second coffee of a kind whose buff is
    // already running) would only be bought to sit unused; stopping the old one is the honest option.
    const used = (c) => c.remove || !["food", "drinks"].includes(c.kind) || (c.result.consumables[c.hrid] || 0) > 0.01;
    const evaluated = raw.candidates.filter(used).map((c) => {
                const delta = score(c.result, goal) - baseScore;
        const confidence = confidenceGreater(c.runs.map((r) => score(r, goal)), baseScores) ?? 0.5;
        return {
            ...c,
            delta,
            deltaPct: delta, // scores are already fractions of the reference
            confidence,
            significant: confidence >= CONFIDENCE_LEVEL,
            xpDelta: xpValue(c.result, settings) - xpValue(base, settings),
            profitDelta: c.result.profit - base.profit,
            // A change that makes you die noticeably more often is never recommended, whatever the
            // gain – unless you accept rare deaths and it stays within that limit.
            safe: c.result.deaths <= Math.max(base.deaths * 1.1 + 0.3, deathLimit(settings)),
            costPerHourDelta: c.result.cost - base.cost,
            deathsDelta: c.result.deaths - base.deaths,
        };
    });
    const best = bestPerItem(evaluated);
    const byDelta = (a, b) => b.delta - a.delta;
    // Hours until a skill reaches the level, at the XP an hour it gets now.
    const table = getClientData()?.levelExperienceTable;
    for (const c of best) {
        if (c.kind !== "skillLevel") continue;
        const rate = base.xp?.[c.hrid] || 0;
        const xpNow = Array.isArray(table) ? experienceOf(table, raw.baseProfile.allExperience?.["/skills/" + c.hrid], c.fromLevel) : null;
        const need = Array.isArray(table) && table[c.level] !== undefined ? Math.max(0, table[c.level] - xpNow) : null;
        c.xpNeeded = need;
        c.hoursToReach = need === null || !(rate > 0) ? null : need / rate;
    }
    return {
        ...raw,
        goal,
        baseScore,
        gear: best.filter((c) => c.kind === "gear").sort(byDelta),
        abilities: best.filter((c) => c.kind === "ability" || c.kind === "abilityLevel").sort(byDelta),
        orders: best.filter((c) => c.kind === "abilityOrder").sort(byDelta),
        house: best.filter((c) => c.kind === "house").sort(byDelta),
        levels: best.filter((c) => c.kind === "skillLevel").sort((a, b) => a.hrid.localeCompare(b.hrid) || a.level - b.level),
        drinks: best.filter((c) => c.kind === "drinks").sort(byDelta),
        food: best.filter((c) => c.kind === "food").sort(byDelta),
    };
}

// Confidence that "to" beats "from" (null = the current setup).
function stepConfidence(analysis, from, to) {
    if (!from) return to.confidence;
    const scores = (c) => c.runs.map((r) => score(r, analysis.goal));
    return confidenceGreater(scores(to), scores(from)) ?? 0.5;
}

// Upper concave hull of (cost, gain) for one slot: the sequence of ever more
// expensive options where each step still pays for itself.
function hullSteps(group, options, minGain, minEfficiency, confident) {
    const points = [{ cost: 0, delta: 0, candidate: null }, ...options.map((c) => ({ cost: c.cost, delta: c.delta, candidate: c }))].sort(
        (a, b) => a.cost - b.cost || b.delta - a.delta
    );
    const rising = [];
    for (const p of points) {
        const last = rising[rising.length - 1];
        if (last && (p.cost === last.cost || p.delta <= last.delta)) continue;
        rising.push(p);
    }
    const slope = (a, b) => (b.delta - a.delta) / (b.cost - a.cost);
    const hull = [];
    for (const p of rising) {
        while (hull.length >= 2 && slope(hull[hull.length - 2], hull[hull.length - 1]) <= slope(hull[hull.length - 1], p)) hull.pop();
        hull.push(p);
    }
    const steps = [];
    if (hull[0].candidate) steps.push({ group, to: hull[0].candidate, cost: 0, gain: hull[0].delta, efficiency: Infinity });
    let from = hull[0];
    let firstPaidEfficiency = null;
    for (let i = 1; i < hull.length; i++) {
        const to = hull[i];
        const gain = to.delta - from.delta;
        // Too small on its own (e.g. +1 ability level): combine it with the next, pricier option
        // instead of giving up on the slot.
        // Also when we can't yet be sure it beats the cheaper option.
        if (gain < (firstPaidEfficiency === null ? minGain : 2 * minGain) || !confident(from.candidate, to.candidate)) continue;
        const efficiency = gain / (to.cost - from.cost);
        if (efficiency < minEfficiency) break;
        // Diminishing returns: a pricier version (e.g. a +7 instead of a +0) must still give at
        // least a quarter of the XP per coin of the first purchase.
        if (firstPaidEfficiency === null) firstPaidEfficiency = efficiency;
        else if (efficiency < firstPaidEfficiency / 4) break;
        steps.push({ group, to: to.candidate, cost: to.cost - from.cost, gain, efficiency });
        from = to;
    }
    return steps;
}

// Which food/drink change to recommend. With any gold weight the running cost is
// already in the gain, so the biggest gain wins. With a pure XP focus cost is not
// in the gain, so among options giving at least half the best gain the cheapest
// one wins. Ties go to simply stopping a consumable (nothing to buy).
function pickConsumable(list, gold) {
    const ok = list.filter((c) => c.significant && c.safe && c.delta > 0);
    if (!ok.length) return { value: null, max: null };
    const max = ok.reduce((a, b) => (b.delta > a.delta + 1e-9 || (Math.abs(b.delta - a.delta) <= 1e-9 && b.remove) ? b : a));
    const preferStopping = (a, b) => (b.remove ? 1 : 0) - (a.remove ? 1 : 0);
    const value =
        gold > 0
            ? max
            : ok.filter((c) => c.delta >= 0.5 * max.delta).sort((a, b) => a.costPerHourDelta - b.costPerHourDelta || preferStopping(a, b))[0];
    // Replacing X with something that changes nothing measurable is really "stop using X":
    // prefer that when it is within noise of the pick for the same slot – nothing to buy.
    const stop = ok.find((c) => c.remove && c.slot === value.slot && c !== value && c.delta >= value.delta - STOP_TOLERANCE);
    const chosen = stop || value;
    return { value: chosen, max: max === chosen ? null : max };
}

const STOP_TOLERANCE = 0.005; // half a percent of the reference

// Shopping list within the budget, treating it as a multiple-choice knapsack:
// every slot can move up its hull one step at a time, best XP-per-coin step first.
export function buildPlan(analysis, budget, spending = "balanced") {
    // A weapon for a new style comes first; a better weapon on the list replaces it.
    budget -= analysis.starter?.cost || 0;
    const minGain = 0.01;
    const minEfficiency = (SPENDING[spending] || SPENDING.balanced).minPctPerMillion / 100 / 1e6;
    const usable = (c) => c.significant && c.safe && c.delta > 0;
    const groups = new Map();
    for (const c of analysis.gear.filter(usable)) {
        const key = c.slot === "main_hand" || c.slot === "two_hand" ? "weapon" : c.slot;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    }
    for (const c of analysis.abilities.filter(usable)) {
        // Levelling up or replacing the ability in a slot are alternatives for that slot.
        const key = c.kind === "abilityLevel" || c.replaces ? c.slot : "new-ability:" + c.hrid;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    }
    for (const c of (analysis.house || []).filter(usable)) groups.set(c.slot, [...(groups.get(c.slot) || []), c]);
    const confident = (from, to) => stepConfidence(analysis, from, to) >= CONFIDENCE_LEVEL;
    const steps = [...groups.entries()].flatMap(([key, options]) => hullSteps(key, options, minGain, minEfficiency, confident));
    steps.sort((a, b) => b.efficiency - a.efficiency || b.gain - a.gain);

    const chosen = new Map();
    const blocked = new Set();
    const freeAbilitySlots = [...analysis.emptyAbilitySlots];
    const usedAbilities = new Set();
    let spent = 0;
    for (const step of steps) {
        if (blocked.has(step.group)) continue;
        const isNewAbility = step.group.startsWith("new-ability:");
        if (spent + step.cost > budget || (isNewAbility && !freeAbilitySlots.length) || usedAbilities.has(step.to.hrid)) {
            blocked.add(step.group); // later steps in this slot build on this one
            continue;
        }
        spent += step.cost;
        if (isNewAbility) {
            chosen.set(step.group, { ...step.to, slot: "ability" + freeAbilitySlots.shift() });
        } else {
            chosen.set(step.group, step.to);
        }
        if (step.to.kind === "ability") usedAbilities.add(step.to.hrid);
    }
    let picks = [...chosen.values()];
    if (picks.some((p) => p.slot === "two_hand")) picks = picks.filter((p) => p.slot !== "off_hand");
    const isWeapon = (p) => p.slot === "main_hand" || p.slot === "two_hand";
    const starter = analysis.starter && !picks.some(isWeapon) ? analysis.starter : null;
    // A better weapon of the new style is bought instead of the starter: it replaces the weapon you wear.
    if (analysis.starter) picks = picks.map((p) => (isWeapon(p) ? { ...p, replaces: analysis.starter.replaces } : p));
    spent = picks.reduce((sum, p) => sum + p.cost, 0) + (starter?.cost || 0);

    const drink = pickConsumable(analysis.drinks, analysis.goal.gold);
    const food = pickConsumable(analysis.food, analysis.goal.gold);
    if (food.value && picks.some((p) => p.extraFood === food.value.hrid)) food.value = null;
    // A better ability order is free: the surest clear gain, if any.
    const order = (analysis.orders || []).filter((c) => usable(c) && c.delta >= STOP_TOLERANCE).sort((a, b) => b.delta - a.delta)[0] || null;
    return { picks, starter, spent, drink: drink.value, drinkMax: drink.max, food: food.value, foodMax: food.max, order };
}

// Puts the abilities named in order into that order, in the slots they hold now;
// abilities the plan swapped in stay where they are.
function reorderAbilities(profile, order) {
    const slots = [];
    profile.abilities.forEach((entry, index) => {
        if (index > 0 && entry && order.includes(entry.hrid)) slots.push(index);
    });
    const entries = slots.map((i) => profile.abilities[i]).sort((a, b) => order.indexOf(a.hrid) - order.indexOf(b.hrid));
    slots.forEach((slot, k) => (profile.abilities[slot] = entries[k]));
}

function putConsumable(list, slot, hrid) { // hrid null empties the slot
    const index = Number(slot.replace(/\D+/g, ""));
    while (list.length <= index) list.push(null);
    list[index] = hrid;
}

export function applyPlan(profile, plan) {
    const result = cloneProfile(profile);
    for (const pick of plan.picks) {
        if (pick.kind === "gear") {
            equip(result, pick.slot, { hrid: pick.hrid, enhancementLevel: pick.enhancementLevel });
            if (pick.extraFood) putConsumable(result.food, "food" + pick.extraFoodSlot, pick.extraFood);
        } else if (pick.kind === "ability" || pick.kind === "abilityLevel") {
            result.abilities[Number(pick.slot.replace("ability", ""))] = { hrid: pick.hrid, level: pick.level };
        } else if (pick.kind === "house") {
            result.houseRooms = { ...result.houseRooms, [pick.hrid]: pick.level };
        }
    }
    if (plan.order) reorderAbilities(result, plan.order.order);
    for (const pick of [plan.drink, plan.food]) {
        if (pick) putConsumable(pick.kind === "food" ? result.food : result.drinks, pick.slot, pick.remove ? null : pick.hrid);
    }
    return result;
}

export async function verifyPlan(pool, profile, plan, zone, settings, onProgress) {
    const variants = [{ kind: "base", profile }, { kind: "plan", profile: applyPlan(profile, plan) }];
    const [base, planned] = await simulateVariants(pool, variants, zone, settings, onProgress);
    return { base: base.result, planned: planned.result };
}
