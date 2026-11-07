// Marks in the game's Labyrinth automation settings (Automation tab, Per-Room Settings):
// next to each monster's loadout chooser, the loadout the Labyrinth check found goes
// furthest against it, whether it is the one chosen, and how often it wins at the room
// level set in the advisor's Labyrinth tab – or "Shroud or go around" when even the best
// loses. The last check is kept in this browser, so the marks stay after a reload.

import { getClientData } from "./game-data.js";
import { esc } from "./format.js";
import { visible } from "./game-nav.js";
import { RISKY_WIN, SAFE_WIN, floorAt, floorLevel, winAt } from "./labyrinth.js";

const SCAN_MS = 400;
const STORE = "mwia-laby-check";
const TABLE = 'table[class*="LabyrinthPanel_automationTable"]';
const LABEL = '[class*="LabyrinthPanel_roomLabel"]';
const CHOSEN = 'input[class*="MuiSelect-nativeInput"], input[class*="nativeInput"]';
const MARK = "mwia-laby-mark";
const NOTE = "mwia-laby-note";

const m = { deps: null, scanTimer: null, stored: undefined };
const pct = (x) => `${Math.round(100 * x)}%`;

// The check, small enough to keep: per monster its best loadout and the win curve.
export function rememberLabyrinth(lab) {
    if (!lab) return;
    const kept = {
        at: Date.now(),
        monsters: lab.monsters.map((x) => ({ hrid: x.hrid, setupId: x.setupId, setupName: x.setupName, safe: x.safe, curve: x.curve.map((p) => ({ level: p.level, wins: p.wins, attempts: p.attempts })) })),
    };
    m.stored = kept;
    try {
        localStorage.setItem(STORE, JSON.stringify(kept));
    } catch {
        // Not kept: the marks last until the page is reloaded.
    }
    scheduleScan();
}

function lastCheck() {
    if (m.stored === undefined) {
        try {
            m.stored = JSON.parse(localStorage.getItem(STORE) || "null");
        } catch {
            m.stored = null;
        }
    }
    return m.stored;
}

// deps: level() -> the room level set in the Labyrinth tab.
export function startLabyrinthMarks(deps) {
    m.deps = deps;
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(`.${MARK}, .${NOTE}`))) return; // our own marks
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    scheduleScan();
}

export function scheduleScan() {
    if (m.scanTimer || !m.deps) return;
    m.scanTimer = setTimeout(() => {
        m.scanTimer = null;
        try {
            scan();
        } catch (error) {
            console.warn("[MWI Advisor] labyrinth marks", error);
        }
    }, SCAN_MS);
}

// The monster a row is for: its icon (#mimic), else its name.
function rowMonster(row, monsters, data) {
    const label = row.querySelector(LABEL) || row.querySelector("td");
    if (!label) return null;
    const use = label.querySelector("use");
    const icon = (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#")[1];
    const name = label.textContent.replace(/\s+/g, " ").trim().toLowerCase();
    return monsters.find((x) => x.hrid === `/monsters/${icon}`) || monsters.find((x) => (data?.combatMonsterDetailMap?.[x.hrid]?.name || "").toLowerCase() === name) || null;
}

export function markFor(monster, chosenId, level) {
    const win = winAt(monster.curve, level) ?? 0;
    const kind = win >= SAFE_WIN ? "ok" : win >= RISKY_WIN ? "warn" : "bad";
    const name = esc(monster.setupName);
    const saved = monster.setupId !== "equipped";
    const chosen = saved && String(chosenId) === String(monster.setupId);
    const floor = monster.safe === null ? "never safe" : floorAt(monster.safe) ? `safe to floor ${floorAt(monster.safe)}` : `safe to level ${Math.round(monster.safe)}`;
    let text;
    if (kind === "bad") text = `✖ Shroud or go around · best ${name}: ${pct(win)}`;
    else if (!saved) text = `${kind === "ok" ? "✅" : "⚠"} What you wear now (${pct(win)}) – save it as a loadout to pick it`;
    else if (chosen) text = `${kind === "ok" ? "✅" : "⚠"} ${name} · ${pct(win)}`;
    else text = `👉 Pick ${name} · ${pct(win)}`;
    const title = `MWI Advisor: ${pct(win)} of the rooms won at room level ${level} with ${monster.setupName} (${floor})`;
    return { kind, chosen, text, title };
}

function scan() {
    const tables = [...document.querySelectorAll(TABLE)].filter(visible);
    const check = lastCheck();
    const level = m.deps.level();
    for (const table of tables) {
        note(table, check, level);
        if (!check) continue;
        const data = getClientData();
        for (const row of table.querySelectorAll("tbody tr")) {
            const monster = rowMonster(row, check.monsters, data);
            if (!monster) continue;
            const cell = row.children[1] || row.lastElementChild;
            const chosenId = row.querySelector(CHOSEN)?.value ?? "";
            const mark = markFor(monster, chosenId, level);
            const cls = `${MARK} mwia-laby-${mark.kind}${mark.chosen ? "" : " mwia-laby-pick"}`;
            let el = cell.querySelector(`.${MARK}`);
            if (!el) {
                el = document.createElement("div");
                cell.appendChild(el);
            }
            if (el.className !== cls) el.className = cls;
            if (el.dataset.html !== mark.text) el.innerHTML = el.dataset.html = mark.text;
            if (el.title !== mark.title) el.title = mark.title;
        }
    }
}

// A line above the table: what the marks are, or how to get them.
function note(table, check, level) {
    let el = table.previousElementSibling?.classList?.contains(NOTE) ? table.previousElementSibling : null;
    if (!el) {
        el = document.createElement("div");
        el.className = NOTE;
        table.parentElement.insertBefore(el, table);
    }
    const floor = floorAt(level) && floorLevel(floorAt(level)) === level ? ` (floor ${floorAt(level)}, a guess)` : "";
    const html = check
        ? `🧭 MWI Advisor: the loadout to pick for each monster at room level ${level}${floor} – change it in 🧭 → Labyrinth. Checked ${new Date(check.at).toLocaleDateString()}; check again after changing gear.`
        : `🧭 MWI Advisor: tap <b>Check the rooms</b> in 🧭 → Labyrinth, and each monster here gets the loadout to pick.`;
    if (el.dataset.html !== html) el.innerHTML = el.dataset.html = html;
}
