// Whole Labyrinth runs, simulated: how far you get, what stops you, how long it takes, and
// which skill, shop upgrade, supply or setting would take you further. Worked out on your
// Pi (pi/labyrinth-sim.mjs) from what the browser sends (labyrinth-run-sync.js); pure – no
// browser, no game data.
//
// A run, as the recorded runs show it: floor after floor, each a grid of rooms (4 × 4 on
// floor 1, a row and a column more per floor up to 8 × 8), entered in the top left corner
// with the way down in the bottom right. A room next to a cleared one can be entered; the
// first time costs a torch (an Advanced or Expert torch is kept 10% / 20% of the time), and
// a room can be tried again for nothing but the time: 2 minutes a lost try. A try is won with
// the chance of that room – a skilling room's worked out exactly (labyrinth-skilling.js), a
// combat room's read off the win curves of your last "Check the rooms". Treasure rooms (as
// many as the floor's number) and the way down are entered for a torch, with nothing to
// win. A shroud clears a room in sight without a torch or a try. The run ends when the
// torches are gone, or when nothing leads on.
//
// What isn't known of the game is assumed, and replaced by what your recorded runs show
// (learnModel): the room levels of a floor (20 × floor … + 20), how often each room type
// comes (all alike).
//
// How the rooms are picked:
// - floors under full automation, as the game goes: a treasure room in reach first, then the
//   nearest way down through rooms not given up on (failed "max attempts" times), then –
//   unless it rushes for the exit – every other room it can reach; stuck, it uses a shroud on
//   the room in the way ("When stuck"), and with none left you take over by hand;
// - floors played by hand, as the advisor would: always the room the cheapest way down starts
//   with – a room costs its torch, more the likelier you are to give it up (after "tries a
//   room" lost tries it is a wall), and a little for the time its tries take; rooms not in
//   sight count as the floor's average – trying again after a loss, going around when that
//   is cheaper, and shrouding a room that costs more than a shroud is worth.
// Beacons aren't used. Every setup is run on the same floors with the same luck, so a
// difference between two of them is the change itself, not other dice.

import { LEVEL_PENALTY, skillingRoomChance } from "./labyrinth-skilling.js";

export const SKILLS = ["milking", "foraging", "woodcutting", "cheesesmithing", "crafting", "tailoring", "cooking", "brewing", "alchemy", "enhancing"];
export const MAX_ROOM_LEVEL = 400;
export const MAX_FLOOR = 18;
const MAX_GRID = 8;
// A room you would give up more than 19 times in 20: a wall.
const MIN_PASS = 0.05;
const COST_CAP = 1000;
// What a lost try's 2 minutes weigh against a torch when the way is picked.
const TRY_WEIGHT = 0.1;
export const LOST_MINUTES = 2;
// A won room takes about a minute; a treasure room or the way down a few seconds.
const WON_MINUTES = 1;
const WALK_MINUTES = 0.1;
// Lost tries after which you give a room up by hand, when the tab doesn't say.
export const PATIENCE = 10;
// Rooms seen on a floor before its recorded levels replace the assumed ones.
const LEARN_ROOMS = 20;
// How many times its share each room type is assumed seen, before your runs say otherwise.
const TYPE_PRIOR = 3;
export const TORCH_KEPT = { basic: 0, advanced: 0.1, expert: 0.2 };
export const SHROUD_CAP = { basic: 50, advanced: 100, expert: Infinity };
export const TIERS = ["basic", "advanced", "expert"];
// What a shroud is worth, in the cost of a room: tried in turn, the best kept.
const SHROUD_WORTHS = [1.5, 2.5, 4, 8, 15];
// The Labyrinth shop (the wiki): tokens for the next level = base + increment × levels bought.
export const SHOP = {
    torchCap: { base: 100, step: 100, max: 15, label: "+20 torch capacity" },
    shroudCap: { base: 80, step: 80, max: 8, label: "+1 shroud capacity" },
    speed: { base: 40, step: 40, max: 12, label: "+1% skilling speed", info: "SkillActionSpeedLevel" },
    efficiency: { base: 40, step: 40, max: 12, label: "+1% skilling efficiency", info: "SkillingEfficiencyLevel" },
    success: { base: 40, step: 40, max: 12, label: "+0.5% skilling success", info: "SkillingSuccessLevel" },
    double: { base: 40, step: 40, max: 12, label: "+1% skilling double progress", info: "SkillingDoubleProgressLevel" },
};
const BASE_TORCH_CAP = 100;
const BASE_SHROUD_CAP = 4;

// ---------- chances ----------

const rate = (point) => (point.attempts ? point.wins / point.attempts : 0);

// The win rate at a room level, read off a curve of { level, wins, attempts } (linear between its levels).
export function winAt(curve, level) {
    if (!curve?.length) return 0;
    if (level <= curve[0].level) return rate(curve[0]);
    for (let i = 1; i < curve.length; i++) {
        const a = curve[i - 1];
        const b = curve[i];
        if (level <= b.level) return rate(a) + ((level - a.level) / (b.level - a.level)) * (rate(b) - rate(a));
    }
    return rate(curve[curve.length - 1]);
}

function skillTable(skill, who) {
    const table = new Float64Array(MAX_ROOM_LEVEL + 1);
    for (let level = 1; level <= MAX_ROOM_LEVEL; level++) table[level] = skillingRoomChance({ skill, level }, who).chance;
    table[0] = 1;
    return table;
}

// shift: as if you were that many room levels better against it.
function combatTable(curve, shift = 0) {
    const table = new Float64Array(MAX_ROOM_LEVEL + 1);
    for (let level = 0; level <= MAX_ROOM_LEVEL; level++) table[level] = winAt(curve, level - shift);
    return table;
}

// ---------- your attempts against the formula ----------

const PENALTIES = Array.from({ length: 25 }, (_, i) => 0.008 + 0.0005 * i); // 0.8% … 2.0% a level
// A fitted penalty is used when it explains your attempts this much better (twice this is the
// usual 95% test) and enough of them were in rooms that could go either way.
const FIT_GAIN = 1.92;
const FIT_OPEN = 15;

// The success lost per level below the room, fitted to your logged skilling attempts
// (labyrinth-log.js): the one under which what happened – each try won or lost – was the
// likeliest. who(skill, level, teaCrate) -> the character then, for skillingRoomChance.
export function fitPenalty(attempts, who) {
    const tries = [];
    for (const a of attempts || []) {
        if (a?.type !== "skilling" || !SKILLS.includes(a.what) || !(a.outcome === "win" || a.outcome === "loss") || !(a.level > 0)) continue;
        const tea = TIERS.find((t) => a.crates?.tea === `/items/${t}_tea_crate`) || null;
        tries.push({ room: { skill: a.what, level: a.level }, who: who(a.what, a.levels?.[a.what], tea), won: a.outcome === "win" });
    }
    const likelihood = (penalty) => {
        let sum = 0;
        for (const t of tries) {
            const p = Math.min(0.9999, Math.max(0.0001, skillingRoomChance(t.room, { ...t.who, penalty }).chance));
            sum += Math.log(t.won ? p : 1 - p);
        }
        return sum;
    };
    const open = tries.filter((t) => {
        const p = skillingRoomChance(t.room, t.who).chance;
        return p > 0.02 && p < 0.98;
    });
    const out = { tries: tries.length, open: open.length, penalty: LEVEL_PENALTY, best: LEVEL_PENALTY, gain: 0, applied: false, expected: null, won: null };
    if (!tries.length) return out;
    const base = likelihood(LEVEL_PENALTY);
    let best = { penalty: LEVEL_PENALTY, value: base };
    for (const penalty of PENALTIES) {
        const value = likelihood(penalty);
        if (value > best.value + 1e-9) best = { penalty, value };
    }
    out.best = Math.round(best.penalty * 1e4) / 1e4;
    out.gain = Math.round((best.value - base) * 100) / 100;
    out.applied = out.gain >= FIT_GAIN && open.length >= FIT_OPEN;
    if (out.applied) out.penalty = out.best;
    // In the rooms that could go either way: the wins the formula expected, and those you got.
    out.expected = Math.round(open.reduce((sum, t) => sum + skillingRoomChance(t.room, t.who).chance, 0) * 10) / 10;
    out.won = open.filter((t) => t.won).length;
    return out;
}

// ---------- the floors ----------

export const typeKeys = (monsters) => [...SKILLS.map((s) => `skill:${s}`), ...monsters.map((m) => `monster:${m}`)];
const defaultSize = (floor) => Math.min(MAX_GRID, 3 + floor);
const defaultLow = (floor) => 20 * floor;
const DEFAULT_WIDTH = 20;
// Treasure rooms on a floor: as many as its number (the wiki: up to 6).
const defaultTreasure = (floor) => Math.min(6, floor);

// What the recorded runs (the game's Labyrinth states, labyrinth-states.js) say about the
// floors: per floor the grid's size, its treasure rooms and the room levels seen, and how often
// each room type came.
export function learnModel(states) {
    const rooms = new Map(); // run|floor|row|col -> { floor, type, level }
    const sizes = new Map(); // floor -> Map(size -> states)
    const runs = new Set();
    const treasure = new Map(); // floor -> treasure rooms
    // Shrouds used on rooms above their cap: how many, how many worked, how many the 2%-a-level rule expected to.
    const shrouds = { used: 0, worked: 0, expected: 0 };
    const last = new Map(); // run -> the state before
    for (const entry of states || []) {
        const lab = entry?.labyrinth;
        const floor = Number(lab?.currentFloor);
        if (!lab || !Array.isArray(lab.roomData) || !Number.isInteger(floor) || floor < 1) continue;
        const run = `${lab.characterID ?? ""}|${lab.startedAt ?? ""}`;
        runs.add(run);
        // A shroud gone between two states of a floor, and the rooms cleared without being entered.
        const before = last.get(run);
        if (before && before.currentFloor === floor && String(before.updatedAt || "") < String(lab.updatedAt || "") && before.shroudCount > lab.shroudCount) {
            const cap = SHROUD_CAP[TIERS.find((t) => before.shroudItemHrid === `/items/${t}_shroud`)];
            const cleared = [];
            lab.roomData.forEach((row, r) => (Array.isArray(row) ? row : []).forEach((room, c) => {
                const was = before.roomData?.[r]?.[c];
                if (room?.isCleared && was && !was.isCleared && (was.monsterHrid || was.skillHrid)) cleared.push(Number(was.recommendedLevel) || 0);
            }));
            const used = before.shroudCount - lab.shroudCount;
            // One shroud, at most one room: the room's level is known when it worked; when it failed, not which room it was for.
            if (cap !== undefined && used === 1 && cleared.length <= 1) {
                if (cleared.length && cleared[0] > cap) {
                    shrouds.used++;
                    shrouds.worked++;
                    shrouds.expected += 1 - Math.min(1, 0.02 * (cleared[0] - cap));
                } else if (!cleared.length) {
                    shrouds.used++;
                    shrouds.failed = (shrouds.failed || 0) + 1;
                }
            }
        }
        last.set(run, lab);
        const size = lab.roomData.length;
        if (Number.isFinite(lab.totalTreasureRooms) && lab.isActive) treasure.set(floor, Math.max(treasure.get(floor) || 0, lab.totalTreasureRooms));
        const seen = sizes.get(floor) || new Map();
        seen.set(size, (seen.get(size) || 0) + 1);
        sizes.set(floor, seen);
        lab.roomData.forEach((row, r) => (Array.isArray(row) ? row : []).forEach((room, c) => {
            const level = Number(room?.recommendedLevel);
            const type = room?.skillHrid ? `skill:${String(room.skillHrid).split("/").pop()}` : room?.monsterHrid ? `monster:${String(room.monsterHrid).split("/").pop()}` : null;
            if (type && level > 0) rooms.set(`${run}|${floor}|${r}|${c}`, { floor, type, level: Math.round(level) });
        }));
    }
    const floors = {};
    const types = {};
    for (const room of rooms.values()) {
        (floors[room.floor] ||= { levels: [] }).levels.push(room.level);
        types[room.type] = (types[room.type] || 0) + 1;
    }
    for (const [floor, seen] of sizes) (floors[floor] ||= { levels: [] }).size = [...seen.entries()].sort((a, b) => b[1] - a[1])[0][0];
    for (const [floor, count] of treasure) (floors[floor] ||= { levels: [] }).treasure = count;
    shrouds.expected = Math.round(shrouds.expected * 10) / 10;
    return { floors, types, rooms: rooms.size, runs: runs.size, shrouds };
}

// The floors as the simulation lays them out: floor -> { size, levels (drawn from, each as likely) }, the room types' weights.
export function floorModel(learned, keys) {
    const known = Object.entries(learned?.floors || {}).filter(([, f]) => f.levels.length >= LEARN_ROOMS).map(([floor, f]) => ({ floor: Number(floor), low: Math.min(...f.levels), high: Math.max(...f.levels), levels: f.levels }));
    // Floors not seen (enough): the assumed levels, moved and widened as the seen floors differ from theirs.
    let low = defaultLow;
    let width = DEFAULT_WIDTH;
    if (known.length) {
        width = Math.round(known.reduce((sum, f) => sum + (f.high - f.low), 0) / known.length);
        const shift = Math.round(known.reduce((sum, f) => sum + (f.low - defaultLow(f.floor)), 0) / known.length);
        low = (floor) => Math.max(1, defaultLow(floor) + shift);
    }
    const floors = [null];
    for (let floor = 1; floor <= MAX_FLOOR; floor++) {
        const seen = known.find((f) => f.floor === floor);
        const from = low(floor);
        const levels = seen ? seen.levels : Array.from({ length: width + 1 }, (_, i) => from + i);
        floors.push({ size: Math.min(MAX_GRID, Math.max(2, learned?.floors?.[floor]?.size || defaultSize(floor))), levels: levels.map((l) => Math.min(MAX_ROOM_LEVEL, l)), learned: !!seen, treasure: learned?.floors?.[floor]?.treasure ?? defaultTreasure(floor) });
    }
    const weights = keys.map((k) => TYPE_PRIOR + (learned?.types?.[k] || 0));
    const total = weights.reduce((a, b) => a + b, 0);
    let sum = 0;
    const cumulative = weights.map((w) => (sum += w / total));
    return { floors, weights: weights.map((w) => w / total), cumulative };
}

// ---------- dice ----------

// A number in [0, 1) from a whole number (mulberry32's mixing): the same in, the same out.
function unit(a) {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const GOLD = 0x9e3779b9;

// ---------- one run ----------

const CELLS = MAX_GRID * MAX_GRID;
const ROOM = 0;
const TREASURE = 1;
const DOWN = 2;

function newScratch() {
    return {
        type: new Uint8Array(CELLS), level: new Uint16Array(CELLS), seed: new Int32Array(CELLS), kind: new Uint8Array(CELLS), cleared: new Uint8Array(CELLS), entered: new Uint8Array(CELLS),
        fails: new Uint16Array(CELLS), open: new Uint8Array(CELLS), cost: new Float64Array(CELLS), dist: new Float64Array(CELLS), heapKey: new Float64Array(4 * CELLS), heapCell: new Int32Array(4 * CELLS), minutes: 0,
    };
}

// What a room costs by hand, per room level, for a table of chances: its torch over the
// chance to get past it within `patience` tries (given up, the torch is gone and the way is
// another), and a little for the tries lost on the way. A room all but never passed is a wall.
const costCache = new WeakMap();
function handCosts(table, patience) {
    let byPatience = costCache.get(table);
    if (!byPatience) costCache.set(table, (byPatience = new Map()));
    let costs = byPatience.get(patience);
    if (costs) return costs;
    costs = new Float64Array(table.length);
    for (let level = 0; level < table.length; level++) {
        const p = table[level];
        const pass = 1 - (1 - p) ** patience;
        costs[level] = pass < MIN_PASS ? Infinity : Math.min(COST_CAP, 1 / pass + TRY_WEIGHT * (pass / p - pass));
    }
    byPatience.set(patience, costs);
    return costs;
}

const shroudFail = (setup, level) => Math.min(1, Math.max(0, 0.02 * (level - setup.shroudCap)));
// What a shroud costs at a room level, in the cost of a room (it fails 2% a level above its cap).
function shroudCost(setup, level) {
    const works = 1 - shroudFail(setup, level);
    return works > 0 ? setup.shroudWorth / works : Infinity;
}

// What a room not in sight is counted as on a floor: the average cost of the rooms that can
// be passed, over the share that can (one in three passable: three times the cost, for the
// ways around) – [without a shroud to spare, with one].
function hiddenCost(setup, model, floor) {
    const cached = setup.hidden[floor];
    if (cached) return cached;
    const spec = model.floors[floor];
    const out = [0, 0];
    for (let shroud = 0; shroud < 2; shroud++) {
        let sum = 0;
        let passable = 0;
        for (let t = 0; t < setup.tables.length; t++) {
            for (const level of spec.levels) {
                const cost = shroud ? Math.min(setup.costs[t][level], shroudCost(setup, level)) : setup.costs[t][level];
                if (cost < Infinity) {
                    sum += model.weights[t] * cost;
                    passable += model.weights[t];
                }
            }
        }
        const share = passable / spec.levels.length;
        out[shroud] = share > 0 ? Math.min(COST_CAP, sum / passable / share) : COST_CAP;
    }
    return (setup.hidden[floor] = out);
}

// The room to try next: of the rooms that can be entered, the one the cheapest way down
// starts with (each room's cost in s.cost; Infinity: not that way). Worked out from the way
// down, cheapest first, until a room that can be entered comes up – cleared rooms needn't be
// crossed: a way back through them comes out at another room that can be entered, no dearer.
function nextRoom(s, n) {
    const N = n * n;
    const { dist, cost, cleared, open, heapKey, heapCell } = s;
    for (let i = 0; i < N; i++) dist[i] = Infinity;
    if (!(cost[N - 1] < Infinity)) return -1;
    let size = 0;
    const push = (key, cell) => {
        let i = size++;
        while (i > 0) {
            const parent = (i - 1) >> 1;
            if (heapKey[parent] <= key) break;
            heapKey[i] = heapKey[parent];
            heapCell[i] = heapCell[parent];
            i = parent;
        }
        heapKey[i] = key;
        heapCell[i] = cell;
    };
    dist[N - 1] = cost[N - 1];
    push(cost[N - 1], N - 1);
    while (size > 0) {
        const d = heapKey[0];
        const u = heapCell[0];
        // The last entry takes the top's place and sinks.
        const key = heapKey[--size];
        const cell = heapCell[size];
        let i = 0;
        while (true) {
            let child = 2 * i + 1;
            if (child >= size) break;
            if (child + 1 < size && heapKey[child + 1] < heapKey[child]) child++;
            if (heapKey[child] >= key) break;
            heapKey[i] = heapKey[child];
            heapCell[i] = heapCell[child];
            i = child;
        }
        heapKey[i] = key;
        heapCell[i] = cell;
        if (d > dist[u]) continue; // an older, dearer entry
        if (open[u]) return u;
        const r = (u / n) | 0;
        const c = u - r * n;
        let v = u - n;
        if (r > 0 && !cleared[v] && d + cost[v] < dist[v]) push((dist[v] = d + cost[v]), v);
        v = u + n;
        if (r < n - 1 && !cleared[v] && d + cost[v] < dist[v]) push((dist[v] = d + cost[v]), v);
        v = u - 1;
        if (c > 0 && !cleared[v] && d + cost[v] < dist[v]) push((dist[v] = d + cost[v]), v);
        v = u + 1;
        if (c < n - 1 && !cleared[v] && d + cost[v] < dist[v]) push((dist[v] = d + cost[v]), v);
    }
    return -1;
}

// A room that can be entered: not cleared, next to a cleared one.
function markOpen(s, n) {
    const N = n * n;
    for (let i = 0; i < N; i++) {
        if (s.cleared[i]) {
            s.open[i] = 0;
            continue;
        }
        const r = (i / n) | 0;
        const c = i - r * n;
        s.open[i] = (r > 0 && s.cleared[i - n]) || (r < n - 1 && s.cleared[i + n]) || (c > 0 && s.cleared[i - 1]) || (c < n - 1 && s.cleared[i + 1]) ? 1 : 0;
    }
}

// One run of a setup: the floors' ways down taken (the minutes it took in s.minutes). stats (optional) is added to.
// setup: { tables, costs, torches, torchKept, shrouds, shroudCap, shroudWorth, autoFloors, rushFloors, maxAttempts, shroudWhenStuck, patience, hidden: [] }
export function simulateRun(setup, model, runSeed, s, stats) {
    let torches = setup.torches;
    let shrouds = setup.shrouds;
    let exits = 0;
    let entries = 0; // for the torch-kept dice
    let minutes = 0;
    const types = setup.tables.length;
    for (let floor = 1; floor <= MAX_FLOOR; floor++) {
        const spec = model.floors[floor];
        const n = spec.size;
        const N = n * n;
        const floorSeed = Math.imul(runSeed ^ Math.imul(floor, GOLD), 0x85ebca6b);
        for (let i = 0; i < N; i++) {
            const a = unit(floorSeed + 3 * i);
            let t = 0;
            while (t < types - 1 && a >= model.cumulative[t]) t++;
            s.type[i] = t;
            s.level[i] = spec.levels[(unit(floorSeed + 3 * i + 1) * spec.levels.length) | 0];
            s.seed[i] = (unit(floorSeed + 3 * i + 2) * 4294967296) | 0;
            s.kind[i] = ROOM;
            s.cleared[i] = 0;
            s.entered[i] = 0;
            s.fails[i] = 0;
        }
        s.kind[N - 1] = DOWN;
        // Treasure rooms anywhere but the start and the way down (two on one cell: one fewer).
        for (let j = 0; j < spec.treasure && N > 2; j++) s.kind[1 + ((unit(floorSeed + 7919 + j) * (N - 2)) | 0)] = TREASURE;
        s.cleared[0] = 1;
        let auto = floor <= setup.autoFloors;
        const rush = floor <= setup.rushFloors;
        const torchesAtStart = torches;
        const minutesAtStart = minutes;
        if (stats) stats.reached[floor]++;
        let plan = true; // the pick is out of date
        let pick = -1;
        let ended = false;
        while (true) {
            if (plan) {
                markOpen(s, n);
                const downDone = !!s.cleared[N - 1];
                if (downDone && (!auto || rush)) break;
                if (auto) {
                    // A treasure room in reach first.
                    pick = -1;
                    for (let i = 0; i < N && pick < 0; i++) if (s.open[i] && s.kind[i] === TREASURE) pick = i;
                    if (pick < 0) {
                        // Rooms count one each; rooms given up on are walls.
                        for (let i = 0; i < N; i++) s.cost[i] = s.cleared[i] ? 0 : s.kind[i] === ROOM && s.fails[i] >= setup.maxAttempts ? Infinity : 1;
                        if (downDone) {
                            // The rest of the floor: any room in reach not given up on.
                            for (let i = 0; i < N && pick < 0; i++) if (s.open[i] && s.cost[i] < Infinity) pick = i;
                            if (pick < 0) break;
                        } else {
                            pick = nextRoom(s, n);
                            if (pick < 0) {
                                // Stuck: a shroud on the room in the way, else you take over by hand.
                                if (setup.shroudWhenStuck && shrouds > 0) {
                                    for (let i = 0; i < N; i++) s.cost[i] = s.cleared[i] ? 0 : 1;
                                    pick = nextRoom(s, n);
                                    if (pick < 0) break;
                                    shrouds--;
                                    if (stats) stats.shrouds[s.type[pick]]++;
                                    if (unit(s.seed[pick] ^ Math.imul(shrouds + 1, 0x5bd1e995)) >= shroudFail(setup, s.level[pick])) s.cleared[pick] = 1;
                                    continue;
                                }
                                auto = false;
                                continue;
                            }
                        }
                    }
                } else {
                    const hidden = hiddenCost(setup, model, floor)[shrouds > 0 ? 1 : 0];
                    for (let i = 0; i < N; i++) {
                        if (s.cleared[i]) s.cost[i] = 0;
                        else if (s.kind[i] !== ROOM && (s.open[i] || i === N - 1)) s.cost[i] = 1;
                        else if (!s.open[i]) s.cost[i] = hidden;
                        else {
                            const own = s.fails[i] >= setup.patience ? Infinity : setup.costs[s.type[i]][s.level[i]];
                            s.cost[i] = shrouds > 0 ? Math.min(own, shroudCost(setup, s.level[i])) : own;
                        }
                    }
                    pick = nextRoom(s, n);
                    // No way down but through rooms you (all but) never win: the run ends here.
                    if (pick < 0) {
                        ended = true;
                        break;
                    }
                }
                plan = false;
            }
            const room = s.kind[pick] === ROOM;
            const type = s.type[pick];
            const level = s.level[pick];
            if (room && !auto) {
                // By hand: a shroud where the room costs more than the shroud is worth (no torch, no try).
                const own = s.fails[pick] >= setup.patience ? Infinity : setup.costs[type][level];
                if (shrouds > 0 && own > shroudCost(setup, level)) {
                    shrouds--;
                    if (stats) stats.shrouds[type]++;
                    // A shroud that fails is gone; the room is as it was.
                    if (unit(s.seed[pick] ^ Math.imul(shrouds + 1, 0x5bd1e995)) >= shroudFail(setup, level)) s.cleared[pick] = 1;
                    plan = true;
                    continue;
                }
            }
            // The first time into a room costs a torch; trying it again doesn't.
            if (!s.entered[pick]) {
                if (torches <= 0) {
                    // Out of torches with the way down taken (the automation was doing the floor's other rooms): on to the next floor.
                    if (s.cleared[N - 1]) break;
                    ended = true;
                    break;
                }
                if (unit(runSeed + Math.imul(++entries, GOLD)) >= setup.torchKept) torches--;
                s.entered[pick] = 1;
            }
            if (!room) {
                // A treasure room, or the way down: nothing to win.
                s.cleared[pick] = 1;
                minutes += WALK_MINUTES;
                plan = true;
                continue;
            }
            const won = unit(s.seed[pick] + Math.imul(s.fails[pick] + 1, GOLD)) < setup.tables[type][level];
            if (stats) {
                stats.tries[type]++;
                if (!won) stats.lost[type]++;
            }
            if (won) {
                s.cleared[pick] = 1;
                minutes += WON_MINUTES;
                plan = true;
            } else {
                minutes += LOST_MINUTES;
                // Given up after enough lost tries (the automation's max attempts, your patience by hand): another way is looked for.
                if (++s.fails[pick] >= (auto ? setup.maxAttempts : setup.patience)) {
                    plan = true;
                    if (stats && !auto) stats.gaveUp[type]++;
                }
            }
        }
        if (stats) {
            stats.torches[floor] += torchesAtStart - torches;
            stats.minutes[floor] += minutes - minutesAtStart;
        }
        if (ended) {
            if (stats) {
                if (torches > 0) stats.walled++;
                stats.left += torches;
            }
            s.minutes = minutes;
            return exits;
        }
        exits++;
    }
    s.minutes = minutes;
    return exits;
}

// ---------- many runs ----------

function newStats(types) {
    return {
        tries: new Float64Array(types), lost: new Float64Array(types), shrouds: new Float64Array(types), gaveUp: new Float64Array(types),
        reached: new Float64Array(MAX_FLOOR + 2), torches: new Float64Array(MAX_FLOOR + 2), minutes: new Float64Array(MAX_FLOOR + 2), left: 0, walled: 0,
    };
}

// `runs` runs of a setup (run k has the same floors and luck in every setup): the ways down taken in each, and the minutes each took.
export function runSetup(setup, model, runs, seed = 1, stats = null) {
    const exits = new Uint8Array(runs);
    const minutes = new Float32Array(runs);
    const scratch = newScratch();
    setup.hidden = [];
    setup.costs = setup.tables.map((table) => handCosts(table, setup.patience));
    for (let k = 0; k < runs; k++) {
        exits[k] = simulateRun(setup, model, Math.imul(k + seed, 0x2c1b3c6d) | 0, scratch, stats);
        minutes[k] = scratch.minutes;
    }
    return { exits, minutes };
}

const mean = (list) => {
    let sum = 0;
    for (let i = 0; i < list.length; i++) sum += list[i];
    return list.length ? sum / list.length : 0;
};

// A setup against the one now: the mean floors more, how sure (the difference over its standard error), the chance to reach a floor, the minutes more.
function compare(base, other, floor) {
    const n = base.exits.length;
    let sum = 0;
    let squares = 0;
    let reach = 0;
    for (let i = 0; i < n; i++) {
        const d = other.exits[i] - base.exits[i];
        sum += d;
        squares += d * d;
        if (other.exits[i] >= floor - 1) reach++;
    }
    const gain = sum / n;
    const error = Math.sqrt(Math.max(0, squares / n - gain * gain) / n);
    return { gain, error, reach: reach / n, minutes: mean(other.minutes) - mean(base.minutes) };
}

const round = (x, digits = 3) => Math.round(x * 10 ** digits) / 10 ** digits;
const cap = (text) => text[0].toUpperCase() + text.slice(1);

// The tokens the next level of a shop upgrade costs (null: at its highest).
export function shopCost(key, bought) {
    const item = SHOP[key];
    return bought >= item.max ? null : item.base + item.step * bought;
}

// ---------- the request, worked out ----------

// request (labyrinth-run-sync.js):
//   skills: { skill: { level, buffs: [lists], shop: { speed, efficiency, success, double } } }, xp: { skill: experience }, levelXp: [experience at each level]
//   teaCrates: { tier: [buffs] }, teaCrate: tier or null
//   combat: { monsters: [{ hrid, setupName, curve: [{ level, wins, attempts }] }] }
//   supplies: { torches, torchTier, shrouds, shroudTier }, shop: the character's Labyrinth fields (TorchCap, ShroudCap, SkillingSuccessLevel …), tokens
//   options: { autoFloors, rushFloors, maxAttempts, shroudWhenStuck, patience, runs }
// states: the game's Labyrinth states your Pi kept (for the floors); attempts: your logged attempts (for the level penalty).
export function simulateLabyrinth(request, { states = [], attempts = [], runs, onProgress = () => {} } = {}) {
    const started = Date.now();
    const options = request.options || {};
    runs = Math.max(200, Math.min(20000, Math.round(runs || options.runs || 2000)));
    const monsters = (request.combat?.monsters || []).filter((m) => m?.hrid && m.curve?.length);
    if (!monsters.length) throw new Error("no combat rooms checked yet – tap Check the rooms first");
    const names = monsters.map((m) => m.hrid.split("/").pop());
    const keys = typeKeys(names);
    const learned = learnModel(states);
    const model = floorModel(learned, keys);

    const crate = (tier) => (tier ? request.teaCrates?.[tier] || [] : []);
    const character = (skill, change = {}) => {
        const mine = request.skills?.[skill] || { level: 1 };
        return { level: (change.level ?? mine.level ?? 1) + (change.levels || 0), buffs: mine.buffs || [], crateBuffs: crate(change.teaCrate !== undefined ? change.teaCrate : request.teaCrate), shop: { ...(mine.shop || {}), ...(change.shop || {}) } };
    };
    // The success lost per level below a room, as your own attempts have it.
    const calibration = fitPenalty(attempts, (skill, level, teaCrate) => character(skill, { level: Number.isFinite(level) ? level : undefined, teaCrate }));
    const who = (skill, change) => ({ ...character(skill, change), penalty: calibration.penalty });
    const baseTables = [...SKILLS.map((skill) => skillTable(skill, who(skill))), ...monsters.map((m) => combatTable(m.curve))];
    const withSkills = (change, only = null) => baseTables.map((table, t) => (t < SKILLS.length && (only === null || only === t) ? skillTable(SKILLS[t], who(SKILLS[t], change)) : table));

    const shop = request.shop || {};
    const supplies = request.supplies || {};
    const tier = (name, fallback) => (TIERS.includes(name) ? name : fallback);
    const torchTier = tier(supplies.torchTier, "basic");
    const shroudTier = tier(supplies.shroudTier, "basic");
    const base = {
        tables: baseTables,
        torches: Math.max(1, Math.round(supplies.torches ?? shop.TorchCap ?? BASE_TORCH_CAP)),
        torchKept: TORCH_KEPT[torchTier],
        shrouds: Math.max(0, Math.round(supplies.shrouds ?? shop.ShroudCap ?? BASE_SHROUD_CAP)),
        shroudCap: SHROUD_CAP[shroudTier],
        shroudWorth: SHROUD_WORTHS[2],
        autoFloors: Math.max(0, Math.round(options.autoFloors ?? shop.FullAutoLevel ?? 0)),
        rushFloors: Math.max(0, Math.round(options.rushFloors ?? 0)),
        maxAttempts: Math.max(1, Math.round(options.maxAttempts ?? 1)),
        shroudWhenStuck: options.shroudWhenStuck !== false,
        patience: Math.max(1, Math.min(99, Math.round(options.patience ?? PATIENCE))),
    };

    // What a shroud is worth by hand: the worth that takes you furthest (on a part of the runs).
    const tuneRuns = Math.min(runs, 800);
    let bestWorth = { worth: base.shroudWorth, floors: -1 };
    if (base.shrouds > 0) {
        for (const worth of SHROUD_WORTHS) {
            const floors = mean(runSetup({ ...base, shroudWorth: worth }, model, tuneRuns).exits);
            if (floors > bestWorth.floors + 1e-9) bestWorth = { worth, floors };
        }
        base.shroudWorth = bestWorth.worth;
    }
    onProgress(0.05);

    const stats = newStats(keys.length);
    const now = runSetup(base, model, runs, 1, stats);
    const record = Math.max(1, Math.round(Number(shop.HighestFloor) || 1));
    const distribution = Array.from({ length: MAX_FLOOR + 1 }, () => 0);
    for (let i = 0; i < runs; i++) distribution[now.exits[i]]++;
    const reach = [];
    let above = runs;
    for (let floor = 1; floor <= MAX_FLOOR && above > 0; floor++) {
        const spec = model.floors[floor];
        const there = stats.reached[floor] || 1;
        reach.push({ floor, share: round(above / runs), torches: round(stats.torches[floor] / there, 1), minutes: round(stats.minutes[floor] / there, 0), rooms: spec.size ** 2, levels: [Math.min(...spec.levels), Math.max(...spec.levels)], learned: spec.learned });
        above -= distribution[floor - 1];
    }
    // The floor the changes are measured at: the first one fewer than half the runs reach.
    const target = reach.find((f) => f.floor > 1 && f.share < 0.5)?.floor ?? reach[reach.length - 1].floor + 1;
    // The room level where you get past half the rooms of a type within your tries.
    const passes = (table) => {
        let level = 0;
        for (let l = 1; l <= MAX_ROOM_LEVEL && 1 - (1 - table[l]) ** base.patience >= 0.5; l++) level = l;
        return level;
    };
    const rooms = keys.map((key, t) => ({
        key,
        type: key.startsWith("skill:") ? "skilling" : "combat",
        what: key.split(":")[1],
        loadout: t >= SKILLS.length ? monsters[t - SKILLS.length].setupName || null : null,
        passes: passes(baseTables[t]),
        tries: round(stats.tries[t] / runs, 2),
        lost: round(stats.lost[t] / runs, 2),
        shrouds: round(stats.shrouds[t] / runs, 2),
        gaveUp: round(stats.gaveUp[t] / runs, 2),
    })).sort((a, b) => a.passes - b.passes);

    // ---------- what would take you further ----------
    const candidates = [];
    const add = (c, setup) => candidates.push({ ...c, setup });
    const xpFor = (skill, levels) => {
        const table = request.levelXp;
        const level = request.skills?.[skill]?.level;
        const have = request.xp?.[skill];
        if (!Array.isArray(table) || !Number.isFinite(level) || !Number.isFinite(table[level + levels])) return null;
        return Math.max(0, Math.round(table[level + levels] - (Number.isFinite(have) ? have : table[level] || 0)));
    };
    SKILLS.forEach((skill, t) => {
        for (const levels of [5, 10]) add({ id: `skill:${skill}:${levels}`, kind: "skill", what: skill, levels, label: `+${levels} ${cap(skill)}`, xp: xpFor(skill, levels) }, { ...base, tables: withSkills({ levels }, t) });
    });
    monsters.forEach((m, k) => {
        for (const levels of [5, 15]) {
            const tables = baseTables.map((table, t) => (t === SKILLS.length + k ? combatTable(m.curve, levels) : table));
            add({ id: `combat:${names[k]}:${levels}`, kind: "combat", what: names[k], levels, loadout: m.setupName || null, label: `${levels} room levels better against ${cap(names[k].replace(/_/g, " "))}` }, { ...base, tables });
        }
    });
    for (const levels of [5, 15]) add({ id: `combat:all:${levels}`, kind: "combat", what: "all", levels, label: `${levels} room levels better against every monster` }, { ...base, tables: baseTables.map((table, t) => (t >= SKILLS.length ? combatTable(monsters[t - SKILLS.length].curve, levels) : table)) });
    // The shop: one level more of each upgrade that counts here.
    const torchLevels = Math.max(0, Math.round(((shop.TorchCap ?? base.torches) - BASE_TORCH_CAP) / 20));
    const shroudLevels = Math.max(0, (shop.ShroudCap ?? base.shrouds) - BASE_SHROUD_CAP);
    const tokens = Number.isFinite(request.tokens) ? request.tokens : null;
    const shopItem = (key, bought, setup) => {
        const cost = shopCost(key, bought);
        if (cost !== null) add({ id: `shop:${key}`, kind: "shop", what: key, label: SHOP[key].label, tokens: cost, affordable: tokens === null ? null : tokens >= cost }, setup);
    };
    // Counted only when you bring as many as the cap holds (else more of what you have is what helps).
    if (supplies.torches === undefined || base.torches >= (shop.TorchCap ?? 0)) shopItem("torchCap", torchLevels, { ...base, torches: base.torches + 20 });
    if (supplies.shrouds === undefined || base.shrouds >= (shop.ShroudCap ?? 0)) shopItem("shroudCap", shroudLevels, { ...base, shrouds: base.shrouds + 1 });
    for (const key of ["speed", "efficiency", "success", "double"]) {
        const bought = Math.max(0, Math.round(Number(shop[SHOP[key].info]) || 0));
        shopItem(key, bought, { ...base, tables: withSkills({ shop: { [key]: bought + 1 } }) });
    }
    // Supplies of a better tier.
    for (const next of TIERS.slice(TIERS.indexOf(request.teaCrate) + 1)) add({ id: `tea:${next}`, kind: "supply", what: `${next}_tea_crate`, label: `${cap(next)} tea crate` }, { ...base, tables: withSkills({ teaCrate: next }) });
    for (const next of TIERS.slice(TIERS.indexOf(torchTier) + 1)) add({ id: `torch:${next}`, kind: "supply", what: `${next}_torch`, label: `${cap(next)} torches (kept ${Math.round(100 * TORCH_KEPT[next])}% of the time)` }, { ...base, torchKept: TORCH_KEPT[next] });
    if (base.shrouds > 0) for (const next of TIERS.slice(TIERS.indexOf(shroudTier) + 1)) add({ id: `shroud:${next}`, kind: "supply", what: `${next}_shroud`, label: `${cap(next)} shrouds (${next === "expert" ? "never fail" : "sure up to room level 100"})` }, { ...base, shroudCap: SHROUD_CAP[next] });
    // How you play, and the game's automation settings.
    add({ id: "play:patience", kind: "setting", label: `Up to ${base.patience * 2} tries a room by hand (now ${base.patience})` }, { ...base, patience: base.patience * 2 });
    if (base.autoFloors > 0) {
        if (base.rushFloors < base.autoFloors) add({ id: "setting:rush", kind: "setting", label: `Rush for exit up to floor ${base.autoFloors}`, note: "the automation leaves the floor's other rooms (and their rewards) alone" }, { ...base, rushFloors: base.autoFloors });
        add({ id: "setting:manual", kind: "setting", label: "No full automation (every floor by hand, as the advisor would)" }, { ...base, autoFloors: 0 });
        if (base.maxAttempts < 3) add({ id: "setting:attempts", kind: "setting", label: "Max attempts per room: 3" }, { ...base, maxAttempts: 3 });
    }

    const out = [];
    candidates.forEach((c, i) => {
        const { setup, ...rest } = c;
        const result = compare(now, runSetup(setup, model, runs), target);
        out.push({ ...rest, floors: round(result.gain), error: round(result.error), reach: round(result.reach), minutes: round(result.minutes, 0), sure: Math.abs(result.gain) > 2 * result.error });
        onProgress(0.1 + (0.9 * (i + 1)) / candidates.length);
    });
    out.sort((a, b) => b.floors - a.floors || a.minutes - b.minutes);

    return {
        at: Date.now(),
        ms: Date.now() - started,
        runs,
        record: { floor: record, rooms: Number(shop.HighestFloorRooms) || null },
        target,
        now: { floors: round(mean(now.exits)), reach: round(now.exits.reduce((sum, x) => sum + (x >= target - 1 ? 1 : 0), 0) / runs), minutes: round(mean(now.minutes), 0), left: round(stats.left / runs, 1), walled: round(stats.walled / runs) },
        setup: { torches: base.torches, torchTier, shrouds: base.shrouds, shroudTier, teaCrate: request.teaCrate || null, autoFloors: base.autoFloors, rushFloors: base.rushFloors, maxAttempts: base.maxAttempts, shroudWhenStuck: base.shroudWhenStuck, patience: base.patience, tokens },
        // By hand a shroud goes on a room that costs more than this: about a chance under `below` to get past it within your tries.
        shroud: base.shrouds > 0 ? { worth: base.shroudWorth, below: round(1 / base.shroudWorth, 2) } : null,
        reach,
        rooms,
        candidates: out,
        calibration,
        shroudsSeen: learned.shrouds,
        model: { rooms: learned.rooms, runs: learned.runs, floors: Object.keys(learned.floors).map(Number).sort((a, b) => a - b), learnedFloors: model.floors.map((f, i) => (f?.learned ? i : 0)).filter(Boolean) },
        checkedAt: request.combat?.checkedAt ?? null,
    };
}
