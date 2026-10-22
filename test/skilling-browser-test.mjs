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
import { NEAR_LEVELS, marketPricer, perDay, rankSkilling, skillingCharacter } from "../src/skilling.js";
import { shortCoins } from "../src/format.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir = "/tmp"] = process.argv.slice(2);
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
// The real client ships the XP table; the simulator's data does not.
clientData.levelExperienceTable = Array.from({ length: 201 }, (_, level) => 50 * level * level);
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

const items = (c) => new Map(c.characterItems.map((i) => [i.hash, i]));
const market = (sellAt) => marketPricer((hrid) => marketData[hrid]?.[0], clientData, sellAt);
const expectRank = (c, options) => rankSkilling(skillingCharacter(c, items(c), clientData), clientData, market(options.sellAt || "ask"), options);
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
    check("top rows match the calculation", expected.available.slice(0, 5).every((e, i) => shown[i]?.name === e.action.name && shown[i].gold === `${coinText(perDay(e.profitPerHour))}/day`),
        JSON.stringify(shown.slice(0, 3)) + " vs " + expected.available.slice(0, 3).map((e) => `${e.action.name} ${coinText(perDay(e.profitPerHour))}`).join(", "));
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
    check("foraging numbers match (speed, efficiency, wisdom tea)", foraging[0].name === top.action.name && foraging[0].gold === `${coinText(perDay(top.profitPerHour))}/day` && foraging[0].xp === `${coinText(perDay(top.xpPerHour))} XP/day`,
        `${JSON.stringify(foraging[0])} vs ${top.action.name} ${coinText(perDay(top.profitPerHour))} ${coinText(perDay(top.xpPerHour))}`);
    check("speed and efficiency buffs counted", Math.abs(top.speed - 0.15) < 1e-9 && Math.abs(top.efficiency - top.levelEfficiency - 0.03) < 1e-9 && Math.abs(top.xpPerAction - top.action.experienceGain.value * 1.12) < 1e-9,
        `speed ${top.speed} eff ${top.efficiency} xp ${top.xpPerAction}`);
    check("tea suggestion hint", !top.betterTeas || /with other teas/.test(foraging[0].hint), foraging[0].hint);
    check("no tea nobody sells is suggested", expForaging.available.every((e) => !e.best.result.teas.includes("/items/gathering_tea")));

    // Expanding a row shows the calculation and the tea advice.
    await page.click(".mwia-skill-row summary");
    const detail = await page.$eval(".mwia-skill-row[open] .mwia-skill-detail", (n) => n.textContent);
    check("tap shows the calculation", /actions\/h/.test(detail) && /Each action gives/.test(detail) && /Wisdom Tea/.test(detail) && /\+15\.0% speed/.test(detail), detail.slice(0, 200));
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
    check("best-teas ranking matches", best[0].gold === `${coinText(perDay(expBest.available[0].profitPerHour))}/day`, `${best[0].gold} vs ${coinText(perDay(expBest.available[0].profitPerHour))}`);
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
    check("sell at bid matches", bid[0].gold === (expBid.available[0].valid ? `${coinText(perDay(expBid.available[0].profitPerHour))}/day` : "–"), `${bid[0].name} ${bid[0].gold} vs ${expBid.available[0].action.name}`);
    await select(page, "skillingSellAt", "ask");

    // A buff update from the game shows on the next render.
    await select(page, "skillingSkill", "foraging");
    const faster = { ...character, equipmentActionTypeBuffsMap: { [FORAGING]: [{ typeHrid: "/buff_types/action_speed", flatBoost: 0.5, ratioBoost: 0 }] } };
    for (const socket of sockets) socket.send(JSON.stringify({ type: "equipment_buffs_updated", equipmentActionTypeBuffsMap: faster.equipmentActionTypeBuffsMap }));
    await page.waitForFunction(() => window.lastType === "equipment_buffs_updated");
    await select(page, "skillingSkill", "all");
    await select(page, "skillingSkill", "foraging");
    const updated = await rows(page);
    const expUpdated = expectRank(faster, { skill: "foraging", teaMode: "current" }).available[0];
    check("buff update from the game is used", updated[0].gold === `${coinText(perDay(expUpdated.profitPerHour))}/day` && updated[0].gold !== foraging[0].gold, `${updated[0].gold} vs ${coinText(perDay(expUpdated.profitPerHour))}`);

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
