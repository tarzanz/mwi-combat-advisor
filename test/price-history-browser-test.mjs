// End-to-end check of the price history: seeds ten days of prices into the
// script's IndexedDB, then checks the box in a fake marketplace, the warning in
// the Skilling tab, and that a fresh market file is recorded.
// Usage: node test/price-history-browser-test.mjs <screenshot-dir>
// MOBILE=1 runs it at iPhone size. BROWSER_PATH picks another browser (Chromium).
import { readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { WebSocketServer } from "ws";
import { fixtureCharacter } from "./fixture-character.js";
import { shortCoins } from "../src/format.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir = "/tmp"] = process.argv.slice(2);
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");

const character = fixtureCharacter();
character.characterSkills.push({ skillHrid: "/skills/tailoring", level: 20, experience: 0 });

// Market now: three times the vendor price. Linen Boots' history sits 30% lower,
// so it sells above its usual price now.
const ITEM = "/items/linen_boots";
const marketData = {};
for (const item of Object.values(clientData.itemDetailMap)) marketData[item.hrid] = { 0: { a: 3 * (item.sellPrice || 1), b: item.sellPrice || 1 } };
// Linen Boots +3 has its own market and history.
marketData[ITEM][3] = { a: 9500, b: 8000 };
// Linen Fabric: asks at 1,000, two hours in eight at 1,040; 100 traded an hour at 990.
const FABRIC = "/items/linen_fabric";
marketData[FABRIC] = { 0: { a: 1040, b: 960, p: 990, v: 100 } };
const askNow = marketData[ITEM][0].a;
const usualAsk = Math.round(askNow / 1.3);
const usualBid = marketData[ITEM][0].b;
let fileTimestamp = 1700000000;

const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/advisor.user.js"></script>
<style>body{background:#0b0e1a;color:#ddd;font-family:sans-serif}</style></head><body>
<div id="market" style="width:360px"></div>
<script>
  const xhr = new XMLHttpRequest(); xhr.open("GET", "/client-data.json", false); xhr.send();
  const data = JSON.parse(xhr.responseText);
  window.localStorageUtil = { getInitClientData: () => data };
  const ws = new WebSocket("ws://" + location.host + "/fake/api.milkywayidle.com/ws");
  ws.onmessage = (e) => { window.lastType = JSON.parse(e.data).type; };
</script></body></html>`;

const server = http.createServer((req, res) => {
    if (req.url === "/") {
        res.setHeader("content-type", "text/html");
        res.end(page_html);
    } else if (req.url === "/advisor.user.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(userscript);
    } else if (req.url.startsWith("/game_data/marketplace.json")) {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ marketData, timestamp: fileTimestamp }));
    } else if (req.url === "/client-data.json") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(clientData));
    } else {
        res.statusCode = 404;
        res.end();
    }
});
const wss = new WebSocketServer({ server });
const sockets = [];
wss.on("connection", (socket) => {
    sockets.push(socket);
    socket.send(JSON.stringify(character));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewport(process.env.MOBILE ? { width: 390, height: 844 } : { width: 1300, height: 900 });
    await page.goto(url);
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });

    // Ten days of history, a point every 2 hours, ending an hour ago.
    const seeded = await page.evaluate(async ({ item, usualAsk, usualBid }) => {
        const open = () => new Promise((resolve, reject) => {
            const req = indexedDB.open("mwia-price-history", 1);
            req.onupgradeneeded = () => { const db = req.result; db.createObjectStore("hourly", { keyPath: "hour" }); db.createObjectStore("daily", { keyPath: "day" }); db.createObjectStore("meta"); };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
        const db = await open();
        const tx = db.transaction(["hourly", "meta"], "readwrite");
        const nowHour = Math.floor(Date.now() / 3600000) - 1;
        let n = 0;
        // Linen Gloves: only the last 18 hours, every hour – enough hours, too few days.
        for (let age = 10 * 24; age >= 0; age -= age < 18 ? 1 : 2) {
            const hour = nowHour - age;
            const fabric = hour % 8 < 2 ? 1040 : 1000;
            tx.objectStore("hourly").put({ hour, a: new Float32Array([usualAsk, age < 18 ? 500 : NaN, 9000, fabric]), b: new Float32Array([usualBid, age < 18 ? 400 : NaN, 8000, 960]),
                p: new Float32Array([NaN, NaN, NaN, 990]), v: new Float32Array([NaN, NaN, NaN, 100]), sold: true });
            n++;
        }
        tx.objectStore("meta").put([item, "/items/linen_gloves", item + "+3", "/items/linen_fabric"], "items");
        await new Promise((r) => (tx.oncomplete = r));
        db.close();
        return n;
    }, { item: ITEM, usualAsk, usualBid });
    check("history seeded", seeded > 100, `${seeded} points`);
    await page.reload();
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });

    // Opening the Skilling tab fetches prices, which are recorded too.
    await page.click(".mwia-launcher");
    await page.click('[data-tab="skilling"]');
    await page.waitForSelector(".mwia-skill-row", { timeout: 8000 });
    await page.select('[data-setting="skillingSkill"]', "tailoring");
    await new Promise((r) => setTimeout(r, 300));
    const warn = await page.$eval('.mwia-skill-row[data-hrid="/actions/tailoring/linen_boots"] .mwia-skill-name .mwia-warn', (n) => n.title).catch(() => "");
    check("Skilling warns when the selling price is above usual", /Linen Boots sells 30% above its usual price \(7-day median /.test(warn), warn);
    const recorded = await page.evaluate(() => new Promise((resolve) => {
        const req = indexedDB.open("mwia-price-history", 1);
        req.onsuccess = () => {
            const tx = req.result.transaction(["meta"], "readonly");
            const get = tx.objectStore("meta").get("last");
            get.onsuccess = () => resolve(get.result);
        };
    }));
    check("fresh market file recorded", recorded === fileTimestamp, String(recorded));
    // The new hour is stored as changes from the old full hour before it (a key record on a new day).
    const storedNow = await page.evaluate(() => new Promise((resolve) => {
        const req = indexedDB.open("mwia-price-history", 1);
        req.onsuccess = () => {
            const tx = req.result.transaction(["hourly", "meta"], "readonly");
            const all = tx.objectStore("hourly").getAll();
            const items = tx.objectStore("meta").get("items");
            tx.oncomplete = () => {
                const last = all.result[all.result.length - 1];
                const before = all.result[all.result.length - 2];
                resolve({ idx: last.idx ? last.idx.length : null, count: last.count, key: last.key, newDay: Math.floor(last.hour / 24) !== Math.floor(before.hour / 24), oldFormat: !before.idx });
            };
        };
    }));
    check("new hours are stored as changes after old full ones", storedNow.idx !== null && storedNow.oldFormat && storedNow.key === storedNow.newDay, JSON.stringify(storedNow));

    // The marketplace: the open item's usual price, trend and chart.
    await page.click(".mwia-header [data-action=close]");
    await page.evaluate(() => {
        // Like the game: the item icon sits between the sell and buy buttons in one row.
        document.getElementById("market").innerHTML = '<div class="MarketplacePanel_marketplacePanel__x" style="width:360px;height:700px;display:flex;flex-direction:column">' +
            '<div class="MarketplacePanel_orderBooksContainer__x"><div>Tradable range: 1200 – 1470</div><div class="row" style="display:flex;justify-content:space-between;align-items:center;width:60%;margin:auto"><button>+ New Sell Listing</button>' +
            '<div class="MarketplacePanel_currentItem__x" style="width:60px"><svg width="40" height="40"><use href="/sprites/items.svg#linen_boots"></use></svg>2084</div><button>+ New Buy Listing</button></div>' +
            '<div class="MarketplacePanel_orderBook__x">order book</div></div></div>';
    });
    await page.waitForSelector(".mwia-history", { timeout: 4000 }).catch(() => null);
    await page.waitForFunction(() => /Ask/.test(document.querySelector(".mwia-history")?.textContent || ""), { timeout: 4000 }).catch(() => null);
    const box = await page.$$eval(".mwia-history tr", (trs) => trs.map((tr) => [...tr.cells].map((c) => c.textContent.replace(/\s+/g, " ").trim()).join(" | ")).join("\n")).catch(() => "");
    check("marketplace shows the usual price", box.includes(`Ask | ${shortCoins(askNow)} | ${shortCoins(usualAsk)} +30% above | ${shortCoins(usualAsk)} | →`) && box.includes(`Bid | ${shortCoins(usualBid)} | ${shortCoins(usualBid)} +0% usual`), box);
    const placed = await page.evaluate(() => {
        const box = document.querySelector(".mwia-history");
        return { width: box.getBoundingClientRect().width, height: box.getBoundingClientRect().height, inRow: !!box.closest(".row"), beforeRow: !!box.nextElementSibling?.querySelector(".row") };
    });
    check("box sits above the button row, full width", placed.width >= 340 && !placed.inRow && placed.beforeRow, JSON.stringify(placed));
    check("box is only as tall as its content in a column layout", placed.height < 260, JSON.stringify(placed));
    // Folded: one summary line; the table and chart open under it.
    const folded = await page.$eval(".mwia-history", (n) => ({ sum: n.querySelector(".mwia-history-sum")?.textContent.replace(/\s+/g, " ").trim(), height: n.getBoundingClientRect().height, open: n.querySelector("details").open }));
    check("folded box: a summary line and little height", !folded.open && folded.height < 110 && folded.sum === `Ask ${shortCoins(askNow)} +30% above → · Bid ${shortCoins(usualBid)} +0% usual → · swings ±0%`, JSON.stringify(folded));
    await page.click(".mwia-history-more summary");
    await page.waitForFunction(() => document.querySelectorAll(".mwia-history polyline").length === 2, { timeout: 4000 }).catch(() => null);
    check("marketplace chart drawn when unfolded", await page.$$eval(".mwia-history polyline", (lines) => lines.length === 2) && await page.$eval(".mwia-history details", (d) => d.open));
    // Axes: the highest price at the top and the lowest at the bottom, dates along the bottom.
    const axes = await page.$eval(".mwia-history", (n) => ({ y: [...n.querySelectorAll(".mwia-history-y span")].map((s) => s.textContent), x: [...n.querySelectorAll(".mwia-history-x span")].map((s) => s.textContent), yTop: n.querySelector(".mwia-history-y span")?.getBoundingClientRect().top, yBottom: n.querySelector(".mwia-history-y span:last-child")?.getBoundingClientRect().top }));
    check("chart: prices up the side, dates along the bottom", axes.y[0] === shortCoins(askNow) && axes.y[1] === shortCoins(usualBid) && axes.yTop < axes.yBottom && axes.x.length === 3 && axes.x.every((d) => /^[A-Z][a-z]{2} \d{1,2}$/.test(d)), JSON.stringify(axes));
    await page.screenshot({ path: path.join(shotDir, "history-1-market.png") });
    // Export: prepare, then copy the CSV.
    await browser.defaultBrowserContext().overridePermissions(url, ["clipboard-read", "clipboard-write", "clipboard-sanitized-write"]).catch(() => null);
    await page.click('.mwia-history [data-history-export="prepare"]');
    await page.waitForSelector('.mwia-history [data-history-export="copy"]', { timeout: 4000 }).catch(() => null);
    const ready = await page.$eval(".mwia-history-export", (n) => n.textContent.replace(/\s+/g, " ")).catch(() => "");
    check("export prepared", /\d+ items · \d+ hours · 0 days · \d+ kB/.test(ready), ready);
    await page.click('.mwia-history [data-history-export="copy"]');
    await page.waitForFunction(() => /Copied|Could not copy/.test(document.querySelector(".mwia-history")?.textContent || ""), { timeout: 3000 }).catch(() => null);
    const copied = await page.evaluate(() => navigator.clipboard.readText().catch((e) => "error " + e.message));
    check("export copies the CSV", copied.startsWith("# MWI Advisor price history") && copied.includes(",hours,sold_mean,sold_hours,sold_price\n") && copied.includes(`,linen_boots,${usualAsk},${usualBid}`) && /\nhour,\d{4}-\d\d-\d\dT\d\d,linen_gloves,500,400\n/.test(copied), copied.slice(0, 200));
    await page.click('.mwia-history [data-range="365"]');
    await new Promise((r) => setTimeout(r, 600));
    check("1-year view", await page.$eval('.mwia-history [data-range="365"]', (b) => b.classList.contains("mwia-active")));

    // A +level: its own prices and history, from the "+3" on the icon.
    await page.evaluate(() => {
        document.querySelector('[class*="MarketplacePanel_currentItem"]').innerHTML = '<svg><use href="/sprites/items.svg#linen_boots"></use></svg><div><span>+3</span></div><span>2084</span>';
    });
    await page.waitForFunction(() => /\+3/.test(document.querySelector(".mwia-history-head")?.textContent || ""), { timeout: 4000 }).catch(() => null);
    const plus = await page.$eval(".mwia-history", (n) => ({ head: n.querySelector(".mwia-history-head")?.textContent.replace(/\s+/g, " "), sum: n.querySelector(".mwia-history-sum")?.textContent.replace(/\s+/g, " ").trim() })).catch(() => ({}));
    check("a +level shows its own prices", /Usual price \+3/.test(plus.head || "") && plus.sum?.startsWith(`Ask ${shortCoins(9500)} +6% usual`) && plus.sum.includes(`Bid ${shortCoins(8000)} +0% usual`), JSON.stringify(plus));

    // An item with enough hours but not two days shows preliminary numbers.
    await page.evaluate(() => {
        document.querySelector('[class*="MarketplacePanel_currentItem"]').innerHTML = '<svg><use href="/sprites/items.svg#linen_gloves"></use></svg> Linen Gloves';
    });
    await page.waitForFunction(() => /preliminary/.test(document.querySelector(".mwia-history")?.textContent || ""), { timeout: 4000 }).catch(() => null);
    const prelim = await page.$eval(".mwia-history", (n) => n.textContent.replace(/\s+/g, " ")).catch(() => "");
    check("enough hours but too few days: preliminary numbers", /preliminary · ready in about 1\.3 days/.test(prelim) && /Preliminary: 12 h ✓ · 0\.7 of 2 days · ready in about 1\.3 days\./.test(prelim) && /Ask1,728 500 \+246% above/.test(prelim) && /Only \d+ h over 0\.\d days/.test(prelim), prelim.slice(0, 300));
    await page.screenshot({ path: path.join(shotDir, "history-2-preliminary.png") });

    // Another item without history says it is still collecting.
    await page.evaluate(() => {
        document.querySelector('[class*="MarketplacePanel_currentItem"]').innerHTML = '<svg><use href="/sprites/items.svg#cotton"></use></svg> Cotton';
    });
    await page.waitForFunction(() => /collecting/.test(document.querySelector(".mwia-history")?.textContent || ""), { timeout: 4000 }).catch(() => null);
    const collecting = await page.$eval(".mwia-history", (n) => n.textContent).catch(() => "");
    check("an item with little history says it is collecting", /collecting: 1 of 12 h · 0\.0 of 2 days · ready in about 2 days and 11 more h with the game open/.test(collecting), collecting.slice(0, 120));

    // A sell listing window: the prices that sell within 1, 8 and 24 h, from the hours above and the order book.
    const fabricBook = { type: "market_item_order_books_updated", marketItemOrderBooks: { itemHrid: FABRIC, orderBooks: [{ asks: [{ price: 1040, quantity: 50 }, { price: 1080, quantity: 500 }], bids: [{ price: 960, quantity: 100 }] }] } };
    for (const socket of sockets) socket.send(JSON.stringify(fabricBook));
    await page.waitForFunction(() => window.lastType === "market_item_order_books_updated");
    await page.evaluate(() => {
        // Like the game's window (steps of 10 here), at phone width.
        document.body.insertAdjacentHTML("beforeend", `<div class="listing-modal Modal_modalContainer__3B80m" style="position:fixed;top:40px;left:50px;z-index:99;width:280px;background:#111;padding:8px"><div class="MarketplacePanel_header__yahJo">Sell Listing</div>
            <div><svg><use href="/sprites/items.svg#linen_fabric"></use></svg></div><div>Tradable range: 900 – 1 200</div>
            <div>Price (Best Sell Offer: <span class="MarketplacePanel_bestPrice__x">1 040</span>)</div>
            <div class="MarketplacePanel_priceInputs__x"><button>Min</button><button>-</button><div class="field">1 040</div><button>+</button><button>Max</button></div>
            <div>Quantity (You Have: 20)</div><div><button>1</button><input class="qty" value="20"><button>Max</button></div>
            <button>Post Sell Listing</button></div>`);
        const input = document.querySelector(".listing-modal .field");
        const [, minus, plus] = document.querySelectorAll(".listing-modal .MarketplacePanel_priceInputs__x button");
        const value = () => Number(input.firstChild.nodeValue.replace(/\s/g, ""));
        const set = (v) => (input.firstChild.nodeValue = String(v).replace(/\B(?=(\d{3})+(?!\d))/g, " "));
        minus.onclick = () => set(Math.ceil(value() / 10) * 10 - 10);
        plus.onclick = () => set(Math.floor(value() / 10) * 10 + 10);
    });
    const listing = () => page.evaluate(() => ({
        buttons: [...document.querySelectorAll(".listing-modal .mwia-listprice button")].map((b) => `${b.querySelector("b").textContent} ${b.querySelector("small").textContent}`),
        titles: [...document.querySelectorAll(".listing-modal .mwia-listprice button")].map((b) => b.title),
        price: document.querySelector(".listing-modal .field").textContent.replace(/\s/g, ""),
    }));
    await page.waitForFunction(() => document.querySelectorAll(".listing-modal .mwia-listprice button").length === 5, { timeout: 4000 }).catch(() => null);
    const horizons = await listing();
    check("listing window: match, wall and the prices for 1, 8 and 24 h", JSON.stringify(horizons.buttons) === JSON.stringify(["Match 1,040", "Wall < 1,080", "<1h < 1,040", "<8h 1,040", "<24h 1,040"]), JSON.stringify(horizons.buttons));
    check("a horizon says what it rests on", /^One step under the best offer \(1,040\): first in line now\. A 70% chance that 70% of 20 sells within 1 h – it did in 100% of \d+ past stretches of 1 h\. Buyers take about \d+ an hour/.test(horizons.titles[2]), horizons.titles[2]);
    const rows = await page.$eval(".listing-modal .mwia-listprice-buttons", (n) => new Set([...n.children].map((b) => Math.round(b.getBoundingClientRect().top))).size);
    check("five buttons fit one row at phone width", rows === 1, `${rows} rows`);
    await page.screenshot({ path: path.join(shotDir, "history-3-listing.png") });
    await page.click('.listing-modal [data-listprice="2"]');
    await page.waitForFunction(() => document.querySelector(".listing-modal .field").textContent.replace(/\s/g, "") === "1030", { timeout: 4000 }).catch(() => null);
    check("<1h: one step under the best offer", (await listing()).price === "1030", (await listing()).price);
    // 2,000 is far more than buyers take in a day: no price, and why.
    await page.evaluate(() => (document.querySelector(".listing-modal .qty").value = "2000"));
    await page.waitForFunction(() => /<1h —/.test(document.querySelector(".listing-modal .mwia-listprice")?.textContent.replace(/\s+/g, " ") || "x"), { timeout: 4000 }).catch(() => null);
    const tooMany = await listing();
    check("too many to sell in time: no price, and why", JSON.stringify(tooMany.buttons.slice(2)) === JSON.stringify(["<1h —", "<8h —", "<24h —"]) && /^2,000 is about \d+ h of what buyers take .*: 70% of it can't go within 1 h at any price\.$/.test(tooMany.titles[2]) && /^70% of 2,000 takes about \d+ h first in line .*in 70% of past stretches of 24 h\.$/.test(tooMany.titles[4]), JSON.stringify(tooMany));
    await page.click('.listing-modal [data-listprice="2"]');
    const tip = await page.$eval(".mwia-tip-pop", (n) => n.textContent).catch(() => "");
    check("a button without a price shows why when tapped", /can't go within 1 h at any price/.test(tip) && (await listing()).price === "1030", tip);
    await page.evaluate(() => document.querySelector(".listing-modal").remove());

    // Closing the market removes the box.
    await page.evaluate(() => (document.getElementById("market").innerHTML = ""));
    await new Promise((r) => setTimeout(r, 800));
    check("box goes with the market", !(await page.$(".mwia-history")));
    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
