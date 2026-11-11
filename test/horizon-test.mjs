// Checks the 📈 N-day plan (src/horizon.js) without a browser: plans ranked by
// score, the market's share and stock, coins, tools bought when they pay, a
// training phase that reaches its level, the end value of levels, cautious prices.
// Usage: node test/horizon-test.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fixtureCharacter } from "./fixture-character.js";
import { MARKET_TAX, skillingCharacter } from "../src/skilling.js";
import { HORIZON_DEFAULTS, planAdviceKey, planHorizon, planMarkets, planName, rolloutPlan, searchDetours, simulatePlan } from "../src/horizon.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataDir = path.join(root, "engine/data");
const data = {};
for (const f of readdirSync(dataDir)) data[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
data.levelExperienceTable = Array.from({ length: 201 }, (_, level) => Math.round(30 * level ** 2.2));

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const character = fixtureCharacter();
for (const s of ["woodcutting", "cheesesmithing", "crafting", "tailoring"]) character.characterSkills.push({ skillHrid: "/skills/" + s, level: s === "tailoring" ? 33 : 20, experience: 0 });
character.equipmentActionTypeBuffsMap = {};
const items = new Map(character.characterItems.map((i) => [i.hash, i]));
const who = skillingCharacter(character, items, data);

// Usual prices: ask 3×, bid 2× the shop price; a third of the items with no known sales.
const pricesWith = (sold, scale = 1) => {
    const prices = {};
    for (const item of Object.values(data.itemDetailMap)) {
        const sp = item.sellPrice || 1;
        prices[item.hrid] = { a: 3 * sp * scale, b: 2 * sp * scale, aLow: 2.8 * sp * scale, aHigh: 3.3 * sp * scale, bLow: 1.9 * sp * scale, sold: item.hrid.length % 3 ? sold : null };
    }
    return prices;
};
const prices = pricesWith(200000);
const snapshot = { who, coins: 2_000_000, owned: {} };
const days = 10;

const started = Date.now();
const plan = planHorizon(snapshot, data, prices, { days });
const ms = Date.now() - started;
check("a plan is worked out", plan.plans.length >= 3 && plan.tried >= 10, `${plan.plans.length} shown of ${plan.tried} simulated in ${ms} ms`);
check("…the search weighs far more plans than are simulated", plan.weighed > 10 * plan.tried && plan.skillRuns >= 2, `${plan.weighed} weighed, ${plan.skillRuns} runs of single skills`);
const ranked = plan.plans.slice(1, plan.plans.length - 2);
const top = Math.max(...plan.plans.map((p) => p.score));
check("plans are ranked by score", ranked.every((p, i) => i === 0 || ranked[i - 1].score >= p.score));
check("…the best is within 0.25% of the highest score, the simplest of those", plan.plans[0].score >= top - 0.0025 * Math.abs(top) && plan.plans.filter((p) => p.score >= top - 0.0025 * Math.abs(top)).every((p) => p.phases.length >= plan.plans[0].phases.length));
check("proposals carry the search's estimate", plan.plans.some((p) => Number.isFinite(p.estimate)));
check("earning the most every block is shown to compare", plan.baseline >= 0 && plan.plans[plan.baseline].name === planName([]));
check("so is keeping to the skill that earns now", plan.only >= 0 && /^Only /.test(plan.plans[plan.only].name), plan.plans[plan.only]?.name);
check("score = worth + level days × the gold a day at the end", plan.plans.every((p) => Math.abs(p.score - (p.worth + HORIZON_DEFAULTS.levelDays * p.endRate)) <= HORIZON_DEFAULTS.levelDays + 2));
check("worth is counted every day", plan.plans.every((p) => p.worthByDay.length === days));
check("the first block says what to do", plan.plans[0].first?.jobs?.length > 0 && plan.plans[0].first.jobs.every((j) => j.hours > 0 && j.name));
check("segments cover the whole plan", plan.plans.every((p) => Math.abs(p.segments.at(-1).to - days) < 1e-9 && p.segments[0].from === 0));
check("the advice key names the best plan and its first job", planAdviceKey(plan).startsWith(plan.plans[0].name + "|/actions/"));
const markets = planMarkets(prices, data);
const sample = ["/items/milk", "/items/cheese", "/items/linen_fabric", "/items/azure_needle"];
check("cautious prices buy higher and sell lower", sample.every((h) => markets.cautious.buy(h) >= markets.typical.buy(h) && markets.cautious.sell(h).price <= markets.typical.sell(h).price));
const weighedPlans = plan.plans.filter((p) => p.greedy !== null);
check("the plans near the best get their purchases weighed, never scoring less than greedily", plan.rolledOut > 0 && plan.rollouts > 0 && plan.plans[0].greedy !== null && weighedPlans.every((p) => p.score >= p.greedy), `${plan.rolledOut} plans, ${plan.rollouts} runs`);
const finalOf = plan.plans[0].phases.at(-1);
check("…and so does keeping to the best plan's final skill", !finalOf || finalOf.level !== null || plan.plans.some((p) => p.phases.length === 1 && p.phases[0].skill === finalOf.skill && p.phases[0].level === null && p.greedy !== null));
check("the plans shown first are run with cautious prices too", plan.plans.slice(0, 3).every((p) => p.cautious && Number.isFinite(p.cautious.score)));

// A plan run on its own: coins never go below zero, every block filled from a few jobs.
const earn = simulatePlan(snapshot, data, prices, [], { days });
let coins = snapshot.coins;
let negative = false;
for (const block of earn.timeline) {
    coins += block.income - block.costs;
    if (block.costs > coins + block.income + 1e-6) negative = true;
}
check("coins pay for every block", !negative && earn.end.coins >= 0);
check("a block is one job, two at most, none under an hour", earn.timeline.every((b) => b.ran.length <= 2 && b.ran.every((x) => x.hours >= 1 - 1e-9)));

// Training: a phase reaches its level before the next one starts.
const target = 60;
const train = simulatePlan(snapshot, data, prices, [{ skill: "/skills/cheesesmithing", level: target, style: "xp" }], { days });
const reachedAt = train.levelUps.find((u) => u.skill === "/skills/cheesesmithing" && u.to >= target)?.block;
check("a training phase reaches its level", reachedAt !== undefined, `block ${reachedAt}`);
check("…working that skill until then", train.timeline.slice(0, reachedAt).every((b) => b.ran[0]?.r.skill === "/skills/cheesesmithing"));
check("…and earning after it", reachedAt === undefined || train.timeline.slice(reachedAt + 1).some((b) => b.phase === null));

// The market's share: what it can't take waits in stock; a bigger share sells more at the listing price.
const thin = simulatePlan(snapshot, data, pricesWith(50), [{ skill: "/skills/tailoring", level: Infinity, style: "gold" }], { days: 3 });
const wide = simulatePlan(snapshot, data, pricesWith(50), [{ skill: "/skills/tailoring", level: Infinity, style: "gold" }], { days: 3, marketShare: 1 });
const stockOf = (run) => Object.values(run.end.stock).reduce((sum, n) => sum + n, 0);
check("a thin market leaves stock", stockOf(thin) > 0, String(Math.round(stockOf(thin))));
check("a bigger share of the market is worth more", wide.worth >= thin.worth, `${Math.round(thin.worth)} → ${Math.round(wide.worth)}`);

// Tools: bought when the skill being worked allows a better one that pays; not when it costs a fortune.
const tools = simulatePlan(snapshot, data, prices, [{ skill: "/skills/tailoring", level: Infinity, style: "gold" }], { days: 3 });
check("a better tool is bought when it pays", tools.purchases.some((x) => /needle/.test(x.itemHrid)), tools.purchases.map((x) => x.itemHrid).join(", "));
const dear = pricesWith(200000);
for (const hrid of Object.keys(dear)) if (/needle/.test(hrid)) Object.assign(dear[hrid], { a: 1e15, aHigh: 1e15, aLow: 1e15, b: 1e14, bLow: 1e14 });
const noTools = simulatePlan(snapshot, data, dear, [{ skill: "/skills/tailoring", level: Infinity, style: "gold" }], { days: 3 });
check("…and not when it never pays back", !noTools.purchases.some((x) => /needle/.test(x.itemHrid)));
const owned = simulatePlan({ ...snapshot, owned: { "/items/burble_needle": 1 } }, data, dear, [{ skill: "/skills/tailoring", level: Infinity, style: "gold" }], { days: 3 });
check("a tool you have is put on for nothing", owned.purchases.some((x) => x.itemHrid === "/items/burble_needle" && x.owned && x.price === 0));

// Clothes: a piece is bought when it pays, not when it never pays back; what you own is worn for the skill
// it helps (a loadout per skill) and counts in the worth at the bid.
const tailoring = [{ skill: "/skills/tailoring", level: Infinity, style: "gold" }];
const milking = [{ skill: "/skills/milking", level: Infinity, style: "gold" }];
const NECK = "/items/necklace_of_efficiency";
const EARRINGS = "/items/earrings_of_gathering";
const dressed = simulatePlan(snapshot, data, prices, tailoring, { days: 3 });
const clothes = dressed.purchases.filter((x) => x.gear);
check("a piece of clothing is bought when it pays", clothes.length > 0 && clothes.every((x) => x.gainPerDay > 0 && x.price > 0), clothes.map((x) => x.itemHrid).join(", "));
const wornAfter = dressed.timeline.at(-1).ran[0]?.r.loadout || {};
check("…and worn for the skill from then on", Object.values(wornAfter).some((item) => item.itemHrid === clothes.at(-1)?.itemHrid), clothes.at(-1)?.itemHrid);
const pricey = pricesWith(200000);
for (const item of Object.values(data.itemDetailMap)) {
    const detail = item.equipmentDetail;
    if (detail?.noncombatStats && !/_tool$/.test(detail.type)) pricey[item.hrid] = { a: 1e12, b: 1e12, aLow: 1e12, aHigh: 1e12, bLow: 1e12, sold: 0 };
}
const bare = simulatePlan(snapshot, data, pricey, tailoring, { days: 3 });
check("…and not when it never pays back", !bare.purchases.some((x) => x.gear), bare.purchases.map((x) => x.itemHrid).join(", "));
const held = { ...snapshot, gear: [{ itemHrid: NECK, enhancementLevel: 0 }, { itemHrid: EARRINGS, enhancementLevel: 0 }] };
const heldTailoring = simulatePlan(held, data, pricey, tailoring, { days: 1 });
const heldMilking = simulatePlan(held, data, pricey, milking, { days: 1 });
const wears = (run, hrid) => Object.values(run.timeline[0].ran[0]?.r.loadout || {}).some((item) => item.itemHrid === hrid);
check("clothes you own are worn for nothing for the skill they help", wears(heldTailoring, NECK) && wears(heldMilking, EARRINGS) && wears(heldMilking, NECK) && !heldTailoring.purchases.some((x) => x.gear));
check("…a loadout per skill: what helps only gathering isn't worn to tailor", !wears(heldTailoring, EARRINGS));
check("…and they earn more than going without", heldTailoring.timeline[0].income - heldTailoring.timeline[0].costs > bare.timeline[0].income - bare.timeline[0].costs);
check("clothes you own count in the worth at the bid", Math.abs(heldTailoring.startWorth - bare.startWorth - 2 * 1e12 * (1 - MARKET_TAX)) < 1e3, `${heldTailoring.startWorth - bare.startWorth}`);

// Enhanced tools and clothes: a +level for sale is bought when it pays better than +0, and sold again at its own bid.
const plusPrices = pricesWith(200000);
for (const item of Object.values(data.itemDetailMap)) {
    if (!/_needle$/.test(item.hrid) || !plusPrices[item.hrid]) continue;
    const base = plusPrices[item.hrid];
    plusPrices[`${item.hrid}+10`] = { a: base.a * 1.3, b: base.b * 1.3, aLow: base.aLow * 1.3, aHigh: base.aHigh * 1.3, bLow: base.bLow * 1.3, sold: 1 };
}
const plus = simulatePlan(snapshot, data, plusPrices, tailoring, { days: 3 });
const plusTool = plus.purchases.find((x) => x.kind === "tool" && /needle/.test(x.itemHrid));
check("an enhanced tool for sale is bought when it pays more than +0", plusTool?.level === 10, plus.purchases.map((x) => `${x.itemHrid}+${x.level}`).join(", "));
check("…and counts in the worth at its own bid", plus.end.tools["/equipment_types/tailoring_tool"]?.level === 10 && plus.worth > simulatePlan(snapshot, data, prices, tailoring, { days: 3 }).worth);
const noPlus = simulatePlan(snapshot, data, prices, tailoring, { days: 3 });
check("without +levels for sale only +0 is bought", noPlus.purchases.every((x) => x.kind === "house" || !x.level));

// A tool is kept only until the next tier unlocks when that tier is for sale at its +level or higher:
// just short of Tailoring 35 (Burble Needle), no Azure Needle at any level is bought – Burble is, once there.
const nearBurble = { ...snapshot, who: { ...who, levels: { ...who.levels, "/skills/tailoring": 34 }, experience: { ...who.experience, "/skills/tailoring": data.levelExperienceTable[35] - 1 } } };
const waited = simulatePlan(nearBurble, data, plusPrices, tailoring, { days: 3 });
const needles = waited.purchases.filter((x) => x.kind === "tool");
check("no tool is bought just before the next tier replaces it", !needles.some((x) => /azure_needle/.test(x.itemHrid)) && needles.some((x) => /burble_needle/.test(x.itemHrid)), needles.map((x) => `${x.block}:${x.itemHrid}+${x.level}`).join(", "));
const farFromBurble = simulatePlan({ ...snapshot, who: { ...who, levels: { ...who.levels, "/skills/tailoring": 20 }, experience: { ...who.experience, "/skills/tailoring": data.levelExperienceTable[20] } } }, data, plusPrices, tailoring, { days: 3 });
check("…but is when the next tier is far off", farFromBurble.purchases.some((x) => /azure_needle/.test(x.itemHrid)), farFromBurble.purchases.filter((x) => x.kind === "tool").map((x) => `${x.block}:${x.itemHrid}+${x.level}`).join(", "));

// Purchases weighed one by one (rollout): each alternative runs the rest of the
// plan from its block, the best kept – never worse than buying greedily.
const rolled = rolloutPlan(snapshot, data, plusPrices, tailoring, { days: 10 });
const buys = (run) => run.purchases.map((x) => `${x.block}:${(x.itemHrid || x.roomHrid).split("/").pop()}+${x.level}`).join(" ");
check("weighing the purchases is never worse than buying greedily", rolled.best.score >= rolled.greedy.score && rolled.best.tries > 0 && rolled.greedy.decisions.length > 0, `${Math.round(rolled.greedy.score)} → ${Math.round(rolled.best.score)} in ${rolled.best.tries} runs; ${buys(rolled.best)}`);
check("…and its choices give the same run from the start", Math.abs(rolled.replay(rolled.best.choices).score - rolled.best.score) < 1e-6);
const decision = rolled.greedy.decisions.find((d) => d.alternatives.some((a) => a.wait)) || rolled.greedy.decisions[0];
const at = `${decision.block}|${decision.kind}`;
check("a run picked up at a decision's block is the run from the start", decision.alternatives.every((alt) => {
    const choice = new Map([[at, alt]]);
    return Math.abs(rolled.replay(choice).score - rolled.replay(choice, { parent: rolled.greedy, b: decision.block }).score) < 1e-6;
}));
const skipped = rolled.replay(new Map([[at, { skip: true }]]));
check("skip: nothing of that kind is bought in that block", !skipped.purchases.some((x) => x.block === decision.block && x.kind === decision.kind), buys(skipped));
const greedyBuy = rolled.greedy.purchases.find((x) => x.block === decision.block && x.kind === decision.kind);
const banned = rolled.replay(new Map([[at, { ban: `${greedyBuy.itemHrid || greedyBuy.roomHrid}+${greedyBuy.level}` }]]));
check("ban: the piece bought greedily is never bought", greedyBuy.kind === "house" || !banned.purchases.some((x) => x.itemHrid === greedyBuy.itemHrid && x.level === greedyBuy.level), buys(banned));
const waitFor = decision.alternatives.find((a) => a.wait);
if (waitFor) {
    const saving = rolled.replay(new Map([[at, waitFor]]));
    // (Saving up ends early when the piece is no longer offered – something cheaper does as much – or no longer pays.)
    const kinds = ["tool", "gear", "house"];
    const later = (x) => x.block === decision.block && kinds.indexOf(x.kind) >= kinds.indexOf(decision.kind);
    const next = (x) => x.block === decision.block + 1 && `${x.itemHrid}+${x.level}` !== waitFor.wait;
    check("wait: nothing else is bought while saving up for it", !saving.purchases.some((x) => later(x) || next(x)), `${decision.block}|${decision.kind} ${waitFor.wait}: ${buys(saving)}`);
}

// House rooms: the skill's room goes up when it pays, not when its materials cost a fortune.
const PARLOR = "/house_rooms/sewing_parlor";
const built = simulatePlan(snapshot, data, prices, tailoring, { days: 10 });
const builds = built.purchases.filter((x) => x.kind === "house");
check("the skill's house room is built up when it pays", builds.some((x) => x.roomHrid === PARLOR && x.gainPerDay > 0 && x.price > 0), builds.map((x) => `${x.roomHrid} ${x.level}`).join(", "));
check("…one level at a time, never past 8", builds.every((x, i) => x.level <= 8 && (i === 0 || x.level === builds[i - 1].level + 1)) && built.end.house.levels[PARLOR] === builds.at(-1)?.level);
// (Its needles cost a fortune: they are tools for Tailoring, not what it makes or uses.)
const dearRoom = pricesWith(200000);
for (const level of Object.values(data.houseRoomDetailMap[PARLOR].upgradeCostsMap)) for (const c of level) if (/_needle$/.test(c.itemHrid)) dearRoom[c.itemHrid] = { a: 1e12, b: 1e12, aLow: 1e12, aHigh: 1e12, bLow: 1e12, sold: 1e9 };
check("…and not when its materials never pay back", !simulatePlan(snapshot, data, dearRoom, tailoring, { days: 10 }).purchases.some((x) => x.kind === "house"));
// A block where only the room went up, on the same job at the same level as the block before: more actions an hour.
const steps = built.purchases.filter((x) => x.kind === "house" && x.block > 0 && !built.purchases.some((y) => y !== x && y.block === x.block)).map((x) => {
    const before = built.timeline[x.block - 1].ran[0]?.r;
    const after = built.timeline[x.block].ran.find((y) => y.r.id === before?.id && y.r.level === before?.level)?.r;
    return before && after ? [before.actionsPerHour, after.actionsPerHour] : null;
}).filter(Boolean);
check("a room built up makes its skill's jobs faster", steps.length > 0 && steps.every(([from, to]) => to > from), JSON.stringify(steps.map(([a, b]) => [Math.round(a), Math.round(b)])));

// Community buffs: the plans are also run without them, and a gathering plan that leans on them earns less there.
const communityWho = { ...who, buffs: { ...who.buffs, "/action_types/milking": [...(who.buffs["/action_types/milking"] || []), { uniqueHrid: "/buff_uniques/gathering_community_buff", typeHrid: "/buff_types/gathering", flatBoost: 0.3, ratioBoost: 0 }] } };
const community = { ...snapshot, who: communityWho };
const withBuff = simulatePlan(community, data, prices, milking, { days: 3 });
const withoutBuff = simulatePlan(community, data, prices, milking, { days: 3 }, "noCommunity");
check("without the community buffs a gathering plan earns less", withoutBuff.gain < withBuff.gain, `${Math.round(withBuff.gain)} → ${Math.round(withoutBuff.gain)}`);
const communityPlan = planHorizon(community, data, prices, { days: 3 });
check("the best plans say what they'd earn without them", communityPlan.community && communityPlan.plans[0].noCommunity && Number.isFinite(communityPlan.plans[0].noCommunity.gain));
check("…not when there are none", !plan.community && plan.plans.every((p) => !p.noCommunity));

// The search over detours, on runs made up: skill A earns 1 a block and levels one a block (two
// training for XP, earning nothing); B earns 2 a block, or 4 once A is at 3 (clothes A's level
// unlocks). Best: train A to 3 for one block, then B for the other nine.
const made = (gain, levels, raise = null) => ({ raise, worth: Array.from({ length: 11 }, (_, k) => gain * k), xp: Array.from({ length: 11 }, (_, k) => 100 * k), level: Array.from({ length: 11 }, (_, k) => 1 + levels * k), net: Array(10).fill(gain) });
const dp = { runs: { gold: { A: made(1, 1), B: made(2, 0) }, xp: { A: made(0, 2), B: made(0, 0) } }, finals: { A: [made(1, 1)], B: [made(2, 0), made(4, 0, { A: 3 })] } };
const space = { blocks: 10, levelDays: 0, blockHours: 8, skills: ["A", "B"], levels: { A: 1, B: 1 } };
const found = searchDetours(space, dp, [{ skill: "A", level: 3, style: "gold" }, { skill: "A", level: 3, style: "xp" }]);
const first = found.results[0];
check("the search finds the detour that unlocks clothes for the final skill", first?.final === "B" && first.steps.length === 1 && first.steps[0].style === "xp" && first.value === 36, JSON.stringify(first));
check("…and weighs the rest below it", found.results.some((r) => r.final === "B" && r.steps.length === 0 && r.value === 20) && found.results.some((r) => r.steps[0]?.style === "gold" && r.final === "B" && r.value === 34));
check("…levelDays add the final skill's gold a day at the end", searchDetours({ ...space, levelDays: 1 }, dp, []).results[0].value === 20 + 2 * 3);

// The end value of levels: without it the score is the worth.
const noLevels = simulatePlan(snapshot, data, prices, [], { days, levelDays: 0 });
check("level days 0: score is the worth", Math.abs(noLevels.score - noLevels.worth) < 1e-6);

// Jobs are ranked by what the market takes: things worth a fortune on paper that
// sell one a day must not push a job that earns out of the earning jobs tried.
const paper = pricesWith(200000);
for (const action of Object.values(data.actionDetailMap)) {
    if (!action.inputItems?.length) continue;
    for (const out of action.outputItems || []) {
        const sp = data.itemDetailMap[out.itemHrid]?.sellPrice || 1;
        paper[out.itemHrid] = { a: 3000 * sp, b: 2000 * sp, aLow: 2800 * sp, aHigh: 3300 * sp, bLow: 1900 * sp, sold: 0.01 };
    }
}
const cheeseSp = data.itemDetailMap["/items/cheese"].sellPrice;
paper["/items/cheese"] = { a: 60 * cheeseSp, b: 50 * cheeseSp, aLow: 58 * cheeseSp, aHigh: 62 * cheeseSp, bLow: 48 * cheeseSp, sold: 1e7 };
const deep = simulatePlan(snapshot, data, paper, [], { days: 1 });
check("earning jobs are ranked within the market's limits", deep.timeline[0].ran[0]?.r.name === "Cheese", deep.timeline[0].ran.map((x) => x.r.name).join(" + "));
check("…and so is the end value of levels", deep.endRate > 0 && Math.abs(deep.endRate - 3 * (deep.timeline.at(-1).income - deep.timeline.at(-1).costs)) < 0.2 * deep.endRate, `${Math.round(deep.endRate)} a day`);

// A missing level table is said, not guessed.
let error = null;
try {
    planHorizon(snapshot, { ...data, levelExperienceTable: undefined }, prices, { days: 1 });
} catch (e) {
    error = e;
}
check("without the game's level table it says so", /levelExperienceTable/.test(error?.message || ""));

console.log(failures ? `\n${failures} FAILED` : "\nall passed");
process.exit(failures ? 1 : 0);
