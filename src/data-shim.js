// Shared, mutable game-data tables used by the bundled simulator engine.
// The build replaces every `import x from "./data/<name>.json"` in engine/ with
// `slot("<name>")`, so the engine reads whatever the worker was initialised with
// (the live data from the game client) instead of a stale bundled copy.

const ARRAY_TABLES = new Set(["enhancementLevelTotalBonusMultiplierTable", "abilitySlotsLevelRequirementList"]);

const store = (globalThis.__MWIA_DATA ||= {});

export function slot(name) {
    if (!store[name]) {
        store[name] = ARRAY_TABLES.has(name) ? [] : {};
    }
    return store[name];
}

export function fill(data) {
    for (const [name, value] of Object.entries(data)) {
        const target = slot(name);
        if (Array.isArray(target)) {
            target.length = 0;
            target.push(...value);
        } else {
            for (const key of Object.keys(target)) delete target[key];
            Object.assign(target, value);
        }
    }
}

// Tables the engine imports; the main thread sends exactly these to the workers.
export const ENGINE_TABLES = [
    "abilityDetailMap",
    "achievementDetailMap",
    "achievementTierDetailMap",
    "actionDetailMap",
    "combatMonsterDetailMap",
    "combatStyleDetailMap",
    "combatTriggerDependencyDetailMap",
    "enhancementLevelTotalBonusMultiplierTable",
    "houseRoomDetailMap",
    "itemDetailMap",
    "labyrinthCrateDetailMap",
];
