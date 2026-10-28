// Checks the price-history maths without a browser: medians, daily roll-up,
// the usual price and trend of an item, and how a price compares with it.
// Usage: node test/price-history-test.mjs
import { DAILY_FIELDS, HOURLY_FIELDS, decodeRecords, encodeRecord, historyCsv, historyKey, median, rollUpDays, soldPerDay, summarize, versusUsual, trendArrow, MIN_HOURS } from "../src/price-history.js";
import { swingShare } from "../src/skilling.js";

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

check("median of an odd list", median([[3, 1], [1, 1], [2, 1]]) === 2);
check("median of an even list is the middle pair's mean", median([[1, 1], [2, 1], [3, 1], [10, 1]]) === 2.5);
check("weights count", median([[1, 5], [100, 1], [200, 1]]) === 1);
check("an odd outlier hardly moves it", median([[100, 1], [101, 1], [99, 1], [1, 1], [999999, 1]]) === 100);
check("nothing gives null", median([]) === null && median([[NaN, 1]]) === null);

// Item 0: ask 1000 / bid 800 for the last 7 days, ask 900 the week before; item 1 has no prices.
const now = 500000;
const hours = [];
for (let age = 13 * 24; age >= 0; age -= 3) {
    const ask = age < 7 * 24 ? 1000 : 900;
    hours.push({ hour: now - age, a: new Float32Array([ask, NaN]), b: new Float32Array([800, NaN]) });
}
const s = summarize(0, hours, [], now);
check("7-day median", s.a.med7 === 1000 && s.b.med7 === 800, JSON.stringify(s.a));
check("trend compares with the week before", Math.abs(s.a.trend - (1000 / 900 - 1)) < 1e-6 && trendArrow(s.a.trend) === "↑" && trendArrow(s.b.trend) === "→");
check("coverage", s.hours7 === 56 && s.spanDays >= 13 && s.enough, JSON.stringify({ h: s.hours7, d: s.spanDays }));
const empty = summarize(1, hours, [], now);
check("an item without prices has nothing", empty.a.med7 === null && !empty.enough);
const thin = summarize(0, hours.slice(-3), [], now);
check("a few hours are not enough", !thin.enough && thin.hours7 < MIN_HOURS);

// Liquidity from prices alone: both sides, spread and how often the ask moves.
check("liquidity: steady ask, always both sides", s.liquidity.both === 1 && Math.abs(s.liquidity.spread - 0.2) < 1e-6 && s.liquidity.activity === 0 && s.liquidity.hours === 56, JSON.stringify(s.liquidity));
const lively = [];
for (let h = 0; h < 20; h++) lively.push({ hour: now - 19 + h, a: new Float32Array([h % 2 ? 100 : 101]), b: new Float32Array([h < 15 ? 98 : NaN]) });
const l = summarize(0, lively, [], now).liquidity;
check("liquidity: a moving ask and a missing buyer", l.hours === 20 && l.both === 0.75 && l.activity === 1 && l.spread > 0.02 && l.spread < 0.03, JSON.stringify(l));
check("liquidity: no prices, no rating", summarize(1, hours, [], now).liquidity.hours === 0);

// Roll-up: two days of hourly points -> two daily points with median, low, high, count.
const twoDays = [];
for (let hr = 24 * 100; hr < 24 * 102; hr++) twoDays.push({ hour: hr, a: new Float32Array([hr % 24 === 5 ? 5000 : 100]), b: new Float32Array([NaN]) });
const days = rollUpDays(twoDays, 1);
check("one daily point per day", days.length === 2 && days[0].day === 100 && days[1].day === 101);
check("daily median ignores the spike, low/high keep it", days[0].a[0] === 100 && days[0].aLow[0] === 100 && days[0].aHigh[0] === 5000 && days[0].n[0] === 24, JSON.stringify([days[0].a[0], days[0].aHigh[0], days[0].n[0]]));
check("a side without prices stays empty", Number.isNaN(days[0].b[0]));

// Daily points count with their weight in the 30-day median.
const monthHours = [{ hour: now, a: new Float32Array([2000]), b: new Float32Array([NaN]) }];
const monthDays = [{ day: Math.floor(now / 24) - 20, a: new Float32Array([1000]), b: new Float32Array([NaN]), n: new Uint8Array([24]) }];
check("30-day median weighs a daily point by its hours", summarize(0, monthHours, monthDays, now).a.med30 === 1000);

const above = versusUsual(1300, 1000);
check("above / below / near the usual price", above.label === "above" && Math.abs(above.diff - 0.3) < 1e-9 && versusUsual(850, 1000).label === "below" && versusUsual(1050, 1000).label === "near" && versusUsual(0, 1000) === null);

// Swing: half the week's prices within ± this share of the median.
const swingHours = [900, 1000, 1000, 1100, 1000, 800, 1200].map((ask, k) => ({ hour: now - k, a: new Float32Array([ask]), b: new Float32Array([NaN]) }));
check("typical swing of the week's prices", Math.abs(summarize(0, swingHours, [], now).a.swing - 0.1) < 1e-9 && s.b.swing === 0, String(summarize(0, swingHours, [], now).a.swing));

// How much of the batch a swinging price leaves.
check("a calm price keeps the whole batch", swingShare({ swing: 0.03, diff: 0 }).share === 1 && swingShare(null) === null);
check("a swinging price makes the batch smaller", Math.abs(swingShare({ swing: 0.15, diff: 0 }).share - 0.8) < 1e-9 && swingShare({ swing: 0.6, diff: 0 }).share === 0.4);
const high = swingShare({ swing: 0.15, diff: 0.2 });
check("high now on a swinging market halves it again", high.high && Math.abs(high.share - 0.4) < 1e-9 && !swingShare({ swing: 0.03, diff: 0.2 }).high);
check("low now is pointed out, not cut", swingShare({ swing: 0.03, diff: -0.2 }).low && swingShare({ swing: 0.03, diff: -0.2 }).share === 1);

// CSV export: hourly rows only where a price changed; what sold per day for the
// hourly days (only items that traded); daily rows with low/high/hours and what sold.
const csvHours = [
    { hour: 480000, a: new Float32Array([10, NaN]), b: new Float32Array([8, NaN]) },
    { hour: 480001, a: new Float32Array([10, 5]), b: new Float32Array([8, NaN]), p: new Float32Array([10, NaN]), v: new Float32Array([3, NaN]), sold: true },
    { hour: 480002, a: new Float32Array([11, 5]), b: new Float32Array([8, NaN]), p: new Float32Array([NaN, NaN]), v: new Float32Array([NaN, NaN]), sold: true },
];
const csvDays = [
    { day: 19990, a: new Float32Array([9, NaN]), b: new Float32Array([7, NaN]), aLow: new Float32Array([8, NaN]), aHigh: new Float32Array([12, NaN]), bLow: new Float32Array([6, NaN]), bHigh: new Float32Array([7.5, NaN]), n: new Uint8Array([20, 0]) },
    { day: 19991, a: new Float32Array([9, 4]), b: new Float32Array([7, NaN]), aLow: new Float32Array([8, 4]), aHigh: new Float32Array([12, 4]), bLow: new Float32Array([6, NaN]), bHigh: new Float32Array([7.5, NaN]), n: new Uint8Array([20, 5]), p: new Float32Array([9.5, NaN]), v: new Float32Array([2.25, 0]), vn: new Uint8Array([20, 20]) },
];
const out = historyCsv(["/items/a", "/items/b"], csvHours, csvDays, new Date(0));
const rows = out.csv.trim().split("\n").filter((l) => !l.startsWith("#"));
const hour = (h) => new Date(h * 3600000).toISOString().slice(0, 13);
const day = (d) => new Date(d * 86400000).toISOString().slice(0, 10);
check("CSV export", JSON.stringify(rows) === JSON.stringify([
    "section,time,item,ask,bid,ask_low,ask_high,bid_low,bid_high,hours,sold_mean,sold_hours,sold_price",
    `hour,${hour(480000)},a,10,8`,
    `hour,${hour(480001)},b,5,`,
    `hour,${hour(480002)},a,11,8`,
    `sold,${day(20000)},a,,,,,,,,1.5,2,10`,
    `day,${day(19990)},a,9,7,8,12,6,7.5,20,,,`,
    `day,${day(19991)},a,9,7,8,12,6,7.5,20,2.25,20,9.5`,
    `day,${day(19991)},b,4,,4,4,,,5,0,20,`,
]) && out.csv.includes(`# Hours with data: ${hour(480000)},${hour(480001)},${hour(480002)}`), JSON.stringify(rows));

// Stored as changes: three days of hours, prices that mostly stand still, an
// item added on day two, one old full record first – read back exactly.
const sameArrays = (x, y) => x.length === y.length && [...x].every((v, i) => v === y[i] || (Number.isNaN(v) && Number.isNaN(y[i])));
const sameRecords = (xs, ys, fields) => xs.length === ys.length && xs.every((x, k) => fields.every((f) => {
    const n = Math.max(x[f]?.length || 0, ys[k][f]?.length || 0);
    const pad = (arr = []) => Array.from({ length: n }, (_, i) => (i < arr.length ? arr[i] : f === "n" || f === "vn" ? 0 : NaN));
    return sameArrays(pad(x[f]), pad(ys[k][f]));
}));
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const raw = [];
for (let h = 0; h < 72; h++) {
    const count = h < 24 ? 50 : 60;
    const a = new Float32Array(count).fill(NaN);
    const b = new Float32Array(count).fill(NaN);
    for (let i = 0; i < count; i++) {
        if (i % 5 === 4) continue; // never traded
        a[i] = i < 10 ? 1000 + Math.floor(rand() * 50) : 5000 + i + (h > 40 && i % 3 === 0 ? 7 : 0); // 10 lively, the rest still
        if (i % 2 === 0) b[i] = a[i] * 0.9;
    }
    // From the second day on the file also says how many were sold (v) and at what price (p).
    if (h < 24) raw.push({ hour: 480000 + h, a, b });
    else {
        const p = new Float32Array(count).fill(NaN);
        const v = new Float32Array(count).fill(NaN);
        for (let i = 0; i < 10; i++) if ((h + i) % 3) [p[i], v[i]] = [a[i], 1 + (i % 4)];
        raw.push({ hour: 480000 + h, a, b, p, v, sold: true });
    }
}
const dayKey = (r) => Math.floor(r.hour / 24);
const stored = raw.map((r, k) => (k === 0 ? r : encodeRecord(r, raw[k - 1], HOURLY_FIELDS, dayKey)));
check("hours read back exactly", sameRecords(decodeRecords(stored, HOURLY_FIELDS), raw, HOURLY_FIELDS));
check("each day starts with a key record", stored.slice(1).every((r) => r.key === (dayKey(r) !== dayKey(raw[stored.indexOf(r) - 1]))));
const fromDay2 = stored.findIndex((r) => r.hour === 480000 + 24 - (480000 % 24) + 24);
check("read back from a later day's key record", fromDay2 > 0 && sameRecords(decodeRecords(stored.slice(fromDay2), HOURLY_FIELDS), raw.slice(fromDay2), HOURLY_FIELDS));
const kept = (list) => list.reduce((sum, r) => sum + (r.idx ? r.idx.length : r.a.length), 0);
const full = raw.slice(1).reduce((sum, r) => sum + r.a.length, 0);
check("still prices take little room", kept(stored.slice(1)) < full * 0.35, `${kept(stored.slice(1))} of ${full}`);
// Days: the same with low, high and the count of hours.
const daysRaw = rollUpDays(raw, 60).sort((x, y) => x.day - y.day);
const weekKey = (d) => Math.floor(d.day / 7);
const daysStored = daysRaw.map((d, k) => encodeRecord(d, daysRaw[k - 1] || null, DAILY_FIELDS, weekKey));
check("days read back exactly", daysRaw.length >= 3 && sameRecords(decodeRecords(daysStored, DAILY_FIELDS), daysRaw, DAILY_FIELDS) && daysStored[0].key);
// Sold a day: the mean of the hours that had the numbers (an item missing from one sold none), × 24.
const lastHour = raw[raw.length - 1].hour;
const sold0 = soldPerDay(0, raw, lastHour);
const expected0 = (raw.filter((r) => r.sold).reduce((sum, r) => sum + (Number.isFinite(r.v[0]) ? r.v[0] : 0), 0) / raw.filter((r) => r.sold).length) * 24;
check("sold a day from the hours with numbers", sold0.hours === 48 && Math.abs(sold0.perDay - expected0) < 1e-9 && sold0.enough && sold0.price > 0, JSON.stringify(sold0));
check("nothing sold reads as 0 a day, no numbers as unknown", soldPerDay(20, raw, lastHour).perDay === 0 && soldPerDay(0, raw.filter((r) => !r.sold), lastHour).perDay === null);
const day2 = daysRaw.find((d) => d.vn[0] > 0);
check("days keep the mean sold per hour", !!day2 && day2.vn[0] === 24 && day2.v[0] > 0 && daysRaw[0].vn[0] === 0, day2 ? `${day2.v[0]} ${day2.vn[0]}` : "none");
check("a +level has its own name", historyKey("/items/rainbow_pot", 2) === "/items/rainbow_pot+2" && historyKey("/items/rainbow_pot", 0) === "/items/rainbow_pot");

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
