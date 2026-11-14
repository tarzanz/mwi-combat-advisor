// The Labyrinth tab's "How far do you get?": whole runs simulated on your Pi
// (labyrinth-run.js) – the floors you reach and the time they take, what takes you further
// (the shop's upgrades by tokens, skills by XP, supplies, settings, room levels against the
// monsters), what your own attempts say about the skilling formula, and room by room how
// far you get.

import { monsterName } from "./game-data.js";
import { esc } from "./format.js";

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
    ["setting", "How you play, and the game's automation"],
    ["combat", "Combat rooms"],
];
// Changes worth a line: at least this many floors more on average.
const WORTH = 0.01;

function numberInput(key, value, min, max, label, title) {
    return `<label title="${esc(title)}">${label} <input data-setting="${key}" type="number" min="${min}" max="${max}" step="1" size="3" value="${value}"></label>`;
}
const hours = (minutes) => (minutes >= 90 ? `${(minutes / 60).toFixed(1)} h` : `${Math.round(minutes)} min`);
const signedMinutes = (minutes) => (Math.abs(minutes) < 1 ? "" : `${minutes > 0 ? "+" : "−"}${hours(Math.abs(minutes))}`);

function costText(c, result) {
    if (c.kind === "shop") {
        const can = c.affordable === null ? "" : c.affordable ? ` <span class="mwia-ok" title="You have ${result.setup.tokens} tokens">✓</span>` : ` <span class="mwia-dim" title="You have ${result.setup.tokens} tokens">(you have ${result.setup.tokens})</span>`;
        return `${c.tokens} tokens${can}`;
    }
    if (c.kind === "skill") return c.xp === null || c.xp === undefined ? "–" : `${short(c.xp)} XP`;
    if (c.kind === "combat") return `<span class="mwia-dim" title="How to get them: What should I improve? and Build a loadout, above and below">${c.loadout ? esc(c.loadout) : ""}</span>`;
    return c.note ? `<span class="mwia-dim">${esc(c.note)}</span>` : "";
}

// A change is listed when it is sure to take you further, or saves a few minutes a run without costing floors.
const listed = (c) => (c.sure && c.floors >= WORTH) || (c.minutes <= -3 && c.floors > -WORTH);

function candidateRows(result) {
    let html = "";
    let hidden = 0;
    for (const [kind, title] of GROUPS) {
        const all = result.candidates.filter((c) => c.kind === kind);
        const list = all.filter(listed);
        hidden += all.length - list.length;
        if (!list.length) continue;
        const extra = kind === "shop" && result.setup.tokens !== null ? ` <span class="mwia-dim">(you have ${result.setup.tokens} tokens)</span>` : "";
        html += `<tr><th colspan="5">${title}${extra}</th></tr>`;
        for (const c of list) {
            const further = c.sure && c.floors >= WORTH;
            const per = further && c.kind === "shop" && c.tokens ? ` <span class="mwia-dim" title="Floors more per 100 tokens">(${((100 * c.floors) / c.tokens).toFixed(2)} / 100 tokens)</span>` : "";
            html += `<tr><td>${esc(c.label)}</td><td title="± ${c.error.toFixed(2)}">${further ? signed(c.floors) + per : "–"}</td><td>${further ? pct(c.reach) : ""}</td><td>${signedMinutes(c.minutes)}</td><td>${costText(c, result)}</td></tr>`;
        }
    }
    return { html, hidden };
}

// What your own attempts say about the formula for skilling rooms.
function calibrationHtml(c) {
    if (!c?.tries) return "";
    const formula = `In the ${c.open} tries at skilling rooms that could go either way the formula expected ${c.expected} wins; you won ${c.won}.`;
    if (c.applied) return `<p><b>Fitted to your ${c.tries} logged skilling tries:</b> ${formula} They fit best with <b>${(100 * c.penalty).toFixed(2)}% success lost per level below the room</b> instead of the formula's 1% – used here and for the map's marks from now on, and fitted again with every run.</p>`;
    return `<p class="mwia-dim">${formula} ${c.open < 15 ? "Too few yet to tell whether the formula is off." : `They would fit ${(100 * c.best).toFixed(2)}% success lost per level below the room slightly better than the formula's 1%, not surely enough to use it.`}</p>`;
}

// run: labyrinth-run-sync.js's runsState(); setup: its runSetup(settings).
export function runsHtml({ run, setup }) {
    let html = `<h3>How far do you get?</h3>
      <p>Whole runs, simulated on your Pi: floor after floor – a torch for each room entered, a lost try costs 2 minutes but no torch – with the skilling rooms'
      chance worked out and the combat rooms' taken from your last <b>Check the rooms</b>; then the same runs again with one thing changed at a time: a level of each
      shop upgrade, +5 and +10 in each skill, better crates, torches and shrouds, other settings, and room levels gained against the monsters.</p>`;
    if (!run.linked) return html + `<p class="mwia-dim">Needs your own Pi with <code>MWIA_ORDERS=1</code> (see pi/README.md): the runs are worked out there, not in the browser.</p>`;
    const auto = setup.autoFloors ? `full automation up to floor ${setup.autoFloors}${setup.rushFloors ? `, rushing for the exit up to floor ${setup.rushFloors}` : ""}, ${setup.maxAttempts} attempt${setup.maxAttempts === 1 ? "" : "s"} a room, shrouds ${setup.shroudWhenStuck ? "when stuck" : "not used by it"}` : "no full automation";
    html += `<div class="mwia-settings">
      ${numberInput("labyPatience", setup.patience, 1, 99, "Tries a room by hand", "How many lost tries (2 minutes each) you give a room before you go another way. On the floors you play by hand a room can be tried again without a new torch.")}
      </div>
      <p class="mwia-dim">As set in the game: ${auto}; ${cap(setup.torchTier)} torches, ${cap(setup.shroudTier)} shrouds, ${setup.teaCrate ? `${cap(setup.teaCrate)} tea crate` : "no tea crate"}.</p>
      <button class="mwia-btn" data-action="laby-runs" ${run.waiting || !run.checked ? "disabled" : ""}>▶ Simulate runs</button>`;
    if (!run.checked) html += ` <span class="mwia-dim">Tap <b>Check the rooms</b> first: the combat rooms' chances come from it.</span>`;
    else if (run.waiting) html += ` <span class="mwia-dim">Your Pi is working on it (a minute or two; longer when it is busy with the 📈 plan)…</span>`;
    if (run.error) html += `<p class="mwia-bad">${esc(run.error)}</p>`;
    const result = run.result;
    // A result of an older version (other rules): simulate again.
    if (!result || result.now?.minutes === undefined) return html;

    const s = result.setup;
    html += `<p><b>Now:</b> ${result.now.floors.toFixed(1)} floors cleared on average in about ${hours(result.now.minutes)}; you reach <b>floor ${result.target}</b> in <b>${pct(result.now.reach)}</b> of the runs${result.record.floor ? ` (your record: floor ${result.record.floor}${result.record.rooms ? `, ${result.record.rooms} rooms` : ""})` : ""}.
      <span class="mwia-dim">${result.runs} runs with ${s.torches} ${s.torchTier} torches, ${s.shrouds} ${s.shroudTier} shrouds, ${s.teaCrate ? `${cap(s.teaCrate)} tea crate` : "no tea crate"}, up to ${s.patience} tries a room by hand. ${when(result.at)}${result.checkedAt ? `, rooms checked ${when(result.checkedAt)}` : ""}.</span></p>`;
    if (result.now.walled >= 0.05) html += `<p>In <b>${pct(result.now.walled)}</b> of the runs you end with torches left (${result.now.left.toFixed(0)} on average): no way down is left but through rooms you don't get past in ${s.patience} tries, and no shroud that works on them. More torches don't help then – shrouds, levels and combat do.</p>`;
    if (result.shroud) html += `<p>By hand, <b>shroud a room in your way that you'd get past less than ${pct(result.shroud.below)} of the time</b> within your tries; otherwise try again or go around.</p>`;
    html += calibrationHtml(result.calibration);

    html += `<table class="mwia-table"><thead><tr><th>Floor</th><th title="Rooms on the floor, and their room levels${result.model.learnedFloors.length ? " (✓: as your recorded runs showed them)" : ""}">Rooms</th><th title="Share of the runs that get to this floor">Reached</th><th title="Torches spent on the floor, on average: one for each room entered">Torches</th><th title="Time spent on the floor, on average: 2 minutes a lost try, about a minute a won room">Time</th></tr></thead><tbody>
      ${result.reach.filter((f) => f.share >= 0.005).map((f) => `<tr><td>${f.floor}${f.floor === result.record.floor ? ` <span class="mwia-dim">(your record)</span>` : ""}</td><td>${f.rooms} <span class="mwia-dim">Lv.${f.levels[0]}–${f.levels[1]}${f.learned ? " ✓" : ""}</span></td><td>${pct(f.share)}</td><td>${f.torches.toFixed(0)}</td><td>${hours(f.minutes)}</td></tr>`).join("")}</tbody></table>`;

    const rows = candidateRows(result);
    html += `<h3>What takes you further</h3>`;
    html += rows.html
        ? `<table class="mwia-table"><thead><tr><th>Change</th><th title="Floors cleared more on average, on the same floors with the same luck">Floors more</th><th title="Share of the runs that then reach floor ${result.target}">Reach floor ${result.target}</th><th title="Time a run takes more or less">Time</th><th>Costs</th></tr></thead><tbody>${rows.html}</tbody></table>`
        : `<p class="mwia-dim">Nothing tried takes you measurably further.</p>`;
    if (rows.hidden) html += `<p class="mwia-dim">${rows.hidden} other changes made no difference that is sure (under ${WORTH} floors, or within the luck of ${result.runs} runs) and saved no time.</p>`;
    const seen = result.shroudsSeen;
    if (seen?.used) html += `<p class="mwia-dim">Better shrouds are counted by the wiki's rule (a shroud fails 2% per room level above its cap). In your recorded runs ${seen.used} shroud${seen.used === 1 ? " was" : "s were"} used above the cap and ${seen.worked} worked, where the rule expected about ${seen.expected}${seen.worked > seen.expected + 1 ? " – they may fail less than the rule says, and better shrouds then give less than shown" : ""}.</p>`;

    html += `<details class="mwia-skill-sec"><summary>Room by room</summary><table class="mwia-table"><thead><tr><th>Room</th><th title="The highest room level where you get past it at least half the time within your tries">Passed up to</th><th title="Tries a run">Tries</th><th title="Tries lost a run: 2 minutes each">Lost</th><th title="Shrouds used on it a run">🌫</th><th title="Rooms a run given up after your tries">Given up</th></tr></thead><tbody>
      ${result.rooms.map((x) => `<tr><td>${esc(roomName(x))}${x.loadout ? ` <span class="mwia-dim">${esc(x.loadout)}</span>` : ""}</td><td>Lv.${x.passes}</td><td>${x.tries.toFixed(1)}</td><td>${x.lost.toFixed(1)}</td><td>${x.shrouds ? x.shrouds.toFixed(1) : ""}</td><td>${x.gaveUp ? x.gaveUp.toFixed(2) : ""}</td></tr>`).join("")}</tbody></table>
      <p class="mwia-dim">The weakest first. A room type far below a floor's levels shows few tries: it is gone around or shrouded.</p></details>`;

    const learned = result.model.rooms ? `${result.model.rooms} rooms of ${result.model.runs} recorded run${result.model.runs === 1 ? "" : "s"}${result.model.learnedFloors.length ? ` (floor${result.model.learnedFloors.length > 1 ? "s" : ""} ${result.model.learnedFloors.join(", ")} as recorded)` : " (too few yet to replace the assumed levels)"}` : "none recorded yet";
    html += `<p class="mwia-dim">As your recorded runs showed the game (${learned}): a torch for each room entered – treasure rooms and the way down too – and none for trying a room again; a shroud clears a room without a torch;
      the way down is in the bottom right corner; a floor has as many treasure rooms as its number. Assumed where not recorded: room levels 20 × floor … + 20, every room type as likely.
      Floors by hand are played as the advisor would – the cheapest way down, trying again or going around, a shroud where it saves the most – so they show what careful play gets, not what you did.
      Beacons, the shop's combat upgrades and rewards aren't counted; a change to gear, abilities or coffee and food crates needs a new <b>Check the rooms</b>.</p>`;
    return html;
}

export function runsExportLines(result) {
    if (!result) return [];
    if (result.now?.minutes === undefined) return [];
    const lines = [`Runs: ${result.now.floors.toFixed(2)} floors on average in ${hours(result.now.minutes)}, floor ${result.target} reached in ${pct(result.now.reach)}, ${pct(result.now.walled)} end with torches left (${result.runs} runs, ${result.setup.torches} ${result.setup.torchTier} torches, ${result.setup.shrouds} ${result.setup.shroudTier} shrouds, automation to floor ${result.setup.autoFloors}, ${result.setup.patience} tries a room, ${result.model.rooms} rooms recorded)`];
    if (result.calibration?.tries) lines.push(`Skilling formula against ${result.calibration.tries} tries: expected ${result.calibration.expected} wins of ${result.calibration.open} open ones, won ${result.calibration.won}; fitted penalty ${(100 * result.calibration.best).toFixed(2)}% a level${result.calibration.applied ? " (used)" : ""}`);
    lines.push(`Floors reached: ${result.reach.filter((f) => f.share >= 0.005).map((f) => `${f.floor}: ${pct(f.share)}`).join(", ")}`);
    for (const c of result.candidates.filter(listed).slice(0, 15)) lines.push(`Further: ${c.label} ${signed(c.floors)} floors${signedMinutes(c.minutes) ? `, ${signedMinutes(c.minutes)}` : ""}${c.tokens ? ` for ${c.tokens} tokens` : ""}${c.xp ? ` for ${short(c.xp)} XP` : ""}`);
    return lines;
}
