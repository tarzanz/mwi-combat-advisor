// Trigger advice: a few changes to an ability's or a food's triggers, worked out from
// what one measured simulation of your setup showed (sim-telemetry.js), instead of
// trying every condition and value. Only whole numbers, as the game takes them.
//
// What each rule looks for, and what it then tries:
// - mana:     an ability whose triggers hold while its mana isn't there stops the rest
//             (an auto attack instead) – "own MP ≥ its cost", so the next ability goes instead;
// - reserve:  a cheaper ability further down spends the mana that ability then lacks –
//             "own MP ≥ both costs" on the cheaper one;
// - overkill: a single-target hit that often lands on a nearly dead monster –
//             "target's HP ≥ half / one typical hit";
// - aoe:      an area ability with more than one monster up at times – "monsters up ≥ 1, 2, 3";
// - heal:     a heal that goes past full or goes off for a scratch – "missing HP ≥" a part of what it heals;
// - food:     HP or MP food eaten later (less food) or earlier (when you die or run dry).
// Buffs and drinks keep "is inactive": they already go off as soon as they can.

const SELF = "/combat_trigger_dependencies/self";
const TARGET = "/combat_trigger_dependencies/targeted_enemy";
const ENEMIES = "/combat_trigger_dependencies/all_enemies";
const C = (name) => "/combat_trigger_conditions/" + name;
const GTE = "/combat_trigger_comparators/greater_than_equal";
const LTE = "/combat_trigger_comparators/less_than_equal";

const MAX_CONDITIONS = 4;
const SHARE = 0.1; // a pattern worth acting on shows up in at least a tenth of the casts

const whole = (x) => Math.max(1, Math.round(x));
const median = (list) => {
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => a - b);
    return sorted[sorted.length >> 1];
};

export function cleanTriggers(list) {
    return (list || []).map((t) => ({ dependencyHrid: t.dependencyHrid, conditionHrid: t.conditionHrid, comparatorHrid: t.comparatorHrid, value: t.value ?? 0 }));
}

export function abilityTriggers(profile, hrid, data) {
    return cleanTriggers(profile.abilityTriggers?.[hrid] || data.abilityDetailMap[hrid]?.defaultCombatTriggers);
}

export function consumableTriggers(profile, hrid, data) {
    return cleanTriggers(profile.consumableTriggers?.[hrid] || data.itemDetailMap[hrid]?.consumableDetail?.defaultCombatTriggers);
}

export const triggersKey = (list) => cleanTriggers(list).map((t) => [t.dependencyHrid, t.conditionHrid, t.comparatorHrid, t.value].join(":")).sort().join("|");

// Sums the measurements of several runs (each from runSim's telemetry).
export function mergeTelemetry(list) {
    const out = { abilities: {}, consumables: {}, maxEnemies: 0, deaths: 0, deathsFoodWaiting: 0, hours: 0 };
    for (const t of list.filter(Boolean)) {
        out.maxEnemies = Math.max(out.maxEnemies, t.maxEnemies);
        out.deaths += t.deaths;
        out.deathsFoodWaiting += t.deathsFoodWaiting;
        out.hours += t.hours;
        for (const [hrid, s] of Object.entries(t.abilities)) {
            const o = (out.abilities[hrid] ||= { casts: 0, blocked: 0, enemiesAtCast: {}, hits: 0, hitDamage: 0, kills: [], healed: 0, overheal: 0, heals: 0, healSamples: [] });
            for (const k of ["casts", "blocked", "hits", "hitDamage", "healed", "overheal", "heals"]) o[k] += s[k];
            for (const [n, count] of Object.entries(s.enemiesAtCast)) o.enemiesAtCast[n] = (o.enemiesAtCast[n] || 0) + count;
            o.kills.push(...s.kills);
            o.healSamples.push(...s.healSamples);
        }
        for (const [hrid, s] of Object.entries(t.consumables)) {
            const o = (out.consumables[hrid] ||= { uses: 0, restore: 0, wasted: 0 });
            for (const k of ["uses", "restore", "wasted"]) o[k] += s[k];
        }
    }
    return out;
}

function effectTypes(ability) {
    return (ability?.abilityEffects || []).map((e) => e.effectType.split("/").pop() + ":" + e.targetType);
}

// Replaces the conditions on (dependency, condition) – or adds one – with the given comparator and value.
function setCondition(list, dependencyHrid, conditionHrid, comparatorHrid, value) {
    const rest = list.filter((t) => !(t.dependencyHrid === dependencyHrid && t.conditionHrid === conditionHrid));
    return [...rest, { dependencyHrid, conditionHrid, comparatorHrid, value }];
}

function valueOf(list, dependencyHrid, conditionHrid, comparatorHrid) {
    return list.find((t) => t.dependencyHrid === dependencyHrid && t.conditionHrid === conditionHrid && t.comparatorHrid === comparatorHrid)?.value ?? null;
}

// Trigger changes for the abilities in battle order (normal slots) and the food you use.
// battle: the normal slots' entries as the game casts them; telemetry: merged measurements.
// Returns [{ target: "ability" | "food", hrid, triggers, was, rule, why }], at most one per (hrid, triggers).
export function triggerChanges(profile, battle, telemetry, data, options = {}) {
    const out = [];
    const seen = new Set();
    const add = (target, hrid, was, triggers, rule, why) => {
        if (triggers.length > MAX_CONDITIONS) return;
        const key = hrid + "|" + triggersKey(triggers);
        if (triggersKey(triggers) === triggersKey(was) || seen.has(key)) return;
        seen.add(key);
        out.push({ target, hrid, triggers, was, rule, why });
    };
    const stats = (hrid) => telemetry.abilities[hrid] || { casts: 0, blocked: 0, enemiesAtCast: {}, hits: 0, hitDamage: 0, kills: [], healed: 0, overheal: 0, heals: 0, healSamples: [] };
    const cost = (hrid) => data.abilityDetailMap[hrid]?.manaCost || 0;
    const onlyHrids = options.only ? new Set(options.only) : null;

    // Abilities that often waited for their mana with their triggers holding.
    const starved = battle.filter((e) => {
        const s = stats(e.hrid);
        return s.blocked >= 3 && s.blocked >= SHARE * Math.max(1, s.casts);
    });

    battle.forEach((entry, position) => {
        const hrid = entry.hrid;
        if (onlyHrids && !onlyHrids.has(hrid)) return;
        const ability = data.abilityDetailMap[hrid];
        if (!ability) return;
        const was = abilityTriggers(profile, hrid, data);
        const s = stats(hrid);
        const kinds = effectTypes(ability);
        const later = battle.slice(position + 1);

        // mana: let the abilities after it go while this one waits for its mana.
        if (starved.includes(entry) && later.some((e) => cost(e.hrid) < cost(hrid)) && !(valueOf(was, SELF, C("current_mp"), GTE) >= cost(hrid))) {
            add("ability", hrid, was, setCondition(was, SELF, C("current_mp"), GTE, cost(hrid)), "mana", { blocked: s.blocked, casts: s.casts });
        }
        // reserve: keep the mana that an ability above, which waits for it, needs.
        const above = battle.slice(0, position).filter((e) => starved.includes(e) && cost(e.hrid) > 0);
        if (above.length && s.casts > 0 && cost(hrid) > 0) {
            const first = above.sort((a, b) => stats(b.hrid).blocked - stats(a.hrid).blocked)[0];
            add("ability", hrid, was, setCondition(was, SELF, C("current_mp"), GTE, cost(first.hrid) + cost(hrid)), "reserve", { for: first.hrid, blocked: stats(first.hrid).blocked });
        }
        // overkill: a single-target hit that often finishes a nearly dead monster.
        if (kinds.includes("damage:enemy") && !kinds.includes("damage:allEnemies") && s.hits > 0) {
            const typical = s.hitDamage / s.hits;
            const wasted = s.kills.filter((hp) => hp < 0.5 * typical).length;
            if (typical >= 2 && wasted >= SHARE * Math.max(1, s.casts)) {
                for (const factor of [0.5, 1]) {
                    add("ability", hrid, was, setCondition(was, TARGET, C("current_hp"), GTE, whole(factor * typical)), "overkill", { typical: Math.round(typical), wasted, casts: s.casts });
                }
            }
        }
        // aoe: how many monsters must be up.
        if (kinds.includes("damage:allEnemies") && telemetry.maxEnemies >= 2) {
            const now = valueOf(was, ENEMIES, C("number_of_active_units"), GTE) ?? 1;
            const castsBelow = (k) => Object.entries(s.enemiesAtCast).reduce((sum, [n, count]) => sum + (Number(n) < k ? count : 0), 0);
            for (let k = 1; k <= Math.min(3, telemetry.maxEnemies); k++) {
                if (k === now) continue;
                if (k > now && castsBelow(k) < SHARE * Math.max(1, s.casts)) continue;
                add("ability", hrid, was, setCondition(was, ENEMIES, C("number_of_active_units"), GTE, k), "aoe", { from: now, to: k });
            }
        }
        // heal: how much HP must be missing first.
        if (kinds.some((k) => k.startsWith("heal:")) && (s.heals > 0 || s.blocked > 0)) {
            const typical = median(s.healSamples) ?? (s.heals ? s.healed / s.heals : null);
            if (typical >= 2) {
                const hpConditions = [C("current_hp"), C("missing_hp"), C("lowest_hp_percentage")];
                const base = was.filter((t) => !hpConditions.includes(t.conditionHrid));
                const now = valueOf(was, SELF, C("missing_hp"), GTE);
                for (const factor of [0.5, 1, 2]) {
                    const value = whole(factor * typical);
                    if (now !== null && Math.abs(value - now) <= 0.1 * Math.max(now, 1)) continue;
                    add("ability", hrid, was, [...base, { dependencyHrid: SELF, conditionHrid: C("missing_hp"), comparatorHrid: GTE, value }], "heal", { typical: Math.round(typical), overheal: s.overheal, heals: s.heals });
                }
            }
        }
    });

    // food: eaten later (less of it), or earlier when you die or your abilities wait for mana.
    const blockedTotal = battle.reduce((sum, e) => sum + stats(e.hrid).blocked, 0);
    const castsTotal = battle.reduce((sum, e) => sum + stats(e.hrid).casts, 0);
    for (const hrid of new Set((options.food || []).filter(Boolean))) {
        if (onlyHrids && !onlyHrids.has(hrid)) continue;
        const detail = data.itemDetailMap[hrid]?.consumableDetail;
        const used = telemetry.consumables[hrid]?.uses || 0;
        if (!detail || !used) continue;
        const was = consumableTriggers(profile, hrid, data);
        for (const [condition, restore, short] of [
            [C("missing_hp"), detail.hitpointRestore, telemetry.deaths > 0],
            [C("missing_mp"), detail.manapointRestore, blockedTotal >= SHARE * Math.max(1, castsTotal)],
        ]) {
            if (!(restore > 0)) continue;
            const now = valueOf(was, SELF, condition, GTE);
            if (now === null) continue;
            const value = short ? whole(now / 2) : whole(now * 1.5);
            if (value !== now) add("food", hrid, was, setCondition(was, SELF, condition, GTE, value), "food", { earlier: short, deaths: telemetry.deaths, blocked: blockedTotal });
        }
    }
    return out;
}

// Shorter names than the game's for the values you compare.
const SHORT = { current_hp: "HP", current_mp: "MP", missing_hp: "missing HP", missing_mp: "missing MP", lowest_hp_percentage: "lowest HP %" };

// "target's HP ≥ 300", "own MP ≥ 55", "enemies up ≥ 2", "own Berserk is inactive".
export function describeTrigger(t, data) {
    const name = t.conditionHrid.split("/").pop();
    const condition = data.combatTriggerConditionDetailMap?.[t.conditionHrid];
    const comparator = data.combatTriggerComparatorDetailMap?.[t.comparatorHrid];
    const side = t.dependencyHrid === ENEMIES ? "enemies" : "allies";
    const sign = t.comparatorHrid === GTE ? "≥" : t.comparatorHrid === LTE ? "≤" : null;
    if (name === "number_of_active_units") return `${side} up ${sign} ${t.value}`;
    if (name === "number_of_dead_units") return `${side} dead ${sign} ${t.value}`;
    const who = { [SELF]: "own", [TARGET]: "target's" }[t.dependencyHrid] ?? (name === "lowest_hp_percentage" ? side + "'" : side + "' total");
    const what = SHORT[name] || condition?.name || name;
    if (!sign) return `${who} ${what} ${(comparator?.name || "").toLowerCase()}`.trim();
    return `${who} ${what} ${sign} ${t.value}`;
}

export function describeTriggers(list, data) {
    const shown = cleanTriggers(list);
    return shown.length ? shown.map((t) => describeTrigger(t, data)).join(" and ") : "always";
}
