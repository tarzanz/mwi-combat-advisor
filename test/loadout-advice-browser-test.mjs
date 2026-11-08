// The box in the game's Loadouts panel, in a real browser: a fight in the action queue
// (behind a skilling job) that names the "Ranged" loadout; with "Magic" open the box says
// to open Ranged; with Ranged open it simulates that loadout in the zone by itself, lists
// the abilities, drinks and food to use, marks what to take out, and 🛒 8 h / 24 h put the
// drinks and food in the MWITools cart (a stand-in here) topped up to that many hours.
// After a reload the advice comes from the browser, without simulating again.
// Usage: BROWSER_PATH=<chromium> node test/loadout-advice-browser-test.mjs [screenshot-dir]
import { readFileSync, readdirSync } from "node:fs";
import http from "node:http";
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
clientData.levelExperienceTable = Array.from({ length: 201 }, (_, level) => 50 * level * level);
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");

// The fixture's mage, with two saved combat loadouts. "Ranged" (not the default) holds
// Water Strike, Gummy (none in the bag) and a Wisdom Coffee; the queued fight names it.
const character = fixtureCharacter();
const worn = character.characterItems.filter((i) => i.itemLocationHrid !== "/item_locations/inventory");
const wearableMap = Object.fromEntries(worn.map((i) => [i.itemLocationHrid, `1::${i.itemLocationHrid}::${i.itemHrid}::0`]));
character.characterItems.push({ hash: "wc", itemHrid: "/items/wisdom_coffee", itemLocationHrid: "/item_locations/inventory", enhancementLevel: 0, count: 5 });
character.characterLoadoutMap = {
    1: { name: "Magic", actionTypeHrid: "/action_types/combat", isDefault: true, ordinal: 1, wearableMap, abilityMap: { 1: "/abilities/water_strike" }, foodItemHrids: ["/items/donut", null, null], drinkItemHrids: [null, null, null] },
    2: { name: "Ranged", actionTypeHrid: "/action_types/combat", ordinal: 2, wearableMap, abilityMap: { 1: "/abilities/water_strike" }, foodItemHrids: ["/items/gummy", null, null], drinkItemHrids: ["/items/wisdom_coffee", null, null] },
};
character.characterActions = [
    { id: 4, actionHrid: "/actions/milking/cow", ordinal: 0 },
    { id: 5, actionHrid: "/actions/combat/fly", difficultyTier: 0, ordinal: 1, characterLoadoutId: 2 },
];

const marketData = {};
for (const item of Object.values(clientData.itemDetailMap)) {
    const vendor = item.sellPrice || 1;
    marketData[item.hrid] = { 0: { a: 3 * vendor, b: 2.5 * vendor } };
}

// The game's Loadouts panel, as far as the box needs it: Equip Loadout, and the Abilities and
// Consumables headings in the same grid as their slots (as the game's seemed to be: the box once
// landed after the first slot), each slot with its ⚙ (an icon the game data doesn't know).
const gear = `<button class="Loadouts_gear"><svg width="16" height="16"><use href="/static/media/misc_sprite.svg#settings"></use></svg></button>`;
const slot = (sprite, id) => `<div class="Loadouts_slotWrap"><div class="slot"><svg width="40" height="40"><use href="/static/media/${sprite}_sprite.svg#${id}"></use></svg><span class="count">1</span></div>${gear}</div>`;
const panelRows = (loadout) => `
  <div class="Loadouts_buttons"><button>Import Current Setup</button><button>Equip Loadout</button></div>
  <div class="Loadouts_grid"><div class="Loadouts_label">Equipment</div><div class="slot">…</div>
  <div class="Loadouts_label">Abilities</div>
  <div class="Loadouts_slotWrap"><div class="slot">Special Ability</div></div>${Object.values(loadout.abilityMap).map((h) => slot("abilities", h.split("/").pop())).join("")}
  <div class="Loadouts_label">Consumables</div>
  ${[...loadout.foodItemHrids, ...loadout.drinkItemHrids].filter(Boolean).map((h) => slot("items", h.split("/").pop())).join("")}</div>`;

const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<style>.slot { width: 44px; height: 44px; border: 1px solid #556; font-size: 9px } .Loadouts_grid { display: grid; grid-template-columns: repeat(5, 50px); gap: 4px } .Loadouts_label { grid-column: 1 / -1 }</style>
<script>
  // A stand-in for MWITools' shopping cart API.
  window.MWITools = { shopping: { ready: true, cart: [],
    getCartItem(hrid, level) { return this.cart.find((i) => i.itemHrid === hrid && i.enhancementLevel === level) || null; },
    addToCart(list) { for (const i of list) { const had = this.getCartItem(i.itemHrid, i.enhancementLevel); if (had) had.quantity += i.quantity; else this.cart.push({ ...i }); } return { ok: true }; } } };
</script><script src="/advisor.user.js"></script></head>
<body style="background:#1b1f35;color:#fff;font:14px sans-serif"><div id="game">Fake game
  <div id="loadouts" style="width:${MOBILE ? 340 : 560}px">${panelRows(character.characterLoadoutMap[1])}</div></div>
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
let gameSocket = null;
new WebSocketServer({ server }).on("connection", (socket) => {
    gameSocket = socket;
    socket.send(JSON.stringify(character));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;

let failures = 0;
const check = (name, ok, detail = "") => {
    console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
    if (!ok) failures++;
};
const boxText = (page) => page.$eval(".mwia-loadout-box", (n) => n.innerText).catch(() => "");
const shot = async (page, name) => shotDir && page.screenshot({ path: path.join(shotDir, name), fullPage: true });

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    await page.setViewport(MOBILE ? { width: 390, height: 844 } : { width: 1000, height: 900 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // Quick simulations for the test.
    await page.evaluateOnNewDocument(() => localStorage.setItem("mwia-settings", JSON.stringify({ accuracy: "fast" })));
    await page.goto(url);
    await page.waitForFunction(() => window.lastType === "init_character_data");

    // Magic open: the fight uses Ranged.
    await page.waitForSelector(".mwia-loadout-box", { timeout: 15000 });
    let text = await boxText(page);
    check("with another loadout open, the box names the fight's loadout", /uses Ranged/.test(text) && /Fly/.test(text) && /set for the queued fight/.test(text), text);

    // Ranged open: simulated by itself.
    await page.$eval("#loadouts", (el, html) => (el.innerHTML = html), panelRows(character.characterLoadoutMap[2]));
    await page.waitForFunction(() => /Simulating|Waiting|Drinks and food for/.test(document.querySelector(".mwia-loadout-box")?.innerText || ""), { timeout: 15000 });
    const t0 = Date.now();
    await page.waitForFunction(() => /Drinks and food for/.test(document.querySelector(".mwia-loadout-box")?.innerText || ""), { timeout: 600000 });
    console.log(`loadout simulation took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    text = await boxText(page);
    check("the advice names the fight and the loadout", /Next fight: Fly with Ranged/.test(text), text);
    check("abilities, drinks and food are listed", /Abilities/.test(text) && /Water Strike|Poke/.test(text) && /(Drinks|Food)/.test(text), text);
    check("a verdict or the gain is given", /best the advisor found|over the loadout as it is/.test(text), text);
    check("8 h and 24 h cart buttons", /8 h/.test(text) && /24 h/.test(text), text);
    await shot(page, `loadout-advice${MOBILE ? "-mobile" : ""}.png`);

    check("the panel's loadout is recognised", !/Can't tell/.test(text), text);
    const below = await page.$eval(".mwia-loadout-box", (box) => [...document.querySelectorAll(".Loadouts_slotWrap")].every((s) => s.compareDocumentPosition(box) & 4) && !box.closest(".Loadouts_grid"));
    check("the box is below every slot, not inside the grid", below);
    // The game updates the panel (item counts) now and then: the box must stay put, not be taken
    // away and put back (the action window's box once took it away on every change: it flickered).
    const inserted = await page.evaluate(async () => {
        let count = 0;
        const observer = new MutationObserver((records) => records.forEach((r) => r.addedNodes.forEach((n) => n.classList?.contains("mwia-loadout-box") && count++)));
        observer.observe(document.body, { childList: true, subtree: true });
        for (let i = 0; i < 6; i++) {
            document.querySelectorAll(".count").forEach((c) => (c.textContent = String(Number(c.textContent) + 1)));
            await new Promise((r) => setTimeout(r, 500));
        }
        observer.disconnect();
        return count;
    });
    check("the box stays while the game updates the panel", inserted === 0, `put in ${inserted} times in 3 s`);

    const entry = await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-loadout-advice") || "[]")[0]);
    check("the advice is kept in the browser", !!entry && entry.loadoutName === "Ranged" && entry.zoneHrid === "/actions/combat/fly", JSON.stringify(entry)?.slice(0, 200));

    // The marks: only what the advice takes out.
    const marked = await page.$$eval("[data-mwia-slot=wrong] use", (list) => list.map((u) => u.getAttribute("href").split("#")[1]));
    const kept = new Set([...(entry?.final.abilities || []), entry?.final.special, ...(entry?.final.drinks || []), ...(entry?.final.food || [])].filter(Boolean).map((h) => h.split("/").pop()));
    check("only slots the advice takes out are marked", marked.every((id) => !kept.has(id)), `marked ${marked.join(", ") || "none"}; kept ${[...kept].join(", ")}`);
    const taken = [...(entry?.start.abilities || []), ...(entry?.start.drinks || []), ...(entry?.start.food || [])].filter((h) => h && !kept.has(h.split("/").pop())).map((h) => h.split("/").pop());
    check("every slot the advice takes out is marked", taken.every((id) => marked.includes(id)), `taken out ${taken.join(", ") || "none"}`);

    // 🛒 for 8 h and then 24 h: topped up to the hours at the simulated pace, less what you have.
    const inBag = { "/items/donut": 300, "/items/wisdom_coffee": 5 };
    const expect = (hours) => [...entry.final.drinks, ...entry.final.food].filter(Boolean).map((hrid) => ({ hrid, quantity: Math.ceil((entry.after.consumables[hrid] || 0) * hours) - (inBag[hrid] || 0) })).filter((i) => i.quantity > 0);
    for (const hours of [8, 24]) {
        const want = expect(hours);
        const button = await page.$(`.mwia-loadout-box [data-loadout-cart]:not([disabled])`).then(async () => {
            const all = await page.$$(".mwia-loadout-box button");
            for (const b of all) if ((await b.evaluate((n) => n.textContent)).trim().endsWith(`${hours} h`)) return b;
            return null;
        });
        if (!want.length) {
            check(`nothing to buy for ${hours} h: the button says so`, !!button && (await button.evaluate((n) => n.disabled)));
            continue;
        }
        await button.click();
        await page.waitForFunction(() => /Cart:/.test(document.querySelector(".mwia-loadout-box")?.innerText || ""), { timeout: 5000 });
        const cart = await page.evaluate(() => window.MWITools.shopping.cart.map((i) => ({ hrid: i.itemHrid, quantity: i.quantity })));
        const ok = want.every((w) => cart.find((c) => c.hrid === w.hrid)?.quantity === w.quantity);
        check(`🛒 ${hours} h tops the cart up to ${hours} hours`, ok, `cart ${JSON.stringify(cart)}, wanted ${JSON.stringify(want)}`);
    }

    // After a reload: from the browser, no simulation.
    await page.reload();
    await page.waitForFunction(() => window.lastType === "init_character_data");
    await page.$eval("#loadouts", (el, html) => (el.innerHTML = html), panelRows(character.characterLoadoutMap[2]));
    await page.waitForFunction(() => /Drinks and food for|Simulating/.test(document.querySelector(".mwia-loadout-box")?.innerText || ""), { timeout: 15000 });
    text = await boxText(page);
    check("after a reload the advice is there without simulating", /Drinks and food for/.test(text) && !/Simulating/.test(text), text.slice(0, 200));

    // The fight done: no fight in the queue, no box.
    gameSocket.send(JSON.stringify({ type: "actions_updated", endCharacterActions: [{ ...character.characterActions[1], isDone: true }] }));
    await page.waitForFunction(() => !document.querySelector(".mwia-loadout-box"), { timeout: 5000 }).catch(() => {});
    check("with no fight in the queue there is no box", !(await page.$(".mwia-loadout-box")));
    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} failure(s)` : "all passed");
process.exit(failures ? 1 : 0);
