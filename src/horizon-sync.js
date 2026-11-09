// The 📈 plan's link to the Pi: sends what the game says about the character
// (levels, XP, buffs, teas, tools, clothes, coins – a snapshot), and after a game patch
// the part of the game's data the plan needs, at most every 30 minutes; reads
// the newest plan back after every sync with the Pi. The plan itself is worked
// out on the Pi (pi/planner.mjs). The last plan is kept in the browser per
// character, so the tab shows it at once after a reload.

import { getClientData } from "./game-data.js";
import { state } from "./game-state.js";
import { heldStock, skillingCharacter } from "./skilling.js";
import { planAdviceKey, planData } from "./horizon.js";
import { onPiSync, piConfig, piStatus } from "./pi-sync.js";
import { scriptVersion } from "./version-tag.js";

const KEPT_KEY = "mwia-horizon";
const SEND_EVERY_MS = 30 * 60 * 1000;
// After "Plan now", the plan is read again this often, this many times.
const POLL_MS = 15 * 1000;
const POLLS = 12;
const COIN = "/items/coin";
const INVENTORY = "/item_locations/inventory";

// sentAt: the last snapshot sent; piHash: the game data the Pi has; asked: when "Plan now" was tapped.
const h = { plan: null, status: null, error: "", sentAt: 0, sending: null, reading: null, piHash: null, asked: 0, polls: 0, settings: () => ({}), listeners: new Set(), packed: null };

const characterId = () => state.character?.character?.id ?? null;

function kept() {
    try {
        return JSON.parse(localStorage.getItem(KEPT_KEY) || "{}");
    } catch {
        return {};
    }
}
function keep(fields) {
    const id = characterId();
    if (id === null) return;
    try {
        const all = kept();
        all[id] = { ...(all[id] || {}), ...fields };
        localStorage.setItem(KEPT_KEY, JSON.stringify(all));
    } catch {
        // storage full or blocked: the plan is read from the Pi again
    }
}
const mine = () => (characterId() === null ? {} : kept()[characterId()] || {});

export function onHorizonChange(listener) {
    h.listeners.add(listener);
}
const notify = () => h.listeners.forEach((listener) => listener());

// settings(): the advisor's settings (days, levelDays for the plan).
// prepare(): loads the game's data.
export function startHorizonSync({ settings, prepare = async () => {} }) {
    h.settings = settings;
    h.prepare = prepare;
    onPiSync(() => {
        if (!piStatus().plan || characterId() === null) return;
        readPlan();
        if (Date.now() - h.sentAt > SEND_EVERY_MS) sendSnapshot();
    });
}

export const horizonOptions = (settings) => ({ days: Number(settings.horizonDays) || 30, levelDays: Number(settings.horizonLevelDays ?? 7) });

// What the tab shows: the plan (the Pi's, else the one kept), and how things stand.
export function horizonState() {
    const plan = h.plan || mine().plan || null;
    return { linked: !!piConfig(), makesPlans: !!piStatus().plan, piOk: piStatus().ok, plan, status: h.status, error: h.error, sentAt: h.sentAt, asked: h.asked, waiting: h.asked > 0 && !(plan?.snapshotAt >= h.asked) && h.polls < POLLS };
}

// A new plan says something you haven't seen: the blue dot on the 🧭 button.
export function horizonNews() {
    const plan = horizonState().plan;
    const key = planAdviceKey(plan);
    return !!key && key !== mine().seen;
}
export function markHorizonSeen() {
    const key = planAdviceKey(horizonState().plan);
    if (key && key !== mine().seen) {
        keep({ seen: key });
        notify();
    }
}

// What the plan starts from: the character as the skilling maths sees it.
export function horizonSnapshot(options) {
    const data = getClientData();
    if (!state.character || !data) return null;
    const who = skillingCharacter(state.character, state.items, data);
    // Tools in the inventory can be put on for nothing; so can clothes, jewellery,
    // charms and capes with skilling stats, at their +level (each skill gets a loadout).
    const owned = {};
    const gear = new Map();
    for (const item of state.items.values()) {
        if (item.itemLocationHrid !== INVENTORY) continue;
        const detail = data.itemDetailMap[item.itemHrid]?.equipmentDetail;
        if (/_tool$/.test(detail?.type || "")) {
            if (!item.enhancementLevel) owned[item.itemHrid] = (owned[item.itemHrid] || 0) + (item.count || 1);
        } else if (Object.keys(detail?.noncombatStats || {}).length) {
            const level = item.enhancementLevel || 0;
            gear.set(`${item.itemHrid}+${level}`, { itemHrid: item.itemHrid, enhancementLevel: level });
        }
    }
    h.packed = h.packed?.source === data ? h.packed : { source: data, ...planData(data) };
    return {
        character: { id: characterId(), name: state.character.character?.name || null },
        at: Date.now(),
        version: scriptVersion(),
        who,
        coins: heldStock(state.character, state.items, COIN).inventory,
        owned,
        gear: [...gear.values()],
        options,
        dataHash: h.packed.hash,
    };
}

// Sends the snapshot (with the game's data when the Pi lacks it). run: plan now.
export function sendSnapshot({ run = false } = {}) {
    const config = piConfig();
    if (!config || !piStatus().plan) return Promise.resolve(false);
    h.sending ||= (async () => {
        try {
            await h.prepare?.();
            const snapshot = horizonSnapshot(horizonOptions(h.settings()));
            if (!snapshot) throw new Error("the game's data isn't loaded yet");
            const post = (withData) =>
                fetch(`${config.url}/snapshot`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ snapshot, run, ...(withData ? { data: { hash: h.packed.hash, data: h.packed.data } } : {}) }),
                    cache: "no-store",
                    signal: AbortSignal.timeout?.(120000),
                });
            let response = await post(h.piHash !== snapshot.dataHash);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            let answer = await response.json();
            if (answer.needData) {
                response = await post(true);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                answer = await response.json();
            }
            h.piHash = answer.dataHash ?? h.piHash;
            h.sentAt = Date.now();
            h.error = "";
            if (run) {
                // The plan from this snapshot carries its time (the Pi's clock may differ).
                h.asked = snapshot.at;
                h.polls = 0;
                setTimeout(poll, POLL_MS);
            }
            return true;
        } catch (error) {
            h.error = `Sending to the Pi: ${error.message || error}`;
            return false;
        } finally {
            h.sending = null;
            notify();
        }
    })();
    return h.sending;
}

function poll() {
    h.polls++;
    readPlan().then(() => {
        if (h.asked && !(h.plan?.snapshotAt >= h.asked) && h.polls < POLLS) setTimeout(poll, POLL_MS);
        else notify();
    });
}

// Reads the newest plan of this character from the Pi.
export function readPlan() {
    const config = piConfig();
    const id = characterId();
    if (!config || id === null) return Promise.resolve();
    h.reading ||= (async () => {
        try {
            const response = await fetch(`${config.url}/plan?character=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout?.(60000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const answer = await response.json();
            h.status = { ...answer.status, snapshotAt: answer.snapshotAt ?? null };
            h.piHash = answer.dataHash ?? h.piHash;
            if (answer.plan && !(h.plan?.at >= answer.plan.at)) {
                h.plan = answer.plan;
                keep({ plan: answer.plan });
            }
            h.error = "";
        } catch (error) {
            h.error = `Reading the plan from the Pi: ${error.message || error}`;
        } finally {
            h.reading = null;
            notify();
        }
    })();
    return h.reading;
}
