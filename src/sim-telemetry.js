// Measures, during a simulation, what the trigger advice rests on – without changing
// what the engine does: how often an ability's triggers held but its mana wasn't
// there (an auto attack instead), how much of a hit lands on a monster that was
// nearly dead anyway, how many monsters are up when an ability goes off, how much
// healing and food goes past full, and deaths while the HP food waits on its cooldown.
//
// The engine's methods are wrapped once; they only record while a run asks for it.

import CombatSimulator from "../engine/combatSimulator";
import CombatUtilities from "../engine/combatUtilities";
import SimResult from "../engine/simResult";

const MAX_SAMPLES = 2000; // killing hits kept per ability and run

let ctx = null; // { simulator, player, data, casting } while a measured run is going

function abilityStats(hrid) {
    const all = ctx.data.abilities;
    return (all[hrid] ||= { casts: 0, blocked: 0, enemiesAtCast: {}, hits: 0, hitDamage: 0, kills: [], healed: 0, overheal: 0, heals: 0, healSamples: [] });
}

function consumableStats(hrid) {
    return (ctx.data.consumables[hrid] ||= { uses: 0, restore: 0, wasted: 0 });
}

const alive = (units) => (units || []).filter((u) => u && u.combatDetails.currentHitpoints > 0).length;

let installed = false;

function install() {
    if (installed) return;
    installed = true;
    const sim = CombatSimulator.prototype;

    // Triggers held (the engine asks only then) but the mana isn't there: an auto attack instead.
    const canUseAbility = sim.canUseAbility;
    sim.canUseAbility = function (source, ability, oomCheck) {
        const ok = canUseAbility.call(this, source, ability, oomCheck);
        if (ctx && !ok && oomCheck && source.isPlayer && source.combatDetails.currentHitpoints > 0 && source.combatDetails.currentManapoints < ability.manaCost) {
            abilityStats(ability.hrid).blocked++;
        }
        return ok;
    };

    const tryUseAbility = sim.tryUseAbility;
    sim.tryUseAbility = function (source, ability) {
        if (!ctx || !source.isPlayer) return tryUseAbility.call(this, source, ability);
        const before = source.combatDetails.currentManapoints;
        const up = alive(this.enemies);
        ctx.casting = ability.hrid;
        try {
            const cast = tryUseAbility.call(this, source, ability);
            if (cast || source.combatDetails.currentManapoints < before) {
                const s = abilityStats(ability.hrid);
                s.casts++;
                s.enemiesAtCast[up] = (s.enemiesAtCast[up] || 0) + 1;
            }
            return cast;
        } finally {
            ctx.casting = null;
        }
    };

    const startNewEncounter = sim.startNewEncounter;
    sim.startNewEncounter = function (...args) {
        const out = startNewEncounter.apply(this, args);
        if (ctx) ctx.data.maxEnemies = Math.max(ctx.data.maxEnemies, (this.enemies || []).length);
        return out;
    };

    const tryUseConsumable = sim.tryUseConsumable;
    sim.tryUseConsumable = function (source, consumable) {
        if (!ctx || !source.isPlayer || source.combatDetails.currentHitpoints <= 0) return tryUseConsumable.call(this, source, consumable);
        const d = source.combatDetails;
        const missingHp = d.maxHitpoints - d.currentHitpoints;
        const missingMp = d.maxManapoints - d.currentManapoints;
        const used = tryUseConsumable.call(this, source, consumable);
        if (used) {
            const s = consumableStats(consumable.hrid);
            s.uses++;
            const hp = consumable.hitpointRestore || 0;
            const mp = consumable.manapointRestore || 0;
            s.restore += hp + mp;
            s.wasted += Math.max(0, hp - missingHp) + Math.max(0, mp - missingMp);
        }
        return used;
    };

    // Ability hits: the monster's HP before, what the hit did, and whether it died of it.
    const processAttack = CombatUtilities.processAttack;
    CombatUtilities.processAttack = function (source, target, abilityEffect = null) {
        if (!ctx || !ctx.casting || !abilityEffect || !source.isPlayer || target.isPlayer) return processAttack.call(this, source, target, abilityEffect);
        const hpBefore = target.combatDetails.currentHitpoints;
        const result = processAttack.call(this, source, target, abilityEffect);
        if (result.didHit) {
            const s = abilityStats(ctx.casting);
            if (target.combatDetails.currentHitpoints <= 0) {
                if (s.kills.length < MAX_SAMPLES) s.kills.push(hpBefore);
            } else {
                s.hits++;
                s.hitDamage += result.damageDone;
            }
        }
        return result;
    };

    const addDeath = SimResult.prototype.addDeath;
    SimResult.prototype.addDeath = function (unit) {
        if (ctx && unit === ctx.player) {
            const now = ctx.simulator.simulationTime;
            ctx.data.deaths++;
            if ((unit.food || []).some((f) => f && f.hitpointRestore > 0 && f.lastUsed + f.cooldownDuration > now)) ctx.data.deathsFoodWaiting++;
        }
        return addDeath.call(this, unit);
    };

    const processHeal = CombatUtilities.processHeal;
    CombatUtilities.processHeal = function (source, abilityEffect, target) {
        if (!ctx || !ctx.casting || !source.isPlayer) return processHeal.call(this, source, abilityEffect, target);
        const missing = target.combatDetails.maxHitpoints - target.combatDetails.currentHitpoints;
        const healed = processHeal.call(this, source, abilityEffect, target);
        const s = abilityStats(ctx.casting);
        s.heals++;
        s.healed += healed;
        // A heal that didn't reach full shows how much it heals; one that did, only that it went past.
        if (healed < missing) {
            if (s.healSamples.length < MAX_SAMPLES) s.healSamples.push(healed);
        } else {
            s.overheal++;
        }
        return healed;
    };
}

// Runs fn (one simulation) while measuring; returns [fn's result, the measurements].
// player is the engine's Player, to tell deaths with the HP food on cooldown.
export async function measured(simulator, player, fn) {
    install();
    const data = { abilities: {}, consumables: {}, maxEnemies: 0, deaths: 0, deathsFoodWaiting: 0 };
    ctx = { simulator, player, data, casting: null };
    try {
        return [await fn(), data];
    } finally {
        ctx = null;
    }
}
