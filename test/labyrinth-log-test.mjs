// The Labyrinth attempt log: what changed in a room between two of the game's messages
// (won, lost, shrouded), which loadout the automation puts on for a room, and the summary.
// Usage: node test/labyrinth-log-test.mjs
// And the game's Labyrinth states kept whole for the Pi (labyrinth-states.js).
const stored = new Map();
globalThis.localStorage = { getItem: (k) => (stored.has(k) ? stored.get(k) : null), setItem: (k, v) => stored.set(k, String(v)), removeItem: (k) => stored.delete(k) };
const { attemptSummary, failsOf, roomLoadoutId, roomOutcomes } = await import("../src/labyrinth-log.js");
const { recordState, statesForPi, statesSentToPi, stateContext } = await import("../src/labyrinth-states.js");

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const cyclops = (extra = {}) => ({ roomType: "/labyrinth_room_types/combat", monsterHrid: "/monsters/cyclops", recommendedLevel: 30, ...extra });
const milking = (extra = {}) => ({ roomType: "/labyrinth_room_types/skilling", skillHrid: "/skills/milking", recommendedLevel: 31, ...extra });
const lab = (rooms, extra = {}) => ({ characterID: 1, isActive: true, currentFloor: 1, startedAt: "t0", shroudCount: 4, roomData: [rooms, [null, null]], ...extra });

check("fails: the room's fail-something fields", failsOf({ failCount: 2, recommendedLevel: 30 }) === 2 && failsOf({ recommendedLevel: 30 }) === 0);

let out = roomOutcomes(lab([cyclops(), milking()]), lab([cyclops({ failCount: 2 }), milking({ isCleared: true })]));
check("two fails and a skilling room cleared", out.length === 3 && out.filter((x) => x.outcome === "loss").map((x) => x.fails).join() === "1,2" && out.find((x) => x.outcome === "win")?.col === 1, JSON.stringify(out.map((x) => [x.col, x.outcome, x.fails])));

out = roomOutcomes(lab([cyclops({ failCount: 2 }), milking()]), lab([cyclops({ failCount: 2, isCleared: true }), milking()]));
check("won after two fails", out.length === 1 && out[0].outcome === "win" && out[0].fails === 2 && out[0].failsBefore === 2);

out = roomOutcomes(lab([cyclops(), milking()]), lab([cyclops({ isCleared: true }), milking()], { shroudCount: 3 }));
check("cleared as a shroud went: shrouded", out.length === 1 && out[0].outcome === "shroud");

out = roomOutcomes(lab([cyclops(), milking()]), lab([cyclops({ isCleared: true }), milking({ isCleared: true })], { shroudCount: 3 }));
check("two cleared, one shroud: can't be told", out.length === 2 && out.every((x) => x.outcome === "cleared"));

out = roomOutcomes(lab([cyclops({ failCount: 1 }), milking()]), lab([{ roomType: "", recommendedLevel: 0, isCleared: true }, milking()]));
check("a cleared room sent without its monster: won, as the room it was", out.length === 1 && out[0].outcome === "win" && out[0].room.monsterHrid === "/monsters/cyclops" && out[0].room.recommendedLevel === 30 && out[0].fails === 1, JSON.stringify(out));
check("a room that turns into another, or loses its monster uncleared: nothing", roomOutcomes(lab([cyclops()]), lab([milking({ isCleared: true })])).length === 0 && roomOutcomes(lab([cyclops()]), lab([{ roomType: "" }])).length === 0);

check("nothing across floors or runs, or for rooms seen for the first time",
    roomOutcomes(lab([cyclops()]), lab([cyclops({ isCleared: true })], { currentFloor: 2 })).length === 0
    && roomOutcomes(lab([cyclops()]), lab([cyclops({ isCleared: true })], { startedAt: "t1" })).length === 0
    && roomOutcomes(lab([null, null]), lab([cyclops({ isCleared: true }), milking()])).length === 0
    && roomOutcomes(lab([cyclops({ isCleared: true })]), lab([cyclops({ isCleared: true })])).length === 0);

const setting = { labyrinthLoadoutMilking: 689019, labyrinthLoadoutCyclops: 689018, labyrinthLoadoutFrostSniper: 691780, labyrinthTeaCrateHrid: "" };
check("the loadout chosen for a room", roomLoadoutId(setting, cyclops()) === 689018 && roomLoadoutId(setting, milking()) === 689019
    && roomLoadoutId(setting, { monsterHrid: "/monsters/frost_sniper" }) === 691780 && roomLoadoutId(setting, { monsterHrid: "/monsters/mimic" }) === null);

const at = 1000;
const summary = attemptSummary([
    { type: "combat", what: "cyclops", level: 30, outcome: "loss", at, predicted: { win: 0.4 } },
    { type: "combat", what: "cyclops", level: 32, outcome: "win", at: at + 1, predicted: { win: 0.6 } },
    { type: "combat", what: "cyclops", level: 33, outcome: "shroud", at: at + 2 },
    { type: "skilling", what: "milking", level: 31, outcome: "win", at: at + 3, predicted: null },
]);
const c = summary[0];
check("summary per room type", summary.length === 2 && c.what === "cyclops" && c.tries === 2 && c.wins === 1 && c.shrouds === 1 && c.won === 0.5 && Math.abs(c.predicted - 0.5) < 1e-9 && c.minLevel === 30 && c.maxLevel === 32
    && summary[1].predicted === null && summary[1].won === 1, JSON.stringify(summary));

// The states for the Pi: each kept once, with what you had; they wait until the Pi has them.
const character = {
    character: { id: 1 },
    characterSkills: [{ skillHrid: "/skills/milking", level: 62 }, { skillHrid: "/skills/magic", level: 69 }],
    characterInfo: { labyrinthTorchCap: 100, labyrinthShroudCap: 4, coins: 5 },
    characterSetting: { labyrinthLoadoutCyclops: 689018, labyrinthMaxAttempts: 1, chatSound: true, labyrinthObject: { a: 1 } },
    characterItems: [
        { itemHrid: "/items/basic_torch", itemLocationHrid: "/item_locations/inventory", count: 240 },
        { itemHrid: "/items/advanced_shroud", itemLocationHrid: "/item_locations/inventory", count: 3 },
        { itemHrid: "/items/basic_tea_crate", itemLocationHrid: "/item_locations/inventory", count: 2 },
        { itemHrid: "/items/cheese", itemLocationHrid: "/item_locations/inventory", count: 9 },
    ],
};
const ctx = stateContext(character);
check("what you had: levels, the shop, the Labyrinth settings, the supplies", ctx.levels.milking === 62 && ctx.shop.TorchCap === 100 && ctx.shop.coins === undefined && ctx.setting.labyrinthMaxAttempts === 1 && ctx.setting.chatSound === undefined && ctx.setting.labyrinthObject === undefined
    && ctx.supplies.basic_torch === 240 && ctx.supplies.advanced_shroud === 3 && ctx.supplies.basic_tea_crate === 2 && ctx.supplies.cheese === undefined, JSON.stringify(ctx));
check("states: no run before any run is nothing to keep", recordState({ characterID: 1, isActive: false }, character, true, 1) === false && statesForPi().length === 0);
const first = lab([cyclops(), milking()], { torchCount: 100 });
check("states: a run's state is kept, the same again is not", recordState(first, character, true, 2) === true && recordState(JSON.parse(JSON.stringify(first)), character, false, 3) === false && statesForPi().length === 1);
recordState(lab([cyclops({ failCount: 1 }), milking()], { torchCount: 99 }), character, false, 4);
recordState({ characterID: 1, isActive: false }, character, false, 5);
const waiting = statesForPi();
check("states: every change waits for the Pi, whole, with what you had", waiting.length === 3 && waiting[0].uid.startsWith("1|t0|") && waiting[0].uid !== waiting[1].uid && waiting[0].late === true && waiting[1].late === false
    && waiting[1].labyrinth.torchCount === 99 && waiting[1].labyrinth.roomData[0][0].failCount === 1 && waiting[1].levels.magic === 69 && waiting[2].labyrinth.isActive === false && waiting.every((x) => x.chars === undefined), JSON.stringify(waiting.map((x) => x.uid)));
statesSentToPi([waiting[0].uid, waiting[1].uid]);
check("states: what the Pi has leaves the queue, also after a reload", statesForPi().length === 1 && JSON.parse(stored.get("mwia-laby-states")).queue.length === 1);
check("states: a state too big isn't kept", recordState({ characterID: 1, isActive: true, roomData: [], junk: "x".repeat(70000) }, character) === false && statesForPi().length === 1);

if (failures) {
    console.log(`${failures} failed`);
    process.exit(1);
}
console.log("all passed");
