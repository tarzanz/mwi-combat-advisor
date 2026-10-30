// Checks the Pi's price history: 16 days of market files (so old hours become
// days), what a browser is sent – everything, or only what it lacks – read
// back exactly, a rebuild from the raw files, and the server itself: key,
// CORS, gzip and the link that connects a browser – and, switched on, the order
// events devices send, and the CSV with what sold every hour.
// Usage: node test/pi-server-test.mjs
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { openStore } from "../pi/history-store.mjs";
import { openOrderStore } from "../pi/order-store.mjs";
import { DAILY_FIELDS, HOURLY_FIELDS, decodeRecords } from "../src/price-history.js";
import { unpackRecord } from "../src/history-wire.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
const sameArrays = (x, y) => x.length === y.length && [...x].every((v, i) => v === y[i] || (Number.isNaN(v) && Number.isNaN(y[i])));
const sameRecords = (xs, ys, fields, keyField) => xs.length === ys.length && xs.every((x, k) => x[keyField] === ys[k][keyField] && fields.every((f) => sameArrays(x[f], ys[k][f])));

// A market file: 40 items, a few with +levels, prices that move now and then; an item appears on day 3.
const START = 1793000000 - (1793000000 % 3600) + 360;
function marketFile(h) {
    const marketData = {};
    for (let i = 0; i < 40; i++) {
        if (i === 39 && h < 72) continue;
        const a = 1000 + i * 10 + (i < 8 ? (h * 7 + i) % 13 : 0);
        marketData[`/items/item_${i}`] = { 0: i % 6 === 5 ? { a: -1, b: -1 } : { a, b: i % 3 ? a - 5 : -1, ...((h + i) % 4 ? { p: a - 2, v: 1 + ((h + i) % 9) } : {}) } };
        if (i < 4) marketData[`/items/item_${i}`][5] = { a: 9000 + (h % 5), b: -1 };
    }
    return JSON.stringify({ marketData, timestamp: START + h * 3600 });
}

const dataDir = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-pi-"));
const store = openStore(dataDir);
const HOURS = 16 * 24;
for (let h = 0; h < HOURS; h++) if (h !== 100) store.addFile(marketFile(h)); // one hour missing
check("a file already seen is skipped", store.addFile(marketFile(HOURS - 1)) === false);
const status = store.status();
check("old hours became days", status.hours > 14 * 24 && status.hours <= 15 * 24 && status.days >= 1 && status.items === 44, JSON.stringify(status));
check("every file is kept as it came", readdirSync(path.join(dataDir, "raw")).flatMap((d) => readdirSync(path.join(dataDir, "raw", d))).length === HOURS - 1);

const read = (wire) => ({ hours: decodeRecords(wire.hours.map(unpackRecord), HOURLY_FIELDS), days: decodeRecords(wire.days.map(unpackRecord), DAILY_FIELDS) });
const all = store.since({});
const full = read(all);
check("everything: all hours and days, from a key record on", full.hours.length === status.hours && full.days.length === status.days && all.hours[0].key && all.days[0].key && all.itemsFrom === 0 && all.items.length === 44);
check("hours keep ask, bid and what sold", full.hours.at(-1).a[0] > 0 && full.hours.at(-1).sold && full.hours.some((r) => r.v[0] > 0));

// Opened again from its files: the same.
const reopened = openStore(dataDir);
const again = read(reopened.since({}));
check("read back from its files exactly", sameRecords(again.hours, full.hours, HOURLY_FIELDS, "hour") && sameRecords(again.days, full.days, DAILY_FIELDS, "day") && reopened.since({}).epoch === all.epoch);

// Only what a browser lacks.
const lastHour = full.hours.at(-1).hour;
const knownHour = full.hours.at(-4).hour;
const lacks = reopened.since({ epoch: all.epoch, items: 40, hour: knownHour, day: full.days.at(-1).day });
const lacking = read(lacks);
check("only what a browser lacks", lacking.hours.length === 3 && lacking.hours.at(-1).hour === lastHour && lacking.days.length === 0 && lacks.itemsFrom === 40 && lacks.items.length === 4 && sameRecords(lacking.hours, full.hours.slice(-3), HOURLY_FIELDS, "hour"));
const otherEpoch = reopened.since({ epoch: "old", items: 40, hour: knownHour });
check("another epoch gets everything", otherEpoch.itemsFrom === 0 && otherEpoch.hours.length === full.hours.length);

// Rebuilt from the raw files: a new epoch, the same records.
reopened.rebuild();
const rebuilt = reopened.since({});
const rebuiltRead = read(rebuilt);
check("rebuilt from the raw files", rebuilt.epoch !== all.epoch && sameRecords(rebuiltRead.hours, full.hours, HOURLY_FIELDS, "hour") && sameRecords(rebuiltRead.days, full.days, DAILY_FIELDS, "day") && JSON.stringify(rebuilt.items) === JSON.stringify(all.items));

// The server: a fake market file, a key, the game's site as the only origin.
let marketHour = HOURS + 5;
const market = http.createServer((req, res) => res.end(marketFile(marketHour)));
await new Promise((r) => market.listen(0, "127.0.0.1", r));
const KEY = "k".repeat(30);
const PORT = 20000 + Math.floor(Math.random() * 20000);
const env = { ...process.env, MWIA_KEY: KEY, MWIA_DATA: dataDir, PORT: String(PORT), MWIA_MARKET_URL: `http://127.0.0.1:${market.address().port}/`, MWIA_ORIGINS: "https://www.milkywayidle.com", MWIA_ORDERS: "1" };
const server = spawn("node", [path.join(root, "pi/server.mjs")], { env, stdio: ["ignore", "pipe", "inherit"] });
const base = `http://127.0.0.1:${PORT}`;
try {
    let st = null;
    for (let k = 0; k < 50 && !st?.newest?.startsWith(new Date((START + marketHour * 3600) * 1000).toISOString().slice(0, 13)); k++) {
        await new Promise((r) => setTimeout(r, 100));
        st = await fetch(base + "/status").then((r) => r.json()).catch(() => null);
    }
    check("the server fetches the market file", !!st?.ok && st.newest.startsWith(new Date((START + marketHour * 3600) * 1000).toISOString().slice(0, 13)), JSON.stringify(st));
    check("status holds no data", st && Object.keys(st).sort().join() === "lastError,newest,ok");
    const noKey = await fetch(base + "/history");
    const wrongKey = await fetch(base + "/history", { headers: { Authorization: "Bearer nope" } });
    check("no key, or a wrong one: nothing", noKey.status === 401 && wrongKey.status === 401);
    const raw = await new Promise((resolve) => http.get(base + "/history", { headers: { Authorization: `Bearer ${KEY}`, "Accept-Encoding": "gzip", Origin: "https://www.milkywayidle.com" } }, (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ res, body: Buffer.concat(chunks) }));
    }));
    const body = JSON.parse(gunzipSync(raw.body).toString());
    check("with the key: the history, gzipped, for the game's site", raw.res.statusCode === 200 && raw.res.headers["content-encoding"] === "gzip" && raw.res.headers["access-control-allow-origin"] === "https://www.milkywayidle.com" && read(body).hours.at(-1).hour === Math.floor((START + marketHour * 3600) / 3600) && body.status.items === 44, `${raw.body.length} bytes`);
    const preflight = await fetch(base + "/history", { method: "OPTIONS", headers: { Origin: "https://www.milkywayidle.com", "Access-Control-Request-Headers": "authorization" } });
    const stranger = await fetch(base + "/history", { method: "OPTIONS", headers: { Origin: "https://example.com" } });
    check("CORS: the game's site may send the key, others not", preflight.status === 204 && /Authorization/i.test(preflight.headers.get("access-control-allow-headers")) && !stranger.headers.get("access-control-allow-origin"));

    // Order events from a device.
    const order = (uid, filled) => ({ uid, at: Date.now(), kind: "seen", order: { id: 77, item: "/items/item_1", level: 0, side: "sell", price: 1010, quantity: 10, filled, status: "/market_order_status/active" } });
    const post = (body, key = KEY) => fetch(base + "/orders", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Origin: "https://www.milkywayidle.com" }, body: JSON.stringify(body) });
    const events = [order("e1", 0), order("e2", 4), { uid: "bad", at: "now" }];
    check("orders: no key, nothing written", (await post({ device: "phone", events }, "nope")).status === 401);
    const first = await post({ device: "phone", events });
    const firstBody = await first.json();
    check("orders: sane events are kept, the rest refused", first.status === 200 && firstBody.accepted === 2 && firstBody.rejected === 1 && first.headers.get("access-control-allow-origin") === "https://www.milkywayidle.com", JSON.stringify(firstBody));
    const again = await post({ device: "phone", events: events.slice(0, 2) }).then((r) => r.json());
    check("orders: sent twice, kept once", again.accepted === 0 && again.duplicates === 2, JSON.stringify(again));
    check("orders: too many at once refused", (await post({ device: "phone", events: Array.from({ length: 501 }, (_, i) => order(`m${i}`, 0)) })).status === 400);
    const lines = readdirSync(path.join(dataDir, "orders")).flatMap((f) => readFileSync(path.join(dataDir, "orders", f), "utf8").trim().split("\n")).map((l) => JSON.parse(l));
    check("orders: one line each, with the device and when it came", lines.length === 2 && lines[1].order.filled === 4 && lines[0].device === "phone" && lines[0].received > 0, JSON.stringify(lines[0]));
    check("orders: read again after a restart, still kept once", openOrderStore(dataDir).add("pc", [order("e1", 0)]).duplicates === 1);
    const postPreflight = await fetch(base + "/orders", { method: "OPTIONS", headers: { Origin: "https://www.milkywayidle.com", "Access-Control-Request-Method": "POST" } });
    check("CORS: the game's site may post JSON", /POST/.test(postPreflight.headers.get("access-control-allow-methods")) && /Content-Type/i.test(postPreflight.headers.get("access-control-allow-headers")));
    const withOrders = await fetch(base + "/history?epoch=" + all.epoch, { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json());
    check("the history says orders are taken", withOrders.status.orders?.events === 2, JSON.stringify(withOrders.status));
} finally {
    server.kill();
    market.close();
}

// Without MWIA_ORDERS nothing can be posted.
const PORT2 = PORT + 1;
const plain = spawn("node", [path.join(root, "pi/server.mjs")], { env: { ...env, MWIA_ORDERS: "", PORT: String(PORT2) }, stdio: ["ignore", "pipe", "inherit"] });
try {
    let answer = null;
    for (let k = 0; k < 50 && !answer; k++) {
        await new Promise((r) => setTimeout(r, 100));
        answer = await fetch(`http://127.0.0.1:${PORT2}/orders`, { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: "{}" }).catch(() => null);
    }
    const history = await fetch(`http://127.0.0.1:${PORT2}/history`, { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json());
    check("orders off (the default): posting refused, and the history says so", answer?.status === 405 && history.status.orders === null, String(answer?.status));
} finally {
    plain.kill();
}

// The CSV, with what sold in every hour.
const csv = await new Promise((resolve) => {
    const p = spawn("node", [path.join(root, "pi/server.mjs"), "csv"], { env: { ...process.env, MWIA_DATA: dataDir } });
    let out = "";
    p.stdout.on("data", (c) => (out += c));
    p.on("close", () => resolve(out));
});
const soldRows = csv.split("\n").filter((l) => l.startsWith("sold,"));
check("csv: a sold row per hour and item that traded", soldRows.length > 14 * 24 * 10 && /^sold,\d{4}-\d\d-\d\dT\d\d,item_\d+,,,,,,,,\d+,1,\d+$/.test(soldRows[0]) && csv.includes("\nhour,"), soldRows[0]);

// The link that connects a browser.
const link = await new Promise((resolve) => {
    const p = spawn("node", [path.join(root, "pi/server.mjs"), "link", "https://mwi.example.com/"], { env: { ...process.env, MWIA_KEY: KEY } });
    let out = "";
    p.stdout.on("data", (c) => (out += c));
    p.on("close", () => resolve(out.trim()));
});
const pairing = JSON.parse(Buffer.from(link.split("#mwia-pi=")[1] || "", "base64url").toString() || "null");
check("the link carries address and key", link.startsWith("https://www.milkywayidle.com/#mwia-pi=") && pairing?.u === "https://mwi.example.com" && pairing?.k === KEY, link);

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
