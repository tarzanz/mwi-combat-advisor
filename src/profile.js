// Turns the captured character into a "profile" (what the player has now) and
// a profile into the DTO format the simulator engine expects.

export const COMBAT_SKILLS = ["stamina", "intelligence", "attack", "melee", "defense", "ranged", "magic"];

export const GEAR_TYPES = [
    "main_hand",
    "two_hand",
    "off_hand",
    "head",
    "body",
    "legs",
    "feet",
    "hands",
    "neck",
    "earrings",
    "ring",
    "back",
    "pouch",
    "charm",
];

const INVENTORY = "/item_locations/inventory";
const COMBAT = "/action_types/combat";

function emptyTriggers(list) {
    return (list || []).map((t) => ({
        dependencyHrid: t.dependencyHrid,
        conditionHrid: t.conditionHrid,
        comparatorHrid: t.comparatorHrid,
        value: t.value ?? 0,
    }));
}

// Combat styles by the weapon: melee covers stab, slash and smash.
export const STYLES = {
    magic: ["/combat_styles/magic"],
    ranged: ["/combat_styles/ranged"],
    melee: ["/combat_styles/stab", "/combat_styles/slash", "/combat_styles/smash"],
};
export const STYLE_NAMES = { magic: "Magic", ranged: "Ranged", melee: "Melee" };

// The style a weapon fights with (null for anything that isn't a weapon).
export function styleOfItem(item) {
    const first = item?.equipmentDetail?.combatStats?.combatStyleHrids?.[0];
    return Object.keys(STYLES).find((style) => STYLES[style].includes(first)) || null;
}

export function weaponOf(profile) {
    return profile.equipment.main_hand || profile.equipment.two_hand || null;
}

// Without a weapon the game punches (smash), which is melee.
export function weaponStyle(profile, data) {
    const weapon = weaponOf(profile);
    return (weapon && styleOfItem(data.itemDetailMap[weapon.hrid])) || "melee";
}

// The skills a style's kills train: 30% to the weapon's skill, 70% split over these
// (or all to the charm's focus skill when it is one of them).
export function styleSkills(style, data) {
    const map = data.combatStyleDetailMap?.[STYLES[style][0]]?.skillExpMap;
    return map ? Object.keys(map).map((hrid) => hrid.split("/").pop()) : ["stamina", "intelligence", "attack", "defense", style];
}

export function combatLevel(levels) {
    const { stamina, intelligence, attack, melee, defense, ranged, magic } = levels;
    return 0.1 * (stamina + intelligence + attack + defense + Math.max(melee, ranged, magic)) + 0.5 * Math.max(attack, defense, melee, ranged, magic);
}

export function buildProfile(character, items, data) {
    const allLevels = {};
    const allExperience = {};
    for (const skill of character.characterSkills || []) {
        allLevels[skill.skillHrid] = skill.level;
        allExperience[skill.skillHrid] = skill.experience ?? null;
    }
    const levels = {};
    for (const skill of COMBAT_SKILLS) levels[skill] = allLevels["/skills/" + skill] ?? 1;
    const totalLevel =
        allLevels["/skills/total_level"] ??
        Object.entries(allLevels)
            .filter(([hrid]) => hrid !== "/skills/total_level")
            .reduce((sum, [, level]) => sum + level, 0);

    const equipment = {};
    const inventory = [];
    for (const item of items.values()) {
        if (!item.itemHrid) continue;
        if (item.itemLocationHrid === INVENTORY) {
            inventory.push({ hrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0, count: item.count ?? 1 });
            continue;
        }
        const type = item.itemLocationHrid?.split("/").pop();
        if (GEAR_TYPES.includes(type)) equipment[type] = { hrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 };
    }

    const food = (character.actionTypeFoodSlotsMap?.[COMBAT] || []).map((slot) => slot?.itemHrid || null);
    const drinks = (character.actionTypeDrinkSlotsMap?.[COMBAT] || []).map((slot) => slot?.itemHrid || null);

    const learnedAbilities = {};
    const abilityExperience = {};
    for (const ability of character.characterAbilities || []) {
        learnedAbilities[ability.abilityHrid] = ability.level || 1;
        abilityExperience[ability.abilityHrid] = ability.experience || 0;
    }

    // Equipped abilities: index 0 is the special slot, 1-4 the normal slots in priority order.
    const abilities = [null, null, null, null, null];
    // combatUnit.combatAbilities is the live equipped set; characterAbilities carries the slot order.
    const slotOf = {};
    for (const ability of character.characterAbilities || []) slotOf[ability.abilityHrid] = ability.slotNumber ?? 0;
    const combatAbilities = character.combatUnit?.combatAbilities;
    const equipped = (
        Array.isArray(combatAbilities) && combatAbilities.length
            ? [...combatAbilities]
            : (character.characterAbilities || []).filter((a) => a.slotNumber > 0)
    ).sort((a, b) => (slotOf[a.abilityHrid] ?? 0) - (slotOf[b.abilityHrid] ?? 0));
    let next = 1;
    for (const ability of equipped) {
        if (!ability?.abilityHrid) continue;
        const entry = { hrid: ability.abilityHrid, level: ability.level || learnedAbilities[ability.abilityHrid] || 1 };
        if (data.abilityDetailMap[ability.abilityHrid]?.isSpecialAbility) abilities[0] = entry;
        else if (next <= 4) abilities[next++] = entry;
    }

    const houseRooms = {};
    for (const room of Object.values(character.characterHouseRoomMap || {})) houseRooms[room.houseRoomHrid] = room.level;

    const achievements = {};
    for (const achievement of character.characterAchievements || []) {
        if (achievement.isCompleted) achievements[achievement.achievementHrid] = true;
    }

    // Buffs the engine cannot derive from gear/house/achievements itself.
    const extraBuffs = [];
    for (const map of ["communityActionTypeBuffsMap", "mooPassActionTypeBuffsMap", "personalActionTypeBuffsMap", "guildActionTypeBuffsMap"]) {
        for (const buff of character[map]?.[COMBAT] || []) {
            if (!buff?.typeHrid) continue;
            extraBuffs.push({
                uniqueHrid: buff.uniqueHrid || map + buff.typeHrid,
                typeHrid: buff.typeHrid,
                ratioBoost: buff.ratioBoost || 0,
                ratioBoostLevelBonus: 0,
                flatBoost: buff.flatBoost || 0,
                flatBoostLevelBonus: 0,
                duration: 0,
            });
        }
    }

    const combatAction = (character.characterActions || []).find((a) => a.actionHrid?.startsWith("/actions/combat/"));

    return {
        name: character.character?.name || "",
        levels,
        allLevels,
        allExperience,
        totalLevel,
        equipment,
        inventory,
        food,
        drinks,
        abilities,
        learnedAbilities,
        abilityExperience,
        abilityTriggers: character.abilityCombatTriggersMap || {},
        consumableTriggers: character.consumableCombatTriggersMap || {},
        houseRooms,
        achievements,
        extraBuffs,
        currentZone: combatAction ? { zoneHrid: combatAction.actionHrid, tier: combatAction.difficultyTier || 0 } : null,
    };
}

export function cloneProfile(profile) {
    return structuredClone(profile);
}

export function meetsRequirements(profile, requirements) {
    return (requirements || []).every((req) => {
        const level = req.skillHrid === "/skills/total_level" ? profile.totalLevel : profile.allLevels[req.skillHrid] ?? 0;
        return level >= req.level;
    });
}

function gearStat(data, gear, stat) {
    if (!gear) return 0;
    const detail = data.itemDetailMap[gear.hrid]?.equipmentDetail;
    return detail?.combatStats?.[stat] || 0;
}

export function slotCounts(profile, data) {
    const requirements = data.abilitySlotsLevelRequirementList || [0, 1, 1, 20, 50, 90];
    let abilitySlots = 0;
    for (let i = 1; i <= 4; i++) {
        if (profile.levels.intelligence >= (requirements[i + 1] ?? Infinity)) abilitySlots++;
    }
    return {
        food: 1 + gearStat(data, profile.equipment.pouch, "foodSlots"),
        drinks: 1 + gearStat(data, profile.equipment.pouch, "drinkSlots"),
        abilities: abilitySlots, // normal slots 1..n
        special: profile.levels.intelligence >= (requirements[1] ?? Infinity),
    };
}

export function toDTO(profile, data) {
    const slots = slotCounts(profile, data);
    const equipment = {};
    for (const [type, gear] of Object.entries(profile.equipment)) {
        if (gear) equipment["/equipment_types/" + type] = { hrid: gear.hrid, enhancementLevel: gear.enhancementLevel };
    }
    const consumable = (hrid) =>
        hrid
            ? {
                  hrid,
                  triggers: emptyTriggers(profile.consumableTriggers[hrid] || data.itemDetailMap[hrid]?.consumableDetail?.defaultCombatTriggers),
              }
            : null;
    const ability = (entry, index) => {
        if (!entry) return null;
        if (index === 0 ? !slots.special : index > slots.abilities) return null;
        return {
            hrid: entry.hrid,
            level: entry.level,
            triggers: emptyTriggers(profile.abilityTriggers[entry.hrid] || data.abilityDetailMap[entry.hrid]?.defaultCombatTriggers),
        };
    };
    return {
        hrid: "player1",
        staminaLevel: profile.levels.stamina,
        intelligenceLevel: profile.levels.intelligence,
        attackLevel: profile.levels.attack,
        meleeLevel: profile.levels.melee,
        defenseLevel: profile.levels.defense,
        rangedLevel: profile.levels.ranged,
        magicLevel: profile.levels.magic,
        equipment,
        food: profile.food.slice(0, slots.food).map(consumable),
        drinks: profile.drinks.slice(0, slots.drinks).map(consumable),
        abilities: profile.abilities.map(ability),
        houseRooms: profile.houseRooms,
        achievements: profile.achievements,
        debuffOnLevelGap: 0,
    };
}

// Puts a piece of gear on, taking care of main hand / two hand / off hand.
export function equip(profile, type, gear) {
    const equipment = profile.equipment;
    if (type === "two_hand") {
        delete equipment.main_hand;
        delete equipment.off_hand;
    } else if (type === "main_hand") {
        delete equipment.two_hand;
    }
    equipment[type] = gear;
}
