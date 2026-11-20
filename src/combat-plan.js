// ⚔ The combat plan: N days ahead in one combat style, worked out on the Pi once a night
// (pi/combat-plan-entry.js). Not the gold a day like the 📈 plan: the levels the style trains
// (its own skill, attack, defense, stamina, intelligence – whatever the game's style gives XP
// to), with the coins you have now and what skilling earns spent on getting there faster.
//
// The model, in short:
// - Time goes in 8-hour blocks, either combat (a zone and tier, the loadout of the moment)
//   or skilling (the 📈 plan's job for that day, for its gold – skilling levels count for
//   nothing here, you train them anyway).
// - Every few days (a checkpoint, about ten in a plan) the character is looked at again: the
//   zones near the best (all of them the first time) are simulated at its levels then, and
//   every upgrade – gear (+levels for sale), ability books and levels, drinks, food, the
//   combat house rooms, the ability order – one at a time in the best zone (analysis.js); after
//   the first, only what helped before or wasn't tried yet (newly unlocked or affordable).
// - Then how many blocks of skilling to put in first: each choice buys the upgrades its coins
//   reach (best levels a coin first, buildPlan) and is judged by the levels it gives by the
//   end (fewer combat blocks, a faster rate) plus levelDays of the rate at the end. Coins
//   never go below the reserve; nothing is kept for its own sake, the rest is spent.
// - The upgrades bought are put on, the zones looked at again, and the fight runs to the next
//   checkpoint at the rate measured; XP becomes levels as the game's table says, and with
//   them new gear, books and tiers.
// - The triggers and the ability order are tuned only for the first fight (the "abilities and
//   triggers" analysis): later phases keep yours, and the next night tunes them when you
//   get there.
// - Compared with fighting as you are (no purchases, best zone) and with what skilling would
//   have earned in the combat blocks.

import { askPrice, getClientData } from "./game-data.js";
import { analyzeUpgrades, analyzeZones, applyPlan, buildPlan, pickBestZone, rateUpgrades, simulateVariants, xpValue, ACCURACY } from "./analysis.js";
import { COMBAT_SKILLS, cloneProfile, equip, meetsRequirements, styleOfItem, styleSkills, weaponOf } from "./profile.js";
import { experienceOf, fractionalLevel } from "./levels.js";

export const COMBAT_PLAN_DEFAULTS = {
    style: "magic", // magic | ranged | melee
    meleeType: "any", // any | stab | slash | smash
    days: 30,
    reserve: 5_000_000,
    charms: false, // charms put their XP into one skill
    levelDays: 7,
    setupId: "auto",
    accuracy: "normal",
    acceptRareDeaths: false,
};
export const COMBAT_PLAN_DAYS = [7, 14, 30, 60, 90];
const BLOCK_HOURS = 8;
const BLOCKS_A_DAY = 24 / BLOCK_HOURS;
const CHECKPOINTS = 10;
const MAX_TIER = 5;
const ZONES_KEPT = 10; // zones looked at again at a later checkpoint (and the tier above each)
const SKILL = (name) => "/skills/" + name;

export function combatPlanSettings(settings) {
    const s = { ...COMBAT_PLAN_DEFAULTS, ...(settings || {}) };
    if (!["magic", "ranged", "melee"].includes(s.style)) s.style = COMBAT_PLAN_DEFAULTS.style;
    if (!["any", "stab", "slash", "smash"].includes(s.meleeType)) s.meleeType = "any";
    s.days = Math.max(1, Math.min(90, Math.round(Number(s.days) || COMBAT_PLAN_DEFAULTS.days)));
    s.reserve = Math.max(0, Number(s.reserve) || 0);
    s.levelDays = Math.max(0, Math.min(30, Number(s.levelDays ?? COMBAT_PLAN_DEFAULTS.levelDays)));
    s.charms = !!s.charms;
    if (!ACCURACY[s.accuracy]) s.accuracy = "normal";
    return s;
}

// The melee style a weapon fights with ("smash"), else null.
function subStyleOf(data, hrid) {
    const first = data.itemDetailMap[hrid]?.equipmentDetail?.combatStats?.combatStyleHrids?.[0] || "";
    return first.startsWith("/combat_styles/") ? first.split("/").pop() : null;
}

function fitsStyle(data, hrid, s) {
    const item = data.itemDetailMap[hrid];
    if (styleOfItem(item) !== s.style) return false;
    return s.style !== "melee" || s.meleeType === "any" || subStyleOf(data, hrid) === s.meleeType;
}

// The loadout the plan starts from: the one asked for, else the first whose weapon fits the
// style (the melee type too), else what you wear.
export function startSetup(setups, data, s) {
    if (s.setupId !== "auto") {
        const asked = setups.find((x) => x.id === s.setupId);
        if (asked) return asked;
    }
    const weaponFits = (x) => {
        const weapon = weaponOf(x.profile);
        return weapon && fitsStyle(data, weapon.hrid, s);
    };
    return setups.find((x) => x.id !== "equipped" && weaponFits(x)) || setups.find(weaponFits) || setups.find((x) => x.id === "equipped") || setups[0];
}

// A weapon of the style when the loadout's isn't: the best one in the inventory, else the
// cheapest on the market. Returns { profile, starter } (starter null when the weapon fits).
function withStyleWeapon(profile, data, s) {
    const weapon = weaponOf(profile);
    if (weapon && fitsStyle(data, weapon.hrid, s)) return { profile, starter: null };
    const fits = (item) =>
        item.equipmentDetail &&
        fitsStyle(data, item.hrid, s) &&
        item.equipmentDetail.combatStats?.primaryTraining === SKILL(s.style) &&
        meetsRequirements(profile, item.equipmentDetail.levelRequirements);
    const weapons = new Map(Object.values(data.itemDetailMap).filter(fits).map((item) => [item.hrid, item]));
    const owned = profile.inventory
        .filter((i) => weapons.has(i.hrid))
        .sort((a, b) => (weapons.get(b.hrid).itemLevel || 0) - (weapons.get(a.hrid).itemLevel || 0) || b.enhancementLevel - a.enhancementLevel)[0];
    let starter = null;
    if (owned) starter = { hrid: owned.hrid, enhancementLevel: owned.enhancementLevel, cost: 0, owned: true };
    else {
        for (const item of weapons.values()) {
            const price = askPrice(item.hrid, 0);
            if (price !== null && (!starter || price < starter.cost)) starter = { hrid: item.hrid, enhancementLevel: 0, cost: price, owned: false };
        }
    }
    if (!starter) throw new Error(`No ${s.style}${s.style === "melee" && s.meleeType !== "any" ? ` (${s.meleeType})` : ""} weapon you can wear is for sale.`);
    const variant = cloneProfile(profile);
    starter.slot = data.itemDetailMap[starter.hrid].equipmentDetail.type.split("/").pop();
    starter.replaces = weapon || null;
    equip(variant, starter.slot, { hrid: starter.hrid, enhancementLevel: starter.enhancementLevel });
    return { profile: variant, starter };
}

// What the analyses may offer: no charms unless asked for, no weapon of another melee style.
function keeper(data, s) {
    return (c) => {
        if (c.kind !== "gear") return true;
        if (c.slot === "charm" && !s.charms) return false;
        if (c.slot === "main_hand" || c.slot === "two_hand") return fitsStyle(data, c.hrid, s);
        return true;
    };
}

// Skilling's gold an 8-hour block on day `day`: the 📈 plan's segments ({ from, to, perDay, name }).
export function skillingAt(skilling, day) {
    const list = skilling || [];
    const seg = list.find((x) => day >= x.from && day < x.to) || list[list.length - 1] || null;
    return seg ? { gold: Math.max(0, seg.perDay || 0) / BLOCKS_A_DAY, name: seg.name || null, skill: seg.skill || null } : { gold: 0, name: null, skill: null };
}

function skillingGold(skilling, fromBlock, blocks) {
    let sum = 0;
    for (let b = fromBlock; b < fromBlock + blocks; b++) sum += skillingAt(skilling, b / BLOCKS_A_DAY).gold;
    return sum;
}

// XP into levels: the profile's levels, allLevels and allExperience follow the XP.
function addExperience(profile, xpPerHour, hours, table) {
    for (const skill of COMBAT_SKILLS) {
        const rate = xpPerHour?.[skill] || 0;
        if (!(rate > 0)) continue;
        const key = SKILL(skill);
        const now = experienceOf(table, profile.allExperience?.[key], profile.levels[skill]);
        const xp = now + rate * hours;
        const level = Math.floor(fractionalLevel(table, xp));
        profile.allExperience = { ...profile.allExperience, [key]: xp };
        const gained = level - profile.levels[skill];
        profile.levels[skill] = level;
        profile.allLevels = { ...profile.allLevels, [key]: level };
        if (gained > 0 && Number.isFinite(profile.totalLevel)) profile.totalLevel += gained;
    }
}

function levelsOf(profile, skills, table) {
    const out = {};
    for (const skill of skills) out[skill] = fractionalLevel(table, experienceOf(table, profile.allExperience?.[SKILL(skill)], profile.levels[skill]));
    return out;
}
const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);

// What the plan writes down of a loadout.
function slim(profile) {
    return {
        equipment: profile.equipment,
        abilities: profile.abilities,
        food: profile.food,
        drinks: profile.drinks,
        abilityTriggers: profile.abilityTriggers,
        consumableTriggers: profile.consumableTriggers,
        houseRooms: profile.houseRooms,
    };
}

const zoneKey = (z) => `${z.zoneHrid}#${z.tier}`;

// The zones to look at: every zone and tier the first time, then the best few of the last
// look and the tier above each of them.
function zonesToTry(last) {
    if (!last) return null;
    const data = getClientData();
    const picked = new Map();
    for (const z of last.slice(0, ZONES_KEPT)) {
        picked.set(zoneKey(z.zone), z.zone);
        const max = Math.min(MAX_TIER, data.actionDetailMap[z.zone.zoneHrid]?.maxDifficulty ?? 0);
        if (z.zone.tier < max) {
            const up = { zoneHrid: z.zone.zoneHrid, tier: z.zone.tier + 1 };
            picked.set(zoneKey(up), up);
        }
    }
    return [...picked.values()];
}

function rankZones(results, settings) {
    const best = pickBestZone(results, settings);
    if (!best) return { best: null, ranked: [] };
    const fine = (z) => z.result.deaths <= (settings.acceptRareDeaths ? 0.5 : 0);
    const ranked = [...results].sort((a, b) => (fine(b) ? 1 : 0) - (fine(a) ? 1 : 0) || xpValue(b.result, settings) - xpValue(a.result, settings));
    return { best, ranked };
}

// A purchase as the plan lists it.
function purchaseOf(pick) {
    return {
        kind: pick.kind,
        slot: pick.slot,
        hrid: pick.hrid,
        bookHrid: pick.bookHrid || null,
        enhancementLevel: pick.enhancementLevel ?? null,
        level: pick.level ?? null,
        books: pick.books ?? (pick.kind === "ability" && pick.cost > 0 ? 1 : null),
        fromLevel: pick.fromLevel ?? null,
        materials: pick.materials ? pick.materials.map((m) => ({ hrid: m.hrid, count: m.count })) : null,
        cost: Math.round(pick.cost || 0),
        price: Math.round(pick.price ?? pick.cost ?? 0),
        owned: !!pick.owned,
        replaces: pick.replaces || null,
        sold: (pick.sold || []).map((g) => ({ hrid: g.hrid, enhancementLevel: g.enhancementLevel })),
        delta: pick.delta ?? null,
    };
}

// What a shopping list gives, as a share of the rate now (the changes add up, roughly).
function planGain(plan) {
    let gain = 0;
    for (const p of plan.picks) gain += Math.max(0, p.delta || 0);
    for (const p of [plan.drink, plan.food, plan.order, ...(plan.triggers || [])]) if (p) gain += Math.max(0, p.delta || 0);
    return gain;
}

// Puts the purchases on and keeps the books read and the gear sold in the profile.
function putOn(profile, plan) {
    const next = applyPlan(profile, plan);
    for (const pick of plan.picks) {
        if (pick.kind === "ability" || pick.kind === "abilityLevel") {
            next.learnedAbilities = { ...next.learnedAbilities, [pick.hrid]: Math.max(pick.level, next.learnedAbilities?.[pick.hrid] || 0) };
            const table = getClientData()?.levelExperienceTable;
            if (table?.[pick.level] !== undefined) next.abilityExperience = { ...next.abilityExperience, [pick.hrid]: Math.max(table[pick.level], next.abilityExperience?.[pick.hrid] || 0) };
        }
        if (pick.kind === "gear") {
            const sold = new Set((pick.sold || []).map((g) => `${g.hrid}+${g.enhancementLevel}`));
            next.inventory = next.inventory.filter((i) => !sold.has(`${i.hrid}+${i.enhancementLevel}`));
            if (pick.owned) {
                const i = next.inventory.findIndex((x) => x.hrid === pick.hrid && x.enhancementLevel === pick.enhancementLevel);
                if (i >= 0) next.inventory.splice(i, 1);
            }
        }
    }
    return next;
}

// Free changes only (abilities you know, their order, their triggers, drinks and food you'd
// buy anyway are left to the purchase list): what the "abilities and triggers" analysis says.
function freeChanges(plan) {
    return { picks: plan.picks.filter((p) => !(p.cost > 0)), order: plan.order, triggers: plan.triggers, drink: null, food: null };
}

// input: { settings, setups: [{ id, name, profile }], coins, skilling: [{ from, to, perDay, name, skill }] }
// onProgress(stage, done, total); onStage(stage) as each checkpoint is done.
export async function planCombat(pool, input, data, { onProgress = () => {}, onStage = () => {} } = {}) {
    const s = combatPlanSettings(input.settings);
    const table = data.levelExperienceTable;
    if (!Array.isArray(table)) throw new Error("The game's level table is missing.");
    const skills = styleSkills(s.style, data);
    const setup = startSetup(input.setups || [], data, s);
    if (!setup) throw new Error("No loadout to start from.");
    const keep = keeper(data, s);
    const accuracy = (name) => ({ ...ACCURACY[name] });
    const analysisSettings = (acc) => ({ countLevels: true, goldWeight: 0, acceptRareDeaths: s.acceptRareDeaths, spending: "all", maxTier: MAX_TIER, ...accuracy(acc), keep, noSkillLevels: true });

    const styled = withStyleWeapon(cloneProfile(setup.profile), data, s);
    let profile = styled.profile;
    let coins = Math.max(0, Number(input.coins) || 0) - (styled.starter?.cost || 0);
    const startProfile = cloneProfile(profile);
    const totalBlocks = s.days * BLOCKS_A_DAY;
    const segment = Math.max(BLOCKS_A_DAY, Math.ceil(totalBlocks / CHECKPOINTS));
    const checkpoints = Math.ceil(totalBlocks / segment);
    const phases = [];
    const stats = { combatBlocks: 0, skillingBlocks: 0, skillingGold: 0, spent: styled.starter?.cost || 0, combatProfit: 0 };
    let lastZones = null;
    // After the first checkpoint only what helped before, or wasn't tried yet (newly unlocked or
    // affordable), is tried again: what didn't help at all seldom starts to.
    const seen = new Set();
    const useful = new Set();
    const candidateKey = (c) => [c.kind, c.slot === "main_hand" || c.slot === "two_hand" ? "weapon" : c.kind === "gear" ? c.slot : "", c.hrid, c.enhancementLevel ?? "", c.level ?? "", c.extraFood ?? ""].join("|");
    const keepNow = (c) => keep(c) && (seen.size === 0 || c.kind === "abilityOrder" || !seen.has(candidateKey(c)) || useful.has(candidateKey(c)));
    let tuned = false;
    let block = 0;
    let lastRate = null;
    const progress = (stage) => (done, total) => onProgress(stage, done, total);

    for (let cp = 0; block < totalBlocks; cp++) {
        const acc = cp === 0 ? s.accuracy : "fast";
        const aset = analysisSettings(acc);
        const stage = `checkpoint ${cp + 1}/${checkpoints}`;

        // 1. Where to fight now.
        const zoneResults = await analyzeZones(pool, profile, { ...aset, zones: zonesToTry(lastZones) }, progress(stage + ": zones"));
        let { best, ranked } = rankZones(zoneResults, aset);
        lastZones = ranked;
        if (!best) throw new Error("No combat zone to simulate.");

        // 2. Every upgrade, one at a time, in that zone, within what coins could reach.
        const remaining = totalBlocks - block;
        const n = Math.min(segment, remaining);
        const reach = Math.max(0, coins - s.reserve) + skillingGold(input.skilling, block, remaining) / 2;
        const raw = await analyzeUpgrades(pool, profile, best.zone, { ...aset, budget: reach, noTriggers: true, keep: keepNow }, progress(stage + ": upgrades"), progress(stage + ": upgrades"));
        const rated = rateUpgrades(raw, aset);
        const baseValue = xpValue(raw.base, aset);
        for (const c of raw.candidates) {
            seen.add(candidateKey(c));
            if (c.result && xpValue(c.result, aset) > baseValue) useful.add(candidateKey(c));
        }
        const rateNow = xpValue(rated.base, aset) * 24; // levels a day
        // What fighting costs (drinks and food less loot) until the next checkpoint is kept back too.
        const upkeep = (blocks) => Math.max(0, -(rated.base.profit || 0)) * blocks * BLOCK_HOURS;
        const earns = skillingGold(input.skilling, block, remaining) > 0;

        // 3. How many blocks of skilling first: the levels by the end for each choice.
        const minSkilling = earns && coins < s.reserve ? blocksFor(input.skilling, block, s.reserve - coins, remaining) : 0;
        let choice = null;
        for (let k = minSkilling; k <= remaining; k += k < segment ? 1 : segment) {
            const avail = Math.max(0, coins - s.reserve + skillingGold(input.skilling, block, k) - upkeep(Math.max(0, n - k)));
            const plan = buildPlan(rated, avail, "all");
            const rate = rateNow * (1 + planGain(plan));
            const value = (rate * (remaining - k)) / BLOCKS_A_DAY + s.levelDays * rate;
            if (!choice || value > choice.value + 1e-9) choice = { k, value, plan };
            if (k >= remaining) break;
        }
        const k = Math.min(choice.k, n);
        if (k > 0) {
            const gold = skillingGold(input.skilling, block, k);
            const job = skillingAt(input.skilling, block / BLOCKS_A_DAY);
            coins += gold;
            stats.skillingBlocks += k;
            stats.skillingGold += gold;
            phases.push({ kind: "skilling", from: block / BLOCKS_A_DAY, to: (block + k) / BLOCKS_A_DAY, blocks: k, job: job.name, skill: job.skill, gold: Math.round(gold), coins: Math.round(coins), why: choice.k > n ? "saving up" : "for the purchases" });
            block += k;
        }
        if (choice.k >= n && k === n) {
            onStage(stage);
            continue; // still saving up: look again at the next checkpoint
        }

        // 4. Buy what the coins reach now, put it on, look at the zones again.
        const plan = buildPlan(rated, Math.max(0, coins - s.reserve - upkeep(n - k)), "all");
        const buys = plan.picks.filter((p) => p.cost > 0 || !p.owned).map(purchaseOf);
        const changes = [];
        if (plan.picks.length || plan.order || plan.drink || plan.food || plan.triggers?.length) {
            profile = putOn(profile, plan);
            coins -= plan.spent;
            stats.spent += plan.spent;
            for (const p of plan.picks.filter((x) => x.owned && !(x.cost > 0))) changes.push(purchaseOf(p));
            for (const c of [plan.drink, plan.food]) if (c) changes.push({ kind: c.kind, slot: c.slot, hrid: c.remove ? null : c.hrid, replaces: c.replaces || (c.remove ? c.hrid : null) });
            if (plan.order) changes.push({ kind: "order", order: plan.order.order });
        }
        // The first fight gets its triggers and order tuned for the loadout it will have.
        let triggerChanges = [];
        if (!tuned) {
            const free = await analyzeUpgrades(pool, profile, best.zone, { ...aset, scope: "abilities", budget: 0 }, progress(stage + ": triggers"), progress(stage + ": triggers"));
            const freePlan = buildPlan(rateUpgrades(free, aset), 0, "all");
            const apply = freeChanges(freePlan);
            if (apply.picks.length || apply.order || apply.triggers?.length) profile = putOn(profile, apply);
            // A book just bought whose ability the round swapped out for one you know isn't bought after all.
            for (const p of apply.picks) {
                const i = buys.findIndex((b) => b.kind === "ability" && b.hrid === p.replaces);
                if (i < 0) continue;
                coins += buys[i].cost;
                stats.spent -= buys[i].cost;
                buys.splice(i, 1);
            }
            triggerChanges = (apply.triggers || []).map((t) => ({ hrid: t.hrid, target: t.target, triggers: t.triggers, was: t.was, why: t.why }));
            if (apply.order) changes.push({ kind: "order", order: apply.order.order });
            for (const p of apply.picks) changes.push(purchaseOf(p));
            tuned = true;
        }
        const again = await analyzeZones(pool, profile, { ...aset, zones: zonesToTry(ranked) }, progress(stage + ": zones"));
        ({ best, ranked } = rankZones(again, aset));
        lastZones = ranked;
        const [measured] = await simulateVariants(pool, [{ profile }], best.zone, aset, progress(stage + ": measuring"));
        const r = measured.result;

        // What the fight measured costs may not fit above the reserve (a dearer zone, new drinks):
        // skilling first for the rest.
        let fight = n - k;
        const short = s.reserve - (coins + Math.min(0, r.profit) * fight * BLOCK_HOURS);
        if (short > 0 && earns && fight > 1) {
            const extra = Math.min(fight - 1, blocksFor(input.skilling, block, short, fight - 1));
            const gold = skillingGold(input.skilling, block, extra);
            coins += gold;
            stats.skillingBlocks += extra;
            stats.skillingGold += gold;
            const job = skillingAt(input.skilling, block / BLOCKS_A_DAY);
            phases.push({ kind: "skilling", from: block / BLOCKS_A_DAY, to: (block + extra) / BLOCKS_A_DAY, blocks: extra, job: job.name, skill: job.skill, gold: Math.round(gold), coins: Math.round(coins), why: "for the fight's drinks and food" });
            block += extra;
            fight -= extra;
        }

        // 5. Fight to the next checkpoint at that rate.
        const hours = fight * BLOCK_HOURS;
        const levelsBefore = levelsOf(profile, skills, table);
        addExperience(profile, r.xp, hours, table);
        coins += r.profit * hours;
        stats.combatBlocks += fight;
        stats.combatProfit += r.profit * hours;
        lastRate = { levelsPerDay: xpValue(r, aset) * 24, xpPerHour: r.xp };
        const levelsAfter = levelsOf(profile, skills, table);
        phases.push({
            kind: "combat",
            from: block / BLOCKS_A_DAY,
            to: (block + fight) / BLOCKS_A_DAY,
            blocks: fight,
            zone: best.zone,
            loadout: slim(profile),
            buys,
            changes,
            triggers: triggerChanges,
            rates: {
                xpPerHour: r.xp,
                levelsPerDay: lastRate.levelsPerDay,
                profitPerHour: Math.round(r.profit),
                lootPerHour: Math.round(r.loot),
                costPerHour: Math.round(r.cost),
                deathsPerHour: r.deaths,
                consumablesPerHour: r.consumables,
                encountersPerHour: r.encounters,
            },
            gained: Object.fromEntries(skills.map((x) => [x, levelsAfter[x] - levelsBefore[x]])),
            levels: Object.fromEntries(Object.entries(levelsAfter).map(([x, v]) => [x, Math.floor(v)])),
            coins: Math.round(coins),
        });
        block += fight;
        onStage(stage);
    }

    const end = levelsOf(profile, skills, table);
    const start = levelsOf(startProfile, skills, table);
    const endRate = lastRate?.levelsPerDay || 0;
    const result = {
        settings: s,
        setup: { id: setup.id, name: setup.name },
        skills,
        starter: styled.starter ? purchaseOf({ kind: "gear", ...styled.starter, owned: styled.starter.owned }) : null,
        start: { levels: start, coins: Math.round(Number(input.coins) || 0) },
        end: { levels: end, coins: Math.round(coins), levelsPerDay: endRate },
        gained: sum(end) - sum(start),
        score: sum(end) + s.levelDays * endRate,
        phases: mergePhases(phases),
        stats: { ...stats, spent: Math.round(stats.spent), skillingGold: Math.round(stats.skillingGold), combatProfit: Math.round(stats.combatProfit) },
        // What skilling would have earned in the combat blocks (the 📈 plan's jobs).
        skillingForgone: Math.round(forgone(input.skilling, phases)),
    };
    result.baseline = await baseline(pool, startProfile, s, skills, table, analysisSettings, progress("as you are"));
    return result;
}

function blocksFor(skilling, fromBlock, need, max) {
    let got = 0;
    for (let k = 1; k <= max; k++) {
        got += skillingAt(skilling, (fromBlock + k - 1) / BLOCKS_A_DAY).gold;
        if (got >= need) return k;
    }
    return max;
}

function forgone(skilling, phases) {
    let total = 0;
    for (const p of phases) if (p.kind === "combat") total += skillingGold(skilling, Math.round(p.from * BLOCKS_A_DAY), p.blocks);
    return total;
}

// Phases in a row that are the same (skilling, or the same zone in the same loadout with
// nothing bought) are shown as one.
function mergePhases(phases) {
    const out = [];
    for (const p of phases) {
        const last = out[out.length - 1];
        const same =
            last &&
            last.kind === p.kind &&
            (p.kind === "skilling"
                ? last.job === p.job
                : zoneKey(last.zone) === zoneKey(p.zone) && !p.buys.length && !p.changes.length && !p.triggers.length && JSON.stringify(last.loadout) === JSON.stringify(p.loadout));
        if (!same) {
            out.push({ ...p });
            continue;
        }
        last.to = p.to;
        last.blocks += p.blocks;
        last.coins = p.coins;
        if (p.kind === "skilling") last.gold += p.gold;
        else {
            for (const [x, v] of Object.entries(p.gained)) last.gained[x] = (last.gained[x] || 0) + v;
            last.levels = p.levels;
            last.rates = p.rates;
        }
    }
    return out;
}

// Fighting as you are: no purchases, the best zone at each checkpoint, combat only.
async function baseline(pool, startProfile, s, skills, table, analysisSettings, onProgress) {
    const profile = cloneProfile(startProfile);
    const totalBlocks = s.days * BLOCKS_A_DAY;
    const segment = Math.max(BLOCKS_A_DAY, Math.ceil(totalBlocks / CHECKPOINTS));
    const aset = analysisSettings("fast");
    let last = null;
    let rate = 0;
    let profit = 0;
    for (let block = 0; block < totalBlocks; block += segment) {
        const n = Math.min(segment, totalBlocks - block);
        const results = await analyzeZones(pool, profile, { ...aset, zones: zonesToTry(last) }, onProgress);
        const { best, ranked } = rankZones(results, aset);
        last = ranked;
        const r = best.result;
        addExperience(profile, r.xp, n * BLOCK_HOURS, table);
        profit += r.profit * n * BLOCK_HOURS;
        rate = xpValue(r, aset) * 24;
    }
    const start = levelsOf(startProfile, skills, table);
    const end = levelsOf(profile, skills, table);
    return { levels: end, gained: sum(end) - sum(start), levelsPerDay: rate, score: sum(end) + s.levelDays * rate, combatProfit: Math.round(profit) };
}
