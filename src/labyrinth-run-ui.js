// The Labyrinth tab's "How far do you get?": whole runs simulated on your Pi
// (labyrinth-run.js) – the floors you reach, what takes you further (the shop's upgrades by
// tokens, skills by XP, supplies, the automation settings, room levels against each
// monster) and where the torches go.

import { monsterName } from "./game-data.js";
import { esc } from "./format.js";
import { TIERS } from "./labyrinth-run.js";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const pct = (x) => `${Math.round(100 * x)}%`;
const signed = (x) => `${x > 0 ? "+" : x < 0 ? "−" : ""}${Math.abs(x).toFixed(2)}`;
const short = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : String(Math.round(n)));
const when = (at) => new Date(at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
const roomName = (r) => (r.type === "combat" ? monsterName(`/monsters/${r.what}`) : cap(r.what));

const GROUPS = [
    ["shop", "Labyrinth shop"],
    ["skill", "Skills"],
    ["supply", "Supplies"],
    ["setting", "The game's automation"],
    ["combat", "Combat rooms"],
];
// Changes worth a line: at least this many floors more on average.
const WORTH = 0.01;

function numberInput(key, value, min, max, label, title) {
    return `<label title="${esc(title)}">${label} <input data-setting="${key}" type="number" min="${min}" max="${max}" step="1" size="3" value="${value}"></label>`;
}
function tierSelect(key, chosen, used, label, title) {
    const options = [["", `What you hold (${cap(used)})`], ...TIERS.map((t) => [t, cap(t)])];
    return `<label title="${esc(title)}">${label} <select data-setting="${key}">${options.map(([k, v]) => `<option value="${k}" ${(chosen || "") === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
}

function costText(c, result) {
    if (c.kind === "shop") {
        const can = c.affordable === null ? "" : c.affordable ? ` <span class="mwia-ok" title="You have ${result.setup.tokens} tokens">✓</span>` : ` <span class="mwia-dim" title="You have ${result.setup.tokens} tokens">(you have ${result.setup.tokens})</span>`;
        return `${c.tokens} tokens${c.assumed ? `<span class="mwia-dim" title="Its price goes up with every level bought; this is the first level's, as the game doesn't say how many you have"> *</span>` : ""}${can}`;
    }
    if (c.kind === "skill") return c.xp === null || c.xp === undefined ? "–" : `${short(c.xp)} XP`;
    if (c.kind === "combat") return `<span class="mwia-dim" title="How to get them: What should I improve? and Build a loadout, above and below">${c.loadout ? esc(c.loadout) : ""}</span>`;
    return c.note ? `<span class="mwia-dim">${esc(c.note)}</span>` : "";
}

function candidateRows(result) {
    let html = "";
    let hidden = 0;
    for (const [kind, title] of GROUPS) {
        const all = result.candidates.filter((c) => c.kind === kind);
        // Of a skill's +5 and +10 the one that gives more a level; everything that gives nothing is left out.
        const list = all.filter((c) => c.floors >= WORTH && c.sure);
        hidden += all.length - list.length;
        if (!list.length) continue;
        const extra = kind === "shop" && result.setup.tokens !== null ? ` <span class="mwia-dim">(you have ${result.setup.tokens} tokens)</span>` : "";
        html += `<tr><th colspan="4">${title}${extra}</th></tr>`;
        for (const c of list) {
            const per = c.kind === "shop" && c.tokens ? ` <span class="mwia-dim" title="Floors more per 100 tokens">(${((100 * c.floors) / c.tokens).toFixed(2)} / 100 tokens)</span>` : "";
            html += `<tr><td>${esc(c.label)}</td><td title="± ${c.error.toFixed(2)}">${signed(c.floors)}${per}</td><td>${pct(c.reach)}</td><td>${costText(c, result)}</td></tr>`;
        }
    }
    return { html, hidden };
}

// run: labyrinth-run-sync.js's runsState(); setup: its runSetup(settings); busy: an analysis is running.
export function runsHtml({ run, setup, settings }) {
    let html = `<h3>How far do you get?</h3>
      <p>Whole runs, simulated on your Pi: floor after floor until the torches are gone – skilling rooms with their exact chance, combat rooms with the
      win rates of your last <b>Check the rooms</b> – then the same runs again with one thing changed at a time: a level of each shop upgrade, +5 and +10 in each
      skill, better crates, torches and shrouds, other automation settings, and 5 room levels more against each monster.</p>`;
    if (!run.linked) return html + `<p class="mwia-dim">Needs your own Pi with <code>MWIA_ORDERS=1</code> (see pi/README.md): the runs are worked out there, not in the browser.</p>`;
    html += `<div class="mwia-settings">
      ${numberInput("labyAuto", setup.autoFloors, 0, 15, "Full automation up to floor", "As on the game's Labyrinth → Automation tab (0: none). Those floors are played as the game's automation plays them, the others by hand as the advisor would.")}
      ${numberInput("labyRush", setup.rushFloors, 0, 15, "Rush for exit up to floor", "As in the game (0: disabled): on those floors the automation goes for the exit and leaves the other rooms.")}
      ${numberInput("labyAttempts", setup.maxAttempts, 1, 99, "Max attempts per room", "As in the game: the automation gives a room up after this many fails.")}
      ${tierSelect("labyTorch", settings.labyTorch, setup.torchTier, "Torches", "Advanced torches are kept 10% of the time, Expert 20%. As many as your torch capacity holds are taken.")}
      ${tierSelect("labyShroud", settings.labyShroud, setup.shroudTier, "Shrouds", "Basic shrouds fail 2% per room level above 50, Advanced above 100, Expert never. As many as your shroud capacity holds are taken.")}
      </div>
      <button class="mwia-btn" data-action="laby-runs" ${run.waiting || !run.checked ? "disabled" : ""}>▶ Simulate runs</button>`;
    if (!run.checked) html += ` <span class="mwia-dim">Tap <b>Check the rooms</b> first: the combat rooms' chances come from it.</span>`;
    else if (run.waiting) html += ` <span class="mwia-dim">Your Pi is working on it (a minute or two; longer when it is busy with the 📈 plan)…</span>`;
    if (run.error) html += `<p class="mwia-bad">${esc(run.error)}</p>`;
    const result = run.result;
    if (!result) return html;

    const s = result.setup;
    const auto = s.autoFloors ? `floor${s.autoFloors > 1 ? `s 1–${s.autoFloors}` : " 1"} under full automation${s.rushFloors ? ` (rushing for the exit up to floor ${s.rushFloors})` : ""}, ${s.maxAttempts} attempt${s.maxAttempts === 1 ? "" : "s"} a room` : "every floor by hand";
    html += `<p><b>Now:</b> ${result.now.floors.toFixed(1)} floors cleared on average; you reach <b>floor ${result.target}</b> in <b>${pct(result.now.reach)}</b> of the runs${result.record.floor ? ` (your record: floor ${result.record.floor}${result.record.rooms ? `, ${result.record.rooms} rooms` : ""})` : ""}.
      <span class="mwia-dim">${result.runs} runs with ${s.torches} ${s.torchTier} torches, ${s.shrouds} ${s.shroudTier} shrouds, ${s.teaCrate ? `${cap(s.teaCrate)} tea crate` : "no tea crate"}; ${auto}. ${when(result.at)}${result.checkedAt ? `, rooms checked ${when(result.checkedAt)}` : ""}.</span></p>`;
    if (result.shroud) html += `<p>By hand, <b>shroud a room you win less than ${pct(result.shroud.below)} of the time</b> when it is on your way (a shroud is worth about ${result.shroud.worth} torches); otherwise try again or go around.</p>`;
    if (result.now.stuck >= 0.05) html += `<p>In <b>${pct(result.now.stuck)}</b> of the runs you end with torches left (${result.now.left.toFixed(0)} on average): there is no way to the exit but through rooms you never win, and no shroud left that works on them. More torches don't help then – shrouds and levels do.</p>`;

    html += `<table class="mwia-table"><thead><tr><th>Floor</th><th title="Rooms on the floor, and their room levels${result.model.learnedFloors.length ? " (✓: as your recorded runs showed them)" : ""}">Rooms</th><th title="Share of the runs that get to this floor">Reached</th><th title="Torches spent on the floor, on average">Torches</th></tr></thead><tbody>
      ${result.reach.filter((f) => f.share >= 0.005).map((f) => `<tr><td>${f.floor}${f.floor === result.record.floor ? ` <span class="mwia-dim">(your record)</span>` : ""}</td><td>${f.rooms} <span class="mwia-dim">Lv.${f.levels[0]}–${f.levels[1]}${f.learned ? " ✓" : ""}</span></td><td>${pct(f.share)}</td><td>${f.torches.toFixed(0)}</td></tr>`).join("")}</tbody></table>`;

    const rows = candidateRows(result);
    html += `<h3>What takes you further</h3>`;
    html += rows.html
        ? `<table class="mwia-table"><thead><tr><th>Change</th><th title="Floors cleared more on average, on the same floors with the same luck">Floors more</th><th title="Share of the runs that then reach floor ${result.target}">Reach floor ${result.target}</th><th>Costs</th></tr></thead><tbody>${rows.html}</tbody></table>`
        : `<p class="mwia-dim">Nothing tried takes you measurably further.</p>`;
    if (rows.hidden) html += `<p class="mwia-dim">${rows.hidden} other changes made no difference that is sure (under ${WORTH} floors, or within the luck of ${result.runs} runs).</p>`;

    const rooms = result.rooms.filter((x) => x.tries >= 0.05 || x.shrouds >= 0.05);
    html += `<details class="mwia-skill-sec"><summary>Where the torches go</summary><table class="mwia-table"><thead><tr><th>Room</th><th title="Tries a run">Tries</th><th title="Tries lost a run: torches gone for nothing">Lost</th><th title="Shrouds used on it a run">🌫</th><th title="Share of the runs that end at such a room">Run ends</th></tr></thead><tbody>
      ${rooms.map((x) => `<tr><td>${esc(roomName(x))}${x.loadout ? ` <span class="mwia-dim">${esc(x.loadout)}</span>` : ""}</td><td>${x.tries.toFixed(1)}</td><td>${x.lost.toFixed(1)}</td><td>${x.shrouds ? x.shrouds.toFixed(1) : ""}</td><td>${x.stopped ? pct(x.stopped) : ""}</td></tr>`).join("")}</tbody></table>
      <p class="mwia-dim">A room type you never win shows few tries: by hand it is gone around or shrouded, which costs torches elsewhere.</p></details>`;

    const learned = result.model.rooms ? `${result.model.rooms} rooms of ${result.model.runs} recorded run${result.model.runs === 1 ? "" : "s"}${result.model.learnedFloors.length ? ` (floor${result.model.learnedFloors.length > 1 ? "s" : ""} ${result.model.learnedFloors.join(", ")} as recorded)` : " (too few yet to replace the assumed levels)"}` : "none recorded yet";
    html += `<p class="mwia-dim">Assumed until your recorded runs say otherwise (${learned}): room levels 20 × floor + 1 … + 20, every room type as likely, the exit in the bottom right corner and a room like the others.
      Floors by hand are played as the advisor would – the way to the exit that costs the fewest torches on average, trying again or going around, a shroud where it saves the most – so they show what careful play gets, not what you did.
      Beacons, the shop's combat upgrades and rewards aren't counted; a change to gear, abilities or coffee and food crates needs a new <b>Check the rooms</b>.</p>`;
    return html;
}

export function runsExportLines(result) {
    if (!result) return [];
    const lines = [`Runs: ${result.now.floors.toFixed(2)} floors on average, floor ${result.target} reached in ${pct(result.now.reach)} (${result.runs} runs, ${result.setup.torches} ${result.setup.torchTier} torches, ${result.setup.shrouds} ${result.setup.shroudTier} shrouds, automation to floor ${result.setup.autoFloors}, ${result.model.rooms} rooms recorded)`];
    lines.push(`Floors reached: ${result.reach.filter((f) => f.share >= 0.005).map((f) => `${f.floor}: ${pct(f.share)}`).join(", ")}`);
    for (const c of result.candidates.filter((c) => c.floors >= WORTH && c.sure).slice(0, 15)) lines.push(`Further: ${c.label} ${signed(c.floors)} floors${c.tokens ? ` for ${c.tokens} tokens` : ""}${c.xp ? ` for ${short(c.xp)} XP` : ""}`);
    return lines;
}
