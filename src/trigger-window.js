// What the game's "Combat Triggers" window is made of, for filling it in later:
// its elements (are the dropdowns <select>s or the game's own?), the React
// component that holds the conditions (its state, methods and props – which
// ability or food it is for), the loadout's ability and consumable slots, and
// the last few clicks (which gear icon opened it). Read only: nothing is changed.

import { componentMethods, describe, iconIds, visible, walkFibers, worldReport } from "./game-nav.js";

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
    const title = [...document.querySelectorAll("body *")].find((el) => el.children.length === 0 && clean(el.textContent) === "Combat Triggers" && visible(el));
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

// The React components whose state or props hold a list of trigger conditions.
function triggerComponents() {
    const found = [];
    walkFibers((f) => {
        if (found.length >= 4) return true;
        const state = attempt(() => f.stateNode?.state);
        const props = f.memoizedProps;
        const hooks = [];
        for (let h = f.memoizedState, i = 0; h && typeof h === "object" && i < 30; h = h.next, i++) hooks.push(attempt(() => h.memoizedState));
        const inState = state && typeof state === "object" && Object.values(state).some(holdsTriggers);
        const inHooks = !state && hooks.some(holdsTriggers);
        const inProps = props && typeof props === "object" && Object.values(props).some(holdsTriggers);
        if (!inState && !inHooks && !inProps) return false;
        const lines = [`component ${typeName(f)} (${f.stateNode && typeof f.stateNode === "object" && !(f.stateNode instanceof Element) ? "class" : "function"}) – conditions in ${[inState && "state", inHooks && "hooks", inProps && "props"].filter(Boolean).join("+")}`];
        if (state) lines.push(`  state: ${Object.entries(state).map(([k, v]) => `${k}=${valueText(v)}`).join("; ")}`);
        if (inHooks) lines.push(`  hooks: ${hooks.map(valueText).join("; ")}`);
        if (props) lines.push(`  props: ${Object.entries(props).filter(([k]) => k !== "children").map(([k, v]) => `${k}=${valueText(v)}`).join("; ")}`);
        if (f.stateNode && typeof f.stateNode === "object" && !(f.stateNode instanceof Element)) lines.push(`  methods: ${componentMethods(f.stateNode).slice(0, 40).join(", ")}`);
        const parents = [];
        for (let p = f.return; p && parents.length < 4; p = p.return) if (typeof p.type !== "string") parents.push(typeName(p));
        lines.push(`  inside: ${parents.join(" < ")}`);
        found.push(lines.join("\n"));
        return false;
    });
    return found;
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
    }
    lines.push(...triggerComponents());
    if (lines.length < MAX_LINES) loadoutRows(lines);
    lines.push(`last clicks: ${clicks.join(" || ") || "none"}`);
    return lines.join("\n");
}
