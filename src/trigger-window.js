// What the game's "Combat Triggers" window is made of, for filling it in later:
// its elements (are the dropdowns <select>s or the game's own?), the React
// component that holds the conditions (its state, methods and props – which
// ability or food it is for), the loadout's ability and consumable slots, and
// the last few clicks (which gear icon opened it). Read only: nothing is changed.

import { componentMethods, describe, iconIds, visible, walkFibers, worldReport } from "./game-nav.js";
import { esc } from "./format.js";
import { fillTriggerWindow, sameTriggers, settingFiber, shownTriggers, windowTarget } from "./trigger-fill.js";

const MAX_LINES = 160;
const clicks = []; // the last few clicks: what was clicked and the icons around it

const attempt = (read, fallback = null) => {
    try {
        return read();
    } catch {
        return fallback;
    }
};
const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
const short = (text, n = 40) => (text.length > n ? text.slice(0, n) + "…" : text);

// Remembers what was clicked, so the report can say which gear icon opened the window.
export function watchTriggerClicks() {
    document.addEventListener(
        "click",
        (event) => {
            const target = event.target instanceof Element ? event.target : null;
            if (!target || target.closest(".mwia-panel, .mwia-launcher")) return;
            const chain = [];
            for (let node = target; node && node !== document.body && chain.length < 4; node = node.parentElement) chain.push(describe(node));
            // The nearest ancestor (up to 4 levels) with an icon other than the clicked one's own.
            let around = "";
            for (let node = target.parentElement, i = 0; node && i < 4; node = node.parentElement, i++) {
                const ids = iconIds(node).filter(Boolean);
                if (ids.length > iconIds(target).length) {
                    around = ids.join("+");
                    break;
                }
            }
            clicks.push(`${chain.join(" < ")} {${iconIds(target).join("+")}} around [${around}]`);
            if (clicks.length > 4) clicks.shift();
        },
        true
    );
}

function triggerWindow() {
    const title = [...document.querySelectorAll("body *")].find((el) => !el.closest('[class*="mwia"]') && ownText(el) === "Combat Triggers" && visible(el));
    if (!title) return { title: null, box: null };
    let box = title.parentElement;
    while (box && box !== document.body && ![...box.querySelectorAll("button")].some((b) => clean(b.textContent) === "Save")) box = box.parentElement;
    return { title, box: box && box !== document.body ? box : title.parentElement };
}

function attrs(el) {
    const out = [];
    for (const name of ["role", "type", "aria-haspopup", "aria-expanded", "tabindex", "value", "name"]) {
        const v = el.getAttribute(name);
        if (v !== null) out.push(`${name}=${short(v, 20)}`);
    }
    if (el.tagName === "INPUT" || el.tagName === "SELECT") out.push(`value="${short(String(el.value), 20)}"`);
    return out.length ? ` (${out.join(" ")})` : "";
}

function ownText(el) {
    return clean([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" "));
}

// An indented outline of the element tree: tag.class, a few attributes, its own text, icons.
function outline(root, maxDepth, lines) {
    const walk = (el, depth) => {
        if (lines.length >= MAX_LINES || depth > maxDepth) return;
        const text = ownText(el);
        const icons = el.tagName.toLowerCase() === "use" ? ` #${(el.getAttribute("href") || el.getAttribute("xlink:href") || "").split("#")[1] || ""}` : "";
        lines.push(`${"  ".repeat(depth)}${describe(el)}${attrs(el)}${text ? ` "${short(text)}"` : ""}${icons}`);
        if (el.tagName === "SELECT") {
            lines.push(`${"  ".repeat(depth + 1)}options: ${[...el.options].map((o) => `${o.value}=${short(clean(o.textContent), 20)}`).join(" | ")}`);
            return;
        }
        for (const child of el.children) walk(child, depth + 1);
    };
    walk(root, 0);
}

const isTrigger = (t) => t && typeof t === "object" && typeof t.conditionHrid === "string";
const holdsTriggers = (v) => Array.isArray(v) && v.length > 0 && v.every(isTrigger);
const typeName = (f) => attempt(() => (typeof f.type === "string" ? f.type : f.type?.displayName || f.type?.name || "?"), "?");
const valueText = (v) => (holdsTriggers(v) ? JSON.stringify(v.map((t) => [t.dependencyHrid, t.conditionHrid, t.comparatorHrid, t.value].map((x) => String(x).split("/").pop()))) : Array.isArray(v) ? `[${v.length}]` : typeof v === "object" && v ? `{${Object.keys(v).slice(0, 8).join(",")}}` : typeof v === "function" ? "fn" : short(String(v), 40));

const isClass = (f) => !!(f.stateNode && typeof f.stateNode === "object" && !(f.stateNode instanceof Element) && f.stateNode.setState);
function hookValues(f) {
    const out = [];
    for (let h = f.memoizedState, i = 0; h && typeof h === "object" && "next" in h && i < 30; h = h.next, i++) out.push(attempt(() => h.memoizedState));
    return out;
}
const propsText = (props) => Object.entries(props || {}).filter(([k]) => k !== "children").map(([k, v]) => `${k}=${valueText(v)}`).join("; ");

// The game's slot components that hold conditions in their props: one line each.
function triggerComponents() {
    const found = [];
    walkFibers((f) => {
        if (found.length >= 16) return true;
        const props = f.memoizedProps;
        if (typeof f.type === "string" || !props || typeof props !== "object" || !Object.values(props).some(holdsTriggers)) return false;
        const fns = Object.entries(props).filter(([, v]) => typeof v === "function").map(([k]) => k);
        const what = props.abilityHrid || props.itemHrid || Object.entries(props).find(([k, v]) => /hrid/i.test(k) && typeof v === "string")?.[1] || "?";
        const triggers = Object.values(props).find(holdsTriggers);
        found.push(`slot ${typeName(f)}: ${String(what).split("/").pop()} ${Object.entries(props).filter(([k, v]) => /slot|type/i.test(k) && typeof v !== "function" && typeof v !== "object").map(([k, v]) => `${k}=${String(v).split("/").pop()}`).join(" ")} ${valueText(triggers)} fns: ${fns.join(",")}`);
        return false;
    });
    return found;
}

// The open window's own React components: from its element up, what each holds –
// where its copy of the conditions lives, and what the dropdowns and the value field call.
function windowFibers(box) {
    const lines = [];
    const host = walkFibers((f) => f.stateNode === box).fiber;
    if (!host) return ["window fiber: not found from the React root"];
    let n = 0;
    for (let f = host.return; f && n < 14; f = f.return) {
        if (typeof f.type === "string") continue;
        n++;
        const hooks = hookValues(f);
        lines.push(`up ${n}: ${typeName(f)}${isClass(f) ? " (class)" : ""}`);
        const props = propsText(f.memoizedProps);
        if (props) lines.push(`  props: ${short(props, 400)}`);
        if (isClass(f)) {
            lines.push(`  state: ${short(Object.entries(f.stateNode.state || {}).map(([k, v]) => `${k}=${valueText(v)}`).join("; "), 400)}`);
            lines.push(`  methods: ${componentMethods(f.stateNode).slice(0, 30).join(", ")}`);
        } else if (hooks.length) {
            lines.push(`  hooks: ${short(hooks.map((v, i) => `${i}:${valueText(v)}`).join("; "), 400)}`);
        }
        if (Object.values(f.memoizedProps || {}).some(holdsTriggers) && n > 2) break;
    }
    // What the window's form elements are wired to.
    for (const el of [box.querySelector("select"), box.querySelector("input"), box.querySelector('[role="button"],[aria-haspopup]')].filter(Boolean)) {
        const fiber = walkFibers((f) => f.stateNode === el).fiber;
        lines.push(`${describe(el)} props: ${fiber ? Object.keys(fiber.memoizedProps || {}).join(",") : "fiber not found"}`);
    }
    return lines;
}
// The loadout's Abilities and Consumables rows: their slots, icons and gear buttons.
function loadoutRows(lines) {
    for (const label of ["Abilities", "Consumables"]) {
        const heading = [...document.querySelectorAll("body *")].find((el) => el.children.length === 0 && clean(el.textContent) === label && visible(el) && !el.closest(".mwia-panel"));
        if (!heading) {
            lines.push(`${label}: heading not found`);
            continue;
        }
        lines.push(`${label}: heading ${describe(heading)} in ${describe(heading.parentElement)}`);
        const row = heading.nextElementSibling || heading.parentElement?.nextElementSibling;
        if (row) outline(row, 4, lines);
    }
}

// The whole report, as text to copy.
export function triggerWindowReport() {
    const lines = [`world: ${worldReport()}`];
    const { title, box } = triggerWindow();
    if (!box) {
        lines.push("trigger window: not open – open a loadout's ⚙ under an ability, then tap the button again");
    } else {
        const chain = [];
        for (let node = title; node && node !== document.body && chain.length < 8; node = node.parentElement) chain.push(describe(node));
        lines.push(`trigger window: ${chain.join(" < ")}`);
        outline(box, 12, lines);
        lines.push(...windowFibers(box));
        const setting = settingFiber(box);
        lines.push(`setting component: ${setting ? typeName(setting) : "not found"}, for ${windowTarget(setting) || "?"}`);
        for (let h = setting?.memoizedState, i = 0; h && typeof h === "object" && "next" in h && i < 40; h = h.next, i++) {
            lines.push(`  hook ${i}: ${valueText(attempt(() => h.memoizedState))}${typeof h.queue?.dispatch === "function" ? " (dispatch)" : ""}`);
        }
    }
    lines.push(...triggerComponents());
    if (lines.length < MAX_LINES) loadoutRows(lines);
    lines.push(`last clicks: ${clicks.join(" || ") || "none"}`);
    return lines.join("\n");
}

// A small bar inside the game's Combat Triggers window (a tap there doesn't close it,
// as one on the 🧭 panel does): the advice for that ability or food from the last
// Upgrades analysis with ▶ Fill in, and 📋 to read the window for a chat.
// deps: advice(hrid) -> { triggers } | null, describe(triggers) -> text, name(hrid) -> text,
// onReport(text, copied) – hands a report to the panel, to copy from there.
export function startTriggerWindow(deps) {
    let timer = null;
    const scan = () => {
        timer = null;
        const { box } = triggerWindow();
        if (!box || box.querySelector(".mwia-trig-bar")) return;
        const fiber = settingFiber(box);
        const hrid = windowTarget(fiber);
        const advice = hrid ? deps.advice(hrid) : null;
        const bar = document.createElement("div");
        bar.className = "mwia-trig-bar";
        const now = shownTriggers(box);
        let line;
        if (!hrid) line = "🧭 Can't tell which ability or food this window is for.";
        else if (!advice) line = `🧭 ${esc(deps.name(hrid))}: no trigger change in the last Upgrades analysis.`;
        else if (sameTriggers(now, advice.triggers)) line = `🧭 ${esc(deps.name(hrid))}: already as advised.`;
        else line = `🧭 Advice for ${esc(deps.name(hrid))}: <b>${esc(deps.describe(advice.triggers))}</b> <button type="button" class="mwia-trig-fill">▶ Fill in</button>`;
        bar.innerHTML = `<div class="mwia-trig-line">${line}</div><div><button type="button" class="mwia-trig-read" title="Read how this window is built, to paste into a chat">📋</button> <span class="mwia-trig-status"></span></div>`;
        const status = (text) => (bar.querySelector(".mwia-trig-status").textContent = text);
        bar.querySelector(".mwia-trig-fill")?.addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            status("Filling in…");
            const result = await fillTriggerWindow(box, settingFiber(box) || fiber, advice.triggers);
            if (result.ok) {
                status("Filled in – check it and tap Save.");
            } else {
                status("Couldn't fill it in – the details are under 🧭 Upgrades.");
                deps.onReport(`fill in ${hrid}: ${result.diag}\n${triggerWindowReport()}`, false);
            }
        });
        bar.querySelector(".mwia-trig-read").addEventListener("click", async (event) => {
            event.preventDefault();
            event.stopPropagation();
            const report = triggerWindowReport();
            let copied = false;
            try {
                await navigator.clipboard.writeText(report);
                copied = true;
            } catch {
                // the panel keeps it to copy from
            }
            status(copied ? "Copied – paste it in the chat." : "Not copied – open 🧭 Upgrades and tap 📋 Copy.");
            deps.onReport(report, copied);
        });
        box.prepend(bar);
    };
    new MutationObserver((records) => {
        if (timer || records.every((r) => r.target.closest?.(".mwia-trig-bar"))) return;
        timer = setTimeout(scan, 200);
    }).observe(document.body, { childList: true, subtree: true });
}
