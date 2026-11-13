// Whole Labyrinth runs, simulated on your Pi when you ask (pi/labyrinth-sim.mjs runs
// labyrinth-run.js): this sends what the simulation starts from – every skill's level and
// buffs, the combat rooms' win curves of your last "Check the rooms", the supplies, the
// shop's upgrades, your tokens and the automation settings – and reads the result back.
// The last result is kept in the browser per character, so the tab shows it after a reload.

import { getClientData } from "./game-data.js";
import { state } from "./game-state.js";
import { slottedCrate } from "./labyrinth.js";
import { lastLabyrinthCheck } from "./labyrinth-marks.js";
import { SKILLS, TIERS } from "./labyrinth-run.js";
import { skillingWho } from "./labyrinth-skilling.js";
import { onPiSync, piConfig, piStatus } from "./pi-sync.js";
import { scriptVersion } from "./version-tag.js";

const KEPT_KEY = "mwia-laby-run";
const POLL_MS = 4000;
const POLLS = 90;
const INVENTORY = "/item_locations/inventory";
const TOKEN = "/items/labyrinth_token";
// The game's data about the Labyrinth sent along (for the Pi's log of what the game holds), at most this big.
const GAME_DATA_CHARS = 150 * 1000;

const r = { result: null, status: null, error: "", asked: 0, polls: 0, sending: null, reading: null, prepare: null, listeners: new Set() };

const characterId = () => state.character?.character?.id ?? null;
function kept() {
    try {
        return JSON.parse(localStorage.getItem(KEPT_KEY) || "{}");
    } catch {
        return {};
    }
}
function keep(result) {
    const id = characterId();
    if (id === null) return;
    try {
        localStorage.setItem(KEPT_KEY, JSON.stringify({ ...kept(), [id]: result }));
    } catch {
        // storage full or blocked: read from the Pi again
    }
}

export const onRunsChange = (listener) => r.listeners.add(listener);
const notify = () => r.listeners.forEach((listener) => listener());

// prepare(): loads the game's data.
export function startLabyrinthRuns({ prepare = async () => {} } = {}) {
    r.prepare = prepare;
    // Another device's result, after each sync with the Pi.
    onPiSync(() => {
        if (piStatus().labyrinth?.sim && characterId() !== null && !r.asked) readRuns();
    });
}

function held(name) {
    let count = 0;
    for (const item of state.items.values()) if (item.itemHrid === name && item.itemLocationHrid === INVENTORY) count += item.count || 0;
    return count;
}

// The tier of a supply you hold the most of (null: none).
export function heldTier(kind) {
    let best = null;
    for (const tier of TIERS) {
        const count = held(`/items/${tier}_${kind}`);
        if (count > 0 && (!best || count >= best.count)) best = { tier, count };
    }
    return best?.tier || null;
}

// What the simulation runs with, from the tab's settings (else the game's): the automation, the supplies' tiers.
export function runSetup(settings, character = state.character) {
    const info = character?.characterInfo || {};
    const whole = (value, fallback, min, max) => (value === undefined || value === "" || !Number.isFinite(Number(value)) ? fallback : Math.max(min, Math.min(max, Math.round(Number(value)))));
    const tier = (value, kind) => (TIERS.includes(value) ? value : heldTier(kind) || "basic");
    const autoFloors = whole(settings.labyAuto, Number(info.labyrinthFullAutoLevel) || 0, 0, 15);
    return {
        autoFloors,
        rushFloors: Math.min(autoFloors, whole(settings.labyRush, 0, 0, 15)),
        maxAttempts: whole(settings.labyAttempts, 1, 1, 99),
        torchTier: tier(settings.labyTorch, "torch"),
        shroudTier: tier(settings.labyShroud, "shroud"),
        // The run's tea crate while you are in one, else the one in your Labyrinth slots.
        teaCrate: state.labyrinth?.isActive && state.labyrinth.teaCrateItemHrid ? TIERS.find((t) => state.labyrinth.teaCrateItemHrid === `/items/${t}_tea_crate`) || null : slottedCrate(character, "tea"),
    };
}

// What the Pi simulates from (null with why when something is missing).
export function runRequest(settings) {
    const data = getClientData();
    const character = state.character;
    if (!character || !data) return { error: "the game's data isn't loaded yet" };
    const check = lastLabyrinthCheck();
    if (!check?.monsters?.length) return { error: "tap Check the rooms first – the combat rooms' chances come from it" };
    const setup = runSetup(settings, character);
    const skills = {};
    const xp = {};
    for (const skill of SKILLS) {
        const who = skillingWho(character, data, skill, null);
        skills[skill] = { level: who.level, buffs: who.buffs, shop: who.shop };
        xp[skill] = (character.characterSkills || []).find((s) => s.skillHrid === `/skills/${skill}`)?.experience ?? null;
    }
    const shop = {};
    for (const [k, v] of Object.entries(character.characterInfo || {})) if (/^labyrinth/.test(k) && Number.isFinite(v)) shop[k.slice(9)] = v;
    // What the game's data says about the Labyrinth besides the crates (the shop, the rooms): kept on the Pi with the request.
    const game = {};
    let size = 0;
    for (const [k, v] of Object.entries(data)) {
        if (!/labyrinth/i.test(k) || k === "labyrinthCrateDetailMap") continue;
        const chars = JSON.stringify(v ?? null).length;
        if (size + chars > GAME_DATA_CHARS) continue;
        size += chars;
        game[k] = v;
    }
    return {
        request: {
            character: { id: characterId(), name: character.character?.name || null },
            at: Date.now(),
            version: scriptVersion(),
            skills,
            xp,
            levelXp: data.levelExperienceTable || null,
            teaCrates: Object.fromEntries(TIERS.map((t) => [t, data.labyrinthCrateDetailMap?.[`/items/${t}_tea_crate`] || []])),
            teaCrate: setup.teaCrate,
            combat: { checkedAt: check.at, monsters: check.monsters.map((m) => ({ hrid: m.hrid, setupName: m.setupName, curve: m.curve })) },
            supplies: { torchTier: setup.torchTier, shroudTier: setup.shroudTier },
            shop,
            tokens: held(TOKEN),
            options: { autoFloors: setup.autoFloors, rushFloors: setup.rushFloors, maxAttempts: setup.maxAttempts, shroudWhenStuck: true },
            game,
        },
    };
}

// What the tab shows: the result (the Pi's, else the one kept), and how things stand.
export function runsState() {
    const id = characterId();
    const result = r.result || (id === null ? null : kept()[id]) || null;
    return { linked: !!piConfig(), simulates: !!piStatus().labyrinth?.sim, checked: !!lastLabyrinthCheck()?.monsters?.length, result, status: r.status, error: r.error, waiting: r.asked > 0 };
}

// Asks the Pi to simulate now; the result is read until it is the one asked for.
export function askRuns(settings) {
    const config = piConfig();
    if (!config) return Promise.resolve(false);
    r.sending ||= (async () => {
        try {
            await r.prepare?.();
            const built = runRequest(settings);
            if (built.error) throw new Error(built.error);
            const response = await fetch(`${config.url}/labyrinth/sim`, {
                method: "POST",
                headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
                body: JSON.stringify({ request: built.request }),
                cache: "no-store",
                signal: AbortSignal.timeout?.(60000),
            });
            if (response.status === 404 || response.status === 405) throw new Error("your Pi doesn't simulate runs yet – update it (git pull, docker compose up -d --build)");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            r.asked = built.request.at;
            r.polls = 0;
            r.error = "";
            setTimeout(poll, POLL_MS);
            return true;
        } catch (error) {
            r.error = `Asking the Pi: ${error.message || error}`;
            return false;
        } finally {
            r.sending = null;
            notify();
        }
    })();
    return r.sending;
}

function poll() {
    r.polls++;
    readRuns().then(() => {
        if (!r.asked) return;
        if (r.result?.requestAt === r.asked) r.asked = 0;
        else if (r.status?.error && !r.status.running && !r.status.queued) {
            r.error = `The Pi: ${r.status.error}`;
            r.asked = 0;
        } else if (r.polls >= POLLS) {
            r.error = "The Pi hasn't answered yet – it may be busy with the 📈 plan; the result shows here when it is done.";
            r.asked = 0;
        } else setTimeout(poll, POLL_MS);
        notify();
    });
}

// Reads the newest result of this character from the Pi.
export function readRuns() {
    const config = piConfig();
    const id = characterId();
    if (!config || id === null) return Promise.resolve();
    r.reading ||= (async () => {
        try {
            const response = await fetch(`${config.url}/labyrinth/sim?character=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout?.(30000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const answer = await response.json();
            r.status = answer.status || null;
            const have = r.result || kept()[id] || null;
            if (answer.result && !(have?.at >= answer.result.at)) {
                r.result = answer.result;
                keep(answer.result);
            }
        } catch (error) {
            if (r.asked) r.error = `Reading from the Pi: ${error.message || error}`;
        } finally {
            r.reading = null;
            notify();
        }
    })();
    return r.reading;
}
