// Marks in the game's Labyrinth automation settings (Automation tab, Per-Room Settings):
// next to each monster's loadout chooser, the loadout the Labyrinth check found goes
// furthest against it, whether it is the one chosen, and how often it wins at the room
// level set in the advisor's Labyrinth tab – or "Shroud or go around" when even the best
// loses. The last check is kept in this browser, so the marks stay after a reload.
// On the Labyrinth map, each room with a monster in sight gets the same mark at its own
// room level (the game sends each room's monster and level), and each skilling room its
// chance to be cleared (labyrinth-skilling.js).

import { getClientData } from "./game-data.js";
import { esc } from "./format.js";
import { onStateChange, state } from "./game-state.js";
import { visible } from "./game-nav.js";
import { RISKY_WIN, SAFE_WIN, floorAt, floorLevel, winAt } from "./labyrinth.js";
import { skillingRoomChance, skillingWho } from "./labyrinth-skilling.js";

const SCAN_MS = 400;
const STORE = "mwia-laby-check";
const TABLE = 'table[class*="LabyrinthPanel_automationTable"]';
const LABEL = '[class*="LabyrinthPanel_roomLabel"]';
const CHOSEN = 'input[class*="MuiSelect-nativeInput"], input[class*="nativeInput"]';
const MARK = "mwia-laby-mark";
const NOTE = "mwia-laby-note";
const GRID = '[class*="LabyrinthPanel_roomGrid"]';
const CELL = '[class*="LabyrinthPanel_roomCell"]';
const CELL_MARK = "mwia-laby-cellmark";


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

// deps: level() -> the room level set in the Labyrinth tab; prepare() -> loads the game data.
export function startLabyrinthMarks(deps) {
    m.deps = deps;
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(`.${MARK}, .${NOTE}, .${CELL_MARK}`))) return; // our own marks
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    onStateChange(() => scheduleScan());
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
    if (kind === "bad") text = `✖ Shroud or go around · best ${name}${chosen ? " (chosen)" : ""}: ${pct(win)}`;
    else if (!saved) text = `${kind === "ok" ? "✅" : "⚠"} What you wear now (${pct(win)}) – save it as a loadout to pick it`;
    else if (chosen) text = `${kind === "ok" ? "✅" : "⚠"} ${name} · ${pct(win)}`;
    else text = `👉 Pick ${name} · ${pct(win)}`;
    const title = `MWI Advisor: ${pct(win)} of the rooms won at room level ${level} with ${monster.setupName} (${floor})`;
    return { kind, chosen, text, title };
}

// The rooms of the run you are in that hold a monster: { row, col, hrid, level }.
export function runRooms(labyrinth = state.labyrinth) {
    if (!labyrinth?.isActive || !Array.isArray(labyrinth.roomData)) return [];
    const rooms = [];
    labyrinth.roomData.forEach((row, r) => (row || []).forEach((room, c) => {
        if (room?.monsterHrid && room.recommendedLevel) rooms.push({ row: r, col: c, hrid: room.monsterHrid, level: room.recommendedLevel, cleared: !!room.isCleared });
        else if (room?.skillHrid && room.recommendedLevel) rooms.push({ row: r, col: c, skill: room.skillHrid.split("/").pop(), level: room.recommendedLevel, cleared: !!room.isCleared });
    }));
    return rooms;
}

// The room level the automation marks are for: this floor's rooms while in a run, else the Labyrinth tab's.
function automationLevel() {
    const levels = runRooms().filter((x) => x.hrid).map((x) => x.level).sort((a, b) => a - b);
    if (levels.length) return { level: levels[Math.floor(levels.length / 2)], run: true };
    return { level: m.deps.level(), run: false };
}

function scan() {
    mapMarks();
    const tables = [...document.querySelectorAll(TABLE)].filter(visible);
    const check = lastCheck();
    const { level, run } = automationLevel();
    for (const table of tables) {
        note(table, check, level, run);
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
function note(table, check, level, run) {
    let el = table.previousElementSibling?.classList?.contains(NOTE) ? table.previousElementSibling : null;
    if (!el) {
        el = document.createElement("div");
        el.className = NOTE;
        table.parentElement.insertBefore(el, table);
    }
    const floor = run ? ` (the rooms of floor ${state.labyrinth.currentFloor} you can see)` : floorAt(level) && floorLevel(floorAt(level)) === level ? ` (floor ${floorAt(level)}, roughly)` : "";
    const html = check
        ? `🧭 MWI Advisor: the loadout to pick for each monster at room level ${level}${floor} – change it in 🧭 → Labyrinth. Checked ${new Date(check.at).toLocaleDateString()}; check again after changing gear.`
        : `🧭 MWI Advisor: tap <b>Check the rooms</b> in 🧭 → Labyrinth, and each monster here gets the loadout to pick.`;
    if (el.dataset.html !== html) el.innerHTML = el.dataset.html = html;
}

// The Labyrinth map: a frame in the verdict's colour on every room with a monster in sight,
// at that room's own level, with the share won tiny at the right, halfway down (the rest of
// the cell is the game's: level top left, fails and progress below). The cells are the
// grid's children, row by row, as in the game's room data.
function mapMarks() {
    const grid = [...document.querySelectorAll(GRID)].find(visible);
    const labyrinth = state.labyrinth;
    if (!grid || !labyrinth?.isActive) return;
    const cols = labyrinth.roomData?.[0]?.length || 0;
    const cells = [...grid.children].filter((el) => el.matches(CELL));
    if (!cols || cells.length !== cols * labyrinth.roomData.length) return;
    const check = lastCheck();
    const data = getClientData();
    const rooms = new Map(runRooms(labyrinth).map((x) => [x.row * cols + x.col, x]));
    // Skilling rooms need the game data (the tea crate's buffs): loaded once, then marked.
    if (!data && [...rooms.values()].some((x) => x.skill) && m.deps.prepare && !m.loading) {
        m.loading = m.deps.prepare().then(scheduleScan, (error) => console.warn("[MWI Advisor] labyrinth marks", error)).finally(() => (m.loading = null));
    }
    cells.forEach((cell, i) => {
        const room = rooms.get(i);
        let el = cell.querySelector(`.${CELL_MARK}`);
        const mark = room && !room.cleared ? (room.skill ? skillingMark(room, labyrinth, data) : combatMark(room, check, data)) : null;
        if (!mark) {
            el?.remove();
            return;
        }
        const { win, kind, title } = mark;
        if (!el) {
            el = document.createElement("div");
            cell.appendChild(el);
        }
        const cls = `${CELL_MARK} mwia-laby-${kind}`;
        if (el.className !== cls) el.className = cls;
        const corner = `<span>${pct(win)}</span>`;
        if (el.dataset.html !== corner) {
            el.dataset.html = corner;
            el.innerHTML = corner;
        }
        if (el.title !== title) el.title = title;
    });
}

function verdict(win) {
    return win >= SAFE_WIN ? "ok" : win >= RISKY_WIN ? "warn" : "bad";
}

// A combat room: the share won with the loadout that goes furthest against its monster (from the last check).
function combatMark(room, check, data) {
    const monster = check?.monsters.find((x) => x.hrid === room.hrid);
    if (!monster) return null;
    const win = winAt(monster.curve, room.level) ?? 0;
    const kind = verdict(win);
    const loadout = monster.setupId === "equipped" ? "what you wear now" : monster.setupName;
    const who = data?.combatMonsterDetailMap?.[room.hrid]?.name || room.hrid.split("/").pop();
    return { win, kind, title: `MWI Advisor: Lv.${room.level} ${who} – ${kind === "bad" ? "shroud it or go around; best" : "take"} ${loadout}: ${pct(win)} won` };
}

// A skilling room: the chance to fill its progress bar in 2 minutes, worked out from your level and buffs.
function skillingMark(room, labyrinth, data) {
    if (!state.character || !data) return null;
    const result = skillingRoomChance({ skill: room.skill, level: room.level }, skillingWho(state.character, data, room.skill, labyrinth.teaCrateItemHrid));
    const win = result.chance;
    const kind = verdict(win);
    const skill = room.skill.charAt(0).toUpperCase() + room.skill.slice(1);
    const how = room.skill === "enhancing" ? `+${result.needed} in ${result.tries} tries` : `${result.needed} successes needed in ${result.tries} tries`;
    return { win, kind, title: `MWI Advisor: Lv.${room.level} ${skill} – ${pct(win)} to clear (your level ${Math.round(result.level)}, ${pct(result.success)} a try, ${how})` };
}
