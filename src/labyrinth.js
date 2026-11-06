// The Labyrinth's combat rooms: which monsters you beat at which room level, with which
// of your loadouts, and what would take you further. A combat room is one monster, built
// for room level 100 and scaled in proportion to the room level, fought 1 against 1 from
// full HP and mana with no food or drinks (only the crates opened on entry) and 2 minutes
// to win. The game's Labyrinth automation can put on a loadout of your choice for each
// room type, so every monster is judged with the loadout that does best against it.

import { abilityCandidates, gearCandidates } from "./analysis.js";
import { askPrice } from "./game-data.js";
import { cloneProfile, equip, meetsRequirements, slotCounts, toDTO, weaponOf } from "./profile.js";

export const SAFE_WIN = 0.9; // "safe": you win at least this share of the rooms
export const RISKY_WIN = 0.5;
export const MIN_LEVEL = 5;
export const MAX_LEVEL = 200;
const COARSE_LEVELS = [5, ...Array.from({ length: 20 }, (_, i) => 10 * (i + 1))]; // 5, 10, 20 … 200
const FINE_STEP = 2;
const MAX_FINE = 12;

// Floors: a community guide says each floor is about 20 room levels harder. Where floor 1
// starts is not written anywhere we know of; 20 is our guess.
export const FLOOR_STEP = 20;
export const FLOOR_ONE_LEVEL = 20;
export const floorLevel = (floor) => FLOOR_ONE_LEVEL + (floor - 1) * FLOOR_STEP;
// The deepest floor whose rooms are at or below a room level (0: not even floor 1).
export const floorAt = (level) => (level === null || level < FLOOR_ONE_LEVEL ? 0 : 1 + Math.floor((level - FLOOR_ONE_LEVEL) / FLOOR_STEP));

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

// Saved loadouts for the Labyrinth itself, if the character has any.
export function labyrinthLoadouts(character) {
    return Object.entries(character?.characterLoadoutMap || {})
        .filter(([, l]) => l?.actionTypeHrid === LABYRINTH)
        .map(([id, l]) => ({ ...l, id: String(id) }))
        .sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
}

// The character as it fights in a room: no food or drinks, the crates' buffs on top.
function roomFighter(profile, data, crates) {
    const fighter = cloneProfile(profile);
    fighter.food = [];
    fighter.drinks = [];
    return { player: toDTO(fighter, data), extraBuffs: [...(profile.extraBuffs || []), ...crateBuffs(data, crates)] };
}

// ---------- what hurts a monster ----------

export const DAMAGE_TYPES = ["physical", "water", "nature", "fire"];
const RESISTANCE_STAT = { physical: "armor", water: "waterResistance", nature: "natureResistance", fire: "fireResistance" };
export const ATTACK_STYLES = ["stab", "slash", "smash", "ranged", "magic"];
// The damage types a style can deal: melee hits physical, arrows can carry water or fire, spells are elemental.
const STYLE_TYPES = { stab: ["physical"], slash: ["physical"], smash: ["physical"], ranged: ["physical", "water", "fire"], magic: ["water", "nature", "fire"] };

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

// Each monster dodges most attack styles many times over (evasion +100% … +10,000%).
export function evasionByStyle(data, monsterHrid) {
    const stats = data.combatMonsterDetailMap[monsterHrid].combatDetails.combatStats || {};
    return Object.fromEntries(ATTACK_STYLES.map((style) => [style, 1 + (stats[style + "Evasion"] || 0)]));
}

// How well a style and damage type hit a monster: the share that gets through its
// resistance, divided by how many times better it dodges that style. A rough ranking.
function hitScore(data, monsterHrid, style, type) {
    return damageTaken(data, monsterHrid, 100)[type] / evasionByStyle(data, monsterHrid)[style];
}

// What a monster is weak to: the style and damage type pairs within half of the best.
// Nothing hits a Mimic well (it dodges everything and attacks very fast): the wiki says
// damage back – Thorns and Retaliation – is what beats it.
const THORNS_BELOW = 0.1;
export function weakTo(data, monsterHrid) {
    const pairs = [];
    for (const style of ATTACK_STYLES) for (const type of STYLE_TYPES[style]) pairs.push({ style, type, score: hitScore(data, monsterHrid, style, type) });
    const best = Math.max(...pairs.map((p) => p.score));
    const styles = [];
    for (const p of pairs.filter((p) => p.score >= best / 2).sort((a, b) => b.score - a.score)) {
        const known = styles.find((s) => s.style === p.style);
        if (known) known.types.push(p.type);
        else styles.push({ style: p.style, types: [p.type] });
    }
    return { styles, best, thorns: best < THORNS_BELOW };
}

// The attack style of the weapon you hold (a punch is smash).
export function yourStyle(profile, data) {
    const weapon = weaponOf(profile);
    const first = weapon ? data.itemDetailMap[weapon.hrid]?.equipmentDetail?.combatStats?.combatStyleHrids?.[0] : null;
    return (first || "/combat_styles/smash").split("/").pop();
}

// The ways you hit: the weapon's auto attack, and each damage ability with its own style.
export function yourAttacks(profile, data) {
    const weapon = weaponOf(profile);
    const out = [{ what: weapon?.hrid || "punch", style: yourStyle(profile, data), type: (weapon ? data.itemDetailMap[weapon.hrid]?.equipmentDetail?.combatStats?.damageType : "") || "/damage_types/physical" }];
    for (const entry of profile.abilities || []) {
        if (!entry) continue;
        for (const effect of data.abilityDetailMap[entry.hrid]?.abilityEffects || []) {
            if (effect.damageType && effect.combatStyleHrid) out.push({ what: entry.hrid, style: effect.combatStyleHrid, type: effect.damageType });
        }
    }
    return out
        .map((a) => ({ ...a, style: a.style.split("/").pop(), type: a.type.split("/").pop() }))
        .filter((a) => ATTACK_STYLES.includes(a.style) && DAMAGE_TYPES.includes(a.type));
}

// Your best way of hitting a monster, as a share of the best there is (1 = its weakness).
export function yourMatch(profile, data, monsterHrid) {
    const weak = weakTo(data, monsterHrid);
    let best = null;
    for (const a of yourAttacks(profile, data)) {
        const score = hitScore(data, monsterHrid, a.style, a.type);
        if (!best || score > best.score) best = { ...a, score };
    }
    return best ? { ...best, share: best.score / weak.best } : null;
}

export function monsterAttack(data, monsterHrid) {
    const stats = data.combatMonsterDetailMap[monsterHrid].combatDetails.combatStats || {};
    return { style: (stats.combatStyleHrids?.[0] || "").split("/").pop(), type: (stats.damageType || "").split("/").pop() };
}

// A weapon for an attack style: the best you own that you can wear, else the cheapest on the market.
export function styleWeapon(profile, data, style) {
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
    if (weapon) weapon.slot = data.itemDetailMap[weapon.hrid].equipmentDetail.type.split("/").pop();
    return weapon;
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

// Which curve goes further: the higher 50% level, then the higher safe level, then more wins at the lowest level.
function better(a, b) {
    const key = (m) => [m.half ?? -1, m.safe ?? -1, m.curve.length ? rate(m.curve[0]) : 0];
    const [x, y] = [key(a), key(b)];
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i];
    return false;
}

// Win rate by room level against each monster: levels 5, 10, 20 … 200, and every 2 levels
// where you go from winning safely to hardly ever.
async function simulateCurves(pool, fighter, monsters, rooms, onProgress) {
    const coarse = monsters.flatMap((monster) => COARSE_LEVELS.map((level, i) => ({ monster, level, seed: i })));
    const fine = [];
    let before = 0; // jobs of the earlier round, for the progress bar
    const run = (points) => pool.runAll(pointsToJobs(fighter, points, rooms), (done) => onProgress?.(before + done, coarse.length + fine.length));
    const coarseResults = await run(coarse);
    before = coarse.length;

    const curves = new Map(monsters.map((m) => [m, []]));
    coarse.forEach((p, i) => curves.get(p.monster).push({ level: p.level, ...coarseResults[i] }));
    for (const monster of monsters) {
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

// Every setup (a saved loadout, or what you wear) against every Labyrinth monster, with
// the crates you chose; per monster the setup that goes furthest.
// setups: [{ id, name, profile }]
export async function analyzeLabyrinth(pool, setups, data, settings, character, onProgress) {
    const accuracy = LAB_ACCURACY[settings.accuracy] || LAB_ACCURACY.normal;
    const crates = chosenCrates(settings, character);
    const monsters = labyrinthMonsters(data);
    const results = [];
    for (const [i, setup] of setups.entries()) {
        const curves = await simulateCurves(pool, roomFighter(setup.profile, data, crates), monsters, accuracy.rooms, (done, total) =>
            onProgress?.(i * 1000 + Math.round((1000 * done) / Math.max(1, total)), setups.length * 1000)
        );
        results.push({ id: setup.id, name: setup.name, monsters: curves });
    }
    const best = monsters.map((hrid, m) => {
        let pick = null;
        for (const setup of results) if (!pick || better(setup.monsters[m], pick.monster)) pick = { setup, monster: setup.monsters[m] };
        return { ...pick.monster, setupId: pick.setup.id, setupName: pick.setup.name };
    });
    return { crates, rooms: accuracy.rooms, setups: results, monsters: best };
}

// ---------- what takes you further ----------

const SKILL_STEP = 5;
const ABILITY_STEP = 5;
const SKILL_LABEL = { stamina: "Stamina", intelligence: "Intelligence", attack: "Attack", melee: "Melee", defense: "Defense", ranged: "Ranged", magic: "Magic" };

// Things to work on: the next crates, a few levels in each combat skill and in each
// ability the setup uses, and an ability you know in place of one it uses.
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
    // Off-style abilities can cost more than they give (spells cast in a crossbow's place).
    profile.abilities.forEach((entry, slot) => {
        if (!entry || slot === 0) return;
        const changed = cloneProfile(profile);
        changed.abilities[slot] = null;
        list.push({ id: `drop:${entry.hrid}`, kind: "swap", hrid: null, replaces: entry.hrid, slot, label: `Without ${data.abilityDetailMap[entry.hrid]?.name || entry.hrid}`, crates, profile: changed });
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

// Where to measure a change against a monster: the level where you win about half the
// rooms, and how many rooms a level costs there (at least 1% a level, so a flat curve
// can't blow up the gain).
function edgeOf(m, seed) {
    const level = Math.round(Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, m.half ?? MIN_LEVEL)));
    const here = winAt(m.curve, level);
    const below = [...m.curve].reverse().find((p) => p.level <= level - 1 && rate(p) > here) || m.curve[0];
    const above = m.curve.find((p) => p.level >= level + 1 && rate(p) < here) || m.curve[m.curve.length - 1];
    const slope = above.level > below.level ? (rate(below) - rate(above)) / (above.level - below.level) : 0;
    return { hrid: m.hrid, level, slope: Math.max(0.01, slope), seed };
}

// Simulates setups against edges; returns per setup and edge the rooms won, lost and
// timed out. A setup with repeat: n runs n times with other seeds, summed. The random
// streams of two setups part ways within a few attacks (any other ability, say), so every
// change is compared with one setup now: that one gets several runs, or its luck in one
// run would count for or against every change.
// setups: [{ profile, crates, edges: [edge], repeat? }]
const BASE_REPEAT = 4;
async function atEdges(pool, data, setups, rooms, seedShift, onProgress) {
    const jobs = [];
    for (const setup of setups) {
        const fighter = roomFighter(setup.profile, data, setup.crates);
        for (let k = 0; k < (setup.repeat || 1); k++) {
            for (const edge of setup.edges) jobs.push({ ...fighter, monsterHrid: edge.hrid, roomLevel: edge.level, attempts: rooms, seed: seedFor(edge.seed + seedShift + 7919 * k) });
        }
    }
    const results = await pool.runAll(jobs, onProgress);
    let next = 0;
    return setups.map((setup) => {
        const sums = setup.edges.map(() => ({ attempts: 0, wins: 0, deaths: 0, timeouts: 0 }));
        for (let k = 0; k < (setup.repeat || 1); k++) {
            sums.forEach((sum) => {
                const r = results[next++];
                for (const key of Object.keys(sum)) sum[key] += r[key];
            });
        }
        return sums;
    });
}

// Each change against each monster at its edge, every monster with the setup that does
// best against it. The gain in won rooms is turned into room levels with how fast your win
// rate falls there; a change averages over all ten monsters (0 where it doesn't apply).
export async function analyzeImprovements(pool, setups, data, settings, lab, onProgress) {
    const accuracy = LAB_ACCURACY[settings.accuracy] || LAB_ACCURACY.normal;
    const byId = new Map(setups.map((s) => [s.id, s]));
    const groups = new Map(); // setup id -> { profile, edges, candidates }
    lab.monsters.forEach((m, i) => {
        const setup = byId.get(m.setupId) || setups[0];
        if (!groups.has(setup.id)) groups.set(setup.id, { setup, edges: [], candidates: improvementCandidates(setup.profile, data, lab.crates) });
        groups.get(setup.id).edges.push(edgeOf(m, 1000 + i));
    });
    const runs = [];
    for (const group of groups.values()) {
        runs.push({ profile: group.setup.profile, crates: lab.crates, edges: group.edges, repeat: BASE_REPEAT });
        for (const c of group.candidates) runs.push({ profile: c.profile, crates: c.crates, edges: group.edges });
    }
    const results = await atEdges(pool, data, runs, accuracy.improveRooms, 0, onProgress);

    const combined = new Map(); // candidate id (setup-specific for swaps) -> entry
    const base = [];
    let r = 0;
    for (const group of groups.values()) {
        const own = results[r++];
        group.edges.forEach((edge, i) => base.push({ hrid: edge.hrid, level: edge.level, setupName: group.setup.name, win: rate(own[i]), deaths: own[i].deaths / own[i].attempts, timeouts: own[i].timeouts / own[i].attempts }));
        for (const c of group.candidates) {
            const theirs = results[r++];
            const id = c.kind === "swap" ? `${group.setup.id}:${c.id}` : c.id;
            const { profile: _p, crates: _c, ...rest } = c;
            if (!combined.has(id)) combined.set(id, { ...rest, setupName: group.setup.name, perMonster: [] });
            group.edges.forEach((edge, i) => {
                const gain = rate(theirs[i]) - rate(own[i]);
                combined.get(id).perMonster.push({ hrid: edge.hrid, level: edge.level, before: rate(own[i]), after: rate(theirs[i]), levels: Math.max(-50, Math.min(50, gain / edge.slope)) });
            });
        }
    }
    const candidates = [...combined.values()].map((c) => ({ ...c, levels: c.perMonster.reduce((sum, m) => sum + m.levels, 0) / lab.monsters.length }));
    return { rooms: accuracy.improveRooms, base, candidates };
}

// ---------- building a loadout for some room types ----------

// The monsters a style is meant for: those whose weakness includes it.
export function monstersFor(data, style) {
    return labyrinthMonsters(data).filter((hrid) => weakTo(data, hrid).styles.some((s) => s.style === style));
}

const SCREEN_SHARE = 0.5; // the first round runs half the rooms
const PER_SLOT = 3; // the most promising purchases per slot go on to the rounds (free changes always do)
const ROUNDS = 6; // the most changes the list takes
const MIN_LEVELS = 0.5; // a change must take you this many room levels further on average
// Spending: room levels a purchase must give per 1M coins.
export const LEVELS_PER_MILLION = { frugal: 2, balanced: 0.5, all: 0 };
const ROUND_ROOMS = 2; // the rounds run twice the rooms of the improvement check
const CONFIRM_TRIES = 3; // changes tried per round before the list is done

// A tested change put onto another setup (the list so far).
function applyCandidate(profile, c) {
    const out = cloneProfile(profile);
    const index = c.slot?.startsWith("ability") ? Number(c.slot.replace("ability", "")) : null;
    if (c.kind === "gear") equip(out, c.slot, { hrid: c.hrid, enhancementLevel: c.enhancementLevel });
    else if (c.kind === "ability" || c.kind === "abilityLevel") out.abilities[index] = { hrid: c.hrid, level: c.level };
    else if (c.kind === "drop") out.abilities[index] = null;
    else if (c.kind === "dropAll") out.abilities = out.abilities.map((entry, i) => (i === 0 ? entry : null));
    else if (c.kind === "triggers") out.abilityTriggers = { ...out.abilityTriggers, ...Object.fromEntries(out.abilities.filter(Boolean).map((a) => [a.hrid, []])) };
    return out;
}

// A loadout for the rooms one attack style is for, from a setup you have: another style
// starts from a weapon for it (yours, else the cheapest), then every piece of gear and
// every ability (new, or levelled with books) that fits the budget is tried against those
// monsters, and taking abilities off and running them without triggers too. Ranked by room levels per coin,
// one per slot, within the budget; the whole list is then simulated as one.
// opts: { style, budget, enhanceCost, crates }
export async function buildLoadout(pool, profile, data, settings, opts, onProgress) {
    const accuracy = LAB_ACCURACY[settings.accuracy] || LAB_ACCURACY.normal;
    const { style, crates } = opts;
    let budget = Math.max(0, Number(opts.budget) || 0);
    const minPerMillion = LEVELS_PER_MILLION[settings.spending] ?? LEVELS_PER_MILLION.balanced;
    const targets = monstersFor(data, style);
    if (!targets.length) throw new Error(`No Labyrinth monster is weak to ${style}.`);

    let start = cloneProfile(profile);
    let starter = null;
    if (yourStyle(profile, data) !== style) {
        starter = styleWeapon(profile, data, style);
        if (!starter) throw new Error(`No ${style} weapon you can wear is for sale.`);
        starter.replaces = weaponOf(profile);
        equip(start, starter.slot, { hrid: starter.hrid, enhancementLevel: starter.enhancementLevel });
        budget = Math.max(0, budget - starter.cost);
    }
    start.food = [];
    start.drinks = [];

    // Steps of the bar: the curves now (3), the first round (5), up to 6 rounds (1 each).
    const steps = 14;
    const part = (from, size) => (done, total) => onProgress?.(Math.round(((from + (size * done) / Math.max(1, total)) * 1000) / steps), 1000);

    const before = await simulateCurves(pool, roomFighter(start, data, crates), targets, accuracy.rooms, part(0, 3));
    const edges = before.map((m, i) => edgeOf(m, 2000 + i));

    const subStyle = (c) => c.kind !== "gear" || !["main_hand", "two_hand"].includes(c.slot) || data.itemDetailMap[c.hrid]?.equipmentDetail?.combatStats?.combatStyleHrids?.[0] === "/combat_styles/" + style;
    const candidates = [
        // A loadout of its own sells nothing: what it replaces is still worn in your other loadouts.
        ...gearCandidates(start, { budget, starter, enhanceCost: opts.enhanceCost })
            .filter((c) => c.slot !== "pouch" && !c.extraFood && subStyle(c))
            .map((c) => ({ ...c, cost: c.price ?? c.cost, resale: 0, sold: [] }))
            .filter((c) => c.cost <= budget),
        ...abilityCandidates(start, budget),
    ];
    // Taking abilities off: spells of another style can cost more than they give.
    start.abilities.forEach((entry, index) => {
        if (!entry || index === 0) return;
        const without = cloneProfile(start);
        without.abilities[index] = null;
        candidates.push({ kind: "drop", slot: "ability" + index, hrid: entry.hrid, cost: 0, owned: true, profile: without });
    });
    if (start.abilities.slice(1).filter(Boolean).length > 1) {
        const bare = cloneProfile(start);
        bare.abilities = bare.abilities.map((entry, index) => (index === 0 ? entry : null));
        candidates.push({ kind: "dropAll", slot: "abilities", cost: 0, owned: true, profile: bare });
    }
    const quiet = cloneProfile(start);
    quiet.abilityTriggers = Object.fromEntries(start.abilities.filter(Boolean).map((a) => [a.hrid, []]));
    candidates.push({ kind: "triggers", slot: "triggers", cost: 0, owned: true, profile: quiet });

    const scoreAt = (edgeList) => (own, base) => edgeList.reduce((sum, edge, i) => sum + Math.max(-50, Math.min(50, (rate(own[i]) - rate(base[i])) / edge.slope)), 0) / edgeList.length;
    const screenRooms = Math.max(20, Math.round(accuracy.improveRooms * SCREEN_SHARE));
    const first = await atEdges(pool, data, [{ profile: start, crates, edges, repeat: BASE_REPEAT }, ...candidates.map((c) => ({ profile: c.profile, crates, edges }))], screenRooms, 0, part(3, 5));
    candidates.forEach((c, i) => (c.levels = scoreAt(edges)(first[i + 1], first[0])));

    // Round by round: the most promising (and every free change) are measured from where
    // the list has got to, at its own edges; the best is taken – free ones first, then the
    // most room levels per coin – until nothing takes you half a level further.
    // The best few purchases per slot, so one kind (ability books, say) can't crowd out the rest.
    const bySlot = new Map();
    for (const c of candidates.filter((c) => c.cost > 0 && c.levels > 0).sort((a, b) => b.levels - a.levels)) {
        const list = bySlot.get(c.slot) || [];
        if (list.length < PER_SLOT) list.push(c);
        bySlot.set(c.slot, list);
    }
    const shortlist = [...candidates.filter((c) => c.cost === 0), ...[...bySlot.values()].flat()];
    const abilitySlots = [1, 2, 3, 4].map((i) => "ability" + i);
    const slotsOf = (c) =>
        c.slot === "two_hand" ? ["two_hand", "main_hand", "off_hand"]
        : c.slot === "main_hand" || c.slot === "off_hand" ? [c.slot, "two_hand"]
        : c.kind === "dropAll" ? [...abilitySlots, "triggers", "abilities"]
        : c.slot.startsWith("ability") && c.slot !== "ability0" ? [c.slot, "abilities"]
        : c.slot === "triggers" ? ["triggers", "abilities"]
        : [c.slot];
    const taken = new Set();
    const picks = [];
    let left = budget;
    let built = start;
    let now = before;
    let lastRound = [];
    for (let round = 0; round < ROUNDS; round++) {
        const open = shortlist.filter((c) => !picks.includes(c) && !slotsOf(c).some((x) => taken.has(x)) && c.cost <= left);
        if (!open.length) break;
        const roundEdges = now.map((m, i) => edgeOf(m, 3000 + 10 * round + i));
        const from = part(8 + round, 1);
        const results = await atEdges(pool, data, [{ profile: built, crates, edges: roundEdges, repeat: BASE_REPEAT }, ...open.map((c) => ({ profile: applyCandidate(built, c), crates, edges: roundEdges }))], ROUND_ROOMS * accuracy.improveRooms, 500 + round, from);
        open.forEach((c, i) => (c.roundLevels = scoreAt(roundEdges)(results[i + 1], results[0])));
        lastRound = open;
        // Free changes first, then the most room levels per coin; each must hold up in a
        // second measurement with other random numbers, or the next in line is tried.
        const worth = (c) => c.roundLevels >= MIN_LEVELS && (c.cost === 0 || c.roundLevels / (c.cost / 1e6) >= minPerMillion);
        const good = open.filter(worth);
        const order = [...good.filter((c) => c.cost === 0).sort((a, b) => b.roundLevels - a.roundLevels), ...good.filter((c) => c.cost > 0).sort((a, b) => b.roundLevels / b.cost - a.roundLevels / a.cost)];
        let pick = null;
        for (const [k, c] of order.slice(0, CONFIRM_TRIES).entries()) {
            const check = await atEdges(pool, data, [{ profile: built, crates, edges: roundEdges, repeat: BASE_REPEAT }, { profile: applyCandidate(built, c), crates, edges: roundEdges, repeat: ROUND_ROOMS }], accuracy.improveRooms, 900 + 10 * round + k);
            c.roundLevels = (c.roundLevels + scoreAt(roundEdges)(check[1], check[0])) / 2;
            if (worth(c)) {
                pick = c;
                break;
            }
        }
        if (!pick) break;
        pick.levels = pick.roundLevels;
        picks.push(pick);
        slotsOf(pick).forEach((x) => taken.add(x));
        left -= pick.cost;
        built = applyCandidate(built, pick);
        now = await simulateCurves(pool, roomFighter(built, data, crates), targets, accuracy.rooms, part(8 + round, 1));
    }
    const after = now;
    onProgress?.(1000, 1000);
    const strip = ({ profile: _p, ...rest }) => rest;
    return {
        style,
        targets,
        starter,
        budget: Number(opts.budget) || 0,
        spent: (starter && !starter.owned ? starter.cost : 0) + picks.reduce((sum, p) => sum + p.cost, 0),
        before,
        after,
        picks: picks.map(strip),
        // The best of the rest, for "also tested".
        // The best of the rest in the last round, measured from (nearly) the finished list.
        nearMisses: lastRound.filter((c) => !picks.includes(c) && c.roundLevels > 0).sort((a, b) => b.roundLevels - a.roundLevels).slice(0, 6).map((c) => ({ ...strip(c), levels: c.roundLevels })),
        tested: candidates.length,
        profile: built,
    };
}
