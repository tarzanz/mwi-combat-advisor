// The actual advice: which zone to fight in and which purchases help most.

import { askPrice, combatZones, expectedLootPerKill, getClientData, marketListings, sellValue } from "./game-data.js";
import { confidenceGreater } from "./stats.js";
import { GEAR_TYPES, cloneProfile, equip, meetsRequirements, slotCounts, toDTO } from "./profile.js";

// Many short runs (each with its own random seed) rather than a few long ones: the
// same total time, but the spread between runs tells how sure a result is.
export const ACCURACY = {
    fast: { label: "Fast", hours: 1, seeds: 3 },
    normal: { label: "Normal", hours: 2, seeds: 4 },
    thorough: { label: "Thorough", hours: 4, seeds: 6 },
};

// A suggestion goes on the shopping list only if we are this sure it is an improvement.
export const CONFIDENCE_LEVEL = 0.9;
// Uncertain suggestions get extra runs, up to this many times the normal number of seeds.
const MAX_SEED_FACTOR = 3;
// Every suggestion is compared with the current setup, so that one gets extra runs up front.
const BASE_SEED_FACTOR = 3;
const MAX_REFINED = 40;
// With many suggestions tested at once, some useless ones pass 90% by luck. Everything
// promising below 99% gets fresh runs, so lucky ones fall back before they are trusted.
const REFINE_BELOW = 0.99;

const seedFor = (index) => (Math.imul(index + 1, 2654435761) >>> 1) || 1;

// How much a purchase must give back: % more XP/h per 1M coins spent.
export const SPENDING = {
    frugal: { label: "Frugal", minPctPerMillion: 10 },
    balanced: { label: "Balanced", minPctPerMillion: 3 },
    all: { label: "All in", minPctPerMillion: 0 },
};

// Stats that only help melee or ranged fighters.
const NON_MAGIC_STATS = new Set([
    "stabAccuracy",
    "slashAccuracy",
    "smashAccuracy",
    "rangedAccuracy",
    "stabDamage",
    "slashDamage",
    "smashDamage",
    "rangedDamage",
    "meleeExperience",
    "rangedExperience",
    "defensiveDamage",
    "physicalAmplify",
    "armorPenetration",
]);

// ---------- the goal: a mix of XP and gold ----------
//
// XP/h and profit/h (loot minus food/drink cost) are both measured against a
// reference – the current setup, or the best zone – so 0.01 always means "1% of
// the reference". goldWeight 0 = only XP counts, 1 = only profit counts.
// Running costs are inside profit, so expensive drinks lose value as gold
// weight goes up without any special handling.

const MIN_GOLD_REF = 1000; // coins/h; keeps tiny loot values from blowing up the scale

export function xpValue(result, objective) {
    return objective === "magic" ? result.xp.magic || 0 : result.xpTotal;
}

export function makeGoal(settings, reference) {
    return {
        objective: settings.objective,
        gold: Math.min(1, Math.max(0, Number(settings.goldWeight) || 0)),
        xpRef: Math.max(1, reference.xp),
        goldRef: Math.max(MIN_GOLD_REF, reference.gold),
    };
}

export function score(result, goal) {
    return ((1 - goal.gold) * xpValue(result, goal.objective)) / goal.xpRef + (goal.gold * result.profit) / goal.goldRef;
}

// Deaths per hour you accept. A death costs 150 s of waiting, which is already part
// of XP/h, so a rare death can be worth it in a zone that gives more per kill.
export const RARE_DEATHS_PER_HOUR = 0.5;

export function deathLimit(settings) {
    return settings.acceptRareDeaths ? RARE_DEATHS_PER_HOUR : 0;
}

const acceptable = (result, settings) => result.deaths <= deathLimit(settings);

// Zones are compared against the best acceptable zone on each axis.
export function zoneGoal(zoneResults, settings) {
    const safe = zoneResults.filter((z) => acceptable(z.result, settings));
    const pool = safe.length ? safe : zoneResults;
    return makeGoal(settings, {
        xp: Math.max(...pool.map((z) => xpValue(z.result, settings.objective))),
        gold: Math.max(...pool.map((z) => z.result.loot)),
    });
}

function consumableCost(result) {
    let cost = 0;
    for (const [hrid, perHour] of Object.entries(result.consumables)) cost += perHour * (askPrice(hrid) ?? sellValue(hrid));
    return cost;
}

function lootValue(result, tier) {
    let value = 0;
    for (const [monster, perHour] of Object.entries(result.kills)) value += perHour * expectedLootPerKill(monster, tier, result);
    return value;
}

function average(results) {
    const n = results.length;
    const mean = (pick) => results.reduce((sum, r) => sum + pick(r), 0) / n;
    const meanMap = (pick) => {
        const out = {};
        for (const r of results) for (const [k, v] of Object.entries(pick(r))) out[k] = (out[k] || 0) + v / n;
        return out;
    };
    return {
        ...results[0],
        xp: meanMap((r) => r.xp),
        xpTotal: mean((r) => r.xpTotal),
        deaths: mean((r) => r.deaths),
        encounters: mean((r) => r.encounters),
        kills: meanMap((r) => r.kills),
        consumables: meanMap((r) => r.consumables),
        manaUsed: meanMap((r) => r.manaUsed),
    };
}

// The engine spawns the next encounter 3 s after the last one dies, so no setup can
// have more than 1200 encounters per hour. Close to that, you kill faster than
// monsters appear and more damage barely helps – a harder zone or tier does.
const ENEMY_RESPAWN_SECONDS = 3;
export const MAX_ENCOUNTERS_PER_HOUR = 3600 / ENEMY_RESPAWN_SECONDS;

export function isSpawnCapped(result) {
    return result.encounters >= 0.85 * MAX_ENCOUNTERS_PER_HOUR;
}

function enrich(result, tier) {
    const loot = lootValue(result, tier);
    const cost = consumableCost(result);
    return { ...result, loot, cost, profit: loot - cost, killsTotal: Object.values(result.kills).reduce((a, b) => a + b, 0) };
}

// Simulates each { profile, seeds } item; every run is tagged with its seed index.
// Runs of different setups are compared as independent samples: the random streams
// part ways within a few attacks, so pairing by seed would only share one run's luck
// (say, a rare death in the base) with every suggestion.
async function simulateRuns(pool, items, zone, hours, onProgress) {
    const data = getClientData();
    const jobs = [];
    for (const item of items) {
        const player = toDTO(item.profile, data);
        for (const seed of item.seeds) {
            jobs.push({ player, zoneHrid: zone.zoneHrid, tier: zone.tier, hours, seed: seedFor(seed), extraBuffs: item.profile.extraBuffs });
        }
    }
    const results = await pool.runAll(jobs, onProgress);
    let next = 0;
    return items.map((item) => item.seeds.map((seed) => ({ ...enrich(results[next++], zone.tier), seed })));
}

const summarize = (runs, tier) => enrich(average(runs), tier);

async function simulateVariants(pool, variants, zone, settings, onProgress) {
    const seeds = Array.from({ length: settings.seeds }, (_, i) => i);
    const runs = await simulateRuns(pool, variants.map((v) => ({ profile: v.profile, seeds })), zone, settings.hours, onProgress);
    return variants.map((variant, i) => ({ ...variant, result: summarize(runs[i], zone.tier), runs: runs[i] }));
}

export async function analyzeZones(pool, profile, settings, onProgress) {
    const variants = [];
    for (const zone of combatZones()) {
        for (let tier = 0; tier <= Math.min(settings.maxTier, zone.maxDifficulty ?? 0); tier++) {
            variants.push({ zone: { zoneHrid: zone.hrid, tier } });
        }
    }
    const data = getClientData();
    const player = toDTO(profile, data);
    const hours = Math.max(1, settings.hours / 2);
    const jobs = variants.map((v) => ({ player, zoneHrid: v.zone.zoneHrid, tier: v.zone.tier, hours, seed: seedFor(0), extraBuffs: profile.extraBuffs }));
    const results = await pool.runAll(jobs, onProgress);
    return variants.map((v, i) => ({ ...v, result: enrich(results[i], v.zone.tier) }));
}

export function pickBestZone(zoneResults, settings) {
    if (!zoneResults?.length) return null;
    const goal = zoneGoal(zoneResults, settings);
    const sorted = [...zoneResults].sort((a, b) => score(b.result, goal) - score(a.result, goal));
    return sorted.find((z) => acceptable(z.result, settings)) || sorted[0];
}

// ---------- candidates ----------

function isUsefulForMage(stats) {
    return Object.entries(stats || {}).some(([key, value]) => typeof value === "number" && value > 0 && !NON_MAGIC_STATS.has(key) && key !== "attackInterval");
}

function gearCandidates(profile, budget) {
    const data = getClientData();
    const candidates = [];
    for (const item of Object.values(data.itemDetailMap)) {
        const detail = item.equipmentDetail;
        if (!detail) continue;
        const type = detail.type?.split("/").pop();
        if (!GEAR_TYPES.includes(type)) continue;
        if (!meetsRequirements(profile, detail.levelRequirements)) continue;
        const stats = detail.combatStats || {};
        if (type === "main_hand" || type === "two_hand") {
            if (!(stats.combatStyleHrids || []).includes("/combat_styles/magic")) continue;
        } else if (!isUsefulForMage(stats)) {
            continue;
        }
        if (type === "off_hand" && profile.equipment.two_hand) continue;

        const current = profile.equipment[type];
        let options = gearOptions(profile, item.hrid, budget);
        if (type === "pouch") options = options.slice(0, 1); // enhancing a pouch adds little; keep the sim count down
        for (const option of options) {
            if (current && current.hrid === item.hrid && current.enhancementLevel >= option.enhancementLevel) continue;
            const gear = { hrid: item.hrid, enhancementLevel: option.enhancementLevel };
            const variant = cloneProfile(profile);
            equip(variant, type, gear);
            // A pouch with fewer slots would only "help" by dropping a consumable you use;
            // that is offered honestly as "stop using X" instead.
            if (type === "pouch") {
                const before = slotCounts(profile, data);
                const after = slotCounts(variant, data);
                if (after.food < before.food || after.drinks < before.drinks) continue;
            }
            const candidate = {
                kind: "gear",
                slot: type,
                hrid: item.hrid,
                enhancementLevel: option.enhancementLevel,
                cost: option.cost,
                owned: option.owned,
                replaces: current || null,
                profile: variant,
            };
            candidates.push(candidate);

            // A bigger pouch is only useful with something in the new food slot, so try each food there.
            const foodSlotsNow = slotCounts(profile, data).food;
            if (type === "pouch" && slotCounts(variant, data).food > foodSlotsNow) {
                for (const food of combatConsumables("food")) {
                    if (profile.food.includes(food)) continue;
                    const withFood = cloneProfile(variant);
                    while (withFood.food.length <= foodSlotsNow) withFood.food.push(null);
                    withFood.food[foodSlotsNow] = food;
                    candidates.push({ ...candidate, extraFood: food, extraFoodSlot: foodSlotsNow, profile: withFood });
                }
            }
        }
    }
    return candidates;
}

// The copies of an item worth testing: the best one you own (free) and the
// market listings where a higher enhancement level also costs more (a +5 that
// is cheaper than a +3 makes the +3 pointless). At most MAX_LEVELS listings.
const MAX_LEVELS = 5;

function gearOptions(profile, hrid, budget) {
    const owned = profile.inventory.filter((i) => i.hrid === hrid).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
    const options = owned ? [{ enhancementLevel: owned.enhancementLevel, cost: 0, owned: true }] : [];
    const front = [];
    for (const listing of marketListings(hrid)) {
        if (listing.price > budget || (owned && listing.enhancementLevel <= owned.enhancementLevel)) continue;
        if (front.length && listing.enhancementLevel <= front[front.length - 1].enhancementLevel) continue;
        front.push(listing);
    }
    let picked = front;
    if (front.length > MAX_LEVELS) {
        const step = (front.length - 1) / (MAX_LEVELS - 1);
        picked = Array.from({ length: MAX_LEVELS }, (_, i) => front[Math.round(i * step)]);
    }
    for (const listing of picked) options.push({ enhancementLevel: listing.enhancementLevel, cost: listing.price, owned: false });
    return options;
}

function combatConsumables(kind) {
    const category = kind === "food" ? "/item_categories/food" : "/item_categories/drink";
    return Object.values(getClientData().itemDetailMap)
        .filter((item) => item.categoryHrid === category && item.consumableDetail?.usableInActionTypeMap?.["/action_types/combat"])
        .filter((item) => askPrice(item.hrid, 0) !== null)
        .map((item) => item.hrid);
}

function abilityCandidates(profile, budget) {
    const data = getClientData();
    const slots = slotCounts(profile, data);
    if (slots.abilities === 0) return [];
    const books = {};
    for (const item of Object.values(data.itemDetailMap)) {
        if (item.abilityBookDetail) books[item.abilityBookDetail.abilityHrid] = item;
    }
    const equipped = new Set(profile.abilities.filter(Boolean).map((a) => a.hrid));
    const indices = [];
    for (let i = 1; i <= slots.abilities; i++) indices.push(i);
    const empty = indices.filter((i) => !profile.abilities[i]);
    const placements = empty.length ? [empty[0]] : indices;

    const candidates = [];
    for (const ability of Object.values(data.abilityDetailMap)) {
        if (ability.isSpecialAbility || equipped.has(ability.hrid)) continue;
        let level = profile.learnedAbilities[ability.hrid];
        let cost = 0;
        const book = books[ability.hrid];
        if (!level) {
            if (!book || !meetsRequirements(profile, book.abilityBookDetail.levelRequirements)) continue;
            const price = askPrice(book.hrid, 0);
            if (price === null || price > budget) continue;
            level = 1;
            cost = price;
        }
        for (const index of placements) {
            const variant = cloneProfile(profile);
            variant.abilities[index] = { hrid: ability.hrid, level };
            candidates.push({
                kind: "ability",
                slot: "ability" + index,
                hrid: ability.hrid,
                bookHrid: book?.hrid,
                level,
                cost,
                owned: cost === 0,
                replaces: profile.abilities[index]?.hrid || null,
                profile: variant,
            });
        }
    }
    return [...candidates, ...abilityLevelCandidates(profile, budget, books)];
}

// Reading more copies of an ability's book levels it up. Books needed come from
// the game's level table and the XP each book gives.
const LEVEL_STEPS = [1, 2, 3, 5, 10, 20];

function abilityLevelCandidates(profile, budget, books) {
    const data = getClientData();
    const table = data.levelExperienceTable;
    if (!table) return [];
    const slots = slotCounts(profile, data);
    const candidates = [];
    profile.abilities.forEach((entry, index) => {
        if (!entry || (index === 0 ? !slots.special : index > slots.abilities)) return;
        const book = books[entry.hrid];
        const xpPerBook = book?.abilityBookDetail?.experienceGain;
        const price = book && askPrice(book.hrid, 0);
        if (!xpPerBook || !price) return;
        const xpNow = profile.abilityExperience[entry.hrid] ?? table[entry.level] ?? 0;
        for (const step of LEVEL_STEPS) {
            const target = entry.level + step;
            if (table[target] === undefined) break;
            const count = Math.max(1, Math.ceil((table[target] - xpNow) / xpPerBook));
            if (count * price > budget) break;
            const variant = cloneProfile(profile);
            variant.abilities[index] = { hrid: entry.hrid, level: target };
            candidates.push({
                kind: "abilityLevel",
                slot: "ability" + index,
                hrid: entry.hrid,
                bookHrid: book.hrid,
                fromLevel: entry.level,
                level: target,
                books: count,
                cost: count * price,
                owned: false,
                replaces: null,
                profile: variant,
            });
        }
    });
    return candidates;
}

function consumableCandidates(profile, kind) {
    const data = getClientData();
    const slots = slotCounts(profile, data);
    const count = kind === "food" ? slots.food : slots.drinks;
    const current = (kind === "food" ? profile.food : profile.drinks).slice(0, count);
    while (current.length < count) current.push(null);
    const empty = current.findIndex((h) => !h);
    const placements = empty !== -1 ? [empty] : current.map((_, i) => i);

    const candidates = [];
    for (const hrid of combatConsumables(kind)) {
        if (current.includes(hrid)) continue;
        for (const index of placements) {
            const variant = cloneProfile(profile);
            const list = kind === "food" ? variant.food : variant.drinks;
            while (list.length < count) list.push(null);
            list[index] = hrid;
            candidates.push({ kind, slot: kind + index, hrid, cost: 0, replaces: current[index] || null, profile: variant });
        }
    }
    // Stopping a consumable saves its cost; worth it when the focus leans towards gold.
    current.forEach((hrid, index) => {
        if (!hrid) return;
        const variant = cloneProfile(profile);
        (kind === "food" ? variant.food : variant.drinks)[index] = null;
        candidates.push({ kind, remove: true, slot: kind + index, hrid, cost: 0, replaces: hrid, profile: variant });
    });
    return candidates;
}

// Keeps one row per item/ability: its best placement, and for a pouch the food
// for the new slot that gives (nearly) the most XP for the least running cost.
function bestPerItem(evaluated) {
    const groups = new Map();
    for (const c of evaluated) {
        const key = [c.kind, c.hrid, c.enhancementLevel ?? "", c.kind === "abilityLevel" ? c.level : "", c.remove ? "remove" : ""].join("|");
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    }
    return [...groups.values()].map((options) => {
        const pool = options.some((c) => c.safe) ? options.filter((c) => c.safe) : options;
        const top = pool.reduce((a, b) => (b.delta > a.delta ? b : a));
        if (!top.extraFood || top.delta <= 0) return top;
        return pool.filter((c) => c.delta >= 0.85 * top.delta).sort((a, b) => a.costPerHourDelta - b.costPerHourDelta)[0];
    });
}

export async function analyzeUpgrades(pool, profile, zone, settings, onProgress, onRefineProgress) {
    const budget = settings.budget;
    const candidates = [
        ...gearCandidates(profile, budget),
        ...abilityCandidates(profile, budget),
        ...consumableCandidates(profile, "drinks"),
        ...consumableCandidates(profile, "food"),
    ].map((c, id) => ({ ...c, id }));
    const seeds = (n) => Array.from({ length: n }, (_, i) => i);
    const items = [{ profile, seeds: seeds(settings.seeds * BASE_SEED_FACTOR) }, ...candidates.map((c) => ({ profile: c.profile, seeds: seeds(settings.seeds) }))];
    const runs = await simulateRuns(pool, items, zone, settings.hours, onProgress);
    const simulated = [{ profile }, ...candidates].map((v, i) => ({ ...v, result: summarize(runs[i], zone.tier), runs: runs[i] }));
    const slots = slotCounts(profile, getClientData());
    const emptyAbilitySlots = [];
    for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilitySlots.push(i);
    const raw = {
        zone,
        hours: settings.hours,
        seedsPerRound: settings.seeds,
        emptyAbilitySlots,
        baseProfile: profile,
        base: simulated[0].result,
        baseRuns: simulated[0].runs,
        candidates: simulated.slice(1),
    };
    // Two automatic rounds of extra runs for promising but uncertain suggestions.
    for (let round = 0; round < 2; round++) {
        if (!(await refineUncertain(pool, raw, settings, onRefineProgress))) break;
    }
    return raw;
}

// Suggestions worth more runs: they look like an improvement, but are not beyond doubt.
export function uncertainCandidates(raw, settings) {
    const rated = rateUpgrades(raw, settings);
    const maxRuns = raw.seedsPerRound * MAX_SEED_FACTOR;
    return [...rated.gear, ...rated.abilities, ...rated.drinks, ...rated.food]
        .filter((c) => c.delta > 0 && c.safe && c.confidence < REFINE_BELOW && c.runs.length < maxRuns)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, MAX_REFINED);
}

// Gives uncertain suggestions another round of seeds. Returns how many were refined.
export async function refineUncertain(pool, raw, settings, onProgress) {
    const targets = uncertainCandidates(raw, settings).map((c) => raw.candidates.find((x) => x.id === c.id));
    if (!targets.length) return 0;
    const items = targets.map((c) => {
        const first = Math.max(...c.runs.map((r) => r.seed)) + 1;
        return { profile: c.profile, seeds: Array.from({ length: raw.seedsPerRound }, (_, i) => first + i) };
    });
    const runs = await simulateRuns(pool, items, raw.zone, raw.hours, onProgress);
    targets.forEach((c, i) => {
        c.runs = [...c.runs, ...runs[i]];
        c.result = summarize(c.runs, raw.zone.tier);
    });
    return targets.length;
}

// Scores simulated upgrades for a goal. Cheap, so the XP/gold slider can re-rate
// an analysis instantly without simulating again.
export function rateUpgrades(raw, settings) {
    const { base } = raw;
    const goal = makeGoal(settings, { xp: xpValue(base, settings.objective), gold: base.loot });
    const baseScore = score(base, goal);
    const baseScores = raw.baseRuns.map((r) => score(r, goal));

    // A drink or food that never triggers (e.g. a second coffee of a kind whose buff is
    // already running) would only be bought to sit unused; stopping the old one is the honest option.
    const used = (c) => c.remove || !["food", "drinks"].includes(c.kind) || (c.result.consumables[c.hrid] || 0) > 0.01;
    const evaluated = raw.candidates.filter(used).map((c) => {
                const delta = score(c.result, goal) - baseScore;
        const confidence = confidenceGreater(c.runs.map((r) => score(r, goal)), baseScores) ?? 0.5;
        return {
            ...c,
            delta,
            deltaPct: delta, // scores are already fractions of the reference
            confidence,
            significant: confidence >= CONFIDENCE_LEVEL,
            xpDelta: xpValue(c.result, settings.objective) - xpValue(base, settings.objective),
            profitDelta: c.result.profit - base.profit,
            // A change that makes you die noticeably more often is never recommended, whatever the
            // gain – unless you accept rare deaths and it stays within that limit.
            safe: c.result.deaths <= Math.max(base.deaths * 1.1 + 0.3, deathLimit(settings)),
            costPerHourDelta: c.result.cost - base.cost,
            deathsDelta: c.result.deaths - base.deaths,
        };
    });
    const best = bestPerItem(evaluated);
    const byDelta = (a, b) => b.delta - a.delta;
    return {
        ...raw,
        goal,
        baseScore,
        gear: best.filter((c) => c.kind === "gear").sort(byDelta),
        abilities: best.filter((c) => c.kind === "ability" || c.kind === "abilityLevel").sort(byDelta),
        drinks: best.filter((c) => c.kind === "drinks").sort(byDelta),
        food: best.filter((c) => c.kind === "food").sort(byDelta),
    };
}

// Confidence that "to" beats "from" (null = the current setup).
function stepConfidence(analysis, from, to) {
    if (!from) return to.confidence;
    const scores = (c) => c.runs.map((r) => score(r, analysis.goal));
    return confidenceGreater(scores(to), scores(from)) ?? 0.5;
}

// Upper concave hull of (cost, gain) for one slot: the sequence of ever more
// expensive options where each step still pays for itself.
function hullSteps(group, options, minGain, minEfficiency, confident) {
    const points = [{ cost: 0, delta: 0, candidate: null }, ...options.map((c) => ({ cost: c.cost, delta: c.delta, candidate: c }))].sort(
        (a, b) => a.cost - b.cost || b.delta - a.delta
    );
    const rising = [];
    for (const p of points) {
        const last = rising[rising.length - 1];
        if (last && (p.cost === last.cost || p.delta <= last.delta)) continue;
        rising.push(p);
    }
    const slope = (a, b) => (b.delta - a.delta) / (b.cost - a.cost);
    const hull = [];
    for (const p of rising) {
        while (hull.length >= 2 && slope(hull[hull.length - 2], hull[hull.length - 1]) <= slope(hull[hull.length - 1], p)) hull.pop();
        hull.push(p);
    }
    const steps = [];
    if (hull[0].candidate) steps.push({ group, to: hull[0].candidate, cost: 0, gain: hull[0].delta, efficiency: Infinity });
    let from = hull[0];
    let firstPaidEfficiency = null;
    for (let i = 1; i < hull.length; i++) {
        const to = hull[i];
        const gain = to.delta - from.delta;
        // Too small on its own (e.g. +1 ability level): combine it with the next, pricier option
        // instead of giving up on the slot.
        // Also when we can't yet be sure it beats the cheaper option.
        if (gain < (firstPaidEfficiency === null ? minGain : 2 * minGain) || !confident(from.candidate, to.candidate)) continue;
        const efficiency = gain / (to.cost - from.cost);
        if (efficiency < minEfficiency) break;
        // Diminishing returns: a pricier version (e.g. a +7 instead of a +0) must still give at
        // least a quarter of the XP per coin of the first purchase.
        if (firstPaidEfficiency === null) firstPaidEfficiency = efficiency;
        else if (efficiency < firstPaidEfficiency / 4) break;
        steps.push({ group, to: to.candidate, cost: to.cost - from.cost, gain, efficiency });
        from = to;
    }
    return steps;
}

// Which food/drink change to recommend. With any gold weight the running cost is
// already in the gain, so the biggest gain wins. With a pure XP focus cost is not
// in the gain, so among options giving at least half the best gain the cheapest
// one wins. Ties go to simply stopping a consumable (nothing to buy).
function pickConsumable(list, gold) {
    const ok = list.filter((c) => c.significant && c.safe && c.delta > 0);
    if (!ok.length) return { value: null, max: null };
    const max = ok.reduce((a, b) => (b.delta > a.delta + 1e-9 || (Math.abs(b.delta - a.delta) <= 1e-9 && b.remove) ? b : a));
    const preferStopping = (a, b) => (b.remove ? 1 : 0) - (a.remove ? 1 : 0);
    const value =
        gold > 0
            ? max
            : ok.filter((c) => c.delta >= 0.5 * max.delta).sort((a, b) => a.costPerHourDelta - b.costPerHourDelta || preferStopping(a, b))[0];
    // Replacing X with something that changes nothing measurable is really "stop using X":
    // prefer that when it is within noise of the pick for the same slot – nothing to buy.
    const stop = ok.find((c) => c.remove && c.slot === value.slot && c !== value && c.delta >= value.delta - STOP_TOLERANCE);
    const chosen = stop || value;
    return { value: chosen, max: max === chosen ? null : max };
}

const STOP_TOLERANCE = 0.005; // half a percent of the reference

// Shopping list within the budget, treating it as a multiple-choice knapsack:
// every slot can move up its hull one step at a time, best XP-per-coin step first.
export function buildPlan(analysis, budget, spending = "balanced") {
    const minGain = 0.01;
    const minEfficiency = (SPENDING[spending] || SPENDING.balanced).minPctPerMillion / 100 / 1e6;
    const usable = (c) => c.significant && c.safe && c.delta > 0;
    const groups = new Map();
    for (const c of analysis.gear.filter(usable)) {
        const key = c.slot === "main_hand" || c.slot === "two_hand" ? "weapon" : c.slot;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    }
    for (const c of analysis.abilities.filter(usable)) {
        // Levelling up or replacing the ability in a slot are alternatives for that slot.
        const key = c.kind === "abilityLevel" || c.replaces ? c.slot : "new-ability:" + c.hrid;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(c);
    }
    const confident = (from, to) => stepConfidence(analysis, from, to) >= CONFIDENCE_LEVEL;
    const steps = [...groups.entries()].flatMap(([key, options]) => hullSteps(key, options, minGain, minEfficiency, confident));
    steps.sort((a, b) => b.efficiency - a.efficiency || b.gain - a.gain);

    const chosen = new Map();
    const blocked = new Set();
    const freeAbilitySlots = [...analysis.emptyAbilitySlots];
    const usedAbilities = new Set();
    let spent = 0;
    for (const step of steps) {
        if (blocked.has(step.group)) continue;
        const isNewAbility = step.group.startsWith("new-ability:");
        if (spent + step.cost > budget || (isNewAbility && !freeAbilitySlots.length) || usedAbilities.has(step.to.hrid)) {
            blocked.add(step.group); // later steps in this slot build on this one
            continue;
        }
        spent += step.cost;
        if (isNewAbility) {
            chosen.set(step.group, { ...step.to, slot: "ability" + freeAbilitySlots.shift() });
        } else {
            chosen.set(step.group, step.to);
        }
        if (step.to.kind === "ability") usedAbilities.add(step.to.hrid);
    }
    let picks = [...chosen.values()];
    if (picks.some((p) => p.slot === "two_hand")) picks = picks.filter((p) => p.slot !== "off_hand");
    spent = picks.reduce((sum, p) => sum + p.cost, 0);

    const drink = pickConsumable(analysis.drinks, analysis.goal.gold);
    const food = pickConsumable(analysis.food, analysis.goal.gold);
    if (food.value && picks.some((p) => p.extraFood === food.value.hrid)) food.value = null;
    return { picks, spent, drink: drink.value, drinkMax: drink.max, food: food.value, foodMax: food.max };
}

function putConsumable(list, slot, hrid) { // hrid null empties the slot
    const index = Number(slot.replace(/\D+/g, ""));
    while (list.length <= index) list.push(null);
    list[index] = hrid;
}

export function applyPlan(profile, plan) {
    const result = cloneProfile(profile);
    for (const pick of plan.picks) {
        if (pick.kind === "gear") {
            equip(result, pick.slot, { hrid: pick.hrid, enhancementLevel: pick.enhancementLevel });
            if (pick.extraFood) putConsumable(result.food, "food" + pick.extraFoodSlot, pick.extraFood);
        } else if (pick.kind === "ability" || pick.kind === "abilityLevel") {
            result.abilities[Number(pick.slot.replace("ability", ""))] = { hrid: pick.hrid, level: pick.level };
        }
    }
    for (const pick of [plan.drink, plan.food]) {
        if (pick) putConsumable(pick.kind === "food" ? result.food : result.drinks, pick.slot, pick.remove ? null : pick.hrid);
    }
    return result;
}

export async function verifyPlan(pool, profile, plan, zone, settings, onProgress) {
    const variants = [{ kind: "base", profile }, { kind: "plan", profile: applyPlan(profile, plan) }];
    const [base, planned] = await simulateVariants(pool, variants, zone, settings, onProgress);
    return { base: base.result, planned: planned.result };
}
