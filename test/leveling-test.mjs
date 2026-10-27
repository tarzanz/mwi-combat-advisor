// Checks the Enhancing and Alchemy rules without a browser: the numbers the
// game's own Alchemy window showed (Alchemy 28 + Alchemy Tea), the wiki's
// enhancing examples, and the attempts per target against a plain Markov solve.
// Usage: node test/leveling-test.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { alchemyActions, coinCost, evaluateAlchemy, levelPenalty } from "../src/alchemy.js";
import { BASE_RATES, MAX_TARGET, enhanceCycles, enhancingActions, evaluateEnhance, levelBonus } from "../src/enhancing.js";
import { coinsPerXp, marketPricer, rankSkilling } from "../src/skilling.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataDir = path.join(root, "engine/data");
const data = {};
for (const f of readdirSync(dataDir)) data[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

const marketData = {};
for (const item of Object.values(data.itemDetailMap)) marketData[item.hrid] = { 0: { a: 3 * (item.sellPrice || 1), b: 2.5 * (item.sellPrice || 1) } };
const market = marketPricer((hrid) => marketData[hrid]?.[0], data, "bid");

// ---------- Alchemy: the game's window at Alchemy 28 with Alchemy Tea (+3 levels) ----------
const ALCHEMY = "/action_types/alchemy";
const alchemist = {
    levels: { "/skills/alchemy": 28, "/skills/enhancing": 30 },
    buffs: { [ALCHEMY]: [
        { typeHrid: "/buff_types/action_speed", flatBoost: 0.3, ratioBoost: 0 },
        { typeHrid: "/buff_types/wisdom", flatBoost: 0.465, ratioBoost: 0 },
        { typeHrid: "/buff_types/rare_find", flatBoost: 0.035, ratioBoost: 0 },
    ] },
    drinks: {},
    slots: { [ALCHEMY]: 1, "/action_types/enhancing": 1 },
    concentration: 1,
};
const actions = alchemyActions(data, market);
const coinify = (item) => evaluateAlchemy(actions.find((a) => a.hrid === `/actions/alchemy/coinify#/items/${item}`), alchemist, data, market, ["/items/alchemy_tea"]);
const coffee = coinify("channeling_coffee");
const donut = coinify("blueberry_donut");
// Without a catalyst, as in the screenshots.
const plain = (r) => r.catalyst.itemHrid === null;
check("success below the item's level: Channeling Coffee 39.55%", plain(coffee) ? near(coffee.successRate, 0.3955) : near(0.7 * (1 + levelPenalty(31, 60)), 0.3955), `${coffee.successRate} (${coffee.catalyst.itemHrid})`);
check("level penalty 0.9 / item level per level", near(levelPenalty(31, 60), -0.435) && levelPenalty(31, 10) === 0);
check("success at or above the item's level: Blueberry Donut 70%", near(0.7 * (1 + levelPenalty(31, 10)), 0.7));
check("XP 1.0 × (10 + item level) × wisdom: 102.5 and 29.3 on a success", near(1.0 * 70 * 1.465, 102.55, 1e-9) && near(coffee.xpPerAction / (coffee.successRate + 0.1 * (1 - coffee.successRate)), 102.55, 1e-6), String(coffee.xpPerAction));
check("20 s / (1 + speed): 15.38 s", near(coffee.cycleSeconds, 20 / 1.3), String(coffee.cycleSeconds));
const essence = (r) => r.outputs.find((o) => o.itemHrid === "/items/alchemy_essence")?.count;
const crate = (r, size) => r.outputs.find((o) => o.itemHrid === `/items/${size}_artisans_crate`)?.count;
check("Alchemy Essence (100 + level) / 1800: 8.89% and 6.11%", near(essence(coffee), 160 / 1800) && near(essence(donut), 110 / 1800));
check("crates by level with rare find: Medium ~0.060%, Small ~0.079%", near(crate(coffee, "medium"), (125 / 216000) * 1.035) && near(crate(donut, "small"), (110 / 144000) * 1.035) && near(crate(donut, "small") * 100, 0.0791, 5e-4), `${crate(coffee, "medium")} ${crate(donut, "small")}`);
check("coinify gives 5 × sell price: 400 and 50 coins", coffee.outputs.some((o) => o.itemHrid === "/items/coin" && near(o.count, 400 * coffee.successRate)) && donut.outputs.some((o) => o.itemHrid === "/items/coin" && near(o.count, 50 * donut.successRate)));
const coffeeDetail = data.itemDetailMap["/items/channeling_coffee"];
check("decompose costs 5 × (10 + level), transmute max(50, sell / 5)", coinCost("decompose", coffeeDetail) === 350 && coinCost("transmute", coffeeDetail) === 50 && coinCost("coinify", coffeeDetail) === 0);
const essenceAction = actions.find((a) => a.hrid === "/actions/alchemy/transmute#/items/swamp_essence");
const bulk = evaluateAlchemy(essenceAction, alchemist, data, market, []);
// 30% of successes give Swamp Essence back: 10 × 30% × the success rate needn't be bought again.
check("bulk: one transmute takes 10 essences, some come back", bulk.bulk === 10 && near(bulk.inputs[0].count, 10 - 10 * 0.3 * bulk.successRate) && bulk.coinCost === 500, `${bulk.inputs[0].count} ${bulk.coinCost}`);
// A catalyst is used up only on a success, and is picked when it pays.
const withCatalyst = actions.map((a) => evaluateAlchemy(a, alchemist, data, market, [])).find((r) => r.catalyst.itemHrid);
check("a catalyst is used only on a success", !withCatalyst || near(withCatalyst.inputs.find((i) => i.catalyst).count, withCatalyst.successRate));

// ---------- Enhancing ----------
check("wiki: level 10 on an item level 50 with a Cheese Enhancer: 24.24% for +4→+5", near(BASE_RATES[4] * (1 + levelBonus(10, 50) + 0.006), 0.2424));
check("0.05% per level above the item", near(levelBonus(80, 50), 0.015));
// A plain Markov solve: expected attempts from +0 to the target, by value iteration on E[L].
function attemptsBySolve(p, b, target) {
    // E[L] = 1 + p(1-b) E[L+1] + p b E[L+2] + (1-p) E[0]; E[≥target] = 0. Solve E = a + c E[0] backwards.
    const a = Array(target + 2).fill(0);
    const c = Array(target + 2).fill(0);
    for (let L = target - 1; L >= 0; L--) {
        const up1 = L + 1 >= target ? [0, 0] : [a[L + 1], c[L + 1]];
        const up2 = L + 2 >= target ? [0, 0] : [a[L + 2], c[L + 2]];
        a[L] = 1 + p[L] * (1 - b) * up1[0] + p[L] * b * up2[0];
        c[L] = p[L] * (1 - b) * up1[1] + p[L] * b * up2[1] + (1 - p[L]);
    }
    return a[0] / (1 - c[0]);
}
let worst = 0;
for (const [mult, b] of [[1, 0], [1.05, 0.01], [0.7, 0], [1.2, 0.03]]) {
    const p = BASE_RATES.map((r) => Math.min(1, r * mult));
    const { attempts } = enhanceCycles(p, b, p.map(() => 1));
    for (const target of [1, 2, 5, 10, 15]) worst = Math.max(worst, Math.abs(attempts[target] / attemptsBySolve(p, b, target) - 1));
}
// The solve subtracts nearly equal numbers at ~1e10 attempts, so allow rounding.
check("attempts per target match a Markov solve (with and without Blessed Tea)", worst < 1e-6, String(worst));
const p = BASE_RATES;
const one = enhanceCycles(p, 0, p.map((_, L) => 1.4 * (1 + L) * 30));
check("+1 takes 1 / 50% = 2 attempts; XP on a success and a tenth on a failure", near(one.attempts[1], 2) && near(one.xp[1], 2 * (0.5 * 42 + 0.5 * 4.2)), `${one.attempts[1]} ${one.xp[1]}`);
check("+2: 1 / (0.5 × 0.45) runs of 1.5 attempts on average", near(one.attempts[2], (1 + 0.5) / (0.5 * 0.45)));

const enhancer = { ...alchemist, buffs: { "/action_types/enhancing": [] }, levels: { "/skills/enhancing": 30 } };
const gator = enhancingActions(data, market).find((a) => a.itemHrid === "/items/gator_vest");
const resale = (hrid) => ({ price: marketData[hrid][0].b * 0.96, source: "lower", level: 0 });
const g = evaluateEnhance(gator, enhancer, data, market, [], { resale });
check("enhancing speed: 12 s / (1 + 1% per level above the item)", near(g.cycleSeconds, 12 / 1.1), String(g.cycleSeconds));
check("every target is worked out, the best one chosen", g.targets.length === MAX_TARGET && g.targets.every((t) => g.goldPerDay >= t.goldPerDay - 1e-6));
const xpBest = evaluateEnhance(gator, enhancer, data, market, [], { resale, score: (r) => r.xpPerDay });
check("an XP focus aims higher than a gold focus", xpBest.target >= g.target && xpBest.xpPerDay >= g.xpPerDay, `${xpBest.target} vs ${g.target}`);
const owned = evaluateEnhance(gator, enhancer, data, market, [], { resale, owned: () => 1 });
check("an item you have is worth its bid, not the ask", owned.base.owned && near(owned.base.price, marketData["/items/gator_vest"][0].b * 0.96));
const blessed = evaluateEnhance(gator, enhancer, data, market, ["/items/blessed_tea"], { resale, score: (r) => r.xpPerDay });
check("Blessed Tea: fewer attempts to a high target", near(blessed.blessed, 0.01) && blessed.targets[14].attempts < xpBest.targets[14].attempts);
// The tool's success isn't sent by the game: it is read from the gear.
const tooled = evaluateEnhance(gator, { ...enhancer, equipped: [{ itemHrid: "/items/cheese_enhancer", enhancementLevel: 0 }] }, data, market, [], { resale });
check("an Enhancer's success counts when the game doesn't send it", near(tooled.successBonus, 0.006));
const sent = evaluateEnhance(gator, { ...enhancer, equipped: [{ itemHrid: "/items/cheese_enhancer", enhancementLevel: 0 }], sources: { equipmentActionTypeBuffsMap: { "/action_types/enhancing": [{ typeHrid: "/buff_types/enhancing_success", flatBoost: 0.006, ratioBoost: 0 }] } }, buffs: { "/action_types/enhancing": [{ typeHrid: "/buff_types/enhancing_success", flatBoost: 0.006, ratioBoost: 0 }] } }, data, market, [], { resale });
check("…and not twice when it does", near(sent.successBonus, 0.006));

// ---------- The list: time against money ----------
const who = { ...alchemist, levels: { "/skills/alchemy": 28, "/skills/enhancing": 30 }, buffs: {}, drinks: {} };
const list = (skill, goldWeight) => rankSkilling(who, data, market, { skill, goldWeight, teaMode: "best", leveling: { resale } }).available.filter((e) => e.valid);
for (const skill of ["enhancing", "alchemy"]) {
    const money = list(skill, 1);
    const time = list(skill, 0);
    const cheapest = Math.min(...money.map(coinsPerXp));
    const fastest = Math.max(...time.map((e) => e.xpPerDay));
    check(`${skill}: Gold only ranks the cheapest coins per XP first`, near(coinsPerXp(money[0]), cheapest, 1e-6), `${money[0].action.name} ${coinsPerXp(money[0])} vs ${cheapest}`);
    check(`${skill}: XP only ranks the most XP first`, near(time[0].xpPerDay, fastest, 1e-6), `${time[0].action.name}`);
    check(`${skill}: not in All skills`, !rankSkilling(who, data, market, { skill: "all" }).available.some((e) => e.action.type === `/action_types/${skill}`));
}

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
