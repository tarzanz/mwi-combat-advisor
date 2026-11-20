// ⚔ The combat plan on the Pi, once a night (src/combat-plan.js): from the plan's settings a
// device sent (style, days, reserve …), the loadouts the Labyrinth tab sends
// (data/labyrinth/combat/<character>/request.json and its game data) and the coins and
// skilling's gold from the 📈 plan (data/plan/<character>/). dist/pi-combat-plan.mjs works it
// out in a process of its own at the lowest priority, never beside the Pi's other heavy jobs
// (gate), after the night's Labyrinth run when both are due. A device can ask for a run now.
//
// data/combat-plan/<character>/settings.json   { settings, at, version } as a device sent it
// data/combat-plan/<character>/result.json     the newest plan
// data/combat-plan/<character>/progress.json   how far a run has got
// data/combat-plan/<character>/status.json     { started, at, ms, error }

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { characterKey } from "./plan-store.mjs";
import { lastDue } from "./labyrinth-combat-store.mjs";

export const MAX_COMBAT_PLAN_BYTES = 64 * 1024;
const here = path.dirname(new URL(import.meta.url).pathname);
// MWIA_COMBAT_PLAN_RUNNER: another runner (the browser test runs an empty one).
const RUNNER = process.env.MWIA_COMBAT_PLAN_RUNNER || path.join(here, "..", "dist", "pi-combat-plan.mjs");
const HEAP_MB = 384;
const LOWEST = 19;
const DAY_MS = 24 * 3600 * 1000;
// The Pi's memory: a run starts only with this much swap free, and is stopped (and tried again
// later) when swap and memory run this low – the Pi has rebooted when swap ran out.
const START_SWAP_MB = 250;
const STOP_SWAP_MB = 60;
const STOP_AVAILABLE_MB = 150;
const GUARD_MS = 5000;

// { swapFree, available } in MB from /proc/meminfo, or null where there is none.
export function memoryNow(file = "/proc/meminfo") {
    try {
        const text = readFileSync(file, "utf8");
        const mb = (key) => Number(text.match(new RegExp(`^${key}:\\s+(\\d+) kB`, "m"))?.[1]) / 1024;
        const swapTotal = mb("SwapTotal");
        return { swapFree: swapTotal > 0 ? mb("SwapFree") : Infinity, available: mb("MemAvailable") };
    } catch {
        return null;
    }
}
const lowForStart = (m) => !!m && m.swapFree < START_SWAP_MB;
const lowForRun = (m) => !!m && (m.swapFree < STOP_SWAP_MB || m.available < STOP_AVAILABLE_MB);

const writeAtomic = (file, text) => {
    writeFileSync(file + ".tmp", text);
    renameSync(file + ".tmp", file);
};
const readJson = (file) => {
    try {
        return JSON.parse(readFileSync(file, "utf8"));
    } catch {
        return null;
    }
};

const validBody = (b) => b && typeof b === "object" && characterKey(b.character?.id) && b.settings && typeof b.settings === "object" && !Array.isArray(b.settings);

// hour: when the nightly run is due (UTC); gate(job): runs it when the Pi's other heavy jobs are
// done; busy(): true while the Pi is loaded (the run waits); runner for the tests.
// memory(): { swapFree, available } in MB (null: not known).
export function openCombatPlan(dataDir, { log = () => {}, gate = (job) => job(), hour = 3, checkMs = 10 * 60 * 1000, busy = () => os.loadavg()[0] > os.cpus().length, memory = memoryNow, now = () => Date.now(), runner = RUNNER, workers = null } = {}) {
    const dir = path.join(dataDir, "combat-plan");
    mkdirSync(dir, { recursive: true });
    const combatDir = path.join(dataDir, "labyrinth", "combat");
    const dataFile = path.join(combatDir, "game-data.json.gz");
    const rawDir = path.join(dataDir, "raw");
    const waiting = new Set();
    const running = new Set();
    const again = new Set();
    const jobs = new Set();

    const charDir = (key) => path.join(dir, key);
    const loadoutsOf = (key) => path.join(combatDir, key, "request.json");
    const status = (key) => readJson(path.join(charDir(key), "status.json")) || {};
    const setStatus = (key, fields) => writeAtomic(path.join(charDir(key), "status.json"), JSON.stringify({ ...status(key), ...fields }));
    const ready = (key) => existsSync(path.join(charDir(key), "settings.json")) && existsSync(loadoutsOf(key)) && existsSync(dataFile);

    function run(key) {
        return new Promise((resolve) => {
            const started = now();
            waiting.delete(key);
            running.add(key);
            setStatus(key, { started, running: started });
            const env = { ...process.env, ...(workers ? { MWIA_COMBAT_PLAN_WORKERS: String(workers) } : {}) };
            const args = [`--max-old-space-size=${HEAP_MB}`, runner, charDir(key), dataFile, rawDir, loadoutsOf(key), path.join(dataDir, "plan", key)];
            const child = spawn(process.execPath, args, { stdio: ["ignore", "ignore", "pipe"], env });
            try {
                os.setPriority(child.pid, LOWEST);
            } catch {
                // the runner lowers its own priority too
            }
            // Stopped when the Pi runs low on memory; the nightly tick tries again once there is room.
            let lowMemory = false;
            const guard = setInterval(() => {
                if (!lowForRun(memory())) return;
                lowMemory = true;
                child.kill("SIGKILL");
            }, GUARD_MS);
            guard.unref?.();
            let stderr = "";
            child.stderr.on("data", (chunk) => {
                if (stderr.length < 4000) stderr += chunk;
            });
            child.on("close", (code) => {
                clearInterval(guard);
                const ms = now() - started;
                const lines = stderr.trim().split("\n").filter(Boolean);
                const error = lowMemory ? "stopped: the Pi ran low on memory (tried again later)" : code === 0 ? null : (lines.find((l) => /Error: /.test(l))?.replace(/^.*?Error: /, "") || lines.pop() || `exit ${code}`).slice(0, 300);
                // Stopped for memory: not counted as tonight's run, so the tick starts it again.
                setStatus(key, { at: now(), ms, error, running: null, ...(lowMemory ? { started: 0 } : {}) });
                log(`combat plan ${key}: ${error ? "failed: " + error : "done"} in ${ms} ms`);
                running.delete(key);
                if (again.delete(key)) start(key);
                resolve();
            });
        });
    }

    function start(key) {
        if (waiting.has(key)) return;
        if (running.has(key)) return void again.add(key);
        if (!ready(key)) return;
        waiting.add(key);
        const job = gate(() => run(key)).catch((error) => log(`combat plan ${key}:`, error)).finally(() => jobs.delete(job));
        jobs.add(job);
    }

    // Every few minutes: a character whose nightly run is due (and the Pi not loaded) is started.
    function tick() {
        if (busy() || lowForStart(memory())) return;
        const due = lastDue(now(), hour);
        for (const key of readdirSync(dir)) {
            if (!ready(key)) continue;
            if ((status(key).started || 0) < due) start(key);
        }
    }
    const timer = checkMs ? setInterval(tick, checkMs) : null;
    timer?.unref?.();

    // What a device sends: { character: { id }, settings, version, now }. Kept for the nightly run;
    // run at once with now, when the settings changed, or when there is no plan yet.
    function put(body) {
        if (!validBody(body)) return { ok: false, error: "character.id and settings" };
        const key = characterKey(body.character.id);
        mkdirSync(charDir(key), { recursive: true });
        const file = path.join(charDir(key), "settings.json");
        const before = readJson(file);
        const changed = JSON.stringify(before?.settings || null) !== JSON.stringify(body.settings);
        if (changed || !before) writeAtomic(file, JSON.stringify({ settings: body.settings, version: body.version || null, at: now() }));
        const first = !existsSync(path.join(charDir(key), "result.json"));
        const go = !!body.now || changed || first;
        if (go) start(key);
        return { ok: true, character: key, started: go && ready(key), loadouts: existsSync(loadoutsOf(key)) };
    }

    // The newest plan of a character, and how its run stands.
    function get(id) {
        const key = characterKey(id);
        const base = { hour };
        if (!key || !existsSync(charDir(key))) return { ...base, result: null, status: {} };
        const s = status(key);
        const isRunning = running.has(key);
        return {
            ...base,
            result: readJson(path.join(charDir(key), "result.json")),
            settings: readJson(path.join(charDir(key), "settings.json")),
            status: {
                at: s.at ?? null,
                ms: s.ms ?? null,
                error: s.error ?? null,
                running: isRunning ? s.running : null,
                queued: waiting.has(key) || again.has(key),
                progress: isRunning ? readJson(path.join(charDir(key), "progress.json")) : null,
                loadouts: existsSync(loadoutsOf(key)),
                next: lastDue(now(), hour) + DAY_MS,
            },
        };
    }

    return { put, get, tick, idle: () => Promise.all([...jobs]), stop: () => timer && clearInterval(timer) };
}
