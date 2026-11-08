// Simulation runs kept in the browser. Every job is seeded, so the same job (setup,
// zone or Labyrinth room, hours or rooms, seed) always gives the same result: a run
// done before – in this analysis, an earlier one, or before the page was reloaded –
// is taken from here instead of being simulated again. Prices are applied after the
// simulation, so a new price file doesn't touch what is kept.
//
// Kept in IndexedDB (localStorage is the game's and too small); runs not used for a
// while go first once there are more than MAX_ENTRIES. A new script version or game
// data patch starts afresh. Without IndexedDB (Node tests) it lives in memory.

import { scriptVersion } from "./version-tag.js";
import { engineTables } from "./game-data.js";

const DB_NAME = "mwia-sim-cache";
const RUNS = "runs"; // { key, result, telemetry?, used }
const META = "meta";
const MAX_ENTRIES = 20000; // a run is ~0.4 KB, ~0.8 KB with its measurements
const OLD_STORE = "mwia-sim-cache"; // the localStorage cache of v0.69 and earlier

let fingerprint = { tables: null, value: "" };
let memory = null; // Map key -> entry when there is no IndexedDB
let opening = null;

// cyrb53: a fast 53-bit string hash.
function hash(text) {
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < text.length; i++) {
        const ch = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

// The script version and the game data the workers simulate with.
function generation() {
    const tables = engineTables();
    const sameData = fingerprint.tables && Object.keys(tables).every((k) => tables[k] === fingerprint.tables[k]);
    if (!sameData) fingerprint = { tables, value: hash(JSON.stringify(tables)) };
    return scriptVersion() + "|" + fingerprint.value;
}

// The job as asked for, whether or not its run is to be measured.
export function jobKey(job) {
    const { telemetry, ...rest } = job;
    return hash(JSON.stringify(rest));
}

const request = (req) =>
    new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
const finished = (tx) =>
    new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });

function dropOldStore() {
    try {
        globalThis.localStorage?.removeItem(OLD_STORE);
    } catch {
        // no localStorage
    }
}

// The database, emptied when the generation changed; null without IndexedDB.
function open(gen) {
    opening ||= (async () => {
        dropOldStore();
        if (!globalThis.indexedDB) return null;
        try {
            const db = await new Promise((resolve, reject) => {
                const req = indexedDB.open(DB_NAME, 1);
                req.onupgradeneeded = () => {
                    const store = req.result.createObjectStore(RUNS, { keyPath: "key" });
                    store.createIndex("used", "used");
                    req.result.createObjectStore(META);
                };
                req.onsuccess = () => resolve(req.result);
                req.onerror = () => reject(req.error);
            });
            return { db, gen: null };
        } catch {
            return null; // blocked (private window etc.): simulate everything
        }
    })();
    return opening.then(async (state) => {
        if (!state || state.gen === gen) return state?.db || null;
        const tx = state.db.transaction(META, "readonly");
        const stored = await request(tx.objectStore(META).get("generation"));
        if (stored !== gen) {
            const wipe = state.db.transaction([RUNS, META], "readwrite");
            wipe.objectStore(RUNS).clear();
            wipe.objectStore(META).put(gen, "generation");
            await finished(wipe);
        }
        state.gen = gen;
        return state.db;
    });
}

async function lookup(db, keys) {
    if (!db) {
        memory ||= new Map();
        return keys.map((k) => (memory.has(k) ? structuredClone(memory.get(k)) : null));
    }
    const store = db.transaction(RUNS, "readonly").objectStore(RUNS);
    return Promise.all(keys.map((k) => request(store.get(k)).then((v) => v ?? null)));
}

// Writes the new runs and marks the ones used again, then trims the oldest.
async function store(db, entries) {
    if (!entries.length) return;
    if (!db) {
        memory ||= new Map();
        for (const e of entries) {
            memory.delete(e.key);
            memory.set(e.key, structuredClone(e));
        }
        while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value);
        return;
    }
    const tx = db.transaction(RUNS, "readwrite");
    const runs = tx.objectStore(RUNS);
    for (const e of entries) runs.put(e);
    const count = await request(runs.count());
    if (count > MAX_ENTRIES) {
        let excess = count - MAX_ENTRIES + Math.round(MAX_ENTRIES / 10); // a tenth of room, so it doesn't trim every time
        const cursor = runs.index("used").openKeyCursor();
        cursor.onsuccess = () => {
            const c = cursor.result;
            if (!c || excess-- <= 0) return;
            runs.delete(c.primaryKey);
            c.continue();
        };
    }
    await finished(tx);
}

let clock = 0;
const now = () => Math.max(Date.now(), ++clock);

// Runs the jobs on the pool, taking runs done before from the cache. A job with
// telemetry: true needs a kept run with its measurements. The same job twice in one
// call is simulated once. onProgress(done, total) counts kept runs as done at once.
export async function runCached(pool, jobs, onProgress) {
    let db = null;
    try {
        db = await open(generation());
    } catch {
        db = null;
    }
    const keys = jobs.map(jobKey);
    let found = [];
    try {
        found = await lookup(db, keys);
    } catch {
        found = keys.map(() => null);
    }
    const usable = (entry, job) => entry && (!job.telemetry || entry.telemetry);
    const toRun = [];
    const slotOf = new Map(); // key -> index in toRun
    const plan = jobs.map((job, i) => {
        if (usable(found[i], job)) return { entry: found[i] };
        const key = keys[i];
        if (!slotOf.has(key)) {
            slotOf.set(key, toRun.length);
            toRun.push(job);
        } else if (job.telemetry) toRun[slotOf.get(key)] = job; // measure it if any copy needs that
        return { run: slotOf.get(key) };
    });
    const kept = jobs.length - plan.filter((p) => p.run !== undefined).length;
    if (kept) onProgress?.(kept, jobs.length);
    const results = toRun.length ? await pool.runAll(toRun, (done) => onProgress?.(kept + done, kept + toRun.length)) : [];

    const used = now();
    const writes = new Map();
    const out = plan.map((p, i) => {
        if (p.entry) {
            writes.set(keys[i], { ...p.entry, used });
            const { result, telemetry } = p.entry;
            return jobs[i].telemetry ? { ...result, telemetry } : { ...result };
        }
        const { telemetry, ...result } = results[p.run];
        const entry = { key: keys[i], result, used };
        if (telemetry) entry.telemetry = telemetry;
        writes.set(keys[i], entry);
        return jobs[i].telemetry ? { ...result, telemetry } : { ...result };
    });
    // Writing must not hold up the analysis, nor fail it.
    store(db, [...writes.values()]).catch(() => {});
    return out;
}

// For tests: forget what is kept in memory.
export function clearMemoryCache() {
    memory = null;
}
