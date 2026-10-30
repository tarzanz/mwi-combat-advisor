// End-to-end check of a browser linked to the Pi: a real pi/server.mjs with
// its own history, a browser with history of its own, then the link from the
// Pi, the merge (the Pi's hours win, the browser's fill in), the next hour
// only, your market orders sent to it (with what a listing window said), the
// Pi down (the browser goes on collecting) and unlinking.
// Usage: node test/pi-sync-browser-test.mjs <screenshot-dir>
// BROWSER_PATH picks another browser (Chromium).
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { WebSocketServer } from "ws";
import { fixtureCharacter } from "./fixture-character.js";
import { openStore } from "../pi/history-store.mjs";
import { HOURLY_FIELDS, decodeRecords } from "../src/price-history.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir = "/tmp"] = process.argv.slice(2);
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");
const character = fixtureCharacter();
// One sell order open from the start.
const order = (id, filled, extra = {}) => ({ id, itemHrid: "/items/linen_boots", enhancementLevel: 0, isSell: true, price: 700, orderQuantity: 10, filledQuantity: filled, status: "/market_order_status/active", ...extra });
character.myMarketListings = [order(1, 0)];

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

// Hours: the browser saved H-30 … H-10 (boots at 100+k), the Pi has H-20 … H-1
// (boots at 500+k, and gloves the browser never saw); the market file now is hour H.
const H = Math.floor(Date.now() / 3600000);
const BOOTS = "/items/linen_boots";
const GLOVES = "/items/linen_gloves";
const piFile = (hour, boots) => JSON.stringify({ marketData: { [GLOVES]: { 0: { a: 50, b: 40, p: 45, v: 3 } }, [BOOTS]: { 0: { a: boots, b: 90 } } }, timestamp: hour * 3600 + 360 });
const piData = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-pi-sync-"));
const piStore = openStore(piData);
for (let age = 20; age >= 1; age--) piStore.addFile(piFile(H - age, 500 + age));

let fileHour = H;
const marketNow = () => {
    const marketData = {};
    for (const item of Object.values(clientData.itemDetailMap)) marketData[item.hrid] = { 0: { a: 3 * (item.sellPrice || 1), b: item.sellPrice || 1 } };
    marketData[BOOTS][0] = { a: 700 + (fileHour - H), b: 90 };
    return JSON.stringify({ marketData, timestamp: fileHour * 3600 + 360 });
};

const page_html = `<!doctype html><html><head><meta charset="utf-8"><script src="/advisor.user.js"></script></head><body>
<div id="market" style="width:360px"></div>
<script>
  const xhr = new XMLHttpRequest(); xhr.open("GET", "/client-data.json", false); xhr.send();
  const data = JSON.parse(xhr.responseText);
  window.localStorageUtil = { getInitClientData: () => data };
  const ws = new WebSocket("ws://" + location.host + "/fake/api.milkywayidle.com/ws");
  ws.onmessage = (e) => { window.lastType = JSON.parse(e.data).type; };
</script></body></html>`;
const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url.startsWith("/#")) {
        res.setHeader("content-type", "text/html");
        res.end(page_html);
    } else if (req.url === "/advisor.user.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(userscript);
    } else if (req.url.startsWith("/game_data/marketplace.json")) {
        res.setHeader("content-type", "application/json");
        res.end(marketNow());
    } else if (req.url === "/client-data.json") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(clientData));
    } else {
        res.statusCode = 404;
        res.end();
    }
});
const sockets = [];
new WebSocketServer({ server }).on("connection", (socket) => {
    sockets.push(socket);
    socket.send(JSON.stringify(character));
});
const sendAll = (message) => sockets.forEach((socket) => socket.readyState === 1 && socket.send(JSON.stringify(message)));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

// The Pi: the game page is its one allowed origin; it fetches the same market file.
const KEY = "pi-key-".repeat(5);
const PI_PORT = 20000 + Math.floor(Math.random() * 20000);
const piUrl = `http://127.0.0.1:${PI_PORT}`;
let pi = null;
async function startPi() {
    pi = spawn("node", [path.join(root, "pi/server.mjs")], { env: { ...process.env, MWIA_KEY: KEY, MWIA_DATA: piData, PORT: String(PI_PORT), MWIA_MARKET_URL: `${origin}/game_data/marketplace.json`, MWIA_ORIGINS: origin, MWIA_ORDERS: "1" }, stdio: "ignore" });
    const want = new Date((fileHour * 3600 + 360) * 1000).toISOString();
    for (let k = 0; k < 50; k++) {
        const st = await fetch(piUrl + "/status").then((r) => r.json()).catch(() => null);
        if (st?.newest === want) return true;
        await new Promise((r) => setTimeout(r, 100));
    }
    return false;
}
const stopPi = () => new Promise((resolve) => {
    pi.once("exit", resolve);
    pi.kill();
});
check("the Pi has fetched the hour now", await startPi());
const link = `${origin}/#mwia-pi=${Buffer.from(JSON.stringify({ u: piUrl, k: KEY })).toString("base64url")}`;

// The browser's hourly records, decoded (typed arrays come out of the page as lists).
const storedHours = (page) => page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open("mwia-price-history", 1);
    req.onsuccess = () => {
        const tx = req.result.transaction(["hourly", "meta"], "readonly");
        const all = tx.objectStore("hourly").getAll();
        const items = tx.objectStore("meta").get("items");
        const piMeta = tx.objectStore("meta").get("pi");
        tx.oncomplete = () => resolve({ items: items.result, pi: piMeta.result ? { ...piMeta.result, items: piMeta.result.items.length } : null, hours: all.result.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, ArrayBuffer.isView(v) ? { t: v.constructor.name, d: Array.from(v, (x) => (Number.isNaN(x) ? "NaN" : x)) } : v]))) });
    };
}));
const TYPES = { Float32Array, Uint8Array, Uint16Array, Uint32Array };
async function decoded(page) {
    const raw = await storedHours(page);
    const hours = decodeRecords(raw.hours.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v?.t ? TYPES[v.t].from(v.d.map((x) => (x === "NaN" ? NaN : x))) : v]))), HOURLY_FIELDS);
    const at = (item) => raw.items.indexOf(item);
    return { ...raw, hours, price: (item, hour) => hours.find((r) => r.hour === hour)?.a[at(item)] };
}

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(origin + "/");
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });
    // The browser's own history: boots only, as full records of the old kind.
    await page.evaluate(async ({ H, BOOTS }) => {
        const db = await new Promise((resolve, reject) => {
            const req = indexedDB.open("mwia-price-history", 1);
            req.onupgradeneeded = () => { const d = req.result; d.createObjectStore("hourly", { keyPath: "hour" }); d.createObjectStore("daily", { keyPath: "day" }); d.createObjectStore("meta"); };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        const tx = db.transaction(["hourly", "meta"], "readwrite");
        for (let age = 30; age >= 10; age--) tx.objectStore("hourly").put({ hour: H - age, a: new Float32Array([100 + age]), b: new Float32Array([90]) });
        tx.objectStore("meta").put([BOOTS], "items");
        await new Promise((r) => (tx.oncomplete = r));
        db.close();
    }, { H, BOOTS });

    // Linked by opening the Pi's link (a fresh load, as from a QR code): saved, and gone from the address bar.
    await page.goto("about:blank");
    await page.goto(link);
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });
    const saved = await page.evaluate(() => ({ config: JSON.parse(localStorage.getItem("mwia-pi") || "null"), hash: location.hash }));
    check("the link links this browser and leaves the address bar", saved.config?.url === piUrl && saved.config?.key === KEY && saved.hash === "", JSON.stringify(saved));

    // First read: the Pi's hours win, the browser's fill in before them, the Pi's items mapped by name.
    await page.waitForFunction(async () => {
        const req = indexedDB.open("mwia-price-history", 1);
        return await new Promise((resolve) => (req.onsuccess = () => {
            const get = req.result.transaction("meta").objectStore("meta").get("pi");
            get.onsuccess = () => resolve(!!get.result);
        }));
    }, { timeout: 10000, polling: 300 }).catch(() => null);
    let st = await decoded(page);
    const own = [30, 25, 21].every((age) => st.price(BOOTS, H - age) === 100 + age);
    const fromPi = [20, 15, 1].every((age) => st.price(BOOTS, H - age) === 500 + age);
    check("merged: the Pi's hours win, this browser's fill in", own && fromPi && st.price(GLOVES, H - 5) === 50 && st.items[0] === BOOTS, JSON.stringify({ own, fromPi, items: st.items.length }));
    check("the hour now: one record, the Pi's or the same file here", st.hours.filter((r) => r.hour === H).length === 1 && st.price(BOOTS, H) === 700 && st.pi?.hour === H, JSON.stringify(st.pi));
    check("stored as changes and read back in order", st.hours.every((r, k) => k === 0 || r.hour > st.hours[k - 1].hour) && st.hours.length === 31);

    // The box says where the prices come from.
    await page.evaluate(() => {
        document.getElementById("market").innerHTML = '<div class="MarketplacePanel_marketplacePanel__x" style="width:360px"><div class="row" style="display:flex"><button>+ New Sell Listing</button><div class="MarketplacePanel_currentItem__x"><svg><use href="/sprites/items.svg#linen_boots"></use></svg></div><button>+ New Buy Listing</button></div></div>';
    });
    await page.waitForSelector(".mwia-history details", { timeout: 4000 }).catch(() => null);
    await page.click(".mwia-history-more summary").catch(() => null);
    await page.waitForFunction(() => /From your Pi/.test(document.querySelector(".mwia-history")?.textContent || ""), { timeout: 4000 }).catch(() => null);
    const told = await page.$eval(".mwia-history", (n) => n.textContent.replace(/\s+/g, " ")).catch(() => "");
    check("the box says the prices come from the Pi", /From your Pi: newest prices \d\d?:\d\d( [AP]M)?, read \d\d?:\d\d( [AP]M)?\./.test(told) && /Read the Pi now/.test(told), told.slice(-200));
    await page.screenshot({ path: path.join(shotDir, "pi-1-linked.png") });

    // Your orders on the Pi: the one open from the start, sent after the first read.
    const piOrders = () => readdirSync(path.join(piData, "orders")).flatMap((f) => readFileSync(path.join(piData, "orders", f), "utf8").trim().split("\n")).filter(Boolean).map((l) => JSON.parse(l));
    for (let k = 0; k < 40 && !piOrders().length; k++) await new Promise((r) => setTimeout(r, 200));
    const sent = piOrders();
    check("the order open at the start is on the Pi, once", sent.length === 1 && sent[0].order.id === 1 && sent[0].kind === "seen" && /^[0-9a-f]{16} \S+$/.test(sent[0].device) && sent[0].raw.price === 700, JSON.stringify(sent));
    // A sell listing window for Linen Boots, then a new order from it and the first one filling.
    await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", `<div class="listing-modal Modal_modalContainer__x"><div class="MarketplacePanel_header__x">Sell Listing</div>
        <div><svg><use href="/sprites/items.svg#linen_boots"></use></svg></div><div>Price (Best Sell Offer: <span class="MarketplacePanel_bestPrice__x">700</span>)</div>
        <div class="MarketplacePanel_priceInputs__x"><button>-</button><div class="field">700</div><button>+</button></div>
        <div>Quantity (You Have: 6)</div><div><input class="qty" value="6"></div><button>Post Sell Listing</button></div>`));
    await page.waitForSelector(".listing-modal .mwia-listprice button", { timeout: 4000 }).catch(() => null);
    await page.click('.listing-modal [data-listprice="0"]');
    await new Promise((r) => setTimeout(r, 400));
    await page.evaluate(() => document.querySelector(".listing-modal").remove());
    sendAll({ type: "market_listings_updated", endMarketListings: [order(2, 0, { orderQuantity: 6 }), order(1, 4)] });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem("mwia-order-queue") || "[]").length === 2, { timeout: 4000 }).catch(() => null);
    await page.$eval('.mwia-history [data-history-pi="sync"]', (b) => b.click());
    for (let k = 0; k < 40 && piOrders().length < 3; k++) await new Promise((r) => setTimeout(r, 200));
    const all = piOrders();
    const placed = all.find((e) => e.order.id === 2);
    check("a new order and a fill are sent; the new one with what the window said", all.length === 3 && all.some((e) => e.order.id === 1 && e.order.filled === 4) && placed?.prediction?.quantity === 6 && placed.prediction.clicked === "match" && placed.prediction.buttons.some((b) => b.h === 24), JSON.stringify(placed));
    await page.waitForFunction(() => /Your orders: all on the Pi, sent \d/.test(document.querySelector(".mwia-history")?.textContent || ""), { timeout: 4000 }).catch(() => null);
    const ordersTold = await page.$eval(".mwia-history", (n) => n.textContent.replace(/\s+/g, " ")).catch(() => "");
    check("the box says your orders are on the Pi", /Your orders: all on the Pi, sent \d\d?:\d\d/.test(ordersTold) && (await page.evaluate(() => localStorage.getItem("mwia-order-queue"))) === "[]", ordersTold.slice(-200));

    // The next hour: only it is sent.
    await stopPi();
    fileHour = H + 1;
    check("the Pi has fetched the next hour", await startPi());
    await page.$eval('.mwia-history [data-history-pi="sync"]', (b) => b.click());
    await page.waitForFunction(async (want) => {
        const req = indexedDB.open("mwia-price-history", 1);
        return await new Promise((resolve) => (req.onsuccess = () => {
            const get = req.result.transaction("meta").objectStore("meta").get("pi");
            get.onsuccess = () => resolve(get.result?.hour === want);
        }));
    }, { timeout: 8000, polling: 300 }, H + 1).catch(() => null);
    st = await decoded(page);
    check("the next hour comes in", st.price(BOOTS, H + 1) === 701 && st.price(BOOTS, H) === 700 && st.price(BOOTS, H - 25) === 125, JSON.stringify(st.pi));

    // The Pi down: the box says so, and this browser goes on saving prices itself.
    await stopPi();
    fileHour = H + 2;
    await page.$eval('.mwia-history [data-history-pi="sync"]', (b) => b.click());
    await page.waitForFunction(() => /can't be reached/.test(document.querySelector(".mwia-history")?.textContent || ""), { timeout: 8000 }).catch(() => null);
    const down = await page.$eval(".mwia-history", (n) => n.textContent.replace(/\s+/g, " ")).catch(() => "");
    check("the Pi down: the box says so", /Your Pi can't be reached \(.+\); last read \d\d?:\d\d( [AP]M)?\. Prices saved on this device fill in meanwhile\./.test(down), down.slice(-200));
    // Opening the Skilling tab fetches the market file, as always.
    await page.click(".mwia-launcher");
    await page.click('[data-tab="skilling"]');
    await page.waitForSelector(".mwia-skill-row", { timeout: 8000 }).catch(() => null);
    await page.waitForFunction(async (want) => {
        const req = indexedDB.open("mwia-price-history", 1);
        return await new Promise((resolve) => (req.onsuccess = () => {
            const get = req.result.transaction("hourly").objectStore("hourly").get(want);
            get.onsuccess = () => resolve(!!get.result);
        }));
    }, { timeout: 8000, polling: 300 }, H + 2).catch(() => null);
    st = await decoded(page);
    check("while the Pi is down this browser saves the hour itself", st.price(BOOTS, H + 2) === 702 && st.pi?.hour === H + 1);
    await page.click(".mwia-header [data-action=close]").catch(() => null);

    // Unlinked: the link is forgotten, the history stays.
    await page.$eval('.mwia-history [data-history-pi="unlink"]', (b) => b.click());
    await page.waitForFunction(() => /Saved every 30 min while the game is open, on this device/.test(document.querySelector(".mwia-history")?.textContent || ""), { timeout: 4000 }).catch(() => null);
    const after = await page.evaluate(() => ({ config: localStorage.getItem("mwia-pi"), text: document.querySelector(".mwia-history")?.textContent || "" }));
    st = await decoded(page);
    check("unlinked: the link is forgotten, the history stays", after.config === null && /on this device/.test(after.text) && st.price(BOOTS, H - 20) === 520);

    // A Pi that fell behind (it can't reach the market): its hours from 16 days ago, for a day
    // this browser has already summed up, leave that day as it is.
    const staleDir = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-pi-stale-"));
    const day = Math.floor(H / 24) - 16;
    const stale = openStore(staleDir);
    for (let k = 0; k < 6; k++) stale.addFile(piFile(day * 24 + k, 900));
    const STALE_PORT = PI_PORT + 1;
    const stalePi = spawn("node", [path.join(root, "pi/server.mjs")], { env: { ...process.env, MWIA_KEY: KEY, MWIA_DATA: staleDir, PORT: String(STALE_PORT), MWIA_MARKET_URL: "http://127.0.0.1:1/", MWIA_ORIGINS: origin }, stdio: "ignore" });
    try {
        await page.evaluate(({ day, i, count }) => new Promise((resolve) => {
            const req = indexedDB.open("mwia-price-history", 1);
            req.onsuccess = () => {
                const a = new Float32Array(count).fill(NaN);
                a[i] = 111;
                const tx = req.result.transaction("daily", "readwrite");
                tx.objectStore("daily").put({ day, a, b: new Float32Array(count).fill(NaN), n: new Uint8Array(count).fill(24) });
                tx.oncomplete = resolve;
            };
        }), { day, i: st.items.indexOf(BOOTS), count: st.items.length });
        for (let k = 0; k < 50 && !(await fetch(`http://127.0.0.1:${STALE_PORT}/status`).then((r) => r.ok).catch(() => false)); k++) await new Promise((r) => setTimeout(r, 100));
        await page.goto("about:blank");
        await page.goto(`${origin}/#mwia-pi=${Buffer.from(JSON.stringify({ u: `http://127.0.0.1:${STALE_PORT}`, k: KEY })).toString("base64url")}`);
        await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });
        await page.waitForFunction(async (want) => {
            const req = indexedDB.open("mwia-price-history", 1);
            return await new Promise((resolve) => (req.onsuccess = () => {
                const get = req.result.transaction("meta").objectStore("meta").get("pi");
                get.onsuccess = () => resolve(get.result?.hour === want);
            }));
        }, { timeout: 10000, polling: 300 }, day * 24 + 5).catch(() => null);
        const kept = await page.evaluate(({ day }) => new Promise((resolve) => {
            const req = indexedDB.open("mwia-price-history", 1);
            req.onsuccess = () => {
                const tx = req.result.transaction(["daily", "hourly", "meta"], "readonly");
                const d = tx.objectStore("daily").get(day);
                const hours = tx.objectStore("hourly").getAllKeys(IDBKeyRange.bound(day * 24, day * 24 + 23));
                const items = tx.objectStore("meta").get("items");
                const pi = tx.objectStore("meta").get("pi");
                tx.oncomplete = () => resolve({ ask: d.result && !d.result.idx ? d.result.a[items.result.indexOf("/items/linen_boots")] : null, hours: hours.result.length, piHour: pi.result?.hour });
            };
        }), { day });
        check("a Pi that fell behind leaves a day summed up here as it is", kept.ask === 111 && kept.hours === 0 && kept.piHour === day * 24 + 5, JSON.stringify(kept));
        const behind = await decoded(page);
        check("…and the newer hours stay", behind.price(BOOTS, H + 2) === 702 && behind.price(BOOTS, H - 20) === 520);
    } finally {
        stalePi.kill();
    }
    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
    if (pi && pi.exitCode === null) pi.kill();
}
console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
