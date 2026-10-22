// Runs one solo simulation with the community engine and boils the result down
// to per-hour numbers. Used by the web worker (and by the Node tests).

import CombatSimulator from "../engine/combatSimulator";
import Player from "../engine/player";
import Zone from "../engine/zone";

const ONE_HOUR = 3600e9;

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
        const result = await simulator.simulate(job.hours * ONE_HOUR);
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
        };
    } finally {
        Math.random = nativeRandom;
    }
}
