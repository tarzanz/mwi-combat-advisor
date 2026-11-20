// ⚔ The combat plan in a real browser, linked to a real pi/server.mjs that already holds a plan
// (written into its data folder, so nothing heavy runs): the ⚔ Plan tab shows what the plan
// reaches and the checklist – what you have green, what is missing red – 🛒 puts what is
// missing in the MWITools cart (a stand-in), a changed setting goes to the Pi, and the game's
// Loadouts panel showing the plan's loadout marks its slots green and red without simulating.
// Usage: BROWSER_PATH=<chromium> node test/combat-plan-browser-test.mjs [screenshot-dir]
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { WebSocketServer } from "ws";
import { fixtureCharacter } from "./fixture-character.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir] = process.argv.slice(2);
const MOBILE = !!process.env.MOBILE;
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
clientData.levelExperienceTable = Array.from({ length: 201 }, (_, level) => Math.round(30 * level ** 2.2));
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");

// The fixture's mage with a saved "Magic" loadout: Water Strike, Donut (300 in the bag), no drinks.
const character = fixtureCharacter();
const worn = character.characterItems.filter((i) => i.itemLocationHrid !== "/item_locations/inventory");
const wearableMap = Object.fromEntries(worn.map((i) => [i.itemLocationHrid, `1::${i.itemLocationHrid}::${i.itemHrid}::0`]));
character.characterLoadoutMap = {
    7: { name: "Magic", actionTypeHrid: "/action_types/combat", isDefault: true, ordinal: 1, wearableMap, abilityMap: { 1: "/abilities/water_strike" }, foodItemHrids: ["/items/donut", null, null], drinkItemHrids: [null, null, null] },
};
character.characterActions = [{ id: 5, actionHrid: "/actions/combat/fly", difficultyTier: 0, ordinal: 0 }];

// The plan: Water Strike and Fireball (a book to buy), Donut, a Wisdom Coffee to buy, a better
// staff to buy, Fly T0 – the fight queued.
const equipment = Object.fromEntries(worn.map((i) => [i.itemLocationHrid.split("/").pop(), { hrid: i.itemHrid, enhancementLevel: 0 }]));
const planLoadout = {
    equipment: { ...equipment, main_hand: { hrid: "/items/cheese_sword", enhancementLevel: 2 } },
    abilities: [null, { hrid: "/abilities/water_strike", level: 6 }, { hrid: "/abilities/fireball", level: 1 }],
    food: ["/items/donut", null],
    drinks: ["/items/wisdom_coffee"],
    abilityTriggers: { "/abilities/fireball": [{ dependencyHrid: "/combat_trigger_dependencies/targeted_enemy", conditionHrid: "/combat_trigger_conditions/current_hp", comparatorHrid: "/combat_trigger_comparators/greater_than_equal", value: 100 }] },
    consumableTriggers: {},
};
const result = {
    at: Date.now() - 3600e3,
    finishedAt: Date.now() - 3000e3,
    ms: 3000e3,
    loadoutsAt: Date.now() - 4000e3,
    settings: { style: "magic", meleeType: "any", days: 30, reserve: 5e6, charms: false, setupId: "auto", levelDays: 7, accuracy: "normal", acceptRareDeaths: false },
    setup: { id: "7", name: "Magic" },
    skills: ["stamina", "intelligence", "attack", "defense", "magic"],
    start: { levels: { stamina: 14, intelligence: 17, attack: 12, defense: 11, magic: 21 }, coins: 500000 },
    end: { levels: { stamina: 30, intelligence: 33, attack: 28, defense: 27, magic: 40 }, coins: 5e6, levelsPerDay: 1.2 },
    gained: 83,
    score: 170,
    stats: { combatBlocks: 84, skillingBlocks: 6, skillingGold: 30e6, spent: 25e6, combatProfit: -2e6 },
    skillingForgone: 400e6,
    baseline: { gained: 60, levelsPerDay: 0.9, score: 140 },
    phases: [
        { kind: "skilling", from: 0, to: 2, blocks: 6, job: "Cow", skill: "/skills/milking", gold: 30e6, coins: 30e6, why: "for the purchases" },
        {
            kind: "combat", from: 2, to: 30, blocks: 84, zone: { zoneHrid: "/actions/combat/fly", tier: 0 }, loadout: planLoadout,
            buys: [
                { kind: "gear", slot: "main_hand", hrid: "/items/cheese_sword", enhancementLevel: 2, cost: 20e6, price: 20e6, owned: false, sold: [] },
                { kind: "ability", slot: "ability2", hrid: "/abilities/fireball", bookHrid: "/items/fireball", level: 1, books: 1, cost: 5e6, price: 5e6, owned: false },
            ],
            changes: [], triggers: [{ hrid: "/abilities/fireball", target: "ability", triggers: planLoadout.abilityTriggers["/abilities/fireball"] }],
            rates: { levelsPerDay: 2.8, profitPerHour: -3000, consumablesPerHour: { "/items/donut": 2, "/items/wisdom_coffee": 0.2 }, encountersPerHour: 120, xpPerHour: { magic: 3000 } },
            gained: { magic: 19, stamina: 16 }, levels: { magic: 40 }, coins: 5e6,
        },
    ],
};

const marketData = {};
for (const item of Object.values(clientData.itemDetailMap)) marketData[item.hrid] = { 0: { a: 3 * (item.sellPrice || 1), b: 2 * (item.sellPrice || 1) } };
const H = Math.floor(Date.now() / 3600000);
const marketFile = JSON.stringify({ marketData, timestamp: H * 3600 });

// The Pi's data folder: the plan and its settings as the browser sends them; a Labyrinth result
// so the loadouts the browser sends don't start a run.
const piData = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-cplan-browser-"));
mkdirSync(path.join(piData, "combat-plan", "1"), { recursive: true });
writeFileSync(path.join(piData, "combat-plan", "1", "result.json"), JSON.stringify(result));
writeFileSync(path.join(piData, "combat-plan", "1", "settings.json"), JSON.stringify({ settings: { style: "magic", meleeType: "any", days: 30, reserve: 5e6, charms: false, setupId: "auto", acceptRareDeaths: false }, at: 1 }));
mkdirSync(path.join(piData, "labyrinth", "combat", "1"), { recursive: true });
writeFileSync(path.join(piData, "labyrinth", "combat", "1", "result.json"), JSON.stringify({ at: 1, done: true, stage: "done" }));

const gear = `<button class="Loadouts_gear"><svg width="16" height="16"><use href="/static/media/misc_sprite.svg#settings"></use></svg></button>`;
const slot = (sprite, id) => `<div class="Loadouts_slotWrap"><div class="slot"><svg width="40" height="40"><use href="/static/media/${sprite}_sprite.svg#${id}"></use></svg></div>${gear}</div>`;
const panelRows = (loadout) => `
  <div class="Loadouts_buttons"><button>Import Current Setup</button><button>Equip Loadout</button></div>
  <div class="Loadouts_grid"><div class="Loadouts_label">Equipment</div><div class="slot">…</div>
  <div class="Loadouts_label">Abilities</div>${Object.values(loadout.abilityMap).map((h) => slot("abilities", h.split("/").pop())).join("")}
  <div class="Loadouts_label">Consumables</div>${[...loadout.foodItemHrids, ...loadout.drinkItemHrids].filter(Boolean).map((h) => slot("items", h.split("/").pop())).join("")}</div>`;
const pageHtml = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>.slot { width: 44px; height: 44px; border: 1px solid #556 } .Loadouts_grid { display: grid; grid-template-columns: repeat(5, 50px); gap: 4px } .Loadouts_label { grid-column: 1 / -1 }</style>
<script>
  window.MWITools = { shopping: { ready: true, cart: [],
    getCartItem(hrid, level) { return this.cart.find((i) => i.itemHrid === hrid && i.enhancementLevel === level) || null; },
    addToCart(list) { for (const i of list) { const had = this.getCartItem(i.itemHrid, i.enhancementLevel); if (had) had.quantity += i.quantity; else this.cart.push({ ...i }); } return { ok: true }; } } };
</script><script src="/advisor.user.js"></script></head>
<body style="background:#1b1f35;color:#fff;font:14px sans-serif"><div id="game">Fake game<div id="loadouts" style="width:${MOBILE ? 340 : 560}px"></div></div>
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
        res.end(pageHtml);
    } else if (req.url === "/advisor.user.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(userscript);
    } else if (req.url.startsWith("/game_data/marketplace.json")) {
        res.setHeader("content-type", "application/json");
        res.end(marketFile);
    } else if (req.url === "/client-data.json") {
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify(clientData));
    } else {
        res.statusCode = 404;
        res.end();
    }
});
new WebSocketServer({ server }).on("connection", (socket) => socket.send(JSON.stringify(character)));
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;

const KEY = "pi-key-".repeat(5);
const PI_PORT = 20000 + Math.floor(Math.random() * 20000);
const piUrl = `http://127.0.0.1:${PI_PORT}`;
const pi = spawn("node", [path.join(root, "pi/server.mjs")], { env: { ...process.env, MWIA_KEY: KEY, MWIA_DATA: piData, PORT: String(PI_PORT), MWIA_MARKET_URL: `${origin}/game_data/marketplace.json`, MWIA_ORIGINS: origin, MWIA_ORDERS: "1", MWIA_LOG_REQUESTS: "0", MWIA_COMBAT_PLAN_RUNNER: "/dev/null" }, stdio: ["ignore", "ignore", "inherit"] });
for (let k = 0; k < 50 && !(await fetch(piUrl + "/status").then((r) => r.ok).catch(() => false)); k++) await new Promise((r) => setTimeout(r, 100));
const link = `${origin}/#mwia-pi=${Buffer.from(JSON.stringify({ u: piUrl, k: KEY })).toString("base64url")}`;

let failures = 0;
const check = (name, ok, detail = "") => {
    console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
    if (!ok) failures++;
};
const shot = async (page, name) => shotDir && page.screenshot({ path: path.join(shotDir, name), fullPage: true });

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"], protocolTimeout: 180000 });
try {
    const page = await browser.newPage();
    await page.setViewport(MOBILE ? { width: 390, height: 844 } : { width: 1000, height: 1100 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(link);
    await page.waitForFunction(() => window.lastType === "init_character_data");
    await page.waitForSelector(".mwia-launcher");
    await page.click(".mwia-launcher");
    await page.waitForSelector('[data-tab="cplan"]');
    await page.click('[data-tab="cplan"]');
    await page.waitForFunction(() => /In 30 days/.test(document.querySelector(".mwia-body")?.innerText || ""), { timeout: 60000 }).catch(async (error) => {
        console.log("TAB:", await page.$eval(".mwia-body", (n) => n.innerText).catch(() => "?"));
        throw error;
    });
    const text = await page.$eval(".mwia-body", (n) => n.innerText);
    check("the tab says what the plan reaches against fighting as you are", /\+83\.0 levels/.test(text) && /\+23\.0/.test(text) && /Magic 21 → 40/.test(text), text.slice(0, 400));
    check("it starts with skilling, then the fight", /First: 48 h of skilling/.test(text) && /Then fight in Fly/.test(text), text.slice(0, 800));
    const rows = await page.$$eval(".mwia-cp-list li", (lis) => lis.map((li) => ({ text: li.innerText, green: li.classList.contains("mwia-cp-green") })));
    const rowOf = (re) => rows.find((r) => re.test(r.text));
    check("missing purchases are red", rowOf(/Cheese Sword \+2/)?.green === false && rowOf(/Fireball/)?.green === false, JSON.stringify(rows));
    check("the donuts you hold are green, the coffee you lack red", rowOf(/× Donut/)?.green === true && rowOf(/× Wisdom Coffee/)?.green === false, JSON.stringify(rows));
    check("the loadout: Water Strike green, Fireball red, the coffee red", rowOf(/Ability 1: Water Strike/)?.green === true && rowOf(/Ability 2: Fireball/)?.green === false && rowOf(/Drink: Wisdom Coffee/)?.green === false, JSON.stringify(rows));
    check("the queued fight is green", rowOf(/^✓ Fly/)?.green === true, JSON.stringify(rows));
    await shot(page, `combat-plan${MOBILE ? "-mobile" : ""}.png`);

    await page.click('[data-action="cplan-cart"]');
    await page.waitForFunction(() => window.MWITools.shopping.cart.length > 0);
    const cart = await page.evaluate(() => window.MWITools.shopping.cart);
    const inCart = (hrid) => cart.find((i) => i.itemHrid === hrid);
    check("🛒 puts what is missing in the cart, +level and all", inCart("/items/cheese_sword")?.enhancementLevel === 2 && inCart("/items/fireball")?.quantity === 1 && inCart("/items/wisdom_coffee")?.quantity === Math.ceil(0.2 * 72) && !inCart("/items/donut"), JSON.stringify(cart));

    // A changed setting goes to the Pi.
    const posts = [];
    page.on("request", (r) => r.url().includes("/combat-plan") && posts.push(`${r.method()} ${r.postData() || ""}`));
    page.on("console", (m) => /combat plan|MWI/.test(m.text()) && posts.push("console: " + m.text()));
    await page.select('[data-setting="cplanDays"]', "14");
    const settingsFile = path.join(piData, "combat-plan", "1", "settings.json");
    let sent = null;
    for (let k = 0; k < 50 && sent?.settings?.days !== 14; k++) {
        await new Promise((r) => setTimeout(r, 200));
        sent = JSON.parse(readFileSync(settingsFile, "utf8"));
    }
    check("a changed setting is sent to the Pi", sent?.settings?.days === 14 && sent.settings.style === "magic", JSON.stringify(sent) + " " + posts.join(" | ") + " days=" + (await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-settings")).cplanDays)) + " kept=" + (await page.evaluate(() => localStorage.getItem("mwia-combat-plan")?.slice(0, 50))) + " status=" + (await page.$eval(".mwia-body", (n) => n.innerText.slice(n.innerText.indexOf("Worked"), n.innerText.indexOf("Worked") + 300))));
    await page.waitForFunction(() => /other settings/.test(document.querySelector(".mwia-body")?.innerText || ""), { timeout: 20000 }).catch(() => {});
    check("the tab says the plan was made with other settings", /other settings/.test(await page.$eval(".mwia-body", (n) => n.innerText)));

    // The Loadouts panel showing the plan's loadout: green and red, no simulation.
    await page.click(".mwia-launcher");
    await page.$eval("#loadouts", (el, html) => (el.innerHTML = html), panelRows(character.characterLoadoutMap[7]));
    await page.waitForFunction(() => /Combat plan/.test(document.querySelector(".mwia-loadout-box")?.innerText || ""), { timeout: 20000 });
    const box = await page.$eval(".mwia-loadout-box", (n) => n.innerText);
    const marks = await page.$$eval("[data-mwia-slot]", (els) => els.map((e) => e.dataset.mwiaSlot));
    check("the panel box follows the plan: put in, wear, triggers", /Put in: .*Fireball.*Wisdom Coffee/.test(box) && /Wear: Cheese Sword \+2/.test(box) && /Set the triggers of: Fireball/.test(box), box);
    check("the plan's slots glow green", marks.length === 2 && marks.every((m) => m === "right"), JSON.stringify(marks));
    check("nothing simulated in the browser for it", !/Simulating/.test(box));
    await shot(page, `combat-plan-loadouts${MOBILE ? "-mobile" : ""}.png`);
    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    pi.kill();
    server.close();
}
if (failures) {
    console.log(`${failures} check(s) failed`);
    process.exit(1);
}
console.log("All checks passed");
