// The version next to the character's name in the game's header: there, and
// only there; red with a link when GitHub has a newer one; back after the game
// redraws the header; plain when GitHub can't be reached.
// Usage: node test/version-tag-browser-test.mjs <screenshot-dir>
// BROWSER_PATH picks another browser (Chromium).
import { readFileSync, readdirSync } from "node:fs";
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
const VERSION = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).version;
const GITHUB = "https://raw.githubusercontent.com/tarzanz/mwi-combat-advisor/main/";
const built = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js"), "utf8");
const character = fixtureCharacter();

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };
check("the build carries the version and GitHub's address", built.includes(JSON.stringify(VERSION)) && built.includes(GITHUB + "dist/"));

// The game's header (class names as the game's own, with its hashes) and a name in chat.
const header = `<div class="Header_header__1">
  <div class="Header_rightHeader__8LPWK"><div class="Header_characterInfo__3ixY8"><div class="Header_info__26fkk">
    <div class="Header_name__227rJ"><div class="CharacterName_characterName__2FqyZ" translate="no" style="display:flex">
      <div class="CharacterName_name__1amXp" data-name="tarzwall"><span>tarzwall</span></div></div></div>
    <div class="Header_totalLevel__8LY3Q">Total Level: 1234</div></div></div></div></div>`;
const chat = `<div class="ChatMessage_x"><div class="CharacterName_characterName__2FqyZ"><div class="CharacterName_name__1amXp">someone</div></div></div>`;
const page_html = `<!doctype html><html><head><meta charset="utf-8"><script src="/advisor.user.js"></script></head>
<body style="background:#1b1f35;color:#fff;font:14px sans-serif"><div id="game">${header}${chat}</div>
<script>
  const xhr = new XMLHttpRequest(); xhr.open("GET", "/client-data.json", false); xhr.send();
  const data = JSON.parse(xhr.responseText);
  window.localStorageUtil = { getInitClientData: () => data };
  const ws = new WebSocket("ws://" + location.host + "/fake/api.milkywayidle.com/ws");
  ws.onmessage = (e) => { window.lastType = JSON.parse(e.data).type; };
</script></body></html>`;

// GitHub's package.json as the test wants it: a version, or down.
let latest = VERSION;
let githubCalls = 0;
const server = http.createServer((req, res) => {
    if (req.url === "/" || req.url.startsWith("/?")) {
        res.setHeader("content-type", "text/html");
        res.end(page_html);
    } else if (req.url === "/advisor.user.js") {
        res.setHeader("content-type", "text/javascript");
        res.end(userscript);
    } else if (req.url === "/gh/package.json") {
        githubCalls++;
        if (!latest) {
            res.statusCode = 404;
            return res.end();
        }
        res.setHeader("content-type", "application/json");
        res.end(JSON.stringify({ name: "mwi-combat-advisor", version: latest }));
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
// The script asks this server instead of GitHub.
const userscript = built.split(GITHUB).join(origin + "/gh/");

const tag = (page) => page.evaluate(() => {
    const all = [...document.querySelectorAll(".mwia-version")];
    const t = all[0];
    return t ? { count: all.length, text: t.textContent, old: t.classList.contains("mwia-version-old"), href: t.getAttribute("href"), inName: Boolean(t.closest('[class*="Header_name__"] [class*="CharacterName_characterName__"]')), fontSize: getComputedStyle(t).fontSize, color: getComputedStyle(t).color } : null;
});
const waitTag = (page, test) => page.waitForFunction(test, { timeout: 10000 }).then(() => true, () => false);

const executablePath = process.env.BROWSER_PATH || "/usr/bin/firefox";
const firefox = /firefox/.test(executablePath);
const browser = await puppeteer.launch({ browser: firefox ? "firefox" : "chrome", executablePath, headless: true, args: firefox ? [] : ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    // Up to date.
    await page.goto(origin + "/");
    check("the tag appears", await waitTag(page, () => document.querySelector(".mwia-version")));
    await new Promise((r) => setTimeout(r, 1000));
    let t = await tag(page);
    check("up to date: the version, plain, no link", t?.text === `v${VERSION}` && !t.old && t.href === null, JSON.stringify(t));
    check("only next to the name in the header, not in chat", t?.count === 1 && t.inName, JSON.stringify(t));
    check("very small", parseFloat(t?.fontSize) <= 10, t?.fontSize);
    check("GitHub asked once at start", githubCalls === 1, String(githubCalls));

    // The game redraws the header: the tag comes back.
    await page.evaluate((html) => { document.querySelector(".Header_header__1").outerHTML = html; }, header);
    check("back after the header is redrawn", await waitTag(page, () => document.querySelector(".mwia-version")));

    // A newer version is out.
    latest = VERSION.replace(/\d+$/, (n) => String(Number(n) + 1));
    await page.goto(origin + "/");
    check("newer: turns red", await waitTag(page, () => document.querySelector(".mwia-version-old")));
    t = await tag(page);
    check("newer: says update and links to the install", t?.text === `v${VERSION} – update` && t.href === `${origin}/gh/dist/mwi-combat-advisor.user.js`, JSON.stringify(t));
    check("newer: red", /rgb\(255, 92, 92\)/.test(t?.color || ""), t?.color);
    const box = await page.$eval(".Header_info__26fkk", (n) => n.getBoundingClientRect().toJSON());
    await page.screenshot({ path: path.join(shotDir, "version-tag-newer.png"), clip: { x: 0, y: 0, width: Math.max(320, box.right + 20), height: box.bottom + 20 } });

    // An older version on GitHub (e.g. a release in progress) is not "newer".
    latest = "0.1.0";
    await page.goto(origin + "/");
    await new Promise((r) => setTimeout(r, 1500));
    t = await tag(page);
    check("older on GitHub: plain", t && !t.old && t.text === `v${VERSION}`, JSON.stringify(t));

    // GitHub down.
    latest = null;
    await page.goto(origin + "/");
    await new Promise((r) => setTimeout(r, 1500));
    t = await tag(page);
    check("GitHub down: plain version", t && !t.old && t.text === `v${VERSION}`, JSON.stringify(t));
    check("no page errors", errors.length === 0, errors.join(" | "));
} finally {
    await browser.close();
    server.close();
}
console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
