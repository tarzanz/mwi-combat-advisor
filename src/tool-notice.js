// A notice under the game's Equipment page: tools whose next tier your skill
// level now allows, with the price, what they add a day and a cart button.

import { getClientData, itemName, pricesStamp } from "./game-data.js";
import { onStateChange, state } from "./game-state.js";
import { esc, shortCoins } from "./format.js";
import { visible } from "./game-nav.js";
import { skillingCharacter } from "./skilling.js";
import { skillingMarket, topActionHrid, topActionKey } from "./skilling-ui.js";
import { toolTiers } from "./skilling-upgrades.js";

const SCAN_MS = 400;
const INVENTORY = "/item_locations/inventory";
// The equipment grid holds at least this many item icons; walking up from
// "View Stats" stops at the first ancestor around them.
const GRID_ICONS = 8;

const t = { deps: null, scanTimer: null, loading: null, key: "", notices: [], status: "" };

const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const skillLabel = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);

// deps: settings(), prepare() -> loads game data and prices, addToCart(items) -> the cart outcome.
export function startToolNotice(deps) {
    t.deps = deps;
    onStateChange(() => scheduleScan());
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-tool-box"))) return;
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
}

function scheduleScan() {
    if (t.scanTimer) return;
    t.scanTimer = setTimeout(() => {
        t.scanTimer = null;
        try {
            scan();
        } catch (error) {
            console.warn("[MWI Advisor] tool notice", error);
        }
    }, SCAN_MS);
}

// The Equipment page: the container around its "View Stats" button and item slots.
function equipmentGrid() {
    const button = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "View Stats" && visible(b));
    for (let node = button?.parentElement; node && node !== document.body; node = node.parentElement) {
        if (node.querySelectorAll("use").length >= GRID_ICONS) return node;
    }
    return null;
}

function notices() {
    const settings = t.deps.settings();
    const key = [state.updatedAt, pricesStamp(), topActionKey(settings)].join("|");
    if (t.key !== key) {
        const data = getClientData();
        const equipped = {};
        const owned = {};
        for (const item of state.items.values()) {
            if (!item.itemHrid) continue;
            if (item.itemLocationHrid === INVENTORY) (owned[item.itemHrid] ||= []).push(item.enhancementLevel || 0);
            else equipped[item.itemLocationHrid] = { itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 };
        }
        const who = skillingCharacter(state.character, state.items, data);
        const market = skillingMarket(settings.skillingSellAt);
        t.notices = toolTiers(who, data, market, { equipped, owned, actionFor: (skill) => topActionHrid(settings, skill) });
        t.key = key;
    }
    return t.notices;
}

function scan() {
    const grid = state.character ? equipmentGrid() : null;
    if (grid && (!getClientData() || !pricesStamp())) {
        t.loading ||= t.deps.prepare().then(scheduleScan, (error) => console.warn("[MWI Advisor] tool notice", error)).finally(() => (t.loading = null));
        return;
    }
    const list = grid ? notices() : [];
    document.querySelectorAll(".mwia-tool-box").forEach((box) => (box.parentElement === grid && list.length) || box.remove());
    if (!grid || !list.length) return;
    let box = grid.querySelector(":scope > .mwia-tool-box");
    if (!box) {
        box = document.createElement("div");
        box.className = "mwia-tool-box";
        grid.appendChild(box);
    }
    const html = boxHtml(list);
    if (box.dataset.html !== html) {
        box.dataset.html = html;
        box.innerHTML = html;
    }
}

function cartButton(items, label) {
    return `<button class="mwia-guide-cart" data-tool-cart="${esc(JSON.stringify(items))}" title="Adds to the MWITools cart: ${esc(items.map((i) => itemName(i.hrid)).join(", "))}">${label}</button>`;
}

function rowHtml(n) {
    const from = n.current ? `${esc(itemName(n.current.itemHrid))}${n.current.enhancementLevel ? ` +${n.current.enhancementLevel}` : ""} → ` : "";
    let worth = "";
    if (n.gainPerDay !== null) {
        if (n.gainPerDay > 1) worth = ` · <span class="mwia-ok">+${coins(n.gainPerDay)}/day</span>${n.paybackDays !== null && !n.owned ? `, pays back in ${n.paybackDays < 1 ? Math.max(1, Math.round(n.paybackDays * 24)) + " h" : Math.round(n.paybackDays * 10) / 10 + " days"}` : ""}`;
        else if (n.xpPerDay > 1) worth = ` · +${coins(n.xpPerDay)} XP/day`;
        else if (n.current) worth = ` · <span class="mwia-guide-low">not better than your ${esc(itemName(n.current.itemHrid))}${n.current.enhancementLevel ? ` +${n.current.enhancementLevel}` : ""}</span>`;
    }
    const price = n.owned ? "in your inventory – equip it" : n.price === null ? "nobody sells it now" : coins(n.price);
    const cart = !n.owned && n.price !== null ? cartButton([{ hrid: n.itemHrid, quantity: 1 }], "🛒") : "";
    return `<li><span><b>${skillLabel(n.skill)}</b> <span class="mwia-dim">lvl ${n.skillLevel}</span>: ${from}<b>${esc(itemName(n.itemHrid))}</b> <span class="mwia-dim">(lvl ${n.level})</span> · ${price}${worth}</span>${cart}</li>`;
}

function boxHtml(list) {
    const buyable = list.filter((n) => !n.owned && n.price !== null);
    return `<div class="mwia-guide-head"><b>⬆ Better tools unlocked</b> <span>MWI Advisor</span></div>
        <ul class="mwia-tool-list">${list.map(rowHtml).join("")}</ul>
        ${buyable.length > 1 ? cartButton(buyable.map((n) => ({ hrid: n.itemHrid, quantity: 1 })), `🛒 Add all ${buyable.length} (${coins(buyable.reduce((sum, n) => sum + n.price, 0))})`) : ""}
        ${t.status ? `<div class="mwia-guide-status">${esc(t.status)}</div>` : ""}
        <div class="mwia-guide-status">Gold a day on what you'd make now (the top of the skill's Skilling list), sold at the ${t.deps.settings().skillingSellAt === "bid" ? "bid" : "ask"}. Payback counts selling the tool again at the bid.</div>`;
}

async function onClick(event) {
    const button = event.target.closest?.(".mwia-tool-box [data-tool-cart]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const names = (list) => list.map((i) => itemName(i.hrid)).join(", ");
    try {
        const outcome = await t.deps.addToCart(JSON.parse(button.dataset.toolCart));
        const parts = [];
        if (outcome.added.length) parts.push(`added ${names(outcome.added)}`);
        if (outcome.updated.length) parts.push(`topped up ${names(outcome.updated)}`);
        if (outcome.present.length) parts.push(`${names(outcome.present)} already in the cart`);
        if (outcome.failed.length) parts.push(`could not add ${names(outcome.failed)}`);
        t.status = "Cart: " + parts.join("; ") + ".";
    } catch (error) {
        t.status = error.message;
    }
    scheduleScan();
}
