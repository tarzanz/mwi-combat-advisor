// The Labyrinth's combat analyses worked out on your Pi every night (pi/labyrinth-combat-store.mjs
// runs src/labyrinth-combat.js): this sends what they start from – your loadouts as they are
// (gear, abilities, levels, buffs), the crates, the accuracy, budget and spending – whenever it
// changes, and the game's data once a game patch (gzipped), and reads the newest result back:
// "Check the rooms", "What should I improve?" and a "Build a loadout" for each loadout in use.
// Nothing is worked out in the browser for it; the result is read again after a reload.

import { getClientData } from "./game-data.js";
import { state } from "./game-state.js";
import { chosenCrates } from "./labyrinth.js";
import { onPiSync, piConfig, piStatus } from "./pi-sync.js";
import { skillingCharacter } from "./skilling.js";
import { scriptVersion } from "./version-tag.js";

const SENT_KEY = "mwia-laby-combat-sent"; // character -> { sig, at }
const MIN_SEND_MS = 10 * 60 * 1000; // a changed request goes at most this often
const POLL_MS = 15000;
const POLLS = 400; // a run asked for now is followed up to ~1h40
const ACCURACY_ORDER = ["fast", "normal", "thorough"];

const c = { deps: null, result: null, status: null, piHash: null, uploaded: null, error: "", reading: null, sending: null, dataSending: null, data: null, asked: 0, polls: 0, listeners: new Set() };

const characterId = () => state.character?.character?.id ?? null;
export const onCombatChange = (listener) => c.listeners.add(listener);
const notify = () => c.listeners.forEach((listener) => listener());

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

function sentLog() {
    try {
        return JSON.parse(localStorage.getItem(SENT_KEY) || "{}");
    } catch {
        return {};
    }
}
function markSent(id, sig) {
    try {
        localStorage.setItem(SENT_KEY, JSON.stringify({ ...sentLog(), [id]: { sig, at: Date.now() } }));
    } catch {
        // not kept: sent again after a reload
    }
}

// deps: setups() -> [{ id, name, profile }] (every combat and Labyrinth loadout), settings() -> the tab's
// settings, prepare() -> loads the game's data.
export function startLabyrinthCombat(deps) {
    c.deps = deps;
    // After each sync with the Pi: the game's data if the Pi lacks it, the request if it changed, the newest result.
    onPiSync(() => {
        if (!piStatus().labyrinth?.combat || characterId() === null) return;
        c.piHash = piStatus().labyrinth.combat.dataHash ?? null;
        update().catch((error) => console.warn("[MWI Advisor] Labyrinth on the Pi", error));
    });
}

async function update() {
    await c.deps.prepare?.().catch(() => {});
    if (!getClientData()) return;
    await sendData();
    await sendRequest(false);
    await readCombat();
}

// The game's data as sent: every table the client has (the engine's and the advisor's), with its hash.
function packedData() {
    const data = getClientData();
    if (!data) return null;
    if (c.data?.of !== data || !c.data.text) {
        const text = JSON.stringify(data);
        c.data = { of: data, hash: hash(text), text };
    }
    return c.data;
}

async function gzip(text) {
    if (typeof CompressionStream === "undefined") throw new Error("this browser can't compress the game's data for the Pi");
    const stream = new Blob([`{"hash":${JSON.stringify(c.data.hash)},"data":`, text, "}"]).stream().pipeThrough(new CompressionStream("gzip"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

function sendData() {
    const config = piConfig();
    // The Pi's hash comes with each sync, so it can be from before this page sent the data: what was sent here counts too.
    const sent = (hash) => hash === c.piHash || hash === c.uploaded;
    if (!config || !getClientData() || (c.data?.of === getClientData() && sent(c.data.hash))) return Promise.resolve();
    const packed = packedData();
    if (!packed || sent(packed.hash)) return Promise.resolve();
    c.dataSending ||= (async () => {
        try {
            const body = await gzip(packed.text);
            const response = await fetch(`${config.url}/labyrinth/combat/data`, {
                method: "POST",
                headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/octet-stream" },
                body,
                cache: "no-store",
                signal: AbortSignal.timeout?.(120000),
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            c.piHash = (await response.json()).dataHash ?? packed.hash;
            c.uploaded = packed.hash;
            packed.text = null; // the hash is kept; the text is made again if the Pi ever lacks it
        } catch (error) {
            c.error = `Sending the game's data to the Pi: ${error.message || error}`;
        } finally {
            c.dataSending = null;
        }
    })();
    return c.dataSending;
}

// A loadout as the Pi needs it: the inventory only for the gear in it (what you own is tried for free).
function slim(profile, data) {
    return { ...profile, inventory: (profile.inventory || []).filter((i) => data.itemDetailMap[i.hrid]?.equipmentDetail) };
}

// What the Pi works out from (null with why when something is missing).
export function labyrinthCombatRequest() {
    const data = getClientData();
    const character = state.character;
    if (!character || !data) return { error: "the game's data isn't loaded yet" };
    const setups = c.deps.setups();
    if (!setups.length) return { error: "no loadouts yet" };
    const settings = c.deps.settings();
    // At least the normal accuracy: the Pi has the night.
    const accuracy = ACCURACY_ORDER.indexOf(settings.accuracy) > ACCURACY_ORDER.indexOf("normal") ? settings.accuracy : "normal";
    const body = {
        setups: setups.map((s) => ({ id: String(s.id), name: s.name, profile: slim(s.profile, data) })),
        crates: chosenCrates(settings, character),
        settings: { accuracy, budget: Number(settings.budget) || 0, spending: settings.spending || "balanced" },
        who: skillingCharacter(character, state.items, data),
    };
    return { request: { character: { id: characterId(), name: character.character?.name || null }, version: scriptVersion(), ...body }, sig: hash(JSON.stringify(body)) };
}

// Sends the request when it changed (at most every 10 minutes), or at once with now: then the Pi works it out now.
export function sendRequest(now) {
    const config = piConfig();
    const id = characterId();
    if (!config || id === null) return Promise.resolve(false);
    c.sending ||= (async () => {
        try {
            const built = labyrinthCombatRequest();
            if (built.error) throw new Error(built.error);
            const last = sentLog()[id];
            if (!now && last?.sig === built.sig) return false;
            if (!now && last && Date.now() - last.at < MIN_SEND_MS) return false;
            const at = Date.now();
            const response = await fetch(`${config.url}/labyrinth/combat`, {
                method: "POST",
                headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
                body: JSON.stringify({ request: { ...built.request, at }, now: !!now }),
                cache: "no-store",
                signal: AbortSignal.timeout?.(60000),
            });
            if (response.status === 404 || response.status === 405) throw new Error("your Pi doesn't work out the Labyrinth yet – update it (git pull, docker compose up -d --build)");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const answer = await response.json();
            markSent(id, built.sig);
            c.error = "";
            if (now || answer.started) {
                c.asked = at;
                c.polls = 0;
                setTimeout(poll, POLL_MS);
            }
            return true;
        } catch (error) {
            if (now) c.error = `Asking the Pi: ${error.message || error}`;
            return false;
        } finally {
            c.sending = null;
            notify();
        }
    })();
    return c.sending;
}

// ▶ Work it out now: the game's data if needed, the request, a run at once.
export async function askCombatNow() {
    c.error = "";
    await c.deps.prepare?.();
    await sendData();
    await sendRequest(true);
}

function poll() {
    c.polls++;
    readCombat().then(() => {
        if (!c.asked) return;
        const done = c.result?.done && c.result.requestAt >= c.asked;
        if (done) c.asked = 0;
        else if (c.status?.error && !c.status.running && !c.status.queued) {
            c.error = `The Pi: ${c.status.error}`;
            c.asked = 0;
        } else if (c.polls >= POLLS) c.asked = 0;
        else setTimeout(poll, POLL_MS);
        notify();
    });
}

// Reads the newest result of this character from the Pi.
export function readCombat() {
    const config = piConfig();
    const id = characterId();
    if (!config || id === null) return Promise.resolve();
    c.reading ||= (async () => {
        try {
            const response = await fetch(`${config.url}/labyrinth/combat?character=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout?.(60000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const answer = await response.json();
            c.status = { ...(answer.status || {}), hour: answer.hour ?? null };
            c.piHash = answer.dataHash ?? c.piHash;
            const changed = answer.result && (answer.result.at !== c.result?.at || answer.result.stage !== c.result?.stage);
            if (answer.result) c.result = answer.result;
            if (changed) c.deps.onResult?.(c.result);
        } catch (error) {
            if (c.asked) c.error = `Reading from the Pi: ${error.message || error}`;
        } finally {
            c.reading = null;
            notify();
        }
    })();
    return c.reading;
}

// What the tab shows.
export function combatState() {
    return { linked: !!piConfig(), works: !!piStatus().labyrinth?.combat, result: c.result, status: c.status, error: c.error, waiting: c.asked > 0 || !!c.status?.running || !!c.status?.queued, sending: !!c.dataSending };
}
