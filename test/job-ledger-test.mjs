// Checks the job results' arithmetic without a browser: made and used priced,
// your buy orders as cost (oldest first), and where the result differs from
// the advice.
// Usage: node test/job-ledger-test.mjs
import { emptyLedger, groupHistory, jobGroup, jobReport, keepReport, keyOf, lotsLeft, markSent, mergeFromPi, noteFills, runningAction, unsentForPi } from "../src/job-ledger.js";

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

// Your buy orders as cost: 6 bought at once up the book, 4 at the order's price later – one purchase.
{
    const L = emptyLedger(0);
    const book = () => [{ price: 100000, quantity: 2 }, { price: 104000, quantity: 3 }, { price: 108000, quantity: 10 }];
    const order = (filled, id = 99) => [{ id, itemHrid: SHOOTER, enhancementLevel: 0, isSell: false, price: 110000, orderQuantity: 10, filledQuantity: filled }];
    noteFills(L, order(0), { now: 600000, live: true, bookOf: book });
    const atOnce = 2 * 100000 + 3 * 104000 + 108000;
    check("bought at once: priced up the order book", noteFills(L, order(6), { now: 630000, live: true, bookOf: book }) && near(L.purchases["99"].cost, atOnce) && L.purchases["99"].estimate, JSON.stringify(L.purchases));
    noteFills(L, order(10), { now: 4000000, live: true, bookOf: book });
    check("filled later: at the order's price, the same purchase", L.purchases["99"].filled === 10 && near(L.purchases["99"].cost, atOnce + 4 * 110000) && L.purchases["99"].at === 630000);
    check("…to be sent to the Pi", JSON.stringify(unsentForPi(L).purchases.map((x) => x.uid)) === '["99"]');
    const job = { id: 8, key: "8|a", name: "Decompose Gobo Shooter", actionHrid: "/actions/alchemy/decompose", item: SHOOTER, endedAt: 5000000, actions: 8, hours: 0.02, deltas: { [S]: -8, [E]: 4000 }, forecast: null };
    const r = jobReport(L, job, prices);
    const shooter = r.used.find((u) => u.itemHrid === SHOOTER);
    check("used: at what you paid a unit, on average over the order", shooter.bought === 8 && near(shooter.total, (8 * (atOnce + 4 * 110000)) / 10) && shooter.boughtEstimate, JSON.stringify(shooter));
    check("working a result out uses nothing up", lotsLeft(L)[0].left === 10);
    keepReport(L, job.key, r);
    check("a kept result uses up what it used", lotsLeft(L)[0].left === 2 && L.history[job.key].used[0][1] === 8);
    const second = jobReport(L, { ...job, key: "9|b", endedAt: 6000000, deltas: { [S]: -5 } }, prices);
    check("past your purchases: the rest at the market", second.used[0].bought === 2 && near(second.used[0].total, (2 * (atOnce + 4 * 110000)) / 10 + 3 * 110000), JSON.stringify(second.used[0]));
    check("worked out again: its own use left out", jobReport(L, job, prices).used.find((u) => u.itemHrid === SHOOTER).bought === 8);
    // A purchase seen filling after a job ended isn't what it used; one first seen as the game loaded may be.
    noteFills(L, order(0, 100), { now: 6900000, live: true });
    noteFills(L, order(5, 100), { now: 7000000, live: true });
    check("seen filling after the job ended: not used by it", jobReport(L, { ...job, key: "10|c", endedAt: 6500000, deltas: { [S]: -5 } }, prices).used[0].bought === 2);
    noteFills(L, order(5, 101), { now: 7000000, live: false });
    check("first seen as the game loaded: it may have filled before", jobReport(L, { ...job, key: "10|c", endedAt: 6500000, deltas: { [S]: -5 } }, prices).used[0].bought === 5);
    // An order already filled when the log starts isn't priced up the book; sell orders aren't purchases.
    const fresh = emptyLedger(0);
    noteFills(fresh, order(5), { now: 1000, live: false, bookOf: book });
    check("an old order's fills: at its price", fresh.purchases["99"].cost === 5 * 110000 && !fresh.purchases["99"].estimate);
    noteFills(fresh, [{ id: 5, itemHrid: SHOOTER, isSell: true, price: 1, filledQuantity: 3 }], { now: 2000, live: true });
    check("sell orders aren't purchases", Object.keys(fresh.purchases).length === 1);

    // Two devices through the Pi: the same purchases and results, the same use of them.
    const phone = emptyLedger(0);
    const pc = emptyLedger(0);
    noteFills(pc, order(10), { now: 600000, live: false });
    const fromPc = unsentForPi(pc);
    mergeFromPi(phone, { seq: 3, purchases: fromPc.purchases, reports: [] });
    check("a purchase made on another device counts here", phone.purchases["99"]?.filled === 10 && phone.piSeq === 3);
    // The phone sees fewer filled of it later: the Pi's (more filled) stays.
    noteFills(phone, order(6), { now: 700000, live: true });
    check("…and isn't counted twice when this device sees the order too", phone.purchases["99"].filled === 10 && phone.purchases["99"].cost === 10 * 110000);
    const onPhone = jobReport(phone, job, prices);
    keepReport(phone, job.key, onPhone);
    mergeFromPi(pc, { seq: 4, reports: unsentForPi(phone).reports, purchases: [] });
    check("a result from another device is kept and uses up the same", pc.history[job.key] && lotsLeft(pc)[0].left === lotsLeft(phone)[0].left && lotsLeft(pc)[0].left === 2);
    markSent(phone, { reports: [job.key], purchases: ["99"] });
    check("sent: nothing left for the Pi", unsentForPi(phone).reports.length === 0 && unsentForPi(phone).purchases.length === 0);
    // The Pi's result for an entry only replaces a kept one that saw less of the job.
    mergeFromPi(pc, { reports: [{ key: job.key, report: { ...onPhone, actions: 5 } }] });
    check("an older look at a job doesn't replace a newer one", pc.history[job.key].actions === 8);
    mergeFromPi(pc, { reports: [{ key: job.key, report: { ...onPhone, actions: 12, endedAt: 5100000 } }] });
    check("a newer one does", pc.history[job.key].actions === 12);

    // The history of a sort of job.
    const H = emptyLedger(0);
    const result = (key, endedAt, profit, revenue, hours, margin) => ({ key, name: "x", actionHrid: "/actions/alchemy/decompose", item: SHOOTER, endedAt, hours, actions: 1, revenue, profit, used: [], forecast: { margin } });
    keepReport(H, "a", result("a", 0, 100, 1000, 1, 0.12));
    keepReport(H, "b", result("b", 2 * 86400000, 300, 2000, 1, 0.1));
    keepReport(H, "c", { ...result("c", 86400000, 999, 999, 1, 0), item: ESSENCE });
    const g = groupHistory(H, jobGroup("/actions/alchemy/decompose", SHOOTER), "b");
    check("history: the same action and item only, without the job itself", g.jobs === 1 && g.profit === 100);
    const all = groupHistory(H, jobGroup("/actions/alchemy/decompose", SHOOTER));
    check("history: margin over all revenue, per hour over all hours, the expected margin on average", all.jobs === 2 && near(all.margin, 400 / 3000) && near(all.perHour, 200) && near(all.expectedMargin, 0.11) && near(all.days, 2));
}

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
