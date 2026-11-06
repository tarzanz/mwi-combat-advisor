// The Labyrinth tab in a real browser: checks the rooms against every Labyrinth monster
// with the crate from the character's Labyrinth slots, re-reads them at another room
// level without simulating again, then tests what takes you further.
// Usage: node test/labyrinth-browser-test.mjs <screenshot-dir>
// BROWSER_PATH picks another browser (Chromium). MOBILE=1 runs it at iPhone size.
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { WebSocketServer } from "ws";
import { fixtureCharacter } from "./fixture-character.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir = "/tmp"] = process.argv.slice(2);
const MOBILE = !!process.env.MOBILE;
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
clientData.levelExperienceTable = Array.from({ length: 201 }, (_, level) => 50 * level * level);
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");

// A level-60 fire mage, with a crossbow in the bag and a Basic Coffee Crate in the Labyrinth slots.
const character = fixtureCharacter();
const levels = { stamina: 52, intelligence: 52, attack: 52, melee: 50, defense: 52, ranged: 55, magic: 65 };
for (const s of character.characterSkills) if (levels[s.skillHrid.split("/").pop()]) s.level = levels[s.skillHrid.split("/").pop()];
const gear = { two_hand: "gobo_boomstick", body: "flaming_robe_top", legs: "flaming_robe_bottoms", head: "bamboo_hat", feet: "bamboo_boots", hands: "bamboo_gloves" };
character.characterItems = character.characterItems.filter((i) => i.itemLocationHrid === "/item_locations/inventory");
for (const [slot, hrid] of Object.entries(gear)) character.characterItems.push({ hash: "g-" + slot, itemHrid: "/items/" + hrid, itemLocationHrid: "/item_locations/" + slot, enhancementLevel: 0, count: 1 });
character.characterItems.push({ hash: "xbow", itemHrid: "/items/cedar_crossbow", itemLocationHrid: "/item_locations/inventory", enhancementLevel: 0, count: 1 });
character.characterAbilities = [
    { abilityHrid: "/abilities/fireball", level: 37, experience: 0, slotNumber: 1 },
    { abilityHrid: "/abilities/flame_blast", level: 43, experience: 0, slotNumber: 2 },
    { abilityHrid: "/abilities/water_strike", level: 30, experience: 0, slotNumber: 0 },
];
character.combatUnit = { combatAbilities: [{ abilityHrid: "/abilities/fireball", level: 37 }, { abilityHrid: "/abilities/flame_blast", level: 43 }] };
character.actionTypeDrinkSlotsMap["/action_types/labyrinth"] = [{ itemHrid: "/items/basic_coffee_crate" }, null, null, null];

const marketData = {};
for (const item of Object.values(clientData.itemDetailMap)) {
    const vendor = item.sellPrice || 1;
    marketData[item.hrid] = { 0: { a: 3 * vendor, b: 2.5 * vendor } };
}

const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/advisor.user.js"></script></head>
<body style="background:#1b1f35;color:#fff;font:14px sans-serif"><div id="game">Fake game</div>
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
        res.end(JSON.stringify({ marketData }));
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
const url = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
const body = (page) => page.$eval(".mwia-body", (n) => n.innerText);
// On a phone the tables are cards and their headers labels, so headers are checked in the page's text.
const domText = (page) => page.$eval(".mwia-body", (n) => n.textContent);
const idle = (page, text, timeout = 300000) => page.waitForFunction((t) => document.querySelector(".mwia-body")?.innerText.includes(t) && !document.querySelector(".mwia-progress"), { timeout }, text);

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    await page.setViewport(MOBILE ? { width: 390, height: 844 } : { width: 1300, height: 1000 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url);
    await page.waitForFunction(() => window.lastType === "init_character_data");
    await page.click(".mwia-launcher");
    await page.waitForSelector(".mwia-panel:not(.mwia-hidden)");
    await page.click('[data-tab="labyrinth"]');
    const intro = await body(page);
    check("the tab explains the room rules", /no food or drinks/.test(intro) && /2 minutes/.test(intro), intro.slice(0, 200));
    check("the crate in the Labyrinth slots is offered", /Your Labyrinth slots \(Basic\)/.test(intro));

    await page.select('[data-setting="accuracy"]', "fast");
    let t0 = Date.now();
    await page.click('[data-action="laby-check"]');
    await idle(page, "At room level 20");
    console.log(`room check took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    let text = await body(page);
    check("simulated with the slotted crate", /Simulated with Basic Coffee crate, 20 rooms per monster/.test(text), text.match(/Simulated with[^\n]*/)?.[0]);
    const rows = await page.$$eval(".mwia-body tbody tr", (trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim())));
    check("one row per Labyrinth monster", rows.length === 10 && rows.some((r) => r[0] === "Cyclops") && rows.some((r) => r[0] === "Mimic"), rows.map((r) => r[0]).join(", "));
    const cyclops = rows.find((r) => r[0] === "Cyclops") || [];
    check("Cyclops: weak to magic and fire, a fire mage hits it right", /Magic/.test(cyclops[2]) && /Fire/.test(cyclops[2]) && /Magic ✓/.test(cyclops[3]) && /Fire/.test(cyclops[3]), cyclops.join(" | "));
    const dryad = rows.find((r) => r[0] === "Dryad") || [];
    check("Dryad: weak to ranged, magic is the wrong style", /Ranged/.test(dryad[2]) && /Magic ✗/.test(dryad[3]), dryad.join(" | "));
    check("the mage beats a Cyclops further than a Dryad", Number(cyclops[5]) > Number(dryad[5]), `${cyclops[5]} vs ${dryad[5]}`);
    check("a verdict for each monster at the room level", rows.every((r) => /fight|risky|shroud/.test(r[6])), rows.map((r) => r[6]).join(" / "));
    check("summary groups the rooms", /✅ Fight:|⚠ Risky:|✖ Shroud or go around:/.test(text));
    await page.screenshot({ path: path.join(shotDir, "laby-1-rooms.png"), fullPage: !MOBILE });

    // Another room level: read off the curves, no new simulation.
    await page.$eval('[data-setting="labyLevel"]', (n) => { n.value = "5"; n.dispatchEvent(new Event("change", { bubbles: true })); });
    const atFive = await domText(page);
    check("room level 5 re-reads without simulating", /At room level 5:/.test(atFive) && !/Simulating/.test(atFive) && /At level 5/.test(atFive));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-settings")).labyLevel);
    check("room level is kept", String(saved) === "5", saved);

    t0 = Date.now();
    await page.click('[data-action="laby-improve"]');
    await idle(page, "What takes you further");
    console.log(`improvements took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    text = await body(page);
    check("improvements listed or none found", /Work on/.test(await domText(page)) || /None of the crates/.test(text), text.slice(text.indexOf("What takes you further"), text.indexOf("What takes you further") + 600));
    check("the next coffee crate helps", /Advanced Coffee crate|Expert Coffee crate/.test(text));
    const better = await page.$$eval(".mwia-body table:first-of-type tbody tr", (trs) => trs.map((tr) => [tr.cells[0].innerText, tr.cells[tr.cells.length - 1].innerText]));
    check("a 'better with' column per monster", better.length === 10, JSON.stringify(better));
    check("the crossbow in the bag is tried as ranged, the rest as bought weapons", /Ranged with Cedar Crossbow \(yours\)/.test(text) && /Stab with .+\(\d/.test(text) && /Slash with/.test(text) && /Smash with/.test(text), text.slice(text.indexOf("Other attack styles"), text.indexOf("Other attack styles") + 500));
    check("Water Strike against the water-weak Giant Scorpion", better.some(([m, b]) => m === "Giant Scorpion" && /Water Strike instead of/.test(b)), JSON.stringify(better));
    writeFileSync(path.join(shotDir, "laby.txt"), text);
    await page.screenshot({ path: path.join(shotDir, "laby-2-improve.png"), fullPage: !MOBILE });
    if (MOBILE) {
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        check("phone: no sideways scrolling", scroll);
    }

    // Another crate needs a new check.
    await page.select('[data-setting="labyCoffee"]', "expert");
    check("a new crate clears the results", !/At room level/.test(await body(page)));
    check("no errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
