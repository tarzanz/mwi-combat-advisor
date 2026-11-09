// 🔁 Enhance ⇄ decompose loop: a small panel, started from an enhancing row that
// decomposes its +target. ▶ Next opens Enhancing with the next +0 item and the
// target; the game's Add to queue (again, while the window stays open) queues
// one job per item; when all are done, 🧪 Decompose opens Alchemy with the
// +target. The panel opens nothing by itself, and the player always clicks
// the game's own buttons. Kept in the browser per character, over a reload.

import { itemName } from "./game-data.js";
import { onStateChange, state } from "./game-state.js";
import { esc } from "./format.js";
import { addToCart } from "./mwitools-cart.js";
import { inventoryItemHash, levelingPanels, navDiagnostics, openAlchemy, openEnhancing } from "./game-nav.js";
import { hashItem, enhancingInQueue, loopActions, loopCart, loopStatus, newLoop } from "./enhance-loop.js";
import { enableTapTips } from "./touch.js";

const STORE_PREFIX = "mwia-loop:";
const INVENTORY = "/item_locations/inventory";
const NOT_QUEUED_AFTER_MS = 4000;

const L = {
    win: null,
    root: null,
    loop: null,
    notice: null, // { kind, text, diag }
    collapsed: false,
    timer: null,
    hooked: new WeakSet(), // the game's button rows the loop listens to
};

const n = (value) => Math.round(value).toLocaleString("en-US");
const characterId = () => state.character?.character?.id ?? null;
const storeKey = () => STORE_PREFIX + (characterId() ?? "unknown");

function save() {
    try {
        if (L.loop) localStorage.setItem(storeKey(), JSON.stringify(L.loop));
        else localStorage.removeItem(storeKey());
    } catch {
        // progress is just not remembered over a reload
    }
}

function restore() {
    try {
        L.loop = JSON.parse(localStorage.getItem(storeKey()) || "null");
    } catch {
        L.loop = null;
    }
}

const heldAt = (hrid, level = 0) => [...state.items.values()].filter((i) => i.itemHrid === hrid && i.itemLocationHrid === INVENTORY && (i.enhancementLevel || 0) === level).reduce((sum, i) => sum + (i.count || 0), 0);
// The inventory hash of an item you hold at that +level, or null.
const ownedHash = (hrid, level = 0) => (hrid && characterId() !== null && heldAt(hrid, level) > 0 ? inventoryItemHash(characterId(), hrid, level) : null);

function status() {
    const loop = L.loop;
    return loopStatus(loop, { inQueue: enhancingInQueue(state.character?.characterActions, loop.itemHrid), heldZero: heldAt(loop.itemHrid, 0), heldTarget: heldAt(loop.itemHrid, loop.target) });
}

function setNotice(kind, text, diag = "") {
    L.notice = text ? { kind, text, diag } : null;
    render();
}

// Starts a loop: { itemHrid, target, protect: { itemHrid, from } | null, catalyst, perItem }.
// It takes the +0 of the item you hold, and opens the first.
export function startLoop(options) {
    const total = heldAt(options.itemHrid, 0);
    clearTimeout(L.timer);
    L.loop = newLoop({ ...options, total, heldTarget: heldAt(options.itemHrid, options.target) });
    L.notice = null;
    L.collapsed = false;
    save();
    render();
    if (total > 0) openNext();
}

// Enhancing with the next +0 item, the target and the protection.
async function openNext() {
    const loop = L.loop;
    if (!loop) return;
    const hash = ownedHash(loop.itemHrid, 0);
    const protect = loop.protect ? { hash: ownedHash(loop.protect.itemHrid, 0), from: loop.protect.from } : null;
    const opened = await openEnhancing(hash, loop.target, protect);
    if (opened === "item") L.notice = null;
    else if (opened === "partial") L.notice = { kind: "info", text: `Opened with the item, but couldn't put ${itemName(loop.protect.itemHrid)} in as protection from +${loop.protect.from} – do that in the game.`, diag: navDiagnostics() };
    else L.notice = { kind: "warn", text: `Could not open ${itemName(loop.itemHrid)} in Enhancing${hash ? "" : " – no +0 in the inventory"}. Open it yourself with the target +${loop.target}.`, diag: navDiagnostics() };
    render();
    scheduleMark();
}

// Alchemy's Decompose tab with all the +target you hold and the catalyst.
async function openDecompose() {
    const loop = L.loop;
    if (!loop) return;
    const count = heldAt(loop.itemHrid, loop.target);
    const catalyst = loop.catalyst ? { hash: ownedHash(loop.catalyst, 0) } : null;
    const opened = await openAlchemy(ownedHash(loop.itemHrid, loop.target), "Decompose", count, catalyst);
    if (opened === "item") L.notice = null;
    else if (opened === "partial") L.notice = { kind: "info", text: `Opened with the item, but couldn't put ${itemName(loop.catalyst)} in as the catalyst – do that in the game.`, diag: navDiagnostics() };
    else L.notice = { kind: "warn", text: `Could not open Decompose. Pick ${itemName(loop.itemHrid)} +${loop.target} there yourself and enter ${count}.`, diag: navDiagnostics() };
    render();
    scheduleMark();
}

function endLoop() {
    clearTimeout(L.timer);
    unmark();
    L.loop = null;
    L.notice = null;
    save();
    render();
}

// ----- the game's windows ----------------------------------------------------

function unmark() {
    document.querySelectorAll(".mwia-loop-target").forEach((node) => node.classList.remove("mwia-loop-target", "mwia-train-target"));
}

// Outlines the game's buttons in the window the loop's next step uses, and
// listens to them: nothing confirmed in the queue soon after says so.
function markWindow() {
    unmark();
    if (!L.loop) return;
    const st = status();
    const loop = L.loop;
    const wanted = st.phase === "queue" ? "enhancing" : st.phase === "decompose" ? "alchemy" : null;
    if (!wanted) return;
    for (const p of levelingPanels()) {
        const item = hashItem(p.itemHash);
        if (p.kind !== wanted || !p.buttons || item?.itemHrid !== loop.itemHrid) continue;
        if (wanted === "alchemy" && (p.tab !== "Decompose" || item.level !== loop.target)) continue;
        p.buttons.classList.add("mwia-loop-target", "mwia-train-target");
        if (!L.hooked.has(p.buttons)) {
            L.hooked.add(p.buttons);
            p.buttons.addEventListener("click", onGameButton, true);
        }
    }
}

let markQueued = false;
function scheduleMark() {
    if (markQueued) return;
    markQueued = true;
    requestAnimationFrame(() => {
        markQueued = false;
        markWindow();
    });
}

function onGameButton(event) {
    if (!L.loop || !event.target.closest?.("button") || !event.currentTarget.classList.contains("mwia-loop-target")) return;
    const before = `${L.loop.queued}|${!!L.loop.decompose}`;
    clearTimeout(L.timer);
    L.timer = setTimeout(() => {
        if (L.loop && `${L.loop.queued}|${!!L.loop.decompose}` === before) {
            setNotice("warn", "Nothing reached the queue yet. If your action queue is full, wait until a job is done and click “Add to queue” again (or ▶ Next).");
        }
    }, NOT_QUEUED_AFTER_MS);
}

function onGameMessage(type, data) {
    if (type === "init_character_data") {
        restore();
        render();
        return;
    }
    if (!L.loop) return;
    if (type === "actions_updated" && loopActions(L.loop, data?.endCharacterActions)) {
        clearTimeout(L.timer);
        if (L.notice?.kind === "warn") L.notice = null;
        save();
    }
    if (type === "actions_updated" || type === "items_updated") {
        render();
        scheduleMark();
    }
}

// ----- the panel -------------------------------------------------------------

function render() {
    if (!L.root) return;
    const loop = L.loop;
    L.root.classList.toggle("mwia-hidden", !loop);
    if (!loop) return;
    const st = status();
    const item = esc(itemName(loop.itemHrid));
    const plus = `+${loop.target}`;
    const button = (action, text, title = "") => `<button class="mwia-cart-btn" data-loop="${action}"${title ? ` title="${esc(title)}"` : ""}>${text}</button>`;
    const headline = {
        queue: `${n(st.queued)}/${n(st.total)} queued`,
        short: `${n(st.queued)}/${n(st.total)} queued – no ${item} +0 left`,
        running: `All ${n(st.queued)} queued · ${n(st.inQueue)} still in the queue`,
        decompose: `${n(st.heldTarget)} × ${plus} ready to decompose`,
        empty: `Done – none reached ${plus}`,
        done: `🧪 Decompose of ${n(loop.decompose?.count ?? st.heldTarget)} × ${plus} queued`,
    }[st.phase];
    let html = `<div class="mwia-train-head">
        <button class="mwia-link" data-loop="toggle" title="Show or hide the details">${L.collapsed ? "▸" : "▾"}</button>
        <b>🔁 ${item} → ${plus} 🧪</b>
        <button class="mwia-link" data-loop="end" title="End the loop">✕</button>
      </div>
      <div class="mwia-train-now">${headline}</div>`;
    if (L.notice) html += `<div class="mwia-notice mwia-notice-${L.notice.kind}">${esc(L.notice.text)}${L.notice.diag ? `<div class="mwia-notice-diag">${esc(L.notice.diag)}</div>` : ""}</div>`;
    const buttons = [];
    if (st.phase === "queue") buttons.push(button("next", `▶ Next ${item}`, `Opens Enhancing with a +0 ${itemName(loop.itemHrid)} and the target ${plus}`));
    if (st.phase === "decompose") buttons.push(button("decompose", `🧪 Decompose ${n(st.heldTarget)} × ${plus}`, `Opens Decompose with the ${n(st.heldTarget)} ${itemName(loop.itemHrid)} ${plus} you have`));
    if (["done", "empty", "short"].includes(st.phase)) {
        if (st.heldZero > 0) buttons.push(button("again", `🔁 Again (${n(st.heldZero)})`, `A new loop with the ${n(st.heldZero)} +0 you have`));
        if (loop.perItem?.length) buttons.push(button("cart", `🛒 ${n(loop.total)} more`, `Adds what ${n(loop.total)} more take to the MWITools cart, less what you have`));
    }
    if (buttons.length) html += `<div class="mwia-train-buttons">${buttons.join("")}</div>`;
    if (!L.collapsed) {
        const help = {
            queue: `Click the game's <b>Add to queue</b> (or <b>Start</b>) – again for each ${item} while the window stays open. The game stops each one at ${plus}.`,
            short: `Buy more, or decompose what reached ${plus} once you have some.`,
            running: `When they are done, decompose the ${plus} here. Nothing opens by itself.`,
            decompose: `Click the game's <b>Start</b> or <b>Add to queue</b> in Decompose.`,
            empty: "",
            done: `Buy the next round with 🛒, then 🔁 Again.`,
        }[st.phase];
        if (help) html += `<p class="mwia-dim">${help}</p>`;
        html += `<p class="mwia-dim">In the inventory: ${n(st.heldZero)} at +0 · ${n(st.heldTarget)} at ${plus}${st.ended ? ` · ${n(st.ended)} jobs done` : ""}.</p>`;
    }
    L.root.innerHTML = html;
}

async function onClick(event) {
    const button = event.target.closest("[data-loop]");
    if (!button || !L.loop) return;
    const action = button.dataset.loop;
    if (action === "toggle") {
        L.collapsed = !L.collapsed;
        render();
    } else if (action === "end") endLoop();
    else if (action === "next") openNext();
    else if (action === "decompose") openDecompose();
    else if (action === "again") {
        const { itemHrid, target, protect, catalyst, perItem } = L.loop;
        startLoop({ itemHrid, target, protect, catalyst, perItem });
    } else if (action === "cart") {
        const items = loopCart(L.loop, L.loop.total, (hrid) => heldAt(hrid, 0)).map((i) => ({ ...i, enhancementLevel: 0 }));
        if (!items.length) return setNotice("ok", "You already have what the next round takes.");
        try {
            const outcome = await addToCart(L.win, items);
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

export function mountEnhanceLoop(win) {
    L.win = win;
    L.root = document.createElement("div");
    L.root.className = "mwia-train mwia-loop mwia-hidden";
    L.root.addEventListener("click", onClick);
    enableTapTips(L.root);
    document.body.appendChild(L.root);
    restore();
    render();
    onStateChange(onGameMessage);
    new MutationObserver(() => L.loop && scheduleMark()).observe(document.body, { childList: true, subtree: true });
}
