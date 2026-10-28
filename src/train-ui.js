// "Plan train": a small panel that walks through a MWITools plan one production
// stop at a time. It opens each action, fills in the count, and moves on once
// the game confirms the action reached the queue. The player always clicks the
// game's own "Add to queue" button.

import { getClientData, loadClientData } from "./game-data.js";
import { onStateChange, state } from "./game-state.js";
import { esc } from "./format.js";
import { addToCart } from "./mwitools-cart.js";
import { buildTrain, inventoryCounts, readPlanningTab, toBuy, trainStops } from "./plan-train.js";
import { findActionPanel, navDiagnostics, openAction, setReactInput } from "./game-nav.js";
import { enableTapTips, isNarrow } from "./touch.js";
import { showPlanCosts } from "./plan-costs-ui.js";

const STORE_PREFIX = "mwia-train:";
const LOW_KEY = "mwia-train-low";
const NOT_QUEUED_AFTER_MS = 4000;

const t = {
    win: null,
    train: null, // { title, stops, made, gather, index, shortages, covered, warnings }
    root: null,
    notice: null, // { kind, text }
    collapsed: false,
    low: false, // phones: panel at the bottom of the screen instead of the top
    seenActionIds: new Set(),
    filled: new WeakMap(), // count input -> stop index it was filled for
    queueClickTimer: null,
};

const n = (value) => Math.ceil(value).toLocaleString("en-US");
const characterId = () => state.character?.character?.id ?? null;
const storeKey = () => STORE_PREFIX + (characterId() ?? "unknown");

function save() {
    try {
        if (t.train) localStorage.setItem(storeKey(), JSON.stringify(t.train));
        else localStorage.removeItem(storeKey());
    } catch {
        // progress is just not remembered over a reload
    }
}

function restore() {
    try {
        t.train = JSON.parse(localStorage.getItem(storeKey()) || "null");
    } catch {
        t.train = null;
    }
}

function rememberQueuedActions() {
    for (const action of state.character?.characterActions || []) {
        if (action.id !== undefined && action.id !== null) t.seenActionIds.add(action.id);
    }
}

function currentStop() {
    return t.train?.stops[t.train.index] || null;
}

function setNotice(kind, text, diag = "") {
    t.notice = text ? { kind, text, diag } : null;
    render();
}

// ----- starting a train ------------------------------------------------------

async function startFromPlanning() {
    try {
        const data = getClientData() || (await loadClientData(t.win));
        const plan = readPlanningTab(document, data);
        if (plan.error) throw new Error(plan.error);
        await startTrain(plan);
    } catch (error) {
        showStandaloneError(error.message);
    }
}

// Starts a train for plan: { goals: [{kind, hrid, target}], policies: Map itemHrid -> "chain"|"single"|"buy", title? }.
// Used by the planning tab's button and the Skilling tab's 🚂 Train.
export async function startTrain(plan) {
    try {
        const data = getClientData() || (await loadClientData(t.win));
        if (!state.character) throw new Error("Character data not received yet. Reload the game page with the advisor installed.");
        const houseLevels = {};
        for (const room of Object.values(state.character.characterHouseRoomMap || {})) houseLevels[room.houseRoomHrid] = room.level;
        const skills = {};
        for (const skill of state.character.characterSkills || []) skills[skill.skillHrid] = skill.level;
        const train = buildTrain(plan, data, { owned: inventoryCounts(state.items), houseLevels, skills });
        if (plan.title) train.title = plan.title;
        t.train = { ...train, made: train.stops, index: 0 };
        t.train.stops = trainStops(t.train);
        // A phone screen is small; start with just the current stop showing.
        t.collapsed = isNarrow();
        t.notice = null;
        rememberQueuedActions();
        save();
        render();
        if (train.stops.length) goToCurrent();
    } catch (error) {
        showStandaloneError(error.message);
    }
}

function showStandaloneError(text) {
    if (!t.train) t.train = { title: "Plan train", stops: [], index: 0, shortages: [], covered: [], warnings: [], failed: true };
    setNotice("bad", text);
}

// ----- moving along ----------------------------------------------------------

async function goToCurrent() {
    const stop = currentStop();
    if (!stop) return;
    const data = getClientData() || (await loadClientData(t.win));
    const action = data.actionDetailMap[stop.actionHrid];
    const opened = action && (await openAction(t.win, action, data));
    if (currentStop() !== stop) return;
    if (opened) fillPanel();
    else setNotice("warn", `Could not open ${stop.actionName} automatically. Open it yourself (${cap(stop.skill)}) and the count is filled in.`, action ? navDiagnostics() : `${stop.actionHrid} not in game data`);
}

function advance(step = 1) {
    if (!t.train) return;
    clearTimeout(t.queueClickTimer);
    t.train.index = Math.max(0, Math.min(t.train.stops.length, t.train.index + step));
    t.notice = null;
    save();
    render();
    if (currentStop()) goToCurrent();
}

// Gather a raw material yourself or buy it. Stops already passed stay passed.
function toggleGather(itemHrid) {
    const item = t.train?.gather?.find((candidate) => candidate.itemHrid === itemHrid);
    if (!item) return;
    item.on = !item.on;
    const done = new Set(t.train.stops.slice(0, t.train.index).map((stop) => stop.actionHrid));
    const all = trainStops(t.train);
    const passed = all.filter((stop) => done.has(stop.actionHrid));
    t.train.stops = [...passed, ...all.filter((stop) => !done.has(stop.actionHrid))];
    t.train.index = passed.length;
    t.notice = null;
    save();
    render();
}

function endTrain() {
    clearTimeout(t.queueClickTimer);
    document.querySelectorAll(".mwia-train-target").forEach((node) => node.classList.remove("mwia-train-target"));
    t.train = null;
    t.notice = null;
    save();
    render();
}

// Fills the count into the current stop's panel once per panel the game shows.
function fillPanel() {
    const stop = currentStop();
    document.querySelectorAll(".mwia-train-target").forEach((node) => node.classList.remove("mwia-train-target"));
    if (!stop) return;
    const found = findActionPanel(stop.actionName);
    if (!found) return;
    if (t.filled.get(found.input) !== t.train.index) {
        t.filled.set(found.input, t.train.index);
        setReactInput(found.input, stop.count);
    }
    if (found.buttons) {
        found.buttons.classList.add("mwia-train-target");
        if (!found.buttons.dataset.mwiaTrain) {
            found.buttons.dataset.mwiaTrain = "1";
            found.buttons.addEventListener("click", onQueueButtonClick, true);
        }
    }
}

function onQueueButtonClick(event) {
    if (!currentStop() || !event.target.closest?.("button")) return;
    const index = t.train.index;
    clearTimeout(t.queueClickTimer);
    t.queueClickTimer = setTimeout(() => {
        if (t.train?.index === index) {
            setNotice("warn", "Nothing reached the queue yet. If your action queue is full, wait for a free slot and click “Add to queue” again — or press “Next ▸” to move on anyway.");
        }
    }, NOT_QUEUED_AFTER_MS);
}

function onGameMessage(type, data) {
    // New character or inventory data changes the material costs in the planning tab.
    scheduleScan();
    if (type === "init_character_data") {
        t.seenActionIds = new Set();
        restore();
        rememberQueuedActions();
        render();
        return;
    }
    if (type !== "actions_updated") return;
    const stop = currentStop();
    let queued = false;
    for (const action of data?.endCharacterActions || []) {
        if (!action || action.id === undefined || action.id === null || t.seenActionIds.has(action.id)) continue;
        t.seenActionIds.add(action.id);
        if (!action.isDone && stop && action.actionHrid === stop.actionHrid) queued = true;
    }
    if (queued) advance();
}

// ----- the panel -------------------------------------------------------------

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1);

function levelNote(stop) {
    if (stop.level === null || stop.level >= stop.levelRequired) return "";
    return ` <span class="mwia-bad" title="Your ${esc(cap(stop.skill))} level is ${stop.level}">⚠ needs ${esc(cap(stop.skill))} ${stop.levelRequired}</span>`;
}

function render() {
    if (!t.root) return;
    const train = t.train;
    t.root.classList.toggle("mwia-hidden", !train);
    t.root.classList.toggle("mwia-train-low", t.low);
    if (!train) return;
    const stop = currentStop();
    const done = train.index >= train.stops.length && !train.failed;
    const headline = done ? "All stops queued" : stop ? `${train.index + 1}/${train.stops.length} · ${esc(stop.actionName)} ×${n(stop.count)}` : "";
    let html = `<div class="mwia-train-head">
        <button class="mwia-link" data-train="toggle" title="Show or hide the stops">${t.collapsed ? "▸" : "▾"}</button>
        <b>🚂 ${esc(train.title)}</b>
        <button class="mwia-link mwia-narrow-only" data-train="move" title="Move to the ${t.low ? "top" : "bottom"} of the screen">⇅</button>
        <button class="mwia-link" data-train="end" title="End the train">✕</button>
      </div>`;
    if (headline) html += `<div class="mwia-train-now">${headline}</div>`;
    if (t.notice) html += `<div class="mwia-notice mwia-notice-${t.notice.kind}">${esc(t.notice.text)}${t.notice.diag ? `<div class="mwia-notice-diag">${esc(t.notice.diag)}</div>` : ""}</div>`;
    if (stop && !train.failed) {
        if (!t.collapsed) html += `<p class="mwia-dim">Click the game's <b>Add to queue</b>; the next stop opens when the game confirms it.</p>`;
        html += `<div class="mwia-train-buttons">
            <button class="mwia-cart-btn" data-train="back" ${train.index === 0 ? "disabled" : ""}>◂ Back</button>
            <button class="mwia-cart-btn" data-train="open">Open stop</button>
            <button class="mwia-cart-btn" data-train="next">Next ▸</button>
          </div>`;
    }
    if (!t.collapsed && !train.failed) {
        if (done) {
            html += `<p>Everything is in the queue. When it has finished, ${/→/.test(train.title) ? "upgrade the house room" : "the goal items are ready"}.</p>`;
        }
        html += `<ol class="mwia-train-stops">${train.stops
            .map((s, i) => `<li class="${i < train.index ? "mwia-train-done" : i === train.index ? "mwia-train-current" : ""}">
                <span>${esc(s.actionName)}</span> <span class="mwia-num"${s.gather ? ` title="${n(s.count)} actions give about ${n(s.output)}; ${n(s.need)} needed"` : ""}>×${n(s.count)}</span>
                <span class="mwia-dim">${esc(cap(s.skill))}</span>${levelNote(s)}${
                    s.gather && i >= train.index ? ` <button class="mwia-link" data-train="gather" data-item="${esc(s.itemHrid)}" title="Buy ${esc(s.name)} instead of gathering it">buy instead</button>` : ""
                }</li>`)
            .join("")}</ol>`;
        if (!train.stops.length) html += `<p>Nothing needs to be made — your inventory already covers the plan.</p>`;
        if (train.covered.length) html += `<p class="mwia-dim">Already in inventory: ${esc(train.covered.join(", "))}</p>`;
        const buyable = toBuy(train).filter((s) => s.itemHrid !== "/items/coin");
        const coins = train.shortages.find((s) => s.itemHrid === "/items/coin");
        const gatherable = new Map((train.gather || []).map((item) => [item.itemHrid, item]));
        const gatherButton = (s) => {
            const item = gatherable.get(s.itemHrid);
            if (!item) return "";
            return ` <button class="mwia-link" data-train="gather" data-item="${esc(s.itemHrid)}" title="Gather it yourself (${esc(cap(item.skill))} ${item.levelRequired})">gather</button>${levelNote(item)}`;
        };
        if (buyable.length) {
            html += `<p><b>Missing materials:</b> ${buyable.map((s) => `${esc(s.name)} ×${n(s.need)}${gatherButton(s)}`).join(", ")}
              <button class="mwia-cart-btn" data-train="cart" title="Add the missing materials to the MWITools shopping cart">🛒 Add to cart</button></p>`;
        }
        if (coins) html += `<p class="mwia-warn">Coins short: ${n(coins.need)}</p>`;
        for (const warning of train.warnings) html += `<p class="mwia-warn">⚠ ${esc(warning)}</p>`;
    }
    t.root.innerHTML = html;
}

async function onClick(event) {
    const button = event.target.closest("[data-train]");
    if (!button) return;
    const action = button.dataset.train;
    if (action === "toggle") {
        t.collapsed = !t.collapsed;
        render();
    } else if (action === "move") {
        t.low = !t.low;
        try {
            localStorage.setItem(LOW_KEY, t.low ? "1" : "");
        } catch {
            // the choice is just not remembered
        }
        render();
    } else if (action === "end") endTrain();
    else if (action === "back") advance(-1);
    else if (action === "next") advance(1);
    else if (action === "open") {
        t.notice = null;
        render();
        goToCurrent();
    } else if (action === "gather") toggleGather(button.dataset.item);
    else if (action === "cart") {
        const items = toBuy(t.train)
            .filter((s) => s.itemHrid !== "/items/coin")
            .map((s) => ({ hrid: s.itemHrid, quantity: s.need, enhancementLevel: 0 }));
        try {
            const outcome = await addToCart(t.win, items);
            const parts = [];
            if (outcome.added.length) parts.push(`${outcome.added.length} added`);
            if (outcome.updated.length) parts.push(`${outcome.updated.length} topped up`);
            if (outcome.present.length) parts.push(`${outcome.present.length} already there`);
            if (outcome.failed.length) parts.push(`${outcome.failed.length} failed`);
            setNotice(outcome.failed.length ? "warn" : "ok", "Shopping cart: " + parts.join(", ") + ".");
        } catch (error) {
            setNotice("bad", error.message);
        }
    }
}

// ----- hooking into the page -------------------------------------------------

function injectStartButtons() {
    for (const stage of document.querySelectorAll(".planning-stage")) {
        if (stage.querySelector(".mwia-train-start")) continue;
        const bar = stage.querySelector(".planning-calculate-bar");
        if (!bar) continue;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mwia-train-start";
        button.textContent = "🚂 Plan train";
        button.title = "MWI Advisor: walk through these production steps in order, with counts filled in";
        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            startFromPlanning();
        });
        bar.appendChild(button);
    }
}

let scanQueued = false;
function scheduleScan() {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(() => {
        scanQueued = false;
        injectStartButtons();
        showPlanCosts(t.win);
        if (currentStop()) fillPanel();
    });
}

export function mountPlanTrain(win) {
    t.win = win;
    t.root = document.createElement("div");
    t.root.className = "mwia-train mwia-hidden";
    t.root.addEventListener("click", onClick);
    enableTapTips(t.root);
    document.body.appendChild(t.root);
    try {
        t.low = !!localStorage.getItem(LOW_KEY);
    } catch {
        t.low = false;
    }
    restore();
    rememberQueuedActions();
    render();
    onStateChange(onGameMessage);
    new MutationObserver(scheduleScan).observe(document.body, { childList: true, subtree: true });
    scheduleScan();
}
