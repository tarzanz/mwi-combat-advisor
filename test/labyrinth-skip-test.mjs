// Skip levels for the game's Labyrinth automation: the highest room level cleared by the
// rule (95% within 3 tries by default) and the value "Skip if room level is above my skill
// level by ≥ N" that tries exactly the rooms up to it.
import { SKIP_NEVER, clearWithin, combatLevelOf, highestRoom, parseSkipText, skipAdvice, skipRule, skipValue } from "../src/labyrinth-skip.js";
import { skillingRoomChance } from "../src/labyrinth-skilling.js";

let failed = 0;
const check = (name, ok, detail = "") => {
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail !== "" ? " — " + detail : ""}`);
    if (!ok) failed++;
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

// The rule.
check("default rule: 95% within 3 tries", JSON.stringify(skipRule({})) === JSON.stringify({ tries: 3, target: 0.95 }), JSON.stringify(skipRule({})));
check("rule from the tab, kept in bounds", JSON.stringify(skipRule({ labySkipTries: "5", labySkipTarget: "90" })) === JSON.stringify({ tries: 5, target: 0.9 }) && skipRule({ labySkipTries: 0, labySkipTarget: 120 }).tries === 1 && skipRule({ labySkipTarget: 120 }).target === 0.999);

// Within three tries a room won 63.2% of the time is cleared 95% of the time.
check("clear within tries", near(clearWithin(0.5, 1), 0.5) && near(clearWithin(0.5, 3), 0.875) && clearWithin(1 - Math.cbrt(0.05), 3) >= 0.95 - 1e-12 && clearWithin(0, 5) === 0);

// A chance falling 1% a level from level 50: 95% in 3 tries needs 63.2%, reached up to level 86.
const falling = (level) => Math.max(0, Math.min(1, 1 - 0.01 * (level - 50)));
const rule = { tries: 3, target: 0.95 };
check("highest room by the rule", highestRoom(falling, rule) === 86, highestRoom(falling, rule));
check("one try asks for more", highestRoom(falling, { tries: 1, target: 0.95 }) === 55, highestRoom(falling, { tries: 1, target: 0.95 }));
check("no room cleared: null", highestRoom(() => 0.1, rule) === null);
check("a dip stops it (the first level that fails)", highestRoom((l) => (l === 30 ? 0.2 : 1), rule, 1, 100) === 29);

// The value: skip when the room is above your level by N or more.
check("value: the highest room + 1 − your level", skipValue(86, 80) === 7 && skipValue(60, 80) === -19, `${skipValue(86, 80)} / ${skipValue(60, 80)}`);
check("value: never above the game's 'never skip'", skipValue(400, 80) === SKIP_NEVER);
check("value: nothing worth trying skips every room", skipValue(null, 80) === -79);
// What the game then does with it: a room at level L is tried when L − level < N.
const tried = (level, myLevel, n) => level - myLevel < n;
check("value: tries exactly the rooms up to the highest", tried(86, 80, skipValue(86, 80)) && !tried(87, 80, skipValue(86, 80)) && tried(60, 80, skipValue(60, 80)) && !tried(61, 80, skipValue(60, 80)));

// The game's row text, as shown and while edited.
check("parse the game's row", parseSkipText("≥ 100Edit") === 100 && parseSkipText("≥ −5") === -5 && parseSkipText("≥ -12 Edit") === -12 && parseSkipText("Edit") === null);

// Combat level: the game's formula.
const character = { characterSkills: Object.entries({ stamina: 70, intelligence: 60, attack: 65, defense: 66, melee: 40, ranged: 90, magic: 50 }).map(([s, level]) => ({ skillHrid: `/skills/${s}`, level })) };
check("combat level", combatLevelOf(character) === Math.floor(0.1 * (70 + 60 + 65 + 66 + 90) + 0.5 * 90), combatLevelOf(character));

// Advice per room type: skilling worked out exactly, combat off the check's curve.
const who = (skill) => ({ level: skill === "milking" ? 60 : 30, buffs: [], crateBuffs: [], shop: {} });
const curve = [{ level: 20, wins: 20, attempts: 20 }, { level: 40, wins: 10, attempts: 20 }, { level: 60, wins: 0, attempts: 20 }];
const advice = skipAdvice({ who, check: { monsters: [{ hrid: "/monsters/cyclops", setupId: 1, setupName: "Magic", curve }] }, combatLevel: 45, rule });
const milking = advice.find((a) => a.key === "skill:milking");
const exact = highestRoom((level) => skillingRoomChance({ skill: "milking", level }, who("milking")).chance, rule);
check("advice: every skill and the monster", advice.length === 11 && advice.filter((a) => a.type === "skilling").length === 10, advice.map((a) => a.key).join(", "));
check("advice: milking's highest room as worked out, and its value", milking.highest === exact && milking.value === exact + 1 - 60 && clearWithin(skillingRoomChance({ skill: "milking", level: exact }, who("milking")).chance, 3) >= 0.95 && clearWithin(skillingRoomChance({ skill: "milking", level: exact + 1 }, who("milking")).chance, 3) < 0.95, JSON.stringify(milking));
const cyclops = advice.find((a) => a.key === "monster:/monsters/cyclops");
// 100% at 20 falling to 50% at 40: 63.2% at about level 34.7 → 34; value 34 + 1 − 45 = −10.
check("advice: the Cyclops off its curve, against the combat level", cyclops.highest === 34 && cyclops.value === -10 && cyclops.loadout === "Magic", JSON.stringify(cyclops));
check("advice: no check, no combat rows", skipAdvice({ who, check: null, combatLevel: 45, rule }).every((a) => a.type === "skilling"));

console.log(failed ? `${failed} check(s) failed` : "All checks passed");
process.exit(failed ? 1 : 0);
