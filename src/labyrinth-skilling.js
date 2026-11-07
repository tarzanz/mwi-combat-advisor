// The chance to clear a Labyrinth skilling room, worked out exactly (no simulation), with
// the rules of the community's Labyrinth Clear Rate Calculator (greasyfork 566829):
// - 2 minutes; an action takes 10 s (Enhancing 8 s) / (1 + action speed): that many tries.
// - Each try succeeds with 0.8 × (1 + level bonus + success bonus); the level bonus is +0.5%
//   a level your effective level is above the room's, −1% a level below.
// - A success adds floor(effective level × (1 + efficiency)) progress, twice that with the
//   double-progress chance (crate, shop, Gathering for milking/foraging/woodcutting,
//   Gourmet for cooking/brewing); the room needs room level × 10.
// - Enhancing: a success +1 level, a failure −1, until +5.
// Effective level: your level plus level buffs (tea crate, equipment, house …). Buffs come
// from your equipment, house, community buffs, achievements and the Moo Pass – not teas or
// coffees (none in the Labyrinth) – plus the tea crate and the shop's skilling upgrades.

export const ROOM_SECONDS = 120;
const ACTION_SECONDS = 10;
const ENHANCING_SECONDS = 8;
const ENHANCING_TARGET = 5;
const BUFF_MAPS = ["equipmentActionTypeBuffsMap", "houseActionTypeBuffsMap", "communityActionTypeBuffsMap", "achievementActionTypeBuffsMap", "mooPassActionTypeBuffsMap"];
const GATHERING = ["milking", "foraging", "woodcutting"];
const GOURMET = ["cooking", "brewing"];

const amount = (b) => (Number(b.flatBoost) || 0) + (Number(b.flatBoostLevelBonus) || 0) + (Number(b.ratioBoost) || 0) + (Number(b.ratioBoostLevelBonus) || 0);

// What a list of buffs gives a skill in a skilling room.
export function skillingBuffs(skill, buffs) {
    const out = { level: 0, efficiency: 0, speed: 0, success: 0, double: 0 };
    for (const b of buffs || []) {
        if (!b?.typeHrid) continue;
        const t = b.typeHrid;
        const x = amount(b);
        if (t === `/buff_types/${skill}_level`) out.level += x;
        else if (t === "/buff_types/efficiency") out.efficiency += x;
        else if (t === "/buff_types/action_speed") out.speed += x;
        else if (t === "/buff_types/labyrinth_double_progress") out.double += x;
        else if (t === "/buff_types/gathering" && GATHERING.includes(skill)) out.double += x;
        else if (t === "/buff_types/gourmet" && GOURMET.includes(skill)) out.double += x;
        else if (t === "/buff_types/success_rate" || t === `/buff_types/${skill}_success`) out.success += x;
    }
    return out;
}

// The chance to reach `units` steps in `tries`, a try failing (q0: no step, or one back when
// `fallBack`), succeeding (one step) or succeeding twice over (two).
function reachChance(tries, units, success, double, fallBack) {
    if (units <= 0) return 1;
    if (success <= 0 || units > tries * 2) return 0;
    const q0 = 1 - success;
    const q1 = success * (1 - double);
    const q2 = success * double;
    let dist = new Float64Array(units + 1);
    dist[0] = 1;
    for (let t = 0; t < tries; t++) {
        const next = new Float64Array(units + 1);
        next[units] = dist[units];
        for (let u = 0; u < units; u++) {
            const p = dist[u];
            if (!p) continue;
            next[fallBack ? Math.max(0, u - 1) : u] += p * q0;
            next[Math.min(units, u + 1)] += p * q1;
            next[Math.min(units, u + 2)] += p * q2;
        }
        dist = next;
    }
    return Math.min(1, Math.max(0, dist[units]));
}

// room: { skill: "milking", level } · who: { level, buffs: [buff lists], crateBuffs, shop: { speed, efficiency, success, double } (levels) }
export function skillingRoomChance(room, who) {
    const b = { level: 0, efficiency: 0, speed: 0, success: 0, double: 0 };
    for (const list of [...(who.buffs || []), who.crateBuffs || []]) {
        const x = skillingBuffs(room.skill, list);
        for (const k in b) b[k] += x[k];
    }
    const shop = who.shop || {};
    b.speed += 0.01 * (shop.speed || 0);
    b.efficiency += 0.01 * (shop.efficiency || 0);
    b.success += 0.005 * (shop.success || 0);
    b.double += 0.01 * (shop.double || 0);

    const level = (who.level || 0) + b.level;
    const delta = level - room.level;
    const success = Math.min(1, Math.max(0, 0.8 * (1 + (delta >= 0 ? 0.005 : 0.01) * delta + b.success)));
    const double = Math.min(1, Math.max(0, b.double));
    const enhancing = room.skill === "enhancing";
    const seconds = (enhancing ? ENHANCING_SECONDS : ACTION_SECONDS) / Math.max(0.05, 1 + b.speed);
    const tries = Math.max(1, Math.floor(ROOM_SECONDS / seconds));
    if (enhancing) return { chance: reachChance(tries, ENHANCING_TARGET, success, double, true), level, success, double, tries, needed: ENHANCING_TARGET };
    const perSuccess = Math.max(0, Math.floor(level * (1 + b.efficiency)));
    const needed = perSuccess > 0 ? Math.ceil((room.level * 10) / perSuccess - 1e-9) : Infinity;
    return { chance: Number.isFinite(needed) ? reachChance(tries, needed, success, double, false) : 0, level, success, double, tries, needed };
}

// Your side of it, from the character the script keeps: the skill's level, its buffs and the
// tea crate (the run's, else the one set for the next run) and the shop's upgrades.
export function skillingWho(character, data, skill, teaCrateHrid) {
    const actionType = `/action_types/${skill}`;
    const level = (character?.characterSkills || []).find((s) => s.skillHrid === `/skills/${skill}`)?.level || 1;
    const buffs = BUFF_MAPS.map((key) => character?.[key]?.[actionType] || []);
    const crateBuffs = (teaCrateHrid && data?.labyrinthCrateDetailMap?.[teaCrateHrid]) || [];
    const info = character?.characterInfo || {};
    const shop = { speed: info.labyrinthSkillActionSpeedLevel, efficiency: info.labyrinthSkillingEfficiencyLevel, success: info.labyrinthSkillingSuccessLevel, double: info.labyrinthSkillingDoubleProgressLevel };
    return { level, buffs, crateBuffs, shop };
}
