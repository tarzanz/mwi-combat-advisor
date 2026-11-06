// The Labyrinth tab: which combat rooms you win at a room level, which to shroud or go
// around, and what would take you further.

import { itemName, monsterName } from "./game-data.js";
import { esc, shortCoins } from "./format.js";
import {
    CRATE_KINDS,
    CRATE_TIERS,
    RISKY_WIN,
    SAFE_WIN,
    damageTaken,
    evasionByStyle,
    monsterAttack,
    nearestPoint,
    weakStyles,
    winAt,
    yourDamageTypes,
    yourStyle,
} from "./labyrinth.js";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const pctText = (x) => `${Math.round(100 * x)}%`;
const lvl = (x) => (x === null || x === undefined ? "–" : String(Math.round(x)));
const DEFAULT_LEVEL = 20;

export const roomLevelSetting = (settings) => Math.max(1, Math.min(300, Math.round(Number(settings.labyLevel) || DEFAULT_LEVEL)));

function crateSelect(settings, kind, slotted) {
    const key = kind === "coffee" ? "labyCoffee" : "labyFood";
    const value = settings[key] || "slots";
    const options = [
        ["slots", `Your Labyrinth slots (${slotted ? cap(slotted) : "none"})`],
        ["none", "None"],
        ...CRATE_TIERS.map((t) => [t, cap(t)]),
    ];
    return `<label title="Opened when you enter the Labyrinth; its buffs last the whole run">${CRATE_KINDS[kind]}
      <select data-setting="${key}">${options.map(([k, v]) => `<option value="${k}" ${value === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
}

function verdict(win, point) {
    if (win === null) return "–";
    if (win >= SAFE_WIN) return `<span class="mwia-ok" title="You win ${pctText(win)} of these rooms">✅ fight · ${pctText(win)}</span>`;
    const why = !point ? "" : point.deaths >= point.timeouts ? "you die" : "too slow";
    const whyTitle = !point ? "" : point.deaths >= point.timeouts ? "Most lost rooms end with you dead" : "Most lost rooms end when the 2 minutes run out: more damage needed";
    if (win >= RISKY_WIN) return `<span class="mwia-warn" title="${whyTitle}">⚠ risky · ${pctText(win)}${why ? ` · ${why}` : ""}</span>`;
    return `<span class="mwia-bad" title="${whyTitle}">✖ shroud or go around · ${pctText(win)}${why ? ` · ${why}` : ""}</span>`;
}

// How well you hit it: your style against its evasion, your best element against its resistances.
function yourMatch(profile, data, hrid, level) {
    const style = yourStyle(profile, data);
    const weak = weakStyles(data, hrid);
    const evasion = evasionByStyle(data, hrid);
    const least = Math.min(...Object.values(evasion));
    const styleHtml = weak.includes(style)
        ? `<span class="mwia-ok" title="It hardly dodges ${cap(style)}">${cap(style)} ✓</span>`
        : `<span class="mwia-bad" title="It dodges ${cap(style)} like ×${Math.round(evasion[style] / least)} better than its weak style">${cap(style)} ✗</span>`;
    const taken = damageTaken(data, hrid, level);
    const types = yourDamageTypes(profile, data);
    let best = null;
    for (const type of types.keys()) if (!best || taken[type] > taken[best]) best = type;
    const top = Math.max(...Object.values(taken));
    const elementHtml = best
        ? `<span class="${taken[best] >= 0.8 * top ? "mwia-ok" : "mwia-dim"}" title="Share of your ${best} damage that gets through its resistance at room level ${level}">${cap(best)} ${pctText(taken[best])}</span>`
        : "";
    return `${styleHtml} · ${elementHtml}`;
}

function weakText(data, hrid, level) {
    const taken = damageTaken(data, hrid, level);
    const element = Object.keys(taken).reduce((a, b) => (taken[b] > taken[a] ? b : a));
    return `${weakStyles(data, hrid).map(cap).join(" / ")} · ${cap(element)} <span class="mwia-dim">(${pctText(taken[element])})</span>`;
}

function summaryHtml(lab, level) {
    const groups = { fight: [], risky: [], skip: [] };
    for (const m of lab.monsters) {
        const win = winAt(m.curve, level);
        (win >= SAFE_WIN ? groups.fight : win >= RISKY_WIN ? groups.risky : groups.skip).push(esc(monsterName(m.hrid)));
    }
    const line = (label, list, cls) => (list.length ? `<br><span class="${cls}">${label}</span> ${list.join(", ")}` : "");
    return `<div class="mwia-reco"><b>At room level ${level}:</b>
      ${line("✅ Fight:", groups.fight, "mwia-ok")}${line("⚠ Risky:", groups.risky, "mwia-warn")}${line("✖ Shroud or go around:", groups.skip, "mwia-bad")}
      ${groups.fight.length === lab.monsters.length ? "<br>You win every room type here safely – try a higher room level." : ""}</div>`;
}

function monsterTable(lab, profile, data, level, improve) {
    const better = improve ? bestPerMonster(improve, lab) : new Map();
    let html = `<table class="mwia-table mwia-wide"><thead><tr><th>Monster</th><th title="Its attack style and damage type">Attacks with</th>
      <th title="The attack style it hardly dodges, and the damage type its resistances let through best (share at this room level)">Weak to</th>
      <th title="Your weapon's style against it, and your best damage type (share that gets through)">You</th>
      <th class="mwia-num" title="Highest room level where you win at least ${pctText(SAFE_WIN)} of the rooms">Safe up to</th>
      <th class="mwia-num" title="Room level where you win half the rooms">50% at</th>
      <th>At level ${level}</th><th class="mwia-num" title="Typical time to win a room at this level (the limit is 2 minutes)">Win time</th>
      ${improve ? "<th>Better with</th>" : ""}</tr></thead><tbody>`;
    for (const m of lab.monsters) {
        const attack = monsterAttack(data, m.hrid);
        const point = nearestPoint(m.curve, level);
        const win = winAt(m.curve, level);
        const time = point?.medianWinSeconds;
        html += `<tr><td>${esc(monsterName(m.hrid))}</td><td>${cap(attack.style)} · ${cap(attack.type)}</td><td>${weakText(data, m.hrid, level)}</td>
          <td>${yourMatch(profile, data, m.hrid, level)}</td>
          <td class="mwia-num">${m.safe === null ? "<span class=\"mwia-bad\">below 5</span>" : lvl(m.safe)}</td><td class="mwia-num">${m.half === null ? "<span class=\"mwia-bad\">below 5</span>" : lvl(m.half)}</td>
          <td>${verdict(win, point)}</td><td class="mwia-num">${time ? `${Math.round(time)} s` : "–"}</td>
          ${improve ? `<td>${better.get(m.hrid) || '<span class="mwia-dim">–</span>'}</td>` : ""}</tr>`;
    }
    return html + `</tbody></table>`;
}

// Per monster, the best other style (a curve of its own) or ability swap, if clearly better.
function bestPerMonster(improve, lab) {
    const out = new Map();
    for (const base of improve.base) {
        const parts = [];
        const now = lab.monsters.find((m) => m.hrid === base.hrid)?.half ?? 0;
        let bestStyle = null;
        for (const style of improve.styles) {
            const m = style.monsters.find((x) => x.hrid === base.hrid);
            if (m?.half !== null && m.half >= now + 2 && (!bestStyle || m.half > bestStyle.half)) bestStyle = { ...style, half: m.half };
        }
        if (bestStyle) {
            parts.push(`${cap(bestStyle.style)} with ${esc(itemName(bestStyle.weapon.hrid))}${bestStyle.weapon.enhancementLevel ? " +" + bestStyle.weapon.enhancementLevel : ""}
              <span class="mwia-dim">(${bestStyle.weapon.owned ? "yours" : shortCoins(bestStyle.weapon.cost)})</span>: 50% at ${lvl(bestStyle.half)}`);
        }
        let bestSwap = null;
        for (const c of improve.candidates) {
            if (c.kind !== "swap") continue;
            const m = c.perMonster.find((x) => x.hrid === base.hrid);
            if (m && m.levels >= 1 && m.after > m.before && (!bestSwap || m.levels > bestSwap.levels)) bestSwap = { ...m, label: c.label };
        }
        if (bestSwap) parts.push(`${esc(bestSwap.label)} <span class="mwia-dim">(≈ +${bestSwap.levels.toFixed(1)} levels)</span>`);
        if (parts.length) out.set(base.hrid, parts.join("<br>"));
    }
    return out;
}

// What each other style did: the monsters it takes you further against.
function stylesHtml(improve, lab) {
    if (!improve.styles.length) return "";
    const lines = improve.styles.map((style) => {
        const wins = style.monsters.filter((m) => {
            const now = lab.monsters.find((x) => x.hrid === m.hrid)?.half ?? 0;
            return m.half !== null && m.half >= now + 2;
        });
        const weapon = `${esc(itemName(style.weapon.hrid))}${style.weapon.enhancementLevel ? " +" + style.weapon.enhancementLevel : ""} <span class="mwia-dim">(${style.weapon.owned ? "yours" : shortCoins(style.weapon.cost)})</span>`;
        return `<li><b>${cap(style.style)}</b> with ${weapon}: ${wins.length ? `further against ${wins.map((m) => esc(monsterName(m.hrid))).join(", ")}` : '<span class="mwia-dim">no further against any monster</span>'}</li>`;
    });
    return `<p>Other attack styles, tried with only the weapon changed (the rest of your gear, abilities and levels as now):</p><ul>${lines.join("")}</ul>
      <p class="mwia-dim">A style only pays off with gear and abilities for it – a style your gear isn't made for rarely helps, even against a monster weak to it.</p>`;
}

function improveHtml(improve, lab) {
    const general = improve.candidates.filter((c) => c.kind !== "swap").sort((a, b) => b.levels - a.levels);
    const useful = general.filter((c) => c.levels >= 0.5);
    let html = `<h3>What takes you further</h3>
      <p class="mwia-dim">Each change is simulated against every monster at the room level where you now win about half the rooms
      (${improve.rooms} rooms each). The gain is shown as room levels: how much higher you could go for the same win rate. A monster's stats grow
      in proportion to the room level (at level 20 one level more is 5% stronger), so at low levels the gains look small.</p>`;
    if (!useful.length) html += `<p>None of the crates, skill levels or ability levels tested here takes you clearly further.</p>`;
    else {
        html += `<table class="mwia-table mwia-wide"><thead><tr><th>Work on</th><th class="mwia-num" title="Room levels gained, averaged over the ten monsters">≈ Room levels</th><th>Helps most against</th></tr></thead><tbody>`;
        for (const c of useful) {
            const most = [...c.perMonster].filter((m) => m.levels >= 1).sort((a, b) => b.levels - a.levels).slice(0, 4);
            html += `<tr><td>${esc(c.label)}</td><td class="mwia-num">+${c.levels.toFixed(1)}</td>
              <td>${most.map((m) => `${esc(monsterName(m.hrid))} <span class="mwia-dim">+${m.levels.toFixed(1)}</span>`).join(", ") || '<span class="mwia-dim">spread out</span>'}</td></tr>`;
        }
        html += `</tbody></table>`;
    }
    const flat = general.filter((c) => c.levels < 0.5).map((c) => esc(c.label));
    if (flat.length) html += `<p class="mwia-dim">No clear effect (within the noise): ${flat.join(", ")}.</p>`;
    html += stylesHtml(improve, lab);
    html += `<p class="mwia-dim"><b>Better with</b> in the table above: another attack style (your weapon swapped for the one named, everything else as now)
      or an ability you know in place of one you use – useful if you can change your setup between rooms.</p>`;
    return html;
}

export function renderLabyrinth({ lab, improve, profile, data, settings, busy, settingsHtml, slotted, gearNote }) {
    const level = roomLevelSetting(settings);
    let html = `<p>Simulates your combat setup against each of the ten Labyrinth monsters, room level by room level, as the game fights a combat room:
      one monster, scaled to the room level, from full HP and mana, <b>no food or drinks</b> (only the crates you open on entry) and <b>2 minutes</b> to win.
      It shows which rooms you win at a room level, which to shroud or go around, and what would take you further.</p>
      ${settingsHtml(["gear", "accuracy"])}${gearNote}
      <div class="mwia-settings">${crateSelect(settings, "coffee", slotted.coffee)}${crateSelect(settings, "food", slotted.food)}
      <label title="The room level to judge the rooms at; changing it needs no new simulation">Room level
        <input data-setting="labyLevel" type="number" min="1" max="300" step="1" size="4" value="${level}"></label></div>
      <button class="mwia-btn" data-action="laby-check" ${busy ? "disabled" : ""}>Check the rooms</button>`;
    if (!lab) return html;

    const crates = Object.entries(lab.crates).filter(([, t]) => t).map(([k, t]) => `${cap(t)} ${CRATE_KINDS[k]}`);
    html += `<p class="mwia-dim">Simulated with ${crates.length ? crates.join(" and ") : "no crates"}, ${lab.rooms} rooms per monster and room level.</p>`;
    html += summaryHtml(lab, level);
    html += monsterTable(lab, profile, data, level, improve);
    html += `<button class="mwia-btn" data-action="laby-improve" ${busy ? "disabled" : ""}>What should I improve?</button>`;
    if (improve) html += improveHtml(improve, lab);
    html += `<p class="mwia-dim">Each monster hardly dodges one or two attack styles (<b>Weak to</b>) and takes far more of one damage type: the Labyrinth wants
      magic for some rooms, ranged for others and melee (stab, slash or smash) for the rest. Shrouds clear a room without a fight
      (Basic: 2% fail chance per level above 50, Advanced above 100, Expert never fails).
      Estimates from the community simulator's Labyrinth rules – the game can differ.</p>`;
    return html;
}

export function labyrinthExportLines(lab, improve, settings) {
    if (!lab) return [];
    const level = roomLevelSetting(settings);
    const lines = [`Crates: coffee ${lab.crates.coffee || "none"}, food ${lab.crates.food || "none"} · room level ${level}`];
    for (const m of lab.monsters) {
        const win = winAt(m.curve, level);
        lines.push(`${monsterName(m.hrid)}: safe up to ${m.safe ?? "<5"} · 50% at ${m.half === null ? "<5" : Math.round(m.half)} · at ${level}: ${pctText(win)}`);
    }
    if (improve) {
        for (const c of improve.candidates.filter((c) => c.kind !== "swap" && c.levels >= 0.5).sort((a, b) => b.levels - a.levels)) lines.push(`Work on: ${c.label} ≈ +${c.levels.toFixed(1)} room levels`);
        for (const s of improve.styles) lines.push(`As ${s.style} (${itemName(s.weapon.hrid)}): ` + s.monsters.map((m) => `${monsterName(m.hrid)} ${m.half === null ? "<5" : Math.round(m.half)}`).join(", "));
    }
    return lines;
}
