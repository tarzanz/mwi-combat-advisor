// Combat loadouts: which one is picked and the profile it gives (gear, inventory,
// food, drinks, abilities, triggers), against the game's characterLoadoutMap.
// Usage: node test/loadout-test.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { applyLoadout, buildProfile, chooseLoadout, combatLoadouts } from "../src/profile.js";
import { fixtureCharacter } from "./fixture-character.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataDir = path.join(root, "engine/data");
const data = {};
for (const f of readdirSync(dataDir)) data[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const character = fixtureCharacter();
const loc = (type) => "/item_locations/" + type;
const hashOf = (hrid, type, level = 0) => `1::${loc(type)}::${hrid}::${level}`;
// What you own besides the fixture: a Ring of Regeneration and a Trainee Melee Charm in the inventory, a +2 hat too.
let n = 100;
const own = (itemHrid, location, enhancementLevel = 0, count = 1) =>
    character.characterItems.push({ hash: `1::${loc(location)}::${itemHrid}::${enhancementLevel}#${++n}`, itemHrid, itemLocationHrid: loc(location), enhancementLevel, count });
own("/items/ring_of_regeneration", "inventory");
own("/items/trainee_melee_charm", "inventory");
own("/items/cheese_helmet", "inventory", 2);
character.characterAbilities.push({ abilityHrid: "/abilities/fireball", level: 3, experience: 0, slotNumber: 0 });

character.characterLoadoutMap = {
    7: {
        name: "Skilling",
        actionTypeHrid: "/action_types/milking",
        isDefault: true,
        ordinal: 0,
        wearableMap: {},
    },
    3: {
        name: "Melee training",
        actionTypeHrid: "/action_types/combat",
        isDefault: true,
        ordinal: 2,
        useExactEnhancement: false,
        wearableMap: {
            [loc("main_hand")]: hashOf("/items/birch_water_staff", "main_hand"),
            [loc("body")]: hashOf("/items/cotton_robe_top", "body"),
            [loc("head")]: hashOf("/items/cheese_helmet", "head"),
            [loc("ring")]: hashOf("/items/ring_of_regeneration", "ring"),
            [loc("charm")]: hashOf("/items/trainee_melee_charm", "charm"),
            [loc("neck")]: hashOf("/items/necklace_of_speed", "neck"),
            [loc("milking_tool")]: hashOf("/items/cheese_brush", "milking_tool"),
        },
        foodItemHrids: ["/items/donut", "", ""],
        drinkItemHrids: ["/items/stamina_coffee", "", ""],
        abilityMap: { 1: "/abilities/fireball", 2: "/abilities/water_strike", 3: "/abilities/not_learned" },
        abilityCombatTriggersMap: { "/abilities/fireball": [{ dependencyHrid: "/combat_trigger_dependencies/targeted_enemy", conditionHrid: "/combat_trigger_conditions/current_hp", comparatorHrid: "/combat_trigger_comparators/greater_than_equal", value: 1 }] },
        consumableCombatTriggersMap: {},
    },
    5: { name: "Exact", actionTypeHrid: "/action_types/combat", isDefault: false, ordinal: 1, useExactEnhancement: true, wearableMap: { [loc("head")]: hashOf("/items/cheese_helmet", "head", 1) } },
};

const items = new Map(character.characterItems.map((i) => ["h:" + i.hash, i]));
const worn = buildProfile(character, items, data);

// ---------- which loadout ----------
check("only combat loadouts are offered, in the game's order", combatLoadouts(character).map((l) => l.name).join(",") === "Exact,Melee training");
check("auto picks the default combat loadout, not a skilling default", chooseLoadout(character, "auto")?.name === "Melee training");
check("a chosen loadout by id", chooseLoadout(character, "5")?.name === "Exact");
check("equipped means no loadout", chooseLoadout(character, "equipped") === null);
check("a deleted loadout falls back to the default", chooseLoadout(character, "99")?.name === "Melee training");
check("no loadouts: the gear you wear", chooseLoadout({ characterLoadoutMap: {} }, "auto") === null && chooseLoadout({}, "auto") === null);

// ---------- the profile it gives ----------
const p = applyLoadout(worn, chooseLoadout(character, "auto"), items, data);
check("the loadout's ring and charm are worn", p.equipment.ring?.hrid === "/items/ring_of_regeneration" && p.equipment.charm?.hrid === "/items/trainee_melee_charm");
check("the highest +level you have is used (no exact enhancement)", p.equipment.head?.enhancementLevel === 2);
check("a slot the loadout leaves out is empty", !p.equipment.legs && !p.equipment.feet);
check("tool slots are not combat gear", !Object.keys(p.equipment).some((k) => k.includes("tool")));
check("gear you don't have is listed as missing", p.loadout.missing.length === 1 && p.loadout.missing[0].hrid === "/items/necklace_of_speed" && !p.equipment.neck);
const inv = (hrid, level = 0) => p.inventory.filter((i) => i.hrid === hrid && i.enhancementLevel === level).reduce((s, i) => s + i.count, 0);
check("what the loadout puts on leaves the inventory", inv("/items/ring_of_regeneration") === 0 && inv("/items/trainee_melee_charm") === 0 && inv("/items/cheese_helmet", 2) === 0);
check("worn gear the loadout takes off goes to the inventory", inv("/items/cotton_robe_bottoms") === 1 && inv("/items/rough_boots") === 1 && inv("/items/cheese_helmet", 0) === 1);
check("the rest of the inventory is kept", inv("/items/donut") === 300 && inv("/items/linen_gloves") === 1);
check("food and drinks from the loadout", p.food[0] === "/items/donut" && p.food[1] === null && p.drinks[0] === "/items/stamina_coffee");
check("abilities in the loadout's order at your levels; one you haven't learned is skipped",
    p.abilities[1]?.hrid === "/abilities/fireball" && p.abilities[1].level === 3 && p.abilities[2]?.hrid === "/abilities/water_strike" && p.abilities[2].level === 6 && !p.abilities[3]);
check("the loadout's triggers win", p.abilityTriggers["/abilities/fireball"]?.[0]?.value === 1);
check("levels and the rest are the character's", p.levels.magic === worn.levels.magic && p.houseRooms === worn.houseRooms);
check("the worn profile is untouched", worn.equipment.legs?.hrid === "/items/cotton_robe_bottoms" && !worn.loadout);

const exact = applyLoadout(worn, chooseLoadout(character, "5"), items, data);
check("exact enhancement: a +level you don't have is missing", !exact.equipment.head && exact.loadout.missing[0]?.enhancementLevel === 1);
check("a loadout without consumables or abilities keeps yours", exact.food === worn.food && exact.abilities === worn.abilities);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll loadout checks passed");
process.exit(failures ? 1 : 0);
