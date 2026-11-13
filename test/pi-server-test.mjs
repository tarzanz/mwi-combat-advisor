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
import { openJobStore } from "../pi/job-store.mjs";
import { openLabyrinthStore } from "../pi/labyrinth-store.mjs";
import { openPlanStore } from "../pi/plan-store.mjs";
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

    // Job results and purchases, shared between devices.
    const postJobs = (body, key = KEY) => fetch(base + "/jobs", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Origin: "https://www.milkywayidle.com" }, body: JSON.stringify(body) });
    const getJobs = (after = 0, key = KEY) => fetch(`${base}/jobs?after=${after}`, { headers: { Authorization: `Bearer ${key}` } });
    const report = (actions, endedAt = 1000) => ({ key: "7|t", report: { key: "7|t", actions, endedAt, used: [["/items/x::0", actions]], profit: 1 } });
    const purchase = (filled) => ({ uid: "99", purchase: { key: "/items/x::0", filled, cost: filled * 10, at: 500 } });
    check("jobs: no key, nothing written or read", (await postJobs({ device: "phone", reports: [report(5)] }, "nope")).status === 401 && (await getJobs(0, "nope")).status === 401);
    const sentJobs = await postJobs({ device: "phone", reports: [report(5), { key: "bad" }], purchases: [purchase(6)] }).then((r) => r.json());
    check("jobs: sane ones kept, the rest refused", sentJobs.accepted === 2 && sentJobs.rejected === 1 && sentJobs.seq === 2, JSON.stringify(sentJobs));
    const fromPc = await postJobs({ device: "pc", reports: [report(3)], purchases: [purchase(4), purchase(10)] }).then((r) => r.json());
    check("jobs: what saw less of a job or an order is not kept", fromPc.kept === 2 && fromPc.accepted === 1, JSON.stringify(fromPc));
    const everything = await getJobs(0).then((r) => r.json());
    check("jobs: a device gets the latest of each", everything.seq === 3 && everything.reports.length === 1 && everything.reports[0].report.actions === 5 && everything.purchases.length === 1 && everything.purchases[0].purchase.filled === 10, JSON.stringify(everything));
    const news = await getJobs(2).then((r) => r.json());
    check("jobs: only what is new since it asked", news.reports.length === 0 && news.purchases.length === 1, JSON.stringify(news));
    check("jobs: too many at once refused", (await postJobs({ device: "phone", reports: Array.from({ length: 301 }, () => report(1)) })).status === 400);
    const reread = openJobStore(dataDir).since(0);
    check("jobs: read again after a restart, the same", reread.seq === 3 && reread.purchases[0].purchase.filled === 10 && reread.reports[0].report.actions === 5, JSON.stringify(reread));
    const withJobs = await fetch(base + "/history?epoch=" + all.epoch, { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json());
    check("the history says jobs are taken", withJobs.status.jobs?.reports === 1 && withJobs.status.jobs.purchases === 1, JSON.stringify(withJobs.status));

    // Labyrinth attempts from every device, each kept once.
    const postLab = (body, key = KEY) => fetch(base + "/labyrinth", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Origin: "https://www.milkywayidle.com" }, body: JSON.stringify(body) });
    const getLab = (after = 0, key = KEY) => fetch(`${base}/labyrinth?after=${after}`, { headers: { Authorization: `Bearer ${key}` } });
    const attempt = (uid, outcome = "loss") => ({ uid, at: 1000, outcome, what: "cyclops", type: "combat", level: 30, levels: { magic: 68 } });
    check("labyrinth: no key, nothing written or read", (await postLab({ device: "phone", attempts: [attempt("a")] }, "nope")).status === 401 && (await getLab(0, "nope")).status === 401);
    const sentLab = await postLab({ device: "phone", attempts: [attempt("1|t|1|0|1|loss|1"), attempt("1|t|1|0|1|end|1", "win"), { uid: "bad" }] }).then((r) => r.json());
    check("labyrinth: sane ones kept, the rest refused", sentLab.accepted === 2 && sentLab.rejected === 1, JSON.stringify(sentLab));
    const pcLab = await postLab({ device: "pc", attempts: [attempt("1|t|1|0|1|loss|1"), attempt("1|t|1|0|2|end|0", "win")] }).then((r) => r.json());
    check("labyrinth: what another device sent already is kept once", pcLab.accepted === 1 && pcLab.duplicates === 1, JSON.stringify(pcLab));
    const allLab = await getLab(0).then((r) => r.json());
    const newLab = await getLab(2).then((r) => r.json());
    const noneLab = await getLab(3).then((r) => r.json());
    check("labyrinth: everything, then only what is new", allLab.seq === 3 && allLab.attempts.length === 3 && !allLab.more && newLab.attempts.length === 1 && newLab.attempts[0].attempt.uid === "1|t|1|0|2|end|0" && noneLab.attempts.length === 0 && noneLab.seq === 3, JSON.stringify(newLab));
    check("labyrinth: too many at once refused", (await postLab({ device: "phone", attempts: Array.from({ length: 301 }, (_, i) => attempt(String(i))) })).status === 400);
    const rereadLab = openLabyrinthStore(dataDir).since(0);
    check("labyrinth: read again after a restart, the same", rereadLab.seq === 3 && rereadLab.attempts[2].attempt.levels.magic === 68, JSON.stringify(rereadLab));
    // The game's Labyrinth states, whole, each kept once.
    const postStates = (body, key = KEY) => fetch(base + "/labyrinth/states", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Origin: "https://www.milkywayidle.com" }, body: JSON.stringify(body) });
    const labState = (uid, extra = {}) => ({ uid, at: 2000, late: false, labyrinth: { characterID: 1, isActive: true, currentFloor: 2, roomData: [[null, { roomType: "/labyrinth_room_types/skilling", skillHrid: "/skills/milking", recommendedLevel: 44 }]] }, levels: { milking: 62 }, ...extra });
    check("labyrinth states: no key, nothing written", (await postStates({ device: "phone", states: [labState("1|t|a")] }, "nope")).status === 401);
    const sentStates = await postStates({ device: "phone", states: [labState("1|t|a"), labState("1|t|b"), { uid: "1|t|c", at: 1 }, labState('1|t|"d')] }).then((r) => r.json());
    const againStates = await postStates({ device: "pc", states: [labState("1|t|a"), labState("1|t|e")] }).then((r) => r.json());
    check("labyrinth states: sane ones kept once, the rest refused", sentStates.accepted === 2 && sentStates.rejected === 2 && againStates.accepted === 1 && againStates.duplicates === 1, JSON.stringify([sentStates, againStates]));
    check("labyrinth states: too many or too big refused", (await postStates({ device: "phone", states: Array.from({ length: 21 }, (_, i) => labState("x" + i)) })).status === 400
        && (await postStates({ device: "phone", states: [labState("1|t|big", { junk: "x".repeat(70000) })] }).then((r) => r.json())).rejected === 1);
    const stateFile = readdirSync(path.join(dataDir, "labyrinth")).find((f) => f.startsWith("states-"));
    const stateLines = readFileSync(path.join(dataDir, "labyrinth", stateFile), "utf8").trim().split("\n").map((l) => JSON.parse(l));
    const reopened = openLabyrinthStore(dataDir);
    check("labyrinth states: a line each, whole, and known again after a restart", stateLines.length === 3 && stateLines[0].state.labyrinth.roomData[0][1].recommendedLevel === 44 && stateLines[2].device === "pc"
        && reopened.status().states === 3 && reopened.addStates("pc", [labState("1|t|b")], Date.now()).duplicates === 1, JSON.stringify(reopened.status()));
    const withLab = await fetch(base + "/history?epoch=" + all.epoch, { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json());
    check("the history says Labyrinth attempts and states are taken", withLab.status.labyrinth?.attempts === 3 && withLab.status.labyrinth.states === 3, JSON.stringify(withLab.status));

    // The 📈 plan: a snapshot in, the plan out (the planning itself is checked below, without the server).
    const postSnap = (body, key = KEY) => fetch(base + "/snapshot", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Origin: "https://www.milkywayidle.com" }, body: JSON.stringify(body) });
    const snap = { character: { id: 77, name: "Tester" }, at: Date.now(), who: { levels: { "/skills/tailoring": 30 } }, coins: 1000 };
    check("plan: no key, nothing written or read", (await postSnap({ snapshot: snap }, "nope")).status === 401 && (await fetch(base + "/plan?character=77")).status === 401);
    check("plan: a snapshot without its parts is refused", (await postSnap({ snapshot: { who: {} } })).status === 400);
    const took = await postSnap({ snapshot: snap }).then((r) => r.json());
    check("plan: a snapshot is taken, and the Pi asks for the game's data", took.ok && took.character === "77" && took.needData === true, JSON.stringify(took));
    const planAnswer = await fetch(base + "/plan?character=77", { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json());
    check("plan: none yet, the next run is planned", planAnswer.plan === null && planAnswer.status.next > Date.now() && planAnswer.snapshotAt === snap.at, JSON.stringify(planAnswer));
    check("the history says plans are made", withLab.status.plan?.characters === 0 && (await fetch(base + "/history?epoch=" + all.epoch, { headers: { Authorization: `Bearer ${KEY}` } }).then((r) => r.json())).status.plan.characters === 1);
} finally {
    server.kill();
    market.close();
}

// The plan store on its own: usual prices from the history, a snapshot with the
// game's data, the planner run as a process of its own, the plan read back.
const typical = store.typical();
check("usual prices: the week's medians, quartiles and sales a day", typical["/items/item_0"]?.a > 0 && typical["/items/item_0"].aLow <= typical["/items/item_0"].a && typical["/items/item_0"].aHigh >= typical["/items/item_0"].a && typical["/items/item_0"].sold > 0 && !Object.keys(typical).some((k) => k.includes("+")), JSON.stringify(typical["/items/item_0"]));
{
    const engineData = {};
    for (const f of readdirSync(path.join(root, "engine/data"))) engineData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(root, "engine/data", f), "utf8"));
    engineData.levelExperienceTable = Array.from({ length: 201 }, (_, level) => Math.round(30 * level ** 2.2));
    const { planData } = await import("../src/horizon.js");
    const { skillingCharacter } = await import("../src/skilling.js");
    const { fixtureCharacter } = await import("./fixture-character.js");
    const character = fixtureCharacter();
    character.characterSkills.push({ skillHrid: "/skills/tailoring", level: 30, experience: 0 });
    const who = skillingCharacter(character, new Map(character.characterItems.map((i) => [i.hash, i])), engineData);
    const prices = {};
    for (const item of Object.values(engineData.itemDetailMap)) prices[item.hrid] = { a: 3 * (item.sellPrice || 1), b: 2 * (item.sellPrice || 1), aLow: null, aHigh: null, bLow: null, sold: 5000 };
    const planDir = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-plan-"));
    let busy = true;
    const logs = [];
    const plans = openPlanStore(planDir, { typical: () => prices, log: (line) => logs.push(line), delayMs: 60000, soonMs: 10, postponeMs: 50, busy: () => busy });
    check("plan store: a bad character id is refused", !plans.put({ snapshot: { character: { id: "../x" }, who: { levels: {} }, coins: 1 } }).ok);
    const shipped = planData(engineData);
    const snapshot = { character: { id: 5, name: "Tester" }, at: 123, who, coins: 1_000_000, owned: {}, options: { days: 2 }, dataHash: shipped.hash };
    const put = plans.put({ snapshot, data: shipped, run: true });
    check("plan store: snapshot and game data taken", put.ok && put.character === "5" && put.dataHash === shipped.hash && !put.needData, JSON.stringify(put));
    await new Promise((r) => setTimeout(r, 120));
    check("plan store: a busy Pi waits", logs.some((l) => /busy/.test(l)) && plans.get(5).plan === null, logs.join(" | "));
    busy = false;
    let got = null;
    for (let k = 0; k < 600 && !got?.plan; k++) {
        await new Promise((r) => setTimeout(r, 100));
        await plans.idle();
        got = plans.get(5);
    }
    check("plan store: the planner works the plan out at the lowest priority", got?.plan?.plans?.length > 0 && got.plan.options.days === 2 && got.plan.snapshotAt === 123 && got.plan.character === "Tester" && !got.status.error && got.status.ms > 0, JSON.stringify(got?.status) + " " + logs.join(" | "));
    check("plan store: the next run is in a few hours", got.status.next > Date.now() + 3600 * 1000, JSON.stringify(got.status));
    plans.put({ snapshot: { ...snapshot, at: 124 } });
    const waits = plans.get(5).status;
    check("plan store: a new snapshot waits for the run 4 hours after the last", Math.abs(waits.next - (got.status.at + 4 * 3600 * 1000)) < 5000, JSON.stringify(waits));
    plans.put({ snapshot: { ...snapshot, at: 125 }, run: true });
    check("plan store: …unless asked to plan now", plans.get(5).status.next < Date.now() + 1000, JSON.stringify(plans.get(5).status));
    await new Promise((r) => setTimeout(r, 50));
    for (let k = 0; k < 600 && plans.get(5).plan?.snapshotAt !== 125; k++) {
        await new Promise((r) => setTimeout(r, 100));
        await plans.idle();
    }
    const reopenedPlans = openPlanStore(planDir, { typical: () => prices, busy: () => true, delayMs: 60000 });
    check("plan store: read again after a restart", reopenedPlans.get(5).plan?.plans?.length === got.plan.plans.length && reopenedPlans.status().dataHash === shipped.hash && reopenedPlans.status().characters === 1, JSON.stringify(reopenedPlans.status()));
    const noData = openPlanStore(mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-plan-")), { typical: () => prices, soonMs: 10, busy: () => false });
    noData.put({ snapshot, run: true });
    await new Promise((r) => setTimeout(r, 100));
    await noData.idle();
    check("plan store: without the game's data it says so", /game data/.test(noData.get(5).status.error || ""), JSON.stringify(noData.get(5).status));
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
    const jobsAnswer = await fetch(`http://127.0.0.1:${PORT2}/jobs`, { headers: { Authorization: `Bearer ${KEY}` } });
    check("orders off (the default): posting refused, and the history says so", answer?.status === 405 && history.status.orders === null && history.status.jobs === null && history.status.labyrinth === null && history.status.plan === null && jobsAnswer.status === 404, String(answer?.status));
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

// The Docker image: every file the Dockerfile copies is let through by .dockerignore (which lets through only what it lists).
const copied = readFileSync(path.join(root, "pi/Dockerfile"), "utf8").split("\n").filter((l) => l.startsWith("COPY ")).flatMap((l) => l.split(/\s+/).slice(1, -1));
const allowed = new Set(readFileSync(path.join(root, ".dockerignore"), "utf8").split("\n").filter((l) => l.startsWith("!")).map((l) => l.slice(1).trim()));
const missing = copied.filter((file) => !allowed.has(file));
check("docker: every file copied is in the build context", copied.length >= 5 && !missing.length, missing.join(", "));

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
