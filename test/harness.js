// Runs the real analysis code in Node, with an in-process stand-in for the worker pool.
import { readFileSync, readdirSync } from "node:fs";
import { fill } from "../src/data-shim.js";
import { runSim } from "../src/sim-core.js";
import { engineTables, loadClientData, loadPrices } from "../src/game-data.js";
import { buildProfile, toDTO, slotCounts } from "../src/profile.js";
import { analyzeZones, analyzeUpgrades as analyzeRaw, rateUpgrades, buildPlan, verifyPlan, pickBestZone, xpValue, isSpawnCapped, MAX_ENCOUNTERS_PER_HOUR, uncertainCandidates, refineUncertain, CONFIDENCE_LEVEL } from "../src/analysis.js";
import { studentTCdf, confidenceAboveZero, confidenceGreater } from "../src/stats.js";
import { fixtureCharacter } from "./fixture-character.js";

const [, , dataDir, marketFile] = process.argv;
const log = globalThis.__log;

const clientData = {};
for (const file of readdirSync(dataDir)) clientData[file.replace(".json", "")] = JSON.parse(readFileSync(dataDir + "/" + file, "utf8"));
// The simulator repo has no level table; this synthetic one only exercises the book maths.
clientData.levelExperienceTable = Array.from({ length: 201 }, (_, level) => Math.round(30 * level ** 2.2));
const market = JSON.parse(readFileSync(marketFile, "utf8"));
globalThis.fetch = async (url) => {
    if (String(url).includes("marketplace.json")) return { ok: true, json: async () => market };
    return { ok: false, status: 404 };
};

const pool = { runAll: async (jobs, onProgress) => { const out = []; for (const j of jobs) { out.push(await runSim(j)); onProgress?.(out.length, jobs.length); } return out; } };

let failures = 0;
const check = (name, ok, detail = "") => { log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const data = await loadClientData({ localStorageUtil: { getInitClientData: () => clientData } });
await loadPrices();
fill(engineTables());

const character = fixtureCharacter();
const items = new Map(character.characterItems.map((i) => ["h:" + i.hash, i]));
const profile = buildProfile(character, items, data);
check("levels parsed", profile.levels.magic === 21 && profile.levels.intelligence === 17);
check("equipment parsed", profile.equipment.main_hand?.hrid === "/items/birch_water_staff" && profile.equipment.head?.hrid === "/items/cheese_helmet");
check("ability in slot 1", profile.abilities[1]?.hrid === "/abilities/water_strike" && profile.abilities[1].level === 6);
check("inventory parsed", profile.inventory.some((i) => i.hrid === "/items/linen_gloves"));
const slots = slotCounts(profile, data);
check("slot counts (int 17 → 1 ability slot, 1 food, 1 drink)", slots.abilities === 1 && slots.food === 1 && slots.drinks === 1, JSON.stringify(slots));
const dto = toDTO(profile, data);
check("dto has default triggers", dto.food[0].triggers.length > 0 && dto.abilities[1].triggers.length > 0);
check("current zone", profile.currentZone?.zoneHrid === "/actions/combat/fly");

const settings = { hours: 2, seeds: 4, objective: "total", goldWeight: 0, budget: 2_000_000, maxTier: 1 };
const analyzeUpgrades = async (...args) => rateUpgrades(await analyzeRaw(...args), settings);
const score = (r) => xpValue(r, "total");
let t0 = performance.now();
const zones = await analyzeZones(pool, profile, settings);
log(`zones: ${zones.length} sims in ${(performance.now() - t0).toFixed(0)} ms`);
const best = pickBestZone(zones, settings);
for (const gold of [0, 0.5, 1]) {
    const z = pickBestZone(zones, { ...settings, goldWeight: gold });
    log(`   best zone at gold ${gold}: ${z.zone.zoneHrid} T${z.zone.tier} xp/h ${Math.round(z.result.xpTotal)} profit/day ${Math.round(z.result.profit * 24)}`);
}
check("gold focus picks a zone with at least as much profit", pickBestZone(zones, { ...settings, goldWeight: 1 }).result.profit >= best.result.profit);
check("a best zone is found", !!best, best && `${best.zone.zoneHrid} T${best.zone.tier} ${Math.round(best.result.xpTotal)} xp/h deaths ${best.result.deaths}`);
for (const z of [...zones].sort((a, b) => score(b.result) - score(a.result)).slice(0, 8)) {
    log(`   ${z.zone.zoneHrid.padEnd(34)} T${z.zone.tier} xp/h ${Math.round(z.result.xpTotal)} magic ${Math.round(z.result.xp.magic || 0)} deaths ${z.result.deaths.toFixed(2)} profit ${Math.round(z.result.profit)}`);
}

t0 = performance.now();
const upgrades = await analyzeUpgrades(pool, profile, best.zone, settings);
const nCand = upgrades.gear.length + upgrades.abilities.length + upgrades.drinks.length + upgrades.food.length;
log(`upgrades: ${nCand} candidates in ${(performance.now() - t0).toFixed(0)} ms; base ${Math.round(score(upgrades.base))} xp/h`);
check("no melee/ranged weapons suggested", upgrades.gear.every((c) => !["main_hand", "two_hand"].includes(c.slot) || (data.itemDetailMap[c.hrid].equipmentDetail.combatStats.combatStyleHrids || []).includes("/combat_styles/magic")));
check("enhanced market gear is tested", upgrades.gear.some((c) => c.enhancementLevel > 0 && c.cost > 0), upgrades.gear.filter((c) => c.enhancementLevel > 0).slice(0, 3).map((c) => `${c.hrid}+${c.enhancementLevel}`).join(", "));
const levelUps = upgrades.abilities.filter((c) => c.kind === "abilityLevel");
check("ability level-ups are tested", levelUps.length > 0, levelUps.slice(0, 3).map((c) => `${c.fromLevel}->${c.level}: ${c.books} books, ${Math.round(c.xpDelta)} xp/h`).join("; "));
check("book count matches table", levelUps.every((c) => c.books === Math.max(1, Math.ceil((clientData.levelExperienceTable[c.level] - clientData.levelExperienceTable[6]) / 50))));
check("owned linen gloves cost 0", upgrades.gear.some((c) => c.hrid === "/items/linen_gloves" && c.cost === 0 && c.owned));
for (const [name, list] of Object.entries({ gear: upgrades.gear, abilities: upgrades.abilities, drinks: upgrades.drinks, food: upgrades.food })) {
    log(` ${name}:`);
    for (const c of list.slice(0, 8)) log(`   ${c.slot.padEnd(10)} ${(c.hrid + (c.enhancementLevel ? "+" + c.enhancementLevel : "") + (c.kind === "abilityLevel" ? " ->" + c.level : "") + (c.extraFood ? "+" + c.extraFood.split("/").pop() : "")).padEnd(40)} cost ${String(c.cost).padStart(8)} xpΔ ${Math.round(c.xpDelta)} gain ${(c.deltaPct * 100).toFixed(1)}% ${c.significant ? "" : "(noise)"}${c.safe ? "" : "(UNSAFE)"} cost/hΔ ${Math.round(c.costPerHourDelta)} deaths ${c.result.deaths.toFixed(2)}`);
}
for (const c of upgrades.abilities.slice(0, 4)) log(`   ability ${c.hrid} lvl ${c.level} replaces ${c.replaces} xpΔ ${Math.round(c.xpDelta)} conf ${c.confidence.toFixed(3)} runs ${c.runs.length} mana ${JSON.stringify(Object.fromEntries(Object.entries(c.result.consumables).map(([k, v]) => [k.split("/").pop(), Math.round(v)])))}`);
log(`   base consumables ${JSON.stringify(Object.fromEntries(Object.entries(upgrades.base.consumables).map(([k, v]) => [k.split("/").pop(), Math.round(v)])))} deaths ${upgrades.base.deaths}`);
const plan = buildPlan(upgrades, settings.budget);
log(" plan: " + plan.picks.map((p) => `${p.slot}:${p.hrid}${p.enhancementLevel ? "+" + p.enhancementLevel : ""}${p.kind === "abilityLevel" ? " lvl" + p.level : ""}${p.extraFood ? "+" + p.extraFood : ""}(${p.cost})`).join(", ") + (plan.drink ? ` + drink ${plan.drink.hrid}` : "") + (plan.drinkMax ? ` (max: ${plan.drinkMax.hrid})` : "") + (plan.food ? ` + food ${plan.food.slot} ${plan.food.hrid}` : "") + ` spent ${plan.spent}`);
check("a useless swap that passed 90% by luck is weeded out by re-runs", !plan.picks.some((p) => p.hrid === "/abilities/fireball"));
check("plan never adds deaths", plan.picks.every((p) => p.safe) && (!plan.drink || plan.drink.safe) && (!plan.food || plan.food.safe));
check("plan within budget", plan.spent <= settings.budget);
check("plan uses each slot once", new Set(plan.picks.map((p) => p.slot)).size === plan.picks.length);
const verified = await verifyPlan(pool, profile, plan, best.zone, settings);
log(` verified: ${Math.round(score(verified.base))} -> ${Math.round(score(verified.planned))}`);
check("plan does not make things worse", score(verified.planned) >= score(verified.base) * 0.98);

// Same simulations, gold focus: no re-simulation, and running costs now count against a drink.
const raw = upgrades;
{
    const before = uncertainCandidates(raw, settings).length;
    const refined = await refineUncertain(pool, raw, settings);
    const rerated = rateUpgrades(raw, settings);
    const extra = rerated.gear.filter((c) => c.runs.length > settings.seeds).length;
    log(`   refinement: ${before} uncertain before, ${refined} refined, ${extra} gear rows now have extra runs; base runs ${raw.baseRuns.length}`);
    check("refinement adds runs to uncertain suggestions", refined === 0 || extra > 0);
    check("the current setup got extra runs up front", raw.baseRuns.length === settings.seeds * 3);
}
const goldRated = rateUpgrades(raw, { ...settings, goldWeight: 1 });
const goldPlan = buildPlan(goldRated, settings.budget);
log(" gold-focus plan: " + goldPlan.picks.map((p) => `${p.hrid.split("/").pop()}${p.enhancementLevel ? "+" + p.enhancementLevel : ""}(${p.cost})`).join(", ") + (goldPlan.drink ? ` + drink ${goldPlan.drink.hrid} (${Math.round(goldPlan.drink.profitDelta * 24)}/day)` : " + no drink"));
check("gold focus: a recommended drink must pay for itself", !goldPlan.drink || goldPlan.drink.profitDelta > 0);
check("gold focus: every pick raises profit", goldPlan.picks.every((p) => p.profitDelta > 0));
const mixed = rateUpgrades(raw, { ...settings, goldWeight: 0.5 });
check("re-rating does not change the simulations", mixed.base === raw.base && mixed.gear.length === raw.gear.length);

// Scenario 2: already wearing the best +0 gear for Magic 21 (like a real player who followed the first plan).
{
    const geared = fixtureCharacter();
    const gear = { main_hand: "cedar_water_staff", head: "linen_hat", body: "linen_robe_top", legs: "linen_robe_bottoms", feet: "linen_boots", hands: "linen_gloves", pouch: "small_pouch" };
    geared.characterItems = Object.entries(gear).map(([slot, name], i) => ({ hash: "g" + i, itemHrid: "/items/" + name, itemLocationHrid: "/item_locations/" + slot, enhancementLevel: 0, count: 1 }));
    geared.actionTypeFoodSlotsMap["/action_types/combat"] = [{ itemHrid: "/items/donut" }, { itemHrid: "/items/plum_gummy" }];
    const gearedItems = new Map(geared.characterItems.map((i) => ["h:" + i.hash, i]));
    const p2 = buildProfile(geared, gearedItems, data);
    const a2 = await analyzeUpgrades(pool, p2, best.zone, settings);
    const plan2 = buildPlan(a2, settings.budget);
    const plan2all = buildPlan(a2, settings.budget, "all");
    log(" scenario 2 plan (all in): " + plan2all.picks.map((p) => `${p.hrid.split("/").pop()}+${p.enhancementLevel ?? ""}(${p.cost})`).join(", ") + ` spent ${plan2all.spent}`);
    log(` scenario 2 base ${Math.round(score(a2.base))} xp/h; top gear: ` + a2.gear.slice(0, 5).map((c) => `${c.hrid.split("/").pop()}+${c.enhancementLevel} ${(c.deltaPct * 100).toFixed(1)}% ${c.cost}`).join(", "));
    log(" scenario 2 plan: " + plan2.picks.map((p) => `${p.hrid.split("/").pop()}+${p.enhancementLevel ?? ""}(${p.cost})`).join(", ") + ` spent ${plan2.spent}`);
    check("scenario 2: only upgrades of worn items or new slots are suggested for gear", a2.gear.filter((c) => p2.equipment[c.slot]?.hrid === c.hrid).every((c) => c.enhancementLevel > 0));
}

// Scenario 3: Medium Pouch (2 drink slots) with two drinks and a gold focus. Dropping a drink must be
// offered as "stop using", never disguised as buying a pouch with fewer slots.
{
    const c3 = fixtureCharacter();
    const gear = { main_hand: "cedar_water_staff", head: "linen_hat", body: "linen_robe_top", legs: "linen_robe_bottoms", feet: "linen_boots", hands: "linen_gloves", pouch: "medium_pouch" };
    c3.characterItems = Object.entries(gear).map(([slot, name], i) => ({ hash: "m" + i, itemHrid: "/items/" + name, itemLocationHrid: "/item_locations/" + slot, enhancementLevel: slot === "pouch" ? 1 : 0, count: 1 }));
    c3.actionTypeFoodSlotsMap["/action_types/combat"] = [{ itemHrid: "/items/donut" }, { itemHrid: "/items/plum_gummy" }];
    c3.actionTypeDrinkSlotsMap["/action_types/combat"] = [{ itemHrid: "/items/intelligence_coffee" }, { itemHrid: "/items/ultra_magic_coffee" }];
    const p3 = buildProfile(c3, new Map(c3.characterItems.map((i) => ["h:" + i.hash, i])), data);
    p3.totalLevel = 260;
    const raw3 = await analyzeRaw(pool, p3, best.zone, settings);
    const gold3 = rateUpgrades(raw3, { ...settings, objective: "magic", goldWeight: 0.7 });
    const plan3 = buildPlan(gold3, settings.budget);
    const pouchDowngrades = gold3.gear.filter((c) => c.slot === "pouch" && slotCounts(c.profile, data).drinks < 2);
    check("scenario 3: no pouch with fewer slots is suggested", pouchDowngrades.length === 0, pouchDowngrades.map((c) => c.hrid).join(", "));
    const removals = gold3.drinks.filter((c) => c.remove);
    log("   scenario 3 removals: " + removals.map((c) => `${c.hrid.split("/").pop()} gain ${(c.delta * 100).toFixed(1)}% saves ${Math.round(-c.costPerHourDelta * 24)}/day xpΔ ${Math.round(c.xpDelta)}`).join("; "));
    check("scenario 3: stopping each drink is evaluated", removals.length === 2);
    for (const c of gold3.drinks.slice(0, 5)) log(`   drink ${c.remove ? "stop " : ""}${c.hrid.split("/").pop()} replaces ${c.replaces?.split("/").pop()} gain ${(c.delta * 100).toFixed(1)}% costΔ/day ${Math.round(c.costPerHourDelta * 24)} xpΔ ${Math.round(c.xpDelta)} sig ${c.significant} safe ${c.safe}`);
    log("   scenario 3 plan drink: " + (plan3.drink ? `${plan3.drink.remove ? "stop " : ""}${plan3.drink.hrid}` : "none"));
    check("scenario 3: plan stops the expensive drink under a gold focus", plan3.drink?.remove && plan3.drink.hrid === "/items/ultra_magic_coffee");
}

// Synthetic candidates for plan tests: 4 runs whose per-seed luck is shared, so every
// difference between them is exact (confidence 1 when positive).
const LUCK = [0.003, -0.002, 0.001, -0.002];
const synth = (fields) => ({ significant: true, safe: true, confidence: 0.99, costPerHourDelta: 0, ...fields,
    runs: LUCK.map((l, seed) => ({ seed, xp: {}, xpTotal: 1 + fields.delta + l, profit: 0 })) });
const synthGoal = { objective: "total", gold: 0, xpRef: 1, goldRef: 1 };

// Regression (real report): Fireball 19→20 gave +0.8% (below the 1% minimum) and made the plan skip
// the whole slot, although 19→21 gave +1.4% at the best value. Numbers from that analysis.
{
    const lvl = (level, cost, delta) => synth({ kind: "abilityLevel", slot: "ability1", hrid: "/abilities/fireball", level, cost, delta });
    const boom = synth({ kind: "gear", slot: "two_hand", hrid: "/items/gobo_boomstick", enhancementLevel: 5, cost: 192000, delta: 0.011 });
    const analysis = { goal: synthGoal, emptyAbilitySlots: [], gear: [boom], drinks: [], food: [],
        abilities: [lvl(20, 71000, 0.008), lvl(21, 162000, 0.014), lvl(22, 273000, 0.006), lvl(24, 536000, 0.018), lvl(29, 1460000, 0.027)] };
    const p = buildPlan(analysis, 2_000_000);
    const fb = p.picks.find((x) => x.slot === "ability1");
    check("plan: a too-small first step no longer hides a good bigger one", fb?.level === 21, fb ? `picked level ${fb.level}` : "fireball skipped");
}

// "Accept rare deaths": a zone with an occasional death may win, a dangerous one never.
{
    const r = (xpTotal, deaths) => ({ xp: { magic: xpTotal * 0.44 }, xpTotal, deaths, loot: 1000, profit: 1000 });
    const zs = [
        { zone: { zoneHrid: "safe", tier: 0 }, result: r(8000, 0) },
        { zone: { zoneHrid: "rare", tier: 1 }, result: r(12000, 0.25) },
        { zone: { zoneHrid: "deadly", tier: 2 }, result: r(20000, 3) },
    ];
    check("deaths not accepted: the safe zone wins", pickBestZone(zs, settings).zone.zoneHrid === "safe");
    check("rare deaths accepted: the rare-death zone wins, not the deadly one", pickBestZone(zs, { ...settings, acceptRareDeaths: true }).zone.zoneHrid === "rare");
}

// Real report: "Orange Gummy instead of Blueberry Cake" (+0 XP, saves the cake's cost) won over
// "stop using Blueberry Cake" by noise only. Stopping needs no purchase and should win.
{
    const food = (extra) => synth({ kind: "food", slot: "food1", costPerHourDelta: -11900, ...extra });
    const analysis = { goal: { ...synthGoal, gold: 0.3 }, emptyAbilitySlots: [], gear: [], abilities: [], drinks: [],
        food: [food({ hrid: "/items/orange_gummy", replaces: "/items/blueberry_cake", delta: 0.012 }), food({ hrid: "/items/blueberry_cake", remove: true, replaces: "/items/blueberry_cake", delta: 0.0115 })] };
    const p = buildPlan(analysis, 2_000_000);
    check("plan: stopping a food beats an equivalent swap", p.food?.remove === true, p.food ? `${p.food.remove ? "stop " : ""}${p.food.hrid}` : "none");
}

// Statistics: Student t against table values, and a step that is only noise is not bought.
check("t-distribution matches tables", [[1.638, 3, 0.9], [2.353, 3, 0.95], [2.228, 10, 0.975]].every(([t, df, p]) => Math.abs(studentTCdf(t, df) - p) < 0.001));
check("confidence of clearly positive differences is high", confidenceAboveZero([0.02, 0.03, 0.025, 0.028]) > 0.99);
// Welch: t = 1/sqrt(1/3+1/3) = 1.2247, df = 4 -> 0.8562 (tables).
check("Welch t-test matches a hand calculation", Math.abs(confidenceGreater([1, 2, 3], [0, 1, 2]) - 0.8562) < 0.001, confidenceGreater([1, 2, 3], [0, 1, 2]).toFixed(4));
// Real case: one rare death in one base run must not make a no-op look like a sure improvement.
{
    const base = [1, 1.002, 0.998, 0.955, 1.001, 0.999, 1.0, 1.003, 0.997, 1.0, 1.001, 0.999];
    const noop = [1.001, 0.999, 1.002, 0.998];
    check("a rare death in the base does not fake confidence", confidenceGreater(noop, base) < 0.9, confidenceGreater(noop, base).toFixed(3));
}
{
    // +5 looks 0.6% better than +4 only because of its luck on one seed: the plan keeps +4.
    const noisy = (enh, cost, luck) => ({ ...synth({ kind: "gear", slot: "head", hrid: "/items/x", enhancementLevel: enh, cost, delta: 0 }),
        runs: luck.map((l, seed) => ({ seed, xp: {}, xpTotal: 1 + l, profit: 0 })) });
    const plus4 = noisy(4, 100000, [0.03, 0.031, 0.029, 0.03]);
    const plus5 = noisy(5, 300000, [0.03, 0.031, 0.029, 0.054]);
    plus4.delta = 0.03; plus5.delta = 0.036;
    const p = buildPlan({ goal: synthGoal, emptyAbilitySlots: [], gear: [plus5, plus4], abilities: [], drinks: [], food: [] }, 2_000_000, "all");
    check("plan: a pricier option that is better only by luck is not bought", p.picks[0]?.enhancementLevel === 4, p.picks.map((x) => "+" + x.enhancementLevel).join(","));
}

// Encounters are capped at one per 3 s; a strong setup in the easiest zone hits that cap.
check("spawn cap is 1200 encounters/h", MAX_ENCOUNTERS_PER_HOUR === 1200);
{
    const easiest = zones.find((z) => z.zone.zoneHrid === "/actions/combat/fly" && z.zone.tier === 0);
    log(`   fly T0 encounters/h ${Math.round(easiest.result.encounters)} capped ${isSpawnCapped(easiest.result)}`);
}

// Determinism: same seed, same result.
const job = { player: dto, zoneHrid: "/actions/combat/fly", tier: 0, hours: 1, seed: 42, extraBuffs: [] };
const a = await runSim(job), b = await runSim(job);
check("seeded runs are reproducible", a.xpTotal === b.xpTotal && a.deaths === b.deaths);
check("Math.random restored after sim", Math.random !== undefined && Math.random() !== Math.random());

log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exitCode = failures ? 1 : 0;
