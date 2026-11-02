// Checks the job results' arithmetic without a browser: made and used priced,
// your buy orders as cost (oldest first), and where the result differs from
// the advice.
// Usage: node test/job-ledger-test.mjs
import { dryLedger, emptyLedger, giveBackLots, jobReport, keyOf, noteFills, runningAction } from "../src/job-ledger.js";

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

const SHOOTER = "/items/gobo_shooter";
const ESSENCE = "/items/gobo_essence";
const CATALYST = "/items/catalyst_of_decomposition";
const COIN = "/items/coin";
const S = keyOf(SHOOTER), E = keyOf(ESSENCE), C = keyOf(CATALYST);
// The advice: one Shooter a try and 250 coins, 72% success: 700 essence and a catalyst on success.
const forecast = {
    name: "Decompose Gobo Shooter", actionsPerHour: 400, teaPerHour: 4000, margin: null,
    inputs: [{ itemHrid: SHOOTER, count: 1, price: 110000 }, { itemHrid: COIN, count: 250, price: 1 }, { itemHrid: CATALYST, count: 0.72, price: 5000, catalyst: true }],
    outputs: [{ itemHrid: ESSENCE, count: 0.72 * 700, price: 230 }],
};
const revenuePerAction = 0.72 * 700 * 230;
forecast.profitPerAction = revenuePerAction - 110000 - 250 - 0.72 * 5000 - forecast.teaPerHour / forecast.actionsPerHour;
forecast.profitPerHour = forecast.profitPerAction * forecast.actionsPerHour;
forecast.margin = forecast.profitPerHour / (forecast.actionsPerHour * revenuePerAction);
const prices = { value: (hrid) => (hrid === ESSENCE ? 240 : 0), cost: (hrid) => ({ [SHOOTER]: 110000, [CATALYST]: 5000 })[hrid] ?? 0 };

check("the running action: the queue's first, not a fight", runningAction([{ id: 1, actionHrid: "/actions/combat/fly" }]) === null && runningAction([{ id: 2, actionHrid: "/actions/alchemy/decompose" }]).id === 2);

// 10 tries in 90 s: 8 succeed (5,600 essence, 8 catalysts used).
{
    const L = emptyLedger(0);
    const job = { id: 7, name: "Decompose Gobo Shooter", actionHrid: "/actions/alchemy/decompose", endedAt: 90000, actions: 10, hours: 90 / 3600, deltas: { [E]: 5600, [S]: -10, [keyOf(COIN)]: -2500, [C]: -8 }, forecast };
    const r = jobReport(L, job, prices, 100000);
    const revenue = 5600 * 240;
    const teas = 4000 * r.hours;
    check("made and used", r.made.length === 1 && r.made[0].qty === 5600 && r.used.find((u) => u.itemHrid === SHOOTER).qty === 10 && r.used.find((u) => u.itemHrid === CATALYST).qty === 8 && r.used.find((u) => u.itemHrid === COIN).total === 2500, JSON.stringify(r.used));
    check("profit, margin and per hour", near(r.revenue, revenue) && near(r.profit, revenue - 10 * 110000 - 2500 - 8 * 5000 - teas) && near(r.margin, r.profit / revenue) && near(r.perHour, r.profit / r.hours) && near(r.actionsPerHour, 400));
    const f = r.forecast;
    const sum = Object.values(f.parts).reduce((a, b) => a + b, 0);
    check("against the advice: the parts add up to the difference", near(f.profit + sum, r.profit, 1e-9), JSON.stringify({ e: f.profit, p: f.parts, r: r.profit }));
    check("…luck: 8 successes for 7.2 expected; price: 240 for 230", f.actions === 10 && near(f.parts.yield, (5600 - 5040) * 240) && near(f.parts.prices, 5040 * 10) && near(f.parts.usage, -(8 - 7.2) * 5000) && near(f.parts.bought, 0), JSON.stringify(f.parts));
    check("a report keeps when it was priced", r.pricedAt === 100000 && r.endedAt === 90000);
}

// Your buy orders as cost: 6 bought at once up the book, 4 at the order's price later.
{
    const L = emptyLedger(0);
    const book = () => [{ price: 100000, quantity: 2 }, { price: 104000, quantity: 3 }, { price: 108000, quantity: 10 }];
    const order = (filled) => [{ id: 99, itemHrid: SHOOTER, enhancementLevel: 0, isSell: false, price: 110000, orderQuantity: 10, filledQuantity: filled }];
    noteFills(L, order(0), { now: 600000, live: true, bookOf: book });
    noteFills(L, order(6), { now: 630000, live: true, bookOf: book });
    noteFills(L, order(10), { now: 4000000, live: true, bookOf: book });
    const instant = L.lots[0];
    check("bought at once: priced up the order book", instant.qty === 6 && near(instant.unit, (2 * 100000 + 3 * 104000 + 108000) / 6) && instant.estimate, JSON.stringify(instant));
    check("filled later: at the order's price", L.lots[1].qty === 4 && L.lots[1].unit === 110000 && !L.lots[1].estimate);
    const job = { id: 8, name: "x", actionHrid: "/actions/alchemy/decompose", endedAt: 5000000, actions: 8, hours: 0.02, deltas: { [S]: -8, [E]: 4000 }, forecast: null };
    const r = jobReport(L, job, prices);
    const shooter = r.used.find((u) => u.itemHrid === SHOOTER);
    check("used: your oldest lots first", shooter.bought === 8 && near(shooter.total, 2 * 100000 + 3 * 104000 + 108000 + 2 * 110000) && L.lots[1].left === 2 && shooter.boughtEstimate, JSON.stringify({ shooter, lots: L.lots }));
    const more = jobReport(L, { ...job, deltas: { [S]: -5 } }, prices);
    const rest = more.used[0];
    check("past your lots: the rest at the market", rest.bought === 2 && near(rest.total, 2 * 110000 + 3 * 110000) && !more.forecast, JSON.stringify(rest));
    // A running job's result so far uses a copy of the lots; a result worked out again gives back what it took.
    const before = L.lots.map((l) => l.left).join();
    jobReport(dryLedger(L), { ...job, deltas: { [S]: -2 } }, prices);
    check("a result so far uses no lots", L.lots.map((l) => l.left).join() === before);
    giveBackLots(L, more.took);
    giveBackLots(L, r.took);
    check("given back: every lot whole again", L.lots.every((l) => l.left === l.qty) && r.took.length === 2 && more.took.length === 1, JSON.stringify({ lots: L.lots, took: [r.took, more.took] }));
    // An order already filled when the log starts isn't priced up the book.
    const fresh = emptyLedger(0);
    noteFills(fresh, order(5), { now: 1000, live: false, bookOf: book });
    check("an old order's fills: at its price", fresh.lots[0].unit === 110000 && !fresh.lots[0].estimate);
    noteFills(fresh, [{ id: 5, itemHrid: SHOOTER, isSell: true, price: 1, filledQuantity: 3 }], { now: 2000, live: true });
    check("sell orders aren't lots", fresh.lots.length === 1);
}

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
