// Checks the Skilling advice without a browser: the best teas must not change
// when you follow the advice (put them in your slots), nor with the skill the list shows.
// Usage: node test/skilling-test.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fixtureCharacter } from "./fixture-character.js";
import { PLAN_MODES, SKILLING_SKILLS, liquidityRating, marketPricer, rankSkilling, skillingCharacter, suggestCount, thinMargin } from "../src/skilling.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataDir = path.join(root, "engine/data");
const data = {};
for (const f of readdirSync(dataDir)) data[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const character = fixtureCharacter();
character.characterSkills.push({ skillHrid: "/skills/tailoring", level: 20, experience: 0 });
character.characterItems.push({ hash: "pouch", itemHrid: "/items/large_pouch", itemLocationHrid: "/item_locations/pouch", count: 1, enhancementLevel: 0 });
const items = new Map(character.characterItems.map((i) => [i.hash, i]));
const marketData = {};
for (const item of Object.values(data.itemDetailMap)) marketData[item.hrid] = { 0: { a: 3 * (item.sellPrice || 1), b: item.sellPrice || 1 } };
const market = marketPricer((hrid) => marketData[hrid]?.[0], data, "ask");
const rank = (skill, goldWeight, drinks = null) => {
    const who = skillingCharacter(character, items, data);
    if (drinks) who.drinks[drinks.type] = drinks.teas;
    return rankSkilling(who, data, market, { skill, goldWeight }).available;
};

let flips = [];
let checked = 0;
for (const skill of SKILLING_SKILLS) {
    for (const goldWeight of [0.1, 0.5, 0.9]) {
        for (const entry of rank(skill, goldWeight)) {
            const after = rank(skill, goldWeight, { type: entry.action.type, teas: entry.best.result.teas }).find((e) => e.hrid === entry.hrid);
            checked++;
            if (after.best.result.teas.join() !== entry.best.result.teas.join()) flips.push(`${entry.action.name} @${goldWeight}`);
            if (after.betterTeas) flips.push(`${entry.action.name} @${goldWeight} still says swap`);
        }
    }
}
check("following the tea advice doesn't change it", checked > 100 && !flips.length, `${flips.length} of ${checked}: ${flips.slice(0, 5).join(", ")}`);

let differ = [];
for (const goldWeight of [0.1, 0.5, 0.9]) {
    const all = rank("all", goldWeight);
    for (const skill of SKILLING_SKILLS) {
        for (const entry of rank(skill, goldWeight)) {
            if (all.find((e) => e.hrid === entry.hrid).best.result.teas.join() !== entry.best.result.teas.join()) differ.push(`${entry.action.name} @${goldWeight}`);
        }
    }
}
check("the same teas whichever skill the list shows", !differ.length, differ.slice(0, 5).join(", "));

// A listing is never valued above the usual ask, nor (without history) far above the bid.
const troll = { a: 999999995904, b: 592 };
const plain = marketPricer(() => troll, data, "ask");
const withUsual = marketPricer(() => troll, data, "ask", () => 650);
const cupcake = "/items/cupcake";
check("a troll ask without history is valued at 1.5× the bid", Math.abs(plain.sell(cupcake).price - 592 * 1.5 * 0.96) < 1e-6 && plain.sell(cupcake).capped === "spread", JSON.stringify(plain.sell(cupcake)));
check("a troll ask with history is valued at the usual ask", Math.abs(withUsual.sell(cupcake).price - 650 * 0.96) < 1e-6 && withUsual.sell(cupcake).capped === "usual" && withUsual.sell(cupcake).ask === troll.a);
check("an ask under the usual price is kept", marketPricer(() => ({ a: 600, b: 590 }), data, "ask", () => 650).sell(cupcake).capped === null);

// The market's rating.
const summary = (l, swing) => ({ liquidity: { hours: 40, ...l }, a: { swing } });
check("stable market", liquidityRating(summary({ both: 1, spread: 0.02, activity: 0.6 }, 0.01)).rating === "stable");
check("ok market", liquidityRating(summary({ both: 0.85, spread: 0.08, activity: 0.1 }, 0.05)).rating === "ok");
check("thin market", liquidityRating(summary({ both: 0.5, spread: 0.3, activity: 0.1 }, 0.2)).rating === "thin");
check("too little history counts as thin", liquidityRating({ liquidity: { hours: 5, both: 1, spread: 0.01, activity: 1 }, a: { swing: 0 } }).rating === "thin" && !liquidityRating(null).known);

// How many: the planned hours less your stock, within the coins the rating allows.
const job = { action: { function: "/action_functions/production" }, valid: true, profitPerHour: 1000, mainCount: 1, actionsPerHour: 100, costPerAction: 50, revenuePerAction: 70, teaPerHour: 0, outputs: [{ kind: "product", value: 70, count: 1 }], inputs: [{ itemHrid: "/items/x", count: 1, price: 50 }] };
const none = { inventory: 0, listed: 0, listings: [] };
const away = PLAN_MODES.away;
const stable = { rating: "stable", known: true };
const full = suggestCount(job, { stock: none, coins: 1e9, liquidity: stable, ...away });
check("8 h job", full.count === 800 && full.fill === 1 && !full.limitedByCoins, JSON.stringify({ c: full.count, f: full.fill }));
const held = suggestCount(job, { stock: { inventory: 300, listed: 200, listings: [] }, coins: 1e9, liquidity: stable, ...away });
check("stock and listings are taken off", held.count === 300 && Math.abs(held.fill - 3 / 8) < 1e-9);
const done = suggestCount(job, { stock: { inventory: 900, listed: 0, listings: [] }, coins: 1e9, liquidity: stable, ...away });
check("holding a whole job means nothing to make", done.count === 0 && done.fill === 0);
const poorStable = suggestCount(job, { stock: none, coins: 10000, liquidity: stable, ...away });
const poorThin = suggestCount(job, { stock: none, coins: 10000, liquidity: { rating: "thin", known: true }, ...away });
check("a stable market may use 60% of the coins", poorStable.limitedByCoins && poorStable.count === 120, String(poorStable.count));
check("a thin market only 10%", poorThin.limitedByCoins && poorThin.count === 20, String(poorThin.count));
const active = suggestCount(job, { stock: none, coins: 10000, liquidity: stable, ...PLAN_MODES.active });
check("active: 1 h jobs and more of the coins", active.count === 100 && active.plannedHours === 1, String(active.count));
check("thin margin under 5%", thinMargin({ costPerAction: 1, profitPerHour: 1, margin: 0.03 }) && !thinMargin({ costPerAction: 1, profitPerHour: 1, margin: 0.2 }));
check("thin margin under the price's swing", thinMargin({ costPerAction: 1, profitPerHour: 1, margin: 0.08 }, 0.12) && !thinMargin({ costPerAction: 0, profitPerHour: 1, margin: 1 }, 0.5));

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
