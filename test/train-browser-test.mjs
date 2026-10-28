// End-to-end check of the plan train in a real Firefox: a fake MWITools planning
// tab (goals + step 2), a fake game with skill pages, category tabs, action
// cards and an action panel, and a fake socket that confirms queued actions.
// Usage: node test/train-browser-test.mjs <screenshot-dir>
// MOBILE=1 runs it at iPhone size (390×844).
import { readFileSync, readdirSync } from "node:fs";
import http from "node:http";
import path from "node:path";
import puppeteer from "puppeteer-core";
import { WebSocketServer } from "ws";
import { fixtureCharacter } from "./fixture-character.js";
import { buildTrain, inventoryCounts, itemCosts, planCosts, productionActions, trainStops } from "../src/plan-train.js";
import { shortCoins } from "../src/format.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir = "/tmp"] = process.argv.slice(2);
const dataDir = path.join(root, "engine/data");
const clientData = {};
for (const f of readdirSync(dataDir)) clientData[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));
// The real client ships category names; the simulator's data does not.
clientData.actionCategoryDetailMap = {};
for (const action of Object.values(clientData.actionDetailMap)) {
    const last = action.category.split("/").pop();
    clientData.actionCategoryDetailMap[action.category] = { hrid: action.category, name: last.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) };
}
const userscript = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");

const HOUSE = "/house_rooms/mystical_study";
const character = fixtureCharacter();
character.characterHouseRoomMap[HOUSE] = { houseRoomHrid: HOUSE, level: 1 };
character.characterItems.push({ hash: "lumber", itemHrid: "/items/lumber", itemLocationHrid: "/item_locations/inventory", enhancementLevel: 0, count: 100 });
character.characterSkills.push({ skillHrid: "/skills/crafting", level: 12 }, { skillHrid: "/skills/tailoring", level: 8 });

// Step 2 as MWITools would list it: every craftable ingredient, Full chain,
// except Cotton Fabric set to Buy.
const actions = productionActions(clientData);
const policies = new Map();
const walk = (hrid) => {
    const action = actions.get(hrid);
    if (!action || policies.has(hrid)) return;
    policies.set(hrid, hrid === "/items/cotton_fabric" ? "buy" : "chain");
    for (const input of action.inputItems || []) walk(input.itemHrid);
    if (action.upgradeItemHrid) walk(action.upgradeItemHrid);
};
for (const cost of clientData.houseRoomDetailMap[HOUSE].upgradeCostsMap["2"]) walk(cost.itemHrid);
const steps = [...policies].map(([hrid, policy]) => ({ hrid, name: clientData.itemDetailMap[hrid].name, policy }));
const owned = inventoryCounts(character.characterItems);
const skills = Object.fromEntries(character.characterSkills.map((s) => [s.skillHrid, s.level]));
const expected = buildTrain({ goals: [{ kind: "house", hrid: HOUSE, target: 2 }], policies }, clientData, { owned, houseLevels: { [HOUSE]: 1 }, skills });
// Foraging 28 gathers Flax; without Woodcutting the logs are bought.
expected.made = expected.stops;
expected.stops = trainStops(expected);

// Market: every item at three times its vendor price, except Birch Log, which nobody sells.
const marketData = {};
for (const item of Object.values(clientData.itemDetailMap)) {
    if (item.hrid !== "/items/birch_log") marketData[item.hrid] = { 0: { a: 3 * (item.sellPrice || 1), b: item.sellPrice || 1 } };
}
const price = (hrid) => marketData[hrid]?.[0].a ?? null;
const plan = { goals: [{ kind: "house", hrid: HOUSE, target: 2 }], policies };
const expectedCosts = planCosts(plan, clientData, { owned, houseLevels: { [HOUSE]: 1 }, price });
const lumberCosts = itemCosts("/items/lumber", expectedCosts.wanted.get("/items/lumber"), clientData, { owned, price });

const MOBILE = !!process.env.MOBILE;
const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/advisor.user.js"></script>
<style>
  body{background:#0b0e1a;color:#ddd;font-family:sans-serif;display:flex;gap:20px}
  .modal{position:fixed;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;z-index:1300}
  .modal>div{background:#223;padding:20px}
  [class*=SkillAction_skillAction]{display:inline-block;border:1px solid #556;margin:4px;padding:6px;cursor:pointer}
  /* MWITools lays a step-2 row out as a grid: icon in a narrow first column. */
  #mwitools-planning{width:360px;font-size:13px}
  .planning-step>summary{display:grid;grid-template-columns:56px 1fr auto;gap:8px;align-items:center}
  .planning-step>summary .planning-policy-switch{grid-column:2/-1}
</style></head>
<body>
  <nav id="nav"></nav>
  <main><div id="skillpage"></div>
    <div id="mwitools-planning">
      <section class="planning-section"><h3>Planning goals · 1</h3>
        <article class="planning-goal"><input type="checkbox" checked><span class="planning-goal-icon"></span>
          <div class="planning-goal-values"><span class="planning-goal-current" data-goal-id="house:${HOUSE}">Current 1</span><span>→</span><input type="number" value="2"></div>
        </article></section>
      <div class="planning-stage"><div id="steps"></div>
        <div class="planning-calculate-bar"><span>Policy edits do not calculate materials automatically</span><button class="planning-primary">Calculate Step 3</button></div>
      </div>
    </div>
  </main>
<script>
  const xhr = new XMLHttpRequest(); xhr.open("GET", "/client-data.json", false); xhr.send();
  const data = JSON.parse(xhr.responseText);
  window.localStorageUtil = { getInitClientData: () => data };
  const ws = new WebSocket("ws://" + location.host + "/fake/api.milkywayidle.com/ws");
  window.queueFull = false;
  ws.onmessage = (e) => { window.lastType = JSON.parse(e.data).type; };

  // MWITools step 2 rows.
  const steps = ${JSON.stringify(steps)};
  document.getElementById("steps").innerHTML = '<section class="planning-section"><h3>Step 2: Choose production methods · ' + steps.length + '</h3>' + steps.map((s) =>
    '<details class="planning-step"><summary><span class="planning-row-icon"><svg><use href="/sprites/items.svg#' + s.hrid.split("/").pop() + '"></use></svg></span>' +
    '<span class="planning-step-name">' + s.name + '</span><span class="planning-step-count">Required 1.27K</span>' +
    '<span class="planning-policy-switch">' + ["chain", "single", "buy"].map((p) => '<button data-policy="' + p + '" aria-pressed="' + (p === s.policy) + '" data-active="' + (p === s.policy) + '">' + p + '</button>').join("") + '</span></summary>' +
    '<div class="planning-source-list"><span class="planning-policy-switch"><button data-policy="buy" aria-pressed="true">Buy</button></span></div></details>').join("") + '</section>';

  // The game: navigation, skill page with category tabs, action cards, action panel.
  const production = Object.values(data.actionDetailMap).filter((a) => a.function === "/action_functions/production" || a.function === "/action_functions/gathering");
  const skills = ["foraging", "woodcutting", "crafting", "tailoring", "cooking"];
  // Like the real game, the links sit in a container whose class also starts with "NavigationBar_navigationLink".
  document.getElementById("nav").innerHTML = '<div class="NavigationBar_navigationLinks__zz">' + skills.map((s) => '<div class="NavigationBar_navigationLink__abc" data-skill="' + s + '"><svg><use href="/sprites/skills.svg#' + s + '"></use></svg>' + s + '</div>').join("") + '</div>';
  let currentCategory = null;
  function showSkill(skill, category) {
    const list = production.filter((a) => a.type === "/action_types/" + skill);
    const categories = [...new Set(list.map((a) => a.category))];
    currentCategory = category || categories[0];
    const page = document.getElementById("skillpage");
    page.innerHTML = '<div>' + categories.map((c) => '<button role="tab" aria-selected="' + (c === currentCategory) + '" data-cat="' + c + '">' + data.actionCategoryDetailMap[c].name + '</button>').join("") + '</div>' +
      list.filter((a) => a.category === currentCategory).map((a) => '<div class="SkillAction_skillAction__x" data-hrid="' + a.hrid + '"><svg><use href="/sprites/items.svg#' + (a.outputItems ? a.outputItems[0].itemHrid : a.hrid).split("/").pop() + '"></use></svg><div class="SkillAction_name__x">' + a.name + '</div></div>').join("");
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
    modal.querySelector(".queue").onclick = () => {
      const count = modal.querySelector("input").value;
      if (!window.queueFull) ws.send(JSON.stringify({ queue: action.hrid, count }));
      modal.remove();
    };
  }
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
let nextActionId = 100;
const queued = []; // every action the fake game accepted, across reloads
const wss = new WebSocketServer({ server });
wss.on("connection", (socket) => {
    socket.send(JSON.stringify(character));
    socket.on("message", (raw) => {
        const message = JSON.parse(String(raw));
        queued.push({ hrid: message.queue, count: Number(message.count) });
        // The game echoes the whole queue; the new action has a fresh id.
        setTimeout(() => socket.send(JSON.stringify({ type: "actions_updated", endCharacterActions: [
            { id: 5, actionHrid: "/actions/combat/fly", isDone: false },
            { id: nextActionId++, actionHrid: message.queue, maxCount: Number(message.count), isDone: false },
        ] })), 60);
    });
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const url = `http://127.0.0.1:${server.address().port}/`;
if (process.env.SERVE_ONLY) {
    console.log(url);
    await new Promise(() => {});
}

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    // Chromium reports the mock page's missing item sprites and favicon; Firefox doesn't.
    page.on("console", (m) => { if (m.type() === "error" && !/\/sprites\/|favicon/.test(m.location()?.url || "")) errors.push(m.text() + " " + (m.location()?.url || "")); });
    await page.setViewport(MOBILE ? { width: 390, height: 844 } : { width: 1300, height: 900 });
    await page.goto(url);
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });
    await page.waitForSelector(".planning-calculate-bar .mwia-train-start", { timeout: 5000 });
    check("Plan train button added to MWITools step 2", true);

    await page.waitForFunction(() => /Materials to buy/.test(document.querySelector(".mwia-plan-costs")?.textContent || ""), { timeout: 8000 });
    const costs = await page.evaluate(() => ({
        total: document.querySelector(".mwia-plan-costs").textContent,
        rows: [...document.querySelectorAll(".planning-step")].map((step) => ({
            name: step.querySelector(".planning-step-name").textContent,
            cost: step.querySelector(":scope > summary .mwia-plan-cost")?.textContent || null,
            width: step.querySelector(":scope > summary .mwia-plan-cost")?.getBoundingClientRect().width || 0,
            rowWidth: step.querySelector(":scope > summary").getBoundingClientRect().width,
        })),
    }));
    const totalText = (label, cost) => `${label} ${shortCoins(cost.coins)}${cost.unpriced.length ? " + ?" : ""}`;
    check("plan total: your choices, all Buy, all One step, all Full chain",
        costs.total.includes(totalText("your choices", expectedCosts.current)) && costs.total.includes(totalText("all Buy", expectedCosts.buy)) &&
        costs.total.includes(totalText("all One step", expectedCosts.single)) && costs.total.includes(totalText("all Full chain", expectedCosts.chain)), costs.total);
    check("plan total names the item without a price", /no price: Birch Log/.test(costs.total), costs.total);
    check("every step-2 row has a cost line", costs.rows.every((row) => row.cost), JSON.stringify(costs.rows.filter((row) => !row.cost)));
    check("cost line spans the whole row", costs.rows.every((row) => row.width >= row.rowWidth - 1), JSON.stringify(costs.rows.slice(0, 2).map((row) => [row.width, row.rowWidth])));
    const lumber = costs.rows.find((row) => row.name === "Lumber")?.cost || "";
    check("Lumber row: Buy, One step and Full chain",
        lumber.includes(totalText("Buy", lumberCosts.buy)) && lumber.includes(totalText("One step", lumberCosts.single)) && lumber.includes(totalText("Full chain", lumberCosts.chain)), lumber);
    console.log("   " + costs.total + "\n   Lumber: " + lumber);
    await page.screenshot({ path: path.join(shotDir, "train-0-costs.png") });

    await page.click(".mwia-train-start");
    await page.waitForSelector(".mwia-train:not(.mwia-hidden) .mwia-train-now", { timeout: 5000 });
    if (MOBILE) {
        const first = expected.stops[0];
        await page.waitForFunction((name) => [...document.querySelectorAll('[class*="SkillActionDetail_name"]')].some((n) => n.textContent === name), { timeout: 8000 }, first.actionName);
        const compact = await page.evaluate(() => {
            const box = document.querySelector(".mwia-train").getBoundingClientRect();
            const queue = document.querySelector(".modal .queue").getBoundingClientRect();
            const hit = document.elementFromPoint(queue.x + queue.width / 2, queue.y + queue.height / 2);
            return {
                list: !!document.querySelector(".mwia-train-stops"),
                next: !!document.querySelector('.mwia-train [data-train="next"]'),
                left: box.left, right: box.right, top: box.top, height: box.height,
                queueFree: !!hit?.closest(".queue"),
            };
        });
        check("phone: train starts compact with its buttons", !compact.list && compact.next && compact.height < 200, JSON.stringify(compact));
        check("phone: train fits the screen width", compact.left >= 0 && compact.right <= 390, JSON.stringify(compact));
        check("phone: game's Add to queue is not covered", compact.queueFree);
        await page.screenshot({ path: path.join(shotDir, "train-m1-compact.png") });
        await page.click('.mwia-train [data-train="move"]');
        const low = await page.evaluate(() => ({ bottom: document.querySelector(".mwia-train").getBoundingClientRect().bottom, saved: localStorage.getItem("mwia-train-low") }));
        check("phone: ⇅ moves the train to the bottom and remembers it", low.bottom > 800 && low.saved === "1", JSON.stringify(low));
        await page.click('.mwia-train [data-train="move"]');
        await page.click('.mwia-train [data-train="toggle"]');
    }
    const widget = await page.$eval(".mwia-train", (n) => n.innerText);
    check("train title from the house goal", /Mystical Study → 2/.test(widget));
    check("as many stops as the plan", (await page.$$eval(".mwia-train-stops li", (l) => l.length)) === expected.stops.length, `${expected.stops.length} expected`);
    check("Cotton Fabric (Buy) listed as missing, not made", /Missing materials:[^\n]*Cotton Fabric/.test(widget) && !expected.stops.some((s) => s.name === "Cotton Fabric"));
    check("level warning for Linen (Tailoring 8)", /needs Tailoring 15/.test(widget));
    check("Flax gathered first (Foraging 28), logs bought (no Woodcutting)",
        expected.stops[0].actionName === "Flax" && /Flax ×/.test(widget.split("Missing materials")[0]) && /Missing materials:[^\n]*Log ×[^\n]*Birch Log ×/.test(widget) && !/Missing materials:[^\n]*Flax/.test(widget), widget);

    // Gather ↔ buy: Flax to the shopping list and back.
    const stopCount = () => page.$$eval(".mwia-train-stops li", (l) => l.length);
    await page.click('.mwia-train-stops [data-train="gather"]');
    const bought = await page.$eval(".mwia-train", (n) => n.innerText);
    check("buy instead: Flax leaves the stops and is missing", (await stopCount()) === expected.stops.length - 1 && /Missing materials:[^\n]*Flax ×/.test(bought), bought);
    await page.$$eval('.mwia-train p [data-train="gather"]', (buttons) => buttons.find((b) => b.dataset.item === "/items/flax").click());
    check("gather: Flax is a stop again", (await stopCount()) === expected.stops.length && (await page.$eval(".mwia-train-now", (n) => n.textContent)).includes("Flax"));
    console.log("   stops: " + expected.stops.map((s) => `${s.actionName}×${s.count}`).join(", "));
    await page.screenshot({ path: path.join(shotDir, "train-1-start.png") });

    const runStop = async (i) => {
        const stop = expected.stops[i];
        await page.waitForFunction((name, count) => {
            const panel = [...document.querySelectorAll('[class*="SkillActionDetail_name"]')].find((n) => n.textContent === name);
            return panel && panel.closest(".modal").querySelector("input").value === String(count);
        }, { timeout: 8000 }, stop.actionName, stop.count).catch(() => { throw new Error(`stop ${i + 1} (${stop.actionName}) did not open with count ${stop.count}`); });
        await page.click(".modal .queue");
        await page.waitForFunction((n) => !document.querySelector(".mwia-train-current") || document.querySelectorAll(".mwia-train-done").length > n, { timeout: 5000 }, i);
    };
    for (let i = 0; i < 3; i++) await runStop(i);
    check("first three stops opened, filled and advanced", true);

    // A reload keeps the progress.
    await page.reload();
    await page.waitForFunction(() => window.lastType === "init_character_data", { timeout: 10000 });
    await page.waitForSelector(".mwia-train:not(.mwia-hidden)", { timeout: 5000 });
    const afterReload = await page.$eval(".mwia-train-now", (n) => n.textContent);
    check("progress survives a reload", afterReload.startsWith(`4/${expected.stops.length}`), afterReload);
    await page.click('[data-train="open"]');

    // A full queue: nothing is confirmed, so the train waits and says why.
    await page.evaluate(() => { window.queueFull = true; });
    await page.waitForFunction((name) => [...document.querySelectorAll('[class*="SkillActionDetail_name"]')].some((n) => n.textContent === name), { timeout: 8000 }, expected.stops[3].actionName);
    await page.click(".modal .queue");
    await page.waitForFunction(() => /Nothing reached the queue/.test(document.querySelector(".mwia-train")?.innerText || ""), { timeout: 8000 });
    check("full queue: train stays and explains", (await page.$eval(".mwia-train-now", (n) => n.textContent)).startsWith("4/"));
    await page.evaluate(() => { window.queueFull = false; });
    await page.click('[data-train="open"]');
    for (let i = 3; i < expected.stops.length; i++) await runStop(i);
    const finished = await page.$eval(".mwia-train", (n) => n.innerText);
    check("train finishes", /All stops queued/.test(finished) && /upgrade the house room/.test(finished));
    await page.screenshot({ path: path.join(shotDir, "train-2-done.png") });

    const position = new Map(queued.map((q, i) => [q.hrid, i]));
    const inOrder = queued.every((q) => {
        const action = clientData.actionDetailMap[q.hrid];
        const inputs = [...(action.inputItems || []).map((i) => i.itemHrid), action.upgradeItemHrid].filter(Boolean);
        return inputs.every((input) => { const maker = actions.get(input); return !maker || !position.has(maker.hrid) || position.get(maker.hrid) < position.get(q.hrid); });
    });
    check("every ingredient queued before what is made from it", inOrder);
    check("queued counts match the plan", queued.length === expected.stops.length && queued.every((q, i) => q.count === expected.stops[i].count));

    await page.$eval('[data-train="cart"]', (b) => b.scrollIntoView());
    await page.click('[data-train="cart"]');
    await page.waitForFunction(() => document.querySelector(".mwia-train .mwia-notice-bad"), { timeout: 5000 });
    check("cart without MWITools explains", /cart was not found/.test(await page.$eval(".mwia-train .mwia-notice", (n) => n.textContent)));
    await page.$eval('[data-train="end"]', (b) => b.scrollIntoView());
    await page.click('[data-train="end"]');
    check("ending hides the panel", await page.$eval(".mwia-train", (n) => n.classList.contains("mwia-hidden")));

    // Without step 2 the button explains what is missing.
    await page.evaluate(() => document.getElementById("steps").replaceChildren());
    await page.click(".mwia-train-start");
    await page.waitForSelector(".mwia-train .mwia-notice-bad", { timeout: 5000 });
    check("no step 2: explains", /Calculate Step 2/.test(await page.$eval(".mwia-train .mwia-notice", (n) => n.textContent)));
    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exitCode = failures ? 1 : 0;
