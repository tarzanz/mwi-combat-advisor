// The export for chat: a button under the game's inventory (and on the Overview
// tab) that hands a text file with the character and the advice to the share
// sheet, or downloads it where there is none.
// Usage: node test/export-browser-test.mjs <screenshot-dir>
// BROWSER_PATH picks another browser (Chromium).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { WebSocketServer } from "ws";
import { fixtureCharacter } from "./fixture-character.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir = "/tmp"] = process.argv.slice(2);
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
clientData.levelExperienceTable = Array.from({ length: 201 }, (_, level) => 50 * level * level);
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");

const character = fixtureCharacter();
character.characterSkills.push({ skillHrid: "/skills/tailoring", level: 20, experience: clientData.levelExperienceTable[20] + 10 });
character.characterItems.push({ hash: "fabric", itemHrid: "/items/linen_fabric", itemLocationHrid: "/item_locations/inventory", count: 268, enhancementLevel: 0 });
character.characterItems.push({ hash: "coins", itemHrid: "/items/coin", itemLocationHrid: "/item_locations/inventory", count: 1234567, enhancementLevel: 0 });
character.myMarketListings = [{ id: 1, itemHrid: "/items/linen_fabric", enhancementLevel: 0, isSell: true, price: 120, orderQuantity: 10, filledQuantity: 7, status: "/market_order_status/active" }];

const marketData = {};
for (const item of Object.values(clientData.itemDetailMap)) {
    const vendor = item.sellPrice || 1;
    marketData[item.hrid] = { 0: { a: 3 * vendor, b: 2.5 * vendor } };
}

// The game's inventory panel, with the class names as the game's own (with their hashes).
const inventory = `<div class="Inventory_inventory__17CH2"><div class="Inventory_items__6SXv0"><div class="Item_item__2De2O">Linen Fabric 268</div></div></div>`;
const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/advisor.user.js"></script></head>
<body style="background:#1b1f35;color:#fff;font:14px sans-serif"><div id="game">${inventory}</div>
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
const wait = (page, fn, arg) => page.waitForFunction(fn, { timeout: 10000 }, arg).then(() => true, () => false);

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.goto(url);
    await page.waitForFunction(() => window.lastType === "init_character_data");

    check("a button under the game's inventory", await wait(page, () => document.querySelector(".mwia-export")?.previousElementSibling?.matches('[class*="Inventory_items"]')));
    await page.screenshot({ path: path.join(shotDir, "export-1-inventory.png") });

    // A phone: the share sheet gets the file.
    await page.evaluate(() => {
        navigator.canShare = (d) => Array.isArray(d?.files);
        navigator.share = async ({ files, title, text }) => {
            window.shared = { name: files[0].name, type: files[0].type, text: await files[0].text(), extra: [title, text].filter((x) => x !== undefined) };
        };
    });
    const tap = () => page.evaluate(() => document.querySelector(".mwia-export-btn").click());
    await tap();
    // The first tap may only load the game data and prices.
    if (await wait(page, () => /tap again/.test(document.querySelector(".mwia-export-btn").textContent) || window.shared)) {
        if (!(await page.evaluate(() => window.shared))) await tap();
    }
    check("the file goes to the share sheet", await wait(page, () => window.shared));
    const shared = await page.evaluate(() => window.shared);
    const text = shared?.text || "";
    writeFileSync(path.join(shotDir, "export.txt"), text);
    check("only the file is shared (a title becomes a second file on iOS)", Array.isArray(shared?.extra) && shared.extra.length === 0, JSON.stringify(shared?.extra));
    check("a .txt named after the character", /^mwi-advisor-.+\.txt$/.test(shared?.name || "") && shared.type === "text/plain", shared?.name);
    check("version, time and the prices' age", /^# MWI Advisor export\nVersion \S+ · \d{4}-\d\d-\d\d \d\d:\d\d UTC · character .+ · prices \d+ min old/.test(text), text.slice(0, 200));
    check("levels with XP, total level first", /## Levels\n(Total Level [^·]*· )?.*Tailoring 20 \([\d,]+ XP\)/.test(text) && (!/Total Level/.test(text.match(/## Levels\n.*/)?.[0] || "") || /## Levels\nTotal Level/.test(text)), text.match(/## Levels\n.*/)?.[0]?.slice(0, 200));
    check("coins", Number(text.match(/## Coins\n([\d,]+)/)?.[1].replace(/,/g, "")) >= 1234567, text.match(/## Coins\n.*/)?.[0]);
    check("inventory with ask, bid and worth", /Linen Fabric ×268 · ask [\d.kM]+ · bid [\d.kM]+ · worth [\d.kM]+/.test(text), text.match(/## Inventory.*\n.*/)?.[0]);
    check("market orders", /## Market orders\nSell Linen Fabric ×10 @ 120 \(7 filled\)/.test(text), text.match(/## Market orders\n.*/)?.[0]);
    check("the settings", /## Settings\n\{.*"skillingMode"/.test(text));
    check("the top Skilling rows with what they were worked out from", /## Skilling: best now\nSkill all · sell at ask .*\n1\. .+ – \w+ \d+ · ranked on .+\/day/.test(text) && /make [\d,]+ \([^)]+ of 8 h/.test(text) && /you hold [\d,]+ \([\d,]+ inventory, [\d,]+ listed\)/.test(text), text.match(/## Skilling[\s\S]{0,600}/)?.[0]);
    check("no errors", errors.length === 0, errors.join(" | "));

    // The game redraws the inventory: one button again, not two.
    await page.evaluate(() => {
        const box = document.querySelector('[class*="Inventory_inventory"]');
        box.innerHTML = '<div class="Inventory_items__6SXv0"><div>redrawn</div></div>';
    });
    check("back after the game redraws the inventory, once", await wait(page, () => document.querySelectorAll(".mwia-export").length === 1 && document.querySelector(".mwia-export").previousElementSibling?.textContent === "redrawn"));

    // No share sheet (a computer): it downloads, and is copied.
    await page.evaluate(() => {
        navigator.canShare = undefined;
        window.downloaded = null;
        const click = HTMLAnchorElement.prototype.click;
        HTMLAnchorElement.prototype.click = function () {
            if (this.download) fetch(this.href).then((r) => r.text()).then((t) => (window.downloaded = { name: this.download, text: t }));
            else click.call(this);
        };
    });
    await tap();
    check("without a share sheet it downloads", await wait(page, () => window.downloaded?.text?.startsWith("# MWI Advisor export")));

    // The Overview tab has the same button.
    await page.click(".mwia-launcher");
    await page.waitForSelector('.mwia-panel [data-action="export"]', { timeout: 10000 }).catch(() => null);
    check("the Overview tab has it too", !!(await page.$('.mwia-panel [data-action="export"]')));
    await page.evaluate(() => (window.downloaded = null));
    await page.click('.mwia-panel [data-action="export"]');
    check("and it exports the same", await wait(page, () => window.downloaded?.text?.includes("## Inventory")));
    await page.screenshot({ path: path.join(shotDir, "export-2-overview.png") });
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
