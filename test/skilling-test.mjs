// Checks the Skilling advice without a browser: the best teas must not change
// when you follow the advice (put them in your slots), nor with the skill the list shows.
// Usage: node test/skilling-test.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fixtureCharacter } from "./fixture-character.js";
import { rankUpgrades } from "../src/skilling-upgrades.js";
import { PLAN_MODES, SKILLING_SKILLS, evaluateAction, liquidityRating, marketPricer, rankSkilling, skillingCharacter, suggestChainCount, suggestCount, thinMargin } from "../src/skilling.js";

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

// Made all day past what sells a day: the rest goes for the bid (listing) or the shop (selling now).
{
    const who = skillingCharacter(character, items, data);
    const action = data.actionDetailMap["/actions/tailoring/cotton_robe_top"];
    const product = action.outputItems[0].itemHrid;
    const sold = (perDay) => (hrid) => (hrid === product ? perDay : null);
    const free = evaluateAction(action, who, data, market);
    const made = free.mainCount * free.actionsPerHour * 24;
    const few = evaluateAction(action, who, data, marketPricer((hrid) => marketData[hrid]?.[0], data, "ask", () => null, sold(made / 4)));
    const out = (r) => r.outputs.find((o) => o.itemHrid === product);
    const ask = out(free).price;
    const bid = marketData[product][0].b * 0.96;
    check("a quarter of it sells at the ask, the rest at the bid", !free.salesCap && few.salesCap && Math.abs(out(few).price - (ask / 4 + (3 * bid) / 4)) < 1e-6 && few.profitPerHour < free.profitPerHour, JSON.stringify(few.salesCap));
    const plenty = evaluateAction(action, who, data, marketPricer((hrid) => marketData[hrid]?.[0], data, "ask", () => null, sold(made * 2)));
    check("selling more than you make: the full price", !plenty.salesCap && out(plenty).price === ask);
    const shop = data.itemDetailMap[product].sellPrice;
    const now = evaluateAction(action, who, data, marketPricer((hrid) => (hrid === product ? { a: 3 * shop, b: 2 * shop } : marketData[hrid]?.[0]), data, "bid", () => null, sold(0)));
    check("selling now past the bids: the shop price", out(now).price === shop, `${out(now).price}`);
}

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
// With 12 hours of sales, how often it sells replaces how often the lowest ask moved.
const sales = (selling) => ({ sold: { enough: true, selling, perDay: 100 } });
check("sales in most hours: stable, though the ask stood still", liquidityRating(summary({ both: 1, spread: 0.02, activity: 0, ...sales(0.8) }, 0.01)).rating === "stable");
check("sales in a few hours: thin, though the ask moved a lot", liquidityRating(summary({ both: 1, spread: 0.02, activity: 0.9, ...sales(0.2) }, 0.01)).rating === "thin");
check("sales in some hours: ok", liquidityRating(summary({ both: 1, spread: 0.02, activity: 0.9, ...sales(0.5) }, 0.01)).rating === "ok");
check("too few hours of sales: the ask's moves still count", liquidityRating(summary({ both: 1, spread: 0.02, activity: 0.6, sold: { enough: false, selling: 0 } }, 0.01)).rating === "stable");
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
// No more than a day of sales, with what you hold counted in.
const selling = (perDay) => ({ ...stable, sold: { enough: true, perDay } });
const day = suggestCount(job, { stock: none, coins: 1e9, liquidity: selling(300), ...away });
check("a day of sales caps the job", day.count === 300 && day.cappedBySales && Math.abs(day.fill - 3 / 8) < 1e-9, JSON.stringify({ c: day.count, f: day.fill }));
const dayHeld = suggestCount(job, { stock: { inventory: 0, listed: 320, listings: [] }, coins: 1e9, liquidity: selling(300), ...away });
check("holding a day of sales means nothing to make", dayHeld.count === 0 && dayHeld.fill === 0, String(dayHeld.count));
const notYet = suggestCount(job, { stock: none, coins: 1e9, liquidity: { ...stable, sold: { enough: false, perDay: 10 } }, ...away });
check("too few hours of sales: no cap", notYet.count === 800 && !notYet.cappedBySales);
const poorStable = suggestCount(job, { stock: none, coins: 10000, liquidity: stable, ...away });
const poorThin = suggestCount(job, { stock: none, coins: 10000, liquidity: { rating: "thin", known: true }, ...away });
check("a stable market may use 60% of the coins", poorStable.limitedByCoins && poorStable.count === 120, String(poorStable.count));
check("a thin market only 10%", poorThin.limitedByCoins && poorThin.count === 20, String(poorThin.count));
const active = suggestCount(job, { stock: none, coins: 10000, liquidity: stable, ...PLAN_MODES.active });
check("active: 1 h jobs and more of the coins", active.count === 100 && active.plannedHours === 1, String(active.count));
// With a plan, the focus scale is what the planned hours give within the coins:
// with little coins, a craft that loses gold doesn't top a 90%-gold list on its XP.
{
    const who = skillingCharacter(character, items, data);
    const plan = { ...PLAN_MODES.active, stock: () => none, book: () => null, coins: 20000, have: () => 0, liquidity: () => ({ rating: "stable", known: true }) };
    // One craft worth a fortune that the coins can't buy materials for (like Chrono Gloves).
    const rich = Object.values(data.actionDetailMap).find((a) => a.type === "/action_types/tailoring" && a.inputItems?.length && a.levelRequirement.level <= 20 && a.hrid !== "/actions/tailoring/rough_leather");
    const prices = { ...marketData, [rich.outputItems[0].itemHrid]: { 0: { a: 5e9, b: 4e9 } } };
    for (const input of rich.inputItems) prices[input.itemHrid] = { 0: { a: 1e6, b: 9e5 } };
    const richMarket = marketPricer((hrid) => prices[hrid]?.[0], data, "ask");
    const list = rankSkilling(who, data, richMarket, { skill: "tailoring", goldWeight: 0.9, plan }).available.filter((e) => e.valid);
    const firstPaying = list.findIndex((e) => e.goldPerDay > 0 && (e.suggestion?.fill ?? 1) > 0);
    const firstLosing = list.findIndex((e) => e.goldPerDay < 0);
    const top = Math.max(...list.map((e) => e.score));
    const richEntry = list.find((e) => e.hrid === rich.hrid);
    check("an action the coins can't carry doesn't set the focus scale", top > 0.5 && richEntry?.goldPerDay > 1e9 && richEntry.suggestion.fill === 0, `${top} ${rich.hrid} ${richEntry?.goldPerDay} ${richEntry?.suggestion?.fill}`);
    check("a losing craft ranks under paying ones at 90% gold", firstPaying >= 0 && (firstLosing < 0 || firstPaying < firstLosing), `${list[0]?.action.name} ${firstPaying} ${firstLosing}`);
}

// A craft that loses gold is planned within the coins too.
const losing = suggestCount({ ...job, profitPerHour: -500, revenuePerAction: 40 }, { stock: none, coins: 10000, liquidity: stable, ...away });
check("a losing craft is limited by the coins too", losing && losing.count === 120 && losing.limitedByCoins && losing.batch.profit < 0, JSON.stringify(losing && { c: losing.count, p: losing.batch.profit }));

// The materials to buy: their markets rate the job too, and a fresh order book caps it.
const thinInput = (hrid) => ({ liquidity: hrid === "/items/x" ? { rating: "thin", known: true } : stable, book: null });
const byInput = suggestCount(job, { stock: none, coins: 10000, liquidity: stable, inputMarket: thinInput, ...away });
check("a thin material market sets the coins", byInput.count === 20 && byInput.ratedBy === "/items/x" && byInput.liquidity.rating === "thin" && byInput.productLiquidity.rating === "stable", JSON.stringify({ c: byInput.count, r: byInput.ratedBy }));
const owned = suggestCount(job, { stock: none, coins: 10000, liquidity: stable, inputMarket: thinInput, have: (h) => (h === "/items/x" ? 1000 : 0), ...away });
check("a material you hold enough of doesn't rate the job", owned.ratedBy === null && owned.count === 800, JSON.stringify({ c: owned.count, r: owned.ratedBy }));
const now = Date.now();
const book = (at) => ({ at, asks: [{ price: 50, quantity: 60 }, { price: 52, quantity: 40 }, { price: 80, quantity: 1000 }], bids: [] });
const booked = suggestCount(job, { stock: none, coins: 1e9, liquidity: stable, inputMarket: () => ({ liquidity: stable, book: book(now - 3600000) }), have: (h) => (h === "/items/x" ? 30 : 0), now, ...away });
check("a fresh material order book caps the job", booked.count === 130 && booked.limitedByBook === "/items/x" && booked.inputs[0].nearAsks === 100 && booked.inputs[0].toBuy === 100, JSON.stringify({ c: booked.count, i: booked.inputs }));
const stale = suggestCount(job, { stock: none, coins: 1e9, liquidity: stable, inputMarket: () => ({ liquidity: stable, book: book(now - 13 * 3600000) }), now, ...away });
check("an old material order book doesn't", stale.count === 800 && stale.limitedByBook === null && stale.inputs[0].bookAt === null);

// The whole chain in the planned hours, with what it still buys within the coins.
const chain = { profitPerHour: 2000, hoursPerAction: 0.04, cashPerAction: 10, bought: ["/items/y"] };
const chained = suggestChainCount(job, chain, { stock: { inventory: 20, listed: 0, listings: [] }, coins: 1e9, liquidity: stable, ...away });
check("chain: the planned hours for the whole chain, less stock", chained.count === 180 && Math.abs(chained.hours - 7.2) < 1e-9 && chained.cash === 1800, JSON.stringify(chained));
const chainPoor = suggestChainCount(job, chain, { stock: none, coins: 1000, liquidity: stable, inputMarket: () => ({ liquidity: { rating: "thin", known: true } }), ...away });
check("chain: what it buys within the coins of its thinnest market", chainPoor.count === 10 && chainPoor.limitedByCoins && chainPoor.ratedBy === "/items/y", JSON.stringify(chainPoor));

// Upgrades: payback counts selling it again at the bid; each +level shows its step over the next lower one.
const needleOffers = [{ enhancementLevel: 0, price: 1000, bid: 800 }, { enhancementLevel: 3, price: 3000, bid: 2000 }, { enhancementLevel: 5, price: 9000, bid: null }];
const ups = rankUpgrades(skillingCharacter(character, items, data), data, market, "tailoring", { equipped: {}, owned: {}, houseLevels: {}, listings: (hrid) => (hrid === "/items/azure_needle" ? needleOffers : []), actionHrid: "/actions/tailoring/rough_leather" });
const needle = (level) => ups.upgrades.find((u) => u.itemHrid === "/items/azure_needle" && u.enhancementLevel === level);
const n0 = needle(0), n3 = needle(3), n5 = needle(5);
check("upgrades measured on the action given", ups.base.action.hrid === "/actions/tailoring/rough_leather", ups.base?.action.hrid);
check("payback after resale at the bid", n0 && Math.abs(n0.cost - (1000 - 800 * 0.96)) < 1e-9 && Math.abs(n0.paybackDays - n0.cost / n0.gainPerDay) < 1e-12, JSON.stringify(n0 && { c: n0.cost, d: n0.paybackDays }));
check("no bid: resale at the vendor price", n5 && Math.abs(n5.resale - data.itemDetailMap["/items/azure_needle"].sellPrice) < 1e-9 && n5.resaleLevel === null && n0.resaleLevel === 0);
// Nobody buys +5, but someone buys +4 (with nothing listed there): that bid is the floor.
const needleBids = [{ enhancementLevel: 0, bid: 800 }, { enhancementLevel: 3, bid: 2000 }, { enhancementLevel: 4, bid: 2500 }];
const upsBids = rankUpgrades(skillingCharacter(character, items, data), data, market, "tailoring", { equipped: {}, owned: {}, houseLevels: {}, listings: (hrid) => (hrid === "/items/azure_needle" ? needleOffers : []), bids: (hrid) => (hrid === "/items/azure_needle" ? needleBids : []), actionHrid: "/actions/tailoring/rough_leather" });
const b5 = upsBids.upgrades.find((u) => u.itemHrid === "/items/azure_needle" && u.enhancementLevel === 5);
check("no bid at its +level: the nearest lower level's bid", b5 && Math.abs(b5.resale - 2500 * 0.96) < 1e-9 && b5.resaleLevel === 4 && Math.abs(b5.cost - (9000 - 2500 * 0.96)) < 1e-9, JSON.stringify(b5 && { r: b5.resale, l: b5.resaleLevel }));
check("a +level's step over the next lower one", n5?.step && n5.step.from === 3 && n5.step.price === 6000 && Math.abs(n5.step.gainPerDay - (n5.gainPerDay - n3.gainPerDay)) < 1e-6 && !n0.step, JSON.stringify(n5?.step));

check("thin margin under 5%", thinMargin({ costPerAction: 1, profitPerHour: 1, margin: 0.03 }) && !thinMargin({ costPerAction: 1, profitPerHour: 1, margin: 0.2 }));
check("thin margin under the price's swing", thinMargin({ costPerAction: 1, profitPerHour: 1, margin: 0.08 }, 0.12) && !thinMargin({ costPerAction: 0, profitPerHour: 1, margin: 1 }, 0.5));

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
