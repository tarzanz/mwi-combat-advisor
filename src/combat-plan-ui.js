// The ⚔ Plan tab: the combat plan the Pi worked out (src/combat-plan.js) – what to do now as a
// checklist that turns green as the game shows it done (buy, put in the loadout, set the
// triggers, fight there), how far the plan gets against fighting as you are, and every phase.

import { abilityName, actionName, getClientData, itemName } from "./game-data.js";
import { esc, shortCoins } from "./format.js";
import { state } from "./game-state.js";
import { buildProfile, combatLoadouts, slotCounts } from "./profile.js";
import { heldStock } from "./skilling.js";
import { cleanTriggers, describeTriggers } from "./triggers.js";
import { queuedFight } from "./loadout-advice.js";
import { COMBAT_PLAN_DAYS } from "./combat-plan.js";
import { combatPlanOptions, combatPlanState } from "./combat-plan-sync.js";

export const RESERVE_CHOICES = [0, 5e6, 20e6, 50e6, 100e6, 250e6];
// Drinks and food are bought for the phase, at most this many hours of them.
export const CONSUMABLE_HOURS_MAX = 72;
const SLOTS = ["main_hand", "two_hand", "off_hand", "head", "body", "legs", "feet", "hands", "neck", "earrings", "ring", "back", "charm", "pouch"];

const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const dayText = (d) => (Math.round(d * 3) / 3).toFixed(1).replace(/\.0$/, "");
const zoneText = (z) => `${esc(actionName(z.zoneHrid))}${z.tier ? ` T${z.tier}` : ""}`;
const plus = (hrid, level) => `${esc(itemName(hrid))}${level ? ` +${level}` : ""}`;
const ok = (good) => (good ? `<span class="mwia-cp-ok">✓</span>` : `<span class="mwia-cp-no">✗</span>`);
const row = (good, html) => `<li class="${good ? "mwia-cp-green" : "mwia-cp-red"}">${ok(good)} ${html}</li>`;
function ago(ms) {
    if (!ms) return "—";
    const minutes = Math.round((Date.now() - ms) / 60000);
    if (minutes < 1) return "just now";
    if (minutes < 90) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    return hours < 48 ? `${hours} h ago` : `${Math.round(hours / 24)} days ago`;
}
function inTime(ms) {
    const minutes = Math.round((ms - Date.now()) / 60000);
    if (minutes <= 0) return "soon";
    if (minutes < 90) return `in ${minutes} min`;
    return `in ${Math.round(minutes / 60)} h`;
}

// ---------- what you have, from the game ----------

export function ownedNow() {
    const data = getClientData();
    if (!state.character || !data) return null;
    const profile = buildProfile(state.character, state.items, data);
    const gear = [...Object.values(profile.equipment || {}), ...(profile.inventory || [])].filter(Boolean);
    return {
        profile,
        hasGear: (hrid, level) => gear.some((g) => g.hrid === hrid && (g.enhancementLevel || 0) >= (level || 0)),
        abilityLevel: (hrid) => profile.learnedAbilities?.[hrid] || 0,
        room: (hrid) => profile.houseRooms?.[hrid] || 0,
        count: (hrid) => heldStock(state.character, state.items, hrid).inventory,
    };
}

// The game loadout the plan is for, as the advisor reads it: { id, name, profile } or null.
function planLoadout(result, setups) {
    const id = result?.setup?.id;
    return (id && setups.find((s) => s.id === id)) || null;
}

const sameTriggers = (a, b) => JSON.stringify(cleanTriggers(a || [])) === JSON.stringify(cleanTriggers(b || []));
const gearKey = (g) => (g ? `${g.hrid}+${g.enhancementLevel || 0}` : "");
const normalAbilities = (list) => (list || []).slice(1).map((a) => a?.hrid || null);

// The phase's drinks and food for its hours (at most CONSUMABLE_HOURS_MAX), less what you hold.
export function consumablesToBuy(phase, have) {
    const hours = Math.min(CONSUMABLE_HOURS_MAX, (phase.to - phase.from) * 24);
    const wanted = [...(phase.loadout.drinks || []), ...(phase.loadout.food || [])].filter(Boolean);
    return [...new Set(wanted)].map((hrid) => {
        const need = Math.ceil((phase.rates.consumablesPerHour?.[hrid] || 0) * hours);
        const held = have ? have.count(hrid) : 0;
        return { hrid, need, held, missing: Math.max(0, need - held), hours };
    });
}

// Everything the first combat phase needs that you don't have yet, for the MWITools cart.
export function missingForCart(phase, have) {
    const items = [];
    for (const b of phase.buys || []) {
        if (b.kind === "gear" && !have.hasGear(b.hrid, b.enhancementLevel)) items.push({ hrid: b.hrid, enhancementLevel: b.enhancementLevel || 0, quantity: 1 });
        if ((b.kind === "ability" || b.kind === "abilityLevel") && b.bookHrid && have.abilityLevel(b.hrid) < b.level) items.push({ hrid: b.bookHrid, quantity: Math.max(1, b.books || 1) - have.count(b.bookHrid) });
        if (b.kind === "house" && have.room(b.hrid) < b.level) for (const m of b.materials || []) items.push({ hrid: m.hrid, quantity: m.count - have.count(m.hrid) });
    }
    for (const c of consumablesToBuy(phase, have)) if (c.missing > 0) items.push({ hrid: c.hrid, quantity: c.missing });
    return items.filter((i) => i.quantity > 0);
}

// ---------- the checklist ----------

function buyRows(phase, have) {
    const rows = [];
    for (const b of phase.buys || []) {
        if (b.kind === "gear") {
            const sold = b.sold?.length ? ` <span class="mwia-dim">(sell ${b.sold.map((g) => plus(g.hrid, g.enhancementLevel)).join(", ")})</span>` : "";
            rows.push(row(have.hasGear(b.hrid, b.enhancementLevel), `Buy <b>${plus(b.hrid, b.enhancementLevel)}</b> for ${b.slot.replace("_", " ")} – ${coins(b.price)}${sold}`));
        } else if (b.kind === "ability") {
            rows.push(row(have.abilityLevel(b.hrid) >= 1, `Buy and read <b>${esc(itemName(b.bookHrid || ""))}</b> – ${coins(b.cost)}`));
        } else if (b.kind === "abilityLevel") {
            rows.push(row(have.abilityLevel(b.hrid) >= b.level, `Read ${b.books} × <b>${esc(itemName(b.bookHrid || ""))}</b> for ${esc(abilityName(b.hrid))} ${b.fromLevel} → ${b.level} – ${coins(b.cost)}`));
        } else if (b.kind === "house") {
            rows.push(row(have.room(b.hrid) >= b.level, `Build <b>${esc(cap((b.hrid || "").split("/").pop().replace(/_/g, " ")))}</b> level ${b.level} – materials ${coins(b.cost)}`));
        }
    }
    for (const c of consumablesToBuy(phase, have)) {
        rows.push(row(c.missing === 0, `${c.need.toLocaleString("en-US")} × <b>${esc(itemName(c.hrid))}</b> for ${Math.round(c.hours)} h <span class="mwia-dim">(you have ${c.held.toLocaleString("en-US")})</span>`));
    }
    return rows;
}

function loadoutRows(phase, game) {
    const rows = [];
    const want = phase.loadout;
    const has = game?.profile || null;
    const data = getClientData();
    for (const slot of SLOTS) {
        const w = want.equipment?.[slot] || null;
        const g = has?.equipment?.[slot] || null;
        if (!w && !g) continue;
        if (!w) {
            rows.push(row(false, `${slot.replace("_", " ")}: take off ${plus(g.hrid, g.enhancementLevel)}`));
            continue;
        }
        rows.push(row(gearKey(w) === gearKey(g), `${slot.replace("_", " ")}: <b>${plus(w.hrid, w.enhancementLevel)}</b>${g && gearKey(w) !== gearKey(g) ? ` <span class="mwia-dim">(now ${plus(g.hrid, g.enhancementLevel)})</span>` : ""}`));
    }
    const wantAbilities = normalAbilities(want.abilities);
    const hasAbilities = normalAbilities(has?.abilities);
    wantAbilities.forEach((hrid, i) => {
        if (!hrid && !hasAbilities[i]) return;
        const good = hrid === (hasAbilities[i] || null);
        rows.push(row(good, `Ability ${i + 1}: <b>${hrid ? esc(abilityName(hrid)) : "empty"}</b>${!good && hasAbilities[i] ? ` <span class="mwia-dim">(now ${esc(abilityName(hasAbilities[i]))})</span>` : ""}`));
    });
    if (want.abilities?.[0]?.hrid || has?.abilities?.[0]?.hrid) {
        const w = want.abilities?.[0]?.hrid || null;
        rows.push(row(w === (has?.abilities?.[0]?.hrid || null), `Special: <b>${w ? esc(abilityName(w)) : "empty"}</b>`));
    }
    const slots = data && has ? slotCounts(has, data) : null;
    for (const [kind, label] of [["drinks", "Drink"], ["food", "Food"]]) {
        const w = (want[kind] || []).filter(Boolean);
        const g = (has?.[kind] || []).slice(0, slots ? slots[kind] : undefined).filter(Boolean);
        for (const hrid of w) rows.push(row(g.includes(hrid), `${label}: <b>${esc(itemName(hrid))}</b>`));
        for (const hrid of g) if (!w.includes(hrid)) rows.push(row(false, `${label}: take out ${esc(itemName(hrid))}`));
    }
    return rows;
}

function triggerRows(phase, game) {
    const data = getClientData() || {};
    const want = phase.loadout;
    const has = game?.profile || null;
    const rows = [];
    const tuned = new Set((phase.triggers || []).map((t) => t.hrid));
    const abilities = (want.abilities || []).map((a) => a?.hrid).filter(Boolean);
    for (const hrid of abilities) {
        const w = want.abilityTriggers?.[hrid];
        if (!w) continue;
        const good = has ? sameTriggers(w, has.abilityTriggers?.[hrid]) : false;
        rows.push(row(good, `${esc(abilityName(hrid))}: <b>${esc(describeTriggers(w, data))}</b>${tuned.has(hrid) ? " <span class=\"mwia-dim\">(tuned)</span>" : ""}`));
    }
    for (const hrid of [...(want.food || []), ...(want.drinks || [])].filter(Boolean)) {
        const w = want.consumableTriggers?.[hrid];
        if (!w) continue;
        const good = has ? sameTriggers(w, has.consumableTriggers?.[hrid]) : false;
        rows.push(row(good, `${esc(itemName(hrid))}: <b>${esc(describeTriggers(w, data))}</b>${tuned.has(hrid) ? " <span class=\"mwia-dim\">(tuned)</span>" : ""}`));
    }
    return rows;
}

function nextHtml(result, setups) {
    const phases = result.phases || [];
    const first = phases[0];
    const fight = phases.find((p) => p.kind === "combat");
    const have = ownedNow();
    if (!first || !have) return "";
    const game = planLoadout(result, setups);
    const parts = [];
    if (first.kind === "skilling") {
        parts.push(`<p><b>First: ${dayText((first.to - first.from) * 24)} h of skilling</b>${first.job ? ` – ${esc(first.job)}` : ""} (as the 📈 plan says) for ${coins(first.gold)}: ${first.why === "saving up" ? "the plan saves up for gear before it fights" : "it pays for the purchases below"}.</p>`);
    }
    if (!fight) return parts.join("") + `<p>The plan doesn't fight within its days.</p>`;
    const buys = buyRows(fight, have);
    const loadout = loadoutRows(fight, game);
    const triggers = triggerRows(fight, game);
    const queued = queuedFight(state.character);
    const zoneGood = queued && queued.zoneHrid === fight.zone.zoneHrid && (queued.tier || 0) === (fight.zone.tier || 0);
    const done = (rows) => rows.every((r) => r.includes("mwia-cp-green"));
    const head = (n, title, rows) => `<h4 class="${done(rows) ? "mwia-cp-head-ok" : "mwia-cp-head-no"}">${done(rows) ? "✓" : n} ${title}</h4>`;
    const cart = missingForCart(fight, have);
    parts.push(`<div class="mwia-cp-next">`);
    parts.push(`<p><b>Then fight in ${zoneText(fight.zone)}</b> for ${dayText(fight.to - fight.from)} days – ${fight.rates.levelsPerDay.toFixed(2)} levels a day, ${coins(fight.rates.profitPerHour)}/h.</p>`);
    parts.push(head(1, "Buy", buys) + (buys.length ? `<ul class="mwia-cp-list">${buys.join("")}</ul>` : `<p class="mwia-dim">Nothing to buy.</p>`));
    if (cart.length) parts.push(`<button class="mwia-btn" data-action="cplan-cart" title="${esc(cart.map((i) => `${i.quantity} ${itemName(i.hrid)}${i.enhancementLevel ? ` +${i.enhancementLevel}` : ""}`).join(", "))}">🛒 Add the ${cart.length} missing to the MWITools cart</button>`);
    parts.push(head(2, `Loadout ${game ? `“${esc(game.name)}”` : ""}`, loadout) + (game ? `<ul class="mwia-cp-list">${loadout.join("")}</ul>` : `<p class="mwia-warn">The loadout the plan was made for isn't among yours any more – pick one under Loadout.</p>`));
    parts.push(head(3, "Triggers", triggers) + (triggers.length ? `<ul class="mwia-cp-list">${triggers.join("")}</ul><p class="mwia-dim">The loadout's ⚙ in the game opens its trigger window; ▶ Fill in there puts these in, and you tap Save.</p>` : `<p class="mwia-dim">No triggers to set.</p>`));
    parts.push(head(4, "Fight", [row(zoneGood, "")]) + `<ul class="mwia-cp-list">${row(zoneGood, `${zoneText(fight.zone)}${queued && !zoneGood ? ` <span class="mwia-dim">(queued now: ${zoneText(queued)})</span>` : ""}`)}</ul>`);
    parts.push(`</div>`);
    return parts.join("");
}

// ---------- the rest ----------

function settingsHtml(settings, setups) {
    const o = combatPlanOptions(settings);
    const option = (value, label, current) => `<option value="${esc(String(value))}" ${String(current) === String(value) ? "selected" : ""}>${esc(label)}</option>`;
    const loadouts = combatLoadouts(state.character);
    return `<div class="mwia-settings">
      <label title="The style the plan trains and fights in; it never switches.">Style <select data-setting="cplanStyle">${["magic", "ranged", "melee"].map((s) => option(s, cap(s), o.style)).join("")}</select></label>
      ${o.style === "melee" ? `<label title="Keep to one melee style, or let the plan pick the weapon.">Melee <select data-setting="cplanMelee">${["any", "stab", "slash", "smash"].map((s) => option(s, s === "any" ? "Any weapon" : cap(s), o.meleeType)).join("")}</select></label>` : ""}
      <label title="How far ahead the plan looks.">Days <select data-setting="cplanDays">${COMBAT_PLAN_DAYS.map((d) => option(d, `${d} days`, o.days)).join("")}</select></label>
      <label title="Coins never go below this; everything above it, and what skilling earns, may be spent.">Keep <select data-setting="cplanReserve">${RESERVE_CHOICES.map((r) => option(r, r ? coins(r) : "nothing", o.reserve)).join("")}</select></label>
      <label title="The game loadout the plan builds in (its gear, abilities, drinks, food and triggers).">Loadout <select data-setting="cplanSetup">${option("auto", "Auto (the style's)", o.setupId)}${loadouts.map((l) => option(l.id, l.name || "Loadout", o.setupId)).join("")}</select></label>
      <label title="Charms put extra XP into one skill only; off, the plan never buys one."><input type="checkbox" data-setting="cplanCharms" ${o.charms ? "checked" : ""}> Charms</label>
      <button class="mwia-btn" data-action="cplan-run" title="Have the Pi work the plan out now (it takes the Pi about an hour; it runs every night anyway).">▶ Work it out now</button>
    </div>`;
}

function statusHtml(st) {
    const lines = [];
    const r = st.result;
    if (r) lines.push(`Worked out ${ago(r.finishedAt || r.at)} (${Math.round((r.ms || 0) / 60000)} min on the Pi, from your loadouts as they were ${ago(r.loadoutsAt)}).`);
    if (st.stale) lines.push(`<span class="mwia-warn">Made with other settings – tap ▶ Work it out now (or wait for the night).</span>`);
    const p = st.status?.progress;
    if (st.status?.running) lines.push(`<span class="mwia-warn">⏳ The Pi is working the plan out${p ? ` – ${esc(p.stage)} ${p.done}/${p.total}` : ""}…</span>`);
    else if (st.waiting) lines.push(`<span class="mwia-warn">⏳ Waiting for the Pi (it runs one heavy job at a time)…</span>`);
    else if (st.status?.next) lines.push(`Next plan ${inTime(st.status.next)}.`);
    if (st.status?.error) lines.push(`<span class="mwia-bad">The Pi's last try failed: ${esc(st.status.error)}</span>`);
    if (st.error) lines.push(`<span class="mwia-bad">${esc(st.error)}</span>`);
    return lines.length ? `<p class="mwia-dim">${lines.join(" ")}</p>` : "";
}

function summaryHtml(r) {
    const skills = r.skills || [];
    const levels = skills.map((s) => `${cap(s)} ${Math.floor(r.start.levels[s])} → <b>${Math.floor(r.end.levels[s])}</b>`).join(", ");
    const base = r.baseline;
    const vs = base ? ` Fighting as you are (nothing bought): +${base.gained.toFixed(1)} levels, so the plan gives <b>${(r.gained - base.gained >= 0 ? "+" : "−") + Math.abs(r.gained - base.gained).toFixed(1)}</b>.` : "";
    const days = r.settings.days;
    const skilling = r.stats.skillingBlocks ? ` ${dayText(r.stats.skillingBlocks / 3)} of the ${days} days go to skilling (${coins(r.stats.skillingGold)} for purchases).` : "";
    return `<p><b>In ${days} days: +${r.gained.toFixed(1)} levels</b> (${levels}).${vs}${skilling} Spends ${coins(r.stats.spent)}; combat ${r.stats.combatProfit >= 0 ? "earns" : "costs"} ${coins(Math.abs(r.stats.combatProfit))}; coins at the end ${coins(r.end.coins)}. Skilling in the combat time would have earned ${coins(r.skillingForgone)}.</p>`;
}

function phasesHtml(r) {
    const rows = (r.phases || []).map((p) => {
        const when = `day ${dayText(p.from)}–${dayText(p.to)}`;
        if (p.kind === "skilling") return `<tr><td>${when}</td><td>🌿 Skilling${p.job ? `: ${esc(p.job)}` : ""}</td><td>+${coins(p.gold)}</td><td></td><td>${coins(p.coins)}</td></tr>`;
        const buys = (p.buys || []).map((b) => (b.kind === "gear" ? plus(b.hrid, b.enhancementLevel) : b.kind === "house" ? esc(cap(b.hrid.split("/").pop().replace(/_/g, " "))) + ` ${b.level}` : `${esc(abilityName(b.hrid))} ${b.level}`)).join(", ");
        const gained = Object.entries(p.gained || {}).filter(([, v]) => v >= 0.05).map(([s, v]) => `${cap(s).slice(0, 3)} +${v.toFixed(1)}`).join(", ");
        return `<tr><td>${when}</td><td>⚔ ${zoneText(p.zone)}${buys ? `<br><span class="mwia-dim">buy ${buys}</span>` : ""}</td><td>${p.rates.levelsPerDay.toFixed(2)}/day</td><td>${gained}</td><td>${coins(p.coins)}</td></tr>`;
    });
    return `<details><summary>Every phase</summary><table class="mwia-table"><tr><th>When</th><th>What</th><th>Rate</th><th>Levels</th><th>Coins after</th></tr>${rows.join("")}</table></details>`;
}

export function renderCombatPlan(settings, setups) {
    const st = combatPlanState();
    if (!st.linked) return `<p>The combat plan is worked out on your Pi (see the Guide tab: <i>Your Pi</i>). Link one first.</p>`;
    if (!st.works) return `<p>Your Pi doesn't work out combat plans yet – update it (git pull, then docker compose up -d --build in pi/).</p>`;
    let html = settingsHtml(settings, setups) + statusHtml(st);
    const r = st.result;
    if (!r) return html + `<p>No plan yet. It needs your loadouts on the Pi (they go with the Labyrinth's requests) and is worked out at night, or now with ▶.</p>`;
    html += summaryHtml(r);
    if (r.starter) html += `<p class="mwia-warn">Your loadout has no ${esc(r.settings.style)} weapon: the plan starts with ${plus(r.starter.hrid, r.starter.enhancementLevel)}${r.starter.owned ? " from your inventory" : ` for ${coins(r.starter.cost)}`}.</p>`;
    html += nextHtml(r, setups);
    html += phasesHtml(r);
    html += `<p class="mwia-dim">Levels in ${(r.skills || []).map(cap).join(", ")} count; the triggers and ability order are tuned for the first fight only, the next night tunes the next one. Drinks and food are bought for the phase, at most ${CONSUMABLE_HOURS_MAX} h.</p>`;
    return html;
}
