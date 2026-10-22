// A made-up level-21 mage in the shape of the game's init_character_data.
const skill = (name, level) => ({ skillHrid: "/skills/" + name, level, experience: 0 });
let hash = 0;
const item = (itemHrid, location, enhancementLevel = 0, count = 1) => ({
    hash: "h" + ++hash,
    itemHrid,
    itemLocationHrid: "/item_locations/" + location,
    enhancementLevel,
    count,
});

export function fixtureCharacter() {
    return {
        type: "init_character_data",
        character: { id: 1, name: "TestMage" },
        characterSkills: [
            skill("stamina", 14), skill("intelligence", 17), skill("attack", 12), skill("melee", 1),
            skill("defense", 11), skill("ranged", 1), skill("magic", 21),
            skill("milking", 30), skill("foraging", 28), skill("cooking", 25), skill("brewing", 22),
        ],
        characterItems: [
            item("/items/birch_water_staff", "main_hand"),
            item("/items/cotton_robe_top", "body"),
            item("/items/cotton_robe_bottoms", "legs"),
            item("/items/cheese_helmet", "head"),
            item("/items/rough_boots", "feet"),
            item("/items/donut", "inventory", 0, 300),
            item("/items/linen_gloves", "inventory"),
            item("/items/coin", "inventory", 0, 500000),
        ],
        characterAbilities: [
            { abilityHrid: "/abilities/water_strike", level: 6, experience: Math.round(30 * 6 ** 2.2), slotNumber: 1 },
            { abilityHrid: "/abilities/poke", level: 1, experience: 0, slotNumber: 0 },
        ],
        combatUnit: { combatAbilities: [{ abilityHrid: "/abilities/water_strike", level: 6 }] },
        actionTypeFoodSlotsMap: { "/action_types/combat": [{ itemHrid: "/items/donut" }, null, null] },
        actionTypeDrinkSlotsMap: { "/action_types/combat": [null, null, null] },
        abilityCombatTriggersMap: {},
        consumableCombatTriggersMap: {},
        characterHouseRoomMap: { "/house_rooms/dojo": { houseRoomHrid: "/house_rooms/dojo", level: 1 } },
        characterAchievements: [],
        characterActions: [{ id: 5, actionHrid: "/actions/combat/fly", difficultyTier: 0, ordinal: 0 }],
        communityActionTypeBuffsMap: {},
    };
}
