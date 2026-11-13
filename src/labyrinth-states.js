// The Labyrinth as the game sends it, whole, for your Pi: every state of a run (each
// floor's rooms as they come into sight, are failed and cleared, the supplies left), with
// what you had then – your levels, the shop's upgrades, the Labyrinth settings and the
// supplies in your inventory. From these the Pi learns how a floor is laid out (room
// levels per floor, how often each room type comes, where the exit is) for the run
// simulation, and the attempt log can be checked against what really happened. Each
// state is kept once (by its content) and waits in this browser until the Pi has it.

const KEY = "mwia-laby-states";
// What waits for the Pi: at most this many characters, the oldest dropped first.
export const MAX_QUEUE_CHARS = 800 * 1000;
// A state bigger than this isn't kept (a floor of 8 × 8 rooms is far smaller).
export const MAX_STATE_CHARS = 60 * 1000;
const SUPPLY = /torch|shroud|beacon|_crate$/;

const s = { queue: null, last: undefined, listeners: new Set() };

// A short fingerprint of a text (FNV-1a, with its length).
export function fingerprint(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    return `${(h >>> 0).toString(16)}-${text.length.toString(36)}`;
}

function load() {
    if (s.queue) return s.queue;
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "null");
        s.queue = Array.isArray(saved?.queue) ? saved.queue : [];
        s.last = saved?.last ?? null;
    } catch {
        s.queue = [];
        s.last = null;
    }
    return s.queue;
}

function save() {
    const write = () => localStorage.setItem(KEY, JSON.stringify({ queue: s.queue, last: s.last }));
    try {
        write();
    } catch {
        // Storage full: the older half goes.
        s.queue.splice(0, Math.ceil(s.queue.length / 2));
        try {
            write();
        } catch {
            /* kept for this page only */
        }
    }
}

// What you had: levels, the shop's upgrades, the Labyrinth settings, the supplies you hold.
export function stateContext(character) {
    const levels = {};
    for (const skill of character?.characterSkills || []) levels[skill.skillHrid.split("/").pop()] = skill.level;
    const shop = {};
    for (const [k, v] of Object.entries(character?.characterInfo || {})) if (/^labyrinth/.test(k) && (Number.isFinite(v) || typeof v === "string" || typeof v === "boolean")) shop[k.slice(9)] = v;
    const setting = {};
    for (const [k, v] of Object.entries(character?.characterSetting || {})) if (/^labyrinth/i.test(k) && (v === null || typeof v !== "object")) setting[k] = v;
    const supplies = {};
    for (const item of character?.characterItems || []) {
        const name = String(item.itemHrid || "").split("/").pop();
        if (SUPPLY.test(name) && item.itemLocationHrid === "/item_locations/inventory") supplies[name] = (supplies[name] || 0) + (item.count || 0);
    }
    return { levels, shop, setting, supplies };
}

// Keeps a state of the Labyrinth for the Pi, unless it is the one kept last: whether it was new.
// late: it came with the login, so it may have changed while the game was closed.
export function recordState(labyrinth, character, late = false, now = Date.now()) {
    if (!labyrinth || typeof labyrinth !== "object") return false;
    const text = JSON.stringify(labyrinth);
    if (text.length > MAX_STATE_CHARS) return false;
    const queue = load();
    const uid = [labyrinth.characterID ?? character?.character?.id ?? "", labyrinth.startedAt || "", fingerprint(text)].join("|");
    if (uid === s.last) return false;
    s.last = uid;
    // Nothing to learn from "no run" before any run was seen.
    if (!labyrinth.isActive && !Array.isArray(labyrinth.roomData) && !queue.length) {
        save();
        return false;
    }
    queue.push({ uid, at: now, late: !!late, labyrinth, ...stateContext(character) });
    let size = queue.reduce((sum, q) => sum + (q.chars ||= JSON.stringify(q).length), 0);
    while (queue.length > 1 && size > MAX_QUEUE_CHARS) size -= queue.shift().chars;
    save();
    for (const fn of s.listeners) fn();
    return true;
}

export const onStatesChanged = (fn) => s.listeners.add(fn);

// For pi-sync.js: what waits, and what the Pi has taken.
export const statesForPi = () => load().map(({ chars: _chars, ...state }) => state);
export function statesSentToPi(uids) {
    const sent = new Set(uids);
    s.queue = load().filter((q) => !sent.has(q.uid));
    save();
}
