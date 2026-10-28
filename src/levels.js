// Total level: what XP is worth in levels. The game's level table rises steeply,
// so the same XP buys many more levels in a low skill than in a high one.
// Levels are counted over a day of training, so a skill at level 1 isn't
// overrated by its first, very cheap level.

export const LEVEL_HORIZON_HOURS = 24;

// Level with a fraction for this much XP (table[n] = XP needed for level n).
export function fractionalLevel(table, xp) {
    let low = 1;
    let high = table.length - 1;
    if (xp >= table[high]) return high;
    while (high - low > 1) {
        const mid = (low + high) >> 1;
        if (table[mid] <= xp) low = mid;
        else high = mid;
    }
    return low + (xp - table[low]) / Math.max(1, table[low + 1] - table[low]);
}

// The XP a skill has: the game sends it; never less than the start of its level.
export function experienceOf(table, experience, level) {
    return Math.max(Number(experience) || 0, table[level] ?? 0);
}

// Levels a day of this XP rate gives, from where the skill is now.
export function levelsPerDay(table, xpNow, xpPerDay) {
    if (!(xpPerDay > 0)) return 0;
    return fractionalLevel(table, xpNow + xpPerDay) - fractionalLevel(table, xpNow);
}

// Levels per hour from XP per hour in several skills. skills: { key: { xp, level } }.
export function levelsPerHour(table, skills, xpPerHour, hours = LEVEL_HORIZON_HOURS) {
    let levels = 0;
    for (const [key, rate] of Object.entries(xpPerHour || {})) {
        const skill = skills[key];
        if (!skill || !(rate > 0)) continue;
        const now = experienceOf(table, skill.xp, skill.level);
        levels += fractionalLevel(table, now + rate * hours) - fractionalLevel(table, now);
    }
    return levels / hours;
}

// XP still needed for the next level of a skill.
export function xpToNextLevel(table, xpNow, level) {
    return table[level + 1] === undefined ? null : Math.max(0, table[level + 1] - xpNow);
}

// The next total-level requirement among the pouches, e.g. 750 for the Giant Pouch.
export function nextPouchGoal(totalLevel, data) {
    let best = null;
    for (const item of Object.values(data.itemDetailMap || {})) {
        if (item.equipmentDetail?.type !== "/equipment_types/pouch") continue;
        const need = (item.equipmentDetail.levelRequirements || []).find((r) => r.skillHrid === "/skills/total_level")?.level;
        if (need > totalLevel && (!best || need < best.level || (need === best.level && item.sortIndex < best.sortIndex))) {
            best = { level: need, hrid: item.hrid, sortIndex: item.sortIndex ?? 0 };
        }
    }
    return best;
}
