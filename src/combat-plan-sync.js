// ⚔ The combat plan worked out on your Pi every night (pi/combat-plan-store.mjs runs
// src/combat-plan.js): this sends the plan's settings (style, days, reserve …) when they change
// and reads the newest plan back. The loadouts and the game's data go with the Labyrinth's
// requests (labyrinth-combat-sync.js), the coins and skilling's gold with the 📈 plan's
// snapshot (horizon-sync.js), so nothing else is sent. The plan is kept over a reload.

import { state } from "./game-state.js";
import { onPiSync, piConfig, piStatus } from "./pi-sync.js";
import { scriptVersion } from "./version-tag.js";

const KEPT_KEY = "mwia-combat-plan"; // character -> { result, status, sent }
const POLL_MS = 15000;
const POLLS = 400; // a run asked for now is followed up to ~1h40

const c = { deps: null, result: null, status: null, sent: null, error: "", reading: null, sending: null, asked: 0, polls: 0, listeners: new Set(), loaded: null };

const characterId = () => state.character?.character?.id ?? null;
export const onCombatPlanChange = (listener) => c.listeners.add(listener);
const notify = () => c.listeners.forEach((listener) => listener());

// The plan's settings from the advisor's: what the Pi plans with.
export function combatPlanOptions(settings) {
    return {
        style: settings.cplanStyle || "magic",
        meleeType: settings.cplanMelee || "any",
        days: Number(settings.cplanDays) || 30,
        reserve: Number(settings.cplanReserve ?? 5e6) || 0,
        charms: !!settings.cplanCharms,
        setupId: settings.cplanSetup || "auto",
        acceptRareDeaths: !!settings.acceptRareDeaths,
    };
}

function kept() {
    try {
        return JSON.parse(localStorage.getItem(KEPT_KEY) || "{}") || {};
    } catch {
        return {};
    }
}
function keep() {
    const id = characterId();
    if (id === null) return;
    try {
        localStorage.setItem(KEPT_KEY, JSON.stringify({ ...kept(), [id]: { result: c.result, status: c.status, sent: c.sent } }));
    } catch {
        // kept for this page only
    }
}
function restore() {
    const id = characterId();
    if (id === null || c.loaded === id) return;
    c.loaded = id;
    const entry = kept()[id];
    c.result = entry?.result || null;
    c.status = entry?.status || null;
    c.sent = entry?.sent || null;
}

// deps: settings() -> the advisor's settings.
export function startCombatPlan(deps) {
    c.deps = deps;
    onPiSync(() => {
        if (!piStatus().combatPlan || characterId() === null) return;
        restore();
        sendSettings(false)
            .then(() => readCombatPlan())
            .catch((error) => console.warn("[MWI Advisor] combat plan on the Pi", error));
    });
}

// Sends the settings when they changed since the last send, or at once with now (then the Pi works it out now).
// Sends go one after another: a change made while one is under way is sent after it.
export function sendSettings(now) {
    const config = piConfig();
    const id = characterId();
    if (!config || id === null) return Promise.resolve(false);
    restore();
    const mine = (c.sending || Promise.resolve()).then(async () => {
        try {
            const settings = combatPlanOptions(c.deps.settings());
            const sig = JSON.stringify(settings);
            if (!now && c.sent === sig) return false;
            const at = Date.now();
            const response = await fetch(`${config.url}/combat-plan`, {
                method: "POST",
                headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
                body: JSON.stringify({ character: { id, name: state.character.character?.name || null }, settings, version: scriptVersion(), now: !!now }),
                cache: "no-store",
                signal: AbortSignal.timeout?.(60000),
            });
            if (response.status === 404 || response.status === 405) throw new Error("your Pi doesn't work out combat plans yet – update it (git pull, docker compose up -d --build)");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const answer = await response.json();
            c.sent = sig;
            c.error = answer.loadouts === false ? "The Pi has none of your loadouts yet: they go with the Labyrinth's requests a minute or so after the page loads." : "";
            keep();
            if (answer.started) {
                c.asked = at;
                c.polls = 0;
                setTimeout(poll, POLL_MS);
            }
            return true;
        } catch (error) {
            c.error = `Asking the Pi: ${error.message || error}`;
            return false;
        } finally {
            if (c.sending === mine) c.sending = null;
            notify();
        }
    });
    c.sending = mine;
    return mine;
}

export async function askCombatPlanNow() {
    c.error = "";
    await sendSettings(true);
}

function poll() {
    c.polls++;
    readCombatPlan().then(() => {
        if (!c.asked) return;
        if (c.result && c.result.at >= c.asked - 60000 && !c.status?.running && !c.status?.queued) c.asked = 0;
        else if (c.status?.error && !c.status.running && !c.status.queued) {
            c.error = `The Pi: ${c.status.error}`;
            c.asked = 0;
        } else if (c.polls >= POLLS) c.asked = 0;
        else setTimeout(poll, POLL_MS);
        notify();
    });
}

export function readCombatPlan() {
    const config = piConfig();
    const id = characterId();
    if (!config || id === null) return Promise.resolve();
    restore();
    c.reading ||= (async () => {
        try {
            const response = await fetch(`${config.url}/combat-plan?character=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout?.(60000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const answer = await response.json();
            c.status = { ...(answer.status || {}), hour: answer.hour ?? null };
            if (c.status.loadouts && c.error.startsWith("The Pi has none")) c.error = "";
            const changed = answer.result && answer.result.at !== c.result?.at;
            if (answer.result) c.result = answer.result;
            keep();
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
export function combatPlanState() {
    restore();
    return {
        linked: !!piConfig(),
        works: !!piStatus().combatPlan,
        result: c.result,
        status: c.status,
        error: c.error,
        waiting: c.asked > 0 || !!c.status?.running || !!c.status?.queued,
        stale: !!c.result && c.sent !== null && JSON.stringify(c.result.settings ? pick(c.result.settings) : null) !== JSON.stringify(pick(JSON.parse(c.sent))),
    };
}
const pick = (s) => ({ style: s.style, meleeType: s.meleeType, days: s.days, reserve: s.reserve, charms: !!s.charms, setupId: s.setupId });

// The plan for the gear in the game: the first combat phase (the one to set up now), or null.
export function combatPlanNow() {
    restore();
    const phases = c.result?.phases || [];
    return phases.find((p) => p.kind === "combat") || null;
}
export const combatPlanResult = () => (restore(), c.result);
