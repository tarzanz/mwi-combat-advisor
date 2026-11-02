// A diagnosis for the game's Loot & XP Log: under its heading, a box with the
// messages the game sent around the time the log was opened (the ones the
// advisor doesn't read yet), each with its fields' shape and the start of its
// text, and a 📋 Copy for the chat. The job log is to be built on what the log
// is sent. Chat messages are never kept; of what the game sends, only the type.

import { otherMessages, sentTypes } from "./game-state.js";
import { visible } from "./game-nav.js";
import { esc } from "./format.js";

const VERSION = typeof GM_info !== "undefined" ? GM_info.script?.version || "" : "";
const HEADING = /^loot\s*&\s*xp\s*log$/i;
// Messages this long before the log was opened count too (it may have been fetched as it opened).
const BEFORE_MS = 60 * 1000;
const SAMPLE_CHARS = 1500;

const d = { timer: null, openedAt: null };

export function startLootLogDiagnosis() {
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-lootdiag"))) return;
        schedule();
    }).observe(document.body, { childList: true, subtree: true });
    // New messages change the box even when the page doesn't.
    setInterval(() => d.openedAt && schedule(), 1500);
}

function schedule() {
    if (d.timer) return;
    d.timer = setTimeout(() => {
        d.timer = null;
        scan();
    }, 300);
}

function findHeading() {
    return [...document.querySelectorAll("div,h1,h2,h3,span")].find((el) => el.children.length === 0 && HEADING.test(el.textContent.trim()) && visible(el)) || null;
}

function scan() {
    const heading = findHeading();
    let box = document.querySelector(".mwia-lootdiag");
    if (!heading) {
        box?.remove();
        d.openedAt = null;
        return;
    }
    d.openedAt ??= Date.now();
    if (!box) {
        box = document.createElement("div");
        box.className = "mwia-lootdiag";
        box.addEventListener("click", onClick);
        heading.insertAdjacentElement("afterend", box);
    }
    const messages = otherMessages().filter((m) => m.at >= d.openedAt - BEFORE_MS);
    const html = boxHtml(messages);
    if (box.dataset.html !== html) {
        box.dataset.html = html;
        box.innerHTML = html;
    }
}

function boxHtml(messages) {
    const time = (at) => new Date(at).toTimeString().slice(0, 8);
    const list = messages.length ? messages.map((m) => `${esc(m.type)} · ${(m.size / 1024).toFixed(1)} kB · ${time(m.at)}`).join("<br>") : "none yet – tap Refresh";
    return `<b>🧭 MWI Advisor ${esc(VERSION)} – diagnosis</b><br>Tap <i>Refresh</i>, then 📋 Copy and paste it in the chat.<br><span class="mwia-lootdiag-list">${list}</span><br><button type="button" data-lootdiag="copy">📋 Copy</button>`;
}

// What a value looks like: keys and types, arrays with their length and first element.
export function shape(value, depth = 0) {
    if (Array.isArray(value)) return value.length ? `[${value.length} × ${shape(value[0], depth + 1)}]` : "[]";
    if (value && typeof value === "object") {
        if (depth >= 5) return "{…}";
        const entries = Object.entries(value);
        const shown = entries.slice(0, 30).map(([k, v]) => `${k}: ${shape(v, depth + 1)}`);
        if (entries.length > 30) shown.push(`… ${entries.length - 30} more keys`);
        return `{${shown.join(", ")}}`;
    }
    if (typeof value === "string") return JSON.stringify(value.length > 60 ? value.slice(0, 60) + "…" : value);
    return String(value);
}

export function diagnosisText(messages, sent, openedAt, agent = navigator.userAgent) {
    const time = (at) => new Date(at).toTimeString().slice(0, 8);
    const lines = [`MWI Advisor v${VERSION} · Loot & XP Log diagnosis · log opened ${time(openedAt)} · ${agent}`];
    const recentSent = sent.filter((s) => s.at >= openedAt - BEFORE_MS);
    lines.push(`Sent by the game: ${recentSent.map((s) => `${s.type} ${time(s.at)}`).join(", ") || "nothing"}`);
    for (const m of messages) {
        lines.push("", `== ${m.type} · ${m.size} chars · ${time(m.at)}`);
        try {
            lines.push(shape(JSON.parse(m.raw)));
        } catch {
            lines.push("(cut off: shape from the start only)");
        }
        lines.push(m.raw.slice(0, SAMPLE_CHARS));
    }
    return lines.join("\n");
}

async function onClick(event) {
    const button = event.target.closest?.("[data-lootdiag]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const messages = otherMessages().filter((m) => m.at >= (d.openedAt ?? Date.now()) - BEFORE_MS);
    const text = diagnosisText(messages, sentTypes(), d.openedAt ?? Date.now());
    let copied = false;
    try {
        await navigator.clipboard.writeText(text);
        copied = true;
    } catch {
        const area = document.createElement("textarea");
        area.value = text;
        area.setAttribute("readonly", "");
        area.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(area);
        area.select();
        area.setSelectionRange(0, text.length);
        try {
            copied = document.execCommand("copy");
        } catch {
            copied = false;
        }
        area.remove();
    }
    button.textContent = copied ? "✓ Copied" : "Couldn't copy";
    if (!copied) {
        // Show it to select by hand.
        const area = document.createElement("textarea");
        area.value = text;
        area.readOnly = true;
        area.className = "mwia-lootdiag-text";
        button.insertAdjacentElement("afterend", area);
    }
}
