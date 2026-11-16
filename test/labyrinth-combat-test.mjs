// The Pi's nightly Labyrinth combat analyses (dist/pi-labyrinth-combat.mjs, built from
// pi/labyrinth-combat-entry.js): run for the test character as the Pi runs it – a request,
// the game data gzipped, a market file – and the result read back.
//   node test/labyrinth-combat-test.mjs        (after npm run build)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { buildProfile } from "../src/profile.js";
import { lastDue, openLabyrinthCombat } from "../pi/labyrinth-combat-store.mjs";
import { fixtureCharacter } from "./fixture-character.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failures = 0;
const check = (name, ok, detail = "") => {
    console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
    if (!ok) failures++;
};

const data = {};
for (const f of readdirSync(path.join(root, "engine/data"))) data[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(root, "engine/data", f), "utf8"));
data.levelExperienceTable = Array.from({ length: 201 }, (_, level) => Math.round(30 * level ** 2.2));

const dir = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-labcombat-"));
const charDir = path.join(dir, "1");
const rawDir = path.join(dir, "raw", "2026-11-15");
mkdirSync(charDir, { recursive: true });
mkdirSync(rawDir, { recursive: true });
const dataFile = path.join(dir, "game-data.json.gz");
writeFileSync(dataFile, gzipSync(JSON.stringify({ hash: "test", data })));
// A market where a few things are for sale.
const market = { timestamp: 1794776760, marketData: { "/items/cheese_sword": { 0: { a: 2000, b: 1500 } }, "/items/cheese_spear": { 0: { a: 2500, b: 2000 } }, "/items/cheese_mace": { 0: { a: 2600, b: 2000 } } } };
writeFileSync(path.join(rawDir, "1794776760.json.gz"), gzipSync(JSON.stringify(market)));

const character = fixtureCharacter();
const items = new Map(character.characterItems.map((i) => ["h:" + i.hash, i]));
const profile = buildProfile(character, items, data);
const request = {
    character: { id: 1, name: "TestMage" },
    at: 1234,
    version: "test",
    setups: [{ id: "equipped", name: "Equipped now", profile }],
    crates: { coffee: null, food: null },
    settings: { accuracy: "fast", budget: 100000, spending: "all" },
    who: null,
};
writeFileSync(path.join(charDir, "request.json"), JSON.stringify(request));

const started = Date.now();
execFileSync(process.execPath, ["--max-old-space-size=384", path.join(root, "dist/pi-labyrinth-combat.mjs"), charDir, dataFile, path.join(dir, "raw")], { stdio: "inherit", env: { ...process.env, MWIA_LAB_COMBAT_WORKERS: "2" } });
const ms = Date.now() - started;
const result = JSON.parse(readFileSync(path.join(charDir, "result.json"), "utf8"));
console.log(`ran in ${ms} ms`);

check("the result is whole and for the request", result.done === true && result.stage === "done" && result.requestAt === 1234 && result.character === "TestMage" && result.dataHash === "test", JSON.stringify({ done: result.done, stage: result.stage, requestAt: result.requestAt }));
check("Check the rooms: all ten monsters with a curve", result.lab?.monsters?.length === 10 && result.lab.monsters.every((m) => m.curve.length > 3 && m.setupName === "Equipped now"), String(result.lab?.monsters?.length));
check("What should I improve: changes measured", result.improve?.candidates?.length > 5 && result.improve.candidates.every((c) => Number.isFinite(c.levels)), String(result.improve?.candidates?.length));
const build = result.builds?.[0];
check("Build a loadout for the loadout in its own style", result.builds?.length === 1 && build.style === "magic" && build.build && Array.isArray(build.build.picks) && build.build.after.length > 0 && !build.build.profile, JSON.stringify(build && { style: build.style, error: build.error, picks: build.build?.picks?.length }));
check("the market file's time is kept", result.pricesAt === 1794776760000);
const progress = JSON.parse(readFileSync(path.join(charDir, "progress.json"), "utf8"));
check("progress written", ["check", "improve", "build"].includes(progress.stage) && progress.total > 0, JSON.stringify(progress));

// The store: the game's data and a request in, a run at once (no result yet), the nightly schedule.
{
    const piDir = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-labcombat-pi-"));
    mkdirSync(path.join(piDir, "raw", "2026-11-15"), { recursive: true });
    writeFileSync(path.join(piDir, "raw", "2026-11-15", "1794776760.json.gz"), gzipSync(JSON.stringify(market)));
    let clock = Date.UTC(2026, 10, 15, 14, 0);
    const logs = [];
    const store = openLabyrinthCombat(piDir, { log: (line) => logs.push(line), hour: 3, checkMs: 0, busy: () => false, now: () => clock, runner: path.join(root, "dist/pi-labyrinth-combat.mjs"), workers: 2 });
    check("store: a request needs loadouts with profiles", !store.put({ request: { character: { id: 9 }, setups: [] } }).ok && !store.put({ request: { character: { id: "../x" }, setups: request.setups } }).ok);
    check("store: data that isn't the game's is refused", !store.putData(gzipSync(JSON.stringify({ hash: "x", data: {} }))).ok && !store.putData(Buffer.from("nope")).ok);
    const before = store.put({ request: { ...request, character: { id: 9, name: "Nine" }, at: 555 } });
    check("store: a request without the game's data waits for it", before.ok && before.character === "9" && before.dataHash === null && before.started === false, JSON.stringify(before));
    const took = store.putData(gzipSync(JSON.stringify({ hash: "h1", data })));
    check("store: the game's data taken, and the waiting character starts", took.ok && took.dataHash === "h1" && store.get(9).status.queued === false, JSON.stringify(took));
    await store.idle();
    let got = store.get(9);
    check("store: worked out in a process of its own, read back", got.result?.done === true && got.result.requestAt === 555 && got.result.lab.monsters.length === 10 && got.status.error === null && got.status.ms === 0 && got.dataHash === "h1", JSON.stringify(got.status) + logs.join(" | "));
    // A new request is kept for the night; the next due time is 03:00 UTC.
    const later = store.put({ request: { ...request, character: { id: 9, name: "Nine" }, at: 666 } });
    check("store: a new request waits for the night", later.ok && later.started === false && store.get(9).status.requestAt === 666 && store.get(9).status.next === Date.UTC(2026, 10, 16, 3), JSON.stringify(store.get(9).status));
    store.tick();
    check("store: not due before 03:00", !store.get(9).status.queued && !store.get(9).status.running);
    clock = Date.UTC(2026, 10, 16, 3, 5);
    store.tick();
    await store.idle();
    got = store.get(9);
    check("store: due after 03:00, run with the newest request", got.result?.requestAt === 666 && got.result.done, JSON.stringify(got.status));
    clock = Date.UTC(2026, 10, 16, 9);
    store.tick();
    check("store: once a night", !store.get(9).status.queued && !store.get(9).status.running);
    const asked = store.put({ request: { ...request, character: { id: 9, name: "Nine" }, at: 777 }, now: true });
    await store.idle();
    check("store: asked for now, it runs now", asked.started === true && store.get(9).result?.requestAt === 777);
    check("lastDue: today's hour once passed, else yesterday's", lastDue(Date.UTC(2026, 0, 2, 2), 3) === Date.UTC(2026, 0, 1, 3) && lastDue(Date.UTC(2026, 0, 2, 3), 3) === Date.UTC(2026, 0, 2, 3));
}

if (failures) {
    console.log(`${failures} check(s) failed`);
    process.exit(1);
}
console.log("All checks passed");
