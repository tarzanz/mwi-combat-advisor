// Price history the script collects itself. While the game is open the market
// file is fetched every 30 minutes; each item's ask and bid – every +level on
// its own ("/items/rainbow_pot+2") – are kept as one point per hour for two
// weeks, then as one point per day (median, low, high) for a year. Stored in
// IndexedDB on the game's site, on this device only, keeping only what changed
// from one point to the next (see encodeRecord).
//
// "Usual" is a median, not a mean: a single odd listing (1 coin, 999M) hardly
// moves it. Hours count once however often they were sampled, and hours the
// game was closed are simply missing, so uneven sampling doesn't skew it.

const DB_NAME = "mwia-price-history";
const HOURLY = "hourly"; // { hour, a, b, p, v: Float32Array, sold: true }, item i at index i
const DAILY = "daily"; // { day, a, b, aLow, aHigh, bLow, bHigh, p, v: Float32Array, n, vn: Uint8Array }
const META = "meta"; // "items": [hrid, ...] (the index order), "last": the newest file's timestamp

export const HOURLY_DAYS = 14;
export const DAILY_DAYS = 366;
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

// The history's name for an item at a +level: the item itself at +0.
export const historyKey = (itemHrid, level = 0) => (level ? `${itemHrid}+${level}` : itemHrid);

// The market file also says, per item, how many were traded in its hour (v)
// and at what average price (p). A record with sold: true has them; an item
// missing from such an hour sold nothing. Days keep the mean sold per hour
// (v) over the vn hours that had the numbers.
export const HOURLY_FIELDS = ["a", "b", "p", "v"];
export const DAILY_FIELDS = ["a", "b", "aLow", "aHigh", "bLow", "bHigh", "n", "p", "v", "vn"];
const COUNTS = new Set(["n", "vn"]);
const hasValue = (v) => Number.isFinite(v) && v !== 0;
const same = (x, y) => x === y || (Number.isNaN(x) && Number.isNaN(y));
const emptyOf = (field, count) => (COUNTS.has(field) ? new Uint8Array(count) : new Float32Array(count).fill(NaN));
const fieldAt = (array, field, i) => (array && i < array.length ? array[i] : COUNTS.has(field) ? 0 : NaN);

// A record as stored: only the items whose values differ from the record
// before it (idx, and each field's values at those items). A key record – the
// first of its day (hours) or week (days), or one with nothing before it –
// keeps every item that has a value, so the store can be read from any key
// record on and old ones deleted a whole day or week at a time. Lossless.
export function encodeRecord(record, previous, fields, keyOf) {
    const count = Math.max(0, ...fields.map((f) => record[f]?.length || 0));
    const key = !previous || keyOf(previous) !== keyOf(record);
    const idx = [];
    for (let i = 0; i < count; i++) {
        const changed = key
            ? fields.some((f) => hasValue(fieldAt(record[f], f, i)))
            : fields.some((f) => !same(fieldAt(record[f], f, i), fieldAt(previous[f], f, i)));
        if (changed) idx.push(i);
    }
    const out = { count, key, idx: count < 65536 ? Uint16Array.from(idx) : Uint32Array.from(idx) };
    for (const [k, v] of Object.entries(record)) if (!fields.includes(k)) out[k] = v;
    for (const f of fields) {
        const values = emptyOf(f, idx.length);
        idx.forEach((i, j) => (values[j] = fieldAt(record[f], f, i)));
        out[f] = values;
    }
    return out;
}

// Stored records (oldest first, starting at a key record) back to full ones.
// Records from before this format (full arrays, no idx) are taken as they are.
export function decodeRecords(stored, fields) {
    const out = [];
    let previous = null;
    for (const s of stored) {
        if (!s.idx) {
            out.push(s);
            previous = s;
            continue;
        }
        const full = {};
        for (const [k, v] of Object.entries(s)) if (!fields.includes(k) && k !== "idx" && k !== "count" && k !== "key") full[k] = v;
        for (const f of fields) {
            const values = emptyOf(f, s.count);
            if (!s.key && previous) for (let i = 0; i < s.count; i++) values[i] = fieldAt(previous[f], f, i);
            // Records stored before a field existed (p, v) simply don't have it.
            if (s[f]) s.idx.forEach((i, j) => (values[i] = s[f][j]));
            full[f] = values;
        }
        out.push(full);
        previous = full;
    }
    return out;
}

export const dayOf = (r) => Math.floor(r.hour / 24);
export const weekOf = (d) => Math.floor(d.day / 7);

// In a list sorted by key, each record whose key is in dirty, and the one after
// it (its previous changed), encoded against the record before it.
export function encodeChanged(list, dirty, keyField, fields, keyOf) {
    const out = [];
    list.forEach((r, i) => {
        if (dirty.has(r[keyField]) || (i > 0 && dirty.has(list[i - 1][keyField]))) out.push(encodeRecord(r, list[i - 1] || null, fields, keyOf));
    });
    return out;
}

// One market file as an hourly record. Every +level that has an ask or a bid
// is an item of its own; new ones are added to items and index.
export function snapshotRecord(marketData, hour, items, index) {
    const entries = [];
    for (const [hrid, levels] of Object.entries(marketData)) {
        for (const [level, entry] of Object.entries(levels || {})) {
            if (!(entry?.a > 0) && !(entry?.b > 0) && !(entry?.v > 0) && level !== "0") continue;
            const key = historyKey(hrid, Number(level));
            if (!index.has(key)) {
                index.set(key, items.length);
                items.push(key);
            }
            entries.push([index.get(key), entry]);
        }
    }
    const count = items.length;
    const record = { hour, a: new Float32Array(count).fill(NaN), b: new Float32Array(count).fill(NaN), p: new Float32Array(count).fill(NaN), v: new Float32Array(count).fill(NaN), sold: true };
    for (const [i, entry] of entries) {
        if (entry?.a > 0) record.a[i] = entry.a;
        if (entry?.b > 0) record.b[i] = entry.b;
        if (entry?.p > 0) record.p[i] = entry.p;
        if (entry?.v > 0) record.v[i] = entry.v;
    }
    return record;
}

// Another store's item order (keys) as indexes into items; keys not yet known are added.
export function itemMap(keys, items, index) {
    return keys.map((key) => {
        if (!index.has(key)) {
            index.set(key, items.length);
            items.push(key);
        }
        return index.get(key);
    });
}

// A record over another store's items as one over count items of ours (map from itemMap).
export function remapRecord(record, map, count, fields) {
    const out = {};
    for (const [k, v] of Object.entries(record)) if (!fields.includes(k)) out[k] = v;
    for (const f of fields) {
        const values = emptyOf(f, count);
        const from = record[f];
        if (from) for (let j = 0; j < from.length && j < map.length; j++) values[map[j]] = from[j];
        out[f] = values;
    }
    return out;
}

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

// The value below which a share q of the weight lies (q = 0.5 is the median, without averaging); null when empty.
export function quantile(pairs, q) {
    const list = pairs.filter(([v, w]) => Number.isFinite(v) && w > 0).sort((x, y) => x[0] - y[0]);
    const total = list.reduce((sum, [, w]) => sum + w, 0);
    if (!total) return null;
    let seen = 0;
    for (const [v, w] of list) {
        seen += w;
        if (seen >= q * total) return v;
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
        const out = { day, a: new Float32Array(itemCount), b: new Float32Array(itemCount), aLow: new Float32Array(itemCount), aHigh: new Float32Array(itemCount), bLow: new Float32Array(itemCount), bHigh: new Float32Array(itemCount), n: new Uint8Array(itemCount), p: new Float32Array(itemCount), v: new Float32Array(itemCount), vn: new Uint8Array(itemCount) };
        const sold = records.filter((r) => r.sold);
        for (let i = 0; i < itemCount; i++) {
            out.p[i] = dayStats(sold.map((r) => at(r.p, i)))[0];
            out.v[i] = sold.length ? sold.reduce((sum, r) => sum + (Number.isFinite(at(r.v, i)) ? at(r.v, i) : 0), 0) / sold.length : NaN;
            out.vn[i] = sold.length;
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
        // q25/q75: the week's lower and upper quartile, for a patient buy or sell price.
        return { med7: week7, med30: median(month), trend: week7 && previous ? week7 / previous - 1 : null, swing, q25: quantile(week, 0.25), q75: quantile(week, 0.75) };
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
    return { a: side("a"), b: side("b"), hours7, spanDays, enough: hours7 >= MIN_HOURS && spanDays >= MIN_DAYS, liquidity: liquidity(i, hours, nowHour) };
}

// How lively the week's market was: the share of hours with both a buyer and
// a seller, the median spread between them, how often the lowest ask moved
// from one hour with data to the next – a sign that things sell and get
// relisted – and, where the file said so, how many were sold.
function liquidity(i, hours, nowHour) {
    let observed = 0;
    let both = 0;
    let pairs = 0;
    let moves = 0;
    let lastAsk = NaN;
    const spreads = [];
    for (const r of hours) {
        if (nowHour - r.hour >= 7 * 24) continue;
        const a = at(r.a, i);
        const b = at(r.b, i);
        if (!Number.isFinite(a) && !Number.isFinite(b)) continue;
        observed++;
        if (Number.isFinite(a) && Number.isFinite(b)) {
            both++;
            spreads.push([Math.max(0, a - b) / a, 1]);
        }
        if (Number.isFinite(a)) {
            if (Number.isFinite(lastAsk)) {
                pairs++;
                if (a !== lastAsk) moves++;
            }
            lastAsk = a;
        }
    }
    return { hours: observed, both: observed ? both / observed : 0, spread: median(spreads), activity: pairs ? moves / pairs : 0, sold: soldPerDay(i, hours, nowHour) };
}

// Sold a day over the week: the mean of the hours whose file had the numbers, × 24.
export function soldPerDay(i, hours, nowHour) {
    let counted = 0;
    let total = 0;
    const prices = [];
    for (const r of hours) {
        if (!r.sold || nowHour - r.hour >= 7 * 24) continue;
        counted++;
        const v = at(r.v, i);
        if (Number.isFinite(v)) total += v;
        if (Number.isFinite(at(r.p, i))) prices.push([at(r.p, i), Number.isFinite(v) ? v : 1]);
    }
    return { hours: counted, perDay: counted ? (total / counted) * 24 : null, price: median(prices), enough: counted >= MIN_HOURS };
}

// Every stored price as CSV, to read in a spreadsheet or hand to an AI. Hourly
// rows only where an item's ask or bid changed since its previous row, so the
// file stays small; the hours that have data are listed in the header. What
// was sold is given per day only (an hourly count would double the file).
export function historyCsv(items, hours, days, exportedAt = new Date()) {
    const num = (v) => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "");
    const hourText = (hour) => new Date(hour * HOUR_MS).toISOString().slice(0, 13);
    const dayText = (day) => new Date(day * 24 * HOUR_MS).toISOString().slice(0, 10);
    const id = (hrid) => hrid.replace(/^\/items\//, "");
    // sold_mean, sold_hours, sold_price; empty where no hour of the day had the numbers.
    const sold = (d, i) => (at(d.vn, i) ? `${num(at(d.v, i) || 0)},${at(d.vn, i)},${num(at(d.p, i))}` : ",,");
    const lines = [
        `# MWI Advisor price history, exported ${exportedAt.toISOString().slice(0, 16)}Z; saved while the game was open on this device, and around the clock by your Pi if it is linked.`,
        "# ask = lowest sell order, bid = best buy order, in coins; empty = none. Times are UTC.",
        `# section hour: an item's row appears when its ask or bid changed since its previous row (in between it stayed the same).`,
        `# Hours with data: ${hours.map((r) => hourText(r.hour)).join(",")}`,
        `# section day (older than ${HOURLY_DAYS} days): the day's median ask and bid, their low and high, and how many hours had data.`,
        "# sold_mean = how many were traded per hour (the market file's v, an hour's count), the mean over the sold_hours hours of the day that",
        "#   had the numbers (0 = none traded; × 24 for a day); sold_price = the median of the hours' average trade price (p).",
        "#   On day rows, and in section sold for the hourly days (only items that traded).",
        "section,time,item,ask,bid,ask_low,ask_high,bid_low,bid_high,hours,sold_mean,sold_hours,sold_price",
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
    // The hourly days summed up the way they will be once they become daily points.
    for (const d of rollUpDays(hours.filter((r) => r.sold), items.length)) {
        items.forEach((hrid, i) => {
            if (at(d.v, i) > 0) lines.push(`sold,${dayText(d.day)},${id(hrid)},,,,,,,,${sold(d, i)}`);
        });
    }
    for (const d of days) {
        items.forEach((hrid, i) => {
            if (!at(d.n, i)) return;
            lines.push(`day,${dayText(d.day)},${id(hrid)},${[d.a, d.b, d.aLow, d.aHigh, d.bLow, d.bHigh].map((list) => num(at(list, i))).join(",")},${at(d.n, i)},${sold(d, i)}`);
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
    pi: null, // what came from the Pi: { epoch, items: its item order, hour, day: the newest received }
    queue: Promise.resolve(), // changes are written one at a time
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
        const [items, last, pi, hours] = await Promise.all(["items", "last", "pi"].map((key) => request(tx.objectStore(META).get(key))).concat(request(tx.objectStore(HOURLY).getAll())));
        const newest = hours.length ? hours[hours.length - 1].hour : 0;
        // From the start of the week, where the daily records' key record is.
        const fromDay = Math.floor((Math.floor(newest / 24) - 31) / 7) * 7;
        store.days = decodeRecords(await request(store.db.transaction(DAILY, "readonly").objectStore(DAILY).getAll(IDBKeyRange.lowerBound(fromDay))), DAILY_FIELDS);
        store.items = items || [];
        store.items.forEach((hrid, i) => store.index.set(hrid, i));
        store.last = last ?? null;
        store.pi = pi ?? null;
        store.hours = decodeRecords(hours, HOURLY_FIELDS);
        store.version++;
    })();
    return store.ready;
}

// Adds one market file, in the hour of its own timestamp (as the Pi does; the
// hour it was fetched if the timestamp is missing or far off). A file already
// seen (same timestamp) is skipped, and so is an hour the Pi has already sent.
export async function recordSnapshot(marketData, timestamp) {
    await loadHistory();
    return serially(async () => {
        if (timestamp && timestamp === store.last) return false;
        const stamped = Math.abs(timestamp * 1000 - Date.now()) < 3 * HOUR_MS;
        const hour = Math.floor((stamped ? timestamp * 1000 : Date.now()) / HOUR_MS);
        if (store.pi?.hour >= hour) return false;
        const record = snapshotRecord(marketData, hour, store.items, store.index);
        await commit([record], [], { last: timestamp ?? null });
        store.last = timestamp ?? null;
        return true;
    });
}

// Adds what the Pi sent (see pi/history-store.mjs): its hours and days win
// over ours where both have one, ours fill in the rest. Its items are mapped
// onto ours by name. Returns how many hours and days came in.
export async function mergeFromPi(wire, unpack) {
    await loadHistory();
    return serially(async () => {
        let pi = store.pi && store.pi.epoch === wire.epoch ? { ...store.pi, items: [...store.pi.items] } : { epoch: wire.epoch, items: [], hour: null, day: null };
        if (wire.itemsFrom !== pi.items.length) throw new Error("the Pi's item list is out of step; it is read again next time");
        if (!wire.items.length && !wire.hours.length && !wire.days.length && store.pi) return { hours: 0, days: 0 };
        pi.items.push(...wire.items);
        const map = itemMap(pi.items, store.items, store.index);
        const count = store.items.length;
        const hours = decodeRecords(wire.hours.map(unpack), HOURLY_FIELDS).map((r) => remapRecord(r, map, count, HOURLY_FIELDS));
        const days = decodeRecords(wire.days.map(unpack), DAILY_FIELDS).map((d) => remapRecord(d, map, count, DAILY_FIELDS));
        for (const r of hours) pi.hour = Math.max(pi.hour ?? -Infinity, r.hour);
        for (const d of days) pi.day = Math.max(pi.day ?? -Infinity, d.day);
        await commit(hours, days, { pi });
        store.pi = pi;
        return { hours: hours.length, days: days.length };
    }).catch((error) => {
        // Read everything again next time rather than stay stuck.
        if (/out of step/.test(error.message)) store.pi = null;
        throw error;
    });
}

// What the Pi has sent so far (for the next request), or null.
export const piReceived = () => store.pi && { epoch: store.pi.epoch, items: store.pi.items.length, hour: store.pi.hour, day: store.pi.day };

const serially = (job) => (store.queue = store.queue.then(job, job));

// Puts hourly and daily records into the store and the database: each replaces
// one of the same hour or day, a day also replaces the hours of that day. Then
// whole days older than two weeks become daily points, as always.
async function commit(newHours, newDays, meta) {
    const count = store.items.length;
    const dayKeys = new Set(newDays.map((d) => d.day));
    const hourKeys = new Set(newHours.map((r) => r.hour));
    const removed = store.hours.filter((r) => hourKeys.has(r.hour) || dayKeys.has(dayOf(r)));
    store.hours = [...store.hours.filter((r) => !removed.includes(r)), ...newHours].sort((x, y) => x.hour - y.hour);
    const gone = removed.filter((r) => !hourKeys.has(r.hour)).map((r) => r.hour);
    // Stored as the change from the hour before; the hour after a new or removed one is written again.
    const dirtyHours = new Set(hourKeys);
    for (const hour of gone) {
        const next = store.hours.find((r) => r.hour > hour);
        if (next) dirtyHours.add(next.hour);
    }

    // Whole days older than two weeks become daily points.
    const newest = store.hours.length ? store.hours[store.hours.length - 1].hour : null;
    const cutoffDay = newest === null ? -Infinity : Math.floor((newest - HOURLY_DAYS * 24) / 24);
    const old = store.hours.filter((r) => dayOf(r) < cutoffDay);
    store.hours = store.hours.filter((r) => dayOf(r) >= cutoffDay);
    // Hours that come late for a day already summed up here (from a Pi that was behind) leave that day as it is.
    const summed = new Set([...store.days, ...(store.allDays || [])].map((d) => d.day));
    const rollable = old.filter((r) => !summed.has(dayOf(r)));
    const changedDays = [...newDays, ...(rollable.length ? rollUpDays(rollable, count) : [])];
    const changedDayKeys = new Set(changedDays.map((d) => d.day));
    const hourWrites = encodeChanged(store.hours, dirtyHours, "hour", HOURLY_FIELDS, dayOf);

    // Each changed day as the change from the day before it (whole weeks are deleted, so a week's first day is a key record).
    // A day before the ones kept in memory needs them all, to write the day after it again.
    const windowStart = store.days.length ? store.days[0].day : Infinity;
    if (changedDays.some((d) => d.day < windowStart)) await loadAllDays();
    const replaceDays = (list) => [...list.filter((d) => !changedDayKeys.has(d.day)), ...changedDays].sort((x, y) => x.day - y.day);
    const dayList = changedDays.some((d) => d.day < windowStart) ? (store.allDays = replaceDays(store.allDays)) : (store.days = replaceDays(store.days));
    if (dayList === store.days && store.allDays) store.allDays = replaceDays(store.allDays);
    const dayWrites = encodeChanged(dayList, changedDayKeys, "day", DAILY_FIELDS, weekOf);
    const newestDay = newest === null ? Math.max(-Infinity, ...dayList.map((d) => d.day)) : Math.floor(newest / 24);
    store.days = (store.allDays || dayList).filter((d) => d.day >= newestDay - 31);

    const tx = store.db.transaction([HOURLY, DAILY, META], "readwrite");
    for (const hour of gone) tx.objectStore(HOURLY).delete(hour);
    for (const r of old) tx.objectStore(HOURLY).delete(r.hour);
    for (const w of hourWrites) tx.objectStore(HOURLY).put(w);
    for (const d of dayWrites) tx.objectStore(DAILY).put(d);
    if (Number.isFinite(newestDay)) tx.objectStore(DAILY).delete(IDBKeyRange.upperBound(Math.floor((newestDay - DAILY_DAYS) / 7) * 7, true));
    tx.objectStore(META).put(store.items, "items");
    for (const [key, value] of Object.entries(meta)) tx.objectStore(META).put(value, key);
    await done(tx);
    store.version++;
    store.summaries.clear();
}

// Bumps when new prices are recorded (for caches that depend on the history).
export const historyVersion = () => store.version;

// The usual price of an item, or null before any data exists for it.
export function priceSummary(itemHrid, level = 0) {
    if (!store.hours.length) return null;
    const key = historyKey(itemHrid, level);
    const i = store.index.get(key);
    if (i === undefined) return null;
    if (!store.summaries.has(key)) {
        store.summaries.set(key, summarize(i, store.hours, store.days, store.hours[store.hours.length - 1].hour));
    }
    return store.summaries.get(key);
}

// Every daily record, for long views (read once, then kept).
export async function loadAllDays() {
    await loadHistory();
    if (!store.allDays) {
        const tx = store.db.transaction(DAILY, "readonly");
        store.allDays = decodeRecords(await request(tx.objectStore(DAILY).getAll()), DAILY_FIELDS);
    }
    return store.allDays;
}

// Points of one item for a chart: hourly where kept, daily before that.
// range: days back. Each point { t: hour, a, b }.
export async function priceSeries(itemHrid, range, level = 0) {
    await loadHistory();
    const i = store.index.get(historyKey(itemHrid, level));
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
export async function longMedians(itemHrid, level = 0) {
    const i = store.index.get(historyKey(itemHrid, level));
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
