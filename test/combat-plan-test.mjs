// ⚔ The combat plan on the Pi (dist/pi-combat-plan.mjs, built from pi/combat-plan-entry.js and
// src/combat-plan.js): run for the test character as the Pi runs it – the plan's settings, the
// Labyrinth's loadouts, the 📈 plan's snapshot and plan, the game data gzipped, a market file –
// and the store around it.
//   node test/combat-plan-test.mjs        (after npm run build)
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { buildProfile } from "../src/profile.js";
import { combatPlanSettings, skillingAt } from "../src/combat-plan.js";
import { openCombatPlan } from "../pi/combat-plan-store.mjs";
import { fixtureCharacter } from "./fixture-character.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
let failures = 0;
const check = (name, ok, detail = "") => {
    console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
    if (!ok) failures++;
};

// Pure parts first.
{
    const s = combatPlanSettings({ style: "axe", days: 500, reserve: -3, meleeType: "poke", accuracy: "nope" });
    check("settings: unknown values fall back, days 1–90, no negative reserve", s.style === "magic" && s.days === 90 && s.reserve === 0 && s.meleeType === "any" && s.accuracy === "normal" && s.charms === false, JSON.stringify(s));
    const segs = [{ from: 0, to: 10, perDay: 30e6, name: "Blackberry" }, { from: 10, to: 30, perDay: 60e6, name: "Tailoring" }];
    check("skilling: a block's gold on its day, the last segment after the end", skillingAt(segs, 2).gold === 10e6 && skillingAt(segs, 12).name === "Tailoring" && skillingAt(segs, 40).gold === 20e6 && skillingAt([], 1).gold === 0);
}

const data = {};
for (const f of readdirSync(path.join(root, "engine/data"))) data[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(root, "engine/data", f), "utf8"));
data.levelExperienceTable = Array.from({ length: 201 }, (_, level) => Math.round(30 * level ** 2.2));

const character = fixtureCharacter();
const items = new Map(character.characterItems.map((i) => ["h:" + i.hash, i]));
const profile = buildProfile(character, items, data);
const request = { character: { id: 1, name: "TestMage" }, at: 1234, version: "test", setups: [{ id: "equipped", name: "Equipped now", profile }], crates: {}, settings: { accuracy: "fast" } };
const market = { timestamp: 1794776760, marketData: { "/items/cheese_sword": { 0: { a: 2000, b: 1500 } }, "/items/gobo_stabber": { 0: { a: 9000, b: 7000 } }, "/items/marsberry_cake": { 0: { a: 300, b: 250 } }, "/items/fireball": { 0: { a: 50000, b: 40000 } } } };
const skillingPlan = { at: 99, best: 0, plans: [{ segments: [{ from: 0, to: 30, gold: 30 * 3e6, name: "Milk", skill: "/skills/milking" }] }] };

// A Pi's data folder as the stores keep it.
function piFolder() {
    const dir = mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-cplan-"));
    mkdirSync(path.join(dir, "raw", "2026-11-15"), { recursive: true });
    writeFileSync(path.join(dir, "raw", "2026-11-15", "1794776760.json.gz"), gzipSync(JSON.stringify(market)));
    mkdirSync(path.join(dir, "labyrinth", "combat", "1"), { recursive: true });
    writeFileSync(path.join(dir, "labyrinth", "combat", "game-data.json.gz"), gzipSync(JSON.stringify({ hash: "test", data })));
    writeFileSync(path.join(dir, "labyrinth", "combat", "1", "request.json"), JSON.stringify(request));
    mkdirSync(path.join(dir, "plan", "1"), { recursive: true });
    writeFileSync(path.join(dir, "plan", "1", "snapshot.json"), JSON.stringify({ coins: 200000, at: 77 }));
    writeFileSync(path.join(dir, "plan", "1", "plan.json"), JSON.stringify(skillingPlan));
    return dir;
}

// The runner as the store starts it.
{
    const dir = piFolder();
    const charDir = path.join(dir, "combat-plan", "1");
    mkdirSync(charDir, { recursive: true });
    writeFileSync(path.join(charDir, "settings.json"), JSON.stringify({ settings: { style: "magic", days: 3, reserve: 50000, accuracy: "fast" }, at: 5, version: "test" }));
    const started = Date.now();
    execFileSync(process.execPath, ["--max-old-space-size=384", path.join(root, "dist/pi-combat-plan.mjs"), charDir, path.join(dir, "labyrinth", "combat", "game-data.json.gz"), path.join(dir, "raw"), path.join(dir, "labyrinth", "combat", "1", "request.json"), path.join(dir, "plan", "1")], { stdio: ["ignore", "ignore", "inherit"], env: { ...process.env, MWIA_COMBAT_PLAN_WORKERS: "2" } });
    console.log(`ran in ${Date.now() - started} ms`);
    const r = JSON.parse(readFileSync(path.join(charDir, "result.json"), "utf8"));
    const phases = r.phases || [];
    const days = phases.reduce((sum, p) => sum + (p.to - p.from), 0);
    check("the plan covers its days in phases", phases.length > 0 && Math.abs(days - 3) < 1e-6 && phases.every((p, i) => i === 0 || Math.abs(p.from - phases[i - 1].to) < 1e-9), JSON.stringify(phases.map((p) => [p.kind, p.from, p.to])));
    const fight = phases.find((p) => p.kind === "combat");
    check("a fight has a zone, a whole loadout and its rates", fight && fight.zone?.zoneHrid?.startsWith("/actions/combat/") && fight.loadout.equipment && Array.isArray(fight.loadout.abilities) && fight.loadout.abilityTriggers !== undefined && fight.rates.levelsPerDay > 0 && fight.rates.consumablesPerHour, JSON.stringify(fight && { zone: fight.zone, rates: fight.rates?.levelsPerDay }));
    check("magic's skills are counted, and levels go up", r.skills.includes("magic") && !r.skills.includes("ranged") && r.gained > 0 && r.end.levels.magic > r.start.levels.magic, JSON.stringify({ skills: r.skills, gained: r.gained }));
    check("compared with fighting as you are", r.baseline && r.baseline.gained > 0 && Number.isFinite(r.score) && Number.isFinite(r.baseline.score));
    check("coins never below the reserve at a phase's end (skilling tops up)", phases.every((p) => p.coins >= 50000 - 1 || p.kind === "combat"), JSON.stringify(phases.map((p) => p.coins)));
    check("what it was made from is written down", r.loadoutsAt === 1234 && r.coinsAt === 77 && r.skillingPlanAt === 99 && r.settingsAt === 5 && r.dataHash === "test" && r.pricesAt === 1794776760000 && r.setup.id === "equipped" && r.settings.days === 3);
    check("skilling forgone counted from the 📈 plan's gold", r.skillingForgone > 0 && r.skillingForgone <= 3 * 3e6 + 1, String(r.skillingForgone));
    check("no charms bought by default", phases.every((p) => (p.buys || []).every((b) => b.slot !== "charm")));
}

// The store: settings in, a run at once (no plan yet), the nightly schedule.
{
    const dir = piFolder();
    let clock = Date.UTC(2026, 10, 15, 14, 0);
    const logs = [];
    const store = openCombatPlan(dir, { log: (line) => logs.push(line), hour: 3, checkMs: 0, busy: () => false, now: () => clock, workers: 2 });
    check("store: settings are needed, a character id that is a number", !store.put({ character: { id: 1 } }).ok && !store.put({ character: { id: "../x" }, settings: {} }).ok);
    const first = store.put({ character: { id: 1 }, settings: { style: "magic", days: 1, accuracy: "fast" }, version: "t" });
    check("store: the first settings start a run", first.ok && first.started === true && first.loadouts === true, JSON.stringify(first));
    await store.idle();
    let got = store.get(1);
    check("store: worked out in a process of its own, read back", got.result?.phases?.length > 0 && got.status.error === null && got.settings?.settings?.days === 1, JSON.stringify(got.status) + logs.join(" | "));
    const same = store.put({ character: { id: 1 }, settings: { style: "magic", days: 1, accuracy: "fast" } });
    check("store: the same settings again start nothing", same.ok && same.started === false);
    check("store: next run at 03:00 UTC", got.status.next === Date.UTC(2026, 10, 16, 3));
    store.tick();
    check("store: not due before 03:00", !store.get(1).status.queued && !store.get(1).status.running);
    clock = Date.UTC(2026, 10, 16, 3, 5);
    const at = store.get(1).result.at;
    store.tick();
    await store.idle();
    check("store: due after 03:00", store.get(1).result.at !== at || store.get(1).status.at === clock, JSON.stringify(store.get(1).status));
    const other = store.put({ character: { id: 2 }, settings: { style: "ranged" } });
    check("store: a character without loadouts on the Pi isn't started", other.ok && other.started === false && other.loadouts === false);
}

// The store's memory guard: no start with little swap free; a run stopped when memory runs low,
// and tried again later.
{
    const dir = piFolder();
    let mem = { swapFree: 100, available: 800 };
    const sleeper = path.join(dir, "sleep.mjs");
    writeFileSync(sleeper, "setTimeout(() => {}, 120000);");
    let clock = Date.UTC(2026, 10, 16, 3, 5);
    const store = openCombatPlan(dir, { hour: 3, checkMs: 0, busy: () => false, memory: () => mem, now: () => clock, runner: sleeper });
    mkdirSync(path.join(dir, "combat-plan", "1"), { recursive: true });
    writeFileSync(path.join(dir, "combat-plan", "1", "settings.json"), JSON.stringify({ settings: { style: "magic" }, at: 1 }));
    store.tick();
    check("memory: no nightly start with little swap free", !store.get(1).status.running && !store.get(1).status.queued);
    mem = { swapFree: 900, available: 800 };
    store.tick();
    await new Promise((r) => setTimeout(r, 300));
    check("memory: starts with room", !!store.get(1).status.running);
    mem = { swapFree: 30, available: 800 };
    await store.idle();
    const st = store.get(1).status;
    check("memory: stopped when swap runs low, said so", /low on memory/.test(st.error || "") && !st.running, JSON.stringify(st));
    mem = { swapFree: 900, available: 800 };
    clock += 3600e3;
    store.tick();
    await new Promise((r) => setTimeout(r, 300));
    check("memory: tried again the same night once there is room", !!store.get(1).status.running);
    mem = { swapFree: 30, available: 800 };
    await store.idle();
}

if (failures) {
    console.log(`${failures} check(s) failed`);
    process.exit(1);
}
console.log("All checks passed");
