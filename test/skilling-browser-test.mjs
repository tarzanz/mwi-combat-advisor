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
import { NEAR_LEVELS, PLAN_MODES, RISKY_MARGIN, heldStock, liquidityRating, marketPricer, rankSkilling, skillingCharacter, usableTeas } from "../src/skilling.js";
import { rankUpgrades, toolTiers } from "../src/skilling-upgrades.js";
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
// A Large Pouch: two drink slots in every skill. Total level 800 is enough for a Giant Pouch (3 slots).
character.characterItems.push({ hash: "pouch", itemHrid: "/items/large_pouch", itemLocationHrid: "/item_locations/pouch", count: 1, enhancementLevel: 0 });
character.characterSkills.push({ skillHrid: "/skills/total_level", level: 800 });
// Tools: a Cheese Needle worn (Tailoring 20 allows an Azure Needle), Azure Shears in the inventory.
character.characterItems.push({ hash: "needle", itemHrid: "/items/cheese_needle", itemLocationHrid: "/item_locations/tailoring_tool", count: 1, enhancementLevel: 0 });
character.characterItems.push({ hash: "shears", itemHrid: "/items/azure_shears", itemLocationHrid: "/item_locations/inventory", count: 1, enhancementLevel: 0 });
// Enhancing and Alchemy, levelled by paying for it.
character.characterSkills.push({ skillHrid: "/skills/enhancing", level: 30, experience: clientData.levelExperienceTable[30] + 10 });
character.characterSkills.push({ skillHrid: "/skills/alchemy", level: 28, experience: clientData.levelExperienceTable[28] + 10 });
const FORAGING = "/action_types/foraging";
character.actionTypeDrinkSlotsMap = { ...character.actionTypeDrinkSlotsMap, [FORAGING]: [{ itemHrid: "/items/wisdom_tea" }, null, null] };
character.equipmentActionTypeBuffsMap = { [FORAGING]: [{ typeHrid: "/buff_types/action_speed", flatBoost: 0.15, ratioBoost: 0 }] };
character.houseActionTypeBuffsMap = { [FORAGING]: [{ typeHrid: "/buff_types/efficiency", flatBoost: 0.03, ratioBoost: 0 }] };
// The game's own copy of the tea buffs; the tab adds teas itself, so these must not count twice.
character.consumableActionTypeBuffsMap = { [FORAGING]: [{ typeHrid: "/buff_types/wisdom", flatBoost: 0.12, ratioBoost: 0 }] };

// Market: every item at three times its vendor price, best bid at 2.5 times (a
// spread within WIDE_SPREAD, so listings are valued at the ask).
// Nobody bids on Cotton Fabric; nobody sells Gathering Tea.
const marketData = {};
for (const item of Object.values(clientData.itemDetailMap)) {
    const vendor = item.sellPrice || 1;
    marketData[item.hrid] = { 0: { a: 3 * vendor, b: item.hrid === "/items/cotton_fabric" ? -1 : 2.5 * vendor } };
}
marketData["/items/gathering_tea"] = { 0: { a: -1, b: 10 } };
// Cheap Efficiency and Tailoring Tea: a third tea slot pays for itself.
marketData["/items/efficiency_tea"] = { 0: { a: 2, b: 1 } };
marketData["/items/tailoring_tea"] = { 0: { a: 2, b: 1 } };
marketData["/items/artisan_tea"] = { 0: { a: 2, b: 1 } };
// Cotton Boots sell for 2% more than their materials cost: a thin margin.
const bootsCost = clientData.actionDetailMap["/actions/tailoring/cotton_boots"].inputItems.reduce((sum, i) => sum + i.count * marketData[i.itemHrid][0].a, 0);
marketData["/items/cotton_boots"] = { 0: { a: Math.round((bootsCost * 1.02) / 0.96), b: Math.round(bootsCost) } };

const items = (c) => new Map(c.characterItems.map((i) => [i.hash, i]));
// No +level is for sale or bought in this market: an enhanced item sells at its +0 bid (a floor), after tax.
const resale = (hrid) => ({ price: marketData[hrid][0].b * 0.96, source: "lower", level: 0 });
const ownedOf = (c) => (hrid) => heldStock(c, items(c), hrid).inventory;
const market = (sellAt) => marketPricer((hrid) => marketData[hrid]?.[0], clientData, sellAt);
const books = new Map();
// No price history in the test browser: every market is rated thin.
const planFor = (c, { mode = "away", sellAt = "ask" } = {}) => {
    const have = (hrid) => heldStock(c, items(c), hrid).inventory;
    return { ...PLAN_MODES[mode], stock: (a) => heldStock(c, items(c), a.outputItems?.[0]?.itemHrid), book: (a) => books.get(a.outputItems?.[0]?.itemHrid) || null, coins: have("/items/coin"), have, sellAt, liquidity: (a) => (a.outputItems?.[0]?.itemHrid === "/items/coin" ? { rating: "stable", known: true, coin: true } : liquidityRating(null)), inputMarket: (hrid) => ({ liquidity: liquidityRating(null), book: books.get(hrid) || null }) };
};
const expectRank = (c, options) => rankSkilling(skillingCharacter(c, items(c), clientData), clientData, market(options.sellAt || "ask"), { plan: planFor(c, options), leveling: { resale, owned: ownedOf(c) }, ...options });

// The item on top of the Enhancing list (all-gold focus) is in the inventory, so ▶ can put it in the slot.
const topEnhance = expectRank(character, { skill: "enhancing", goldWeight: 1 }).available[0];
character.characterItems.push({ hash: "enh", itemHrid: topEnhance.action.itemHrid, itemLocationHrid: "/item_locations/inventory", count: 1, enhancementLevel: 0 });

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
  // Opening the market shows the game's marketplace panel; the test closes it again.
  window.MWITools = { shopping: { openMarketplace: (hrid, level) => {
    window.marketOpened = hrid + "+" + level;
    setTimeout(() => document.body.insertAdjacentHTML("beforeend", '<div class="MarketplacePanel_marketplacePanel__x" style="position:fixed;inset:0;background:#123">Marketplace</div>'), 200);
    return true;
  }, ready: true, getCartItem: () => null, addToCart: (list) => { (window.cart ||= []).push(...list); return { ok: true }; } } };
  // The game: navigation, skill page with category tabs, action cards, action panel.
  const production = Object.values(data.actionDetailMap).filter((a) => a.function === "/action_functions/production" || a.function === "/action_functions/gathering");
  document.body.insertAdjacentHTML("afterbegin", '<nav id="nav"></nav><div id="skillpage"></div>');
  document.getElementById("nav").innerHTML = '<div class="NavigationBar_navigationLinks__zz">' + ["tailoring", "foraging", "enhancing", "alchemy"].map((s) => '<div class="NavigationBar_navigationLink__abc" data-skill="' + s + '"><svg><use href="/sprites/skills.svg#' + s + '"></use></svg>' + s + '</div>').join("") + '</div>';
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
  // The game's own Enhance / Alchemize handlers and their windows (React-like: a component behind the input).
  const gameRoot = document.createElement("div");
  gameRoot.id = "root";
  document.body.appendChild(gameRoot);
  gameRoot["__reactContainer$t"] = { current: { stateNode: {
    handleEnhanceItem: (hash) => { window.enhanceCall = hash; setTimeout(() => levelPanel("enhancing", hash), 50); },
    handleAlchemizeItem: (hash) => { window.alchemyCall = hash; setTimeout(() => levelPanel("alchemy", hash), 50); },
  } } };
  function levelPanel(kind, hash) {
    document.querySelector(".lvl")?.remove();
    const box = document.createElement("div");
    box.className = "lvl";
    const tabs = kind === "alchemy" ? ["Coinify", "Decompose", "Transmute", "Unrefine"].map((t) => '<button role="tab" aria-selected="' + (t === "Coinify") + '">' + t + "</button>").join("") : "";
    box.innerHTML = tabs + '<div class="SkillActionDetail_' + kind + 'Component__q"><input type="text"></div>';
    document.body.appendChild(box);
    const comp = { state: { primaryItemHash: hash },
      enhancingMaxLevelChanged: (e) => { window.enhanceTarget = e.target.value; },
      selectEnhancingItemHandler: (h) => { comp.state.primaryItemHash = h; },
      // Changing the tab empties the slot, as a fresh window would.
      selectAlchemyItemHandler: (h) => { comp.state.primaryItemHash = h; window.alchemyItem = h; },
      maxActionCountChanged: (e) => { window.alchemyCount = e.target.value; } };
    box.querySelector("input")["__reactFiber$t"] = { stateNode: null, return: { stateNode: comp, return: null } };
    box.querySelectorAll("[role=tab]").forEach((b) => b.onclick = () => { box.querySelectorAll("[role=tab]").forEach((x) => x.setAttribute("aria-selected", String(x === b))); window.alchemyTab = b.textContent; comp.state.primaryItemHash = null; });
  }
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
// Rows of the section with this heading ("Best now", "Unlocks soon").
const rows = (page, heading = "Best now") => page.$$eval(".mwia-body section", (sections, title) => [...(sections.find((s) => s.querySelector("h3")?.textContent === title)?.querySelectorAll(".mwia-skill-row") || [])].map((row) => ({
    name: row.querySelector(".mwia-skill-name").childNodes[0].textContent.trim(),
    sub: row.querySelector(".mwia-skill-name small").textContent,
    gold: row.querySelector(".mwia-skill-nums b").textContent,
    xp: row.querySelector(".mwia-skill-nums .mwia-dim").textContent,
    hint: row.querySelector(".mwia-skill-hint")?.textContent || "",
    warn: row.querySelector(".mwia-warn")?.title || "",
})), heading);
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
    const near = await rows(page, "Unlocks soon");
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

    // Thin margin (shown in active mode; away leaves it out).
    await select(page, "skillingSellAt", "ask");
    await select(page, "skillingMode", "active");
    const boots = (await rows(page)).find((r) => r.name === "Cotton Boots");
    await select(page, "skillingMode", "away");
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

    // How many to make, without the market: an 8 h job less what you hold and have
    // listed, within 10% of the coins (a thin market: no history here).
    await select(page, "skillingSkill", "tailoring");
    const expPlan = expectRank(character, { skill: "tailoring" }).available.find((e) => e.hrid === topTailoring.hrid).suggestion;
    const planRow = (await rows(page)).find((r) => r.name === topTailoring.action.name);
    check("suggestion without the market, less stock and listings", expPlan.known && expPlan.held === 8 && expPlan.liquidity.rating === "thin" && expPlan.count > 0 && planRow?.sub.includes(`🔴 thin market · make ${expPlan.count.toLocaleString("en-US")}`),
        `${JSON.stringify(expPlan && { held: expPlan.held, count: expPlan.count, coins: expPlan.limitedByCoins })} / ${planRow?.sub}`);
    check("a thin market gets 10% of the coins", expPlan.limitedByCoins && expPlan.batch.toBuy <= 500000 * 0.1 + 1e-6 && expPlan.coinShare === 0.1, JSON.stringify({ toBuy: expPlan.batch.toBuy, share: expPlan.coinShare }));
    const batch = expPlan.batch;
    check("batch cost and profit add up", Math.abs(batch.materials - expPlan.count * topTailoring.costPerAction) < 1e-6 && Math.abs(batch.profit - (batch.revenue - batch.materials - batch.teas)) < 1e-6 && planRow.sub.includes(`${coinText(batch.materials)} in, +${coinText(batch.profit)}`),
        `${planRow.sub} vs ${coinText(batch.materials)} / ${coinText(batch.profit)}`);
    const rich = { ...character, characterItems: [...character.characterItems, { hash: "rich", itemHrid: "/items/coin", itemLocationHrid: "/item_locations/inventory", count: 1e13 }] };
    const richPlan = expectRank(rich, { skill: "tailoring" }).available.find((e) => e.hrid === topTailoring.hrid).suggestion;
    check("with coins to spare: the planned 8 h less your stock", !richPlan.limitedByCoins && richPlan.count === Math.ceil((Math.floor(8 * topTailoring.actionsPerHour) * topTailoring.mainCount - 8) / topTailoring.mainCount - 1e-9) && richPlan.hours <= 8 + 1e-9,
        JSON.stringify({ count: richPlan.count, hours: richPlan.hours }));

    // An order book seen on the market is shown, but doesn't change the count.
    books.set(PRODUCT, { at: Date.now(), asks: orderBook.marketItemOrderBooks.orderBooks[0].asks, bids: orderBook.marketItemOrderBooks.orderBooks[0].bids });
    for (const socket of sockets) socket.send(JSON.stringify(orderBook));
    await page.waitForFunction(() => window.lastType === "market_item_order_books_updated");
    await select(page, "skillingSkill", "all");
    await select(page, "skillingSkill", "tailoring");
    const withBook = expectRank(character, { skill: "tailoring" }).available.find((e) => e.hrid === topTailoring.hrid).suggestion;
    const bookDetail = await page.$eval(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"] .mwia-skill-detail`, (n) => n.textContent);
    check("order book shown, count unchanged", withBook.count === expPlan.count && withBook.profitableBids === 90 && /On the market .* ago: 90 in buy orders/.test(bookDetail) && /thin market: under 12 hours of prices/.test(bookDetail), bookDetail.slice(0, 300));
    check("materials to buy listed with their markets", /To buy: [\d,]+ .*🔴 thin market \(too little history\) – open it on the market/.test(bookDetail), bookDetail);

    // A material's order book caps the job at what was listed near its lowest ask.
    const material = topTailoring.inputs[0].itemHrid;
    const materialAsk = marketData[material][0].a;
    const listed = Math.ceil(topTailoring.inputs[0].count * 10);
    const materialBook = { type: "market_item_order_books_updated", marketItemOrderBooks: { itemHrid: material, orderBooks: [{ asks: [{ price: materialAsk, quantity: listed }, { price: materialAsk * 2, quantity: 1e6 }], bids: [] }] } };
    books.set(material, { at: Date.now(), asks: materialBook.marketItemOrderBooks.orderBooks[0].asks, bids: [] });
    for (const socket of sockets) socket.send(JSON.stringify(materialBook));
    await page.waitForFunction(() => window.lastType === "market_item_order_books_updated");
    await select(page, "skillingSkill", "all");
    await select(page, "skillingSkill", "tailoring");
    const byMaterial = expectRank(character, { skill: "tailoring" }).available.find((e) => e.hrid === topTailoring.hrid).suggestion;
    const cappedDetail = await page.$eval(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"] .mwia-skill-detail`, (n) => n.textContent);
    check("a material's order book caps the job", byMaterial.limitedByBook === material && byMaterial.count < expPlan.count && byMaterial.count > 0 && byMaterial.count * topTailoring.inputs[0].count <= listed + 1e-9 + heldStock(character, items(character), material).inventory && new RegExp(`Capped at the .* you can get: ${listed} listed within 5% of the lowest ask`).test(cappedDetail) && cappedDetail.includes(`make ${byMaterial.count.toLocaleString("en-US")}`),
        `${byMaterial.count} / ${cappedDetail.slice(0, 400)}`);
    check("order book survives a reload", await page.evaluate((hrid) => !!JSON.parse(localStorage.getItem("mwia-order-books") || "{}")[hrid], PRODUCT));

    // The market button opens the item on the market (through MWITools' API here).
    const second = expectRank(character, { skill: "tailoring" }).available.find((e) => e.suggestion && e.hrid !== topTailoring.hrid);
    const secondItem = second.action.outputItems[0].itemHrid;
    await page.$eval(`.mwia-skill-row[data-hrid="${second.hrid}"]`, (row) => { row.open = true; });
    await page.click(`.mwia-skill-row[data-hrid="${second.hrid}"] [data-action="skilling-market"]`);
    const opened = await page.evaluate(() => ({ market: window.marketOpened, hidden: document.querySelector(".mwia-panel").classList.contains("mwia-hidden") }));
    check("market button opens the item on the market", opened.market === secondItem + "+0" && opened.hidden, JSON.stringify(opened));
    // Closing the market brings the panel back on the same row, still open.
    await page.waitForSelector('[class*="MarketplacePanel_marketplacePanel"]');
    await new Promise((r) => setTimeout(r, 700));
    check("panel stays hidden while the market is open", await page.$eval(".mwia-panel", (n) => n.classList.contains("mwia-hidden")));
    await page.evaluate(() => document.querySelector('[class*="MarketplacePanel_marketplacePanel"]').remove());
    await page.waitForFunction(() => !document.querySelector(".mwia-panel").classList.contains("mwia-hidden"), { timeout: 3000 }).catch(() => null);
    const back = await page.evaluate((hrid) => {
        const row = [...document.querySelectorAll(".mwia-skill-row")].find((r) => r.dataset.hrid === hrid);
        const body = document.querySelector(".mwia-body").getBoundingClientRect();
        const box = row?.getBoundingClientRect();
        return { shown: !document.querySelector(".mwia-panel").classList.contains("mwia-hidden"), open: !!row?.open, inView: !!box && box.top >= body.top - 1 && box.top < body.bottom };
    }, second.hrid);
    check("closing the market brings the panel back on the same open row", back.shown && back.open && back.inView, JSON.stringify(back));

    // Active: 1 h jobs, 20% of the coins on a thin market, thin margins shown.
    await select(page, "skillingMode", "active");
    const expActive = expectRank(character, { skill: "tailoring", mode: "active" }).available;
    const activeRows = await rows(page);
    const activeTop = expActive.find((e) => e.hrid === topTailoring.hrid).suggestion;
    check("active mode plans 1 h jobs", activeTop.plannedHours === 1 && activeTop.coinShare === 0.2 && activeRows.find((r) => r.name === topTailoring.action.name)?.sub.includes(`make ${activeTop.count.toLocaleString("en-US")}`), JSON.stringify({ count: activeTop.count }));
    check("active mode shows thin margins", activeRows.some((r) => r.name === "Cotton Boots") && expActive.every((e) => !e.thinMargin));
    check("plan mode is saved", await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-settings")).skillingMode === "active"));
    await select(page, "skillingMode", "away");
    const awayRows = await rows(page);
    const awayExp = expectRank(character, { skill: "tailoring" }).available;
    check("away mode leaves thin margins out of the list", !awayRows.some((r) => r.name === "Cotton Boots") && awayExp.find((e) => e.action.name === "Cotton Boots").thinMargin && awayRows.every((r, i) => r.name === awayExp.filter((e) => !e.thinMargin)[i].action.name),
        awayRows.map((r) => r.name).join(", "));
    check("show all mentions the thin margins", /\(\d+ with a thin margin\)/.test(await page.$eval('[data-action="skilling-all"]', (n) => n.textContent).catch(() => "")));

    // The button opens the action in the game with the count filled in.
    await page.$eval(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"]`, (row) => { row.open = true; });
    await page.$eval(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"] [data-action="skilling-make"]`, (b) => b.scrollIntoView({ block: "end" }));
    const buttonVisible = await page.$eval(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"] .mwia-skill-buttons`, (n) => n.getBoundingClientRect().height > 0).catch(() => false);
    check("make and market buttons are at the top of the opened row", buttonVisible);
    await page.screenshot({ path: path.join(shotDir, "skilling-5-plan.png") });
    await page.click(`.mwia-skill-row[data-hrid="${topTailoring.hrid}"] [data-action="skilling-make"]`);
    await page.waitForFunction(() => /^\d+$/.test(document.querySelector(".modal input")?.value || ""), { timeout: 6000 }).catch(() => null);
    const filled = await page.evaluate(() => ({ name: document.querySelector(".modal .SkillActionDetail_name__y")?.textContent, value: document.querySelector(".modal input")?.value, hidden: document.querySelector(".mwia-panel").classList.contains("mwia-hidden") }));
    check("make button opens the action with the count", filled.name === topTailoring.action.name && filled.value === String(byMaterial.count) && filled.hidden, JSON.stringify(filled));
    // The action window says which teas to have in the slots, and buys what is missing.
    await page.waitForSelector(".modal .mwia-guide-box", { timeout: 4000 }).catch(() => null);
    const teaAdvice = expectRank(character, { skill: "tailoring" }).available.find((e) => e.hrid === topTailoring.hrid);
    const adviceTeas = teaAdvice.betterTeas ? teaAdvice.best.result.teas : teaAdvice.current.teas;
    const guide = await page.evaluate(() => {
        const box = document.querySelector(".modal .mwia-guide-box");
        return box && { text: box.textContent.replace(/\s+/g, " "), lines: [...box.querySelectorAll("li")].map((li) => li.className + ":" + li.textContent.replace(/\s+/g, " ").trim()), beforeButtons: !!box.nextElementSibling?.matches('[class*="buttonsContainer"]'), cart: !!box.querySelector("[data-guide-cart]") };
    });
    const names = (list) => list.map((hrid) => clientData.itemDetailMap[hrid].name);
    check("action window lists the teas to put in", guide && guide.beforeButtons && names(adviceTeas).every((n) => guide.lines.some((l) => l.startsWith("mwia-guide-add:➕ Put in " + n))) && /2 tea slots \(Large Pouch\)/.test(guide.text) && adviceTeas.length <= 2,
        JSON.stringify(guide) + " vs " + names(adviceTeas));
    await page.evaluate(() => (window.cart = []));
    await page.click(".modal [data-guide-cart]");
    await page.waitForFunction(() => /Cart: added/.test(document.querySelector(".modal .mwia-guide-box")?.textContent || ""), { timeout: 3000 }).catch(() => null);
    const guideCart = await page.evaluate(() => window.cart);
    const guideStatus = await page.$eval(".modal .mwia-guide-status", (n) => n.textContent).catch(() => "");
    check("action window puts the missing teas in the cart", adviceTeas.length > 0 && adviceTeas.every((hrid) => guideCart.some((c) => c.itemHrid === hrid && c.quantity > 0)) && guideStatus === `Cart: added ${names(adviceTeas).join(", ")}.`, JSON.stringify(guideCart) + " " + guideStatus);
    await page.screenshot({ path: path.join(shotDir, "skilling-6-opened.png") });
    await page.evaluate(() => document.querySelector(".modal")?.remove());
    await new Promise((r) => setTimeout(r, 600));
    check("the tea box goes with the window", !(await page.$(".mwia-guide-box")));

    // Combat: the zone's window shows the last Upgrades analysis's drinks and food.
    await page.evaluate(() => {
        localStorage.setItem("mwia-combat-setups", JSON.stringify({ "/actions/combat/fly": { drinks: ["/items/attack_coffee", null], food: ["/items/donut"], perHour: { "/items/attack_coffee": 12, "/items/donut": 5 }, encountersPerHour: 300, tier: 0, at: Date.now() - 3 * 3600000 } }));
        openPanel(data.actionDetailMap["/actions/combat/fly"]);
    });
    await page.waitForSelector(".modal .mwia-guide-box", { timeout: 4000 }).catch(() => null);
    const combatGuide = await page.$eval(".modal .mwia-guide-box", (n) => n.textContent.replace(/\s+/g, " ")).catch(() => "");
    check("combat window shows the drinks and food to use", /analysed 3 h ago/.test(combatGuide) && /➕ Put in Attack Coffee 0 in inventory, 288 a day/.test(combatGuide) && /✓ Donut 300 in inventory, 120 a day/.test(combatGuide), combatGuide);
    await page.evaluate(() => (window.cart = []));
    await page.click(".modal [data-guide-cart]");
    await new Promise((r) => setTimeout(r, 400));
    const combatCart = await page.evaluate(() => window.cart);
    check("combat window buys only what is missing", combatCart.length === 1 && combatCart[0].itemHrid === "/items/attack_coffee" && combatCart[0].quantity === 288, JSON.stringify(combatCart));
    // The hour buttons fill in the fights at the analysis's pace, and the cart follows.
    await page.click('.modal [data-guide-hours="8"]');
    await page.waitForFunction(() => /What's missing for 8 h/.test(document.querySelector(".modal .mwia-guide-box")?.textContent || ""), { timeout: 3000 }).catch(() => null);
    const fights = await page.evaluate(() => ({ value: document.querySelector(".modal .SkillActionDetail_maxActionCountInput__y input").value, buttons: document.querySelectorAll(".modal [data-guide-hours]").length, picked: document.querySelector(".modal .mwia-guide-picked")?.textContent, status: document.querySelector(".modal .mwia-guide-status")?.textContent }));
    check("hour buttons fill in the fights", fights.value === "2400" && fights.buttons === 13 && fights.picked === "8" && fights.status === "2,400 fights ≈ 8 h.", JSON.stringify(fights));
    await page.evaluate(() => (window.cart = []));
    await page.click(".modal [data-guide-cart]");
    await new Promise((r) => setTimeout(r, 400));
    const hoursCart = await page.evaluate(() => window.cart);
    check("the cart follows the hours picked", hoursCart.length === 1 && hoursCart[0].itemHrid === "/items/attack_coffee" && hoursCart[0].quantity === 96, JSON.stringify(hoursCart));
    await page.screenshot({ path: path.join(shotDir, "skilling-6b-combat.png") });
    // Another tier than the one analysed: no fight counts.
    await page.evaluate(() => document.querySelector(".modal .SkillActionDetail_name__y").insertAdjacentHTML("afterend", '<div class="difficulty"><div role="button">T2</div></div>'));
    await page.waitForFunction(() => !document.querySelector(".modal [data-guide-hours]"), { timeout: 3000 }).catch(() => null);
    const otherTier = await page.$eval(".modal .mwia-guide-box", (n) => n.textContent.replace(/\s+/g, " "));
    check("another tier hides the hour buttons", /The advice is for T0\. Pick T2/.test(otherTier) && /What's missing for 1 day/.test(otherTier) && !(await page.$(".modal [data-guide-hours]")), otherTier);
    await page.evaluate(() => {
        document.querySelector(".modal")?.remove();
        openPanel(data.actionDetailMap["/actions/combat/aqua_planet"]);
    });
    await page.waitForSelector(".modal .mwia-guide-box", { timeout: 4000 }).catch(() => null);
    check("a zone without analysis says how to get advice", /No advice for Aqua Planet yet/.test(await page.$eval(".modal .mwia-guide-box", (n) => n.textContent).catch(() => "")));
    await page.evaluate(() => document.querySelector(".modal")?.remove());
    await page.click(".mwia-launcher");

    // Making the materials yourself: Linen Fabric from Flax you gather (Foraging 28).
    const linenFabric = expectRank(character, { skill: "tailoring" }).available.find((e) => e.hrid === "/actions/tailoring/linen_fabric");
    const flax = expectRank(character, { skill: "foraging" }).available.find((e) => e.hrid === "/actions/foraging/flax");
    const flaxOut = flax.outputs.find((o) => o.itemHrid === "/items/flax");
    const flaxHours = 1 / (flax.actionsPerHour * flaxOut.count);
    const flaxCost = (flax.teaPerHour / flax.actionsPerHour - (flax.revenuePerAction - flaxOut.value)) / flaxOut.count;
    const linenInput = linenFabric.inputs[0].count;
    const handHours = 1 / linenFabric.actionsPerHour + linenInput * flaxHours;
    const handGold = (linenFabric.revenuePerAction - linenInput * flaxCost - linenFabric.teaPerHour / linenFabric.actionsPerHour) / handHours;
    check("chain gold per hour matches a hand count", linenFabric.chain && Math.abs(linenFabric.chain.profitPerHour - handGold) < 1e-6 * Math.abs(handGold) && Math.abs(linenFabric.chain.craftShare + linenFabric.chain.shares.reduce((sum, sh) => sum + sh.share, 0) - 1) < 1e-9,
        `${linenFabric.chain?.profitPerHour} vs ${handGold}`);
    await page.$eval('.mwia-skill-row[data-hrid="/actions/tailoring/linen_fabric"]', (row) => { row.open = true; });
    const chainText = await page.$eval('.mwia-skill-row[data-hrid="/actions/tailoring/linen_fabric"] .mwia-skill-detail', (n) => [...n.querySelectorAll(".mwia-skill-sec")].find((d) => /Yourself/.test(d.textContent))?.textContent || "");
    check("chain shown in the row", chainText.includes(`${coinText(linenFabric.chain.profitPerHour)}/h`) && /Of each hour: \d+% Linen Fabric · \d+% Flax/.test(chainText), chainText.slice(0, 160));

    // 🚂 Train: the chain pays more here, so a train makes Linen Fabric from Flax you gather.
    const trainPlan = linenFabric.chainSuggestion;
    check("chain train planned for the hours", linenFabric.chain.profitPerHour >= linenFabric.profitPerHour && trainPlan?.count > 0 && trainPlan.hours <= 8 + 1e-9 && chainText.includes(`Train ${trainPlan.count.toLocaleString("en-US")}`), JSON.stringify(trainPlan) + " " + chainText.slice(-300));
    await page.click('.mwia-skill-row[data-hrid="/actions/tailoring/linen_fabric"] [data-action="skilling-train"]');
    await page.waitForSelector(".mwia-train:not(.mwia-hidden) .mwia-train-now", { timeout: 5000 }).catch(() => null);
    const trainText = await page.$eval(".mwia-train", (n) => n.textContent.replace(/\s+/g, " ")).catch(() => "");
    check("train button starts a train that gathers Flax, then makes Linen Fabric", /Linen Fabric ×/.test(trainText) && /Flax/.test(trainText) && trainText.indexOf("Flax") < trainText.lastIndexOf("Linen Fabric"), trainText.slice(0, 400));
    await page.screenshot({ path: path.join(shotDir, "skilling-7-train.png") });
    await page.evaluate(() => { document.querySelector(".modal")?.remove(); document.querySelector(".mwia-train").classList.add("mwia-hidden"); });
    if (await page.$eval(".mwia-panel", (n) => n.classList.contains("mwia-hidden"))) await page.click(".mwia-launcher");

    // XP focus: the list ranks by XP, and the best teas follow.
    await page.$eval('[data-setting="skillingGold"]', (input) => { input.value = "0"; input.dispatchEvent(new Event("change", { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 100));
    const xpRows = await rows(page);
    const expXp = expectRank(character, { skill: "tailoring", goldWeight: 0 }).available;
    // XP within the coins: a job they keep short counts for its share of the hours.
    const byXp = [...expXp].filter((e) => e.valid).sort((a, b) => b.xpPerDay * (b.suggestion?.fill ?? 1) - a.xpPerDay * (a.suggestion?.fill ?? 1))[0];
    check("XP focus ranks by XP", xpRows[0]?.name === expXp[0].action.name && expXp[0].hrid === byXp.hrid && /XP only/.test(await page.$eval(".mwia-focus-text", (n) => n.textContent)), `${xpRows[0]?.name} vs ${byXp.action.name}`);
    const foragingXp = expectRank(character, { skill: "foraging", goldWeight: 0 }).available[0];
    check("XP focus picks XP teas", foragingXp.best.result.teas.includes("/items/wisdom_tea"), foragingXp.best.result.teas.join(","));
    await page.$eval('[data-setting="skillingGold"]', (input) => { input.value = "100"; input.dispatchEvent(new Event("change", { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 100));

    // Buy the best teas for the job: a gathering job runs for the hours planned (8 h away).
    await select(page, "skillingSkill", "foraging");
    const forTeas = expectRank(character, { skill: "foraging" }).available[0];
    await page.$eval(`.mwia-skill-row[data-hrid="${forTeas.hrid}"]`, (row) => { row.open = true; });
    await page.click(`.mwia-skill-row[data-hrid="${forTeas.hrid}"] [data-action="skilling-cart"]`);
    await new Promise((r) => setTimeout(r, 300));
    const cart = await page.evaluate(() => window.cart || []);
    const perTea = Math.ceil(PLAN_MODES.away.hours * forTeas.best.result.drinksPerHour);
    check("buy teas puts a day of the best teas in the cart", forTeas.best.result.teas.length > 0 && forTeas.best.result.teas.every((hrid) => cart.some((c) => c.itemHrid === hrid && c.quantity === perTea)),
        `${JSON.stringify(cart)} vs ${forTeas.best.result.teas.join(",")} × ${perTea}`);
    check("cart result is shown", /Shopping cart: added/.test(await page.$eval(".mwia-body", (n) => n.textContent)));

    // Upgrades that pay back, for one skill.
    await select(page, "skillingSkill", "tailoring");
    const equippedNow = {};
    for (const i of character.characterItems) if (i.itemLocationHrid !== "/item_locations/inventory") equippedNow[i.itemLocationHrid] = { itemHrid: i.itemHrid, enhancementLevel: i.enhancementLevel || 0 };
    const ownedNow = {};
    for (const i of character.characterItems) if (i.itemLocationHrid === "/item_locations/inventory") (ownedNow[i.itemHrid] ||= []).push(i.enhancementLevel || 0);
    // Measured on the top of the Skilling list: what you'd make.
    const topOf = (skill, c = character) => expectRank(c, { skill }).available.find((e) => e.valid && e.goldPerDay > 0)?.hrid || null;
    const listingsOf = (hrid) => Object.entries(marketData[hrid] || {}).filter(([, e]) => e.a > 0).map(([level, e]) => ({ enhancementLevel: Number(level), price: e.a, bid: e.b > 0 ? e.b : null })).sort((a, b) => a.price - b.price);
    const bidsOf = (hrid) => Object.entries(marketData[hrid] || {}).filter(([, e]) => e.b > 0).map(([level, e]) => ({ enhancementLevel: Number(level), bid: e.b }));
    const expUpgrades = rankUpgrades(skillingCharacter(character, items(character), clientData), clientData, market("ask"), "tailoring", {
        equipped: equippedNow, owned: ownedNow, houseLevels: {}, gameEquipmentBuffs: character.equipmentActionTypeBuffsMap, listings: listingsOf, bids: bidsOf, actionHrid: topOf("tailoring"),
    });
    const upgradeIntro = await page.$eval(".mwia-upgrade-list", (n) => n.closest("section")?.querySelector("p")?.textContent || "").catch(() => "");
    check("upgrades measured on the top of the list", expUpgrades.base.action.hrid === topOf("tailoring") && upgradeIntro.includes(`the top of the list above (now ${expUpgrades.base.action.name}`), upgradeIntro);
    const sold = expUpgrades.upgrades.find((u) => u.kind === "item" && !u.owned && u.resale > 0);
    check("payback counts selling it again at the bid", sold && Math.abs(sold.paybackDays - (sold.price - sold.resale) / sold.gainPerDay) < 1e-9 && sold.cost < sold.price, JSON.stringify(sold && { p: sold.price, r: sold.resale, d: sold.paybackDays }));
    const upgradeRows = await page.$$eval(".mwia-upgrade", (list) => list.map((n) => n.textContent.replace(/\s+/g, " ").trim()));
    const firstUpgrade = expUpgrades.upgrades[0];
    check("upgrades listed by payback", upgradeRows.length > 0 && upgradeRows[0].startsWith(clientData.itemDetailMap[firstUpgrade.itemHrid]?.name || firstUpgrade.name) && upgradeRows[0].includes(`+${coinText(firstUpgrade.gainPerDay)}/day`),
        `${upgradeRows[0]} vs ${firstUpgrade.itemHrid || firstUpgrade.name} +${coinText(firstUpgrade.gainPerDay)}`);
    check("house room among the upgrades", expUpgrades.upgrades.some((u) => u.kind === "house" && u.name === "Sewing Parlor") && upgradeRows.some((t) => /Sewing Parlor → level 1/.test(t)));
    // Tea slots come from the pouch; a bigger one is an upgrade when the extra tea pays.
    const whoNow = skillingCharacter(character, items(character), clientData);
    check("tea slots follow the pouch", whoNow.slots[FORAGING] === 2 && whoNow.slots["/action_types/tailoring"] === 2, JSON.stringify(whoNow.slots));
    const tailoringUpgrades = rankUpgrades(whoNow, clientData, market("ask"), "tailoring", {
        equipped: equippedNow, owned: ownedNow, houseLevels: {}, listings: listingsOf, bids: bidsOf, actionHrid: topOf("tailoring"),
    });
    const giant = tailoringUpgrades.upgrades.find((u) => u.itemHrid === "/items/giant_pouch");
    const tailoringRows = await page.$$eval(".mwia-upgrade", (list) => list.map((n) => n.textContent.replace(/\s+/g, " ").trim()));
    check("a pouch with another tea slot is an upgrade", giant && giant.extraSlots === 1 && giant.teas.length === 3 && tailoringRows.some((t) => t.startsWith("Giant Pouch") && /\+1 tea slot \(with /.test(t)), JSON.stringify(giant && { gain: giant.gainPerDay, teas: giant.teas }) + " " + tailoringRows.find((t) => /Pouch/.test(t)));
    await page.click(".mwia-upgrade [data-action=\"skilling-cart\"]");
    await new Promise((r) => setTimeout(r, 300));
    check("upgrade goes to the cart", (await page.evaluate(() => window.cart || [])).some((c) => c.itemHrid === firstUpgrade.itemHrid && c.quantity === 1));
    await select(page, "skillingSkill", "foraging");
    check("gear speed mismatch with the game is pointed out", /action speed here is \+15\.0% by the game but \+0\.0%/.test(await page.$eval(".mwia-body", (n) => n.textContent)));
    await page.screenshot({ path: path.join(shotDir, "skilling-7-upgrades.png") });

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
    // The game's Equipment page: a notice under the slots for tools a skill level now allows.
    await page.evaluate(() => {
        document.querySelector(".mwia-panel").classList.add("mwia-hidden");
        const icons = Array.from({ length: 12 }, (_, i) => '<div class="slot"><svg><use href="/sprites/items.svg#x' + i + '"></use></svg></div>').join("");
        document.body.insertAdjacentHTML("beforeend", '<div id="equipment" style="display:grid;grid-template-columns:repeat(5,60px)"><div class="head"><button>View Stats</button></div>' + icons + '</div>');
    });
    await page.waitForSelector("#equipment > .mwia-tool-box", { timeout: 6000 }).catch(() => null);
    const equippedTools = {};
    const ownedTools = {};
    for (const i of character.characterItems) {
        if (i.itemLocationHrid === "/item_locations/inventory") (ownedTools[i.itemHrid] ||= []).push(i.enhancementLevel || 0);
        else equippedTools[i.itemLocationHrid] = { itemHrid: i.itemHrid, enhancementLevel: i.enhancementLevel || 0 };
    }
    const expTools = toolTiers(skillingCharacter(character, items(character), clientData), clientData, market("ask"), { equipped: equippedTools, owned: ownedTools, actionFor: (skill) => topOf(skill) });
    const toolRows = await page.$$eval("#equipment .mwia-tool-list li", (list) => list.map((li) => li.textContent.replace(/\s+/g, " ").trim()));
    const needle = expTools.find((n) => n.itemHrid === "/items/azure_needle");
    check("equipment page lists tools a level now allows", toolRows.length === expTools.length && toolRows.some((r) => r.startsWith("Tailoring lvl 20: Cheese Needle → Azure Needle (lvl 20) · " + coinText(needle.price)))
        && toolRows.some((r) => /^Foraging lvl 28: Azure Shears \(lvl 20\) · in your inventory – equip it/.test(r)) && !expTools.some((n) => n.type === "/equipment_types/tailoring_tool" && n.itemHrid !== "/items/azure_needle"),
        toolRows.join(" | "));
    check("a tool's gain is worked out on the skill", needle.gainPerDay > 0 && toolRows.some((r) => r.includes(`+${coinText(needle.gainPerDay)}/day, pays back in`)), String(needle.gainPerDay));
    await page.evaluate(() => (window.cart = []));
    await page.evaluate(() => [...document.querySelectorAll("#equipment .mwia-tool-list li")].find((li) => /Azure Needle/.test(li.textContent)).querySelector("button").click());
    await page.waitForFunction(() => /Cart: added Azure Needle/.test(document.querySelector(".mwia-tool-box")?.textContent || ""), { timeout: 3000 }).catch(() => null);
    check("a tool goes to the cart", JSON.stringify(await page.evaluate(() => window.cart)) === JSON.stringify([{ itemHrid: "/items/azure_needle", enhancementLevel: 0, quantity: 1, source: "manual" }]));
    await page.$eval("#equipment", (n) => n.scrollIntoView()).catch(() => null);
    await page.screenshot({ path: path.join(shotDir, "skilling-9-tools.png") });
    await page.evaluate(() => document.getElementById("equipment").remove());
    await new Promise((r) => setTimeout(r, 600));
    check("the tool notice goes with the page", !(await page.$(".mwia-tool-box")));
    // Listing windows: price buttons from the order book (no price history in the test browser).
    const fabricBook = { type: "market_item_order_books_updated", marketItemOrderBooks: { itemHrid: "/items/cotton_fabric", orderBooks: [{
        asks: [{ price: 1096, quantity: 9552 }, { price: 1100, quantity: 6082 }, { price: 1120, quantity: 22886 }, { price: 1140, quantity: 90000 }, { price: 1300, quantity: 25 }],
        bids: [{ price: 1040, quantity: 500 }, { price: 1000, quantity: 10000 }, { price: 800, quantity: 10000 }],
    }] } };
    for (const socket of sockets) socket.send(JSON.stringify(fabricBook));
    await page.waitForFunction(() => window.lastType === "market_item_order_books_updated");
    // opts: level (the Enhancement Level box), min/max (the price buttons' ends), rangeText (shown in the window or not).
    const openListing = (side, best, price, opts = {}) => page.evaluate((side, best, price, { level = 0, min: low = 984, max: high = 1205, rangeText = true }) => {
        document.querySelector(".listing-modal")?.remove();
        // The game's −/+ move between valid prices: steps of 4 here.
        // Like the game's: a modal container with a close icon first, an Enhancement Level box, coin icons.
        document.body.insertAdjacentHTML("beforeend", `<div class="listing-modal Modal_modalContainer__3B80m"><div class="Modal_modal__x"><div class="MarketplacePanel_header__yahJo">${side} Listing</div>
            <button class="close"><svg><use href="/sprites/misc.svg#close_menu"></use></svg></button>
            <div class="icon"><svg><use href="/sprites/items.svg#cotton_fabric"></use></svg><span>1</span></div>
            <div>Enhancement Level</div><div><input class="enh" type="text" value="${level}"></div>${rangeText ? "<div>Tradable range: 984 – 1 205</div>" : ""}
            <div>Price (Best ${side} Offer: <span class="MarketplacePanel_bestPrice__x">${best} <svg><use href="/sprites/items.svg#coin"></use></svg></span>)</div>
            <div class="MarketplacePanel_inputContainer__x"><div class="MarketplacePanel_priceInputs__x"><button>Min</button><button>-</button><div class="field">${price}</div><button>+</button><button>Max</button></div></div>
            <button>Post ${side} Listing</button></div></div>`);
        const box = document.querySelector(".listing-modal");
        // As in the game, the price is text that only the buttons change.
        const input = box.querySelector(".MarketplacePanel_priceInputs__x .field");
        const [min, minus, plus, max] = box.querySelectorAll(".MarketplacePanel_priceInputs__x button");
        const value = () => Number(input.firstChild.nodeValue.replace(/\s/g, ""));
        const set = (v) => { input.firstChild.nodeValue = String(Math.min(high, Math.max(low, v))).replace(/\B(?=(\d{3})+(?!\d))/g, " "); };
        minus.onclick = () => set(Math.ceil(value() / 4) * 4 - 4);
        plus.onclick = () => set(Math.floor(value() / 4) * 4 + 4);
        min.onclick = () => set(low);
        max.onclick = () => set(high);
    }, side, best, price, opts);
    const listingBox = () => page.evaluate(() => ({ buttons: [...document.querySelectorAll(".listing-modal .mwia-listprice button")].map((b) => `${b.querySelector("b").textContent} ${b.querySelector("small").textContent}`), info: document.querySelector(".listing-modal .mwia-listprice-info")?.textContent || "", price: document.querySelector(".listing-modal .MarketplacePanel_priceInputs__x .field").textContent.replace(/\s/g, "") }));
    await openListing("Sell", "1 096", "1 092");
    await page.waitForSelector(".listing-modal .mwia-listprice button", { timeout: 4000 }).catch(() => null);
    const sellBox = await listingBox();
    check("sell listing shows match and wall", JSON.stringify(sellBox.buttons) === JSON.stringify(["Match 1,096", "Wall < 1,140"]) && /^0 listed cheaper · usual price after 12 h/.test(sellBox.info), JSON.stringify(sellBox));
    await page.click('.listing-modal [data-listprice="1"]');
    await page.waitForFunction(() => /^38,520 listed cheaper/.test(document.querySelector(".listing-modal .mwia-listprice-info")?.textContent || ""), { timeout: 3000 }).catch(() => null);
    const walled = await listingBox();
    check("wall: one step under the wall", walled.price === "1136" && /^38,520 listed cheaper/.test(walled.info), JSON.stringify(walled));
    await page.screenshot({ path: path.join(shotDir, "skilling-10-listing.png") });
    await page.click('.listing-modal [data-listprice="0"]');
    await page.waitForFunction(() => /^0 listed cheaper, 9,552 at 1,096/.test(document.querySelector(".listing-modal .mwia-listprice-info")?.textContent || ""), { timeout: 4000 }).catch(() => null);
    const matched = await listingBox();
    check("match: steps down to the best offer", matched.price === "1096" && /^0 listed cheaper, 9,552 at 1,096/.test(matched.info), JSON.stringify(matched));
    // A +level: last seen before the books were kept per level, so it asks for the market.
    await page.evaluate(() => { const enh = document.querySelector(".listing-modal input.enh"); enh.value = "3"; enh.dispatchEvent(new Event("input", { bubbles: true })); });
    await page.waitForFunction(() => /open Cotton Fabric \+3 on the market/.test(document.querySelector(".listing-modal .mwia-listprice")?.textContent || ""), { timeout: 3000 }).catch(() => null);
    check("a +level without its order book asks for the market", /open Cotton Fabric \+3 on the market/.test(await page.$eval(".listing-modal .mwia-listprice", (n) => n.textContent)));
    // The game's book per +level, with each level's tradable range (here not shown in the window).
    const levelBook = { type: "market_item_order_books_updated", marketItemOrderBooks: { itemHrid: "/items/cotton_fabric", orderBooks: [
        fabricBook.marketItemOrderBooks.orderBooks[0], { asks: [], bids: [] }, { asks: [], bids: [] },
        { asks: [{ price: 5000, quantity: 1 }, { price: 5100, quantity: 1 }, { price: 5200, quantity: 10 }, { price: 9000, quantity: 50 }], bids: [{ price: 3000, quantity: 2 }] },
    ], priceBandMins: { 0: 984, 3: 4000 }, priceBandMaxs: { 0: 1205, 3: 8000 } } };
    for (const socket of sockets) socket.send(JSON.stringify(levelBook));
    await page.waitForFunction(() => window.lastType === "market_item_order_books_updated");
    await openListing("Sell", "5 000", "5 000", { level: 3, min: 4000, max: 8000, rangeText: false });
    await page.waitForFunction(() => document.querySelectorAll(".listing-modal .mwia-listprice button").length === 2, { timeout: 4000 }).catch(() => null);
    const plusBox = await listingBox();
    // 9,000 lies outside +3's range, so the wall is 5,200 (10 of the 12 in range).
    check("a +level gets its own book and the game's range", JSON.stringify(plusBox.buttons) === JSON.stringify(["Match 5,000", "Wall < 5,200"]) && /^0 listed cheaper, 1 at 5,000/.test(plusBox.info), JSON.stringify(plusBox));
    await page.click('.listing-modal [data-listprice="1"]');
    await page.waitForFunction(() => document.querySelector(".listing-modal .MarketplacePanel_priceInputs__x .field").textContent.replace(/\s/g, "") === "5196", { timeout: 4000 }).catch(() => null);
    check("+level wall: one step under it", (await listingBox()).price === "5196", JSON.stringify(await listingBox()));
    // The window shows another best price than the book: say the book is old.
    await openListing("Sell", "4 800", "4 800", { level: 3, min: 4000, max: 8000, rangeText: false });
    await page.waitForFunction(() => /isn't the window's/.test(document.querySelector(".listing-modal .mwia-listprice-info")?.textContent || ""), { timeout: 4000 }).catch(() => null);
    check("a book that doesn't match the window says so", /order book's best \(5,000\) isn't the window's/.test((await listingBox()).info), (await listingBox()).info);
    await openListing("Buy", "1 040", "1 044");
    await page.waitForFunction(() => document.querySelectorAll(".listing-modal .mwia-listprice button").length === 2, { timeout: 4000 }).catch(() => null);
    await page.click('.listing-modal [data-listprice="1"]');
    await page.waitForFunction(() => /^500 bid higher/.test(document.querySelector(".listing-modal .mwia-listprice-info")?.textContent || ""), { timeout: 3000 }).catch(() => null);
    const buyBox = await listingBox();
    check("buy listing: one step over the bid wall", JSON.stringify(buyBox.buttons) === JSON.stringify(["Match 1,040", "Wall > 1,000"]) && buyBox.price === "1004" && /^500 bid higher/.test(buyBox.info), JSON.stringify(buyBox));
    await page.evaluate(() => document.querySelector(".listing-modal").remove());
    // A listing window laid out differently: found by its Post button, and says what it couldn't read.
    await page.evaluate(() => document.body.insertAdjacentHTML("beforeend", '<div class="odd-modal"><div>Sell Listing</div><div><input value="1 000"></div><button>Post Sell Listing</button></div>'));
    await page.waitForSelector(".odd-modal .mwia-listprice", { timeout: 4000 }).catch(() => null);
    check("an unreadable listing window says why", /can't read this window: no price box found/.test(await page.$eval(".odd-modal .mwia-listprice", (n) => n.textContent).catch(() => "")));
    await page.evaluate(() => document.querySelector(".odd-modal").remove());

    // Tea slots on a skill page: the first Tailoring job in the queue decides which teas are right.
    const TAILORING = "/action_types/tailoring";
    const teaSlotsMap = { ...character.actionTypeDrinkSlotsMap, [FORAGING]: character.actionTypeDrinkSlotsMap[FORAGING], [TAILORING]: [{ itemHrid: "/items/wisdom_tea" }, null] };
    for (const socket of sockets) socket.send(JSON.stringify({ type: "action_type_consumable_slots_updated", actionTypeDrinkSlotsMap: teaSlotsMap }));
    await page.waitForFunction(() => window.lastType === "action_type_consumable_slots_updated");
    const foragingJob = Object.values(clientData.actionDetailMap).find((a) => a.type === FORAGING).hrid;
    const queue = [{ id: 901, actionHrid: foragingJob, ordinal: 1 }, { id: 902, actionHrid: topTailoring.hrid, ordinal: 2 }];
    for (const socket of sockets) socket.send(JSON.stringify({ type: "actions_updated", endCharacterActions: queue }));
    await page.waitForFunction(() => window.lastType === "actions_updated");
    const teaEntry = expectRank({ ...character, actionTypeDrinkSlotsMap: teaSlotsMap }, { skill: "tailoring" }).available.find((e) => e.hrid === topTailoring.hrid);
    const rightTeas = teaEntry.betterTeas ? teaEntry.best.result.teas : teaEntry.current.teas;
    const icon = (hrid) => `<svg><use href="/sprites/items.svg#${hrid.split("/").pop()}"></use></svg>`;
    await page.evaluate((wisdom) => {
        document.querySelector(".mwia-panel").classList.add("mwia-hidden");
        document.body.insertAdjacentHTML("beforeend", `<div id="teapage"><div class="title"><span>Tailoring</span> <span>?</span></div><div style="height:300px"></div>
            <div class="consumables"><div class="label">Consumables</div><div class="row" style="display:flex;gap:4px">
            <div class="slot" style="width:60px;height:60px">${wisdom}<span>52</span></div><div class="slot" style="width:60px;height:60px"></div><div class="slot" style="width:60px;height:60px">Require Bigger Pouch</div></div></div></div>`);
    }, icon("/items/wisdom_tea"));
    await new Promise((r) => setTimeout(r, 800));
    const slotMarks = () => page.$$eval("#teapage .slot", (list) => list.map((n) => n.dataset.mwiaTea || ""));
    const marks = await slotMarks();
    const wisdomRight = rightTeas.includes("/items/wisdom_tea");
    const missingTeas = rightTeas.filter((hrid) => hrid !== "/items/wisdom_tea");
    check("a slot with the wrong tea glows red, an empty one when a tea is missing", marks[0] === (wisdomRight ? "" : "wrong") && marks[1] === (missingTeas.length ? "wrong" : "") && marks[2] === "",
        `${JSON.stringify(marks)} for ${rightTeas.join(",")}`);
    // The game's tea picker: the right teas glow green; ones you don't have get a cart line.
    const pickerTeas = usableTeas(clientData, TAILORING);
    await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html),
        `<div class="ItemSelector_menu__12sEM" id="picker"><div class="ItemSelector_itemList__Qa5lq"><div class="ItemSelector_itemContainer__3olqe"><div>Remove</div></div>${pickerTeas.map((hrid) => `<div class="ItemSelector_itemContainer__3olqe" data-hrid="${hrid}">${icon(hrid)}<span>9</span></div>`).join("")}</div></div>`);
    await new Promise((r) => setTimeout(r, 800));
    const green = await page.$$eval("#picker [data-mwia-tea=right]", (list) => list.map((n) => n.dataset.hrid || "remove"));
    check("the right teas glow green in the picker", JSON.stringify(green.sort()) === JSON.stringify([...missingTeas].sort()) && missingTeas.length > 0, `${green} vs ${missingTeas}`);
    const haveTea = (hrid) => heldStock(character, items(character), hrid).inventory;
    const lacking = rightTeas.filter((hrid) => haveTea(hrid) <= 0);
    const teaNote = await page.$eval("#picker .mwia-tea-note", (n) => n.textContent.replace(/\s+/g, " ")).catch(() => "");
    check("missing teas are named in the picker", lacking.length > 0 && teaNote.includes(`Missing for ${topTailoring.action.name}`) && lacking.every((hrid) => teaNote.includes(clientData.itemDetailMap[hrid].name)), teaNote);
    await page.screenshot({ path: path.join(shotDir, "skilling-11-teas.png") });
    await page.evaluate(() => (window.cart = []));
    await page.click("#picker [data-tea-cart]");
    await page.waitForFunction(() => /Cart: added/.test(document.querySelector("#picker .mwia-tea-note")?.textContent || ""), { timeout: 3000 }).catch(() => null);
    const perTea8 = Math.ceil(8 * teaEntry.current.drinksPerHour);
    const teaCart = await page.evaluate(() => window.cart);
    check("8 hours of the right teas go to the cart", rightTeas.every((hrid) => haveTea(hrid) >= perTea8 || teaCart.some((c) => c.itemHrid === hrid && c.quantity === perTea8 - haveTea(hrid))) && teaCart.length === rightTeas.filter((hrid) => haveTea(hrid) < perTea8).length,
        `${JSON.stringify(teaCart)} × ${perTea8}`);
    await page.evaluate(() => document.getElementById("picker").remove());
    // Another layout of the picker: found by its "Remove" choice.
    await page.evaluate((html) => document.body.insertAdjacentHTML("beforeend", html),
        `<div id="picker2"><div class="list"><div class="item"><div>Remove</div></div>${pickerTeas.map((hrid) => `<div class="item" data-hrid="${hrid}">${icon(hrid)}</div>`).join("")}</div></div>`);
    await new Promise((r) => setTimeout(r, 800));
    const green2 = await page.$$eval("#picker2 [data-mwia-tea=right]", (list) => list.map((n) => n.dataset.hrid || "remove"));
    check("a picker without the game's classes is found too", JSON.stringify(green2.sort()) === JSON.stringify([...missingTeas].sort()), `${green2}`);
    await page.evaluate(() => document.getElementById("picker2").remove());
    // Nothing queued for the skill: no marks.
    for (const socket of sockets) socket.send(JSON.stringify({ type: "actions_updated", endCharacterActions: [{ ...queue[1], isDone: true }] }));
    await page.waitForFunction(() => !document.querySelector("#teapage [data-mwia-tea]"), { timeout: 3000 }).catch(() => null);
    check("no Tailoring job in the queue, no marks", !(await page.$("#teapage [data-mwia-tea]")));
    // A Consumables row the script can't read says so.
    await page.evaluate(() => { document.querySelector("#teapage .row").remove(); });
    await page.waitForSelector("#teapage .mwia-tea-note", { timeout: 3000 }).catch(() => null);
    check("an unreadable tea row says why", /can't mark the teas – no tea slots/.test(await page.$eval("#teapage .mwia-tea-note", (n) => n.textContent).catch(() => "")));
    await page.evaluate(() => document.getElementById("teapage").remove());

    // Enhancing: one row per item at the target that suits the focus, worked out like the Node calculation.
    await page.click(".mwia-launcher");
    await page.waitForSelector('[data-tab="skilling"]');
    await page.click('[data-tab="skilling"]');
    await select(page, "skillingSkill", "enhancing");
    const settingsNow = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-setting]")].map((n) => [n.dataset.setting, n.value])));
    const leveling = (skill) => expectRank(character, { skill, teaMode: settingsNow.skillingTeas, sellAt: settingsNow.skillingSellAt, mode: settingsNow.skillingMode, goldWeight: Number(settingsNow.skillingGold) / 100 });
    const enhancing = await rows(page);
    const expEnh = leveling("enhancing").available;
    check("Enhancing lists items with a target", enhancing.length > 0 && expEnh.slice(0, 3).every((e, i) => enhancing[i]?.name === e.action.name && enhancing[i].gold === `${coinText(e.goldPerDay)}/day` && enhancing[i].xp === `${coinText(e.xpPerDay)} XP/day`),
        JSON.stringify(enhancing.slice(0, 2)) + " vs " + expEnh.slice(0, 2).map((e) => `${e.action.name} +${e.target} ${coinText(e.goldPerDay)} ${coinText(e.xpPerDay)}`).join(", "));
    check("Enhancing rows show coins per XP", /item level \d+ · [\d.,]+ coins\/XP/.test(enhancing[0]?.sub || ""), enhancing[0]?.sub);
    check("an enhanced item no one buys is valued at a lower +level's bid", /valued at the \+0 bid/.test(enhancing[0]?.warn || ""), enhancing[0]?.warn);
    await page.click(".mwia-skill-row summary");
    const enhDetail = await page.$eval(".mwia-skill-row[open] .mwia-skill-detail", (n) => n.textContent);
    check("Enhancing detail: odds, attempts, every target", /attempts per \+\d+/.test(enhDetail) && /A failure drops the item to \+0/.test(enhDetail) && /\+1: [\d.,]+ attempts/.test(enhDetail) && /suits your Focus/.test(enhDetail), enhDetail.slice(0, 300));
    await page.screenshot({ path: path.join(shotDir, "skilling-12-enhancing.png") });
    // XP only: a higher target and more XP a day than all gold.
    await page.evaluate(() => { const r = document.querySelector('[data-setting="skillingGold"]'); r.value = "0"; r.dispatchEvent(new Event("change", { bubbles: true })); });
    await new Promise((r) => setTimeout(r, 300));
    const xpOnly = await rows(page);
    const expEnhXp = expectRank(character, { skill: "enhancing", teaMode: settingsNow.skillingTeas, sellAt: settingsNow.skillingSellAt, goldWeight: 0 }).available[0];
    check("XP focus picks more XP at a higher cost", xpOnly[0]?.name === expEnhXp.action.name && expEnhXp.xpPerDay >= expEnh[0].xpPerDay && expEnhXp.goldPerDay <= expEnh[0].goldPerDay, `${xpOnly[0]?.name} vs ${expEnhXp.action.name}`);
    await page.evaluate((v) => { const r = document.querySelector('[data-setting="skillingGold"]'); r.value = v; r.dispatchEvent(new Event("change", { bubbles: true })); }, settingsNow.skillingGold);
    await new Promise((r) => setTimeout(r, 300));
    // ▶ Enhance puts the item (from the inventory) in the game's slot and sets the target.
    const enhRow = expEnh.find((e) => e.action.itemHrid === topEnhance.action.itemHrid);
    await page.evaluate((hrid) => [...document.querySelectorAll(".mwia-skill-row")].find((r) => r.dataset.hrid === hrid).open = true, enhRow.hrid);
    await page.evaluate((hrid) => [...document.querySelectorAll(".mwia-skill-row")].find((r) => r.dataset.hrid === hrid).querySelector('[data-action="skilling-level"]').click(), enhRow.hrid);
    await page.waitForFunction(() => window.enhanceTarget !== undefined, { timeout: 5000 }).catch(() => null);
    const enhCall = await page.evaluate(() => ({ hash: window.enhanceCall, target: window.enhanceTarget }));
    check("▶ Enhance opens the item with the target", enhCall.hash === `1::/item_locations/inventory::${topEnhance.action.itemHrid}::0` && enhCall.target === String(enhRow.target), JSON.stringify(enhCall));

    // Alchemy: coinify, decompose and transmute, with the odds.
    await page.click(".mwia-launcher");
    await page.waitForSelector(".mwia-skill-row");
    await select(page, "skillingSkill", "alchemy");
    const alchemy = await rows(page);
    const expAlc = leveling("alchemy").available;
    check("Alchemy lists item actions", alchemy.length > 0 && expAlc.slice(0, 3).every((e, i) => alchemy[i]?.name === e.action.name && alchemy[i].gold === `${coinText(e.goldPerDay)}/day`),
        JSON.stringify(alchemy.slice(0, 2)) + " vs " + expAlc.slice(0, 2).map((e) => `${e.action.name} ${coinText(e.goldPerDay)}`).join(", "));
    check("Alchemy rows show the success rate", /% success/.test(alchemy[0]?.sub || ""), alchemy[0]?.sub);
    const above = expAlc.find((e) => e.requiredLevel > e.effectiveLevel);
    check("an item above your level has lower odds", !above || above.successRate < above.baseRate * (1 + above.catalyst.bonus + above.successBuff) - 1e-9, above ? `${above.action.name} ${above.successRate}` : "none");
    // ▶ Coinify with an item you have (Donut): the tab, the item and the count.
    const clickLevel = async (hrid) => {
        await page.evaluate(() => { for (const k of ["alchemyCall", "alchemyItem", "alchemyCount"]) window[k] = undefined; document.querySelector(".mwia-notice")?.remove(); });
        if (await page.$eval(".mwia-panel", (n) => n.classList.contains("mwia-hidden")).catch(() => false)) await page.click(".mwia-launcher");
        await page.evaluate((h) => { const r = [...document.querySelectorAll(".mwia-skill-row")].find((x) => x.dataset.hrid === h); r.open = true; r.querySelector('[data-action="skilling-level"]').click(); }, hrid);
    };
    const lvlState = () => page.evaluate(() => ({ call: window.alchemyCall, tab: document.querySelector('.lvl [aria-selected="true"]')?.textContent, item: window.alchemyItem, count: window.alchemyCount, notice: document.querySelector(".mwia-notice")?.textContent }));
    const donut = expAlc.find((e) => e.action.hrid === "/actions/alchemy/coinify#/items/donut");
    await page.click('[data-action="skilling-all"]');
    await new Promise((r) => setTimeout(r, 200));
    check("an item you have is always listed", !!donut && (await rows(page)).some((r) => r.name === donut.action.name), donut?.action.name);
    if (donut) {
        await clickLevel(donut.hrid);
        await page.waitForFunction(() => window.alchemyCount !== undefined, { timeout: 5000 }).catch(() => null);
        const st = await lvlState();
        check("▶ Coinify opens the item you have on the Coinify tab with the count", st.call === "1::/item_locations/inventory::/items/donut::0" && st.tab === "Coinify" && st.count === String(donut.suggestion?.count ?? 0), JSON.stringify(st));
    }
    // ▶ Transmute: the tab changes (which empties the slot), and the item is put back.
    const trans = expAlc.find((e) => e.action.hrid === "/actions/alchemy/transmute#/items/donut");
    if (trans) {
        await clickLevel(trans.hrid);
        await page.waitForFunction(() => window.alchemyItem !== undefined, { timeout: 5000 }).catch(() => null);
        const st = await lvlState();
        check("▶ Transmute switches the tab and puts the item back", st.tab === "Transmute" && st.item === "1::/item_locations/inventory::/items/donut::0", JSON.stringify(st));
    }
    // Without the item: the page opens and it says to buy it first.
    const notOwned = expAlc.find((e) => heldStock(character, items(character), e.action.itemHrid).inventory === 0);
    await clickLevel(notOwned.hrid);
    await page.waitForFunction(() => /buy it first/.test(document.querySelector(".mwia-notice")?.textContent || ""), { timeout: 8000 }).catch(() => null);
    check("▶ without the item opens the page and says to buy it first", /buy it first/.test((await lvlState()).notice || ""), JSON.stringify(await lvlState()));
    await page.evaluate(() => document.querySelector(".lvl")?.remove());

    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
