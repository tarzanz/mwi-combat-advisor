// A log of your Labyrinth attempts, to follow up later: every room fought or skilled,
// whether it was won, lost (the room's fail count went up) or shrouded, with what you
// had at the time – your levels, the loadout chosen for that room in the game's
// automation (and what you wore), the crates, the shop's upgrades – and the chance the
// advisor gave it. Worked out from the game's own Labyrinth messages, as each room's
// state changes; what happened while the game was closed is found on the next login
// (marked late: your gear and levels then are the ones last seen). Kept in this browser
// (the newest MAX_KEPT) and sent to your Pi when it takes them (pi/labyrinth-store.mjs).

import { onStateChange, state } from "./game-state.js";
import { COMBAT_SKILLS } from "./profile.js";

const KEY = "mwia-laby-attempts";
const PREV_KEY = "mwia-laby-prev";
export const MAX_KEPT = 600;
const SKILLING = "/labyrinth_room_types/skilling";
const FAIL = /fail/i;
const REFRESH_MS = 2000;

const g = { log: null, prev: undefined, predict: null, timer: null, listeners: new Set() };

// ---------- the rooms' changes ----------

// A room's fails as the game counts them: its numeric fields named fail-something.
export function failsOf(room) {
    let n = 0;
    for (const [k, v] of Object.entries(room || {})) if (FAIL.test(k) && Number.isFinite(v)) n += v;
    return n;
}

const roomKey = (room) => room?.monsterHrid || room?.skillHrid || "";

// What happened to each room between two states of the same run and floor: wins (cleared),
// losses (one per fail more) and shrouds (cleared while as many shrouds went). Rooms out of
// sight (null) or with nothing to fight are left out.
export function roomOutcomes(before, after) {
    if (!before?.roomData || !after?.roomData) return [];
    if (before.currentFloor !== after.currentFloor || (before.startedAt && after.startedAt && before.startedAt !== after.startedAt)) return [];
    const out = [];
    after.roomData.forEach((row, r) => (row || []).forEach((room, c) => {
        const was = before.roomData[r]?.[c];
        if (!room || !was || !roomKey(room) || roomKey(room) !== roomKey(was) || was.isCleared) return;
        const failsBefore = failsOf(was);
        const fails = failsOf(room);
        for (let f = failsBefore + 1; f <= fails; f++) out.push({ row: r, col: c, room, outcome: "loss", fails: f, failsBefore: f - 1 });
        if (room.isCleared) out.push({ row: r, col: c, room, outcome: "win", fails, failsBefore });
    }));
    // Cleared while shrouds went: as many cleared rooms as shrouds used are shrouded; with more, it can't be told.
    const used = (Number(before.shroudCount) || 0) - (Number(after.shroudCount) || 0);
    const cleared = out.filter((x) => x.outcome === "win");
    if (used > 0) for (const x of cleared) x.outcome = cleared.length <= used ? "shroud" : "cleared";
    return out;
}

// ---------- what you had ----------

const normal = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

// The loadout the game's automation puts on for a room: its setting labyrinthLoadout<Name>.
export function roomLoadoutId(setting, room) {
    const name = normal(roomKey(room).split("/").pop());
    if (!name || !setting) return null;
    for (const [k, v] of Object.entries(setting)) if (k.startsWith("labyrinthLoadout") && normal(k.slice(16)) === name) return v;
    return null;
}

// "hrid+level" from a loadout's item hash (…::/items/x::3).
function hashItem(hash) {
    const parts = String(hash || "").split("::");
    const hrid = parts.find((p) => p.startsWith("/items/"));
    if (!hrid) return null;
    const last = parts[parts.length - 1];
    return `${hrid}+${/^\d+$/.test(last) ? last : 0}`;
}

function loadoutOf(character, id) {
    const l = id ? character?.characterLoadoutMap?.[id] : null;
    if (!l) return null;
    const gear = {};
    for (const [location, hash] of Object.entries(l.wearableMap || {})) {
        const item = hashItem(hash);
        if (item) gear[location.split("/").pop()] = item;
    }
    return { id: String(id), name: l.name || "Loadout", gear, abilities: Object.values(l.abilityMap || {}).filter(Boolean), food: (l.foodItemHrids || []).filter(Boolean), drinks: (l.drinkItemHrids || []).filter(Boolean) };
}

function worn(character) {
    const gear = {};
    for (const item of character?.characterItems || []) {
        const at = item.itemLocationHrid;
        if (!at || at === "/item_locations/inventory" || !(item.count ?? 1)) continue;
        gear[at.split("/").pop()] = `${item.itemHrid}+${item.enhancementLevel || 0}`;
    }
    return gear;
}

// Everything about you an attempt keeps, as of now.
function snapshot(labyrinth, character) {
    const levels = {};
    for (const s of character?.characterSkills || []) levels[s.skillHrid.split("/").pop()] = s.level;
    const info = character?.characterInfo || {};
    const shop = {};
    for (const [k, v] of Object.entries(info)) if (/^labyrinth/.test(k) && Number.isFinite(v)) shop[k.slice(9)] = v;
    const predictions = {};
    if (g.predict) {
        labyrinth.roomData.forEach((row, r) => (row || []).forEach((room, c) => {
            if (!room || room.isCleared || !roomKey(room)) return;
            try {
                const p = g.predict(room, labyrinth);
                if (p) predictions[`${r},${c}`] = p;
            } catch {
                /* no prediction */
            }
        }));
    }
    return {
        at: Date.now(),
        labyrinth,
        levels,
        worn: worn(character),
        setting: character?.characterSetting || null,
        loadouts: character?.characterLoadoutMap || null,
        shop,
        predictions,
    };
}

function record(x, snap, now, late) {
    const lab = snap.labyrinth;
    const skilling = x.room.roomType === SKILLING || !!x.room.skillHrid;
    const skill = skilling ? x.room.skillHrid.split("/").pop() : null;
    const levels = {};
    for (const s of skilling ? [skill] : COMBAT_SKILLS) if (snap.levels[s] !== undefined) levels[s] = snap.levels[s];
    const loadoutId = roomLoadoutId(snap.setting, x.room);
    // A combat room's chance is for the loadout the check found best (forChosen: the one chosen).
    const predicted = snap.predictions[`${x.row},${x.col}`] || null;
    return {
        uid: [lab.characterID, lab.startedAt || "", lab.currentFloor, x.row, x.col, x.outcome === "loss" ? "loss" : "end", x.fails].join("|"),
        at: now,
        late: !!late,
        floor: lab.currentFloor,
        row: x.row,
        col: x.col,
        type: skilling ? "skilling" : "combat",
        what: skilling ? skill : x.room.monsterHrid.split("/").pop(),
        level: x.room.recommendedLevel,
        outcome: x.outcome,
        fails: x.fails,
        levels,
        loadout: loadoutId ? loadoutOf({ characterLoadoutMap: snap.loadouts }, loadoutId) || { id: String(loadoutId) } : null,
        worn: snap.worn,
        crates: { tea: lab.teaCrateItemHrid || null, coffee: lab.coffeeCrateItemHrid || null, food: lab.foodCrateItemHrid || null },
        shop: snap.shop,
        predicted: predicted && predicted.how === "check" ? { ...predicted, forChosen: String(predicted.best) === String(loadoutId) } : predicted,
        run: lab.startedAt || null,
    };
}

// ---------- kept here, sent to the Pi ----------

function load() {
    try {
        const saved = JSON.parse(localStorage.getItem(KEY) || "null");
        if (saved && Array.isArray(saved.list)) return { list: saved.list, unsent: saved.unsent || [], piSeq: saved.piSeq || 0 };
    } catch {
        /* start over */
    }
    return { list: [], unsent: [], piSeq: 0 };
}

const log = () => (g.log ||= load());

function save() {
    const L = log();
    try {
        localStorage.setItem(KEY, JSON.stringify(L));
    } catch {
        L.list.splice(0, Math.ceil(L.list.length / 3));
        try {
            localStorage.setItem(KEY, JSON.stringify(L));
        } catch {
            /* kept for this page only */
        }
    }
}

// Adds attempts not kept yet (by uid), the newest MAX_KEPT kept: how many were new.
export function addAttempts(attempts, { fromPi = false } = {}) {
    const L = log();
    const have = new Set(L.list.map((a) => a.uid));
    let added = 0;
    for (const a of attempts) {
        if (!a?.uid || have.has(a.uid)) continue;
        have.add(a.uid);
        L.list.push(a);
        if (!fromPi) L.unsent.push(a.uid);
        added++;
    }
    if (!added) return 0;
    L.list.sort((a, b) => a.at - b.at);
    if (L.list.length > MAX_KEPT) L.list.splice(0, L.list.length - MAX_KEPT);
    const kept = new Set(L.list.map((a) => a.uid));
    L.unsent = L.unsent.filter((u) => kept.has(u));
    save();
    for (const fn of g.listeners) fn();
    return added;
}

export const labyrinthAttempts = () => log().list;
export const onAttemptsChanged = (fn) => g.listeners.add(fn);

// For pi-sync.js.
export function attemptsForPi() {
    const L = log();
    const unsent = new Set(L.unsent);
    return L.list.filter((a) => unsent.has(a.uid));
}
export function attemptsSentToPi(uids) {
    const L = log();
    const sent = new Set(uids);
    L.unsent = L.unsent.filter((u) => !sent.has(u));
    save();
}
export const attemptsPiSeq = () => log().piSeq;
export function attemptsFromPi(wire) {
    if (!Array.isArray(wire?.attempts)) return;
    addAttempts(wire.attempts.map((x) => x.attempt).filter(Boolean), { fromPi: true });
    const L = log();
    if (Number.isFinite(wire.seq)) {
        L.piSeq = wire.seq;
        save();
    }
}

// ---------- listening ----------

function loadPrev() {
    if (g.prev === undefined) {
        try {
            g.prev = JSON.parse(localStorage.getItem(PREV_KEY) || "null");
        } catch {
            g.prev = null;
        }
    }
    return g.prev;
}

function keepPrev(snap) {
    g.prev = snap;
    try {
        if (snap) localStorage.setItem(PREV_KEY, JSON.stringify(snap));
        else localStorage.removeItem(PREV_KEY);
    } catch {
        /* kept for this page only */
    }
}

function onLabyrinth(labyrinth, late) {
    const prev = loadPrev();
    if (prev?.labyrinth && labyrinth) {
        const now = Date.now();
        const found = roomOutcomes(prev.labyrinth, labyrinth).map((x) => record(x, prev, now, late));
        if (found.length) addAttempts(found);
    }
    keepPrev(labyrinth?.isActive && Array.isArray(labyrinth.roomData) ? snapshot(labyrinth, state.character) : null);
}

// What you have is taken again a little after anything changes (a loadout chosen, gear,
// levels, a new check), so an attempt keeps what you had just before it – not what its
// own XP or loot changed, which arrives with it.
function refreshSoon() {
    clearTimeout(g.timer);
    g.timer = setTimeout(() => {
        try {
            const lab = state.labyrinth;
            if (lab?.isActive && Array.isArray(lab.roomData) && loadPrev()?.labyrinth) keepPrev(snapshot(lab, state.character));
        } catch (error) {
            console.warn("[MWI Advisor] labyrinth log", error);
        }
    }, REFRESH_MS);
}

// deps: predict(room, labyrinth) -> the advisor's chance for a room, { win, ... } or null.
export function startLabyrinthLog(deps) {
    g.predict = deps.predict;
    onStateChange((type) => {
        try {
            if (type === "init_character_data") onLabyrinth(state.labyrinth, true);
            else if (type === "labyrinth_updated") onLabyrinth(state.labyrinth, false);
            else if (state.labyrinth?.isActive) refreshSoon();
        } catch (error) {
            console.warn("[MWI Advisor] labyrinth log", error);
        }
    });
    if (state.character) onLabyrinth(state.labyrinth, true);
}

// A new check in the advisor: its chances count from now on.
export const labyrinthCheckChanged = () => state.labyrinth?.isActive && refreshSoon();

// ---------- the summary ----------

// Per room type (monster or skill): tries, wins, losses, shrouds, the share won and the
// advisor's average chance for those tries; the busiest first.
export function attemptSummary(list = labyrinthAttempts()) {
    const by = new Map();
    for (const a of list) {
        const k = `${a.type}|${a.what}`;
        const s = by.get(k) || { type: a.type, what: a.what, tries: 0, wins: 0, losses: 0, shrouds: 0, predicted: 0, predictedN: 0, levels: [], last: 0 };
        if (a.outcome === "loss") s.losses++;
        else if (a.outcome === "win") s.wins++;
        else s.shrouds++;
        if (a.outcome === "loss" || a.outcome === "win") {
            s.tries++;
            s.levels.push(a.level);
            if (Number.isFinite(a.predicted?.win)) {
                s.predicted += a.predicted.win;
                s.predictedN++;
            }
        }
        s.last = Math.max(s.last, a.at);
        by.set(k, s);
    }
    return [...by.values()]
        .map((s) => ({ ...s, won: s.tries ? s.wins / s.tries : null, predicted: s.predictedN ? s.predicted / s.predictedN : null, minLevel: s.levels.length ? Math.min(...s.levels) : null, maxLevel: s.levels.length ? Math.max(...s.levels) : null }))
        .sort((a, b) => b.tries - a.tries || b.last - a.last);
}
