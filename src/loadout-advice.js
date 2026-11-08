// A box in the game's Loadouts panel: when a fight is in your action queue, the
// abilities, drinks and food its loadout should have, worked out by simulating
// that loadout in that zone (it starts by itself the first time the panel shows
// the loadout, and is kept until the loadout, the zone or the advisor's focus
// changes). Abilities and drinks or food in the panel that the advice takes out
// glow red. 🛒 8 h / 🛒 24 h top up every advised drink and food in the MWITools
// cart, at the pace the simulation used them, less what you have.

import { abilityName, actionName, getClientData, itemName } from "./game-data.js";
import { onStateChange, state } from "./game-state.js";
import { esc, shortCoins } from "./format.js";
import { visible } from "./game-nav.js";
import { combatLoadouts } from "./profile.js";
import { heldStock } from "./skilling.js";

const SCAN_MS = 400;
const STORE_KEY = "mwia-loadout-advice";
const KEEP = 8; // analyses kept in the browser
export const CART_HOURS = [8, 24];
const WAIT_MS = 3000; // a look again while the advisor is busy with something else
const COMBAT_ACTIONS = "/actions/combat/";

// running: { sig, done, total, round } while a simulation runs; failed: sig -> message.
const g = { deps: null, scanTimer: null, running: null, failed: new Map(), status: "", retry: null, loading: null };

const ours = (el) => el.closest('[class*="mwia"]');
const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();
const have = (hrid) => (state.character ? heldStock(state.character, state.items, hrid).inventory : 0);
const n = (v) => Math.round(v).toLocaleString("en-US");

// deps: settings(), prepare() -> loads the game data and prices, busy() -> true while the advisor runs another analysis,
// profileOf(loadout) -> the profile that fights with it (null before the game data is in),
// analyze(loadout, zone, onProgress) -> analyzeLoadout's result, addToCart(items) -> the cart outcome.
export function startLoadoutAdvice(deps) {
    g.deps = deps;
    onStateChange(() => scheduleScan());
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-loadout-box"))) return; // our own re-render
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
}

function scheduleScan() {
    if (g.scanTimer) return;
    g.scanTimer = setTimeout(() => {
        g.scanTimer = null;
        try {
            scan();
        } catch (error) {
            console.warn("[MWI Advisor] loadout panel", error);
        }
    }, SCAN_MS);
}

// ---------- what the queue and the panel say ----------

// The first fight in the action queue (running or waiting): { zoneHrid, tier, action } or null.
export function queuedFight(character) {
    const action = (character?.characterActions || []).find((a) => a?.actionHrid?.startsWith(COMBAT_ACTIONS) && !a.isDone);
    return action ? { zoneHrid: action.actionHrid, tier: action.difficultyTier || 0, action } : null;
}

// The loadout the fight is fought with: the one the queued action names (any field with
// "loadout" in its name that holds a saved loadout's id), else the default combat loadout,
// else the first. { loadout, why } or null without combat loadouts.
export function fightLoadout(character, fight) {
    const loadouts = combatLoadouts(character);
    if (!loadouts.length) return null;
    for (const [key, value] of Object.entries(fight?.action || {})) {
        if (!/loadout/i.test(key) || value === null || value === undefined || value === "" || value === 0) continue;
        const named = loadouts.find((l) => l.id === String(value));
        if (named) return { loadout: named, why: "the loadout set for the queued fight" };
    }
    const fallback = loadouts.find((l) => l.isDefault && l.actionTypeHrid === "/action_types/combat") || loadouts.find((l) => l.isDefault);
    return fallback ? { loadout: fallback, why: "your default combat loadout" } : { loadout: loadouts[0], why: "your first combat loadout" };
}

const iconId = (el) => {
    const use = el.querySelector("svg use");
    return (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#")[1] || null;
};

// The game's Loadouts panel, when it is open: its element, the Abilities and Consumables
// rows' slots (each with the ability or item it shows) and where the box goes. null otherwise.
export function findLoadoutPanel(doc = document) {
    const button = [...doc.querySelectorAll("button")].find((b) => /^equip loadout$/i.test(b.textContent.trim()) && visible(b) && !ours(b));
    if (!button) return null;
    const heading = (root, label) => [...root.querySelectorAll("*")].find((el) => ownText(el).toLowerCase() === label && !ours(el) && visible(el));
    let panel = button.parentElement;
    while (panel && panel !== doc.body && !(heading(panel, "abilities") && heading(panel, "consumables"))) panel = panel.parentElement;
    if (!panel || panel === doc.body) return null;
    const data = getClientData();
    const row = (label, kind) => {
        const head = heading(panel, label);
        const el = head?.nextElementSibling || head?.parentElement?.nextElementSibling;
        if (!el) return { el: null, slots: [] };
        const slots = [...el.children]
            .filter((child) => !ours(child))
            .map((child) => {
                const id = iconId(child);
                const hrid = id ? `/${kind}/${id}` : null;
                const known = hrid && (kind === "abilities" ? data?.abilityDetailMap?.[hrid] : data?.itemDetailMap?.[hrid]);
                return { el: child, hrid: known || !data ? hrid : null };
            });
        return { el, slots };
    };
    return { panel, abilities: row("abilities", "abilities"), consumables: row("consumables", "items") };
}

// What a loadout puts in its ability and consumable slots, sorted, to compare with the panel.
const loadoutContent = (l) =>
    [...Object.values(l.abilityMap || {}), ...(l.foodItemHrids || []), ...(l.drinkItemHrids || [])].filter(Boolean).sort().join(",");

// The saved loadout the panel shows: the one whose abilities, food and drinks it shows
// (the fight's loadout first when two are the same). null when none fits.
export function shownLoadout(found, character, prefer = null) {
    const shown = [...found.abilities.slots, ...found.consumables.slots].map((s) => s.hrid).filter(Boolean).sort().join(",");
    const fits = combatLoadouts(character).filter((l) => loadoutContent(l) === shown);
    return fits.find((l) => l.id === prefer?.id) || fits[0] || null;
}

// ---------- the advice, kept in the browser ----------

// What decides the advice: the setup's gear, abilities, drinks and food (not triggers),
// the zone and the advisor's focus and accuracy.
export function setupSig(profile, fight, settings) {
    return JSON.stringify([
        Object.entries(profile.equipment || {}).sort().map(([slot, e]) => `${slot}:${e.hrid}+${e.enhancementLevel || 0}`),
        (profile.abilities || []).map((a) => a?.hrid || null),
        (profile.drinks || []).filter(Boolean).sort(),
        (profile.food || []).filter(Boolean).sort(),
        fight.zoneHrid,
        fight.tier,
        Number(settings.goldWeight) || 0,
        !!settings.acceptRareDeaths,
        !!settings.countLevels,
        settings.accuracy || "normal",
    ]);
}

function stored() {
    try {
        const list = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
        return Array.isArray(list) ? list : [];
    } catch {
        return [];
    }
}

function store(entry) {
    const list = [entry, ...stored().filter((e) => e.sig !== entry.sig)].slice(0, KEEP);
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(list));
    } catch {
        // Storage full or blocked: it is simulated again next time.
    }
}

// The advice for this setup: worked out for it, or one whose advised setup it already is.
export function adviceFor(sig) {
    const list = stored();
    const own = list.find((e) => e.sig === sig);
    if (own) return { entry: own, done: false };
    const reached = list.find((e) => e.finalSig === sig);
    return reached ? { entry: reached, done: true } : null;
}

const slotsOf = (profile) => ({
    special: profile.abilities?.[0]?.hrid || null,
    abilities: (profile.abilities || []).slice(1).map((a) => a?.hrid || null),
    drinks: [...(profile.drinks || [])],
    food: [...(profile.food || [])],
});

const summary = (r) => r && { xp: r.xpTotal || 0, profit: r.profit || 0, deaths: r.deaths || 0, encounters: r.encounters || 0, consumables: r.consumables || {} };

// The result of analyzeLoadout as it is kept: small, and with the setups' signatures.
export function adviceEntry(result, fight, loadout, settings) {
    return {
        sig: setupSig(result.start, fight, settings),
        finalSig: setupSig(result.final, fight, settings),
        at: Date.now(),
        zoneHrid: fight.zoneHrid,
        tier: fight.tier,
        loadoutId: loadout.id,
        loadoutName: loadout.name || "Loadout",
        rounds: result.rounds,
        start: slotsOf(result.start),
        final: slotsOf(result.final),
        before: summary(result.before),
        after: summary(result.after),
    };
}

// What to put in the MWITools cart for that many hours: every advised drink and food at
// the pace the simulation used it, less what you have.
export function cartItems(entry, hours, haveOf = have) {
    const wanted = [...entry.final.drinks, ...entry.final.food].filter(Boolean);
    return wanted
        .map((hrid) => ({ hrid, quantity: Math.ceil((entry.after.consumables[hrid] || 0) * hours) - haveOf(hrid) }))
        .filter((i) => i.quantity > 0);
}

// ---------- the box ----------

function scan() {
    const found = state.character ? findLoadoutPanel() : null;
    const marked = new Set();
    let html = null;
    let at = null;
    if (found) {
        const fight = queuedFight(state.character);
        const chosen = fight ? fightLoadout(state.character, fight) : null;
        if (fight && chosen) {
            const shown = shownLoadout(found, state.character, chosen.loadout);
            at = found;
            html = boxHtml(found, fight, chosen, shown, marked);
        }
    }
    document.querySelectorAll("[data-mwia-slot]").forEach((el) => marked.has(el) || unmark(el));
    document.querySelectorAll(".mwia-loadout-box").forEach((box) => (html && at && found.panel.contains(box)) || box.remove());
    if (!html || !at) return;
    let box = found.panel.querySelector(".mwia-loadout-box");
    if (!box) {
        box = document.createElement("div");
        box.className = "mwia-guide-box mwia-loadout-box";
        const anchor = found.consumables.el || found.abilities.el;
        if (anchor) anchor.insertAdjacentElement("afterend", box);
        else found.panel.appendChild(box);
    }
    if (box.dataset.html !== html) {
        box.dataset.html = html;
        box.innerHTML = html;
    }
}

const fightName = (fight) => esc(actionName(fight.zoneHrid) || fight.zoneHrid.split("/").pop()) + (fight.tier ? ` T${fight.tier}` : "");
const head = (note) => `<div class="mwia-guide-head"><b>🧭 Loadout for your next fight</b> <span>MWI Advisor${note ? " · " + note : ""}</span></div>`;

function boxHtml(found, fight, chosen, shown, marked) {
    const { loadout, why } = chosen;
    const name = esc(loadout.name || "Loadout");
    // Another loadout open: say which one the fight uses.
    if (shown && shown.id !== loadout.id) {
        return head(fightName(fight)) + `<div class="mwia-guide-note">Your next fight, <b>${fightName(fight)}</b>, uses <b>${name}</b> (${why}). Open that loadout for its abilities, drinks and food.</div>`;
    }
    const settings = g.deps.settings();
    const profile = g.deps.profileOf(loadout);
    if (!profile) {
        g.loading ||= g.deps.prepare().then(scheduleScan, (error) => console.warn("[MWI Advisor] loadout panel", error)).finally(() => (g.loading = null));
        return head(fightName(fight)) + `<div class="mwia-guide-note mwia-guide-dim">Loading the game data…</div>`;
    }
    const sig = setupSig(profile, fight, settings);
    const known = adviceFor(sig);
    const unsure = shown ? "" : `<div class="mwia-guide-note mwia-guide-dim">Can't tell which loadout this is; the advice is for <b>${name}</b>.</div>`;
    const intro = `<div class="mwia-guide-note">Next fight: <b>${fightName(fight)}</b> with <b>${name}</b> <span class="mwia-guide-dim">(${why})</span></div>`;
    if (!known) {
        if (g.running?.sig === sig) {
            const pct = g.running.total ? Math.round((100 * g.running.done) / g.running.total) : 0;
            return head("simulating") + intro + unsure + `<div class="mwia-guide-note">Simulating this loadout in ${fightName(fight)}… round ${g.running.round}, ${pct}%</div>`;
        }
        const failed = g.failed.get(sig);
        if (failed) return head("") + intro + unsure + `<div class="mwia-guide-note mwia-guide-low">Could not work it out: ${esc(failed)}</div>` + againButton("Try again");
        if (!g.running && !g.deps.busy()) start(loadout, fight, profile, sig);
        else waitAndLook();
        return head("") + intro + unsure + `<div class="mwia-guide-note mwia-guide-dim">${g.running ? "Waiting for the other loadout's simulation…" : "Waiting for the advisor's other analysis…"}</div>`;
    }
    return head(ageText(known.entry.at)) + intro + unsure + adviceHtml(known, shown ? found : null, marked) + statusHtml();
}

function waitAndLook() {
    clearTimeout(g.retry);
    g.retry = setTimeout(scheduleScan, WAIT_MS);
}

function start(loadout, fight, profile, sig) {
    g.running = { sig, done: 0, total: 0, round: 1 };
    g.status = "";
    const settings = { ...g.deps.settings() };
    g.deps
        .analyze(loadout, { zoneHrid: fight.zoneHrid, tier: fight.tier }, (done, total, round) => {
            g.running = { sig, done, total, round };
            scheduleScan();
        })
        .then((result) => {
            const entry = adviceEntry(result, fight, loadout, settings);
            entry.sig = sig; // as the panel worked it out, so it is found again
            store(entry);
        })
        .catch((error) => g.failed.set(sig, error?.message || String(error)))
        .finally(() => {
            g.running = null;
            scheduleScan();
        });
}

const ageText = (at) => {
    const hours = Math.max(0, (Date.now() - at) / 3600000);
    return hours < 1 ? "simulated less than an hour ago" : hours < 48 ? `simulated ${Math.round(hours)} h ago` : `simulated ${Math.round(hours / 24)} days ago`;
};

function itemLine(kind, text, extra = "") {
    const mark = { keep: "✓", add: "➕ Put in", remove: "➖ Take out" }[kind];
    return `<li class="mwia-guide-${kind}">${mark} ${text}${extra ? ` <span>${extra}</span>` : ""}</li>`;
}

// Lines for one kind of slot: what stays, what to put in, what to take out.
function part(title, final, start, label, extra = () => "") {
    const want = final.filter(Boolean);
    const now = start.filter(Boolean);
    const lines = [...want.map((h) => itemLine(now.includes(h) ? "keep" : "add", esc(label(h)), extra(h))), ...now.filter((h) => !want.includes(h)).map((h) => itemLine("remove", esc(label(h))))];
    return lines.length ? `<div class="mwia-guide-sub">${title}</div><ul class="mwia-guide-list">${lines.join("")}</ul>` : "";
}

function gainText(entry) {
    const { before, after } = entry;
    if (!before || !after) return "";
    const pct = (a, b) => (b > 0 ? Math.round((100 * (a - b)) / b) : 0);
    const xp = pct(after.xp, before.xp);
    const profit = after.profit - before.profit;
    const sign = (v) => (v > 0 ? "+" : v < 0 ? "−" : "±");
    const deaths = after.deaths > 0.05 ? `, ${after.deaths.toFixed(1)} deaths/h` : "";
    return `<b class="${xp >= 0 ? "mwia-ok" : "mwia-guide-low"}">${sign(xp)}${Math.abs(xp)}% XP/h</b>, <b class="${profit >= 0 ? "mwia-ok" : "mwia-guide-low"}">${sign(profit)}${shortCoins(Math.abs(profit))}/h profit</b>${deaths} over the loadout as it is`;
}

function adviceHtml(known, found, marked) {
    const { entry, done } = known;
    const { start, final } = entry;
    const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    const unchanged = done || (same(start.abilities.filter(Boolean), final.abilities.filter(Boolean)) && same(start.special, final.special) && same(start.drinks.filter(Boolean).sort(), final.drinks.filter(Boolean).sort()) && same(start.food.filter(Boolean).sort(), final.food.filter(Boolean).sort()));
    const perHour = (h) => entry.after.consumables[h] || 0;
    const stock = (h) => {
        const need = Math.ceil(perHour(h) * 8);
        const text = `${n(have(h))} in inventory${perHour(h) ? `, ${n(perHour(h))}/h` : ""}`;
        return have(h) < need ? `<b class="mwia-guide-low">${text}</b>` : text;
    };
    const from = done ? final : start;
    // The slots' order is the casting order: say it when it changes.
    const order = final.abilities.filter(Boolean);
    const newOrder = order.length > 1 && !same(order, from.abilities.filter(Boolean));
    let html =
        part("Abilities", [final.special, ...final.abilities], [from.special, ...from.abilities], abilityName) +
        (newOrder ? `<div class="mwia-guide-note">In this order: <b>${order.map((h) => esc(abilityName(h))).join(" → ")}</b></div>` : "") +
        part("Drinks", final.drinks, from.drinks, itemName, stock) +
        part("Food", final.food, from.food, itemName, stock);
    html += `<div class="mwia-guide-note">${unchanged ? "✓ This loadout is the best the advisor found for this fight." : `Change it as above and save the loadout: ${gainText(entry)}.`}</div>`;
    if (found) markSlots(found, final, marked);
    const buttons = CART_HOURS.map((hours) => cartButton(cartItems(entry, hours), hours)).join(" ");
    html += `<div class="mwia-guide-sub">Drinks and food for <span>· at the simulated pace, less what you have</span></div><div class="mwia-guide-hours">${buttons}</div>`;
    return html + againButton("↻ Simulate again");
}

const againButton = (label) => `<button class="mwia-guide-cart" data-loadout-again="1">${label}</button>`;
const statusHtml = () => (g.status ? `<div class="mwia-guide-status">${esc(g.status)}</div>` : "");

function cartButton(items, hours) {
    if (!items.length) return `<button class="mwia-guide-cart" disabled title="You have enough for ${hours} h">✓ ${hours} h</button>`;
    const title = items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", ");
    return `<button class="mwia-guide-cart" data-loadout-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(title)}">🛒 ${hours} h</button>`;
}

// Red: an ability, drink or food in the panel that the advice takes out.
function markSlots(found, final, marked) {
    const abilities = new Set([final.special, ...final.abilities].filter(Boolean));
    const consumables = new Set([...final.drinks, ...final.food].filter(Boolean));
    const check = (slots, keep, label) => {
        for (const slot of slots) {
            if (!slot.hrid || keep.has(slot.hrid)) continue;
            const title = `Take out ${label(slot.hrid)} (MWI Advisor)`;
            if (slot.el.dataset.mwiaSlot !== "wrong") slot.el.dataset.mwiaSlot = "wrong";
            if (slot.el.title !== title) slot.el.title = title;
            marked.add(slot.el);
        }
    };
    check(found.abilities.slots, abilities, abilityName);
    check(found.consumables.slots, consumables, itemName);
}

function unmark(el) {
    delete el.dataset.mwiaSlot;
    el.removeAttribute("title");
}

async function onClick(event) {
    const again = event.target.closest?.(".mwia-loadout-box [data-loadout-again]");
    if (again) {
        event.preventDefault();
        event.stopPropagation();
        forget();
        scheduleScan();
        return;
    }
    const button = event.target.closest?.(".mwia-loadout-box [data-loadout-cart]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const names = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
        const outcome = await g.deps.addToCart(JSON.parse(button.dataset.loadoutCart));
        const parts = [];
        if (outcome.added.length) parts.push(`added ${names(outcome.added)}`);
        if (outcome.updated.length) parts.push(`topped up ${names(outcome.updated)}`);
        if (outcome.present.length) parts.push(`${names(outcome.present)} already in the cart`);
        if (outcome.failed.length) parts.push(`could not add ${names(outcome.failed)}`);
        g.status = "Cart: " + parts.join("; ") + ".";
    } catch (error) {
        g.status = error.message;
    }
    scheduleScan();
}

// "Simulate again": the advice for the setup the panel shows goes, and so does a failure.
function forget() {
    const fight = queuedFight(state.character);
    const chosen = fight ? fightLoadout(state.character, fight) : null;
    const profile = chosen ? g.deps.profileOf(chosen.loadout) : null;
    if (!profile) return;
    const sig = setupSig(profile, fight, g.deps.settings());
    g.failed.delete(sig);
    g.status = "";
    try {
        localStorage.setItem(STORE_KEY, JSON.stringify(stored().filter((e) => e.sig !== sig && e.finalSig !== sig)));
    } catch {
        // nothing kept to forget
    }
}
