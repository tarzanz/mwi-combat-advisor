// Marks the tea slots on a skill page: the first job in the queue for that
// skill decides which teas are right (the Skilling tab's best setup for it,
// with your focus). A slot with the wrong tea – or empty while a right one
// is missing – glows red; in the game's tea picker the right teas glow green,
// and teas you don't have get a line with a cart button for 8 hours of them.

import { getClientData, itemName, pricesStamp } from "./game-data.js";
import { onStateChange, state } from "./game-state.js";
import { esc } from "./format.js";
import { visible } from "./game-nav.js";
import { SKILLING_SKILLS, heldStock } from "./skilling.js";
import { skillingAdvice, topActionKey } from "./skilling-ui.js";

const SCAN_MS = 300;
// The advice is worked out again at most this often while nothing else changes
// (the ranking moves a little with every finished action).
const REFRESH_MS = 5 * 60 * 1000;
export const TEA_HOURS = 8;
const LABEL = /^consumables$/i;
const SLOTS = '[class*="ActionTypeConsumableSlots_consumableSlots"]';
const MENU = '[class*="ItemSelector_menu"]';
const MENU_ITEM = '[class*="ItemSelector_itemContainer"]';
const NAV = '[class*="NavigationBar"]';
const VERSION = typeof GM_info !== "undefined" ? GM_info.script?.version || "" : "";

const t = { deps: null, scanTimer: null, loading: null, key: "", at: 0, advice: null, status: "" };

const skillLabel = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
const have = (hrid) => heldStock(state.character, state.items, hrid).inventory;
const iconItem = (element) => {
    const use = element.querySelector("svg use");
    const id = (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#")[1];
    return id ? "/items/" + id : null;
};
// Elements whose own text (not their children's) passes the test: "Tailoring" next to its "?" icon.
const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
const leaves = (root, test) => [...root.querySelectorAll("*")].filter((el) => test(ownText(el)));
const ours = (el) => el.closest('[class*="mwia"]');

// deps: settings(), prepare() -> loads game data and prices, addToCart(items) -> the cart outcome.
export function startTeaSlots(deps) {
    t.deps = deps;
    onStateChange(() => scheduleScan());
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-tea-note"))) return;
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
}

function scheduleScan() {
    if (t.scanTimer) return;
    t.scanTimer = setTimeout(() => {
        t.scanTimer = null;
        try {
            scan();
        } catch (error) {
            console.warn("[Combat Advisor] tea slots", error);
        }
    }, SCAN_MS);
}

// The skill page's tea slots: { slots: [element], skill } or { error } when the
// "Consumables" row is there but can't be read; null on any other page.
export function findSlots(doc = document) {
    const label = leaves(doc.body, (text) => LABEL.test(text)).find((el) => visible(el) && !ours(el));
    const box = doc.querySelector(SLOTS);
    if (!label && !(box && visible(box))) return null;
    // The page's skill: the nearest heading above the slots that names one.
    const headings = leaves(doc.body, (text) => SKILLING_SKILLS.includes(text.toLowerCase())).filter((el) => visible(el) && !ours(el) && !el.closest(NAV));
    let skill = null;
    for (let node = (label || box).parentElement; node && node !== doc.body && !skill; node = node.parentElement) {
        const heading = headings.find((el) => node.contains(el));
        if (heading) skill = heading.textContent.trim().toLowerCase();
    }
    if (!skill) return null; // combat, enhancing, alchemy …
    const row = box && visible(box) ? box : label.nextElementSibling;
    const slots = row ? [...row.children].filter((el) => visible(el) && !ours(el)) : [];
    if (!slots.length) return { skill, error: `no tea slots next to "Consumables" (${row ? row.tagName.toLowerCase() : "nothing"} after the label)` };
    return { skill, slots, anchor: row };
}

// The game's tea picker, when it is open: its element and the items in it.
function findPicker() {
    let menu = [...document.querySelectorAll(MENU)].find(visible);
    let items = menu ? [...menu.querySelectorAll(MENU_ITEM)] : [];
    if (!menu) {
        // Another layout: the box around the "Remove" choice and the teas next to it.
        const remove = leaves(document.body, (text) => text === "Remove").find((el) => visible(el) && !ours(el));
        for (let el = remove; el && el !== document.body && !menu; el = el.parentElement) {
            if (el.parentElement?.querySelector("svg use")) {
                items = [...el.parentElement.children];
                menu = el.parentElement.parentElement || el.parentElement;
            }
        }
    }
    return menu ? { menu, items } : null;
}

// The first job in the queue for this skill and the teas it wants.
function adviceFor(skill) {
    const type = `/action_types/${skill}`;
    const data = getClientData();
    const job = (state.character?.characterActions || []).find((a) => data.actionDetailMap[a.actionHrid]?.type === type);
    if (!job) return null;
    const settings = t.deps.settings();
    const drinks = (state.character.actionTypeDrinkSlotsMap?.[type] || []).map((slot) => slot?.itemHrid || null);
    const key = [job.actionHrid, JSON.stringify(drinks), pricesStamp(), topActionKey(settings)].join("|");
    if (t.key !== key || Date.now() - t.at > REFRESH_MS) {
        const entry = skillingAdvice(job.actionHrid, settings);
        // As in the action window: keep the teas you have unless another setup scores better.
        t.advice = entry && { action: entry.action, entry, teas: entry.betterTeas ? entry.best.result.teas : entry.current.teas, drinks };
        t.key = key;
        t.at = Date.now();
    }
    return t.advice;
}

function scan() {
    const found = state.character ? findSlots() : null;
    if (found && !found.error && (!getClientData() || !pricesStamp())) {
        t.loading ||= t.deps.prepare().then(scheduleScan, (error) => console.warn("[Combat Advisor] tea slots", error)).finally(() => (t.loading = null));
        return;
    }
    const advice = found && !found.error && getClientData() ? adviceFor(found.skill) : null;
    const marked = new Set();
    let note = null;
    let noteAt = null;
    if (found?.error) {
        note = `<span class="mwia-dim">Combat Advisor${VERSION ? " " + VERSION : ""}: can't mark the teas – ${esc(found.error)}.</span>`;
        noteAt = (leaves(document.body, (text) => LABEL.test(text)).find(visible) || {}).parentElement;
    } else if (advice) {
        const right = new Set(advice.teas);
        const inSlots = found.slots.map(iconItem);
        const missing = advice.teas.filter((hrid) => !inSlots.includes(hrid));
        let empty = missing.length;
        found.slots.forEach((slot, i) => {
            if (/require/i.test(slot.textContent)) return; // a locked slot
            const hrid = inSlots[i];
            const wrong = hrid ? !right.has(hrid) : empty-- > 0;
            if (wrong) {
                mark(slot, "wrong", hrid ? `Not for ${advice.action.name}: ${advice.teas.length ? "use " + advice.teas.map(itemName).join(", ") : "no tea pays"}` : `Empty: put in ${missing.map(itemName).join(" or ")}`);
                marked.add(slot);
            }
        });
        const picker = findPicker();
        if (picker) {
            const anyWrong = inSlots.some((hrid) => hrid && !right.has(hrid));
            for (const item of picker.items) {
                const hrid = iconItem(item);
                // Green: a right tea not in a slot yet, or "Remove" when a wrong tea has nothing to replace it.
                const good = hrid ? right.has(hrid) && !inSlots.includes(hrid) : /^remove$/i.test(item.textContent.trim()) && anyWrong && !missing.length;
                if (good) {
                    mark(item, "right", hrid ? `Right for ${advice.action.name}` : "Take the wrong tea out");
                    marked.add(item);
                }
            }
            note = noteHtml(advice);
            noteAt = note ? picker.menu : null;
        }
    }
    document.querySelectorAll("[data-mwia-tea]").forEach((el) => marked.has(el) || unmark(el));
    document.querySelectorAll(".mwia-tea-note").forEach((box) => (box.parentElement === noteAt && note) || box.remove());
    if (!note || !noteAt) return;
    let box = noteAt.querySelector(":scope > .mwia-tea-note");
    if (!box) {
        box = document.createElement("div");
        box.className = "mwia-tea-note";
        noteAt.appendChild(box);
    }
    if (box.dataset.html !== note) {
        box.dataset.html = note;
        box.innerHTML = note;
    }
}

function mark(el, kind, title) {
    if (el.dataset.mwiaTea !== kind) el.dataset.mwiaTea = kind;
    if (el.title !== title) el.title = title;
}

function unmark(el) {
    delete el.dataset.mwiaTea;
    el.removeAttribute("title");
}

// In the picker: the right teas you don't have, and a button for 8 hours of all of them.
function noteHtml(advice) {
    const lacking = advice.teas.filter((hrid) => have(hrid) <= 0);
    if (!lacking.length) return t.status ? `<div class="mwia-guide-status">${esc(t.status)}</div>` : "";
    // Every right tea topped up to 8 hours, not only the missing ones.
    const perTea = Math.ceil(TEA_HOURS * advice.entry.current.drinksPerHour);
    const items = advice.teas.map((hrid) => ({ hrid, quantity: perTea - have(hrid) })).filter((i) => i.quantity > 0);
    const button = items.length
        ? `<button class="mwia-guide-cart" data-tea-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", "))}">🛒 ${TEA_HOURS} h of teas</button>`
        : "";
    return `<div><b>Missing for ${esc(advice.action.name)}:</b> ${esc(lacking.map(itemName).join(", "))}</div>
        <div class="mwia-dim">${TEA_HOURS} h is ${perTea} of each (${skillLabel(advice.action.type.split("/").pop())} job first in your queue).</div>
        ${button}${t.status ? `<div class="mwia-guide-status">${esc(t.status)}</div>` : ""}`;
}

async function onClick(event) {
    const button = event.target.closest?.(".mwia-tea-note [data-tea-cart]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const names = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
        const outcome = await t.deps.addToCart(JSON.parse(button.dataset.teaCart));
        const parts = [];
        if (outcome.added.length) parts.push(`added ${names(outcome.added)}`);
        if (outcome.updated.length) parts.push(`topped up ${names(outcome.updated)}`);
        if (outcome.present.length) parts.push(`${names(outcome.present)} already in the cart`);
        if (outcome.failed.length) parts.push(`could not add ${names(outcome.failed)}`);
        t.status = "Cart: " + parts.join("; ") + ".";
    } catch (error) {
        t.status = error.message;
    }
    scheduleScan();
}
