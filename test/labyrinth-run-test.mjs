// Whole Labyrinth runs (src/labyrinth-run.js): the floors learned from recorded states, a
// run's rules on floors where every room is sure or hopeless, and what takes you further.
// Usage: node test/labyrinth-run-test.mjs
import { SKILLS, floorModel, learnModel, runSetup, shopCost, simulateLabyrinth, typeKeys, winAt } from "../src/labyrinth-run.js";

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;

// ---------- the floors ----------
const MONSTERS = ["cyclops", "dryad", "mimic"];
const keys = typeKeys(MONSTERS);
const plain = floorModel(null, keys);
check("floors as assumed: 4 × 4 growing to 8 × 8, levels 20 × floor + 1 … + 20, every room type alike",
    plain.floors[1].size === 4 && plain.floors[5].size === 8 && plain.floors[9].size === 8 && plain.floors[1].levels[0] === 21 && plain.floors[1].levels.at(-1) === 40 && plain.floors[4].levels[0] === 81
    && Math.abs(plain.weights[0] - 1 / 13) < 1e-9 && Math.abs(plain.cumulative.at(-1) - 1) < 1e-9);

const room = (what, level, extra = {}) => (what.startsWith("/skills/") ? { roomType: "/labyrinth_room_types/skilling", skillHrid: what, recommendedLevel: level, ...extra } : { roomType: "/labyrinth_room_types/combat", monsterHrid: what, recommendedLevel: level, ...extra });
const state = (floor, rows, run = "t0") => ({ labyrinth: { characterID: 1, startedAt: run, isActive: true, currentFloor: floor, roomData: rows } });
// Floor 2 seen in two states of one run (the same rooms once) and in another run: 25 rooms at levels 50–74, all milking but one.
const five = (from, what = "/skills/milking") => Array.from({ length: 5 }, (_, c) => room(what, from + c));
const states = [
    state(2, [[{ roomType: "", isCleared: true }, ...five(50).slice(1)], five(55), [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null]]),
    state(2, [[{ roomType: "", isCleared: true }, ...five(50).slice(1)], five(55), five(60), [null, null, null, null, null], [null, null, null, null, null]]),
    state(2, [five(65), five(70, "/monsters/mimic").slice(0, 1).concat(five(70).slice(1)), [null, null, null, null, null], [null, null, null, null, null], [null, null, null, null, null]], "t1"),
    state(3, [[room("/skills/milking", 99)]]),
    { labyrinth: { isActive: false } },
];
const learned = learnModel(states);
check("learned: each room once, per floor its levels and size, the room types counted", learned.rooms === 25 && learned.runs === 2 && learned.floors[2].levels.length === 24 && learned.floors[2].size === 5 && learned.floors[3].levels.length === 1 && learned.types["skill:milking"] === 24 && learned.types["monster:mimic"] === 1, JSON.stringify({ rooms: learned.rooms, runs: learned.runs, types: learned.types }));
const model = floorModel(learned, keys);
check("a floor seen enough takes its recorded levels; the others follow it, with its spread", model.floors[2].learned && model.floors[2].levels.length === 24 && !model.floors[3].learned && model.floors[3].levels[0] === 71 && model.floors[3].levels.at(-1) === 94 && model.floors[1].levels[0] === 31,
    JSON.stringify([model.floors[1].levels[0], model.floors[3].levels[0], model.floors[3].levels.at(-1)]));
check("room types seen more come more often", model.weights[0] > 5 * model.weights[1] && model.weights[keys.indexOf("monster:mimic")] > model.weights[keys.indexOf("monster:dryad")]);

check("a win curve is read between its levels and held at its ends", winAt([{ level: 10, wins: 10, attempts: 10 }, { level: 20, wins: 0, attempts: 10 }], 15) === 0.5 && winAt([{ level: 10, wins: 9, attempts: 10 }], 5) === 0.9 && winAt([{ level: 10, wins: 9, attempts: 10 }, { level: 20, wins: 3, attempts: 10 }], 99) === 0.3 && winAt([], 5) === 0);

// ---------- a run ----------
const table = (p) => new Float64Array(401).fill(p);
const tables = (p) => keys.map(() => table(p));
const setup = (extra = {}) => ({ tables: tables(1), torches: 100, torchKept: 0, shrouds: 0, shroudCap: 50, shroudWorth: 8, autoFloors: 0, rushFloors: 0, maxAttempts: 1, shroudWhenStuck: true, ...extra });
// Every room sure: the shortest way is 2 × (size − 1) rooms – 6, 8, 10, 12, then 14 a floor: 100 torches clear 8 exits (92 torches).
let exits = runSetup(setup(), plain, 50);
check("every room sure, by hand: straight to each exit, 8 floors on 100 torches", exits.every((x) => x === 8), String(mean([...exits])));
check("more torches, more floors; torches kept 20% of the time go further", runSetup(setup({ torches: 110 }), plain, 50).every((x) => x === 9) && mean([...runSetup(setup({ torchKept: 0.2 }), plain, 200)]) > 8.5);
check("every room hopeless: nowhere, and a shroud only gets you a room further", runSetup(setup({ tables: tables(0) }), plain, 50).every((x) => x === 0) && runSetup(setup({ tables: tables(0), shrouds: 5 }), plain, 50).every((x) => x === 0));
check("every room hopeless, six shrouds that never fail: floor 1's six rooms shrouded, one exit", runSetup(setup({ tables: tables(0), shrouds: 6, shroudCap: Infinity }), plain, 50).every((x) => x === 1));
check("a shroud above its cap fails 2% a level: basic shrouds on floor 5 (levels 101–120) mostly fail", mean([...runSetup(setup({ tables: tables(0), shrouds: 400, shroudCap: 50, torches: 1 }), plain, 100)]) < 4.5 && mean([...runSetup(setup({ tables: tables(0), shrouds: 400, shroudCap: Infinity, torches: 1 }), plain, 20)]) > 10);
// Full automation on floor 1 does every room (15 torches, not 6) unless it rushes for the exit.
exits = runSetup(setup({ torches: 20, autoFloors: 1 }), plain, 50);
const rushed = runSetup(setup({ torches: 20, autoFloors: 1, rushFloors: 1 }), plain, 50);
check("automation clears the whole floor (15 rooms of 20 torches: floor 2 not finished); rushing for the exit leaves 14 for it", exits.every((x) => x === 1) && rushed.every((x) => x === 2));
// Half the rooms won: automation with one attempt a room gets stuck and you take over; never worse with more attempts by hand.
const half = runSetup(setup({ tables: tables(0.5), autoFloors: 3 }), plain, 400);
const byHand = runSetup(setup({ tables: tables(0.5) }), plain, 400);
check("rooms won half the time: by hand about 100 × 0.5 torches' worth of rooms; automation that clears whole floors gets less far", mean([...byHand]) > 4.5 && mean([...byHand]) < 6.5 && mean([...half]) < mean([...byHand]), `${mean([...byHand])} by hand, ${mean([...half])} automated`);
check("the same floors and luck: the same answer again, and better chances are never worse on average", runSetup(setup({ tables: tables(0.5) }), plain, 400).every((x, i) => x === byHand[i]) && mean([...runSetup(setup({ tables: tables(0.6) }), plain, 400)]) > mean([...byHand]));
// One room type hopeless: by hand you go around it (or shroud it) and still get far.
const noMimic = tables(1);
noMimic[keys.indexOf("monster:mimic")] = table(0);
const around = runSetup(setup({ tables: noMimic }), plain, 300);
const shrouded = runSetup(setup({ tables: noMimic, shrouds: 4, shroudCap: Infinity }), plain, 300);
check("a hopeless room type is gone around, and shrouds help where there is no way around", mean([...around]) > 5 && mean([...shrouded]) >= mean([...around]), `${mean([...around])} around, ${mean([...shrouded])} with shrouds`);

// ---------- the request ----------
check("the shop's prices: base + increment × levels bought, none at the highest level", shopCost("torchCap", 0) === 100 && shopCost("torchCap", 2) === 300 && shopCost("success", 3) === 160 && shopCost("speed", 12) === null);
const curve = (half) => [5, 20, 40, 60, 80, 100, 120, 160, 200].map((level) => ({ level, attempts: 40, wins: Math.round(40 * Math.min(1, Math.max(0, 0.5 + (half - level) / 20))) }));
const who = (level) => ({ level, buffs: [], shop: { speed: 0, efficiency: 0, success: 0, double: 0 } });
const levelXp = Array.from({ length: 301 }, (_, i) => i * i * 100);
const request = {
    // Every skill far ahead of the floors the torches reach, but Alchemy; two monsters beaten everywhere, the Mimic nowhere.
    skills: Object.fromEntries(SKILLS.map((s) => [s, who(s === "alchemy" ? 100 : 230)])),
    xp: Object.fromEntries(SKILLS.map((s) => [s, s === "alchemy" ? 1005000 : 5300000])),
    levelXp,
    teaCrates: { basic: [{ typeHrid: "/buff_types/alchemy_level", flatBoost: 5 }], advanced: [{ typeHrid: "/buff_types/alchemy_level", flatBoost: 10 }], expert: [{ typeHrid: "/buff_types/alchemy_level", flatBoost: 15 }] },
    teaCrate: "basic",
    combat: { checkedAt: 5, monsters: MONSTERS.map((m) => ({ hrid: `/monsters/${m}`, setupName: m === "mimic" ? "Smash" : "Magic", curve: curve(m === "mimic" ? 15 : 190) })) },
    supplies: {},
    shop: { TorchCap: 100, ShroudCap: 4, FullAutoLevel: 1, HighestFloor: 4, HighestFloorRooms: 5, SkillingSuccessLevel: 2 },
    tokens: 103,
    options: { runs: 500 },
};
const started = Date.now();
const result = simulateLabyrinth(request);
const ms = Date.now() - started;
const by = Object.fromEntries(result.candidates.map((c) => [c.id, c]));
check("the run now: floors, the first floor fewer than half the runs reach, the setup it ran", result.runs === 500 && result.record.floor === 4 && result.target === result.reach.find((f) => f.floor > 1 && f.share < 0.5).floor && result.now.reach < 0.5 && result.now.floors > 1 && result.now.floors < 8 && result.now.reach >= 0 && result.now.reach <= 1 && result.setup.torches === 100 && result.setup.shrouds === 4 && result.setup.autoFloors === 1 && result.setup.teaCrate === "basic" && result.shroud?.below > 0,
    JSON.stringify({ now: result.now, shroud: result.shroud, ms }));
check("the floors: every run starts on floor 1, fewer reach each next one", result.reach[0].floor === 1 && result.reach[0].share === 1 && result.reach.every((f, i) => i === 0 || f.share <= result.reach[i - 1].share) && result.reach[0].rooms === 16 && result.reach[1].levels.join() === "41,60" && result.reach[0].torches >= 15, JSON.stringify(result.reach.slice(0, 6)));
const roomOf = (what) => result.rooms.find((r) => r.what === what);
check("the rooms: the monster you can't beat takes the shrouds and is never fought on a floor played by hand, the weak skill loses torches, a strong one none", result.rooms.slice(0, 2).map((r) => r.what).sort().join() === "alchemy,mimic" && roomOf("mimic").shrouds > 0.5 && roomOf("mimic").loadout === "Smash" && roomOf("mimic").tries < 2
    && roomOf("alchemy").lost > roomOf("milking").lost && roomOf("milking").lost < 0.05 && roomOf("milking").tries > 3, JSON.stringify(result.rooms.slice(0, 4)));
check("what takes you further: the weak skill's levels first among the skills, with the XP they take", by["skill:alchemy:10"].floors > by["skill:milking:10"].floors && by["skill:alchemy:10"].floors >= by["skill:alchemy:5"].floors && by["skill:alchemy:10"].floors > 0 && by["skill:alchemy:5"].xp === 105 * 105 * 100 - 1005000 && by["skill:milking:10"].floors === 0 && !by["skill:milking:10"].sure,
    JSON.stringify(result.candidates.slice(0, 6).map((c) => [c.id, c.floors, c.error])));
check("the shop: torches and shrouds at the price of a first level, a skilling upgrade at its next level's, and what you can afford", by["shop:torchCap"].tokens === 100 && by["shop:torchCap"].affordable === true && by["shop:torchCap"].floors > 0 && by["shop:shroudCap"].tokens === 80 && by["shop:success"].tokens === 120 && by["shop:success"].affordable === false && by["shop:speed"].tokens === 40,
    JSON.stringify(result.candidates.filter((c) => c.kind === "shop").map((c) => [c.id, c.tokens, c.floors])));
check("supplies, settings and the monsters: better crates, torches and shrouds, rushing for the exit, room levels against each monster", by["tea:advanced"] && by["tea:expert"] && by["torch:expert"].floors > 0 && by["shroud:advanced"] && by["setting:rush"].floors > 0 && by["setting:manual"] && by["setting:attempts"] && by["combat:mimic"].loadout === "Smash" && by["combat:cyclops"].floors >= -0.1,
    JSON.stringify(result.candidates.filter((c) => c.kind !== "skill" && c.kind !== "shop").map((c) => [c.id, c.floors])));
check("the candidates come best first, each with how sure it is", result.candidates.every((c, i) => i === 0 || c.floors <= result.candidates[i - 1].floors) && result.candidates.every((c) => Number.isFinite(c.error) && typeof c.sure === "boolean" && c.reach >= 0 && c.reach <= 1));
check("nothing recorded: the floors are the assumed ones, and it says so", result.model.rooms === 0 && result.model.learnedFloors.length === 0);
const withStates = simulateLabyrinth({ ...request, options: { runs: 300 } }, { states });
check("recorded runs: the floors seen are used", withStates.model.rooms === 25 && withStates.model.learnedFloors.join() === "2" && withStates.reach[1].levels.join() === "51,74" && withStates.reach[1].learned === true, JSON.stringify(withStates.model));
let refused = "";
try { simulateLabyrinth({ ...request, combat: null }); } catch (error) { refused = error.message; }
check("no combat rooms checked: it says to check them first", /Check the rooms/.test(refused));
console.log(`(${result.candidates.length + 7} setups of 500 runs in ${ms} ms)`);

if (failures) {
    console.log(`${failures} failed`);
    process.exit(1);
}
console.log("all passed");
