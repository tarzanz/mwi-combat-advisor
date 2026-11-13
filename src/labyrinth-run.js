// Whole Labyrinth runs, simulated: how far your torches take you, what stops you, and
// which skill, shop upgrade, supply or setting would take you further. Worked out on your
// Pi (pi/labyrinth-sim.mjs) from what the browser sends (labyrinth-run-sync.js); pure – no
// browser, no game data.
//
// A run: floor after floor, each a grid of rooms (4 × 4 on floor 1, a row and a column more
// per floor up to 8 × 8), entered in the top left corner with the exit in the bottom right.
// A room next to a cleared one can be tried; a try costs a torch (an Advanced or Expert
// torch is kept 10% / 20% of the time) and is won with the chance of that room – a skilling
// room's worked out exactly (labyrinth-skilling.js), a combat room's read off the win curves
// of your last "Check the rooms". A shroud clears a room without a try. Clearing the exit
// leads to the next floor; the run ends when the torches are gone.
//
// What isn't known of the game is assumed, and replaced by what your recorded runs show
// (learnModel): the room levels of a floor (20 × floor + 1 … + 20), how often each room
// type comes (all alike), the exit being a room like the others.
//
// How the rooms are picked:
// - floors under full automation, as the game says it goes: the nearest way to the exit
//   through rooms not given up on (failed "max attempts" times), then – unless it rushes for
//   the exit – every other room it can reach, once each; stuck, it uses a shroud on the room
//   in the way ("When stuck"), and with none left you take over by hand;
// - floors played by hand, as the advisor would: always the room on the way to the exit that
//   costs the fewest torches on average (1 / the chance to win it; a room you never win is a
//   wall; rooms not in sight count as the floor's average, dearer the fewer can be passed),
//   trying again after a loss, going around when that is cheaper, and shrouding a room that
//   would cost more torches than a shroud is worth. With no way left, the run ends.
// Beacons aren't used. Every setup is run on the same floors with the same luck, so a
// difference between two of them is the change itself, not other dice.

import { skillingRoomChance } from "./labyrinth-skilling.js";

export const SKILLS = ["milking", "foraging", "woodcutting", "cheesesmithing", "crafting", "tailoring", "cooking", "brewing", "alchemy", "enhancing"];
export const MAX_ROOM_LEVEL = 400;
export const MAX_FLOOR = 18;
const MAX_GRID = 8;
// A room you (all but) never win: not tried.
const HOPELESS = 0.001;
const COST_CAP = 1 / HOPELESS;
// Rooms seen on a floor before its recorded levels replace the assumed ones.
const LEARN_ROOMS = 20;
// How many times its share each room type is assumed seen, before your runs say otherwise.
const TYPE_PRIOR = 3;
export const TORCH_KEPT = { basic: 0, advanced: 0.1, expert: 0.2 };
export const SHROUD_CAP = { basic: 50, advanced: 100, expert: Infinity };
export const TIERS = ["basic", "advanced", "expert"];
// What a shroud is worth in torches: tried in turn, the best kept.
const SHROUD_WORTHS = [3, 5, 8, 12, 20, 40];
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

// ---------- the floors ----------

export const typeKeys = (monsters) => [...SKILLS.map((s) => `skill:${s}`), ...monsters.map((m) => `monster:${m}`)];
const defaultSize = (floor) => Math.min(MAX_GRID, 3 + floor);
const defaultLow = (floor) => 20 * floor + 1;
const DEFAULT_WIDTH = 19;

// What the recorded runs (the game's Labyrinth states, labyrinth-states.js) say about the
// floors: per floor the grid's size and the room levels seen, and how often each room type came.
export function learnModel(states) {
    const rooms = new Map(); // run|floor|row|col -> { floor, type, level }
    const sizes = new Map(); // floor -> Map(size -> states)
    const runs = new Set();
    for (const entry of states || []) {
        const lab = entry?.labyrinth;
        const floor = Number(lab?.currentFloor);
        if (!lab || !Array.isArray(lab.roomData) || !Number.isInteger(floor) || floor < 1) continue;
        const run = `${lab.characterID ?? ""}|${lab.startedAt ?? ""}`;
        runs.add(run);
        const size = lab.roomData.length;
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
    return { floors, types, rooms: rooms.size, runs: runs.size };
}

// The floors as the simulation lays them out: floor -> { size, levels (drawn from, each as likely) }, the room types' weights.
export function floorModel(learned, keys) {
    const known = Object.entries(learned?.floors || {}).filter(([, f]) => f.levels.length >= LEARN_ROOMS).map(([floor, f]) => ({ floor: Number(floor), low: Math.min(...f.levels), high: Math.max(...f.levels), levels: f.levels }));
    // Floors not seen (enough): the seen floors' lowest levels as a line, their usual spread.
    let low = defaultLow;
    let width = DEFAULT_WIDTH;
    if (known.length) {
        width = Math.round(known.reduce((sum, f) => sum + (f.high - f.low), 0) / known.length);
        const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
        const fx = mean(known.map((f) => f.floor));
        const fy = mean(known.map((f) => f.low));
        const spread = known.reduce((sum, f) => sum + (f.floor - fx) ** 2, 0);
        const slope = spread > 0 ? known.reduce((sum, f) => sum + (f.floor - fx) * (f.low - fy), 0) / spread : 20;
        low = (floor) => Math.max(1, Math.round(fy + slope * (floor - fx)));
    }
    const floors = [null];
    for (let floor = 1; floor <= MAX_FLOOR; floor++) {
        const seen = known.find((f) => f.floor === floor);
        const from = low(floor);
        const levels = seen ? seen.levels : Array.from({ length: width + 1 }, (_, i) => from + i);
        floors.push({ size: Math.min(MAX_GRID, Math.max(2, learned?.floors?.[floor]?.size || defaultSize(floor))), levels: levels.map((l) => Math.min(MAX_ROOM_LEVEL, l)), learned: !!seen });
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

function newScratch() {
    return {
        type: new Uint8Array(CELLS), level: new Uint16Array(CELLS), seed: new Int32Array(CELLS), cleared: new Uint8Array(CELLS), fails: new Uint16Array(CELLS),
        open: new Uint8Array(CELLS), cost: new Float64Array(CELLS), dist: new Float64Array(CELLS), heapKey: new Float64Array(4 * CELLS), heapCell: new Int32Array(4 * CELLS),
    };
}

// What a room in sight costs in torches on average: 1 / the chance to win it, or what a shroud
// costs when one is left and that is less; a room you never win and can't shroud is a wall.
function roomCost(setup, chance, level, shroud) {
    const cost = chance < HOPELESS ? Infinity : 1 / chance;
    return shroud ? Math.min(cost, shroudCost(setup, level)) : cost;
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
                const cost = roomCost(setup, setup.tables[t][level], level, shroud === 1);
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

const shroudFail = (setup, level) => Math.min(1, Math.max(0, 0.02 * (level - setup.shroudCap)));
// What a shroud costs in torches at a room level (it fails 2% a level above its cap).
function shroudCost(setup, level) {
    const works = 1 - shroudFail(setup, level);
    return works > 0 ? setup.shroudWorth / works : Infinity;
}

// The room to try next: of the rooms that can be tried, the one the cheapest way to the
// exit starts with (each room's cost in s.cost; Infinity: not that way). Worked out from the
// exit, cheapest first, until a room that can be tried comes up – cleared rooms needn't be
// crossed: a way back through them comes out at another room that can be tried, no dearer.
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

// A room that can be tried: not cleared, next to a cleared one.
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

// One run of a setup: the floors' exits cleared. stats (optional) is added to.
// setup: { tables, torches, torchKept, shrouds, shroudCap, shroudWorth, autoFloors, rushFloors, maxAttempts, shroudWhenStuck, hidden: [] }
export function simulateRun(setup, model, runSeed, s, stats) {
    let torches = setup.torches;
    let shrouds = setup.shrouds;
    let exits = 0;
    let tries = 0; // for the torch-kept dice
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
            s.cleared[i] = 0;
            s.fails[i] = 0;
        }
        s.cleared[0] = 1;
        let auto = floor <= setup.autoFloors;
        const rush = floor <= setup.rushFloors;
        const torchesAtStart = torches;
        if (stats) stats.reached[floor]++;
        let plan = true; // the distances are out of date
        let pick = -1;
        let ended = false;
        while (true) {
            if (plan) {
                markOpen(s, n);
                const exitDone = !!s.cleared[N - 1];
                if (exitDone && (!auto || rush)) break;
                if (auto) {
                    // Rooms count one each; rooms given up on are walls.
                    for (let i = 0; i < N; i++) s.cost[i] = s.cleared[i] ? 0 : s.fails[i] >= setup.maxAttempts ? Infinity : 1;
                    if (exitDone) {
                        // The rest of the floor: any room in reach not given up on.
                        pick = -1;
                        for (let i = 0; i < N && pick < 0; i++) if (s.open[i] && s.fails[i] < setup.maxAttempts) pick = i;
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
                                if (unit(s.seed[pick] ^ 0x5bd1e995) >= shroudFail(setup, s.level[pick])) s.cleared[pick] = 1;
                                else s.fails[pick] = Math.max(s.fails[pick], setup.maxAttempts);
                                continue;
                            }
                            auto = false;
                            continue;
                        }
                    }
                } else {
                    const hidden = hiddenCost(setup, model, floor)[shrouds > 0 ? 1 : 0];
                    for (let i = 0; i < N; i++) {
                        if (s.cleared[i]) s.cost[i] = 0;
                        else if (!s.open[i]) s.cost[i] = hidden;
                        else s.cost[i] = roomCost(setup, setup.tables[s.type[i]][s.level[i]], s.level[i], shrouds > 0);
                    }
                    pick = nextRoom(s, n);
                    // No way to the exit but through rooms you never win: the run ends here.
                    if (pick < 0) {
                        ended = true;
                        break;
                    }
                }
                plan = false;
            }
            const type = s.type[pick];
            const chance = setup.tables[type][s.level[pick]];
            if (!auto) {
                // By hand: a shroud where the room costs more torches than the shroud is worth.
                if (shrouds > 0 && 1 / Math.max(HOPELESS, chance) > shroudCost(setup, s.level[pick])) {
                    shrouds--;
                    if (stats) stats.shrouds[type]++;
                    // A shroud that fails is gone; the room is as it was.
                    if (unit(s.seed[pick] ^ Math.imul(shrouds + 1, 0x5bd1e995)) >= shroudFail(setup, s.level[pick])) s.cleared[pick] = 1;
                    plan = true;
                    continue;
                }
                // Nothing left worth a torch: the run ends here.
                if (chance < HOPELESS) {
                    ended = true;
                    break;
                }
            }
            if (torches <= 0) {
                // Out of torches with the exit cleared (the automation was doing the floor's other rooms): on to the next floor.
                if (s.cleared[N - 1]) break;
                ended = true;
                break;
            }
            if (unit(runSeed + Math.imul(++tries, GOLD)) >= setup.torchKept) torches--;
            const won = unit(s.seed[pick] + Math.imul(s.fails[pick] + 1, GOLD)) < chance;
            if (stats) {
                stats.tries[type]++;
                if (!won) stats.lost[type]++;
            }
            if (won) {
                s.cleared[pick] = 1;
                plan = true;
            } else {
                s.fails[pick]++;
                // Under automation a room failed too often is given up on: another way is looked for.
                if (auto) plan = true;
            }
        }
        if (stats) stats.torches[floor] += torchesAtStart - torches;
        if (ended) {
            if (stats) {
                if (torches > 0) stats.stuck++;
                stats.left += torches;
                if (pick >= 0 && !s.cleared[pick]) stats.stopped[s.type[pick]]++;
                else if (pick < 0) stats.walled++;
            }
            return exits;
        }
        exits++;
    }
    return exits;
}

// ---------- many runs ----------

function newStats(types) {
    return { tries: new Float64Array(types), lost: new Float64Array(types), shrouds: new Float64Array(types), stopped: new Float64Array(types), reached: new Float64Array(MAX_FLOOR + 2), torches: new Float64Array(MAX_FLOOR + 2), stuck: 0, left: 0, walled: 0 };
}

// The exits cleared in each of `runs` runs of a setup (run k has the same floors and luck in every setup).
export function runSetup(setup, model, runs, seed = 1, stats = null) {
    const exits = new Uint8Array(runs);
    const scratch = newScratch();
    setup.hidden = [];
    for (let k = 0; k < runs; k++) exits[k] = simulateRun(setup, model, Math.imul(k + seed, 0x2c1b3c6d) | 0, scratch, stats);
    return exits;
}

const mean = (list) => {
    let sum = 0;
    for (let i = 0; i < list.length; i++) sum += list[i];
    return list.length ? sum / list.length : 0;
};

// A setup against the one now: the mean floors more, how sure (the difference over its standard error), the chance to reach a floor.
function compare(base, other, floor) {
    const n = base.length;
    let sum = 0;
    let squares = 0;
    let reach = 0;
    for (let i = 0; i < n; i++) {
        const d = other[i] - base[i];
        sum += d;
        squares += d * d;
        if (other[i] >= floor - 1) reach++;
    }
    const gain = sum / n;
    const error = Math.sqrt(Math.max(0, squares / n - gain * gain) / n);
    return { gain, error, reach: reach / n };
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
//   options: { autoFloors, rushFloors, maxAttempts, shroudWhenStuck, runs }
// states: the game's Labyrinth states your Pi kept (for the floors).
export function simulateLabyrinth(request, { states = [], runs, onProgress = () => {} } = {}) {
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
    const who = (skill, change = {}) => {
        const mine = request.skills?.[skill] || { level: 1 };
        return { level: (mine.level || 1) + (change.levels || 0), buffs: mine.buffs || [], crateBuffs: crate(change.teaCrate !== undefined ? change.teaCrate : request.teaCrate), shop: { ...(mine.shop || {}), ...(change.shop || {}) } };
    };
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
    };

    // What a shroud is worth by hand: the worth that takes you furthest (on a part of the runs).
    const tuneRuns = Math.min(runs, 800);
    let bestWorth = { worth: base.shroudWorth, floors: -1 };
    if (base.shrouds > 0) {
        for (const worth of SHROUD_WORTHS) {
            const floors = mean(runSetup({ ...base, shroudWorth: worth }, model, tuneRuns));
            if (floors > bestWorth.floors + 1e-9) bestWorth = { worth, floors };
        }
        base.shroudWorth = bestWorth.worth;
    }
    onProgress(0.05);

    const stats = newStats(keys.length);
    const now = runSetup(base, model, runs, 1, stats);
    const record = Math.max(1, Math.round(Number(shop.HighestFloor) || 1));
    const distribution = Array.from({ length: MAX_FLOOR + 1 }, () => 0);
    for (let i = 0; i < runs; i++) distribution[now[i]]++;
    const reach = [];
    let above = runs;
    for (let floor = 1; floor <= MAX_FLOOR && above > 0; floor++) {
        reach.push({ floor, share: round(above / runs), torches: stats.reached[floor] ? round(stats.torches[floor] / stats.reached[floor], 1) : 0, rooms: model.floors[floor].size ** 2, levels: [Math.min(...model.floors[floor].levels), Math.max(...model.floors[floor].levels)], learned: model.floors[floor].learned });
        above -= distribution[floor - 1];
    }
    // The floor the changes are measured at: the first one fewer than half the runs reach.
    const target = reach.find((f) => f.floor > 1 && f.share < 0.5)?.floor ?? reach[reach.length - 1].floor + 1;
    const rooms = keys.map((key, t) => ({
        key,
        type: key.startsWith("skill:") ? "skilling" : "combat",
        what: key.split(":")[1],
        loadout: t >= SKILLS.length ? monsters[t - SKILLS.length].setupName || null : null,
        tries: round(stats.tries[t] / runs, 2),
        lost: round(stats.lost[t] / runs, 2),
        shrouds: round(stats.shrouds[t] / runs, 2),
        stopped: round(stats.stopped[t] / runs),
    })).sort((a, b) => b.lost + 3 * b.shrouds - (a.lost + 3 * a.shrouds));

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
        const tables = baseTables.map((table, t) => (t === SKILLS.length + k ? combatTable(m.curve, 5) : table));
        add({ id: `combat:${names[k]}`, kind: "combat", what: names[k], levels: 5, loadout: m.setupName || null, label: `5 room levels better against ${cap(names[k].replace(/_/g, " "))}` }, { ...base, tables });
    });
    // The shop: one level more of each upgrade that counts here.
    const torchLevels = Math.max(0, Math.round((base.torches - BASE_TORCH_CAP) / 20));
    const shroudLevels = Math.max(0, base.shrouds - BASE_SHROUD_CAP);
    const tokens = Number.isFinite(request.tokens) ? request.tokens : null;
    const shopItem = (key, bought, setup, assumed = false) => {
        const cost = shopCost(key, bought);
        if (cost !== null) add({ id: `shop:${key}`, kind: "shop", what: key, label: SHOP[key].label, tokens: cost, assumed, affordable: tokens === null ? null : tokens >= cost }, setup);
    };
    // Counted only when you bring as many as the cap holds (else more of what you have is what helps).
    if (supplies.torches === undefined || base.torches >= (shop.TorchCap ?? 0)) shopItem("torchCap", torchLevels, { ...base, torches: base.torches + 20 }, true);
    if (supplies.shrouds === undefined || base.shrouds >= (shop.ShroudCap ?? 0)) shopItem("shroudCap", shroudLevels, { ...base, shrouds: base.shrouds + 1 }, true);
    for (const key of ["speed", "efficiency", "success", "double"]) {
        const bought = Math.max(0, Math.round(Number(shop[SHOP[key].info]) || 0));
        shopItem(key, bought, { ...base, tables: withSkills({ shop: { [key]: bought + 1 } }) });
    }
    // Supplies of a better tier.
    for (const next of TIERS.slice(TIERS.indexOf(request.teaCrate) + 1)) add({ id: `tea:${next}`, kind: "supply", what: `${next}_tea_crate`, label: `${cap(next)} tea crate` }, { ...base, tables: withSkills({ teaCrate: next }) });
    for (const next of TIERS.slice(TIERS.indexOf(torchTier) + 1)) add({ id: `torch:${next}`, kind: "supply", what: `${next}_torch`, label: `${cap(next)} torches (kept ${Math.round(100 * TORCH_KEPT[next])}% of the time)` }, { ...base, torchKept: TORCH_KEPT[next] });
    if (base.shrouds > 0) for (const next of TIERS.slice(TIERS.indexOf(shroudTier) + 1)) add({ id: `shroud:${next}`, kind: "supply", what: `${next}_shroud`, label: `${cap(next)} shrouds (${next === "expert" ? "never fail" : "sure up to room level 100"})` }, { ...base, shroudCap: SHROUD_CAP[next] });
    // The game's automation settings.
    if (base.autoFloors > 0) {
        if (base.rushFloors < base.autoFloors) add({ id: "setting:rush", kind: "setting", label: `Rush for exit up to floor ${base.autoFloors}`, note: "the automation leaves the floor's other rooms (and their rewards) alone" }, { ...base, rushFloors: base.autoFloors });
        add({ id: "setting:manual", kind: "setting", label: "No full automation (every floor by hand, as the advisor would)" }, { ...base, autoFloors: 0 });
        if (base.maxAttempts < 3) add({ id: "setting:attempts", kind: "setting", label: "Max attempts per room: 3" }, { ...base, maxAttempts: 3 });
    }

    const out = [];
    candidates.forEach((c, i) => {
        const { setup, ...rest } = c;
        const result = compare(now, runSetup(setup, model, runs), target);
        out.push({ ...rest, floors: round(result.gain), error: round(result.error), reach: round(result.reach), sure: Math.abs(result.gain) > 2 * result.error });
        onProgress(0.1 + (0.9 * (i + 1)) / candidates.length);
    });
    out.sort((a, b) => b.floors - a.floors);

    return {
        at: Date.now(),
        ms: Date.now() - started,
        runs,
        record: { floor: record, rooms: Number(shop.HighestFloorRooms) || null },
        target,
        now: { floors: round(mean(now)), reach: round(now.reduce((sum, x) => sum + (x >= target - 1 ? 1 : 0), 0) / runs), left: round(stats.left / runs, 1), stuck: round(stats.stuck / runs), walled: round(stats.walled / runs) },
        setup: { torches: base.torches, torchTier, shrouds: base.shrouds, shroudTier, teaCrate: request.teaCrate || null, autoFloors: base.autoFloors, rushFloors: base.rushFloors, maxAttempts: base.maxAttempts, shroudWhenStuck: base.shroudWhenStuck, tokens },
        shroud: base.shrouds > 0 ? { worth: base.shroudWorth, below: round(1 / base.shroudWorth) } : null,
        reach,
        rooms,
        candidates: out,
        model: { rooms: learned.rooms, runs: learned.runs, floors: Object.keys(learned.floors).map(Number).sort((a, b) => a - b), learnedFloors: model.floors.map((f, i) => (f?.learned ? i : 0)).filter(Boolean) },
        checkedAt: request.combat?.checkedAt ?? null,
    };
}
