// Fills in the game's Combat Triggers window with the triggers the last Upgrades
// analysis advised for that ability or food – the player still taps the game's Save.
//
// The window (an MUI tooltip opened by a slot's ⚙) belongs to a component whose props
// name the slot (itemHrid / abilityHrid) and its saved conditions (combatTriggers);
// the window's own, editable copy is a state hook of that component. The advice goes
// into that copy, as an edit in the window would. Should the window not show it
// afterwards, the window's own controls are used: + Condition, 🗑, the dropdowns and
// the value field. Nothing here saves: the slot's update handler is never called.

import { setReactInput, visible, walkFibers } from "./game-nav.js";

const ROW = '[class*="CombatTriggersSetting_combatTrigger_"]';
const COMBO = '[role="combobox"]';
const NATIVE = "input.MuiSelect-nativeInput, input[class*='nativeInput']";
const VALUE = 'input[type="number"]';
const LISTBOX = '[role="listbox"]';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
const isTrigger = (t) => t && typeof t === "object" && typeof t.conditionHrid === "string";
const holdsTriggers = (v) => Array.isArray(v) && v.every(isTrigger);
const key = (t) => [t.dependencyHrid, t.conditionHrid, t.comparatorHrid, Number(t.value) || 0].join(":");
export const sameTriggers = (a, b) => a.length === b.length && a.every((t, i) => key(t) === key(b[i]));

// The component behind the window: the first one up from it with the slot's conditions and update handler.
export function settingFiber(box) {
    const host = walkFibers((f) => f.stateNode === box).fiber;
    for (let f = host?.return, i = 0; f && i < 80; f = f.return, i++) {
        const p = f.memoizedProps;
        if (typeof f.type !== "string" && p && typeof p === "object" && typeof p.updateCombatTriggersHandler === "function" && Object.values(p).some((v) => Array.isArray(v) && holdsTriggers(v))) return f;
    }
    return null;
}

// Which ability or item the window is for.
export function windowTarget(fiber) {
    const p = fiber?.memoizedProps || {};
    const hrid = p.abilityHrid || p.itemHrid || Object.values(p).find((v) => typeof v === "string" && /^\/(abilities|items)\//.test(v));
    return hrid || null;
}

// The window's editable copy: a state hook holding a list of conditions, with its dispatch.
function editHook(fiber) {
    const found = [];
    for (let h = fiber?.memoizedState, i = 0; h && typeof h === "object" && "next" in h && i < 40; h = h.next, i++) {
        if (Array.isArray(h.memoizedState) && h.memoizedState.length > 0 && holdsTriggers(h.memoizedState) && typeof h.queue?.dispatch === "function") found.push(h);
    }
    // The copy is the one still the props' list or changed from it; with several, the last (most local).
    return found[found.length - 1] || null;
}

// What the window shows now: one { dependencyHrid, conditionHrid, comparatorHrid, value } per row.
export function shownTriggers(box) {
    return [...box.querySelectorAll(ROW)].map((row) => {
        const natives = [...row.querySelectorAll(NATIVE)].map((input) => input.value);
        const value = row.querySelector(VALUE);
        return { dependencyHrid: natives[0] || "", conditionHrid: natives[1] || "", comparatorHrid: natives[2] || "", value: value ? Number(value.value) || 0 : 0 };
    });
}

// The advice in the shape of the window's own conditions (value a string if theirs are).
function shaped(triggers, template) {
    const asString = typeof template?.value === "string";
    return triggers.map((t) => ({ ...(template || {}), dependencyHrid: t.dependencyHrid, conditionHrid: t.conditionHrid, comparatorHrid: t.comparatorHrid, value: asString ? String(t.value ?? 0) : Number(t.value ?? 0) }));
}

async function fillByState(fiber, triggers) {
    const hook = editHook(fiber);
    if (!hook) return "no state hook with the conditions";
    hook.queue.dispatch(shaped(triggers, hook.memoizedState[0]));
    await sleep(150);
    return null;
}

const button = (box, label) => [...box.querySelectorAll("button")].find((b) => clean(b.textContent) === label);

// Picks an option of an MUI dropdown by its value: opens the menu and clicks the option.
export async function pick(combo, value) {
    const native = combo.parentElement?.querySelector(NATIVE);
    if (native?.value === value) return true;
    combo.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, button: 0 }));
    let option = null;
    for (let i = 0; i < 20 && !option; i++) {
        await sleep(50);
        option = [...document.querySelectorAll(`${LISTBOX} [data-value]`)].find((o) => o.getAttribute("data-value") === value && visible(o));
    }
    if (!option) {
        // Close the menu as Escape would (on the list), else through its backdrop.
        for (const list of document.querySelectorAll(LISTBOX)) list.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        await sleep(100);
        if ([...document.querySelectorAll(LISTBOX)].some(visible)) document.querySelector('[class*="MuiBackdrop"]')?.click();
        await sleep(100);
        return false;
    }
    option.click();
    await sleep(120);
    return combo.parentElement?.querySelector(NATIVE)?.value === value;
}

async function fillByControls(box, triggers) {
    for (let i = 0; i < 6 && box.querySelectorAll(ROW).length < triggers.length; i++) {
        button(box, "+ Condition")?.click();
        await sleep(120);
    }
    for (let i = 0; i < 6 && box.querySelectorAll(ROW).length > triggers.length; i++) {
        const rows = box.querySelectorAll(ROW);
        rows[rows.length - 1].querySelector("button")?.click();
        await sleep(120);
    }
    const rows = [...box.querySelectorAll(ROW)];
    if (rows.length !== triggers.length) return `rows ${rows.length}, wanted ${triggers.length}`;
    for (let i = 0; i < triggers.length; i++) {
        const t = triggers[i];
        for (const [k, hrid] of [[0, t.dependencyHrid], [1, t.conditionHrid], [2, t.comparatorHrid]]) {
            const combo = box.querySelectorAll(ROW)[i]?.querySelectorAll(COMBO)[k];
            if (!combo || !(await pick(combo, hrid))) return `row ${i + 1}: could not pick ${hrid.split("/").pop()}`;
        }
        const input = box.querySelectorAll(ROW)[i]?.querySelector(VALUE);
        if (input && Number(input.value) !== Number(t.value)) {
            setReactInput(input, String(t.value));
            await sleep(80);
        }
    }
    return null;
}

// Fills the open window's conditions. Returns { ok, how, diag }.
export async function fillTriggerWindow(box, fiber, triggers) {
    const steps = [];
    if (fiber) {
        const failed = await fillByState(fiber, triggers);
        steps.push(`state: ${failed || "set"}`);
        if (!failed && sameTriggers(shownTriggers(box), triggers)) return { ok: true, how: "state", diag: steps.join(" · ") };
        if (!failed) steps.push(`window shows ${JSON.stringify(shownTriggers(box).map(key))}`);
    } else steps.push("no component found for the window");
    let failed;
    try {
        failed = await fillByControls(box, triggers);
    } catch (error) {
        failed = `controls threw ${error?.message || error}`;
    }
    steps.push(`controls: ${failed || "done"}`);
    const ok = !failed && sameTriggers(shownTriggers(box), triggers);
    if (!ok) steps.push(`window shows ${JSON.stringify(shownTriggers(box).map(key))}, wanted ${JSON.stringify(triggers.map(key))}`);
    return { ok, how: "controls", diag: steps.join(" · ") };
}
