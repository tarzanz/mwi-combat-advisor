// The Labyrinth's combat rooms: which monsters you beat at which room level, and what
// would take you further. A combat room is one monster, built for room level 100 and
// scaled in proportion to the room level, fought from full HP and mana with no food or
// drinks (only the crates opened on entry) and 2 minutes to win.

import { askPrice } from "./game-data.js";
import { cloneProfile, equip, meetsRequirements, slotCounts, toDTO, weaponOf } from "./profile.js";

export const SAFE_WIN = 0.9; // "safe": you win at least this share of the rooms
export const RISKY_WIN = 0.5;
export const MIN_LEVEL = 5;
export const MAX_LEVEL = 200;
const COARSE_LEVELS = [5, ...Array.from({ length: 20 }, (_, i) => 10 * (i + 1))]; // 5, 10, 20 … 200
const FINE_STEP = 2;
const MAX_FINE = 12;

// Rooms simulated per point of the curve, and per monster for each improvement.
export const LAB_ACCURACY = {
    fast: { rooms: 20, improveRooms: 40 },
    normal: { rooms: 40, improveRooms: 80 },
    thorough: { rooms: 80, improveRooms: 160 },
};

export const CRATE_TIERS = ["basic", "advanced", "expert"];
export const CRATE_KINDS = { coffee: "Coffee crate", food: "Food crate" };
const crateHrid = (tier, kind) => `/items/${tier}_${kind}_crate`;
const LABYRINTH = "/action_types/labyrinth";

const seedFor = (index) => (Math.imul(index + 1, 2654435761) >>> 1) || 1;

export function labyrinthMonsters(data) {
    return Object.values(data.combatMonsterDetailMap || {})
        .filter((m) => m.isLabyrinthMonster)
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((m) => m.hrid);
}

// The crate tier of a kind in the character's Labyrinth slots (null when none).
export function slottedCrate(character, kind) {
    const slots = [...(character?.actionTypeDrinkSlotsMap?.[LABYRINTH] || []), ...(character?.actionTypeFoodSlotsMap?.[LABYRINTH] || [])];
    for (const slot of slots) {
        const tier = CRATE_TIERS.find((t) => slot?.itemHrid === crateHrid(t, kind));
        if (tier) return tier;
    }
    return null;
}

// The crate tiers in use: a setting is "slots" (what your Labyrinth slots hold), "none" or a tier.
export function chosenCrates(settings, character) {
    const pick = (kind) => {
        const value = settings[kind === "coffee" ? "labyCoffee" : "labyFood"] || "slots";
        if (value === "slots") return slottedCrate(character, kind);
        return CRATE_TIERS.includes(value) ? value : null;
    };
    return { coffee: pick("coffee"), food: pick("food") };
}

export function crateBuffs(data, crates) {
    const buffs = [];
    for (const [kind, tier] of Object.entries(crates)) {
        if (!tier) continue;
        for (const buff of data.labyrinthCrateDetailMap?.[crateHrid(tier, kind)] || []) buffs.push({ ...buff, uniqueHrid: `${buff.uniqueHrid}#${kind}`, duration: 0 });
    }
    return buffs;
}

// A saved loadout for the Labyrinth, if the character has one (the default one first).
export function labyrinthLoadout(character) {
    const loadouts = Object.entries(character?.characterLoadoutMap || {})
        .filter(([, l]) => l?.actionTypeHrid === LABYRINTH)
        .map(([id, l]) => ({ ...l, id: String(id) }))
        .sort((a, b) => (b.isDefault === true) - (a.isDefault === true) || (a.ordinal ?? 0) - (b.ordinal ?? 0));
    return loadouts[0] || null;
}

// The character as it fights in a room: no food or drinks, the crates' buffs on top.
function roomFighter(profile, data, crates) {
    const fighter = cloneProfile(profile);
    fighter.food = [];
    fighter.drinks = [];
    return { player: toDTO(fighter, data), extraBuffs: [...(profile.extraBuffs || []), ...crateBuffs(data, crates)] };
}

// ---------- damage against a monster ----------

export const DAMAGE_TYPES = ["physical", "water", "nature", "fire"];
const RESISTANCE_STAT = { physical: "armor", water: "waterResistance", nature: "natureResistance", fire: "fireResistance" };

// The share of a hit that gets through, per damage type, at a room level: the game's
// 100 / (100 + resistance), the resistance being the monster's own plus a fifth of its
// defence level, both scaled with the room level. (Penetration is left out.)
export function damageTaken(data, monsterHrid, level) {
    const monster = data.combatMonsterDetailMap[monsterHrid];
    const stats = monster.combatDetails.combatStats || {};
    const scale = level / 100;
    const defense = 0.2 * (monster.combatDetails.defenseLevel || 0) * scale;
    const out = {};
    for (const type of DAMAGE_TYPES) {
        const resistance = (stats[RESISTANCE_STAT[type]] || 0) * scale + defense;
        out[type] = resistance >= 0 ? 100 / (100 + resistance) : (100 - resistance) / 100;
    }
    return out;
}

export function weakness(data, monsterHrid) {
    const taken = damageTaken(data, monsterHrid, 100);
    return DAMAGE_TYPES.reduce((best, type) => (taken[type] > taken[best] ? type : best), DAMAGE_TYPES[0]);
}

// Each monster dodges most attack styles many times over (evasion +100% … +10,000%)
// and only one or two hardly at all: those are the styles to fight it with.
export const ATTACK_STYLES = ["stab", "slash", "smash", "ranged", "magic"];

export function evasionByStyle(data, monsterHrid) {
    const stats = data.combatMonsterDetailMap[monsterHrid].combatDetails.combatStats || {};
    return Object.fromEntries(ATTACK_STYLES.map((style) => [style, 1 + (stats[style + "Evasion"] || 0)]));
}

export function weakStyles(data, monsterHrid) {
    const evasion = evasionByStyle(data, monsterHrid);
    const least = Math.min(...Object.values(evasion));
    return ATTACK_STYLES.filter((style) => evasion[style] <= least * 1.25);
}

// The attack style of the weapon you hold (a punch is smash).
export function yourStyle(profile, data) {
    const weapon = weaponOf(profile);
    const first = weapon ? data.itemDetailMap[weapon.hrid]?.equipmentDetail?.combatStats?.combatStyleHrids?.[0] : null;
    return (first || "/combat_styles/smash").split("/").pop();
}

// For every other attack style, a weapon to try it with: the best you own that you can
// wear, else the cheapest on the market. Everything else stays as it is.
export function styleWeapons(profile, data) {
    const now = yourStyle(profile, data);
    const out = [];
    for (const style of ATTACK_STYLES) {
        if (style === now) continue;
        const fits = (item) =>
            item?.equipmentDetail &&
            ["main_hand", "two_hand"].includes(item.equipmentDetail.type?.split("/").pop()) &&
            item.equipmentDetail.combatStats?.combatStyleHrids?.[0] === "/combat_styles/" + style &&
            meetsRequirements(profile, item.equipmentDetail.levelRequirements);
        const owned = profile.inventory
            .filter((i) => fits(data.itemDetailMap[i.hrid]))
            .sort((a, b) => (data.itemDetailMap[b.hrid].itemLevel || 0) - (data.itemDetailMap[a.hrid].itemLevel || 0) || b.enhancementLevel - a.enhancementLevel)[0];
        let weapon = owned ? { hrid: owned.hrid, enhancementLevel: owned.enhancementLevel, cost: 0, owned: true } : null;
        if (!weapon) {
            for (const item of Object.values(data.itemDetailMap)) {
                if (!fits(item)) continue;
                const price = askPrice(item.hrid, 0);
                if (price !== null && (!weapon || price < weapon.cost)) weapon = { hrid: item.hrid, enhancementLevel: 0, cost: price, owned: false };
            }
        }
        if (!weapon) continue;
        const changed = cloneProfile(profile);
        equip(changed, data.itemDetailMap[weapon.hrid].equipmentDetail.type.split("/").pop(), { hrid: weapon.hrid, enhancementLevel: weapon.enhancementLevel });
        out.push({ style, weapon, profile: changed });
    }
    return out;
}

export function monsterAttack(data, monsterHrid) {
    const stats = data.combatMonsterDetailMap[monsterHrid].combatDetails.combatStats || {};
    return {
        style: (stats.combatStyleHrids?.[0] || "").split("/").pop(),
        type: (stats.damageType || "").split("/").pop(),
    };
}

// The damage types you hit with: the weapon's auto attack and the damage abilities you have on.
export function yourDamageTypes(profile, data) {
    const types = new Map(); // type -> what deals it
    const add = (type, what) => {
        type = (type || "").split("/").pop();
        if (!DAMAGE_TYPES.includes(type)) return;
        if (!types.has(type)) types.set(type, []);
        types.get(type).push(what);
    };
    const weapon = weaponOf(profile);
    add(weapon ? data.itemDetailMap[weapon.hrid]?.equipmentDetail?.combatStats?.damageType : "/damage_types/physical", weapon ? weapon.hrid : "punch");
    for (const entry of profile.abilities || []) {
        if (!entry) continue;
        for (const effect of data.abilityDetailMap[entry.hrid]?.abilityEffects || []) add(effect.damageType, entry.hrid);
    }
    return types;
}

// ---------- the curve: win rate by room level ----------

const rate = (point) => (point.attempts ? point.wins / point.attempts : 0);

function pointsToJobs(fighter, points, rooms) {
    return points.map((p, i) => ({ ...fighter, monsterHrid: p.monster, roomLevel: p.level, attempts: rooms, seed: seedFor(p.seed ?? i) }));
}

// The highest level you win safely at (every level up to it ≥ SAFE_WIN), and where the
// win rate falls through 50% (interpolated). null: not even at the lowest level.
export function summarizeCurve(curve) {
    let safe = null;
    for (const p of curve) {
        if (rate(p) >= SAFE_WIN) safe = p.level;
        else break;
    }
    let half = null;
    if (curve.length && rate(curve[0]) >= RISKY_WIN) {
        half = curve[curve.length - 1].level;
        for (let i = 1; i < curve.length; i++) {
            const a = curve[i - 1];
            const b = curve[i];
            if (rate(b) < RISKY_WIN) {
                const ra = rate(a);
                const rb = rate(b);
                half = a.level + ((ra - RISKY_WIN) / Math.max(1e-9, ra - rb)) * (b.level - a.level);
                break;
            }
        }
    }
    return { safe, half };
}

// The win rate at a level, read off the curve (linear between the simulated levels).
export function winAt(curve, level) {
    if (!curve.length) return null;
    if (level <= curve[0].level) return rate(curve[0]);
    for (let i = 1; i < curve.length; i++) {
        const a = curve[i - 1];
        const b = curve[i];
        if (level <= b.level) return rate(a) + ((level - a.level) / (b.level - a.level)) * (rate(b) - rate(a));
    }
    return rate(curve[curve.length - 1]);
}

// The simulated level nearest a level, for the details (how rooms are lost, how long a win takes).
export function nearestPoint(curve, level) {
    return curve.reduce((best, p) => (!best || Math.abs(p.level - level) < Math.abs(best.level - level) ? p : best), null);
}

// Your setup now (with the crates you chose) against every Labyrinth monster.
export async function analyzeLabyrinth(pool, profile, data, settings, character, onProgress) {
    const accuracy = LAB_ACCURACY[settings.accuracy] || LAB_ACCURACY.normal;
    const crates = chosenCrates(settings, character);
    const fighter = roomFighter(profile, data, crates);
    const monsters = labyrinthMonsters(data);
    return { crates, rooms: accuracy.rooms, monsters: await simulateCurves(pool, fighter, monsters, accuracy.rooms, true, onProgress) };
}

// Win rate by room level against each monster: levels 5, 10, 20 … 200, and with fine
// every 2 levels where you go from winning safely to hardly ever.
async function simulateCurves(pool, fighter, monsters, rooms, fineToo, onProgress) {
    const coarse = monsters.flatMap((monster) => COARSE_LEVELS.map((level, i) => ({ monster, level, seed: i })));
    const fine = [];
    let before = 0; // jobs of the earlier round, for the progress bar
    const run = (points) => pool.runAll(pointsToJobs(fighter, points, rooms), (done) => onProgress?.(before + done, coarse.length + fine.length));
    const coarseResults = await run(coarse);
    before = coarse.length;

    const curves = new Map(monsters.map((m) => [m, []]));
    coarse.forEach((p, i) => curves.get(p.monster).push({ level: p.level, ...coarseResults[i] }));

    for (const monster of fineToo ? monsters : []) {
        const curve = curves.get(monster);
        const lastSafe = [...curve].reverse().find((p) => rate(p) >= SAFE_WIN)?.level ?? 0;
        const firstLost = curve.find((p) => p.level > lastSafe && rate(p) <= 0.1)?.level ?? MAX_LEVEL;
        const have = new Set(curve.map((p) => p.level));
        const levels = [];
        for (let level = Math.max(MIN_LEVEL, lastSafe) + FINE_STEP; level < firstLost && levels.length < MAX_FINE; level += FINE_STEP) {
            if (!have.has(level)) levels.push(level);
        }
        fine.push(...levels.map((level) => ({ monster, level, seed: 100 + level })));
    }
    const fineResults = await run(fine);
    fine.forEach((p, i) => curves.get(p.monster).push({ level: p.level, ...fineResults[i] }));

    return monsters.map((hrid) => {
        const curve = curves.get(hrid).sort((a, b) => a.level - b.level);
        return { hrid, curve, ...summarizeCurve(curve) };
    });
}

// ---------- what takes you further ----------

const SKILL_STEP = 5;
const ABILITY_STEP = 5;
const SKILL_LABEL = { stamina: "Stamina", intelligence: "Intelligence", attack: "Attack", melee: "Melee", defense: "Defense", ranged: "Ranged", magic: "Magic" };

// Things to work on: the next crates, a few levels in each combat skill and in each
// ability you use, and (per monster, in case you can change abilities between rooms)
// an ability you know in place of one you use.
export function improvementCandidates(profile, data, crates) {
    const list = [];
    for (const kind of Object.keys(CRATE_KINDS)) {
        const now = CRATE_TIERS.indexOf(crates[kind]);
        for (const tier of CRATE_TIERS.slice(now + 1)) {
            list.push({ id: `crate:${kind}:${tier}`, kind: "crate", label: `${tier[0].toUpperCase() + tier.slice(1)} ${CRATE_KINDS[kind]}`, crates: { ...crates, [kind]: tier }, profile });
        }
    }
    for (const skill of Object.keys(SKILL_LABEL)) {
        const changed = cloneProfile(profile);
        changed.levels[skill] += SKILL_STEP;
        list.push({ id: `skill:${skill}`, kind: "skill", label: `+${SKILL_STEP} ${SKILL_LABEL[skill]}`, crates, profile: changed });
    }
    profile.abilities.forEach((entry, slot) => {
        if (!entry) return;
        const changed = cloneProfile(profile);
        changed.abilities[slot].level += ABILITY_STEP;
        list.push({ id: `ability:${entry.hrid}`, kind: "ability", hrid: entry.hrid, label: `+${ABILITY_STEP} levels ${data.abilityDetailMap[entry.hrid]?.name || entry.hrid}`, crates, profile: changed });
    });
    const using = new Set(profile.abilities.filter(Boolean).map((a) => a.hrid));
    for (const [hrid, level] of Object.entries(profile.learnedAbilities || {})) {
        const detail = data.abilityDetailMap[hrid];
        if (!detail || detail.isSpecialAbility || using.has(hrid)) continue;
        for (let slot = 1; slot <= slotCounts(profile, data).abilities; slot++) {
            const old = profile.abilities[slot];
            const changed = cloneProfile(profile);
            changed.abilities[slot] = { hrid, level };
            list.push({ id: `swap:${slot}:${hrid}`, kind: "swap", hrid, replaces: old?.hrid || null, slot, label: `${detail.name}${old ? ` instead of ${data.abilityDetailMap[old.hrid]?.name || old.hrid}` : " in an empty slot"}`, crates, profile: changed });
            if (!old) break; // one empty slot is enough
        }
    }
    return list;
}

// Each candidate against each monster at the level where you win about half the rooms,
// with the same random numbers as the setup now. The gain in won rooms is turned into
// room levels with how fast your win rate falls there.
export async function analyzeImprovements(pool, profile, data, settings, lab, onProgress) {
    const accuracy = LAB_ACCURACY[settings.accuracy] || LAB_ACCURACY.normal;
    const candidates = improvementCandidates(profile, data, lab.crates);
    const edges = lab.monsters.map((m, i) => {
        const level = Math.round(Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, m.half ?? MIN_LEVEL)));
        // How many rooms a level costs around there (at least 1% a level, so a flat curve can't blow up the gain).
        const below = [...m.curve].reverse().find((p) => p.level <= level - 1 && rate(p) > winAt(m.curve, level)) || m.curve[0];
        const above = m.curve.find((p) => p.level >= level + 1 && rate(p) < winAt(m.curve, level)) || m.curve[m.curve.length - 1];
        const slope = above.level > below.level ? (rate(below) - rate(above)) / (above.level - below.level) : 0;
        return { hrid: m.hrid, level, slope: Math.max(0.01, slope), seed: 1000 + i };
    });
    const setups = [{ id: "base", crates: lab.crates, profile }, ...candidates];
    const jobs = [];
    for (const setup of setups) {
        const fighter = roomFighter(setup.profile, data, setup.crates);
        for (const edge of edges) jobs.push({ ...fighter, monsterHrid: edge.hrid, roomLevel: edge.level, attempts: accuracy.improveRooms, seed: seedFor(edge.seed) });
    }
    const styles = styleWeapons(profile, data);
    const monsters = lab.monsters.map((m) => m.hrid);
    const styleJobs = styles.length * monsters.length * COARSE_LEVELS.length;
    const results = await pool.runAll(jobs, (done) => onProgress?.(done, jobs.length + styleJobs));
    const styleCurves = [];
    for (const [i, style] of styles.entries()) {
        const before = jobs.length + i * monsters.length * COARSE_LEVELS.length;
        const curves = await simulateCurves(pool, roomFighter(style.profile, data, lab.crates), monsters, accuracy.rooms, false, (done) => onProgress?.(before + done, jobs.length + styleJobs));
        const { profile: _p, ...rest } = style;
        styleCurves.push({ ...rest, monsters: curves });
    }
    const base = results.slice(0, edges.length);
    const out = candidates.map((candidate, c) => {
        const own = results.slice((c + 1) * edges.length, (c + 2) * edges.length);
        const perMonster = edges.map((edge, i) => {
            const gain = rate(own[i]) - rate(base[i]);
            return { hrid: edge.hrid, level: edge.level, before: rate(base[i]), after: rate(own[i]), levels: Math.max(-50, Math.min(50, gain / edge.slope)) };
        });
        const levels = perMonster.reduce((sum, m) => sum + m.levels, 0) / perMonster.length;
        const { profile: _p, crates: _c, ...rest } = candidate;
        return { ...rest, levels, perMonster };
    });
    return { edges, rooms: accuracy.improveRooms, styles: styleCurves, base: edges.map((e, i) => ({ hrid: e.hrid, level: e.level, win: rate(base[i]), deaths: base[i].deaths / base[i].attempts, timeouts: base[i].timeouts / base[i].attempts })), candidates: out };
}
