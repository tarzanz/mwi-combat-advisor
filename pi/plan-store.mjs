// The 📈 N-day plan on the Pi: what your devices send about the character (a
// snapshot: levels, XP, buffs, teas, tools, coins) and, after a game patch,
// the part of the game's data the plan needs; the plan is worked out from
// them and the Pi's usual prices by pi/planner.mjs, a process of its own at
// the lowest priority (nice 19), so it only takes the CPU nothing else wants
// and gives all its memory back when done. One plan at a time, at most every
// 4 hours (new snapshots and prices wait for the next run): 10 minutes after a
// snapshot when there is no plan yet or the game's data changed, at once when
// asked.
//
// data/plan/game-data.json            { hash, data }
// data/plan/prices.json               the usual prices, written before each run
// data/plan/<character>/snapshot.json what a device sent last
// data/plan/<character>/plan.json     the newest plan
// data/plan/<character>/status.json   { at, ms, error }

import { spawn } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export const MAX_SNAPSHOT_BYTES = 4 * 1024 * 1024;
const PLANNER = path.join(path.dirname(new URL(import.meta.url).pathname), "planner.mjs");
// The planner's heap: the game's data, the prices and its caches fit well within this.
const HEAP_MB = 384;
const LOWEST = 19;
const MAX_POSTPONE = 12;

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
// A character's folder name: its id as the game gives it, letters and digits only.
export const characterKey = (id) => {
    const key = String(id ?? "");
    return /^[A-Za-z0-9_-]{1,40}$/.test(key) ? key : null;
};

const validSnapshot = (s) =>
    s && typeof s === "object" && !Array.isArray(s)
    && s.who && typeof s.who === "object" && s.who.levels && typeof s.who.levels === "object"
    && Number.isFinite(Number(s.coins)) && characterKey(s.character?.id);

// typical({ plus }): the usual prices (history-store's typical; the plan asks for the +levels too). Options for the tests:
// delayMs (after a snapshot), soonMs (when asked to plan now), everyMs (between runs), busy() (true: wait).
export function openPlanStore(dataDir, { typical, log = () => {}, delayMs = 10 * 60 * 1000, soonMs = 5000, everyMs = 4 * 3600 * 1000, busy = () => os.loadavg()[0] > os.cpus().length, postponeMs = 10 * 60 * 1000 } = {}) {
    const dir = path.join(dataDir, "plan");
    mkdirSync(dir, { recursive: true });
    const dataFile = path.join(dir, "game-data.json");
    const pricesFile = path.join(dir, "prices.json");
    let dataHash = readJson(dataFile)?.hash || null;
    const timers = new Map();
    const queue = [];
    let running = null;

    const charDir = (key) => path.join(dir, key);
    const status = (key) => readJson(path.join(charDir(key), "status.json")) || {};
    const setStatus = (key, fields) => writeAtomic(path.join(charDir(key), "status.json"), JSON.stringify({ ...status(key), ...fields }));
    const characters = () => readdirSync(dir).filter((f) => characterKey(f) === f && existsSync(path.join(dir, f, "snapshot.json")));

    // The next run: everyMs after the last one, at least delayMs from now.
    const due = (key) => {
        const last = status(key).at;
        return Number.isFinite(last) ? Math.max(delayMs, last + everyMs - Date.now()) : delayMs;
    };

    function schedule(key, ms) {
        clearTimeout(timers.get(key));
        // Timers don't keep the process alive on their own (the server does).
        timers.set(key, setTimeout(() => enqueue(key), ms).unref());
        setStatus(key, { next: Date.now() + ms });
    }

    function enqueue(key, postponed = 0) {
        timers.delete(key);
        if (!queue.some((q) => q.key === key)) queue.push({ key, postponed });
        next();
    }

    function next() {
        if (running || !queue.length) return;
        const job = queue.shift();
        // A busy Pi waits a while (not forever: the plan runs at the lowest priority anyway).
        if (busy() && job.postponed < MAX_POSTPONE) {
            log(`plan ${job.key}: the Pi is busy, again in ${Math.round(postponeMs / 60000)} min`);
            timers.set(job.key, setTimeout(() => enqueue(job.key, job.postponed + 1), postponeMs).unref());
            return next();
        }
        running = run(job.key).finally(() => {
            running = null;
            next();
        });
    }

    function run(key) {
        return new Promise((resolve) => {
            const started = Date.now();
            if (!dataHash) {
                setStatus(key, { at: started, error: "no game data yet – open the game with the advisor once", next: null });
                return resolve();
            }
            writeAtomic(pricesFile, JSON.stringify({ at: started, prices: typical({ plus: true }) }));
            setStatus(key, { running: started, next: null });
            const child = spawn(process.execPath, [`--max-old-space-size=${HEAP_MB}`, PLANNER, charDir(key), dataFile, pricesFile], { stdio: ["ignore", "ignore", "pipe"] });
            try {
                os.setPriority(child.pid, LOWEST);
            } catch {
                // the planner lowers its own priority too
            }
            let stderr = "";
            child.stderr.on("data", (chunk) => {
                if (stderr.length < 4000) stderr += chunk;
            });
            child.on("close", (code) => {
                const ms = Date.now() - started;
                const error = code === 0 ? null : (stderr.trim().split("\n").filter(Boolean).pop() || `planner exit ${code}`).slice(0, 300);
                setStatus(key, { at: Date.now(), ms, error, running: null });
                log(`plan ${key}: ${error ? "failed: " + error : "done"} in ${ms} ms`);
                if (!timers.has(key)) schedule(key, everyMs);
                resolve();
            });
        });
    }

    // A device's snapshot (and the game's data when it changed). run: plan soon.
    function put(body) {
        const snapshot = body?.snapshot;
        if (!validSnapshot(snapshot)) return { ok: false, error: "snapshot: who, coins and character.id" };
        const key = characterKey(snapshot.character.id);
        const newData = !!body.data && body.data.hash !== dataHash;
        if (body.data) {
            if (typeof body.data.hash !== "string" || !body.data.data?.itemDetailMap || !body.data.data?.actionDetailMap) return { ok: false, error: "data: { hash, data }" };
            writeAtomic(dataFile, JSON.stringify(body.data));
            dataHash = body.data.hash;
        }
        mkdirSync(charDir(key), { recursive: true });
        writeAtomic(path.join(charDir(key), "snapshot.json"), JSON.stringify({ ...snapshot, received: Date.now() }));
        if (body.run) schedule(key, soonMs);
        else if (newData || !existsSync(path.join(charDir(key), "plan.json"))) schedule(key, delayMs);
        // While its plan is being worked out, the next run is set when it is done.
        else if (!(running && status(key).running)) schedule(key, due(key));
        return { ok: true, character: key, dataHash, needData: !dataHash || (snapshot.dataHash && snapshot.dataHash !== dataHash) };
    }

    // The newest plan of a character, and how it goes.
    function get(id) {
        const key = characterKey(id);
        if (!key || !existsSync(charDir(key))) return { plan: null, status: {}, dataHash };
        const s = status(key);
        return { plan: readJson(path.join(charDir(key), "plan.json")), status: { ...s, running: running && s.running ? s.running : null, queued: queue.some((q) => q.key === key) }, dataHash, snapshotAt: readJson(path.join(charDir(key), "snapshot.json"))?.at ?? null };
    }

    // After a restart: every character's plan when it is due (at least the delay from now).
    for (const key of characters()) schedule(key, due(key));

    return { put, get, status: () => ({ characters: characters().length, dataHash, running: !!running }), idle: () => (running || Promise.resolve()), runNow: (id) => enqueue(characterKey(id)) };
}
