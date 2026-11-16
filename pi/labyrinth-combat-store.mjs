// The Labyrinth's combat analyses on the Pi, once a night: "Check the rooms", "What should
// I improve?" and "Build a loadout" for each loadout in use (src/labyrinth-combat.js), from
// what a device sent last – the loadouts, the crates, the settings (labyrinth-combat-sync.js).
// dist/pi-labyrinth-combat.mjs works it out in a process of its own at the lowest priority,
// never beside the Pi's other heavy jobs (gate). A device can ask for a run now too.
//
// data/labyrinth/combat/game-data.json.gz   the game's data as a device sent it (gzipped { hash, data })
// data/labyrinth/combat/game-data.hash      its hash
// data/labyrinth/combat/<character>/request.json   what a device sent last
// data/labyrinth/combat/<character>/result.json    the newest result (written as each part is done)
// data/labyrinth/combat/<character>/progress.json  how far a run has got
// data/labyrinth/combat/<character>/status.json    { started, at, ms, error }

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { characterKey } from "./plan-store.mjs";

export const MAX_COMBAT_BYTES = 3 * 1024 * 1024;
export const MAX_COMBAT_DATA_BYTES = 8 * 1024 * 1024;
const here = path.dirname(new URL(import.meta.url).pathname);
const RUNNER = path.join(here, "..", "dist", "pi-labyrinth-combat.mjs");
const HEAP_MB = 384;
const LOWEST = 19;
const DAY_MS = 24 * 3600 * 1000;

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

const validRequest = (r) =>
    r && typeof r === "object" && !Array.isArray(r) && characterKey(r.character?.id) && Array.isArray(r.setups) && r.setups.length > 0 && r.setups.length <= 20
    && r.setups.every((s) => s && typeof s.id === "string" && s.profile && typeof s.profile === "object" && s.profile.levels && Array.isArray(s.profile.abilities));

// The last time the nightly run was due (hour in UTC), at or before now.
export function lastDue(now, hour) {
    const d = new Date(now);
    const due = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hour);
    return due <= now ? due : due - DAY_MS;
}

// hour: when the nightly run starts (UTC); gate(job): runs the job when the Pi's other heavy jobs are done;
// busy(): true while the Pi is loaded (the run waits); runner/args for the tests.
export function openLabyrinthCombat(dataDir, { log = () => {}, gate = (job) => job(), hour = 3, checkMs = 10 * 60 * 1000, busy = () => os.loadavg()[0] > os.cpus().length, now = () => Date.now(), runner = RUNNER, rawDir = path.join(dataDir, "raw"), workers = null } = {}) {
    const dir = path.join(dataDir, "labyrinth", "combat");
    mkdirSync(dir, { recursive: true });
    const dataFile = path.join(dir, "game-data.json.gz");
    const hashFile = path.join(dir, "game-data.hash");
    let dataHash = existsSync(hashFile) ? readFileSync(hashFile, "utf8").trim() || null : null;
    const waiting = new Set();
    const running = new Set();
    const again = new Set();
    const jobs = new Set();

    const charDir = (key) => path.join(dir, key);
    const status = (key) => readJson(path.join(charDir(key), "status.json")) || {};
    const setStatus = (key, fields) => writeAtomic(path.join(charDir(key), "status.json"), JSON.stringify({ ...status(key), ...fields }));

    function run(key) {
        return new Promise((resolve) => {
            const started = now();
            waiting.delete(key);
            running.add(key);
            setStatus(key, { started, running: started });
            const env = { ...process.env, ...(workers ? { MWIA_LAB_COMBAT_WORKERS: String(workers) } : {}) };
            const child = spawn(process.execPath, [`--max-old-space-size=${HEAP_MB}`, runner, charDir(key), dataFile, rawDir], { stdio: ["ignore", "ignore", "pipe"], env });
            try {
                os.setPriority(child.pid, LOWEST);
            } catch {
                // the runner lowers its own priority too
            }
            let stderr = "";
            child.stderr.on("data", (chunk) => {
                if (stderr.length < 4000) stderr += chunk;
            });
            child.on("close", (code) => {
                const ms = now() - started;
                const lines = stderr.trim().split("\n").filter(Boolean);
                const error = code === 0 ? null : (lines.find((l) => /Error: /.test(l))?.replace(/^.*?Error: /, "") || lines.pop() || `exit ${code}`).slice(0, 300);
                setStatus(key, { at: now(), ms, error, running: null });
                log(`labyrinth combat ${key}: ${error ? "failed: " + error : "done"} in ${ms} ms`);
                running.delete(key);
                if (again.delete(key)) start(key);
                resolve();
            });
        });
    }

    function start(key) {
        if (waiting.has(key)) return;
        if (running.has(key)) return void again.add(key);
        if (!dataHash || !existsSync(path.join(charDir(key), "request.json"))) return;
        waiting.add(key);
        const job = gate(() => run(key)).catch((error) => log(`labyrinth combat ${key}:`, error)).finally(() => jobs.delete(job));
        jobs.add(job);
    }

    // Every few minutes: a character whose nightly run is due (and the Pi not loaded) is started.
    function tick() {
        if (busy()) return;
        const due = lastDue(now(), hour);
        for (const key of readdirSync(dir)) {
            if (!existsSync(path.join(charDir(key), "request.json"))) continue;
            if ((status(key).started || 0) < due) start(key);
        }
    }
    const timer = checkMs ? setInterval(tick, checkMs) : null;
    timer?.unref?.();

    // The game's data from a device: the gzipped bytes of { hash, data }.
    function putData(bytes) {
        let parsed;
        try {
            parsed = JSON.parse(gunzipSync(bytes).toString("utf8"));
        } catch {
            return { ok: false, error: "data: gzipped JSON" };
        }
        const data = parsed?.data;
        if (typeof parsed?.hash !== "string" || !data?.itemDetailMap || !data?.combatMonsterDetailMap || !data?.abilityDetailMap) return { ok: false, error: "data: { hash, data } with the game's tables" };
        writeFileSync(dataFile + ".tmp", bytes);
        renameSync(dataFile + ".tmp", dataFile);
        writeAtomic(hashFile, parsed.hash);
        dataHash = parsed.hash;
        // A character that has never been worked out goes now that there is data.
        for (const key of readdirSync(dir)) if (existsSync(path.join(charDir(key), "request.json")) && !existsSync(path.join(charDir(key), "result.json"))) start(key);
        return { ok: true, dataHash };
    }

    // What a device sends: { request, now }. Kept for the nightly run; run at once with now
    // (or when the character has no result yet).
    function put(body) {
        const request = body?.request;
        if (!validRequest(request)) return { ok: false, error: "request: character.id and setups [{ id, profile }]" };
        const key = characterKey(request.character.id);
        mkdirSync(charDir(key), { recursive: true });
        writeAtomic(path.join(charDir(key), "request.json"), JSON.stringify({ ...request, received: now() }));
        const first = !existsSync(path.join(charDir(key), "result.json")) && !running.has(key) && !waiting.has(key);
        if (body.now || first) start(key);
        return { ok: true, character: key, dataHash, started: (body.now || first) && !!dataHash };
    }

    // The newest result of a character, and how its run stands.
    function get(id) {
        const key = characterKey(id);
        const base = { dataHash, hour };
        if (!key || !existsSync(charDir(key))) return { ...base, result: null, status: {} };
        const s = status(key);
        const request = readJson(path.join(charDir(key), "request.json"));
        const isRunning = running.has(key);
        return {
            ...base,
            result: readJson(path.join(charDir(key), "result.json")),
            status: {
                at: s.at ?? null,
                ms: s.ms ?? null,
                error: s.error ?? null,
                running: isRunning ? s.running : null,
                queued: waiting.has(key) || again.has(key),
                progress: isRunning ? readJson(path.join(charDir(key), "progress.json")) : null,
                requestAt: request?.at ?? null,
                next: lastDue(now(), hour) + DAY_MS,
            },
        };
    }

    return { put, putData, get, tick, dataHash: () => dataHash, idle: () => Promise.all([...jobs]), stop: () => timer && clearInterval(timer) };
}
