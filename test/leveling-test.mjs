// Checks the Enhancing and Alchemy rules without a browser: the numbers the
// game's own Alchemy window showed (Alchemy 28 + Alchemy Tea), the wiki's
// enhancing examples, and the attempts per target against a plain Markov solve.
// Usage: node test/leveling-test.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { alchemyActions, coinCost, evaluateAlchemy, levelPenalty } from "../src/alchemy.js";
import { BASE_RATES, MAX_TARGET, MIN_PROTECT, cheapestProtection, enhanceCycles, enhancingActions, evaluateEnhance, levelBonus, protectedCycle, selfEnhanceCosts } from "../src/enhancing.js";
import { PLAN_MODES, coinsPerXp, enhanceBudget, marketPricer, rankSkilling } from "../src/skilling.js";
import { itemSkillBuffs, rankUpgrades } from "../src/skilling-upgrades.js";

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
// Protection: a dense solve of (I − M) E = c, where a failure at +from or above drops one level.
function protectedBySolve(p, b, target, from, cost, start = 0) {
    const n = target;
    const A = Array.from({ length: n }, (_, L) => {
        const row = Array(n + 1).fill(0);
        row[L] += 1;
        if (L + 1 < n) row[L + 1] -= p[L] * (1 - b);
        if (L + 2 < n) row[L + 2] -= p[L] * b;
        row[L >= from ? L - 1 : 0] -= 1 - p[L];
        row[n] = cost(L);
        return row;
    });
    for (let i = 0; i < n; i++) {
        let m = i;
        for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[m][i])) m = r;
        [A[i], A[m]] = [A[m], A[i]];
        for (let r = 0; r < n; r++) {
            if (r === i) continue;
            const f = A[r][i] / A[i][i];
            for (let k = i; k <= n; k++) A[r][k] -= f * A[i][k];
        }
    }
    return A[start][n] / A[start][start];
}
{
    let worstProtected = 0;
    let worstPlain = 0;
    for (const [mult, b] of [[1, 0], [1.05, 0.01], [0.7, 0], [1.2, 0.03]]) {
        const p = BASE_RATES.map((r) => Math.min(1, r * mult));
        const xpAt = p.map((_, L) => 1 + L);
        const plain = enhanceCycles(p, b, xpAt);
        for (const target of [3, 5, 10, 15, 20]) {
            for (const from of [MIN_PROTECT, 5, 8, target - 1].filter((f) => f >= MIN_PROTECT && f < target)) {
                const { attempts, xp, protections: guards } = protectedCycle(p, b, target, from, xpAt);
                const rel = (x, y) => Math.abs(x / y - 1);
                // Past ~1e9 attempts both solves lose digits to rounding; no real plan goes there.
                if (attempts > 1e9) continue;
                worstProtected = Math.max(worstProtected, rel(attempts, protectedBySolve(p, b, target, from, () => 1)), rel(xp, protectedBySolve(p, b, target, from, (L) => xpAt[L])), rel(guards, protectedBySolve(p, b, target, from, (L) => (L >= from ? 1 - p[L] : 0))));
            }
            // Protected from the target on is no protection at all.
            const { attempts, xp } = protectedCycle(p, b, target, target, p.map((x, L) => (x + 0.1 * (1 - x)) * xpAt[L]));
            if (attempts > 1e9) continue;
            worstPlain = Math.max(worstPlain, Math.abs(attempts / plain.attempts[target] - 1), Math.abs(xp / plain.xp[target] - 1));
        }
    }
    check("protection: attempts, XP and protections match a Markov solve", worstProtected < 1e-6, String(worstProtected));
    check("protection from the target on is the same as none", worstPlain < 1e-6, String(worstPlain));
    // By hand, +3 at 50% protected from +2: E2 = 1 + ½E1, E1 = 1 + ½E2 + ½E0, E0 = 1 + ½E1 + ½E0 → E0 = 12;
    // protections G2 = ½ + ½G1, G1 = ½G2 + ½G0, G0 = G1 → 1.
    const p3 = [0.5, 0.5, 0.5];
    const { attempts: a3, protections: g3 } = protectedCycle(p3, 0, 3, 2, [0, 0, 0]);
    check("by hand: +3 at 50% protected from +2 takes 12 attempts and 1 protection", near(a3, 12) && near(g3, 1), `${a3} ${g3}`);
    // From an item already at +start (the one you wear): the same solve, read at that row.
    let worstStart = 0;
    for (const [mult, b] of [[1, 0], [1.05, 0.01], [0.8, 0.02]]) {
        const p = BASE_RATES.map((r) => Math.min(1, r * mult));
        for (const target of [4, 8, 12]) {
            for (const from of [MIN_PROTECT, 5, target].filter((f) => f >= MIN_PROTECT && f <= target)) {
                for (const start of [1, 3, target - 1]) {
                    const r = protectedCycle(p, b, target, from, new Array(target).fill(0), start);
                    worstStart = Math.max(worstStart, Math.abs(r.attempts / protectedBySolve(p, b, target, from, () => 1, start) - 1));
                    if (from < target) worstStart = Math.max(worstStart, Math.abs(r.protections / protectedBySolve(p, b, target, from, (L) => (L >= from ? 1 - p[L] : 0), start) - 1));
                }
            }
        }
    }
    check("protection from +start: attempts and protections match a Markov solve", worstStart < 1e-6, String(worstStart));
    // By hand: +3 at 50% from +2 protected from +2: E2 = 1 + ½E1, E1 = 1 + ½E2 + ½E0, E0 = 12 → E1 = 10, E2 = 6.
    check("by hand: from +2 the same +3 takes 6 attempts", near(protectedCycle(p3, 0, 3, 2, [0, 0, 0], 2).attempts, 6));
}

// Enhancing it yourself (the combat upgrades' +N that nobody sells).
{
    const who = { levels: { "/skills/enhancing": 60 }, buffs: { "/action_types/enhancing": [] }, drinks: {}, slots: { "/action_types/enhancing": 2 }, concentration: 1, equipped: [], houseLevels: {} };
    const hat = "/items/cotton_hat";
    const cost = selfEnhanceCosts(hat, who, data, market, [0, 3]);
    const targets = Array.from({ length: 10 }, (_, i) => cost(0, i + 1));
    check("self-enhance: a cost for every target", targets.every(Boolean));
    check("self-enhance: a higher target costs more", targets.every((c, i) => i === 0 || c.cost > targets[i - 1].cost), targets.map((c) => Math.round(c.cost)).join(" "));
    check("self-enhance: from +3 costs less than from +0", cost(3, 7).cost < cost(0, 7).cost && cost(3, 3) === null);
    const plain = selfEnhanceCosts(hat, { ...who, slots: { "/action_types/enhancing": 0 } }, data, market, [0])(0, 5);
    check("self-enhance: the cheapest teas never cost more than none", targets[4].cost <= plain.cost + 1e-6, `${Math.round(targets[4].cost)} vs ${Math.round(plain.cost)}`);
    const high = cost(0, 10);
    check("self-enhance: a high target uses protection", !!high.protect && high.protections > 0, JSON.stringify(high.protect));
    check("self-enhance: an item without enhancing materials has no cost", selfEnhanceCosts("/items/coin", who, data, market, [0])(0, 1) === null);
}
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

// Protection: the cheapest of a copy, a Mirror or the item's own protection items; picked when it pays.
{
    const vest = data.itemDetailMap["/items/gator_vest"];
    const guard = cheapestProtection(vest, market);
    const options = [vest.hrid, "/items/mirror_of_protection", ...(vest.protectionItemHrids || [])].map((h) => market.buy(h)).filter((x) => x !== null);
    check("the cheapest protection is used", guard && guard.price === Math.min(...options), JSON.stringify(guard));
    // A +level worth twice the one below it.
    const rising = (hrid, level) => ({ price: marketData[hrid][0].b * 0.96 * 2 ** level, source: "bid", level });
    const high = evaluateEnhance(gator, enhancer, data, market, [], { resale: rising, target: 10 });
    const used = high.inputs.find((i) => i.protection);
    check("+10: protected, one protection per failure from +P", high.protect && high.protect.from >= MIN_PROTECT && high.protect.from < 10 && used && near(used.count, high.protect.protections / high.attempts), JSON.stringify(high.protect));
    check("…and fewer attempts than starting over from +0", high.attempts < enhanceCycles(high.rates, high.blessed, high.rates.map(() => 1)).attempts[10]);
    check("the protection is part of the cost per attempt", near(high.costPerAttempt, high.inputs.filter((i) => !i.upgrade).reduce((sum, i) => sum + i.value, 0)));
    check("every target says how it is protected", high.targets.every((t) => t.protect === null || t.protect.from < t.target) && high.targets[0].protect === null);
}

// The game's Enhancing window: Enhancing 8, a Cheese Enhancer, Observatory 1, Cheese Helmet (level 1) to +1.
{
    const helmet = enhancingActions(data, market).find((a) => a.itemHrid === "/items/cheese_helmet");
    const me = {
        levels: { "/skills/enhancing": 8 },
        buffs: { "/action_types/enhancing": [
            { typeHrid: "/buff_types/action_speed", flatBoost: 0.01, ratioBoost: 0 },
            { typeHrid: "/buff_types/wisdom", flatBoost: 0.344, ratioBoost: 0 },
            { typeHrid: "/buff_types/rare_find", flatBoost: 0.037, ratioBoost: 0 },
        ] },
        equipped: [{ itemHrid: "/items/cheese_enhancer", enhancementLevel: 0 }],
        houseLevels: { "/house_rooms/observatory": 1 },
        drinks: {},
        slots: { "/action_types/enhancing": 1 },
        concentration: 1,
    };
    const r = evaluateEnhance(helmet, me, data, market, [], { resale });
    const drop = (hrid) => r.outputs.find((o) => o.itemHrid === hrid)?.count;
    check("game window: 50.5% success for +0→+1", near(r.rates[0], 0.505, 5e-4), String(r.rates[0]));
    check("game window: 11.11 s", near(r.cycleSeconds, 11.11, 5e-3), String(r.cycleSeconds));
    check("game window: 20.7 XP on a success", near(1.4 * 11 * (1 + r.wisdom), 20.7, 0.05));
    check("game window: Enhancing Essence 10.1%", near(drop("/items/enhancing_essence"), 0.101));
    check("game window: Small Artisan's Crate ~0.0872%", near(drop("/items/small_artisans_crate") * 100, 0.0872, 2e-4), String(drop("/items/small_artisans_crate") * 100));
    check("drops come with every attempt", near(r.dropsPerAttempt, r.outputs.slice(1).reduce((sum, o) => sum + o.value, 0)) && r.revenuePerAction > r.outputs[0].value);
}

// The market takes only so many a day: the rest goes for the floor price.
{
    const sellHigh = () => ({ price: 1e6, source: "ask", level: 1, floor: 1000, sold: 2 });
    const r = evaluateEnhance(gator, enhancer, data, market, [], { resale: sellHigh, score: (x) => -x.target });
    const share = 2 / r.salesCap.made;
    check("sales past what the market takes go for the floor", r.target === 1 && r.salesCap?.perDay === 2 && near(r.outputs[0].price, share * 1e6 + (1 - share) * 1000), JSON.stringify(r.salesCap));
    const unknown = evaluateEnhance(gator, enhancer, data, market, [], { resale: () => ({ ...sellHigh(), sold: null }), score: (x) => -x.target });
    check("…and without sales numbers it all goes for the price", unknown.salesCap === null && unknown.outputs[0].price === 1e6);
}
// Coins: the item and the planned hours of materials within the share of your coins.
{
    const r = evaluateEnhance(gator, enhancer, data, market, [], { resale });
    const plan = { ...PLAN_MODES.away, coins: 1e9, inputMarket: () => ({ liquidity: { rating: "stable", known: true } }) };
    const rich = enhanceBudget(r, plan);
    check("plenty of coins: the whole plan", rich.fill === 1 && near(rich.need, r.base.price + rich.perHour * 8));
    const poor = enhanceBudget(r, { ...plan, coins: r.base.price / 0.6 - 1 });
    check("can't afford the item: nothing", poor.fill === 0);
    const some = enhanceBudget(r, { ...plan, coins: (r.base.price + rich.perHour * 2) / 0.6 });
    check("coins for 2 of 8 hours", near(some.fill, 0.25) && near(some.hours, 2));
    const thin = enhanceBudget(r, { ...plan, coins: (r.base.price + rich.perHour * 2) / 0.6, inputMarket: () => ({ liquidity: { rating: "thin", known: true } }) });
    check("a thin market for the item: a smaller share", thin.share === PLAN_MODES.away.coinShare.thin && thin.fill < some.fill);
}

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

// ---------- Upgrades that pay back ----------
{
    const buffOf = (hrid, skill, type) => itemSkillBuffs(hrid, 0, skill, data).buffs.find((b) => b.typeHrid === type)?.flatBoost || 0;
    check("an Enhancer's success is a buff for enhancing", near(buffOf("/items/cheese_enhancer", "enhancing", "/buff_types/enhancing_success"), 0.006));
    check("essence find from jewellery", near(buffOf("/items/ring_of_essence_find", "alchemy", "/buff_types/essence_find"), 0.15));
    const listed = (hrid) => (marketData[hrid] ? [{ enhancementLevel: 0, price: marketData[hrid][0].a, bid: marketData[hrid][0].b }] : []);
    const offers = { equipped: {}, owned: {}, listings: listed, houseLevels: {} };
    for (const skill of ["enhancing", "alchemy"]) {
        const top = list(skill, 0.5)[0];
        const xpPrice = Math.max(0, coinsPerXp(top));
        const ups = rankUpgrades(who, data, market, skill, { ...offers, actionHrid: top.hrid, leveling: { resale, xpPrice } });
        check(`${skill}: upgrades measured on the top row`, ups.base?.action.hrid === top.hrid && near(ups.xpPrice, xpPrice), `${ups.base?.action.hrid} vs ${top.hrid}`);
        check(`${skill}: worth = gold + XP at its coins per XP`, ups.upgrades.length > 0 && ups.upgrades.every((u) => near(u.gainPerDay, u.goldPerDay + xpPrice * u.xpPerDay, 1e-6 * Math.abs(u.gainPerDay) + 1e-6)));
        check(`${skill}: ranked by payback`, ups.upgrades.every((u, i, a) => i === 0 || (a[i - 1].paybackDays ?? Infinity) <= (u.paybackDays ?? Infinity)));
        const tool = skill === "enhancing" ? "/items/cheese_enhancer" : "/items/cheese_alembic";
        check(`${skill}: the cheapest tool is an upgrade`, ups.upgrades.some((u) => u.itemHrid === tool));
        const charm = ups.upgrades.find((u) => u.itemHrid === `/items/trainee_${skill}_charm`);
        check(`${skill}: a charm that only adds XP pays back by the coins that XP would cost`, xpPrice === 0 || (charm && charm.xpPerDay > 0 && charm.gainPerDay > charm.goldPerDay), JSON.stringify(charm && { g: charm.gainPerDay, gold: charm.goldPerDay, xp: charm.xpPerDay }));
        const room = skill === "enhancing" ? "Observatory" : "Laboratory";
        check(`${skill}: its house room one level up`, ups.upgrades.some((u) => u.kind === "house" && u.name === room && u.level === 1));
        check(`${skill}: no top row, nothing to measure`, rankUpgrades(who, data, market, skill, { ...offers, actionHrid: null, leveling: { resale } }).base === null);
    }
    // The Observatory's success (a ratio) counts, not only its speed.
    const top = list("enhancing", 0.5)[0];
    const xpPrice = Math.max(0, coinsPerXp(top));
    const worth = (buffs) => {
        const r = evaluateEnhance(top.action, { ...who, buffs: { "/action_types/enhancing": buffs } }, data, market, [], { resale, score: (x) => x.goldPerDay + xpPrice * x.xpPerDay });
        return r.goldPerDay + xpPrice * r.xpPerDay;
    };
    const speed = { typeHrid: "/buff_types/action_speed", flatBoost: 0.01, ratioBoost: 0 };
    const success = { typeHrid: "/buff_types/enhancing_success", flatBoost: 0, ratioBoost: 0.0005 };
    const observatory = rankUpgrades(who, data, market, "enhancing", { ...offers, actionHrid: top.hrid, leveling: { resale, xpPrice } }).upgrades.find((u) => u.kind === "house");
    // Level 1 also adds the house's wisdom and rare find.
    const house = [{ typeHrid: "/buff_types/wisdom", flatBoost: 0.0005, ratioBoost: 0 }, { typeHrid: "/buff_types/rare_find", flatBoost: 0.002, ratioBoost: 0 }];
    const both = worth([speed, success, ...house]) - worth([]);
    check("Observatory: its success counts too", observatory && near(observatory.gainPerDay, both, 1e-6 * Math.abs(both)) && both > worth([speed, ...house]) - worth([]) + 1e-9, `${observatory?.gainPerDay} vs ${both}`);
}

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
