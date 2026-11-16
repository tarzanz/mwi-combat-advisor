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
import { combatLevelOf, parseSkipText, skipAdvice } from "./labyrinth-skip.js";
import { setReactInput } from "./game-nav.js";
import { SKILLS } from "./labyrinth-run.js";

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
const SKIP_MARK = "mwia-laby-skip";
const SKIP_BAR = "mwia-laby-skipbar";
const OURS = `.${MARK}, .${NOTE}, .${CELL_MARK}, .${SKIP_MARK}, .${SKIP_BAR}`;


const m = { deps: null, scanTimer: null, stored: undefined, advice: null, filling: null, stopFill: false, fillStatus: "" };
const pct = (x) => `${Math.round(100 * x)}%`;

// The check, small enough to keep: per monster its best loadout and the win curve.
// at: when the check was worked out (the Pi's night run: when it started); fromPi: worked out on the Pi.
export function rememberLabyrinth(lab, at = Date.now(), fromPi = false) {
    if (!lab) return;
    const kept = {
        at,
        ...(fromPi ? { fromPi: true } : {}),
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

// The last "Check the rooms", as kept: { at, monsters: [{ hrid, setupId, setupName, safe, curve }] } or null.
export const lastLabyrinthCheck = () => lastCheck();

// deps: level() -> the room level set in the Labyrinth tab; prepare() -> loads the game data;
// penalty() -> the success lost per level below a skilling room as your attempts have it (undefined: the formula's);
// skip() -> { rule: { tries, target }, teaCrate: the tea crate's tier or null } for the skip levels.
export function startLabyrinthMarks(deps) {
    m.deps = deps;
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(OURS))) return; // our own marks
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
    if (tables.length) needData();
    const advice = tables.length ? skipAdviceNow() : null;
    for (const table of tables) {
        note(table, check, level, run);
        skipMarks(table, advice);
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

// The game data (the tea crate's buffs, the monsters' names) is loaded once when a table or room needs it.
function needData() {
    if (getClientData() || !m.deps.prepare || m.loading) return;
    m.loading = m.deps.prepare().then(scheduleScan, (error) => console.warn("[MWI Advisor] labyrinth marks", error)).finally(() => (m.loading = null));
}

// ---------- skip levels ("Skip if room level is above my skill level by ≥ N") ----------

const SKIP_CACHE_MS = 10000;

// What to set for each room type, by the rule in the Labyrinth tab: { rule, rows, at } (kept for a few seconds).
export function skipAdviceNow() {
    const data = getClientData();
    const character = state.character;
    if (!character || !m.deps?.skip) return null;
    const { rule, teaCrate } = m.deps.skip();
    const check = lastCheck();
    const penalty = m.deps.penalty?.();
    const levels = (character.characterSkills || []).map((x) => x.level).join(",");
    const key = [rule.tries, rule.target, teaCrate, check?.at, penalty, levels, !!data].join("|");
    if (m.advice?.key === key && Date.now() - m.advice.at < SKIP_CACHE_MS) return m.advice;
    const teaHrid = teaCrate ? `/items/${teaCrate}_tea_crate` : null;
    const who = data ? (skill) => ({ ...skillingWho(character, data, skill, teaHrid), penalty }) : null;
    const combatLevel = combatLevelOf(character);
    const rows = skipAdvice({ who, check, combatLevel, rule });
    m.advice = { key, at: Date.now(), rule, rows, combatLevel, checkedAt: check?.at ?? null, skilling: !!who };
    return m.advice;
}

// Which room type a row of the Automation table is for: "skill:milking" or "monster:/monsters/…".
function rowKey(row) {
    const label = row.querySelector(LABEL) || row.querySelector("td");
    if (!label) return null;
    const use = label.querySelector("use");
    const icon = (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#")[1] || "";
    const name = label.textContent.replace(/\s+/g, " ").trim().toLowerCase();
    if (SKILLS.includes(icon)) return `skill:${icon}`;
    if (SKILLS.includes(name)) return `skill:${name}`;
    const monsters = getClientData()?.combatMonsterDetailMap || {};
    if (icon && monsters[`/monsters/${icon}`]) return `monster:/monsters/${icon}`;
    const hrid = Object.keys(monsters).find((h) => (monsters[h]?.name || "").toLowerCase() === name);
    if (hrid) return `monster:${hrid}`;
    const check = lastCheck();
    const kept = check?.monsters.find((x) => x.hrid === `/monsters/${icon}`);
    return kept ? `monster:${kept.hrid}` : null;
}

// The cell with the skip level: the one with the game's Edit / Save button.
function skipCell(row) {
    return [...row.children].reverse().find((td) => [...td.querySelectorAll("button")].some((b) => /^(edit|save)$/i.test(b.textContent.trim()))) || null;
}

const gameText = (el) => [...el.childNodes].filter((n) => !(n.classList && n.classList.contains(SKIP_MARK))).map((n) => n.textContent).join(" ");

// The level set now in a row: what the game shows (≥ N), or what is typed while it is edited.
function currentSkip(cell) {
    const input = cell.querySelector("input");
    if (input && !input.closest(`.${SKIP_MARK}`)) return Number.isFinite(Number(input.value)) && input.value !== "" ? Number(input.value) : null;
    return parseSkipText(gameText(cell));
}

const button = (root, label) => [...root.querySelectorAll("button")].find((b) => b.textContent.trim().toLowerCase() === label && !b.closest(OURS));

function rowsWithAdvice(table, advice) {
    const byKey = new Map((advice?.rows || []).map((r) => [r.key, r]));
    const out = [];
    for (const row of table.querySelectorAll("tbody tr")) {
        const key = rowKey(row);
        const cell = skipCell(row);
        if (!key || !cell) continue;
        out.push({ row, cell, key, advice: byKey.get(key) || null, current: currentSkip(cell) });
    }
    return out;
}

const skipTitle = (a, rule) => {
    const room = a.highest === null ? "no room level" : `rooms up to level ${a.highest}`;
    const yours = a.type === "combat" ? `your combat level ${a.myLevel} (assumed: the level the game compares a combat room with)` : `your ${a.skill} level ${a.myLevel}`;
    return `MWI Advisor: you clear ${room} at least ${Math.round(100 * rule.target)}% of the time within ${rule.tries} tr${rule.tries === 1 ? "y" : "ies"}${a.loadout ? ` (with ${a.loadout})` : ""}; against ${yours}, skip from ${a.value} above it`;
};

// Per row: the level to set (👉) or ✓ when it is set; above the table a button that sets them all.
function skipMarks(table, advice) {
    const rows = rowsWithAdvice(table, advice);
    let differ = 0;
    for (const { cell, advice: a, current } of rows) {
        let el = cell.querySelector(`.${SKIP_MARK}`);
        if (!a) {
            el?.remove();
            continue;
        }
        const editing = !!cell.querySelector(`input:not(.${SKIP_MARK} input)`);
        const same = current === a.value && !editing;
        if (!same) differ++;
        const html = same ? "✓" : editing && current === a.value ? "👉 Save" : `👉 ${a.value}`;
        const cls = `${SKIP_MARK} ${same ? "mwia-laby-ok" : "mwia-laby-pick"}`;
        if (!el) {
            el = document.createElement("div");
            cell.appendChild(el);
        }
        if (el.className !== cls) el.className = cls;
        if (el.dataset.html !== html) el.innerHTML = el.dataset.html = html;
        const title = skipTitle(a, advice.rule);
        if (el.title !== title) el.title = title;
    }
    skipBar(table, advice, rows.filter((r) => r.advice).length, differ);
}

function skipBar(table, advice, known, differ) {
    let bar = above(table, SKIP_BAR);
    if (!bar) {
        bar = document.createElement("div");
        bar.className = SKIP_BAR;
        table.parentElement.insertBefore(bar, table);
        bar.addEventListener("click", (event) => {
            if (event.target.closest("[data-mwia-skip-fill]")) fillSkipLevels();
        });
    }
    let html;
    if (!advice) html = "";
    else {
        const rule = `${Math.round(100 * advice.rule.target * 10) / 10}% within ${advice.rule.tries} tr${advice.rule.tries === 1 ? "y" : "ies"}`;
        const combat = advice.checkedAt ? "" : " Combat rooms need a <b>Check the rooms</b> first.";
        const action = m.filling
            ? `<button class="mwia-btn" data-mwia-skip-fill>■ Stop</button>`
            : differ
              ? `<button class="mwia-btn" data-mwia-skip-fill>✎ Fill in ${differ} skip level${differ === 1 ? "" : "s"}</button>`
              : known
                ? "✓ All skip levels are set."
                : "";
        html = `🧭 Skip levels: try a room only when you clear it ${rule} (👉 the level to set; change the rule in 🧭 → Labyrinth).${combat} ${action}${m.fillStatus ? ` <span>${esc(m.fillStatus)}</span>` : ""}`;
    }
    if (bar.dataset.html !== html) bar.innerHTML = bar.dataset.html = html;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function waitFor(read, ms = 2500) {
    for (let waited = 0; waited <= ms; waited += 50) {
        const value = read();
        if (value) return value;
        await sleep(50);
    }
    return null;
}

// The field's value as the game holds it: a tap on + and then − makes the game draw the
// field again from what it holds (what was typed may only be in the page, not in the game).
const fieldOf = (find) => find()?.cell.querySelector("input") || null;
const fieldValue = (find) => {
    const input = fieldOf(find);
    return input && input.value !== "" && Number.isFinite(Number(input.value)) ? Number(input.value) : null;
};
function nudge(find, label) {
    const r = find();
    const b = r && button(r.cell, label);
    if (!b) return false;
    b.click();
    return true;
}

// Puts the value in the open field: typed as a keystroke would, and if the game didn't
// take that, stepped there with the game's − and + (a click a step). Returns what the game holds.
async function typeSkip(find, value) {
    const input = fieldOf(find);
    if (!input) return null;
    setReactInput(input, value);
    await sleep(80);
    if (nudge(find, "+") && nudge(find, "−")) await sleep(50);
    for (let i = 0; i < 2000; i++) {
        const now = fieldValue(find);
        if (now === null || now === value) return now;
        if (!nudge(find, now > value ? "−" : "+")) return now;
        if (i % 25 === 24) await sleep(20);
    }
    return fieldValue(find);
}

// Fills in every skip level that differs from the advice, a row at a time: Edit and the value, in the
// game itself – the player taps the game's Save. The game takes a setting only from a real tap: what
// is sent right after a script's click goes out marked as automated, and the server ignores it. When
// the game shows the value, the next row is filled in; tapping the button again stops.
const WAIT_SAVE_MS = 180000;
const roomName = (a) => (a.skill ? a.skill[0].toUpperCase() + a.skill.slice(1) : getClientData()?.combatMonsterDetailMap?.[a.hrid]?.name || a.hrid || "the");
export function fillSkipLevels() {
    if (m.filling) {
        m.stopFill = true;
        return m.filling;
    }
    m.stopFill = false;
    m.filling = (async () => {
        let done = 0;
        let problem = "";
        let total = 0;
        const status = (text) => {
            m.fillStatus = text;
            scheduleScan();
        };
        try {
            const table = () => [...document.querySelectorAll(TABLE)].find(visible);
            const advice = skipAdviceNow();
            if (!table() || !advice) throw new Error("open the Labyrinth's Automation tab first");
            const todo = rowsWithAdvice(table(), advice).filter((r) => r.advice && r.current !== r.advice.value).map((r) => r.advice);
            total = todo.length;
            for (const a of todo) {
                const find = () => {
                    const t = table();
                    return t && rowsWithAdvice(t, advice).find((r) => r.key === a.key);
                };
                let r = find();
                if (!r) throw new Error(`the row for ${roomName(a)} is gone`);
                if (r.current === a.value && !r.cell.querySelector("input")) {
                    done++;
                    continue;
                }
                const edit = button(r.cell, "edit");
                if (edit) edit.click();
                const input = await waitFor(() => find()?.cell.querySelector("input"));
                if (!input) throw new Error("Edit opened no field to type in");
                const min = input.min !== "" && Number.isFinite(Number(input.min)) ? Number(input.min) : -Infinity;
                const max = input.max !== "" && Number.isFinite(Number(input.max)) ? Number(input.max) : Infinity;
                const value = Math.max(min, Math.min(max, a.value));
                const typed = await typeSkip(find, value);
                if (typed !== value) throw new Error(`couldn't put ${value} in the field (it shows ${typed ?? "nothing"})`);
                find()?.row.scrollIntoView({ block: "center", behavior: "smooth" });
                status(`${done + 1} of ${total}: tap the game's Save in the ${roomName(a)} row (${value}) – the game takes a setting only from your own tap.`);
                // The player's Save closes the field; the level shows when the game's server confirms it.
                let closedAt = 0;
                const outcome = await waitFor(() => {
                    if (m.stopFill) return "stopped";
                    const x = find();
                    if (!x) return "gone";
                    if (x.cell.querySelector("input")) return (closedAt = 0), null;
                    if (x.current === value) return "saved";
                    closedAt ||= Date.now();
                    return Date.now() - closedAt > 8000 ? "kept" : null;
                }, WAIT_SAVE_MS);
                if (outcome === "stopped") throw new Error("stopped by you");
                if (outcome === "gone") throw new Error(`the row for ${roomName(a)} is gone`);
                if (outcome === "kept") throw new Error(`the game kept ${find()?.current ?? "its value"} for ${roomName(a)} (Edit was left without Save, or the game didn't take it)`);
                if (!outcome) throw new Error(`no Save for ${roomName(a)} within ${WAIT_SAVE_MS / 60000} minutes`);
                done++;
            }
        } catch (error) {
            problem = error.message || String(error);
        }
        m.filling = null;
        m.stopFill = false;
        m.advice = null;
        status(problem ? `Stopped after ${done} of ${total}: ${problem}.` : done ? `✓ ${done} set.` : "");
        return { done, problem };
    })();
    scheduleScan();
    return m.filling;
}

// One of our lines just above the table (the note, then the skip levels' bar).
function above(table, cls) {
    for (let el = table.previousElementSibling, i = 0; el && i < 3; el = el.previousElementSibling, i++) if (el.classList.contains(cls)) return el;
    return null;
}

// A line above the table: what the marks are, or how to get them.
function note(table, check, level, run) {
    let el = above(table, NOTE);
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
    if (!data && [...rooms.values()].some((x) => x.skill)) needData();
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

// The advisor's chance for a room, for the attempt log: a combat room's from the last
// check (with the loadout it found best), a skilling room's worked out.
export function roomPrediction(room, labyrinth) {
    if (room.skillHrid) {
        const data = getClientData();
        if (!state.character || !data) return null;
        const r = skillingRoomChance({ skill: room.skillHrid.split("/").pop(), level: room.recommendedLevel }, { ...skillingWho(state.character, data, room.skillHrid.split("/").pop(), labyrinth.teaCrateItemHrid), penalty: m.deps?.penalty?.() });
        return { win: Math.round(1000 * r.chance) / 1000, how: "formula", success: Math.round(1000 * r.success) / 1000, tries: r.tries, needed: Number.isFinite(r.needed) ? r.needed : null, double: Math.round(1000 * r.double) / 1000, level: Math.round(10 * r.level) / 10, seconds: Math.round(100 * r.seconds) / 100 };
    }
    const check = lastCheck();
    const monster = check?.monsters.find((x) => x.hrid === room.monsterHrid);
    if (!monster) return null;
    return { win: Math.round(1000 * (winAt(monster.curve, room.recommendedLevel) ?? 0)) / 1000, how: "check", best: monster.setupId, bestName: monster.setupName, checkedAt: check.at };
}

// A skilling room: the chance to fill its progress bar in 2 minutes, worked out from your level and buffs.
function skillingMark(room, labyrinth, data) {
    if (!state.character || !data) return null;
    const result = skillingRoomChance({ skill: room.skill, level: room.level }, { ...skillingWho(state.character, data, room.skill, labyrinth.teaCrateItemHrid), penalty: m.deps?.penalty?.() });
    const win = result.chance;
    const kind = verdict(win);
    const skill = room.skill.charAt(0).toUpperCase() + room.skill.slice(1);
    const how = room.skill === "enhancing" ? `+${result.needed} in ${result.tries} tries` : `${result.needed} successes needed in ${result.tries} tries`;
    return { win, kind, title: `MWI Advisor: Lv.${room.level} ${skill} – ${pct(win)} to clear (your level ${Math.round(result.level)}, ${pct(result.success)} a try, ${how})` };
}
