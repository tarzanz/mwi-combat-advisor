// A box in the game's action window: which teas (skilling) or coffees and food
// (combat) to have in the slots for this action, as the advisor worked them
// out, with a button that puts what you lack in the MWITools cart.

import { actionName, getClientData, itemName, pricesStamp } from "./game-data.js";
import { onStateChange, state } from "./game-state.js";
import { esc, shortCoins } from "./format.js";
import { openActionPanels } from "./game-nav.js";
import { heldStock } from "./skilling.js";
import { skillingAdvice, slotsLine } from "./skilling-ui.js";

const SCAN_MS = 400;
const COMBAT = "/action_types/combat";
const SETUPS_KEY = "mwia-combat-setups";
const HOURS_PER_DAY = 24;

const g = { deps: null, scanTimer: null, loading: null, statuses: new Map() };

const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const have = (hrid) => (state.character ? heldStock(state.character, state.items, hrid).inventory : 0);
const slotItems = (map, type) => (state.character?.[map]?.[type] || []).map((slot) => slot?.itemHrid).filter(Boolean);

// What the latest Upgrades analysis said for a zone: the drinks and food to use
// and how many of each an hour. Kept per zone, across reloads.
export function rememberCombatSetup(zone, setup) {
    const all = combatSetups();
    all[zone.zoneHrid] = { ...setup, tier: zone.tier || 0, at: Date.now() };
    try {
        localStorage.setItem(SETUPS_KEY, JSON.stringify(all));
    } catch {
        // Storage full or blocked: the box just won't remember it.
    }
    scheduleScan();
}

function combatSetups() {
    try {
        return JSON.parse(localStorage.getItem(SETUPS_KEY) || "{}") || {};
    } catch {
        return {};
    }
}

// deps: settings() -> the advisor's settings, prepare() -> loads the game data and
// prices, addToCart(items) -> the cart outcome.
export function startConsumableGuide(deps) {
    g.deps = deps;
    onStateChange(() => scheduleScan());
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-guide-box"))) return; // our own re-render
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
            console.warn("[Combat Advisor] action window", error);
        }
    }, SCAN_MS);
}

// The action a window shows, from its name: a skilling action or a combat zone.
function actionByName(name) {
    const data = getClientData();
    if (!data || !name) return null;
    return Object.values(data.actionDetailMap).find((action) => action.name === name && (action.type === COMBAT || action.levelRequirement)) || null;
}

function scan() {
    const shown = new Set();
    const panels = openActionPanels();
    if (panels.length && (!getClientData() || !pricesStamp())) {
        g.loading ||= g.deps.prepare().then(scheduleScan, (error) => console.warn("[Combat Advisor] action window", error)).finally(() => (g.loading = null));
        return;
    }
    for (const { panel, name, buttons } of panels) {
        const action = actionByName(name);
        if (!action) continue;
        const html = action.type === COMBAT ? combatHtml(action) : skillingHtml(action);
        if (!html) continue;
        let box = panel.querySelector(".mwia-guide-box");
        if (!box) {
            box = document.createElement("div");
            box.className = "mwia-guide-box";
            if (buttons) buttons.insertAdjacentElement("beforebegin", box);
            else panel.appendChild(box);
        }
        shown.add(box);
        const status = g.statuses.get(action.hrid);
        const full = html + (status ? `<div class="mwia-guide-status">${esc(status)}</div>` : "");
        if (box.dataset.action !== action.hrid || box.dataset.html !== full) {
            box.dataset.action = action.hrid;
            box.dataset.html = full;
            box.innerHTML = full;
        }
    }
    document.querySelectorAll(".mwia-guide-box").forEach((box) => shown.has(box) || box.remove());
}

const head = (title, note) => `<div class="mwia-guide-head"><b>${title}</b> <span>${note}</span></div>`;

function itemLine(kind, hrid, extra = "") {
    const mark = { keep: "✓", add: "➕ Put in", remove: "➖ Take out" }[kind];
    return `<li class="mwia-guide-${kind}">${mark} ${esc(itemName(hrid))}${extra ? ` <span>${extra}</span>` : ""}</li>`;
}

function cartButton(items, label) {
    if (!items.length) return "";
    const title = items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", ");
    return `<button class="mwia-guide-cart" data-guide-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(title)}">${label}</button>`;
}

function skillingHtml(action) {
    const settings = g.deps.settings();
    const entry = state.character ? skillingAdvice(action.hrid, settings) : null;
    if (!entry) return "";
    // Another setup that only ties with yours is no reason to swap.
    const best = entry.betterTeas ? entry.best.result.teas : entry.current.teas;
    const current = entry.current.teas;
    const worth = new Map(entry.best.worth.map((w) => [w.itemHrid, w]));
    const perDay = Math.ceil(entry.best.result.drinksPerHour * HOURS_PER_DAY);
    const gain = (hrid) => {
        const w = worth.get(hrid);
        if (!w) return "";
        return w.gainPerDay >= 0 ? ` · +${coins(w.gainPerDay)}/day` : ` · +${coins(w.xpPerDay)} XP/day`;
    };
    const stock = (hrid) => {
        const n = have(hrid);
        return n < perDay ? `<b class="mwia-guide-low">${n.toLocaleString("en-US")} in inventory</b>` : `${n.toLocaleString("en-US")} in inventory`;
    };
    const lines = [
        ...best.map((hrid) => itemLine(current.includes(hrid) ? "keep" : "add", hrid, stock(hrid) + gain(hrid))),
        ...current.filter((hrid) => !best.includes(hrid)).map((hrid) => itemLine("remove", hrid)),
    ];
    const verdict = !entry.betterTeas
        ? best.length
            ? "✓ Your teas are the best ones for this."
            : current.length
              ? "No tea earns back its cost here."
              : "✓ No tea earns back its cost here."
        : `Best teas: <b class="mwia-ok">${entry.best.result.goldPerDay >= entry.current.goldPerDay ? `+${coins(entry.best.result.goldPerDay - entry.current.goldPerDay)}/day` : `+${coins(entry.best.result.xpPerDay - entry.current.xpPerDay)} XP/day`}</b> over the ones in your slots now.`;
    // Teas for the suggested job, or a day's worth of the ones you have none of.
    const plan = entry.teaPlan;
    const items = plan?.items.length ? plan.items.map(({ hrid, quantity }) => ({ hrid, quantity })) : best.filter((hrid) => have(hrid) < perDay).map((hrid) => ({ hrid, quantity: perDay - have(hrid) }));
    const label = plan?.items.length ? `🛒 Teas for ${plan.hours < 1 ? Math.max(1, Math.round(plan.hours * 60)) + " min" : Math.round(plan.hours * 10) / 10 + " h"}` : "🛒 Teas for 1 day";
    const focus = Number(settings.skillingGold ?? 100);
    return (
        head("🍵 Teas", `Combat Advisor · ${focus === 100 ? "gold" : focus === 0 ? "XP" : `${100 - focus}% XP · ${focus}% gold`}`) +
        (lines.length ? `<ul class="mwia-guide-list">${lines.join("")}</ul>` : "") +
        `<div class="mwia-guide-note">${verdict} ${slotsLine(entry)}</div>` +
        cartButton(items, label)
    );
}

function combatHtml(action) {
    const setup = combatSetups()[action.hrid];
    if (!setup) {
        return head("☕ Drinks and food", "Combat Advisor") + `<div class="mwia-guide-note">No advice for ${esc(action.name)} yet: in the advisor, pick it as the zone under <b>Upgrades</b> and press <b>Analyze upgrades</b>.</div>`;
    }
    const hours = Math.max(0, (Date.now() - setup.at) / 3600000);
    const age = hours < 1 ? "less than an hour ago" : hours < 48 ? `${Math.round(hours)} h ago` : `${Math.round(hours / 24)} days ago`;
    const perDay = (hrid) => Math.ceil((setup.perHour?.[hrid] || 0) * HOURS_PER_DAY);
    const stock = (hrid) => {
        const n = have(hrid);
        const need = perDay(hrid);
        const text = `${n.toLocaleString("en-US")} in inventory${need ? `, ${need.toLocaleString("en-US")} a day` : ""}`;
        return n < need ? `<b class="mwia-guide-low">${text}</b>` : text;
    };
    const part = (title, target, current) => {
        const wanted = target.filter(Boolean);
        const lines = [...wanted.map((hrid) => itemLine(current.includes(hrid) ? "keep" : "add", hrid, stock(hrid))), ...current.filter((hrid) => !wanted.includes(hrid)).map((hrid) => itemLine("remove", hrid))];
        return lines.length ? `<div class="mwia-guide-sub">${title}</div><ul class="mwia-guide-list">${lines.join("")}</ul>` : "";
    };
    const drinksNow = slotItems("actionTypeDrinkSlotsMap", COMBAT);
    const foodNow = slotItems("actionTypeFoodSlotsMap", COMBAT);
    const all = [...setup.drinks, ...setup.food].filter(Boolean);
    const done = all.every((hrid) => drinksNow.includes(hrid) || foodNow.includes(hrid)) && [...drinksNow, ...foodNow].every((hrid) => all.includes(hrid));
    const items = all.filter((hrid) => have(hrid) < perDay(hrid)).map((hrid) => ({ hrid, quantity: perDay(hrid) - have(hrid) }));
    return (
        head("☕ Drinks and food", `Combat Advisor · ${esc(actionName(action.hrid))}${setup.tier ? ` T${setup.tier}` : ""}, analysed ${age}`) +
        part("Drinks", setup.drinks, drinksNow) +
        part("Food", setup.food, foodNow) +
        `<div class="mwia-guide-note">${done ? "✓ Your slots match the advice." : "Set your slots as above before you start."}</div>` +
        cartButton(items, "🛒 What's missing for 1 day")
    );
}

async function onClick(event) {
    const button = event.target.closest?.(".mwia-guide-box [data-guide-cart]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const actionHrid = button.closest(".mwia-guide-box").dataset.action;
    const label = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
        const outcome = await g.deps.addToCart(JSON.parse(button.dataset.guideCart));
        const parts = [];
        if (outcome.added.length) parts.push(`added ${label(outcome.added)}`);
        if (outcome.updated.length) parts.push(`topped up ${label(outcome.updated)}`);
        if (outcome.present.length) parts.push(`${label(outcome.present)} already in the cart`);
        if (outcome.failed.length) parts.push(`could not add ${label(outcome.failed)}`);
        g.statuses.set(actionHrid, "Cart: " + parts.join("; ") + ".");
    } catch (error) {
        g.statuses.set(actionHrid, error.message);
    }
    scheduleScan();
}
