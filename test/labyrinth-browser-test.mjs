// The Labyrinth tab in a real browser: checks the rooms against every Labyrinth monster
// with each saved loadout (a magic and a ranged one) and the crate from the character's
// Labyrinth slots, re-reads them at another room level and floor without simulating
// again, tests what takes you further, and builds a ranged loadout within a budget.
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
character.characterAbilities.push({ abilityHrid: "/abilities/quick_shot", level: 10, experience: 0, slotNumber: 0 });
character.combatUnit = { combatAbilities: [{ abilityHrid: "/abilities/fireball", level: 37 }, { abilityHrid: "/abilities/flame_blast", level: 43 }] };
// Two saved combat loadouts: the mage as worn, and a ranged one with the crossbow and Quick Shot.
const wear = (slot, hash) => [`/item_locations/${slot}`, hash];
character.characterLoadoutMap = {
    1: { name: "Magic", actionTypeHrid: "/action_types/combat", isDefault: true, ordinal: 1,
        wearableMap: Object.fromEntries(Object.entries(gear).map(([slot, hrid]) => wear(slot, `1::/item_locations/${slot}::/items/${hrid}::0`))),
        abilityMap: { 1: "/abilities/fireball", 2: "/abilities/flame_blast" } },
    2: { name: "Ranged", actionTypeHrid: "/action_types/combat", ordinal: 2,
        wearableMap: Object.fromEntries([...Object.entries(gear).filter(([slot]) => slot !== "two_hand"), ["two_hand", "cedar_crossbow"]].map(([slot, hrid]) => wear(slot, `1::/item_locations/${slot}::/items/${hrid}::0`))),
        abilityMap: { 1: "/abilities/quick_shot" } },
};
character.actionTypeDrinkSlotsMap["/action_types/labyrinth"] = [{ itemHrid: "/items/basic_coffee_crate" }, null, null, null];

const marketData = {};
for (const item of Object.values(clientData.itemDetailMap)) {
    const vendor = item.sellPrice || 1;
    marketData[item.hrid] = { 0: { a: 3 * vendor, b: 2.5 * vendor } };
}

const page_html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script src="/advisor.user.js"></script></head>
<body style="background:#1b1f35;color:#fff;font:14px sans-serif"><div id="game">Fake game
  <div class="LabyrinthPanel_roomGrid__1I6LU" style="display:grid; grid-template-columns: repeat(4, 2.875rem); grid-template-rows: repeat(4, 2.875rem); gap: 2px"><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_clearedRoom__ljpjJ"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_visibleRoom__32sJ4">Lv.20</div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_visibleRoom__32sJ4">Lv.21</div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div><div class="LabyrinthPanel_roomCell__3CSgp LabyrinthPanel_fogRoom__3mk6e"></div></div>
  <div class="LabyrinthPanel_automationSection__a1"><table class="LabyrinthPanel_automationTable__38WwV"><thead><tr><th>Room Type</th><th>Loadout</th><th>Skip if room level is above my skill level by</th></tr></thead><tbody>
    <tr><td><div class="LabyrinthPanel_roomLabel__Sju5O"><svg width="16" height="16"><use href="/static/media/sprite.svg#milking"></use></svg><span>Milking</span></div></td><td><div class="Dropdown_dropdown__1E7is"><div role="combobox" class="MuiSelect-select MuiSelect-standard">All Skills</div><input aria-hidden="true" tabindex="-1" class="MuiSelect-nativeInput css-1k3x8v3" value="12"></div></td><td><div class="LabyrinthPanel_skipThreshold__1qXz5"><span>≥ 100</span><button>Edit</button></div></td></tr>
    <tr><td><div class="LabyrinthPanel_roomLabel__Sju5O"><svg width="16" height="16"><use href="/static/media/sprite.svg#cyclops"></use></svg><span>Cyclops</span></div></td><td><div class="Dropdown_dropdown__1E7is"><div role="combobox" class="MuiSelect-select MuiSelect-standard">Magic</div><input aria-hidden="true" tabindex="-1" class="MuiSelect-nativeInput css-1k3x8v3" value="1"></div></td><td><div class="LabyrinthPanel_skipThreshold__1qXz5"><span>≥ 100</span><button>Edit</button></div></td></tr>
    <tr><td><div class="LabyrinthPanel_roomLabel__Sju5O"><svg width="16" height="16"><use href="/static/media/sprite.svg#dryad"></use></svg><span>Dryad</span></div></td><td><div class="Dropdown_dropdown__1E7is"><div role="combobox" class="MuiSelect-select MuiSelect-standard">No Loadout</div><input aria-hidden="true" tabindex="-1" class="MuiSelect-nativeInput css-1k3x8v3" value="0"></div></td><td><div class="LabyrinthPanel_skipThreshold__1qXz5"><span>≥ 100</span><button>Edit</button></div></td></tr>
    <tr><td><div class="LabyrinthPanel_roomLabel__Sju5O"><svg width="16" height="16"><use href="/static/media/sprite.svg#mimic"></use></svg><span>Mimic</span></div></td><td><div class="Dropdown_dropdown__1E7is"><div role="combobox" class="MuiSelect-select MuiSelect-standard">No Loadout</div><input aria-hidden="true" tabindex="-1" class="MuiSelect-nativeInput css-1k3x8v3" value="0"></div></td><td><div class="LabyrinthPanel_skipThreshold__1qXz5"><span>≥ 100</span><button>Edit</button></div></td></tr>
  </tbody></table></div></div>
<script>
  // A stand-in for the game's MUI dropdowns: mousedown opens a listbox, a click on an option sets it.
  const LOADOUTS = [["0", "No Loadout"], ["12", "All Skills"], ["1", "Magic"], ["2", "Ranged"]];
  document.addEventListener("mousedown", (e) => {
    const combo = e.target.closest && e.target.closest('[role="combobox"]');
    if (!combo) return;
    const list = document.createElement("ul");
    list.setAttribute("role", "listbox");
    for (const [value, label] of LOADOUTS) {
      const li = document.createElement("li");
      li.setAttribute("role", "option"); li.setAttribute("data-value", value); li.textContent = label;
      li.addEventListener("click", () => { combo.textContent = label; combo.parentElement.querySelector("input").value = value; list.remove(); });
      list.appendChild(li);
    }
    document.body.appendChild(list);
  });
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
// A made-up Labyrinth message: what the game really sends is what the report is for.
// Shaped as the game sent it on floor 1 (the start cleared, a Cyclops and a Dryad in sight, the rest
// in fog) – with the rooms at level 20 and 21 instead of 30 and 31, where the test's mage wins some.
const combatRoom = (monster, level) => ({ roomType: "/labyrinth_room_types/combat", monsterHrid: "/monsters/" + monster, recommendedLevel: level });
const labMessage = { type: "labyrinth_updated", labyrinth: { characterID: 1, isActive: true, currentFloor: 1,
    roomData: [[{ roomType: "", recommendedLevel: 0, isCleared: true }, combatRoom("cyclops", 20), null, null], [combatRoom("dryad", 21), null, null, null], [null, null, null, null], [null, null, null, null]],
    pathData: "[]", totalTreasureRooms: 1, remainingTreasureRooms: 1 } };
new WebSocketServer({ server }).on("connection", (socket) => {
    socket.send(JSON.stringify(character));
    setTimeout(() => socket.send(JSON.stringify(labMessage)), 200);
});
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

    check("both saved loadouts are listed", /Loadouts: Magic, Ranged/.test(intro), intro.match(/Loadouts:[^\n]*/)?.[0]);

    await page.waitForSelector(".mwia-laby-note", { timeout: 5000 }).catch(() => {});
    const noteBefore = await page.$eval(".mwia-laby-note", (n) => n.textContent).catch(() => "");
    check("the game's automation table asks for a check first", /tap Check the rooms/.test(noteBefore), noteBefore);
    await page.select('[data-setting="accuracy"]', "fast");
    let t0 = Date.now();
    await page.click('[data-action="laby-check"]');
    await idle(page, "At room level 30");
    console.log(`room check took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    let text = await body(page);
    check("simulated with the slotted crate and both loadouts", /Simulated with Basic Coffee crate, 20 rooms per monster and room level, 2 loadouts/.test(text), text.match(/Simulated with[^\n]*/)?.[0]);
    check("room level 30 is floor 1 (a guess)", /At room level 30 \(floor 1, a guess\)/.test(text));
    const rows = await page.$$eval(".mwia-laby-rooms tbody tr", (trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim())));
    check("one row per Labyrinth monster", rows.length === 10 && rows.some((r) => r[0] === "Cyclops") && rows.some((r) => r[0] === "Mimic"), rows.map((r) => r[0]).join(", "));
    const row = (name) => rows.find((r) => r[0] === name) || [];
    check("Cyclops: weak to fire and water magic (as the wiki says), fought with the Magic loadout", /Magic \(fire, water\)/.test(row("Cyclops")[2]) && row("Cyclops")[3] === "Magic" && /Magic · fire ✓/.test(row("Cyclops")[4]), row("Cyclops").join(" | "));
    check("Giant Scorpion: water and nature magic; Giant Mantis: nature and fire", /Magic \(water, nature\)/.test(row("Giant Scorpion")[2]) && /Magic \(nature, fire\)/.test(row("Giant Mantis")[2]), row("Giant Scorpion")[2] + " / " + row("Giant Mantis")[2]);
    check("Dryad, Salamander and Siren: ranged", ["Dryad", "Salamander", "Siren"].every((m) => /^Ranged/.test(row(m)[2])), ["Dryad", "Salamander", "Siren"].map((m) => row(m)[2]).join(" / "));
    check("Shadow Archer stab and slash, Pyre Hunter slash and smash, Frost Sniper smash and stab", /Stab · Slash/.test(row("Shadow Archer")[2]) && /Slash · Smash/.test(row("Pyre Hunter")[2]) && /Smash · Stab/.test(row("Frost Sniper")[2]), [row("Shadow Archer")[2], row("Pyre Hunter")[2], row("Frost Sniper")[2]].join(" / "));
    check("Mimic: Thorns / Retaliation", /Thorns \/ Retaliation/.test(row("Mimic")[2]), row("Mimic")[2]);
    check("each room type names a loadout", rows.every((r) => r[3] === "Magic" || r[3] === "Ranged"), rows.map((r) => r[3]).join(", "));
    const tiles = await page.$$eval(".mwia-laby-tile", (ts) => ts.map((t) => t.innerText.replace(/\s+/g, " ")));
    check("a room guide: one tile per room type", tiles.length === 10, tiles.join(" / "));
    check("Cyclops tile: put on Magic", tiles.some((t) => /^Cyclops (✅|⚠) Magic|^Cyclops ✖ Shroud or go around best: Magic/.test(t)), tiles.find((t) => t.startsWith("Cyclops")));
    check("a lost room type's tile says shroud", tiles.some((t) => /✖ Shroud or go around best: (Magic|Ranged)/.test(t)), tiles.join(" / "));
    check("safe levels carry the guessed floor", rows.some((r) => /\((fl\. \d+|below fl\. 1)\)/.test(r[5])), rows.map((r) => r[5]).join(" / "));
    check("a verdict for each monster at the room level", rows.every((r) => /fight|risky|shroud/.test(r[7])), rows.map((r) => r[7]).join(" / "));
    // The marks in the game's automation table, next to each monster's loadout chooser.
    await page.waitForFunction(() => document.querySelectorAll(".mwia-laby-mark").length === 3, { timeout: 5000 }).catch(() => {});
    const marks = await page.$$eval("table[class*=automationTable] tbody tr", (trs) => trs.map((tr) => [tr.querySelector("span")?.textContent, tr.querySelector(".mwia-laby-mark")?.textContent || ""]));
    const markOf = (name) => marks.find((x) => x[0] === name)?.[1] ?? "";
    check("automation: no mark on a skilling room", markOf("Milking") === "", JSON.stringify(marks));
    check("automation: Cyclops has Magic chosen – marked right", /^✅ Magic · \d+%$/.test(markOf("Cyclops")), markOf("Cyclops"));
    check("automation: Dryad with no loadout – pick one, or shroud", /^(👉 Pick (Magic|Ranged)|✖ Shroud or go around · best (Magic|Ranged)): \d+%$|^👉 Pick (Magic|Ranged) · \d+%$/.test(markOf("Dryad")), markOf("Dryad"));
    check("automation: Mimic marked", /(Magic|Ranged)/.test(markOf("Mimic")), markOf("Mimic"));
    const noteAfter = await page.$eval(".mwia-laby-note", (n) => n.textContent).catch(() => "");
    check("automation: the note names the room level", /at room level 21 \(the rooms of floor 1 you can see\)/.test(noteAfter), noteAfter);
    check("automation: the check is kept for a reload", await page.evaluate(() => (JSON.parse(localStorage.getItem("mwia-laby-check") || "null")?.monsters || []).length === 10));
    // The map: the rooms in sight get a frame and the loadout, at their own level.
    await page.waitForFunction(() => document.querySelectorAll(".mwia-laby-cellmark").length === 2, { timeout: 5000 }).catch(() => {});
    const cellMarks = await page.$$eval("[class*=LabyrinthPanel_roomCell]", (cs) => cs.map((c, i) => [i, c.querySelector(".mwia-laby-cellmark")?.className || "", c.querySelector(".mwia-laby-cellmark")?.textContent || ""]).filter((x) => x[1]));
    check("map: a mark on the two rooms in sight, none on fog or the start", cellMarks.map((x) => x[0]).join() === "1,4", JSON.stringify(cellMarks));
    check("map: a frame and the share won in the corner", /mwia-laby-(ok|warn)/.test(cellMarks[0]?.[1]) && cellMarks.every((x) => /^\d+%$/.test(x[2])), JSON.stringify(cellMarks));
    const legend = await page.$eval(".mwia-laby-legend", (n) => [...n.children].filter((c) => c.tagName === "DIV").map((c) => c.textContent)).catch(() => []);
    check("map: a line per room under the map", legend.length === 2 && /^Lv\.20 Cyclops: (✅|⚠) Magic · \d+%$/.test(legend[0]) && /^Lv\.21 Dryad: (✖ shroud or go around \(best: (Magic|Ranged), \d+%\)|(✅|⚠) (Magic|Ranged) · \d+%)$/.test(legend[1]), JSON.stringify(legend));
    await page.$eval(".mwia-panel", (p) => (p.style.visibility = "hidden"));
    await page.screenshot({ path: path.join(shotDir, "laby-map.png"), clip: await page.$eval("[class*=LabyrinthPanel_roomGrid]", (g) => { const r = g.getBoundingClientRect(); const l = document.querySelector(".mwia-laby-legend").getBoundingClientRect(); return { x: 0, y: r.y, width: Math.max(r.right, l.right) + 4, height: l.bottom - r.y + 4 }; }) }).catch(() => {});
    await page.$eval(".mwia-panel", (p) => (p.style.visibility = ""));

    // ▶ Fill in: every monster's row set to its best loadout through the dropdowns.
    await page.$eval(".mwia-laby-fill", (b) => b.click()); // the advisor panel covers the fake game page
    await page.waitForFunction(() => /Filled in/.test(document.querySelector(".mwia-laby-note")?.textContent || ""), { timeout: 10000 }).catch(() => {});
    const filled = await page.$$eval("table[class*=automationTable] tbody tr", (trs) => Object.fromEntries(trs.map((tr) => [tr.querySelector("span")?.textContent, tr.querySelector("input")?.value])));
    const fillNote = await page.$$eval(".mwia-laby-note", (ns) => ns.map((n) => n.textContent.replace(/\s+/g, " ")).join(" // "));
    const bestId = (name) => (rows.find((r) => r[0] === name)?.[3] === "Magic" ? "1" : "2");
    check("fill in: each monster gets its best loadout", filled.Cyclops === "1" && filled.Dryad === bestId("Dryad") && filled.Mimic === bestId("Mimic"), JSON.stringify(filled));
    check("fill in: skilling rooms untouched", filled.Milking === "12", filled.Milking);
    check("fill in: says what it did", /Filled in: 2 changed, 1 already right\./.test(fillNote), fillNote);
    await page.waitForFunction(() => [...document.querySelectorAll(".mwia-laby-mark")].every((n) => /^✅|\(chosen\)/.test(n.textContent)), { timeout: 5000 }).catch(() => {});
    const marksAfter = await page.$$eval(".mwia-laby-mark", (ns) => ns.map((n) => n.textContent));
    check("fill in: the marks now say chosen", marksAfter.every((t) => /^✅|^⚠ |\(chosen\)/.test(t)), JSON.stringify(marksAfter));
    const matrix = await domText(page);
    check("every loadout against every monster", /All your loadouts/.test(matrix));
    await page.screenshot({ path: path.join(shotDir, "laby-1-rooms.png"), fullPage: !MOBILE });

    // Another floor and room level: read off the curves, no new simulation.
    await page.select('[data-setting="labyFloor"]', "2");
    let shown = await domText(page);
    check("floor 2 means room level 50", /At room level 50 \(floor 2, a guess\)/.test(shown) && (await page.$eval('[data-setting="labyLevel"]', (n) => n.value)) === "50");
    await page.$eval('[data-setting="labyLevel"]', (n) => { n.value = "5"; n.dispatchEvent(new Event("change", { bubbles: true })); });
    shown = await domText(page);
    check("room level 5 re-reads without simulating", /At room level 5/.test(shown) && !/Simulating/.test(shown) && /At level 5/.test(shown));
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-settings")).labyLevel);
    check("room level is kept", String(saved) === "5", saved);

    t0 = Date.now();
    await page.click('[data-action="laby-improve"]');
    await idle(page, "What takes you further");
    console.log(`improvements took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    text = await body(page);
    check("improvements listed or none found", /Work on/.test(await domText(page)) || /None of the crates/.test(text), text.slice(text.indexOf("What takes you further"), text.indexOf("What takes you further") + 600));
    check("the next coffee crate helps", /Advanced Coffee crate|Expert Coffee crate/.test(text));
    const better = await page.$$eval(".mwia-laby-rooms tbody tr", (trs) => trs.map((tr) => [tr.cells[0].innerText, tr.cells[tr.cells.length - 1].innerText]));
    check("a 'better with' column per monster", better.length === 10, JSON.stringify(better));
    writeFileSync(path.join(shotDir, "laby.txt"), text);
    await page.screenshot({ path: path.join(shotDir, "laby-2-improve.png"), fullPage: !MOBILE });

    // A ranged loadout for the ranged rooms, within 5M.
    await page.select('[data-setting="labyStyle"]', "ranged");
    check("the builder names the ranged rooms", /For: Dryad, Salamander, Siren\./.test(await body(page)));
    await page.$eval('[data-setting="budget"]', (n) => { n.value = "5M"; n.dispatchEvent(new Event("change", { bubbles: true })); });
    t0 = Date.now();
    await page.click('[data-action="laby-build"]');
    await idle(page, "Ranged loadout");
    console.log(`building took ${((Date.now() - t0) / 1000).toFixed(1)} s`);
    text = await body(page);
    const built = text.slice(text.indexOf("Ranged loadout"));
    check("a ranged list within the budget", /Ranged loadout – (for [\d.,kM]+ of your 5\.00M|nothing to buy)/.test(built), built.slice(0, 600));
    const spent = /for ([\d.,]+)([kM]?) of your/.exec(built);
    const coinsOf = (m) => (m ? Number(m[1].replace(/,/g, "")) * ({ k: 1e3, M: 1e6 }[m[2]] || 1) : 0);
    check("never over budget", coinsOf(spent) <= 5e6, spent?.[0]);
    const after = await page.$$eval(".mwia-laby-built tbody tr", (trs) => trs.map((tr) => [...tr.cells].map((c) => c.innerText.trim())));
    check("before and after for the three ranged rooms", after.length === 3 && after.map((r) => r[0]).join() === "Dryad,Salamander,Siren", JSON.stringify(after));
    const level = (t) => (/below/.test(t) ? 0 : parseFloat(t));
    check("the built loadout goes at least as far", after.every((r) => level(r[4]) >= level(r[3]) - 2), JSON.stringify(after));
    writeFileSync(path.join(shotDir, "laby-build.txt"), await page.$eval(".mwia-body", (n) => n.textContent.slice(n.textContent.indexOf("Ranged loadout"))));
    await page.evaluate(() => [...document.querySelectorAll(".mwia-body h3")].find((h) => /Build a loadout/.test(h.textContent))?.scrollIntoView());
    await page.screenshot({ path: path.join(shotDir, "laby-3-build.png"), fullPage: !MOBILE });
    if (MOBILE) {
        const scroll = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
        check("phone: no sideways scrolling", scroll);
    }

    // The report on the game's Labyrinth: the message the game sent, the page's elements.
    await page.click('[data-action="laby-read"]');
    const report = await page.$eval(".mwia-notice-diag", (n) => n.textContent).catch(() => "");
    writeFileSync(path.join(shotDir, "laby-report.txt"), report);
    check("report: the Labyrinth message and its shape", /labyrinth_updated/.test(report) && /shape: \{type: "labyrinth_updated", labyrinth: \{characterID: 1, isActive: true, currentFloor: 1, roomData: \[4× \[4× /.test(report), report.slice(0, 800));
    check("report: the Labyrinth page's elements", /div\.LabyrinthPanel_roomGrid__1I6LU/.test(report) && /LabyrinthPanel_visibleRoom__32sJ4 "Lv\.20"/.test(report), report.slice(report.indexOf("page:"), report.indexOf("page:") + 400));
    check("report: the automation table's rows and controls", /headers: Room Type \| Loadout/.test(report) && /row 3: Dryad \| (Ranged|Magic) \| ≥ 100Edit ⟶ div\.MuiSelect-select\.MuiSelect-standard role=combobox "(Ranged|Magic)"/.test(report) && /last row html: <tr><td><div class="LabyrinthPanel_roomLabel__Sju5O">/.test(report) && !/mwia/.test(report.slice(report.indexOf("tables:"), report.indexOf("page:"))), report.slice(report.indexOf("tables:"), report.indexOf("tables:") + 600));
    check("report: kept in the browser", await page.evaluate(() => JSON.parse(localStorage.getItem("mwia-laby-log") || "[]").some((m) => m.type === "labyrinth_updated")));

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
