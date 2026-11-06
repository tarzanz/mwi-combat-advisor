// Simulation results kept in the browser, so a run with the very same setup, zone,
// hours and seed is not simulated again: runs are seeded, so the result would be the
// same. Used for trigger variants, which come back unchanged as long as the gear does.
// The key holds the script version and a fingerprint of the game data, so a new
// version or patch starts afresh. Without localStorage (Node tests) it lives in memory.

import { scriptVersion } from "./version-tag.js";

const STORE = "mwia-sim-cache";
const MAX_ENTRIES = 1500;

let memory = null; // Map key -> result, oldest first
let fingerprint = { data: null, value: "" };

function storage() {
    try {
        return globalThis.localStorage || null;
    } catch {
        return null;
    }
}

function load() {
    if (memory) return memory;
    memory = new Map();
    try {
        const saved = JSON.parse(storage()?.getItem(STORE) || "null");
        if (Array.isArray(saved)) for (const [k, v] of saved) memory.set(k, v);
    } catch {
        // a broken store starts afresh
    }
    return memory;
}

let saveTimer = null;
function save() {
    if (saveTimer || !storage()) return;
    saveTimer = setTimeout(() => {
        saveTimer = null;
        try {
            storage().setItem(STORE, JSON.stringify([...load()]));
        } catch {
            // full: keep the newer half
            const entries = [...load()];
            memory = new Map(entries.slice(entries.length >> 1));
            try {
                storage().setItem(STORE, JSON.stringify([...memory]));
            } catch {
                // give up on keeping it this time
            }
        }
    }, 500);
}

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

function dataFingerprint(data) {
    if (fingerprint.data !== data) {
        const tables = ["abilityDetailMap", "combatMonsterDetailMap", "actionDetailMap", "itemDetailMap"].map((k) => JSON.stringify(data?.[k] || null));
        fingerprint = { data, value: hash(tables.join("|")) };
    }
    return fingerprint.value;
}

export function jobKey(job, data) {
    return hash(scriptVersion() + "|" + dataFingerprint(data) + "|" + JSON.stringify(job));
}

export function cachedResult(key) {
    const map = load();
    if (!map.has(key)) return null;
    const value = map.get(key);
    map.delete(key); // most recently used goes last
    map.set(key, value);
    return structuredClone(value);
}

export function cacheResult(key, result) {
    const map = load();
    const { telemetry, ...kept } = result;
    map.delete(key);
    map.set(key, kept);
    while (map.size > MAX_ENTRIES) map.delete(map.keys().next().value);
    save();
}
