// The Labyrinth tab: which combat rooms you win at a room level and with which of your
// loadouts, which to shroud or go around, what would take you further, and a loadout
// built for the rooms one attack style is for.

import { abilityName, itemName, monsterName } from "./game-data.js";
import { esc, shortCoins } from "./format.js";
import {
    ATTACK_STYLES,
    CRATE_KINDS,
    CRATE_TIERS,
    FLOOR_ONE_LEVEL,
    FLOOR_STEP,
    RISKY_WIN,
    SAFE_WIN,
    floorAt,
    floorLevel,
    monsterAttack,
    monstersFor,
    nearestPoint,
    weakTo,
    winAt,
    yourMatch,
} from "./labyrinth.js";

const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : "");
const pctText = (x) => `${Math.round(100 * x)}%`;
const lvl = (x) => (x === null || x === undefined ? "–" : String(Math.round(x)));
const FLOORS = 10;

export const roomLevelSetting = (settings) => Math.max(1, Math.min(300, Math.round(Number(settings.labyLevel) || FLOOR_ONE_LEVEL)));
export const buildStyleSetting = (settings) => (ATTACK_STYLES.includes(settings.labyStyle) ? settings.labyStyle : "ranged");

function crateSelect(settings, kind, slotted) {
    const key = kind === "coffee" ? "labyCoffee" : "labyFood";
    const value = settings[key] || "slots";
    const options = [["slots", `Your Labyrinth slots (${slotted ? cap(slotted) : "none"})`], ["none", "None"], ...CRATE_TIERS.map((t) => [t, cap(t)])];
    return `<label title="Opened when you enter the Labyrinth; its buffs last the whole run">${CRATE_KINDS[kind]}
      <select data-setting="${key}">${options.map(([k, v]) => `<option value="${k}" ${value === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`;
}

function floorSelect(level) {
    const options = Array.from({ length: FLOORS }, (_, i) => i + 1).map((f) => `<option value="${f}" ${floorLevel(f) === level ? "selected" : ""}>Floor ${f} (≈ level ${floorLevel(f)})</option>`);
    const custom = !options.some((o) => o.includes("selected"));
    return `<label title="A guess: floor 1 at room level ${FLOOR_ONE_LEVEL} and about ${FLOOR_STEP} levels more per floor (a community guide). Type the room level if the game shows it.">Floor
      <select data-setting="labyFloor">${custom ? `<option selected value="">Room level ${level}</option>` : ""}${options.join("")}</select></label>`;
}

const floorText = (level) => (level === null ? "" : floorAt(level) ? ` <span class="mwia-dim">(fl. ${floorAt(level)})</span>` : ` <span class="mwia-dim">(below fl. 1)</span>`);

function verdict(win, point) {
    if (win === null) return "–";
    if (win >= SAFE_WIN) return `<span class="mwia-ok" title="You win ${pctText(win)} of these rooms">✅ fight · ${pctText(win)}</span>`;
    const dies = point && point.deaths >= point.timeouts;
    const why = point ? (dies ? " · you die" : " · too slow") : "";
    const title = point ? (dies ? "Most lost rooms end with you dead" : "Most lost rooms end when the 2 minutes run out: more damage needed") : "";
    if (win >= RISKY_WIN) return `<span class="mwia-warn" title="${title}">⚠ risky · ${pctText(win)}${why}</span>`;
    return `<span class="mwia-bad" title="${title}">✖ shroud or go around · ${pctText(win)}${why}</span>`;
}

export function weakText(data, hrid) {
    const weak = weakTo(data, hrid);
    if (weak.thorns) return `<span title="It dodges every style and attacks very fast: the wiki says damage back when it hits you beats it">Thorns / Retaliation</span>`;
    return weak.styles.map((s) => (s.types.length === 1 && s.types[0] === "physical" ? cap(s.style) : `${cap(s.style)} <span class="mwia-dim">(${s.types.join(", ")})</span>`)).join(" · ");
}

function matchHtml(profile, data, hrid) {
    const m = profile && yourMatch(profile, data, hrid);
    if (!m) return "–";
    const what = m.what.startsWith("/abilities/") ? abilityName(m.what) : m.what.startsWith("/items/") ? itemName(m.what) : m.what;
    const label = `${cap(m.style)} · ${m.type}`;
    if (m.share >= 0.5) return `<span class="mwia-ok" title="Your best hit against it: ${esc(what)}">${label} ✓</span>`;
    return `<span class="mwia-bad" title="Your best hit (${esc(what)}) does about ${Math.max(1, Math.round(1 / Math.max(1e-3, m.share)))}× worse than its weakness">${label} ✗</span>`;
}

// The room guide: one tile per room type with the loadout to put on, or to shroud it.
function roomGuide(lab, data, level) {
    const tiles = lab.monsters.map((m) => {
        const win = winAt(m.curve, level);
        const kind = win >= SAFE_WIN ? "ok" : win >= RISKY_WIN ? "warn" : "bad";
        const action = kind === "bad" ? "Shroud or go around" : esc(m.setupName);
        const reach = m.safe === null ? "never safe" : floorAt(m.safe) ? `safe to floor ${floorAt(m.safe)}` : `safe to level ${lvl(m.safe)}`;
        return `<div class="mwia-laby-tile mwia-laby-${kind}" title="${esc(monsterName(m.hrid))}: ${pctText(win)} of the rooms won at room level ${level} with ${esc(m.setupName)}">
          <div class="mwia-laby-tile-name">${esc(monsterName(m.hrid))}</div>
          <div class="mwia-laby-tile-action">${kind === "bad" ? "✖" : kind === "warn" ? "⚠" : "✅"} ${action}</div>
          <div class="mwia-dim">${kind === "bad" ? `best: ${esc(m.setupName)} · ` : ""}${pctText(win)} · ${reach}</div></div>`;
    });
    return `<div class="mwia-laby-guide">${tiles.join("")}</div>`;
}

function summaryHtml(lab, level) {
    const groups = { fight: [], risky: [], skip: [] };
    for (const m of lab.monsters) {
        const win = winAt(m.curve, level);
        (win >= SAFE_WIN ? groups.fight : win >= RISKY_WIN ? groups.risky : groups.skip).push(esc(monsterName(m.hrid)));
    }
    const line = (label, list, cls) => (list.length ? `<br><span class="${cls}">${label}</span> ${list.join(", ")}` : "");
    const floor = floorAt(level) && floorLevel(floorAt(level)) === level ? ` (floor ${floorAt(level)}, a guess)` : "";
    return `<div class="mwia-reco"><b>At room level ${level}${floor}</b>, each room type with its best loadout:
      ${line("✅ Fight:", groups.fight, "mwia-ok")}${line("⚠ Risky:", groups.risky, "mwia-warn")}${line("✖ Shroud or go around:", groups.skip, "mwia-bad")}
      ${groups.fight.length === lab.monsters.length ? "<br>You win every room type here safely – try a deeper floor." : ""}</div>`;
}

function monsterTable(lab, profileOf, data, level, improve) {
    const swaps = improve ? bestSwaps(improve) : new Map();
    const several = lab.setups.length > 1;
    let html = `<table class="mwia-table mwia-wide mwia-laby-rooms"><thead><tr><th>Monster</th><th title="Its attack style and damage type">Attacks with</th>
      <th title="The attack styles (and damage types) that hurt it most: the styles it hardly dodges and what its resistances let through">Weak to</th>
      ${several ? `<th title="Your saved loadout that goes furthest against it – set it for this room type in the game's Labyrinth automation">Loadout</th>` : ""}
      <th title="That loadout's best way of hitting it: ✓ when it is (close to) its weakness">Your hit</th>
      <th class="mwia-num" title="Highest room level where you win at least ${pctText(SAFE_WIN)} of the rooms (the floor is a guess)">Safe up to</th>
      <th class="mwia-num" title="Room level where you win half the rooms">50% at</th>
      <th>At level ${level}</th><th class="mwia-num" title="Typical time to win a room at this level (the limit is 2 minutes)">Win time</th>
      ${improve ? "<th>Better with</th>" : ""}</tr></thead><tbody>`;
    for (const m of lab.monsters) {
        const attack = monsterAttack(data, m.hrid);
        const point = nearestPoint(m.curve, level);
        const time = point?.medianWinSeconds;
        html += `<tr><td>${esc(monsterName(m.hrid))}</td><td>${cap(attack.style)} · ${attack.type}</td><td><span>${weakText(data, m.hrid)}</span></td>
          ${several ? `<td>${esc(m.setupName)}</td>` : ""}<td>${matchHtml(profileOf(m.setupId), data, m.hrid)}</td>
          <td class="mwia-num">${m.safe === null ? '<span class="mwia-bad">below 5</span>' : `<span>${lvl(m.safe)}${floorText(m.safe)}</span>`}</td>
          <td class="mwia-num">${m.half === null ? '<span class="mwia-bad">below 5</span>' : lvl(m.half)}</td>
          <td>${verdict(winAt(m.curve, level), point)}</td><td class="mwia-num">${time ? `${Math.round(time)} s` : "–"}</td>
          ${improve ? `<td><span>${swaps.get(m.hrid) || '<span class="mwia-dim">–</span>'}</span></td>` : ""}</tr>`;
    }
    return html + `</tbody></table>`;
}

// Every loadout against every monster: where each wins half the rooms.
function loadoutMatrix(lab) {
    if (lab.setups.length < 2) return "";
    let html = `<details class="mwia-skill-sec"><summary>All your loadouts: room level where each wins half the rooms</summary>
      <table class="mwia-table mwia-wide"><thead><tr><th>Monster</th>${lab.setups.map((s) => `<th class="mwia-num">${esc(s.name)}</th>`).join("")}</tr></thead><tbody>`;
    lab.monsters.forEach((best, i) => {
        html += `<tr><td>${esc(monsterName(best.hrid))}</td>${lab.setups
            .map((s) => {
                const m = s.monsters[i];
                const text = m.half === null ? "below 5" : lvl(m.half);
                return `<td class="mwia-num">${s.id === best.setupId ? `<b>${text}</b>` : `<span class="mwia-dim">${text}</span>`}</td>`;
            })
            .join("")}</tr>`;
    });
    return html + `</tbody></table></details>`;
}

// Per monster, an ability you know in place of one its loadout uses, if clearly better.
// An ability in place of another only counts when it beats taking the other off (the gain
// can be all from the old one gone, as Fireball in a crossbow loadout).
function bestSwaps(improve) {
    const out = new Map();
    const dropOf = (c, hrid) => improve.candidates.find((d) => d.kind === "swap" && !d.hrid && d.replaces === c.replaces && d.setupName === c.setupName)?.perMonster.find((m) => m.hrid === hrid);
    for (const c of improve.candidates) {
        if (c.kind !== "swap") continue;
        for (const m of c.perMonster) {
            if (m.levels < 1 || m.after <= m.before) continue;
            const drop = c.hrid && c.replaces ? dropOf(c, m.hrid) : null;
            if (drop && m.levels < drop.levels + 1) continue;
            const known = out.get(m.hrid);
            if (!known || m.levels > known.levels) out.set(m.hrid, { levels: m.levels, label: c.label });
        }
    }
    return new Map([...out].map(([hrid, s]) => [hrid, `${esc(s.label)} <span class="mwia-dim">(≈ +${s.levels.toFixed(1)} levels)</span>`]));
}

function improveHtml(improve) {
    const general = improve.candidates.filter((c) => c.kind !== "swap").sort((a, b) => b.levels - a.levels);
    const useful = general.filter((c) => c.levels >= 0.5);
    let html = `<h3>What takes you further</h3>
      <p class="mwia-dim">Each change is simulated against every monster, with the loadout you'd use for it, at the room level where you now win about
      half the rooms (${improve.rooms} rooms each). The gain is shown as room levels: how much deeper you could go for the same win rate, averaged over
      all ten room types. A monster's stats grow in proportion to the room level (at level 20 one level more is 5% stronger), so low down the gains look small.</p>`;
    if (!useful.length) html += `<p>None of the crates, skill levels or ability levels tested here takes you clearly further.</p>`;
    else {
        html += `<table class="mwia-table mwia-wide"><thead><tr><th>Work on</th><th class="mwia-num" title="Room levels gained, averaged over the ten room types">≈ Room levels</th><th>Helps most against</th></tr></thead><tbody>`;
        for (const c of useful) {
            const most = [...c.perMonster].filter((m) => m.levels >= 1).sort((a, b) => b.levels - a.levels).slice(0, 4);
            html += `<tr><td>${esc(c.label)}</td><td class="mwia-num">+${c.levels.toFixed(1)}</td>
              <td>${most.map((m) => `${esc(monsterName(m.hrid))} <span class="mwia-dim">+${m.levels.toFixed(1)}</span>`).join(", ") || '<span class="mwia-dim">spread out</span>'}</td></tr>`;
        }
        html += `</tbody></table>`;
    }
    const flat = [...new Set(general.filter((c) => c.levels < 0.5).map((c) => c.label))].map(esc);
    if (flat.length) html += `<p class="mwia-dim">No clear effect (within the noise): ${flat.join(", ")}.</p>`;
    html += `<p class="mwia-dim"><b>Better with</b> in the table above: an ability you know in place of one that monster's loadout uses.</p>`;
    return html;
}

// ---------- the loadout builder ----------

function pickText(p, coins) {
    const gear = (hrid, level) => `${esc(itemName(hrid))}${level ? " +" + level : ""}`;
    const levels = `<span class="mwia-dim">≈ +${p.levels.toFixed(1)} room levels</span>`;
    const price = p.cost ? coins(p.cost) : p.owned ? '<span class="mwia-ok">you own it</span>' : "free";
    if (p.kind === "gear") {
        const how = p.enhance ? ` <span class="mwia-dim">(🔨 enhance it yourself)</span>` : "";
        return `${cap(p.slot.replace("_", " "))}: <b>${gear(p.hrid, p.enhancementLevel)}</b>${p.replaces ? ` instead of ${gear(p.replaces.hrid, p.replaces.enhancementLevel)}` : ""}${how} – ${price} · ${levels}`;
    }
    if (p.kind === "ability") return `Ability: <b>${esc(abilityName(p.hrid))}</b>${p.replaces ? ` instead of ${esc(abilityName(p.replaces))}` : " in an empty slot"}${p.cost ? " (book)" : ""} – ${price} · ${levels}`;
    if (p.kind === "abilityLevel") return `Level <b>${esc(abilityName(p.hrid))}</b> ${p.fromLevel} → ${p.level} (${p.books} book${p.books === 1 ? "" : "s"}) – ${price} · ${levels}`;
    if (p.kind === "triggers") return `Run your abilities <b>without triggers</b> (cast as soon as they're ready) – free · ${levels}`;
    if (p.kind === "drop") return `Take <b>${esc(abilityName(p.hrid))}</b> off – free · ${levels}`;
    if (p.kind === "dropAll") return `Take <b>all abilities</b> off (auto attacks only) – free · ${levels}`;
    return "";
}

function cartOf(build) {
    const items = [];
    if (build.starter && !build.starter.owned) items.push({ hrid: build.starter.hrid, quantity: 1, enhancementLevel: build.starter.enhancementLevel });
    for (const p of build.picks) {
        if (p.kind === "gear" && !p.owned && !p.enhance) items.push({ hrid: p.hrid, quantity: 1, enhancementLevel: p.enhancementLevel });
        if ((p.kind === "ability" || p.kind === "abilityLevel") && p.cost && p.bookHrid) items.push({ hrid: p.bookHrid, quantity: p.books || 1, enhancementLevel: 0 });
    }
    return items;
}

function buildHtml(build, data, settings, busy, settingsHtml, cartButton, coins) {
    const style = buildStyleSetting(settings);
    const targets = monstersFor(data, style).map((h) => esc(monsterName(h)));
    let html = `<h3>Build a loadout for the Labyrinth</h3>
      <p>Starts from your gear (<b>Gear from</b>) with a weapon for the style – yours, else the cheapest – and tries every piece of gear, every ability
      (new, or levelled with books), taking abilities off and running them without triggers against the room types weak to that style, at the room level where you now
      win about half. Ranked by room levels per coin – for winning 2-minute duels, not for XP or loot.</p>
      <div class="mwia-settings"><label title="The attack style to build for; the room types weak to it are the targets">Fight as
        <select data-setting="labyStyle">${ATTACK_STYLES.map((s) => `<option value="${s}" ${s === style ? "selected" : ""}>${cap(s)}</option>`).join("")}</select></label></div>
      ${settingsHtml(["gear", "budget", "spending"])}
      <p class="mwia-dim">For: ${targets.join(", ") || "no room type"}.</p>
      <button class="mwia-btn" data-action="laby-build" ${busy ? "disabled" : ""}>Build loadout</button>`;
    if (!build || build.style !== style) return html;

    const before = new Map(build.before.map((m) => [m.hrid, m]));
    html += `<div class="mwia-reco"><b>${cap(build.style)} loadout</b> – ${build.picks.length || build.starter ? `for ${coins(build.spent)} of your ${coins(build.budget)}` : "nothing to buy"}`;
    if (build.starter) html += `<br>Weapon: <b>${esc(itemName(build.starter.hrid))}${build.starter.enhancementLevel ? " +" + build.starter.enhancementLevel : ""}</b> ${build.starter.owned ? '<span class="mwia-ok">you own it</span>' : "– " + coins(build.starter.cost)}`;
    html += `<ol class="mwia-plan">${build.picks.map((p) => `<li>${pickText(p, coins)}</li>`).join("") || "<li>Nothing tested takes these rooms clearly further within the budget.</li>"}</ol>`;
    const cart = cartOf(build);
    if (cart.length) html += cartButton(cart, "🛒 Add all to the cart");
    html += `</div><table class="mwia-table mwia-wide mwia-laby-built"><thead><tr><th>Monster</th><th class="mwia-num" title="Highest room level with at least ${pctText(SAFE_WIN)} of the rooms won">Safe: now</th><th class="mwia-num">Safe: built</th><th class="mwia-num" title="Room level where you win half the rooms">50%: now</th><th class="mwia-num">50%: built</th></tr></thead><tbody>`;
    for (const m of build.after) {
        const b = before.get(m.hrid);
        const cell = (x) => (x === null ? "below 5" : lvl(x));
        html += `<tr><td>${esc(monsterName(m.hrid))}</td><td class="mwia-num">${cell(b.safe)}</td><td class="mwia-num"><span><b>${cell(m.safe)}</b>${floorText(m.safe)}</span></td>
          <td class="mwia-num">${cell(b.half)}</td><td class="mwia-num"><b>${cell(m.half)}</b></td></tr>`;
    }
    html += `</tbody></table>`;
    if (build.nearMisses?.length) {
        html += `<details class="mwia-skill-sec"><summary>Also tested: the closest that didn't make the list (on top of it)</summary><ul>${build.nearMisses
            .map((p) => `<li>${pickText(p, coins)}</li>`)
            .join("")}</ul></details>`;
    }
    html += `<p class="mwia-dim">"Now" is your gear (Gear from)${build.starter ? " with the weapon above" : ""}. Put the list on in the game, save it as a
      loadout and pick it for these room types in the Labyrinth automation. ${build.tested} changes tested; each has to take you at least half a room level further
      (and a purchase, under <b>Spending</b>, Frugal: 2 levels per 1M, Balanced: 0.5, All in: anything within the budget).</p>`;
    return html;
}

export function renderLabyrinth({ lab, improve, build, profileOf, data, settings, busy, settingsHtml, slotted, setupsNote, cartButton, coins = shortCoins }) {
    const level = roomLevelSetting(settings);
    let html = `<p>Simulates your combat loadouts against each of the ten Labyrinth monsters, room level by room level, as the game fights a combat room:
      1 against 1, scaled to the room level, from full HP and mana, <b>no food or drinks</b> (only the crates you open on entry) and <b>2 minutes</b> to win.
      The game's Labyrinth automation can put on a loadout for each room type, so every monster is judged with the loadout that does best against it.</p>
      ${settingsHtml(["accuracy"])}${setupsNote}
      <div class="mwia-settings">${crateSelect(settings, "coffee", slotted.coffee)}${crateSelect(settings, "food", slotted.food)}${floorSelect(level)}
      <label title="The room level to judge the rooms at; changing it needs no new simulation">Room level
        <input data-setting="labyLevel" type="number" min="1" max="300" step="1" size="4" value="${level}"></label></div>
      <button class="mwia-btn" data-action="laby-check" ${busy ? "disabled" : ""}>Check the rooms</button>`;
    if (lab) {
        const crates = Object.entries(lab.crates).filter(([, t]) => t).map(([k, t]) => `${cap(t)} ${CRATE_KINDS[k]}`);
        html += `<p class="mwia-dim">Simulated with ${crates.length ? crates.join(" and ") : "no crates"}, ${lab.rooms} rooms per monster and room level, ${lab.setups.length} loadout${lab.setups.length === 1 ? "" : "s"}.</p>`;
        html += summaryHtml(lab, level);
        html += roomGuide(lab, data, level);
        html += monsterTable(lab, profileOf, data, level, improve);
        html += loadoutMatrix(lab);
        html += `<button class="mwia-btn" data-action="laby-improve" ${busy ? "disabled" : ""}>What should I improve?</button>`;
        if (improve) html += improveHtml(improve);
    }
    html += buildHtml(build, data, settings, busy, settingsHtml, cartButton, coins);
    html += `<h3>On the Labyrinth map</h3>
      <p>Next: marks on the game's Labyrinth map (and later its automation settings) saying which loadout to use in each room. For that the script
      first has to learn how the game shows the Labyrinth: it keeps what the game sends about it while you play. After a run (or with the Labyrinth
      open), tap this and paste the report into the chat – it only reads, nothing is changed.</p>
      <button class="mwia-btn" data-action="laby-read">📋 Read the game's Labyrinth</button>`;
    html += `<p class="mwia-dim">Each monster hardly dodges one or two attack styles and takes far more of one damage type (<b>Weak to</b>): the Labyrinth wants
      magic for some rooms, ranged for others and melee (stab, slash or smash) for the rest. Single-target damage is what counts in a 1-against-1 room.
      Shrouds clear a room without a fight (Basic: 2% fail chance per level above 50, Advanced above 100, Expert never fails).
      Floors are a guess (floor 1 ≈ room level ${FLOOR_ONE_LEVEL}, +${FLOOR_STEP} a floor). Estimates from the community simulator's Labyrinth rules – the game can differ.</p>`;
    return html;
}

export function labyrinthExportLines(lab, improve, build, settings) {
    const lines = [];
    const level = roomLevelSetting(settings);
    if (lab) {
        lines.push(`Crates: coffee ${lab.crates.coffee || "none"}, food ${lab.crates.food || "none"} · room level ${level} · loadouts ${lab.setups.map((s) => s.name).join(", ")}`);
        for (const m of lab.monsters) {
            lines.push(`${monsterName(m.hrid)} (${m.setupName}): safe up to ${m.safe ?? "<5"} · 50% at ${m.half === null ? "<5" : Math.round(m.half)} · at ${level}: ${pctText(winAt(m.curve, level))}`);
        }
    }
    if (improve) for (const c of improve.candidates.filter((c) => c.kind !== "swap" && c.levels >= 0.5).sort((a, b) => b.levels - a.levels)) lines.push(`Work on: ${c.label} ≈ +${c.levels.toFixed(1)} room levels`);
    if (build) {
        lines.push(`Built ${build.style} loadout for ${shortCoins(build.spent)}${build.starter ? ` with ${itemName(build.starter.hrid)}` : ""}: ${build.picks.map((p) => (p.kind === "triggers" ? "no triggers" : p.kind === "dropAll" ? "no abilities" : p.kind === "drop" ? "without " + abilityName(p.hrid) : p.kind === "gear" ? itemName(p.hrid) + (p.enhancementLevel ? " +" + p.enhancementLevel : "") : abilityName(p.hrid) + (p.kind === "abilityLevel" ? ` ${p.level}` : ""))).join(", ") || "nothing"}`);
        for (const m of build.after) lines.push(`  ${monsterName(m.hrid)}: 50% at ${m.half === null ? "<5" : Math.round(m.half)}`);
    }
    return lines;
}
