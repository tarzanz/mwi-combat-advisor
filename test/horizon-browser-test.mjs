// End-to-end check of the 📈 plan: a real pi/server.mjs (orders on) with a
// day of market files, a browser linked to it. The browser sends its
// character and the game's data after the first sync; ▶ Plan now has the Pi
// work the plan out (the planner as a process of its own) and the tab shows
// it: the next 8 hours, the plans compared, each plan's steps. A plan you
// haven't seen puts a blue dot on the 🧭 button; opening the tab clears it.
// Usage: node test/horizon-browser-test.mjs <screenshot-dir>
// BROWSER_PATH picks another browser (Chromium).
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { WebSocketServer } from "ws";
import { fixtureCharacter } from "./fixture-character.js";
import { openStore } from "../pi/history-store.mjs";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir = "/tmp"] = process.argv.slice(2);
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
clientData.levelExperienceTable = Array.from({ length: 201 }, (_, level) => Math.round(30 * level ** 2.2));
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");
const character = fixtureCharacter();
character.characterSkills.push({ skillHrid: "/skills/tailoring", level: 30, experience: 0 }, { skillHrid: "/skills/crafting", level: 20, experience: 0 });
character.characterItems.push({ hash: "needle", itemHrid: "/items/verdant_needle", itemLocationHrid: "/item_locations/inventory", count: 1, enhancementLevel: 0 });

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const H = Math.floor(Date.now() / 3600000);
const marketFile = (hour) => {
    const marketData = {};
    for (const item of Object.values(clientData.itemDetailMap)) marketData[item.hrid] = { 0: { a: 3 * (item.sellPrice || 1), b: 2 * (item.sellPrice || 1), p: 2.5 * (item.sellPrice || 1), v: 40 } };
    return JSON.stringify({ marketData, timestamp: hour * 3600 + 360 });
};
const piData = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-horizon-"));
const piStore = openStore(piData);
for (let age = 24; age >= 1; age--) piStore.addFile(marketFile(H - age));

const pageHtml = `<!doctype html><html><head><meta charset="utf-8"><script src="/advisor.user.js"></script></head><body>
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
        res.end(marketFile(H));
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
const pi = spawn("node", [path.join(root, "pi/server.mjs")], { env: { ...process.env, MWIA_KEY: KEY, MWIA_DATA: piData, PORT: String(PI_PORT), MWIA_MARKET_URL: `${origin}/game_data/marketplace.json`, MWIA_ORIGINS: origin, MWIA_ORDERS: "1", MWIA_LOG_REQUESTS: "0" }, stdio: ["ignore", "ignore", "inherit"] });
for (let k = 0; k < 50 && !(await fetch(piUrl + "/status").then((r) => r.ok).catch(() => false)); k++) await new Promise((r) => setTimeout(r, 100));
const link = `${origin}/#mwia-pi=${Buffer.from(JSON.stringify({ u: piUrl, k: KEY })).toString("base64url")}`;
const planDir = path.join(piData, "plan");

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1100, height: 900 });
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // A week ahead keeps the test quick.
    await page.goto(link);
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });
    await page.evaluate(() => localStorage.setItem("mwia-settings", JSON.stringify({ horizonDays: 7 })));
    await page.reload();
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });

    // The first sync (3 s after the start) finds a Pi that makes plans, and sends the character.
    let sent = false;
    for (let k = 0; k < 100 && !sent; k++) {
        await new Promise((r) => setTimeout(r, 200));
        sent = existsSync(path.join(planDir, "1", "snapshot.json")) && existsSync(path.join(planDir, "game-data.json"));
    }
    check("the character and the game's data go to the Pi after the first sync", sent);
    const snapshot = sent ? JSON.parse(readFileSync(path.join(planDir, "1", "snapshot.json"), "utf8")) : null;
    check("the snapshot: levels, coins, the tool in the inventory, the plan's settings", snapshot?.who?.levels?.["/skills/tailoring"] === 30 && snapshot.coins === 500000 && snapshot.owned["/items/verdant_needle"] === 1 && snapshot.options.days === 7 && snapshot.options.levelDays === 7 && snapshot.character.name === "TestMage", JSON.stringify(snapshot && { coins: snapshot.coins, owned: snapshot.owned, options: snapshot.options }));
    const shipped = sent ? JSON.parse(readFileSync(path.join(planDir, "game-data.json"), "utf8")) : null;
    check("the game's data, trimmed", shipped?.hash === snapshot?.dataHash && Object.keys(shipped.data.actionDetailMap).length > 100 && Array.isArray(shipped.data.levelExperienceTable));

    // The tab before a plan.
    await page.click(".mwia-launcher");
    await page.click('[data-tab="horizon"]');
    const before = await page.$eval(".mwia-body", (b) => b.textContent);
    check("the tab says a plan is coming", /No plan yet/.test(before) && /Plan now/.test(before), before.slice(0, 200));

    // ▶ Plan now: the Pi works it out, the tab reads it back.
    await page.click('[data-action="horizon-run"]');
    await page.waitForFunction(() => /The next 8 hours/.test(document.querySelector(".mwia-body")?.textContent || ""), { timeout: 120000 }).catch(() => null);
    const body = await page.$eval(".mwia-body", (b) => b.textContent);
    check("▶ Plan now: the plan shows, with the next 8 hours", /The next 8 hours/.test(body) && /📈/.test(body), body.slice(0, 300));
    check("the plans compared: earning the most and keeping to what earns now", /Earn the most every block/.test(body) && /Only /.test(body));
    check("each plan has its steps, levels and worth by day", (await page.$$(".mwia-horizon-plan")).length >= 3 && (await page.$$(".mwia-horizon-steps tbody tr")).length > 0 && (await page.$$(".mwia-horizon-spark")).length > 0);
    check("how it is worked out is told", /usual ones, not today's/.test(body) && /50% of what sells/.test(body));
    await page.screenshot({ path: path.join(shotDir, "horizon-tab.png"), fullPage: false });
    const dotOpen = await page.$eval(".mwia-launcher", (b) => b.classList.contains("mwia-has-news"));
    check("seen in the tab: no blue dot", !dotOpen);

    // A plan you haven't seen: the blue dot (kept plan, after a reload), gone once the tab is open.
    await page.evaluate(() => {
        const all = JSON.parse(localStorage.getItem("mwia-horizon"));
        all[1].seen = "an older plan";
        localStorage.setItem("mwia-horizon", JSON.stringify(all));
    });
    await page.reload();
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });
    await page.waitForFunction(() => document.querySelector(".mwia-launcher")?.classList.contains("mwia-has-news"), { timeout: 8000 }).catch(() => null);
    const dot = await page.$eval(".mwia-launcher", (b) => ({ news: b.classList.contains("mwia-has-news"), title: b.title }));
    check("a plan you haven't seen: a blue dot on 🧭", dot.news && /plan/.test(dot.title), JSON.stringify(dot));
    await page.click(".mwia-launcher");
    await page.click('[data-tab="horizon"]');
    await page.waitForFunction(() => !document.querySelector(".mwia-launcher").classList.contains("mwia-has-news"), { timeout: 3000 }).catch(() => null);
    check("opening the tab clears it", !(await page.$eval(".mwia-launcher", (b) => b.classList.contains("mwia-has-news"))));

    // Another number of days: the tab says the plan was made with other settings.
    await page.select('[data-setting="horizonDays"]', "14");
    const changed = await page.$eval(".mwia-body", (b) => b.textContent);
    check("other settings: tap ▶ Plan now", /with other settings/.test(changed));
    check("no page errors", !errors.length, errors.join(" | "));
} finally {
    await browser.close();
    pi.kill();
    server.close();
}
console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
