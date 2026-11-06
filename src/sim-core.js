// Runs one solo simulation with the community engine and boils the result down
// to per-hour numbers. Used by the web worker (and by the Node tests).

import CombatSimulator from "../engine/combatSimulator";
import Player from "../engine/player";
import Zone from "../engine/zone";
import Labyrinth from "../engine/labyrinth";
import { measured } from "./sim-telemetry.js";

const ONE_HOUR = 3600e9;
const ROOM_LIMIT_NS = 120e9; // the game gives a Labyrinth combat room 2 minutes

// Seeded PRNG: every candidate in a comparison is simulated with the same seeds
// ("common random numbers"), which makes small differences between setups
// much less noisy than independent runs would be.
function mulberry32(seed) {
    let a = seed | 0;
    return function () {
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function perHour(map, hours) {
    const out = {};
    for (const [key, value] of Object.entries(map || {})) out[key] = value / hours;
    return out;
}

export async function runSim(job) {
    const nativeRandom = Math.random;
    Math.random = mulberry32(job.seed);
    try {
        const zone = new Zone(job.zoneHrid, job.tier);
        const player = Player.createFromDTO(structuredClone(job.player));
        player.zoneBuffs = zone.buffs || [];
        player.extraBuffs = job.extraBuffs || [];

        const simulator = new CombatSimulator([player], zone, null, {});
        const simulate = () => simulator.simulate(job.hours * ONE_HOUR);
        const [result, telemetry] = job.telemetry ? await measured(simulator, player, simulate) : [await simulate(), null];
        const hours = result.simulatedTime / ONE_HOUR;

        const kills = {};
        for (const [hrid, count] of Object.entries(result.deaths)) {
            if (hrid !== "player1") kills[hrid] = count / hours;
        }

        const xp = perHour(result.experienceGained.player1, hours);
        return {
            hours,
            xp,
            xpTotal: Object.values(xp).reduce((sum, value) => sum + value, 0),
            deaths: (result.deaths.player1 || 0) / hours,
            encounters: result.encounters / hours,
            kills,
            consumables: perHour(result.consumablesUsed.player1, hours),
            manaUsed: perHour(result.manaUsed?.player1, hours),
            dropRateMultiplier: result.dropRateMultiplier.player1 ?? 1,
            rareFindMultiplier: result.rareFindMultiplier.player1 ?? 1,
            combatDropQuantity: result.combatDropQuantity.player1 ?? 0,
            ...(telemetry ? { telemetry: { ...telemetry, hours } } : {}),
        };
    } finally {
        Math.random = nativeRandom;
    }
}

// ---------- labyrinth rooms ----------
// A combat room in the Labyrinth: one monster, scaled to the room level, a fresh
// start (full HP and mana, no cooldowns) and 2 minutes to win. Simulates room after
// room until job.attempts have ended and counts how each ended: the monster died
// (a win, with the seconds it took), you died, or the 2 minutes ran out.
export async function runLabyrinthSim(job) {
    const nativeRandom = Math.random;
    Math.random = mulberry32(job.seed);
    try {
        const room = new Labyrinth(job.monsterHrid, job.roomLevel, []);
        const player = Player.createFromDTO(structuredClone(job.player));
        player.zoneBuffs = [];
        player.extraBuffs = job.extraBuffs || [];
        const simulator = new CombatSimulator([player], null, room, {});

        const out = { attempts: 0, wins: 0, deaths: 0, timeouts: 0, winSeconds: [] };
        let open = null; // the room under way: when it started and the death counts then
        const settle = () => {
            if (!open) return;
            const deaths = simulator.simResult.deaths;
            if ((deaths[job.monsterHrid] || 0) > open.kills) {
                out.wins++;
                out.winSeconds.push((simulator.simulationTime - open.start) / 1e9);
            } else if ((deaths.player1 || 0) > open.died) out.deaths++;
            else out.timeouts++;
            out.attempts++;
            open = null;
        };
        const nextMonster = room.getMonster.bind(room);
        room.getMonster = () => {
            settle();
            const deaths = simulator.simResult.deaths;
            open = { start: simulator.simulationTime, kills: deaths[job.monsterHrid] || 0, died: deaths.player1 || 0 };
            return nextMonster();
        };
        // Stop as soon as enough rooms have ended.
        const processEvent = simulator.processEvent.bind(simulator);
        simulator.processEvent = async (event) => {
            await processEvent(event);
            if (out.attempts >= job.attempts) simulator.simulationTime = Infinity;
        };
        await simulator.simulate((job.attempts + 1) * ROOM_LIMIT_NS);
        out.winSeconds.sort((a, b) => a - b);
        const at = (q) => (out.winSeconds.length ? out.winSeconds[Math.min(out.winSeconds.length - 1, Math.floor(q * out.winSeconds.length))] : null);
        const { winSeconds, ...counts } = out;
        return { ...counts, medianWinSeconds: at(0.5), slowWinSeconds: at(0.9) };
    } finally {
        Math.random = nativeRandom;
    }
}
