// Whole Labyrinth runs (src/labyrinth-run.js): the floors learned from recorded states, a
// run's rules on floors where every room is sure or hopeless, the level penalty fitted to
// logged attempts, and what takes you further.
// Usage: node test/labyrinth-run-test.mjs
import { SKILLS, fitPenalty, floorModel, learnModel, runSetup, shopCost, simulateLabyrinth, typeKeys, winAt } from "../src/labyrinth-run.js";
import { skillingRoomChance } from "../src/labyrinth-skilling.js";

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
const mean = (list) => [...list].reduce((a, b) => a + b, 0) / list.length;

// ---------- the floors ----------
const MONSTERS = ["cyclops", "dryad", "mimic"];
const keys = typeKeys(MONSTERS);
const plain = floorModel(null, keys);
check("floors as assumed: 4 × 4 growing to 8 × 8, levels 20 × floor … + 20, as many treasure rooms as the floor's number, every room type alike",
    plain.floors[1].size === 4 && plain.floors[5].size === 8 && plain.floors[9].size === 8 && plain.floors[1].levels[0] === 20 && plain.floors[1].levels.at(-1) === 40 && plain.floors[4].levels[0] === 80
    && plain.floors[1].treasure === 1 && plain.floors[4].treasure === 4 && plain.floors[9].treasure === 6 && Math.abs(plain.weights[0] - 1 / 13) < 1e-9 && Math.abs(plain.cumulative.at(-1) - 1) < 1e-9);

const room = (what, level, extra = {}) => (what.startsWith("/skills/") ? { roomType: "/labyrinth_room_types/skilling", skillHrid: what, recommendedLevel: level, ...extra } : { roomType: "/labyrinth_room_types/combat", monsterHrid: what, recommendedLevel: level, ...extra });
const state = (floor, rows, run = "t0", extra = {}) => ({ labyrinth: { characterID: 1, startedAt: run, isActive: true, currentFloor: floor, roomData: rows, ...extra } });
// Floor 2 seen in two states of one run (the same rooms once) and in another run: 24 rooms at levels 51–74, all milking but one.
const five = (from, what = "/skills/milking") => Array.from({ length: 5 }, (_, c) => room(what, from + c));
const fog = [null, null, null, null, null];
const cleared = { roomType: "", recommendedLevel: 0, isCleared: true };
const states = [
    state(2, [[cleared, ...five(50).slice(1)], five(55), fog, fog, fog], "t0", { totalTreasureRooms: 2 }),
    state(2, [[cleared, ...five(50).slice(1)], five(55), five(60), fog, fog], "t0", { totalTreasureRooms: 2 }),
    state(2, [five(65), five(70, "/monsters/mimic").slice(0, 1).concat(five(70).slice(1)), fog, fog, fog], "t1"),
    state(3, [[room("/skills/milking", 99)]]),
    { labyrinth: { isActive: false } },
    // A basic shroud used on a Lv.70 Mimic (it worked: 60% by the rule), then one that cleared nothing.
    state(4, [[cleared, room("/monsters/mimic", 70), room("/monsters/dryad", 90)]], "t2", { shroudCount: 2, shroudItemHrid: "/items/basic_shroud", updatedAt: "2026-01-01T10:00:00Z" }),
    state(4, [[cleared, cleared, room("/monsters/dryad", 90)]], "t2", { shroudCount: 1, shroudItemHrid: "/items/basic_shroud", updatedAt: "2026-01-01T10:00:05Z" }),
    state(4, [[cleared, cleared, room("/monsters/dryad", 90)]], "t2", { shroudCount: 0, shroudItemHrid: "/items/basic_shroud", updatedAt: "2026-01-01T10:00:09Z" }),
];
const learned = learnModel(states);
check("learned: each room once, per floor its levels, size and treasure rooms, the room types counted", learned.rooms === 27 && learned.runs === 3 && learned.floors[2].levels.length === 24 && learned.floors[2].size === 5 && learned.floors[2].treasure === 2 && learned.floors[3].levels.length === 1 && learned.types["skill:milking"] === 24 && learned.types["monster:mimic"] === 2, JSON.stringify({ rooms: learned.rooms, runs: learned.runs, types: learned.types }));
check("learned: shrouds used above their cap, how many worked and how many the rule expected to", learned.shrouds.used === 2 && learned.shrouds.worked === 1 && learned.shrouds.failed === 1 && learned.shrouds.expected === 0.6, JSON.stringify(learned.shrouds));
const model = floorModel(learned, keys);
check("a floor seen enough takes its recorded levels; the others keep the assumed ones, moved and widened like it", model.floors[2].learned && model.floors[2].levels.length === 24 && model.floors[2].treasure === 2 && !model.floors[3].learned && model.floors[3].levels[0] === 71 && model.floors[3].levels.at(-1) === 94 && model.floors[1].levels[0] === 31 && model.floors[3].treasure === 3,
    JSON.stringify([model.floors[1].levels[0], model.floors[3].levels[0], model.floors[3].levels.at(-1)]));
check("room types seen more come more often", model.weights[0] > 5 * model.weights[1] && model.weights[keys.indexOf("monster:mimic")] > model.weights[keys.indexOf("monster:dryad")]);

check("a win curve is read between its levels and held at its ends", winAt([{ level: 10, wins: 10, attempts: 10 }, { level: 20, wins: 0, attempts: 10 }], 15) === 0.5 && winAt([{ level: 10, wins: 9, attempts: 10 }], 5) === 0.9 && winAt([{ level: 10, wins: 9, attempts: 10 }, { level: 20, wins: 3, attempts: 10 }], 99) === 0.3 && winAt([], 5) === 0);

// ---------- a run ----------
const table = (p) => new Float64Array(401).fill(p);
const tables = (p) => keys.map(() => table(p));
const setup = (extra = {}) => ({ tables: tables(1), torches: 100, torchKept: 0, shrouds: 0, shroudCap: 50, shroudWorth: 4, autoFloors: 0, rushFloors: 0, maxAttempts: 1, shroudWhenStuck: true, patience: 10, ...extra });
const run = (extra, runs = 50) => runSetup(setup(extra), plain, runs);
// Every room sure: the shortest way down is 2 × (size − 1) rooms, the way down among them – 6, 8, 10, 12, then 14 a floor: 100 torches take 8 floors (92 torches).
const sure = run();
check("every room sure, by hand: straight down, a torch a room, 8 floors on 100 torches in about a minute a room", sure.exits.every((x) => x === 8) && mean(sure.minutes) > 70 && mean(sure.minutes) < 100, `${mean(sure.exits)} floors, ${mean(sure.minutes)} min`);
check("more torches, more floors; torches kept 20% of the time go further", run({ torches: 110 }).exits.every((x) => x === 9) && mean(run({ torchKept: 0.2 }, 200).exits) > 8.5);
// Trying a room again costs no torch: rooms won half the time take the same torches, and more time.
const half = run({ tables: tables(0.5) }, 300);
check("rooms won half the time: as far on the same torches (a lost try costs none), in about three times the time", mean(half.exits) > 7.9 && mean(half.minutes) > 2.5 * mean(sure.minutes) && mean(half.minutes) < 3.6 * mean(sure.minutes), `${mean(half.exits)} floors, ${mean(half.minutes)} min`);
check("six torches are a floor of six rooms, however often a room is lost", run({ tables: tables(0.5), torches: 6 }, 300).exits.filter((x) => x === 1).length >= 295);
// Patience: a room won 5% of the time is passed 40% of the time in 10 tries, 87% in 40.
const few = run({ tables: tables(0.05), patience: 10 }, 300);
const many = run({ tables: tables(0.05), patience: 40 }, 300);
check("more tries a room by hand: further, and longer", mean(many.exits) > mean(few.exits) + 0.5 && mean(many.minutes) > mean(few.minutes), `${mean(few.exits)} → ${mean(many.exits)} floors, ${mean(few.minutes)} → ${mean(many.minutes)} min`);
check("the same floors and luck: the same answer again, and better chances are never worse on average", run({ tables: tables(0.05) }, 300).exits.every((x, i) => x === few.exits[i]) && mean(run({ tables: tables(0.08) }, 300).exits) > mean(few.exits));
// Rooms never won: walls. A shroud clears one without a torch; the way down is no room to win.
check("every room hopeless: nowhere with three shrouds, one floor with five (floor 1's five rooms shrouded, the way down entered)", run({ tables: tables(0), shrouds: 3 }).exits.every((x) => x === 0) && run({ tables: tables(0), shrouds: 5 }).exits.every((x) => x === 1));
check("a shroud above its cap fails 2% a level: basic shrouds stop by floor 5 (levels 100–120), expert ones never", mean(run({ tables: tables(0), shrouds: 400, shroudCap: 50 }, 100).exits) < 4.5 && run({ tables: tables(0), shrouds: 400, shroudCap: Infinity }, 20).exits.every((x) => x === 18));
// Full automation on floor 1 does every room (15 torches, not 6) unless it rushes for the exit.
check("automation enters the whole floor (15 torches of 20: floor 2 not finished); rushing for the exit leaves enough for it", run({ torches: 20, autoFloors: 1 }).exits.every((x) => x === 1) && run({ torches: 20, autoFloors: 1, rushFloors: 1 }).exits.every((x) => x === 2));
const automated = run({ tables: tables(0.5), autoFloors: 3 }, 300);
check("rooms won half the time under automation with one attempt a room: whole floors entered, rooms given up – less far than by hand", mean(automated.exits) < mean(half.exits) - 0.5, `${mean(automated.exits)} automated, ${mean(half.exits)} by hand`);
check("three attempts a room take the automation further than one", mean(run({ tables: tables(0.5), autoFloors: 3, rushFloors: 3, maxAttempts: 3 }, 300).exits) >= mean(run({ tables: tables(0.5), autoFloors: 3, rushFloors: 3 }, 300).exits));
// One room type hopeless: by hand you go around it (or shroud it) and still get far.
const noMimic = tables(1);
noMimic[keys.indexOf("monster:mimic")] = table(0);
const around = run({ tables: noMimic }, 300);
const shrouded = run({ tables: noMimic, shrouds: 4, shroudCap: Infinity }, 300);
check("a hopeless room type is gone around, and shrouds help where there is no way around", mean(around.exits) > 5 && mean(shrouded.exits) >= mean(around.exits), `${mean(around.exits)} around, ${mean(shrouded.exits)} with shrouds`);

// ---------- the level penalty, fitted to attempts ----------
const who = (level) => ({ level, buffs: [], shop: { speed: 0, efficiency: 0, success: 0, double: 0 } });
// A character with tools and buffs: twice the speed, 30% efficiency.
const geared = (level) => ({ ...who(level), buffs: [[{ typeHrid: "/buff_types/action_speed", flatBoost: 1 }, { typeHrid: "/buff_types/efficiency", flatBoost: 0.3 }]] });
const whoThen = (skill, level) => geared(level ?? 100);
// Tries at Alchemy rooms 25–44 levels above a level 100 character, won as often as a penalty of 1.5% a level makes them.
const logged = [];
for (let above = 25; above < 45; above++) {
    const p = skillingRoomChance({ skill: "alchemy", level: 100 + above }, { ...geared(100), penalty: 0.015 }).chance;
    for (let k = 0; k < 6; k++) logged.push({ type: "skilling", what: "alchemy", level: 100 + above, outcome: k < Math.round(6 * p) ? "win" : "loss", levels: { alchemy: 100 }, crates: { tea: null } });
}
logged.push({ type: "combat", what: "cyclops", level: 30, outcome: "loss" }, { type: "skilling", what: "alchemy", level: 120, outcome: "shroud" });
const fit = fitPenalty(logged, whoThen);
check("attempts won as a 1.5% penalty makes them: fitted near it, sure enough to use, the wins expected and got", fit.tries === 120 && fit.applied && fit.penalty >= 0.013 && fit.penalty <= 0.017 && fit.gain > 1.92 && fit.expected > fit.won + 5, JSON.stringify(fit));
const few8 = fitPenalty(logged.slice(42, 48), whoThen);
const none = fitPenalty([], whoThen);
check("a handful of tries, or none: the formula's 1% stays", !few8.applied && few8.penalty === 0.01 && none.tries === 0 && none.penalty === 0.01 && !none.applied, JSON.stringify(few8));
check("the penalty only counts below the room, and an action that ends a blink late still counts", skillingRoomChance({ skill: "alchemy", level: 80 }, { ...who(100), penalty: 0.02 }).success === skillingRoomChance({ skill: "alchemy", level: 80 }, who(100)).success
    && skillingRoomChance({ skill: "alchemy", level: 130 }, { ...who(100), penalty: 0.015 }).success < skillingRoomChance({ skill: "alchemy", level: 130 }, who(100)).success
    && skillingRoomChance({ skill: "cooking", level: 50 }, { level: 60, buffs: [[{ typeHrid: "/buff_types/action_speed", flatBoost: 0.6652 }]] }).tries === 20);

// ---------- the request ----------
check("the shop's prices: base + increment × levels bought, none at the highest level", shopCost("torchCap", 0) === 100 && shopCost("torchCap", 2) === 300 && shopCost("success", 3) === 160 && shopCost("speed", 12) === null);
const curve = (half) => [5, 20, 40, 60, 80, 100, 120, 160, 200].map((level) => ({ level, attempts: 40, wins: Math.round(40 * Math.min(1, Math.max(0, 0.5 + (half - level) / 20))) }));
const levelXp = Array.from({ length: 301 }, (_, i) => i * i * 100);
const request = {
    // Every skill far ahead of the floors the torches reach, but Alchemy; two monsters beaten to floor 4, the Mimic nowhere.
    skills: Object.fromEntries(SKILLS.map((s) => [s, s === "alchemy" ? geared(100) : who(230)])),
    xp: Object.fromEntries(SKILLS.map((s) => [s, s === "alchemy" ? 1005000 : 5300000])),
    levelXp,
    teaCrates: { basic: [{ typeHrid: "/buff_types/alchemy_level", flatBoost: 5 }], advanced: [{ typeHrid: "/buff_types/alchemy_level", flatBoost: 10 }], expert: [{ typeHrid: "/buff_types/alchemy_level", flatBoost: 15 }] },
    teaCrate: "basic",
    combat: { checkedAt: 5, monsters: MONSTERS.map((m) => ({ hrid: `/monsters/${m}`, setupName: m === "mimic" ? "Smash" : "Magic", curve: curve(m === "mimic" ? 15 : 95) })) },
    supplies: {},
    shop: { TorchCap: 100, ShroudCap: 5, FullAutoLevel: 1, HighestFloor: 4, HighestFloorRooms: 5, SkillingSuccessLevel: 2 },
    tokens: 103,
    options: { runs: 500 },
};
const started = Date.now();
const result = simulateLabyrinth(request);
const ms = Date.now() - started;
const by = Object.fromEntries(result.candidates.map((c) => [c.id, c]));
check("the run now: floors, the time, the first floor fewer than half the runs reach, how often nothing leads on, the setup it ran", result.runs === 500 && result.record.floor === 4 && result.target === result.reach.find((f) => f.floor > 1 && f.share < 0.5).floor && result.now.reach < 0.5 && result.now.floors > 2 && result.now.floors < 9
    && result.now.minutes > 20 && result.now.walled > 0.3 && result.now.left > 0 && result.setup.torches === 100 && result.setup.shrouds === 5 && result.setup.autoFloors === 1 && result.setup.patience === 10 && result.setup.teaCrate === "basic" && result.shroud?.below > 0,
    JSON.stringify({ now: result.now, shroud: result.shroud, target: result.target, ms }));
check("the floors: every run starts on floor 1, fewer reach each next one, with the torches and the time they take", result.reach[0].floor === 1 && result.reach[0].share === 1 && result.reach.every((f, i) => i === 0 || f.share <= result.reach[i - 1].share) && result.reach[0].rooms === 16 && result.reach[1].levels.join() === "40,60" && result.reach[0].torches >= 14 && result.reach[0].minutes > 5, JSON.stringify(result.reach.slice(0, 6)));
const roomOf = (what) => result.rooms.find((r) => r.what === what);
check("room by room, the weakest first: the Mimic passed nowhere and shrouded, Alchemy up to about its level, a strong skill far beyond", result.rooms[0].what === "mimic" && roomOf("mimic").passes < 40 && roomOf("mimic").shrouds > 0.3 && roomOf("mimic").loadout === "Smash"
    && roomOf("alchemy").passes > 110 && roomOf("alchemy").passes < 170 && roomOf("milking").passes > 200 && roomOf("alchemy").lost > roomOf("milking").lost && roomOf("cyclops").passes > 90 && roomOf("cyclops").passes < 125, JSON.stringify(result.rooms.slice(0, 5)));
check("what takes you further: getting better against the monsters that wall you in, most of all against all of them", by["combat:all:15"].floors > by["combat:cyclops:15"].floors && by["combat:cyclops:15"].floors > 0 && by["combat:all:15"].sure && by["combat:all:15"].floors >= by["combat:all:5"].floors && by["combat:mimic:5"].loadout === "Smash" && by["combat:mimic:5"].floors === 0,
    JSON.stringify(result.candidates.slice(0, 6).map((c) => [c.id, c.floors, c.error, c.minutes])));
check("skills: the levels of a strong one change nothing, the weak one's are priced in XP and never hurt", by["skill:milking:10"].floors === 0 && by["skill:milking:10"].minutes === 0 && !by["skill:milking:10"].sure && by["skill:alchemy:5"].xp === 105 * 105 * 100 - 1005000 && by["skill:alchemy:10"].floors >= 0 && by["skill:alchemy:10"].floors >= by["skill:alchemy:5"].floors - 0.02,
    JSON.stringify([by["skill:alchemy:5"], by["skill:alchemy:10"]].map((c) => [c.id, c.floors, c.minutes, c.xp])));
check("the shop: a shroud more at its second level's price, torches at their first, a skilling upgrade at its next level's, and what you can afford", by["shop:torchCap"].tokens === 100 && by["shop:torchCap"].affordable === true && by["shop:shroudCap"].tokens === 160 && by["shop:shroudCap"].affordable === false && by["shop:torchCap"].floors > 0 && by["shop:success"].tokens === 120 && by["shop:speed"].tokens === 40,
    JSON.stringify(result.candidates.filter((c) => c.kind === "shop").map((c) => [c.id, c.tokens, c.floors])));
check("supplies, how you play and the game's settings: better crates, torches and shrouds, more tries a room, rushing for the exit", by["tea:advanced"] && by["tea:expert"] && by["torch:expert"] && by["shroud:advanced"].floors > 0 && by["play:patience"].minutes >= 0 && by["setting:rush"] && by["setting:manual"] && by["setting:attempts"],
    JSON.stringify(result.candidates.filter((c) => c.kind === "supply" || c.kind === "setting").map((c) => [c.id, c.floors, c.minutes])));
check("the candidates come best first, each with how sure it is and the time it adds or saves", result.candidates.every((c, i) => i === 0 || c.floors <= result.candidates[i - 1].floors) && result.candidates.every((c) => Number.isFinite(c.error) && typeof c.sure === "boolean" && c.reach >= 0 && c.reach <= 1 && Number.isFinite(c.minutes)));
check("nothing recorded or logged: the floors are the assumed ones, the formula as it is", result.model.rooms === 0 && result.model.learnedFloors.length === 0 && result.calibration.tries === 0 && result.calibration.penalty === 0.01 && result.shroudsSeen.used === 0);
const withData = simulateLabyrinth({ ...request, options: { runs: 300 } }, { states, attempts: logged });
check("recorded runs and logged attempts: the floors seen are used, the penalty fitted, Alchemy passed less far for it", withData.model.rooms === 27 && withData.model.learnedFloors.join() === "2" && withData.reach[1].levels.join() === "51,74" && withData.reach[1].learned === true && withData.calibration.applied && withData.calibration.penalty > 0.012
    && withData.rooms.find((r) => r.what === "alchemy").passes < roomOf("alchemy").passes && withData.shroudsSeen.used === 2, JSON.stringify({ model: withData.model, calibration: withData.calibration }));
let refused = "";
try { simulateLabyrinth({ ...request, combat: null }); } catch (error) { refused = error.message; }
check("no combat rooms checked: it says to check them first", /Check the rooms/.test(refused));
console.log(`(${result.candidates.length + 6} setups of 500 runs in ${ms} ms)`);

if (failures) {
    console.log(`${failures} failed`);
    process.exit(1);
}
console.log("all passed");
