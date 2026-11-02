// Checks the job log's arithmetic without a browser: live actions, a gap read
// from the inventory, missed actions, your buy orders as cost, and where the
// result differs from the advice.
// Usage: node test/job-ledger-test.mjs
import { emptyLedger, endJob, jobReport, keyOf, noteAction, noteFills, noteOther, noteReturn, runningAction, startJob } from "../src/job-ledger.js";

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps * Math.max(1, Math.abs(b));

const SHOOTER = "/items/gobo_shooter";
const ESSENCE = "/items/gobo_essence";
const CATALYST = "/items/catalyst_of_decomposition";
const S = keyOf(SHOOTER), E = keyOf(ESSENCE), C = keyOf(CATALYST);
// The advice: one Shooter a try, 72% success: 700 essence and a catalyst on success.
const forecast = {
    name: "Decompose Gobo Shooter", actionsPerHour: 400, teaPerHour: 4000, margin: null,
    inputs: [{ itemHrid: SHOOTER, count: 1, price: 110000 }, { itemHrid: CATALYST, count: 0.72, price: 5000, catalyst: true }],
    outputs: [{ itemHrid: ESSENCE, count: 0.72 * 700, price: 230 }],
};
forecast.profitPerAction = 0.72 * 700 * 230 - 110000 - 0.72 * 5000 - forecast.teaPerHour / forecast.actionsPerHour;
forecast.profitPerHour = forecast.profitPerAction * forecast.actionsPerHour;
forecast.margin = forecast.profitPerHour / (forecast.actionsPerHour * 0.72 * 700 * 230);
const prices = { value: (hrid) => (hrid === ESSENCE ? 240 : 0), cost: (hrid) => ({ [SHOOTER]: 110000, [CATALYST]: 5000 })[hrid] ?? 0 };
const action = { id: 7, actionHrid: "/actions/alchemy/decompose", primaryItemHash: `1::/item_locations/inventory::${SHOOTER}::0`, hasMaxCount: true, maxCount: 10, currentCount: 0 };

check("the running action skips fights", runningAction([{ id: 1, actionHrid: "/actions/combat/fly" }]) === null && runningAction([action]) === action);

// 10 tries seen live, one every 9 s: 8 succeed (essence and a catalyst), 2 fail.
{
    const L = emptyLedger(0);
    const job = startJob(action, { now: 0, inv: { [S]: 10, [C]: 10 }, forecast });
    for (let i = 1; i <= 10; i++) {
        const ok = i <= 8;
        noteAction(job, [{ key: S, delta: -1 }, ...(ok ? [{ key: E, delta: 700 }, { key: C, delta: -1 }] : [])], { now: i * 9000, count: i });
    }
    endJob(job, { now: 95000, seen: true });
    const r = jobReport(L, job, prices);
    const revenue = 8 * 700 * 240;
    const teas = 4000 * r.hours;
    check("live: made and used", r.actions === 10 && r.made.length === 1 && r.made[0].qty === 5600 && r.used.find((u) => u.itemHrid === SHOOTER).qty === 10 && r.used.find((u) => u.itemHrid === CATALYST).qty === 8, JSON.stringify(r.used));
    check("live: the time from first to last action plus a cycle", near(r.hours, (81000 + 9000) / 3600000) && r.timeFrom === "seen", String(r.hours * 3600));
    check("live: profit and margin", near(r.revenue, revenue) && near(r.profit, revenue - 10 * 110000 - 8 * 5000 - teas) && near(r.margin, r.profit / revenue));
    const f = r.forecast;
    const sum = Object.values(f.parts).reduce((a, b) => a + b, 0);
    check("against the advice: the parts add up to the difference", near(f.profit + sum, r.profit, 1e-9), JSON.stringify({ e: f.profit, p: f.parts, r: r.profit }));
    check("…luck: 8 successes for 7.2 expected; price: 240 for 230", f.actions === 10 && near(f.parts.yield, (5600 - 5040) * 240) && near(f.parts.prices, 5040 * 10) && near(f.parts.usage, -(8 - 7.2) * 5000), JSON.stringify(f.parts));
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
    const job = startJob(action, { now: 0, inv: {}, forecast: null });
    for (let i = 1; i <= 8; i++) noteAction(job, [{ key: S, delta: -1 }, { key: E, delta: 500 }], { now: i * 9000, count: i });
    endJob(job, { now: 80000, seen: true });
    const r = jobReport(L, job, prices);
    const shooter = r.used.find((u) => u.itemHrid === SHOOTER);
    check("used: your oldest lots first", shooter.bought === 8 && near(shooter.total, 2 * 100000 + 3 * 104000 + 108000 + 2 * 110000) && L.lots.filter((l) => l.left > 0).length === 1 && L.lots[1].left === 2, JSON.stringify({ shooter, lots: L.lots }));
    // An order already filled when the log starts isn't priced up the book.
    const fresh = emptyLedger(0);
    noteFills(fresh, order(5), { now: 1000, live: false, bookOf: book });
    check("an old order's fills: at its price", fresh.lots[0].unit === 110000 && !fresh.lots[0].estimate);
    noteFills(fresh, [{ id: 5, itemHrid: SHOOTER, isSell: true, price: 1, filledQuantity: 3 }], { now: 2000, live: true });
    check("sell orders aren't lots", fresh.lots.length === 1);
}

// The page slept: 3 live, then the game came back with the job still running, 5 more done.
{
    const L = emptyLedger(0);
    const job = startJob(action, { now: 0, inv: { [S]: 10, [C]: 10 }, forecast });
    for (let i = 1; i <= 3; i++) noteAction(job, [{ key: S, delta: -1 }, { key: E, delta: 700 }, { key: C, delta: -1 }], { now: i * 9000, count: i });
    // A market claim while watching: not the job's.
    noteOther(job, [{ key: S, delta: 20 }]);
    const inv = { [S]: 27 - 5, [C]: 7 - 4, [E]: 2100 + 4 * 700 };
    const back = noteReturn(job, { inv, queue: [{ ...action, currentCount: 8 }], now: 200000 });
    check("came back, still running: the gap from the inventory", back === "running" && job.gap === 5 && job.gapDeltas[S] === -5 && job.gapDeltas[E] === 2800 && job.gapDeltas[C] === -4 && job.missed === 0, JSON.stringify(job.gapDeltas));
    for (let i = 9; i <= 10; i++) noteAction(job, [{ key: S, delta: -1 }], { now: 200000 + (i - 8) * 9000, count: i });
    endJob(job, { now: 230000, seen: true });
    const r = jobReport(L, job, prices);
    check("…all 10 counted, the time at the speed seen", r.actions === 10 && r.live === 5 && r.gap === 5 && r.timeFrom === "speed" && r.used.find((u) => u.itemHrid === SHOOTER).qty === 10, JSON.stringify({ a: r.actions, t: r.timeFrom }));
}

// It ended while the page slept and the next job already worked: not clean, the rest estimated.
{
    const L = emptyLedger(0);
    const job = startJob(action, { now: 0, inv: {}, forecast });
    for (let i = 1; i <= 5; i++) noteAction(job, [{ key: S, delta: -1 }, { key: E, delta: 504 }], { now: i * 9000, count: i });
    const next = { id: 8, actionHrid: "/actions/tailoring/gobo_leather", currentCount: 40 };
    const back = noteReturn(job, { inv: { [E]: 99999 }, queue: [next], now: 900000 });
    endJob(job, { now: 900000, seen: false });
    const r = jobReport(L, job, prices);
    check("ended unseen with another job after it: the rest like the live ones", back === "ended" && r.missed === 5 && r.missedFrom === "live" && r.made[0].qty === 5040 && r.used[0].qty === 10, JSON.stringify({ m: r.missed, made: r.made }));
    // Clean: it ended and nothing ran after it.
    const job2 = startJob(action, { now: 0, inv: { [S]: 10 }, forecast });
    noteAction(job2, [{ key: S, delta: -1 }, { key: E, delta: 700 }], { now: 9000, count: 1 });
    const back2 = noteReturn(job2, { inv: { [S]: 0, [E]: 700 + 6300 }, queue: [], now: 500000 });
    check("ended unseen, nothing after it: read from the inventory", back2 === "ended" && job2.gap === 9 && job2.gapDeltas[S] === -9 && job2.gapDeltas[E] === 6300, JSON.stringify(job2));
}

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
