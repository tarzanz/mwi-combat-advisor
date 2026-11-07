// What the game's Labyrinth is made of, for building the guide on its map (and in its
// automation settings) later: the messages the game sent about it (their types and the
// shape of their data), the character's Labyrinth fields, the elements of the Labyrinth
// page and the React components with Labyrinth, room or floor data. Read only.

import { describe, visible, walkFibers, worldReport } from "./game-nav.js";
import { labyrinthMessages, state } from "./game-state.js";

const MAX_LINES = 400;
const attempt = (read, fallback = null) => {
    try {
        return read();
    } catch {
        return fallback;
    }
};
const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();
const short = (text, n = 60) => (text.length > n ? text.slice(0, n) + "…" : text);
const LAB_WORDS = /labyrinth|maze|room|floor|beacon|torch|shroud|crate|automation/i;

// A compact outline of a value: object keys with the shape of their values, arrays as
// their length and the shape of the first element, strings and numbers as a sample.
export function shapeOf(value, depth = 0) {
    if (value === null || value === undefined) return String(value);
    if (typeof value === "string") return JSON.stringify(short(value, 40));
    if (typeof value !== "object") return String(value);
    if (depth >= 5) return Array.isArray(value) ? `[${value.length}]` : "{…}";
    if (Array.isArray(value)) return value.length ? `[${value.length}× ${shapeOf(value[0], depth + 1)}]` : "[]";
    const entries = Object.entries(value);
    // A map keyed by ids: one sample entry.
    if (entries.length > 12 && entries.every(([, v]) => v && typeof v === "object")) return `{${entries.length} keys like ${JSON.stringify(short(entries[0][0], 40))}: ${shapeOf(entries[0][1], depth + 1)}}`;
    return `{${entries.slice(0, 30).map(([k, v]) => `${k}: ${shapeOf(v, depth + 1)}`).join(", ")}${entries.length > 30 ? ", …" : ""}}`;
}

function messageLines(lines) {
    const log = labyrinthMessages();
    if (!log.length) {
        lines.push("messages: none mentioning the Labyrinth yet – open the Labyrinth (and a run, if you can) with the script on, then read again");
        return;
    }
    lines.push(`messages: ${log.length} kept (${[...new Set(log.map((m) => m.type))].join(", ")})`);
    // The latest of each type: its shape, then the start of its text.
    const latest = new Map();
    for (const m of log) latest.set(m.type, m);
    for (const m of latest.values()) {
        const data = attempt(() => JSON.parse(m.raw));
        lines.push(`— ${m.type} (${m.size} chars, ${new Date(m.at).toISOString().slice(0, 16)}Z)`);
        lines.push(`  shape: ${data ? shapeOf(data) : "(cut – not whole JSON)"}`);
        lines.push(`  text: ${short(m.raw, 1500)}`);
    }
}

function characterLines(lines) {
    const character = state.character;
    if (!character) {
        lines.push("character: not seen yet");
        return;
    }
    const fields = Object.keys(character).filter((k) => /labyrinth|maze/i.test(k));
    lines.push(`character fields: ${fields.join(", ") || "none with labyrinth in the name"}`);
    for (const key of fields) lines.push(`  ${key}: ${short(shapeOf(character[key]), 1200)}`);
}

function ownText(el) {
    return clean([...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join(" "));
}

// The Labyrinth's elements: the outermost ones whose class names say Labyrinth, outlined.
function pageLines(lines) {
    const all = [...document.querySelectorAll('[class*="abyrinth"]')].filter((el) => !el.closest('[class*="mwia"]'));
    const tops = all.filter((el) => !all.some((other) => other !== el && other.contains(el)));
    lines.push(`page: ${all.length} elements with "Labyrinth" in a class, ${tops.length} outermost (${tops.filter(visible).length} visible)`);
    const walk = (el, depth) => {
        if (lines.length >= MAX_LINES || depth > 9) return;
        const text = ownText(el);
        const title = el.getAttribute("title") || el.getAttribute("aria-label");
        const icons = el.tagName.toLowerCase() === "use" ? ` #${(el.getAttribute("href") || el.getAttribute("xlink:href") || "").split("#")[1] || ""}` : "";
        const style = el.getAttribute("style");
        lines.push(`${"  ".repeat(depth + 1)}${describe(el)}${text ? ` "${short(text, 40)}"` : ""}${title ? ` title="${short(title, 40)}"` : ""}${style && /grid|left|top/.test(style) ? ` style="${short(style, 60)}"` : ""}${icons}`);
        // Long lists of alike children (the rooms of a grid): the first few.
        const children = [...el.children];
        children.slice(0, 6).forEach((child) => walk(child, depth + 1));
        if (children.length > 6) lines.push(`${"  ".repeat(depth + 2)}… ${children.length - 6} more like ${describe(children[6])}`);
    };
    for (const top of tops.slice(0, 4)) walk(top, 0);
}

const typeName = (f) => attempt(() => (typeof f.type === "string" ? f.type : f.type?.displayName || f.type?.name || "?"), "?");

// React components whose props or state hold Labyrinth data: their names and its shape.
function componentLines(lines) {
    const seen = new Set();
    let count = 0;
    walkFibers((f) => {
        if (count >= 20 || lines.length >= MAX_LINES) return true;
        if (typeof f.type === "string") return false;
        const props = f.memoizedProps;
        const keys = props && typeof props === "object" ? Object.keys(props).filter((k) => k !== "children" && LAB_WORDS.test(k)) : [];
        const stateKeys = f.stateNode && typeof f.stateNode === "object" && f.stateNode.state && typeof f.stateNode.state === "object" ? Object.keys(f.stateNode.state).filter((k) => LAB_WORDS.test(k)) : [];
        if (!keys.length && !stateKeys.length) return false;
        const name = typeName(f);
        const id = `${name}:${keys.join(",")}:${stateKeys.join(",")}`;
        if (seen.has(id)) return false;
        seen.add(id);
        count++;
        lines.push(`component ${name}: ${[...keys.map((k) => `${k}=${short(shapeOf(props[k]), 400)}`), ...stateKeys.map((k) => `state.${k}=${short(shapeOf(f.stateNode.state[k]), 400)}`)].join("; ")}`);
        return false;
    });
    if (!count) lines.push("components: none with labyrinth/room/floor data in their props");
}

export function labyrinthReport() {
    const lines = [`world: ${attempt(worldReport, "?")}`];
    for (const part of [messageLines, characterLines, pageLines, componentLines]) {
        try {
            part(lines);
        } catch (error) {
            lines.push(`(${part.name} failed: ${error?.message || error})`);
        }
    }
    if (lines.length > MAX_LINES) lines.splice(MAX_LINES, lines.length - MAX_LINES, `… cut at ${MAX_LINES} lines`);
    return lines.join("\n");
}
