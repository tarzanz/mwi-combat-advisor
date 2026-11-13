// Whole Labyrinth runs, simulated on the Pi when a device asks: how far the torches take
// the character, and which skill, shop upgrade, supply or setting takes it further. The
// device sends what the simulation starts from (levels and buffs per skill, the combat
// rooms' win curves from its last check, supplies, the shop's upgrades, the automation
// settings); pi/labyrinth-sim.mjs works it out in a process of its own at the lowest
// priority, with the floors learned from the game's Labyrinth states kept here
// (labyrinth-store.mjs). One job at a time, never beside the 📈 plan (gate).
//
// data/labyrinth/sim/<character>/request.json  what a device sent last
// data/labyrinth/sim/<character>/result.json   the newest result
// data/labyrinth/sim/<character>/status.json   { at, ms, error, running }

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { characterKey } from "./plan-store.mjs";

export const MAX_SIM_BYTES = 1024 * 1024;
const RUNNER = path.join(path.dirname(new URL(import.meta.url).pathname), "labyrinth-sim.mjs");
const HEAP_MB = 256;
const LOWEST = 19;

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

const validRequest = (r) => r && typeof r === "object" && !Array.isArray(r) && characterKey(r.character?.id)
    && r.skills && typeof r.skills === "object" && Array.isArray(r.combat?.monsters) && r.combat.monsters.length > 0;

// gate(job): runs the job when the Pi's other heavy jobs are done.
export function openLabyrinthSim(dataDir, { log = () => {}, gate = (job) => job() } = {}) {
    const dir = path.join(dataDir, "labyrinth", "sim");
    mkdirSync(dir, { recursive: true });
    const waiting = new Set(); // characters asked for, not started yet
    const running = new Set();
    const again = new Set(); // asked for again while running
    const jobs = new Set();

    const charDir = (key) => path.join(dir, key);
    const status = (key) => readJson(path.join(charDir(key), "status.json")) || {};
    const setStatus = (key, fields) => writeAtomic(path.join(charDir(key), "status.json"), JSON.stringify({ ...status(key), ...fields }));

    function run(key) {
        return new Promise((resolve) => {
            const started = Date.now();
            waiting.delete(key);
            running.add(key);
            setStatus(key, { running: started });
            const child = spawn(process.execPath, [`--max-old-space-size=${HEAP_MB}`, RUNNER, charDir(key), dataDir], { stdio: ["ignore", "ignore", "pipe"] });
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
                const ms = Date.now() - started;
                const lines = stderr.trim().split("\n").filter(Boolean);
                const error = code === 0 ? null : (lines.find((l) => /^Error: /.test(l))?.slice(7) || lines.pop() || `exit ${code}`).slice(0, 300);
                setStatus(key, { at: Date.now(), ms, error, running: null });
                log(`labyrinth runs ${key}: ${error ? "failed: " + error : "done"} in ${ms} ms`);
                running.delete(key);
                if (again.delete(key)) start(key);
                resolve();
            });
        });
    }

    function start(key) {
        if (waiting.has(key)) return;
        if (running.has(key)) return void again.add(key);
        waiting.add(key);
        const job = gate(() => run(key)).catch((error) => log(`labyrinth runs ${key}:`, error)).finally(() => jobs.delete(job));
        jobs.add(job);
    }

    // What a device sends: { request }. The simulation starts at once (after the Pi's other heavy jobs).
    function put(body) {
        const request = body?.request;
        if (!validRequest(request)) return { ok: false, error: "request: character.id, skills and combat.monsters" };
        const key = characterKey(request.character.id);
        mkdirSync(charDir(key), { recursive: true });
        writeAtomic(path.join(charDir(key), "request.json"), JSON.stringify({ ...request, received: Date.now() }));
        start(key);
        return { ok: true, character: key };
    }

    // The newest result of a character, and how its job stands.
    function get(id) {
        const key = characterKey(id);
        if (!key || !existsSync(charDir(key))) return { result: null, status: {} };
        const s = status(key);
        return { result: readJson(path.join(charDir(key), "result.json")), status: { at: s.at ?? null, ms: s.ms ?? null, error: s.error ?? null, running: running.has(key) ? s.running : null, queued: waiting.has(key) || again.has(key) } };
    }

    return { put, get, idle: () => Promise.all([...jobs]) };
}
