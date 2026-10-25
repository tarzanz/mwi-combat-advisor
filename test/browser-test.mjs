// End-to-end check in a real Firefox: a fake game page + fake game socket,
// the built userscript injected first, then the panel is driven like a user would.
// Usage: node test/browser-test.mjs <marketplace.json> <screenshot-dir> [mwitools.user.js]
// MOBILE=1 runs it at iPhone size (390×844) with a touch screen's "(hover: none)".
import { readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { WebSocketServer } from "ws";
import { fixtureCharacter } from "./fixture-character.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [marketFile, shotDir, mwitoolsFile] = process.argv.slice(2);
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");
const MOBILE = !!process.env.MOBILE;
const TOUCH_STUB = `<script>{ const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => (q === "(hover: none)" ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} } : real(q)); }</script>`;

const server = http.createServer((req, res) => {
    if (req.url === "/") {
        res.setHeader("content-type", "text/html");
        res.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${MOBILE ? TOUCH_STUB : ""}<script src="/advisor.user.js"></script>${mwitoolsFile ? '<script src="/gm-shim.js"></script><script src="/mwitools.user.js"></script>' : ""}</head>
          <body style="background:#0b0e1a;color:#ddd;font-family:sans-serif"><h1>Fake game</h1>
          <script>
            const xhr = new XMLHttpRequest(); xhr.open("GET", "/client-data.json", false); xhr.send();
            const data = JSON.parse(xhr.responseText);
            window.localStorageUtil = { getInitClientData: () => data };
            const ws = new WebSocket("ws://" + location.host + "/fake/api.milkywayidle.com/ws");
            ws.onmessage = (e) => { window.lastType = JSON.parse(e.data).type; };
          </script></body></html>`);
    } else if (req.url === "/advisor.user.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(userscript);
    } else if (req.url === "/gm-shim.js") {
        // Minimal stand-ins for the userscript-manager functions the Shopping List script uses.
        res.setHeader("content-type", "text/javascript");
        res.end(`(() => {
          const get = (k, d) => { const v = localStorage.getItem("gm:" + k); return v === null ? d : JSON.parse(v); };
          const set = (k, v) => localStorage.setItem("gm:" + k, JSON.stringify(v));
          const list = () => Object.keys(localStorage).filter((k) => k.startsWith("gm:")).map((k) => k.slice(3));
          Object.assign(window, {
            GM_getValue: get, GM_setValue: set, GM_listValues: list,
            GM_deleteValue: (k) => localStorage.removeItem("gm:" + k),
            GM_getValues: (keys) => Object.fromEntries((Array.isArray(keys) ? keys : Object.keys(keys)).map((k) => [k, get(k, Array.isArray(keys) ? undefined : keys[k])])),
            GM_setValues: (o) => Object.entries(o).forEach(([k, v]) => set(k, v)),
            GM_deleteValues: (ks) => ks.forEach((k) => localStorage.removeItem("gm:" + k)),
            GM_addValueChangeListener: () => 0, GM_notification: () => {},
            GM_info: { script: { name: "MWITools", version: "test" }, scriptHandler: "Violentmonkey" },
            GM_addStyle: (css) => { const s = document.createElement("style"); s.textContent = css; (document.head || document.documentElement).appendChild(s); return s; },
            GM_xmlhttpRequest: (o) => { fetch(o.url).then((r) => r.text()).then((t) => o.onload?.({ status: 200, responseText: t, response: t })).catch((e) => o.onerror?.(e)); },
            unsafeWindow: window,
          });
          window.GM = { xmlHttpRequest: (o) => new Promise((res) => window.GM_xmlhttpRequest({ ...o, onload: (r) => { o.onload?.(r); res(r); } })) };
        })();`);
    } else if (req.url === "/mwitools.user.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(readFileSync(mwitoolsFile));
    } else if (req.url === "/client-data.json") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(clientData));
    } else if (req.url.startsWith("/game_data/marketplace.json")) {
        res.setHeader("content-type", "application/json");
        res.end(readFileSync(marketFile));
    } else {
        res.statusCode = 404;
        res.end();
    }
});
const wss = new WebSocketServer({ server });
wss.on("connection", (socket) => {
    socket.send(JSON.stringify(fixtureCharacter()));
    // A later equipment change, to check incremental updates are applied.
    setTimeout(() => socket.send(JSON.stringify({ type: "items_updated", endCharacterItems: [{ hash: "h7", itemHrid: "/items/linen_gloves", itemLocationHrid: "/item_locations/hands", enhancementLevel: 0, count: 1 }] })), 300);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
if (process.env.SERVE_ONLY) {
    console.log(url);
    await new Promise(() => {}); // keep serving for manual debugging
}

let failures = 0;
const document_has_progress = (text) => /Testing upgrades|Simulating zones/.test(text);
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const browser = await puppeteer.launch({ browser: "firefox", executablePath: "/usr/bin/firefox", headless: true });
try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
    await page.setViewport(MOBILE ? { width: 390, height: 844 } : { width: 1300, height: 1000 });
    await page.goto(url);
    await page.waitForFunction(() => window.lastType === "items_updated", { timeout: 10000 });
    check("game still receives its messages through the hook", true);

    if (mwitoolsFile) {
        // MWITools shows a one-time welcome overlay over the whole page; a real player has dismissed it long ago.
        await page.waitForSelector(".mwi-performance-backdrop", { timeout: 15000 }).catch(() => {});
        await page.evaluate(() => document.querySelector(".mwi-performance-backdrop")?.parentElement?.remove());
    }
    if (MOBILE) {
        // Dragging the launcher moves it and must not open the panel.
        const before = await page.$eval(".mwia-launcher", (n) => n.getBoundingClientRect().toJSON());
        await page.mouse.move(before.x + 10, before.y + 10);
        await page.mouse.down();
        await page.mouse.move(before.x - 60, before.y - 200, { steps: 6 });
        await page.mouse.up();
        const after = await page.$eval(".mwia-launcher", (n) => n.getBoundingClientRect().toJSON());
        const opened = await page.$eval(".mwia-panel", (n) => !n.classList.contains("mwia-hidden"));
        const saved = await page.evaluate(() => localStorage.getItem("mwia-launcher-pos"));
        check("launcher can be dragged without opening the panel", Math.abs(after.y - (before.y - 210)) < 3 && !opened && !!saved, `${before.y} → ${after.y}, opened ${opened}`);
    }
    await page.click(".mwia-launcher");
    await page.waitForSelector(".mwia-panel:not(.mwia-hidden) .mwia-grid", { timeout: 10000 });
    if (MOBILE) {
        const fit = await page.evaluate(() => {
            const box = document.querySelector(".mwia-panel").getBoundingClientRect();
            return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, w: innerWidth, h: innerHeight, scroll: document.documentElement.scrollWidth };
        });
        check("phone: panel fills the screen without sideways scrolling", fit.left === 0 && fit.top === 0 && fit.right === fit.w && fit.bottom === fit.h && fit.scroll <= fit.w, JSON.stringify(fit));
    }
    const overview = await page.$eval(".mwia-body", (n) => n.innerText);
    check("overview shows levels", /Magic\s+21/.test(overview));
    check("overview reflects items_updated (Linen Gloves on hands)", /Hands\s+Linen Gloves/.test(overview));
    check("overview has tips", /Tips for your character/.test(overview));
    await page.screenshot({ path: path.join(shotDir, "1-overview.png") });

    await page.click('[data-tab="zones"]');
    await page.select('[data-setting="accuracy"]', "fast");
    await page.click('[data-action="zones"]');
    await page.waitForSelector(".mwia-reco", { timeout: 120000 });
    const zones = await page.$eval(".mwia-body", (n) => n.innerText);
    check("zone recommendation shown", /Recommendation:/.test(zones), zones.split("\n").find((l) => l.startsWith("Recommendation")));
    await page.screenshot({ path: path.join(shotDir, "2-zones.png") });
    if (MOBILE) {
        const card = await page.$eval(".mwia-wide tbody tr", (row) => ({
            display: getComputedStyle(row).display,
            title: row.querySelector(".mwia-card-title")?.textContent.trim(),
            labels: [...row.cells].map((c) => c.dataset.label),
        }));
        check("phone: zone table shows cards with labels", card.display === "grid" && !!card.title && card.labels.includes("Profit/day"), JSON.stringify(card));
        await page.click(".mwia-wide span[title]");
        const tipText = await page.$eval(".mwia-tip-pop", (n) => n.textContent).catch(() => null);
        check("phone: tapping a hint shows its text", !!tipText && tipText.length > 5, tipText);
        await page.screenshot({ path: path.join(shotDir, "2b-zones-tip.png") });
        await page.mouse.click(200, 300);
        check("phone: next tap hides the hint", !(await page.$(".mwia-tip-pop")));
    }

    await page.click('[data-tab="upgrades"]');
    await page.$eval('[data-setting="budget"]', (n) => { n.focus(); n.select(); });
    await page.keyboard.type("1,5M");
    await page.keyboard.press("Tab");
    const budgetShown = await page.$eval('[data-setting="budget"]', (n) => n.value);
    const budgetSaved = await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-settings")).budget);
    check("budget accepts 1,5M", budgetShown === "1.5M" && budgetSaved === 1500000, `${budgetShown} / ${budgetSaved}`);
    const t0 = Date.now();
    await page.click('[data-action="upgrades"]');
    await page.waitForFunction(() => document.querySelector(".mwia-body")?.innerText.includes("Recommended shopping list") && !document.querySelector(".mwia-progress"), { timeout: 300000 });
    const upgrades = await page.$eval(".mwia-body", (n) => n.innerText);
    console.log(`upgrade analysis took ${((Date.now() - t0) / 1000).toFixed(1)} s in the browser`);
    check("shopping list rendered", /Total one-time cost/.test(upgrades));
    check("combined effect verified", /Everything combined/.test(upgrades));
    // The plan's drinks and food are kept per zone for the game's combat window.
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-combat-setups") || "{}"));
    const savedZone = Object.values(saved)[0];
    const planDrink = /Drink (.+?) (in an empty slot|instead of)/.exec(upgrades)?.[1];
    check("plan's drinks and food saved for the combat window", savedZone && (!planDrink || savedZone.drinks.some((h) => clientData.itemDetailMap[h]?.name === planDrink)) && savedZone.food.includes("/items/donut") && savedZone.perHour["/items/donut"] > 0 && savedZone.encountersPerHour > 0,
        JSON.stringify(saved).slice(0, 300) + " plan drink " + planDrink);
    check("owned gloves not suggested again", !/Linen Gloves[^\n]*you own it/.test(upgrades));
    // On a phone the column names are card labels (CSS), not text.
    const headers = MOBILE ? await page.$$eval(".mwia-wide td", (cells) => cells.map((c) => c.dataset.label).join("|")) : upgrades;
    check("coin rates shown per day", /profit [^\n]*\/day/.test(upgrades) && /Extra cost\/day/.test(headers));
    check("confidence column shown", /Sure/.test(upgrades) && /\d+%/.test(upgrades));
    check("enhanced gear listed", /\+\d+\s/.test(upgrades.slice(upgrades.indexOf("Equipment\n"))));
    console.log(upgrades.slice(upgrades.indexOf("Zone:"), upgrades.indexOf("Equipment\n")));
    await page.screenshot({ path: path.join(shotDir, "3-upgrades.png"), fullPage: false });
    if (MOBILE) {
        const overflow = await page.$eval(".mwia-body", (n) => ({ scroll: n.scrollWidth, client: n.clientWidth }));
        check("phone: upgrade tables fit the width", overflow.scroll <= overflow.client + 1, JSON.stringify(overflow));
    }
    await page.$eval(".mwia-body", (n) => n.scrollTo(0, 99999));
    await page.screenshot({ path: path.join(shotDir, "4-upgrades-tables.png") });
    // XP–Gold slider: re-rates instantly without simulating again.
    const setFocus = (v) => page.$eval('[data-setting="goldWeight"]', (n, value) => { n.value = String(value); n.dispatchEvent(new Event("input", { bubbles: true })); n.dispatchEvent(new Event("change", { bubbles: true })); }, v);
    await setFocus(100);
    const goldText = await page.$eval(".mwia-body", (n) => n.innerText);
    check("slider at gold re-rates the list without a new run", /Gold only/.test(goldText) && /profit\/day/.test(goldText.slice(goldText.indexOf("Recommended shopping list"))) && !document_has_progress(goldText));
    check("gold focus: plan has no costly XP drink", !/Drink Wisdom Coffee/.test(goldText));
    await setFocus(50);
    check("mixed focus label", /50% XP · 50% gold/.test(await page.$eval(".mwia-focus-text", (n) => n.textContent)));
    await page.screenshot({ path: path.join(shotDir, "6-focus.png") });
    await setFocus(0);
    await page.$eval('[data-setting="acceptRareDeaths"]', (n) => { n.checked = true; n.dispatchEvent(new Event("change", { bubbles: true })); });
    check("accept rare deaths is saved", await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-settings")).acceptRareDeaths === true));
    await page.$eval('[data-setting="acceptRareDeaths"]', (n) => { n.checked = false; n.dispatchEvent(new Event("change", { bubbles: true })); });
    await page.click('[data-tab="zones"]');
    check("zones tab has the slider and profit column", await page.$eval(".mwia-body", (n) => !!n.querySelector('[data-setting="goldWeight"]') && (/Match/.test(n.innerText) || !!n.querySelector('td[data-label="Match"]'))));
    await page.click('[data-tab="upgrades"]');

    if (mwitoolsFile) {
        const ready = await page.waitForFunction(() => window.MWITools?.shopping?.ready, { timeout: 30000 }).then(() => true).catch(() => false);
        check("MWITools shopping API present and ready", ready, await page.evaluate(() => JSON.stringify({ api: !!window.MWITools?.shopping, ready: window.MWITools?.shopping?.ready })));
        const buttons = await page.$$eval(".mwia-plan .mwia-cart-btn", (b) => b.map((x) => x.title));
        check("cart buttons shown", buttons.length > 0, buttons[0]);
        await page.click(".mwia-plan .mwia-cart-btn");
        await page.waitForFunction(() => /Shopping cart: /.test(document.querySelector(".mwia-notice")?.textContent || ""), { timeout: 15000 });
        const notice1 = await page.$eval(".mwia-notice", (n) => n.textContent);
        await page.click('.mwia-body p .mwia-cart-btn');
        await page.waitForFunction((prev) => { const t = document.querySelector(".mwia-notice")?.textContent || ""; return t !== prev && /Shopping cart: /.test(t); }, { timeout: 15000 }, notice1);
        const notice2 = await page.$eval(".mwia-notice", (n) => n.textContent);
        // An enhanced item from the equipment table.
        const enhancedBtn = await page.$$eval(".mwia-wide .mwia-cart-btn", (b) => b.findIndex((x) => / \+\d+/.test(x.title)));
        if (enhancedBtn >= 0) {
            await page.evaluate((i) => document.querySelectorAll(".mwia-wide .mwia-cart-btn")[i].click(), enhancedBtn);
            await page.waitForFunction((prev) => (document.querySelector(".mwia-notice")?.textContent || "") !== prev, { timeout: 15000 }, notice2);
        }
        const notice3 = await page.$eval(".mwia-notice", (n) => n.textContent);
        console.log("   " + [notice1, notice2, notice3].join("\n   "));
        const cart = await page.evaluate(() => window.MWITools.shopping.getCartItems().map((i) => `${i.itemHrid}+${i.enhancementLevel}:${i.quantity}`));
        console.log("   cart: " + cart.join(", "));
        check("pouch in cart once with quantity 1", cart.filter((c) => c.startsWith("/items/small_pouch+")).length === 1 && cart.includes("/items/small_pouch+0:1"));
        check("mana food for a day in cart", cart.some((c) => /^\/items\/[a-z_]*(gummy|yogurt)\+0:\d{2,}$/.test(c)));
        check("enhanced item keeps its level", enhancedBtn < 0 || cart.some((c) => /\+[1-9]\d*:1$/.test(c)));
        await page.screenshot({ path: path.join(shotDir, "5-cart.png") });
    } else {
        await page.click(".mwia-plan .mwia-cart-btn");
        await page.waitForSelector(".mwia-notice-bad", { timeout: 5000 });
        check("without MWITools a click explains why", /cart was not found/.test(await page.$eval(".mwia-notice", (n) => n.textContent)));
    }
    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exitCode = failures ? 1 : 0;
