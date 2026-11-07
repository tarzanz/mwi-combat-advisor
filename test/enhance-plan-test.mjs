// Checks the Enhancing plan (the box under the game's Enhancing window) without a
// browser: the simulated tries against the exact averages, the quantiles, the
// protection picked, and the materials against what you have.
// Usage: node test/enhance-plan-test.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { enhancePlan, quantile, seededRandom, simulateTries, withStock } from "../src/enhance-plan.js";
import { protectedCycle } from "../src/enhancing.js";
import { marketPricer } from "../src/skilling.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataDir = path.join(root, "engine/data");
const data = {};
for (const f of readdirSync(dataDir)) data[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
const mean = (list) => list.reduce((s, x) => s + x, 0) / list.length;
const NO_XP = new Array(22).fill(0);

// ---------- the simulated tries ----------
check("quantile: nearest rank", quantile([5, 1, 3, 2, 4], 0.5) === 3 && quantile([5, 1, 3, 2, 4], 0.9) === 5 && quantile([7], 0.9) === 7);
const sure = simulateTries(new Array(20).fill(1), 0, 2, [3, 5], 99, 10, seededRandom(1));
check("certain successes: one attempt a level", sure[3].attempts.every((a) => a === 1) && sure[5].attempts.every((a) => a === 3) && sure[5].protections.every((g) => g === 0));
const p = [0.5, 0.45, 0.45, 0.4, 0.4, 0.4, 0.35, 0.35, 0.35, 0.35, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
for (const [target, from, blessed] of [[4, 99, 0], [7, 4, 0], [8, 5, 0.05]]) {
    const tries = simulateTries(p, blessed, 0, [target], from, 20000, seededRandom(target))[target];
    const exact = protectedCycle(p, blessed, target, Math.min(from, target), NO_XP);
    const a = mean([...tries.attempts]);
    const g = mean([...tries.protections]);
    check(`+${target}${from < target ? ` protected from +${from}` : ""}${blessed ? " blessed" : ""}: simulated averages match the exact ones`,
        Math.abs(a / exact.attempts - 1) < 0.04 && (from >= target ? g === 0 : Math.abs(g / exact.protections - 1) < 0.05), `${a.toFixed(1)} vs ${exact.attempts.toFixed(1)} attempts, ${g.toFixed(2)} vs ${exact.protections.toFixed(2)} protections`);
}
const fromThree = simulateTries(p, 0, 3, [5], 99, 5000, seededRandom(3))[5];
const exactThree = protectedCycle(p, 0, 5, 5, NO_XP, 3);
check("from +3: starts there", Math.abs(mean([...fromThree.attempts]) / exactThree.attempts - 1) < 0.05, `${mean([...fromThree.attempts]).toFixed(1)} vs ${exactThree.attempts.toFixed(1)}`);

// ---------- the plan for a Ginkgo Crossbow ----------
const ITEM = "/items/ginkgo_crossbow";
const LUMBER = "/items/ginkgo_lumber";
const MIRROR = "/items/mirror_of_protection";
const marketData = {};
for (const item of Object.values(data.itemDetailMap)) marketData[item.hrid] = { a: 3 * (item.sellPrice || 1), b: 2.5 * (item.sellPrice || 1) };
marketData[LUMBER] = { a: 2000, b: 1800 };
marketData[ITEM] = { a: 900000, b: 800000 };
marketData[MIRROR] = { a: 9e6, b: 8e6 };
const market = marketPricer((hrid) => marketData[hrid], data, "bid");
const who = { levels: { "/skills/enhancing": 85 }, buffs: { "/action_types/enhancing": [] }, drinks: { "/action_types/enhancing": ["/items/wisdom_tea"] }, slots: {}, concentration: 1, sources: {}, equipped: [], houseLevels: {} };
const stock = { [LUMBER]: 63, "/items/coin": 50e6, [ITEM]: 1, "/items/wisdom_tea": 5 };
const have = (hrid) => stock[hrid] || 0;
const t0 = Date.now();
const raw = enhancePlan({ itemHrid: ITEM, start: 0, who, data, market });
const ms = Date.now() - t0;
const plan = withStock(raw, have);
const at = (n) => plan.targets.find((t) => t.target === n);
check("a row for every target +1 … +20", plan.targets.length === 20 && plan.targets[0].target === 1, `${plan.targets.length} rows in ${ms} ms`);
check("odds from the level bonus: 85 against item level 50", Math.abs(plan.rates[0] - 0.5 * (1 + 0.0005 * 35)) < 1e-9, String(plan.rates[0]));
const lumberPer = 8 * 2000;
check("an attempt costs the lumber, the coins and the tea drunk meanwhile", Math.abs(plan.attemptCost - (lumberPer + 186 + (marketData["/items/wisdom_tea"].a * 12 * plan.cycleSeconds) / 3600)) < 1e-6, String(plan.attemptCost));
check("typical ≤ bad luck, and the typical cost below the average (a long tail)", plan.targets.filter((t) => t.typical).every((t) => t.typical.cost <= t.unlucky.cost && t.typical.attempts <= t.unlucky.attempts) && at(6).typical.cost < at(6).mean.cost);
check("low targets go without protection", !at(1).protect && !at(2).protect);
const guarded = plan.targets.find((t) => t.protect);
check("high targets protected with the cheapest (a copy at 900k, not a Mirror)", guarded && guarded.protect.itemHrid === ITEM && guarded.protect.from >= 2 && guarded.without.cost > guarded.mean.cost, guarded ? `from +${guarded.protect.from} for +${guarded.target}` : "none");
for (const t of plan.targets.filter((x) => x.protect)) {
    // The protection picked costs the least on average of every +level (and none).
    const costOf = (from) => { const c = protectedCycle(raw.rates, raw.blessed, t.target, from, NO_XP); return c.attempts * raw.attemptCost + (from < t.target ? c.protections * t.protect.price : 0); };
    const best = Math.min(...Array.from({ length: t.target - 1 }, (_, i) => costOf(i + 2)));
    if (Math.abs(costOf(t.protect.from) - best) > 1e-6 * best) check(`+${t.target}: the cheapest protection level`, false);
}
check("past what can be simulated: only the average", plan.targets.some((t) => !t.typical) && plan.targets.filter((t) => !t.typical).every((t) => t.mean.attempts > 1e5));
const lumber = at(5).typical.list.find((n) => n.itemHrid === LUMBER);
check("+5: the lumber it typically takes against the 63 you have", lumber.count === 8 * at(5).typical.attempts && lumber.have === 63 && lumber.short === lumber.count - 63, JSON.stringify(lumber));
const coin = at(5).typical.list.find((n) => n.itemHrid === "/items/coin");
check("coins: what the attempts cost, and the coins it takes include buying what's short", coin.count === 186 * at(5).typical.attempts && Math.abs(at(5).typical.coinsNeeded - (coin.count + lumber.short * 2000 + at(5).typical.list.filter((n) => n.tea).reduce((s, n) => s + n.short * n.price, 0))) < 1e-6);
const copy = guarded.typical.list.find((n) => n.protection);
check("the copy being enhanced is no protection", copy && copy.have === 0, JSON.stringify(copy));
check("what your coins carry", plan.reach.typical >= plan.reach.unlucky && at(plan.reach.typical).typical.affordable && !at(plan.reach.typical + 1)?.typical?.affordable, `typically +${plan.reach.typical}, bad luck +${plan.reach.unlucky}`);
const again = enhancePlan({ itemHrid: ITEM, start: 0, who, data, market });
check("the same plan twice gives the same numbers", JSON.stringify(again.targets.map((t) => t.typical)) === JSON.stringify(raw.targets.map((t) => t.typical)));
const fromFour = enhancePlan({ itemHrid: ITEM, start: 4, who, data, market });
check("an item at +4: targets +5 and up, cheaper than from +0", fromFour.targets[0].target === 5 && fromFour.targets[0].mean.cost < at(5).mean.cost);
check("no plan for an item without enhancing materials", enhancePlan({ itemHrid: LUMBER, start: 0, who, data, market }) === null);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll enhancing plan checks passed");
process.exit(failures ? 1 : 0);
