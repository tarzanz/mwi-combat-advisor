// Price history the script collects itself. While the game is open the market
// file is fetched every 30 minutes; each item's ask and bid are kept as one
// point per hour for two weeks, then as one point per day (median, low, high)
// for a year. Stored in IndexedDB on the game's site, on this device only.
//
// "Usual" is a median, not a mean: a single odd listing (1 coin, 999M) hardly
// moves it. Hours count once however often they were sampled, and hours the
// game was closed are simply missing, so uneven sampling doesn't skew it.

const DB_NAME = "mwia-price-history";
const HOURLY = "hourly"; // { hour, a: Float32Array, b: Float32Array }, item i at index i
const DAILY = "daily"; // { day, a, b, aLow, aHigh, bLow, bHigh: Float32Array, n: Uint8Array }
const META = "meta"; // "items": [hrid, ...] (the index order), "last": the newest file's timestamp

export const HOURLY_DAYS = 14;
const DAILY_DAYS = 366;
const HOUR_MS = 3600 * 1000;
export const COLLECT_EVERY_MS = 30 * 60 * 1000;
// Above or below the usual price by more than this counts as unusual.
export const USUAL_BAND = 0.1;
// The 7-day median moving more than this from the week before is a trend.
const TREND_BAND = 0.05;
// A fair comparison needs at least this many hours over this many days.
export const MIN_HOURS = 12;
export const MIN_DAYS = 2;

// ---------- pure helpers (also used by the tests) ----------

// Weighted median of [value, weight] pairs; null when there are none.
export function median(pairs) {
    const list = pairs.filter(([v, w]) => Number.isFinite(v) && w > 0).sort((x, y) => x[0] - y[0]);
    const total = list.reduce((sum, [, w]) => sum + w, 0);
    if (!total) return null;
    let seen = 0;
    for (let i = 0; i < list.length; i++) {
        seen += list[i][1];
        if (seen * 2 > total) return list[i][0];
        if (seen * 2 === total) return (list[i][0] + list[i + 1][0]) / 2;
    }
    return list[list.length - 1][0];
}

// One day's points of one side -> [median, low, high, count].
function dayStats(values) {
    const finite = values.filter(Number.isFinite);
    if (!finite.length) return [NaN, NaN, NaN, 0];
    return [median(finite.map((v) => [v, 1])), Math.min(...finite), Math.max(...finite), finite.length];
}

// Turns whole days of hourly records into daily records.
export function rollUpDays(hourlyRecords, itemCount) {
    const byDay = new Map();
    for (const record of hourlyRecords) {
        const day = Math.floor(record.hour / 24);
        if (!byDay.has(day)) byDay.set(day, []);
        byDay.get(day).push(record);
    }
    return [...byDay].map(([day, records]) => {
        const out = { day, a: new Float32Array(itemCount), b: new Float32Array(itemCount), aLow: new Float32Array(itemCount), aHigh: new Float32Array(itemCount), bLow: new Float32Array(itemCount), bHigh: new Float32Array(itemCount), n: new Uint8Array(itemCount) };
        for (let i = 0; i < itemCount; i++) {
            const [aMed, aLow, aHigh, an] = dayStats(records.map((r) => (i < r.a.length ? r.a[i] : NaN)));
            const [bMed, bLow, bHigh, bn] = dayStats(records.map((r) => (i < r.b.length ? r.b[i] : NaN)));
            out.a[i] = aMed;
            out.aLow[i] = aLow;
            out.aHigh[i] = aHigh;
            out.b[i] = bMed;
            out.bLow[i] = bLow;
            out.bHigh[i] = bHigh;
            out.n[i] = Math.max(an, bn);
        }
        return out;
    });
}

const at = (array, i) => (array && i < array.length ? array[i] : NaN);

// The usual price of one item from the records in memory: 7-day and 30-day
// medians of ask and bid, the trend of the 7-day median, and how much data it rests on.
export function summarize(i, hours, days, nowHour) {
    const side = (key) => {
        const week = [];
        const before = [];
        const month = [];
        for (const r of hours) {
            const v = at(r[key], i);
            if (!Number.isFinite(v)) continue;
            const age = nowHour - r.hour;
            if (age < 7 * 24) week.push([v, 1]);
            else if (age < 14 * 24) before.push([v, 1]);
            if (age < 30 * 24) month.push([v, 1]);
        }
        for (const d of days) {
            const v = at(d[key], i);
            if (Number.isFinite(v) && nowHour - (d.day * 24 + 12) < 30 * 24) month.push([v, at(d.n, i) || 1]);
        }
        const week7 = median(week);
        const previous = before.length >= MIN_HOURS ? median(before) : null;
        // Typical swing: half the week's prices lie within ± this share of the median.
        const swing = week7 ? median(week.map(([v, w]) => [Math.abs(v / week7 - 1), w])) : null;
        return { med7: week7, med30: median(month), trend: week7 && previous ? week7 / previous - 1 : null, swing };
    };
    let first = Infinity;
    let hours7 = 0;
    for (const r of hours) {
        if (!Number.isFinite(at(r.a, i)) && !Number.isFinite(at(r.b, i))) continue;
        first = Math.min(first, r.hour);
        if (nowHour - r.hour < 7 * 24) hours7++;
    }
    for (const d of days) if (at(d.n, i)) first = Math.min(first, d.day * 24);
    const spanDays = Number.isFinite(first) ? (nowHour - first) / 24 : 0;
    return { a: side("a"), b: side("b"), hours7, spanDays, enough: hours7 >= MIN_HOURS && spanDays >= MIN_DAYS };
}

// Every stored price as CSV, to read in a spreadsheet or hand to an AI. Hourly
// rows only where an item's ask or bid changed since its previous row, so the
// file stays small; the hours that have data are listed in the header.
export function historyCsv(items, hours, days, exportedAt = new Date()) {
    const num = (v) => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "");
    const hourText = (hour) => new Date(hour * HOUR_MS).toISOString().slice(0, 13);
    const dayText = (day) => new Date(day * 24 * HOUR_MS).toISOString().slice(0, 10);
    const id = (hrid) => hrid.replace(/^\/items\//, "");
    const lines = [
        `# MWI Combat Advisor price history, exported ${exportedAt.toISOString().slice(0, 16)}Z; saved while the game was open on one device.`,
        "# ask = lowest sell order, bid = best buy order, in coins; empty = none. Times are UTC.",
        `# section hour: an item's row appears when its ask or bid changed since its previous row (in between it stayed the same).`,
        `# Hours with data: ${hours.map((r) => hourText(r.hour)).join(",")}`,
        `# section day (older than ${HOURLY_DAYS} days): the day's median ask and bid, their low and high, and how many hours had data.`,
        "section,time,item,ask,bid,ask_low,ask_high,bid_low,bid_high,hours",
    ];
    const previous = new Map();
    for (const r of hours) {
        items.forEach((hrid, i) => {
            const pair = num(at(r.a, i)) + "," + num(at(r.b, i));
            if (previous.get(i) === pair || (!previous.has(i) && pair === ",")) return;
            previous.set(i, pair);
            lines.push(`hour,${hourText(r.hour)},${id(hrid)},${pair}`);
        });
    }
    for (const d of days) {
        items.forEach((hrid, i) => {
            if (!at(d.n, i)) return;
            lines.push(`day,${dayText(d.day)},${id(hrid)},${[d.a, d.b, d.aLow, d.aHigh, d.bLow, d.bHigh].map((list) => num(at(list, i))).join(",")},${at(d.n, i)}`);
        });
    }
    return { csv: lines.join("\n") + "\n", items: items.length, hours: hours.length, days: days.length };
}

// How a price compares with the usual one.
export function versusUsual(price, usual) {
    if (!(price > 0) || !(usual > 0)) return null;
    const diff = price / usual - 1;
    return { diff, label: diff > USUAL_BAND ? "above" : diff < -USUAL_BAND ? "below" : "near" };
}

export const trendArrow = (trend) => (trend === null ? "" : trend > TREND_BAND ? "↑" : trend < -TREND_BAND ? "↓" : "→");

// ---------- storage ----------

const store = {
    db: null,
    ready: null,
    items: [],
    index: new Map(),
    hours: [], // hourly records, oldest first
    days: [], // daily records of the last 30 days, oldest first
    allDays: null, // every daily record, loaded on demand
    last: null,
    version: 0, // bumps on every new snapshot
    summaries: new Map(),
};

const request = (req) => new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
});
const done = (tx) => new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
});

function openDb() {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            const db = req.result;
            db.createObjectStore(HOURLY, { keyPath: "hour" });
            db.createObjectStore(DAILY, { keyPath: "day" });
            db.createObjectStore(META);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

// Loads what is stored; safe to call more than once.
export function loadHistory() {
    store.ready ||= (async () => {
        store.db = await openDb();
        const tx = store.db.transaction([HOURLY, META], "readonly");
        const [items, last, hours] = await Promise.all([request(tx.objectStore(META).get("items")), request(tx.objectStore(META).get("last")), request(tx.objectStore(HOURLY).getAll())]);
        const newest = hours.length ? hours[hours.length - 1].hour : 0;
        store.days = await request(store.db.transaction(DAILY, "readonly").objectStore(DAILY).getAll(IDBKeyRange.lowerBound(Math.floor(newest / 24) - 31)));
        store.items = items || [];
        store.items.forEach((hrid, i) => store.index.set(hrid, i));
        store.last = last ?? null;
        store.hours = hours;
        store.version++;
    })();
    return store.ready;
}

// Adds one market file, in the hour it was fetched. A file already seen (same
// timestamp in the file) is skipped.
export async function recordSnapshot(marketData, timestamp) {
    await loadHistory();
    if (timestamp && timestamp === store.last) return false;
    const hour = Math.floor(Date.now() / HOUR_MS);
    for (const hrid of Object.keys(marketData)) {
        if (!store.index.has(hrid)) {
            store.index.set(hrid, store.items.length);
            store.items.push(hrid);
        }
    }
    const count = store.items.length;
    const record = { hour, a: new Float32Array(count).fill(NaN), b: new Float32Array(count).fill(NaN) };
    for (const [hrid, levels] of Object.entries(marketData)) {
        const entry = levels?.["0"];
        if (!entry) continue;
        const i = store.index.get(hrid);
        if (entry.a > 0) record.a[i] = entry.a;
        if (entry.b > 0) record.b[i] = entry.b;
    }
    // The newest point of an hour wins.
    store.hours = store.hours.filter((r) => r.hour !== hour);
    store.hours.push(record);
    store.hours.sort((x, y) => x.hour - y.hour);

    // Whole days older than two weeks become daily points.
    const newest = store.hours[store.hours.length - 1].hour;
    const cutoffDay = Math.floor((newest - HOURLY_DAYS * 24) / 24);
    const old = store.hours.filter((r) => Math.floor(r.hour / 24) < cutoffDay);
    const rolled = old.length ? rollUpDays(old, count) : [];
    store.hours = store.hours.filter((r) => Math.floor(r.hour / 24) >= cutoffDay);
    store.days = [...store.days, ...rolled].filter((d) => d.day >= Math.floor(newest / 24) - 31).sort((x, y) => x.day - y.day);
    if (store.allDays) store.allDays = [...store.allDays, ...rolled].sort((x, y) => x.day - y.day);

    const tx = store.db.transaction([HOURLY, DAILY, META], "readwrite");
    tx.objectStore(HOURLY).put(record);
    for (const r of old) tx.objectStore(HOURLY).delete(r.hour);
    for (const d of rolled) tx.objectStore(DAILY).put(d);
    tx.objectStore(DAILY).delete(IDBKeyRange.upperBound(Math.floor(newest / 24) - DAILY_DAYS, true));
    tx.objectStore(META).put(store.items, "items");
    tx.objectStore(META).put(timestamp ?? null, "last");
    await done(tx);
    store.last = timestamp ?? null;
    store.version++;
    store.summaries.clear();
    return true;
}

// Bumps when new prices are recorded (for caches that depend on the history).
export const historyVersion = () => store.version;

// The usual price of an item, or null before any data exists for it.
export function priceSummary(itemHrid) {
    if (!store.hours.length) return null;
    const i = store.index.get(itemHrid);
    if (i === undefined) return null;
    if (!store.summaries.has(itemHrid)) {
        store.summaries.set(itemHrid, summarize(i, store.hours, store.days, store.hours[store.hours.length - 1].hour));
    }
    return store.summaries.get(itemHrid);
}

// Every daily record, for long views (read once, then kept).
export async function loadAllDays() {
    await loadHistory();
    if (!store.allDays) {
        const tx = store.db.transaction(DAILY, "readonly");
        store.allDays = await request(tx.objectStore(DAILY).getAll());
    }
    return store.allDays;
}

// Points of one item for a chart: hourly where kept, daily before that.
// range: days back. Each point { t: hour, a, b }.
export async function priceSeries(itemHrid, range) {
    await loadHistory();
    const i = store.index.get(itemHrid);
    if (i === undefined || !store.hours.length) return [];
    const newest = store.hours[store.hours.length - 1].hour;
    const days = range > 31 ? await loadAllDays() : store.days;
    const points = [];
    for (const d of days) {
        const t = d.day * 24 + 12;
        if (newest - t <= range * 24) points.push({ t, a: at(d.a, i), b: at(d.b, i) });
    }
    for (const r of store.hours) if (newest - r.hour <= range * 24) points.push({ t: r.hour, a: at(r.a, i), b: at(r.b, i) });
    return points.filter((p) => Number.isFinite(p.a) || Number.isFinite(p.b)).sort((x, y) => x.t - y.t);
}

// Long-range medians (90 days and a year) from the daily points.
export async function longMedians(itemHrid) {
    const i = store.index.get(itemHrid);
    if (i === undefined) return null;
    const days = await loadAllDays();
    const newestDay = days.length ? days[days.length - 1].day : 0;
    const pick = (key, span) => median(days.filter((d) => newestDay - d.day < span).map((d) => [at(d[key], i), at(d.n, i) || 1]));
    return { a90: pick("a", 90), b90: pick("b", 90), a365: pick("a", 365), b365: pick("b", 365), days: days.filter((d) => at(d.n, i)).length };
}

// The whole history as CSV (see historyCsv).
export async function exportHistory() {
    await loadHistory();
    const days = await loadAllDays();
    return historyCsv(store.items, store.hours, days);
}
