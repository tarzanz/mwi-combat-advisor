// "Skip if room level is above my skill level by ≥ N" in the game's Labyrinth automation,
// set from the chance to clear each room type: a room is worth trying when you clear it
// at least `target` of the time within `tries` tries (95% in 3 by default), and N is set so
// the automation skips every room above that level. Pure – the browser parts are in
// labyrinth-marks.js (the marks and the filling in) and the Labyrinth tab.
//
// A room's chance: a skilling room's worked out exactly (labyrinth-skilling.js) against your
// level in its skill; a combat room's read off the win curve of your last "Check the rooms"
// (the loadout it found best) against your combat level – which level the game compares a
// combat room with is not known yet: the combat level is assumed, and said so.

import { SKILLS, winAt } from "./labyrinth-run.js";
import { skillingRoomChance } from "./labyrinth-skilling.js";

// The game's default (and the most it is set to here): never skip.
export const SKIP_NEVER = 100;
export const SKIP_TRIES = 3;
export const SKIP_TARGET = 95;

const whole = (value, fallback, min, max) => (value === undefined || value === null || value === "" || !Number.isFinite(Number(value)) ? fallback : Math.max(min, Math.min(max, Math.round(Number(value)))));
const share = (value, fallback, min, max) => (value === undefined || value === null || value === "" || !Number.isFinite(Number(value)) ? fallback : Math.max(min, Math.min(max, Number(value))));

// The rule from the Labyrinth tab's settings: { tries, target (0–1) }.
export function skipRule(settings = {}) {
    return { tries: whole(settings.labySkipTries, SKIP_TRIES, 1, 20), target: Math.round(10 * share(settings.labySkipTarget, SKIP_TARGET, 50, 99.9)) / 1000 };
}

// The chance to clear a room within `tries` tries, each won with `p`.
export const clearWithin = (p, tries) => 1 - Math.pow(1 - Math.min(1, Math.max(0, p || 0)), tries);

// The highest room level from `lo` up to which every level clears by the rule (null: not even `lo`).
export function highestRoom(chanceAt, rule, lo = 1, hi = 500) {
    let best = null;
    for (let level = lo; level <= hi; level++) {
        if (clearWithin(chanceAt(level), rule.tries) < rule.target - 1e-9) break;
        best = level;
    }
    return best;
}

// The value to set: the game skips a room when its level is above yours by N or more, so
// N = the highest room worth trying + 1 − your level (at most SKIP_NEVER; with no room worth
// trying, every room is skipped).
export function skipValue(highest, myLevel) {
    if (highest === null) return Math.min(SKIP_NEVER, 1 - myLevel);
    return Math.min(SKIP_NEVER, highest + 1 - myLevel);
}

// The combat level the game shows: 0.1 × (stamina + intelligence + attack + defense + the best
// of melee, ranged and magic) + 0.5 × the best of attack, defense, melee, ranged and magic, rounded down.
export function combatLevelOf(character) {
    const level = (skill) => (character?.characterSkills || []).find((s) => s.skillHrid === `/skills/${skill}`)?.level || 1;
    const [stamina, intelligence, attack, defense, melee, ranged, magic] = ["stamina", "intelligence", "attack", "defense", "melee", "ranged", "magic"].map(level);
    return Math.floor(0.1 * (stamina + intelligence + attack + defense + Math.max(melee, ranged, magic)) + 0.5 * Math.max(attack, defense, melee, ranged, magic));
}

// Per room type, what to set:
//   skilling: who(skill) -> { level, buffs, crateBuffs, shop, penalty } (skillingWho with the run's tea crate)
//   combat: check.monsters [{ hrid, setupName, curve }] and combatLevel
// -> [{ key ("skill:milking" / "monster:/monsters/…"), skill | hrid, myLevel, highest, value, loadout }]
export function skipAdvice({ who, check, combatLevel, rule }) {
    const rows = [];
    if (who) {
        for (const skill of SKILLS) {
            const w = who(skill);
            if (!w) continue;
            const myLevel = w.level;
            const highest = highestRoom((level) => skillingRoomChance({ skill, level }, w).chance, rule, 1, myLevel + SKIP_NEVER);
            rows.push({ key: `skill:${skill}`, type: "skilling", skill, myLevel, highest, value: skipValue(highest, myLevel) });
        }
    }
    if (check?.monsters?.length && Number.isFinite(combatLevel)) {
        for (const monster of check.monsters) {
            const highest = highestRoom((level) => winAt(monster.curve, level), rule, 1, combatLevel + SKIP_NEVER);
            rows.push({ key: `monster:${monster.hrid}`, type: "combat", hrid: monster.hrid, myLevel: combatLevel, highest, value: skipValue(highest, combatLevel), loadout: monster.setupId === "equipped" ? null : monster.setupName });
        }
    }
    return rows;
}

// The value shown in a row of the game's table ("≥ 100", "≥ -5"), or what is typed while it is edited.
export function parseSkipText(text) {
    const match = String(text || "").replace(/−/g, "-").match(/≥\s*(-?\d+)/);
    return match ? Number(match[1]) : null;
}
