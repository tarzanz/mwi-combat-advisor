// The Labyrinth attempt log: what changed in a room between two of the game's messages
// (won, lost, shrouded), which loadout the automation puts on for a room, and the summary.
// Usage: node test/labyrinth-log-test.mjs
import { attemptSummary, failsOf, roomLoadoutId, roomOutcomes } from "../src/labyrinth-log.js";

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

if (failures) {
    console.log(`${failures} failed`);
    process.exit(1);
}
console.log("all passed");
