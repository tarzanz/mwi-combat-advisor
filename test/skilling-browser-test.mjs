// End-to-end check of the Skilling tab: a fake game page with the client data,
// a fake socket that sends a character with buffs and teas, and a mock market.
// Usage: node test/skilling-browser-test.mjs <screenshot-dir>
// MOBILE=1 runs it at iPhone size (390×844). BROWSER_PATH picks another browser (Chromium).
import { readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { WebSocketServer } from "ws";
import { fixtureCharacter } from "./fixture-character.js";
import { NEAR_LEVELS, RISKY_MARGIN, heldStock, marketPricer, rankSkilling, skillingCharacter } from "../src/skilling.js";
import { shortCoins } from "../src/format.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir = "/tmp"] = process.argv.slice(2);
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
// The real client ships the XP table; the simulator's data does not.
clientData.levelExperienceTable = Array.from({ length: 201 }, (_, level) => 50 * level * level);
// The real client ships category names; the simulator's data does not.
clientData.actionCategoryDetailMap = {};
for (const action of Object.values(clientData.actionDetailMap)) {
    const last = action.category.split("/").pop();
    clientData.actionCategoryDetailMap[action.category] = { hrid: action.category, name: last.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
}
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");

const character = fixtureCharacter();
character.characterSkills = character.characterSkills.map((s) => ({ ...s, experience: clientData.levelExperienceTable[s.level] + 10 }));
character.characterSkills.push({ skillHrid: "/skills/tailoring", level: 20, experience: clientData.levelExperienceTable[20] + 10 });
const FORAGING = "/action_types/foraging";
character.actionTypeDrinkSlotsMap = { ...character.actionTypeDrinkSlotsMap, [FORAGING]: [{ itemHrid: "/items/wisdom_tea" }, null, null] };
character.equipmentActionTypeBuffsMap = { [FORAGING]: [{ typeHrid: "/buff_types/action_speed", flatBoost: 0.15, ratioBoost: 0 }] };
character.houseActionTypeBuffsMap = { [FORAGING]: [{ typeHrid: "/buff_types/efficiency", flatBoost: 0.03, ratioBoost: 0 }] };
// The game's own copy of the tea buffs; the tab adds teas itself, so these must not count twice.
character.consumableActionTypeBuffsMap = { [FORAGING]: [{ typeHrid: "/buff_types/wisdom", flatBoost: 0.12, ratioBoost: 0 }] };

// Market: every item at three times its vendor price, best bid at the vendor price.
// Nobody bids on Cotton Fabric; nobody sells Gathering Tea.
const marketData = {};
for (const item of Object.values(clientData.itemDetailMap)) {
    const vendor = item.sellPrice || 1;
    marketData[item.hrid] = { 0: { a: 3 * vendor, b: item.hrid === "/items/cotton_fabric" ? -1 : vendor } };
}
marketData["/items/gathering_tea"] = { 0: { a: -1, b: 10 } };
// Cotton Boots sell for 2% more than their materials cost: a thin margin.
const bootsCost = clientData.actionDetailMap["/actions/tailoring/cotton_boots"].inputItems.reduce((sum, i) => sum + i.count * marketData[i.itemHrid][0].a, 0);
marketData["/items/cotton_boots"] = { 0: { a: Math.round((bootsCost * 1.02) / 0.96), b: Math.round(bootsCost) } };

const items = (c) => new Map(c.characterItems.map((i) => [i.hash, i]));
const market = (sellAt) => marketPricer((hrid) => marketData[hrid]?.[0], clientData, sellAt);
const books = new Map();
const planFor = (c, { days = 1, minJobHours = 0, sellAt = "ask" } = {}) => {
    const have = (hrid) => heldStock(c, items(c), hrid).inventory;
    return { stock: (a) => heldStock(c, items(c), a.outputItems?.[0]?.itemHrid), book: (a) => books.get(a.outputItems?.[0]?.itemHrid) || null, days, minJobHours, coins: have("/items/coin"), have, sellAt };
};
const expectRank = (c, options) => rankSkilling(skillingCharacter(c, items(c), clientData), clientData, market(options.sellAt || "ask"), { plan: planFor(c, options), ...options });

// The best tailoring item: 5 in the inventory, 3 on a sell order, and an order
// book where some buy orders pay above break-even and some don't.
const topTailoring = rankSkilling(skillingCharacter(character, items(character), clientData), clientData, market("ask"), { skill: "tailoring" }).available[0];
const PRODUCT = topTailoring.action.outputItems[0].itemHrid;
character.characterItems.push({ hash: "stock", itemHrid: PRODUCT, itemLocationHrid: "/item_locations/inventory", enhancementLevel: 0, count: 5 });
character.myMarketListings = [{ id: 1, itemHrid: PRODUCT, enhancementLevel: 0, isSell: true, orderQuantity: 10, filledQuantity: 7, status: "/market_order_status/active" }];
const askPrice = marketData[PRODUCT][0].a;
const orderBook = { type: "market_item_order_books_updated", marketItemOrderBooks: { itemHrid: PRODUCT, orderBooks: [{
    asks: [{ price: askPrice, quantity: 40 }],
    bids: [{ price: askPrice, quantity: 60 }, { price: Math.round(askPrice * 0.9), quantity: 30 }, { price: 1, quantity: 1000 }],
}] } };
const coinText = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));

const MOBILE = !!process.env.MOBILE;
const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/advisor.user.js"></script>
<style>body{background:#0b0e1a;color:#ddd;font-family:sans-serif}</style></head><body>
<script>
  const xhr = new XMLHttpRequest(); xhr.open("GET", "/client-data.json", false); xhr.send();
  const data = JSON.parse(xhr.responseText);
  window.localStorageUtil = { getInitClientData: () => data };
  const ws = new WebSocket("ws://" + location.host + "/fake/api.milkywayidle.com/ws");
  ws.onmessage = (e) => { window.lastType = JSON.parse(e.data).type; };
  // MWITools' public API: only the market opener is used here.
  window.MWITools = { shopping: { openMarketplace: (hrid, level) => { window.marketOpened = hrid + "+" + level; return true; } } };
  // The game: navigation, skill page with category tabs, action cards, action panel.
  const production = Object.values(data.actionDetailMap).filter((a) => a.function === "/action_functions/production" || a.function === "/action_functions/gathering");
  document.body.insertAdjacentHTML("afterbegin", '<nav id="nav"></nav><div id="skillpage"></div>');
  document.getElementById("nav").innerHTML = '<div class="NavigationBar_navigationLinks__zz">' + ["tailoring", "foraging"].map((s) => '<div class="NavigationBar_navigationLink__abc" data-skill="' + s + '"><svg><use href="/sprites/skills.svg#' + s + '"></use></svg>' + s + '</div>').join("") + '</div>';
  function showSkill(skill, category) {
    const list = production.filter((a) => a.type === "/action_types/" + skill);
    const categories = [...new Set(list.map((a) => a.category))];
    const current = category || categories[0];
    const page = document.getElementById("skillpage");
    page.innerHTML = '<div>' + categories.map((c) => '<button role="tab" aria-selected="' + (c === current) + '" data-cat="' + c + '">' + data.actionCategoryDetailMap[c].name + '</button>').join("") + '</div>' +
      list.filter((a) => a.category === current).map((a) => '<div class="SkillAction_skillAction__x" data-hrid="' + a.hrid + '"><svg><use href="/sprites/items.svg#' + (a.outputItems ? a.outputItems[0].itemHrid : a.hrid).split("/").pop() + '"></use></svg><div class="SkillAction_name__x">' + a.name + '</div></div>').join("");
    page.querySelectorAll("[role=tab]").forEach((b) => b.onclick = () => setTimeout(() => showSkill(skill, b.dataset.cat), 50));
    page.querySelectorAll(".SkillAction_skillAction__x").forEach((c) => c.onclick = () => setTimeout(() => openPanel(data.actionDetailMap[c.dataset.hrid]), 50));
  }
  document.querySelectorAll(".NavigationBar_navigationLink__abc").forEach((l) => l.onclick = () => setTimeout(() => showSkill(l.dataset.skill), 80));
  function openPanel(action) {
    document.querySelector(".modal")?.remove();
    const modal = document.createElement("div");
    modal.className = "modal";
    modal.innerHTML = '<div class="SkillActionDetail_regularComponent__y"><div class="SkillActionDetail_name__y">' + action.name + '</div>' +
      '<div class="SkillActionDetail_maxActionCountInput__y"><input type="text" value="∞"></div>' +
      '<div class="SkillActionDetail_buttonsContainer__y"><button class="start">Start</button><button class="queue">Add to Queue</button></div></div>';
    document.body.appendChild(modal);
  }
</script></body></html>`;

let sockets = [];
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
const wss = new WebSocketServer({ server });
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
const rows = (page, section = 0) => page.$$eval(".mwia-body section", (sections, i) => [...(sections[i]?.querySelectorAll(".mwia-skill-row") || [])].map((row) => ({
    name: row.querySelector(".mwia-skill-name").childNodes[0].textContent.trim(),
    sub: row.querySelector(".mwia-skill-name small").textContent,
    gold: row.querySelector(".mwia-skill-nums b").textContent,
    xp: row.querySelector(".mwia-skill-nums .mwia-dim").textContent,
    hint: row.querySelector(".mwia-skill-hint")?.textContent || "",
    warn: row.querySelector(".mwia-warn")?.title || "",
})), section);
const select = async (page, setting, value) => {
    await page.select(`[data-setting="${setting}"]`, value);
    await new Promise((r) => setTimeout(r, 100));
};

try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.setViewport(MOBILE ? { width: 390, height: 844 } : { width: 1300, height: 900 });
    await page.goto(url);
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });
    await page.click(".mwia-launcher");
    await page.waitForSelector('[data-tab="skilling"]');
    await page.click('[data-tab="skilling"]');
    await page.waitForSelector(".mwia-skill-row", { timeout: 8000 });

    // All skills, my teas, sell at ask.
    const expected = expectRank(character, { skill: "all", teaMode: "current" });
    const shown = await rows(page);
    check("ranked list shown", shown.length > 0, `${shown.length} rows`);
    check("top rows match the calculation", expected.available.slice(0, 5).every((e, i) => shown[i]?.name === e.action.name && shown[i].gold === `${coinText(e.goldPerDay)}/day`),
        JSON.stringify(shown.slice(0, 3)) + " vs " + expected.available.slice(0, 3).map((e) => `${e.action.name} ${coinText(e.goldPerDay)}`).join(", "));
    check("XP per day shown", shown.every((r) => /XP\/day$/.test(r.xp)));
    const levels = Object.fromEntries(character.characterSkills.map((s) => [s.skillHrid.split("/").pop(), s.level]));
    const tooHigh = shown.filter((r) => { const [skill, level] = r.sub.toLowerCase().split(" "); return !(Number(level) <= (levels[skill] ?? 0)); });
    check("only actions within your levels", tooHigh.length === 0, JSON.stringify(tooHigh.slice(0, 2)));
    check("no woodcutting without the skill", !shown.some((r) => /^Woodcutting/.test(r.sub)));
    await page.screenshot({ path: path.join(shotDir, "skilling-1-all.png") });

    // Foraging: buffs from equipment and house, wisdom tea from the slot (not counted twice).
    await select(page, "skillingSkill", "foraging");
    const foraging = await rows(page);
    const expForaging = expectRank(character, { skill: "foraging", teaMode: "current" });
    check("skill filter shows only that skill", foraging.length > 0 && foraging.every((r) => /^Foraging/.test(r.sub)), foraging.map((r) => r.sub).join(", "));
    const top = expForaging.available[0];
    check("foraging numbers match (speed, efficiency, wisdom tea)", foraging[0].name === top.action.name && foraging[0].gold === `${coinText(top.goldPerDay)}/day` && foraging[0].xp === `${coinText(top.xpPerDay)} XP/day`,
        `${JSON.stringify(foraging[0])} vs ${top.action.name} ${coinText(top.goldPerDay)} ${coinText(top.xpPerDay)}`);
    check("speed and efficiency buffs counted", Math.abs(top.speed - 0.15) < 1e-9 && Math.abs(top.efficiency - top.levelEfficiency - 0.03) < 1e-9 && Math.abs(top.xpPerAction - top.action.experienceGain.value * 1.12) < 1e-9,
        `speed ${top.speed} eff ${top.efficiency} xp ${top.xpPerAction}`);
    check("tea suggestion hint", !top.betterTeas || /with other teas/.test(foraging[0].hint), foraging[0].hint);
    check("no tea nobody sells is suggested", expForaging.available.every((e) => !e.best.result.teas.includes("/items/gathering_tea")));

    // Expanding a row shows the calculation and the tea advice.
    await page.click(".mwia-skill-row summary");
    const detail = await page.$eval(".mwia-skill-row[open] .mwia-skill-detail", (n) => n.textContent);
    check("tap shows the calculation", /actions\/h/.test(detail) && /Each action gives/.test(detail) && /Wisdom Tea/.test(detail) && /\+15\.0% speed/.test(detail), detail.slice(0, 200));
    const layout = await page.$eval(".mwia-skill-row[open] .mwia-skill-detail", (n) => ({ sections: [...n.querySelectorAll(".mwia-skill-sec")].map((d) => d.querySelector("summary").textContent.trim()), open: n.querySelectorAll(".mwia-skill-sec[open]").length }));
    check("detail is short headings that open", layout.sections.length >= 4 && layout.open === 0 && /^⏱ Speed \d+ actions\/h$/.test(layout.sections[0]) && layout.sections.some((t) => /^🍵 Teas/.test(t)), JSON.stringify(layout));
    check("tap shows the tea advice", /Your teas: Wisdom Tea/.test(detail) && (/Best:/.test(detail) || /already the best/.test(detail)));
    await page.screenshot({ path: path.join(shotDir, "skilling-2-foraging.png") });

    // Unlocks soon, with the time it takes.
    const near = await rows(page, 1);
    const expNear = expForaging.upcoming;
    check("near-unlock list within reach", near.length === expNear.length && near.length > 0 && expNear.every((e) => e.needLevels <= NEAR_LEVELS), `${near.length} vs ${expNear.length}`);
    check("near-unlock shows time to level", /in \d+ levels? · ~[\d.]+ (min|h|days)/.test(near[0]?.sub || ""), near[0]?.sub);

    // Best teas ranking.
    await select(page, "skillingTeas", "best");
    const best = await rows(page);
    const expBest = expectRank(character, { skill: "foraging", teaMode: "best" });
    check("best-teas ranking matches", best[0].gold === `${coinText(expBest.available[0].goldPerDay)}/day`, `${best[0].gold} vs ${coinText(expBest.available[0].goldPerDay)}`);
    check("best teas earn at least as much", expBest.available[0].profitPerHour >= top.profitPerHour - 1e-6);

    // Thin market: nobody bids on Cotton Fabric.
    await select(page, "skillingTeas", "current");
    await select(page, "skillingSkill", "tailoring");
    const tailoring = await rows(page);
    const fabric = tailoring.find((r) => r.name === "Cotton Fabric");
    check("thin-market warning", !!fabric && /No buy orders for Cotton Fabric/.test(fabric.warn), JSON.stringify(fabric));

    // Selling at the bid changes the prices.
    await select(page, "skillingSellAt", "bid");
    const bid = await rows(page);
    const expBid = expectRank(character, { skill: "tailoring", teaMode: "current", sellAt: "bid" });
    check("sell at bid matches", bid[0].gold === (expBid.available[0].valid ? `${coinText(expBid.available[0].goldPerDay)}/day` : "–"), `${bid[0].name} ${bid[0].gold} vs ${expBid.available[0].action.name}`);
    await select(page, "skillingSellAt", "ask");

    // Thin margin.
    await select(page, "skillingSellAt", "ask");
    const boots = (await rows(page)).find((r) => r.name === "Cotton Boots");
    const expBoots = expectRank(character, { skill: "tailoring" }).available.find((e) => e.action.name === "Cotton Boots");
    check("thin-margin warning", expBoots.margin > 0 && expBoots.margin < RISKY_MARGIN && /Thin margin: a [\d.]+% drop/.test(boots?.warn || ""), `${expBoots.margin} ${JSON.stringify(boots)}`);

    // Sales limit: crafted items run only part of the day, gathering is never limited.
    await page.$eval('[data-setting="skillingSellCap"]', (input) => { input.value = "100"; input.dispatchEvent(new Event("change", { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 100));
    const capped = await rows(page);
    const expCapped = expectRank(character, { skill: "tailoring", sellCap: 100 });
    check("sales limit caps crafted items", expCapped.available[0].capped && capped[0].name === expCapped.available[0].action.name && capped[0].gold === `${coinText(expCapped.available[0].goldPerDay)}/day` && /h\/day \(sales limit\)/.test(capped[0].sub),
        `${JSON.stringify(capped[0])} vs ${expCapped.available[0].action.name} ${coinText(expCapped.available[0].goldPerDay)}`);
    check("sales limit is saved", await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-settings")).skillingSellCap === 100));
    check("gathering is never limited", expectRank(character, { skill: "foraging", sellCap: 100 }).available.every((e) => !e.capped));
    await page.screenshot({ path: path.join(shotDir, "skilling-4-capped.png") });
    await page.$eval('[data-setting="skillingSellCap"]', (input) => { input.value = ""; input.dispatchEvent(new Event("change", { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 100));

    // Crates and caches are worth what they hold.
    const crate = market("ask").sell("/items/small_artisans_crate");
    check("crates valued by their contents", crate.source === "contents" && crate.price > 1000, JSON.stringify(crate));
    const cowbell = market("ask").sell("/items/cowbell");
    check("a cowbell is a tenth of a bag (18% tax)", Math.abs(cowbell.price - (marketData["/items/bag_of_10_cowbells"][0].a * 0.82) / 10) < 1e-6, JSON.stringify(cowbell));

    // How many to make: buy orders above break-even, less what you hold and have listed.
    await select(page, "skillingSkill", "tailoring");
    check("without an order book or limit it says how to get a suggestion", /open [^.]* on the market once/.test(await page.$eval(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"] .mwia-skill-detail`, (n) => n.textContent)));
    books.set(PRODUCT, { at: Date.now(), asks: orderBook.marketItemOrderBooks.orderBooks[0].asks, bids: orderBook.marketItemOrderBooks.orderBooks[0].bids });
    for (const socket of sockets) socket.send(JSON.stringify(orderBook));
    await page.waitForFunction(() => window.lastType === "market_item_order_books_updated");
    await select(page, "skillingSkill", "all");
    await select(page, "skillingSkill", "tailoring");
    const expPlan = expectRank(character, { skill: "tailoring" }).available.find((e) => e.hrid === topTailoring.hrid).suggestion;
    const planRow = (await rows(page)).find((r) => r.name === topTailoring.action.name);
    check("suggestion from the order book, less stock and listings", expPlan.known && expPlan.profitableBids === 90 && expPlan.count === Math.ceil((90 - 8) / topTailoring.mainCount) && planRow.sub.includes(`make ${expPlan.count}`),
        `${JSON.stringify(expPlan && { bids: expPlan.profitableBids, count: expPlan.count, breakEven: expPlan.breakEven })} / ${planRow?.sub}`);
    check("order book survives a reload", await page.evaluate((hrid) => !!JSON.parse(localStorage.getItem("mwia-order-books") || "{}")[hrid], PRODUCT));

    // An order book without buyers above break-even says so, instead of "you hold enough".
    const second = expectRank(character, { skill: "tailoring" }).available.find((e) => e.suggestion && !e.suggestion.known && e.hrid !== topTailoring.hrid);
    const secondItem = second.action.outputItems[0].itemHrid;
    books.set(secondItem, { at: Date.now(), asks: [], bids: [{ price: 1, quantity: 50 }] });
    for (const socket of sockets) socket.send(JSON.stringify({ type: "market_item_order_books_updated", marketItemOrderBooks: { itemHrid: secondItem, orderBooks: [{ asks: [], bids: [[1, 50]] }] } }));
    await page.waitForFunction(() => window.lastType === "market_item_order_books_updated");
    await select(page, "skillingSkill", "all");
    await select(page, "skillingSkill", "tailoring");
    const noBuyers = (await rows(page)).find((r) => r.name === second.action.name);
    const noBuyersDetail = await page.$eval(`.mwia-skill-row[data-hrid="${second.hrid}"] .mwia-skill-detail`, (n) => n.textContent);
    check("no buyers above break-even is said plainly", /no buyers or sellers to go by/.test(noBuyers?.sub || "") && /no buy orders pay/i.test(noBuyersDetail) && !/hold enough/.test(noBuyersDetail), noBuyers?.sub);

    // The market button opens the item on the market (through MWITools' API here).
    await page.$eval(`.mwia-skill-row[data-hrid="${second.hrid}"]`, (row) => { row.open = true; });
    await page.click(`.mwia-skill-row[data-hrid="${second.hrid}"] [data-action="skilling-market"]`);
    const opened = await page.evaluate(() => ({ market: window.marketOpened, hidden: document.querySelector(".mwia-panel").classList.contains("mwia-hidden") }));
    check("market button opens the item on the market", opened.market === secondItem + "+0" && opened.hidden, JSON.stringify(opened));
    await page.click(".mwia-launcher");

    // Selling at the ask: as many as others list near the lowest ask (your own orders taken out).
    const third = expectRank(character, { skill: "tailoring" }).available.find((e) => e.suggestion && !e.suggestion.known && e.hrid !== topTailoring.hrid && e.hrid !== second.hrid);
    const thirdItem = third.action.outputItems[0].itemHrid;
    const low = marketData[thirdItem][0].a;
    const thirdAsks = [{ price: low, quantity: 40 }, { price: Math.floor(low * 1.03), quantity: 20 }, { price: low * 2, quantity: 500 }];
    books.set(thirdItem, { at: Date.now(), asks: thirdAsks, bids: [] });
    for (const socket of sockets) socket.send(JSON.stringify({ type: "market_item_order_books_updated", marketItemOrderBooks: { itemHrid: thirdItem, orderBooks: [{ asks: thirdAsks, bids: [] }] } }));
    await page.waitForFunction(() => window.lastType === "market_item_order_books_updated");
    await select(page, "skillingSkill", "all");
    await select(page, "skillingSkill", "tailoring");
    const expAsks = expectRank(character, { skill: "tailoring" }).available.find((e) => e.hrid === third.hrid).suggestion;
    const asksRow = (await rows(page)).find((r) => r.name === third.action.name);
    check("suggestion from sellers near the lowest ask", expAsks.nearAsks === 60 && expAsks.count === Math.ceil((60 - expAsks.stock.inventory - expAsks.stock.listed) / third.mainCount) && asksRow?.sub.includes(`make ${expAsks.count}`), `${JSON.stringify({ near: expAsks.nearAsks, count: expAsks.count })} / ${asksRow?.sub}`);
    check("sellers near the ask don't count when selling at the bid", (expectRank(character, { skill: "tailoring", sellAt: "bid" }).available.find((e) => e.hrid === third.hrid)?.suggestion?.nearAsks ?? null) === null);

    // Short jobs are greyed out and listed last.
    await select(page, "skillingMinJob", "8");
    const expShort = expectRank(character, { skill: "tailoring", minJobHours: 8 }).available;
    const shortRows = await page.$$eval(".mwia-body section:first-of-type .mwia-skill-row", (list) => list.map((r) => ({ name: r.querySelector(".mwia-skill-name").childNodes[0].textContent.trim(), faded: r.classList.contains("mwia-faded") })));
    const shortIndex = shortRows.findIndex((r) => r.name === topTailoring.action.name);
    check("short job greyed out and listed last", expShort.find((e) => e.hrid === topTailoring.hrid).suggestion.short && shortRows[shortIndex]?.faded && shortIndex > 0 && expShort[shortIndex]?.hrid === topTailoring.hrid,
        `index ${shortIndex} ${JSON.stringify(shortRows[shortIndex])}`);
    await select(page, "skillingMinJob", "0");

    // The button opens the action in the game with the count filled in.
    await page.$eval(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"]`, (row) => { row.open = true; });
    await page.$eval(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"] [data-action="skilling-make"]`, (b) => b.scrollIntoView({ block: "end" }));
    const buttonVisible = await page.$eval(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"] .mwia-skill-buttons`, (n) => n.getBoundingClientRect().height > 0).catch(() => false);
    check("make and market buttons are at the top of the opened row", buttonVisible);
    await page.screenshot({ path: path.join(shotDir, "skilling-5-plan.png") });
    await page.click(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"] [data-action="skilling-make"]`);
    await page.waitForFunction(() => /^\d+$/.test(document.querySelector(".modal input")?.value || ""), { timeout: 6000 }).catch(() => null);
    const filled = await page.evaluate(() => ({ name: document.querySelector(".modal .SkillActionDetail_name__y")?.textContent, value: document.querySelector(".modal input")?.value, hidden: document.querySelector(".mwia-panel").classList.contains("mwia-hidden") }));
    check("make button opens the action with the count", filled.name === topTailoring.action.name && filled.value === String(expPlan.count) && filled.hidden, JSON.stringify(filled));
    await page.screenshot({ path: path.join(shotDir, "skilling-6-opened.png") });
    await page.evaluate(() => document.querySelector(".modal")?.remove());
    await page.click(".mwia-launcher");

    // A buff update from the game shows on the next render.
    await select(page, "skillingSkill", "foraging");
    const faster = { ...character, equipmentActionTypeBuffsMap: { [FORAGING]: [{ typeHrid: "/buff_types/action_speed", flatBoost: 0.5, ratioBoost: 0 }] } };
    for (const socket of sockets) socket.send(JSON.stringify({ type: "equipment_buffs_updated", equipmentActionTypeBuffsMap: faster.equipmentActionTypeBuffsMap }));
    await page.waitForFunction(() => window.lastType === "equipment_buffs_updated");
    await select(page, "skillingSkill", "all");
    await select(page, "skillingSkill", "foraging");
    const updated = await rows(page);
    const expUpdated = expectRank(faster, { skill: "foraging", teaMode: "current" }).available[0];
    check("buff update from the game is used", updated[0].gold === `${coinText(expUpdated.goldPerDay)}/day` && updated[0].gold !== foraging[0].gold, `${updated[0].gold} vs ${coinText(expUpdated.goldPerDay)}`);

    const fit = await page.evaluate(() => ({ scroll: document.querySelector(".mwia-body").scrollWidth, client: document.querySelector(".mwia-body").clientWidth }));
    check("list fits the width", fit.scroll <= fit.client + 1, JSON.stringify(fit));
    await page.screenshot({ path: path.join(shotDir, "skilling-3-updated.png") });
    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
