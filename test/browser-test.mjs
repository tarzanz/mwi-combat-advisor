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
// The simulator repo has no level table; a synthetic one like the game's lets "Count levels" work.
clientData.levelExperienceTable ??= Array.from({ length: 201 }, (_, level) => Math.round(30 * level ** 2.2));
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
let gameSocket = null;
wss.on("connection", (socket) => {
    gameSocket = socket;
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

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => { if (m.type() === "error" && !/favicon/.test(m.location()?.url || "")) errors.push(m.text() + " " + (m.location()?.url || "")); });
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
    const launcher = await page.$eval(".mwia-launcher", (n) => n.getBoundingClientRect().toJSON());
    check("launcher is a small round button, still easy to tap", launcher.width >= 36 && launcher.width <= 44 && launcher.height === launcher.width, `${launcher.width}×${launcher.height}`);
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
    check("overview shows the total level and the next pouch", /Total level \d+/.test(overview) && /unlocks the Medium Pouch|unlocks the \w+ Pouch/.test(overview), overview.split("\n").find((l) => /levels to/.test(l)));
    check("overview suggests training an untrained style", /Ranged is only level 1/.test(overview));
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
    const headings = await page.$$eval(".mwia-body h3", (hs) => hs.map((h) => h.textContent));
    check("house rooms tested", headings.includes("House") && /(Mystical Study|Armory|Library|Gym|Dojo|Archery Range|Dining Room)\s+lvl 0 → 1/.test(upgrades));
    check("more skill levels shown with the time to get there", /More levels \(not for sale\)/.test(upgrades) && /Magic\s+21 → 26/.test(upgrades) && /\d+(\.\d)? (h|days|min)/.test(upgrades.slice(upgrades.indexOf("More levels"))));
    check("ability order section", /Ability order/.test(upgrades));
    check("triggers section", /\nTriggers\n/.test(upgrades), upgrades.slice(upgrades.indexOf("\nTriggers\n"), upgrades.indexOf("\nTriggers\n") + 200));
    check("what you take off is counted as sold", /− [\d.,]+k? selling your/.test(upgrades) || /\*/.test(upgrades.slice(upgrades.indexOf("Equipment\n"))));
    check("gear you can enhance yourself is offered", /🔨 enhance yourself/.test(upgrades) || /enhance it to \+\d+ yourself/.test(upgrades));
    console.log(upgrades.slice(upgrades.indexOf("Zone:"), upgrades.indexOf("Equipment\n")));
    await page.screenshot({ path: path.join(shotDir, "3-upgrades.png"), fullPage: false });
    await page.evaluate(() => [...document.querySelectorAll(".mwia-body h3")].find((h) => h.textContent === "Ability order")?.scrollIntoView());
    await page.screenshot({ path: path.join(shotDir, "3b-house-levels.png"), fullPage: false });
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

    // Count levels: re-rates without a new run, labels in levels.
    await page.$eval('[data-setting="countLevels"]', (n) => { n.checked = true; n.dispatchEvent(new Event("change", { bubbles: true })); });
    const levelText = await page.$eval(".mwia-body", (n) => n.innerText);
    const levelLine = levelText.split("\n").find((l) => l.startsWith("Zone:")) || "";
    check("count levels re-rates in levels/day without a new run", /Now: \d+\.\d\d Levels\/day/.test(levelLine) && !document_has_progress(levelText), levelLine);
    await page.$eval('[data-setting="countLevels"]', (n) => { n.checked = false; n.dispatchEvent(new Event("change", { bubbles: true })); });

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
    // Abilities & triggers only: no gear, house rooms or consumables, and a good deal quicker.
    const t1 = Date.now();
    await page.click('[data-action="upgrades-abilities"]');
    await page.waitForFunction(() => document.querySelector(".mwia-body")?.innerText.includes("Only abilities and triggers were tested") && !document.querySelector(".mwia-progress"), { timeout: 300000 });
    const abilitiesOnly = await page.$eval(".mwia-body", (n) => n.innerText);
    const onlyHeadings = await page.$$eval(".mwia-body h3", (hs) => hs.map((h) => h.textContent));
    console.log(`abilities & triggers took ${((Date.now() - t1) / 1000).toFixed(1)} s in the browser`);
    check("abilities & triggers only: abilities, order and triggers, no gear or food", ["Abilities", "Ability order", "Triggers"].every((h) => onlyHeadings.includes(h)) && !["Equipment", "House", "Food", "Drinks"].some((h) => onlyHeadings.includes(h)), onlyHeadings.join(", "));
    check("abilities & triggers only: nothing to buy but abilities", !/Buy [^\n]* in (Head|Body|Legs|Feet|Hands|Weapon|Pouch)/.test(abilitiesOnly));
    await page.evaluate(() => [...document.querySelectorAll(".mwia-body h3")].find((h) => h.textContent === "Triggers")?.scrollIntoView());
    await page.screenshot({ path: path.join(shotDir, "4b-triggers.png") });
    // Reading the game's trigger window: says so when none is open, else lists its parts (nothing is changed).
    await page.click('[data-action="trigger-window"]');
    check("trigger window: none open is said", /No Combat Triggers window is open/.test(await page.$eval(".mwia-notice", (n) => n.textContent)));
    await page.evaluate(() => {
        const box = document.createElement("div");
        box.className = "Modal_modal__x";
        box.innerHTML = `<div class="CombatTriggersSetting_title">Combat Triggers</div>
          <div class="CombatTriggersSetting_condition"><select class="CombatTriggerSelect_a"><option value="/combat_trigger_dependencies/all_enemies">Enemies' Total</option></select>
          <select><option value="/combat_trigger_conditions/number_of_active_units"># of Active Units</option></select>
          <select><option value="/combat_trigger_comparators/greater_than_equal">&gt;=</option></select><input type="number" value="3"><button>🗑</button></div>
          <button>+ Condition</button><button>Reset Default</button><button>Save</button>`;
        document.body.appendChild(box);
    });
    await page.click('[data-action="trigger-window"]');
    const report = await page.$eval(".mwia-notice", (n) => n.textContent);
    check("trigger window: its dropdowns, value and buttons are read", /trigger window: div\.CombatTriggersSetting_title/.test(report) && /options: \/combat_trigger_dependencies\/all_enemies=Enemies' Total/.test(report) && /input \(type=number value=3/.test(report) && /"Save"/.test(report), report.slice(0, 400));
    await page.evaluate(() => document.querySelector(".Modal_modal__x").remove());
    // Fight as Ranged: a bow or crossbow is put first on the shopping list, zones are simulated with it.
    await page.click('[data-tab="zones"]');
    await page.select('[data-setting="combatStyle"]', "ranged");
    await page.click('[data-action="zones"]');
    await page.waitForSelector(".mwia-reco", { timeout: 120000 });
    const rangedZones = await page.$eval(".mwia-body", (n) => n.innerText);
    check("ranged: zones simulated with a ranged weapon", /Simulated with (Wooden|Birch|Cedar) (Bow|Crossbow)/.test(rangedZones), rangedZones.split("\n").find((l) => l.startsWith("Simulated with")));
    await page.click('[data-tab="upgrades"]');
    await page.click('[data-action="upgrades"]');
    await page.waitForFunction(() => document.querySelector(".mwia-body")?.innerText.includes("Recommended shopping list") && !document.querySelector(".mwia-progress"), { timeout: 300000 });
    const rangedUpgrades = await page.$eval(".mwia-body", (n) => n.innerText);
    check("ranged: the plan starts with a weapon for the style", /(Buy|Equip) (Wooden|Birch|Cedar) (Bow|Crossbow)[^\n]*to fight as Ranged|Buy (Wooden|Birch|Cedar) (Bow|Crossbow)[^\n]* in (Weapon|Two-hand)/.test(rangedUpgrades),
        rangedUpgrades.slice(rangedUpgrades.indexOf("Recommended shopping list"), rangedUpgrades.indexOf("Recommended shopping list") + 300));
    check("ranged: a better bow replaces the staff you wear, not the starter", !/replaces Wooden (Bow|Crossbow)/.test(rangedUpgrades));
    await page.screenshot({ path: path.join(shotDir, "7-ranged.png") });
    // The combat page's food and drink slots: red for what the analysis doesn't use, green in the picker for what it does.
    {
        const setups = await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-combat-setups") || "{}"));
        const fighting = fixtureCharacter().characterActions[0].actionHrid;
        const setup = setups[fighting] || Object.values(setups).sort((a, b) => b.at - a.at)[0];
        const right = [...setup.drinks, ...setup.food].filter(Boolean);
        const wrongFood = Object.values(clientData.itemDetailMap).find((i) => i.categoryHrid === "/item_categories/food" && !right.includes(i.hrid)).hrid;
        const icon = (hrid) => `<svg><use href="#${hrid.split("/").pop()}"></use></svg>`; // no sprite file to load
        await page.evaluate((html) => {
            document.querySelector(".mwia-panel").classList.add("mwia-hidden");
            document.body.insertAdjacentHTML("beforeend", html);
        }, `<div id="combatpage"><div class="title"><span>Combat</span> <span>?</span></div>
            <div class="consumables"><div class="label">Consumables</div><div class="row" style="display:flex;gap:4px">
            <div class="slot" style="width:60px;height:60px">${icon("/items/donut")}<span>300</span></div><div class="slot" style="width:60px;height:60px">${icon(wrongFood)}</div></div></div></div>`);
        await new Promise((r) => setTimeout(r, 900));
        const marks = await page.$$eval("#combatpage .slot", (list) => list.map((n) => n.dataset.mwiaTea || ""));
        check("combat slots: food the advice doesn't use glows red, the advised one doesn't", marks[0] === (right.includes("/items/donut") ? "" : "wrong") && marks[1] === "wrong", `${JSON.stringify(marks)} for ${right}`);
        const choices = [...new Set([...right, wrongFood, "/items/apple_gummy"])];
        await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html),
            `<div class="ItemSelector_menu__x" id="cpicker"><div class="ItemSelector_itemList__y">${choices.map((hrid) => `<div class="ItemSelector_itemContainer__z" data-hrid="${hrid}">${icon(hrid)}</div>`).join("")}</div></div>`);
        await new Promise((r) => setTimeout(r, 900));
        const green = await page.$$eval("#cpicker [data-mwia-tea=right]", (list) => list.map((n) => n.dataset.hrid));
        const expected = right.filter((hrid) => hrid !== "/items/donut");
        check("combat picker: the advised drinks and food not in a slot glow green", JSON.stringify(green.sort()) === JSON.stringify([...expected].sort()), `${green} vs ${expected}`);
        await page.screenshot({ path: path.join(shotDir, "7b-combat-slots.png") });
        await page.evaluate(() => { document.getElementById("cpicker").remove(); document.getElementById("combatpage").remove(); document.querySelector(".mwia-panel").classList.remove("mwia-hidden"); });
    }
    // A saved combat loadout: the combat tabs work from it, "Equipped now" goes back to what you wear.
    await page.select('[data-setting="combatStyle"]', "current");
    const at = (type) => "/item_locations/" + type;
    gameSocket.send(JSON.stringify({ type: "loadouts_updated", characterLoadoutMap: {
        4: { name: "Mage kit", actionTypeHrid: "/action_types/combat", isDefault: true, ordinal: 0,
            wearableMap: { [at("main_hand")]: `1::${at("main_hand")}::/items/birch_water_staff::0`, [at("head")]: `1::${at("head")}::/items/cheese_helmet::0`, [at("ring")]: `1::${at("ring")}::/items/ring_of_regeneration::0` },
            foodItemHrids: ["/items/donut"], drinkItemHrids: [], abilityMap: { 1: "/abilities/water_strike" } },
    } }));
    await page.click('[data-tab="overview"]');
    await page.waitForFunction(() => document.querySelector('.mwia-body [data-setting="combatGear"]'), { timeout: 5000 });
    const withLoadout = await page.$eval(".mwia-body", (n) => n.innerText);
    check("loadout: the overview works from the default combat loadout", /Working from your loadout Mage kit/.test(withLoadout) && /Body\s+empty/.test(withLoadout) && /Head\s+Cheese Helmet/.test(withLoadout), withLoadout.slice(0, 400));
    check("loadout: gear it names that you don't have is flagged", /Not in your inventory[^\n]*Ring of Regeneration/i.test(withLoadout));
    await page.screenshot({ path: path.join(shotDir, "8-loadout.png") });
    await page.click('[data-tab="zones"]');
    await page.click('[data-action="zones"]');
    await page.waitForSelector(".mwia-reco", { timeout: 120000 });
    check("loadout: zones are simulated with it", /Working from your loadout Mage kit/.test(await page.$eval(".mwia-body", (n) => n.innerText)));
    await page.click('[data-tab="overview"]');
    await page.select('[data-setting="combatGear"]', "equipped");
    const worn = await page.$eval(".mwia-body", (n) => n.innerText);
    check("loadout: Equipped now shows what you wear", !/Working from your loadout/.test(worn) && /Body\s+Cotton Robe Top/.test(worn));
    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exitCode = failures ? 1 : 0;
