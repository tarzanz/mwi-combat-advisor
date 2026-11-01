// Everything about the character that the advice rests on, as a text file to
// paste into a chat: levels, gear, teas, house, coins, inventory with prices,
// market orders, the queue, the settings and the top rows of the advice.
// A button above the game's inventory (and one on the Overview tab) makes it.

import { actionName, getClientData, itemName, loadClientData, loadPrices, marketEntry, pricesAge } from "./game-data.js";
import { state } from "./game-state.js";
import { shortCoins } from "./format.js";
import { scriptVersion } from "./version-tag.js";

// The game's inventory grid; the button goes just above it.
const INVENTORY = '[class*="Inventory_items"]';
const SCAN_MS = 500;
const COIN = "/items/coin";
const INVENTORY_LOCATION = "/item_locations/inventory";

const ex = { win: null, scanTimer: null, context: () => ({}), loading: null };

const n = (x) => Math.round(x).toLocaleString("en-US");
const coins = (x) => (x < 0 ? "−" : "") + shortCoins(Math.abs(x));
const words = (hrid) => String(hrid || "").split("/").pop().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

// What the advisor's panel adds: { settings, sections: [{ title, lines }] }.
export function setExportContext(fn) {
    ex.context = fn;
}

export function startExportButton(win) {
    ex.win = win;
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-export"))) return;
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    scheduleScan();
}

function scheduleScan() {
    if (ex.scanTimer) return;
    ex.scanTimer = setTimeout(() => {
        ex.scanTimer = null;
        for (const grid of document.querySelectorAll(INVENTORY)) {
            if (grid.previousElementSibling?.classList.contains("mwia-export") || grid.parentElement?.closest(INVENTORY)) continue;
            const bar = document.createElement("div");
            bar.className = "mwia-export";
            bar.innerHTML = `<button type="button" class="mwia-export-btn" title="A text file with your character and the advice, to paste into a chat">🧭 Export for chat</button>`;
            bar.querySelector("button").addEventListener("click", (event) => exportClicked(event.currentTarget));
            grid.parentElement.insertBefore(bar, grid);
        }
    }, SCAN_MS);
}

// The share sheet needs the tap itself: the first tap may only load the game
// data and prices, and asks for a second.
export function exportClicked(button) {
    if (!getClientData() || pricesAge() === null) {
        const label = button.textContent;
        button.textContent = "Loading…";
        ex.loading ||= Promise.all([loadClientData(ex.win || window), loadPrices()]).finally(() => (ex.loading = null));
        ex.loading.then(() => (button.textContent = "Ready – tap again")).catch(() => (button.textContent = label + " (prices didn't load)"));
        return;
    }
    let text;
    try {
        text = exportText();
    } catch (error) {
        console.warn("[MWI Advisor] export", error);
        text = `MWI Advisor export failed: ${error?.message || error}`;
    }
    deliver(text, button);
}

async function deliver(text, button) {
    const name = `mwi-advisor-${(state.character?.character?.name || "character").replace(/[^\w-]+/g, "_")}-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "")}.txt`;
    const file = typeof File === "function" ? new File([text], name, { type: "text/plain" }) : null;
    // Phones: the share sheet (save to Files, copy, AirDrop, a chat app).
    if (file && navigator.canShare?.({ files: [file] })) {
        try {
            await navigator.share({ files: [file], title: name });
            return;
        } catch (error) {
            if (error?.name === "AbortError") return;
        }
    }
    const url = URL.createObjectURL(new Blob([text], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    try {
        await navigator.clipboard?.writeText(text);
        if (button) button.textContent = "🧭 Saved – and copied";
    } catch {
        if (button) button.textContent = "🧭 Saved";
    }
}

export function exportText() {
    const c = state.character;
    if (!c) return "MWI Advisor export: the game hasn't sent the character yet – reload the page.";
    const data = getClientData();
    const items = [...state.items.values()];
    const age = pricesAge();
    const out = [];
    const section = (title, lines) => {
        if (!lines.length) return;
        out.push("", `## ${title}`, ...lines);
    };
    out.push(`# MWI Advisor export`, `Version ${scriptVersion()} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC · character ${c.character?.name || "?"} · prices ${age === null ? "not loaded" : `${Math.round(age / 60000)} min old`}`);

    const context = ex.context() || {};
    if (context.settings) section("Settings", [JSON.stringify(context.settings)]);

    const skills = (c.characterSkills || []).filter((s) => s.skillHrid).map((s) => `${words(s.skillHrid)} ${s.level}${s.experience !== undefined && s.experience !== null ? ` (${n(s.experience)} XP)` : ""}`);
    section("Levels", [skills.join(" · ")]);

    const worn = items.filter((i) => i.itemHrid && i.itemLocationHrid && i.itemLocationHrid !== INVENTORY_LOCATION);
    section("Equipment", worn.map((i) => `${words(i.itemLocationHrid)}: ${itemName(i.itemHrid)}${i.enhancementLevel ? ` +${i.enhancementLevel}` : ""}`));

    const drinks = Object.entries(c.actionTypeDrinkSlotsMap || {}).map(([type, list]) => `${words(type)}: ${(list || []).map((slot) => (slot?.itemHrid ? itemName(slot.itemHrid) : "empty")).join(", ") || "none"}`);
    section("Drinks in slots", drinks);
    const food = Object.entries(c.actionTypeFoodSlotsMap || {}).map(([type, list]) => `${words(type)}: ${(list || []).map((slot) => (slot?.itemHrid ? itemName(slot.itemHrid) : "empty")).join(", ") || "none"}`);
    section("Food in slots", food);

    const house = Object.entries(c.characterHouseRoomMap || {}).filter(([, room]) => room?.level).map(([hrid, room]) => `${data?.houseRoomDetailMap?.[hrid]?.name || words(hrid)} ${room.level}`);
    section("House", [house.join(" · ")].filter(Boolean));

    const abilities = (c.characterAbilities || []).filter((a) => a.abilityHrid).map((a) => `${words(a.abilityHrid)} ${a.level}${a.slotNumber ? ` (slot ${a.slotNumber})` : ""}`);
    section("Abilities", [abilities.join(" · ")].filter(Boolean));

    // The inventory, most valuable first, with the market's ask and bid.
    const stacks = items.filter((i) => i.itemHrid && i.itemLocationHrid === INVENTORY_LOCATION);
    const coinCount = stacks.filter((i) => i.itemHrid === COIN).reduce((sum, i) => sum + (i.count || 0), 0);
    section("Coins", [n(coinCount)]);
    const priced = stacks
        .filter((i) => i.itemHrid !== COIN)
        .map((i) => {
            const m = marketEntry(i.itemHrid, i.enhancementLevel || 0);
            const ask = m?.a > 0 ? m.a : null;
            const bid = m?.b > 0 ? m.b : null;
            return { i, ask, bid, worth: (i.count || 0) * (bid ?? ask ?? data?.itemDetailMap?.[i.itemHrid]?.sellPrice ?? 0) };
        })
        .sort((a, b) => b.worth - a.worth);
    section(
        `Inventory (${priced.length} stacks, most valuable first)`,
        priced.map(({ i, ask, bid, worth }) => `${itemName(i.itemHrid)}${i.enhancementLevel ? ` +${i.enhancementLevel}` : ""} ×${n(i.count || 0)} · ask ${ask === null ? "–" : coins(ask)} · bid ${bid === null ? "–" : coins(bid)} · worth ${coins(worth)}`),
    );

    const listings = (c.myMarketListings || []).map((l) => `${l.isSell ? "Sell" : "Buy"} ${itemName(l.itemHrid)}${l.enhancementLevel ? ` +${l.enhancementLevel}` : ""} ×${n(l.orderQuantity || 0)} @ ${coins(Number(l.price) || 0)}${l.filledQuantity ? ` (${n(l.filledQuantity)} filled)` : ""}`);
    section("Market orders", listings);

    const queue = (c.characterActions || []).map((a) => `${actionName(a.actionHrid) || words(a.actionHrid)}${a.hasMaxCount ? ` ${n(a.currentCount || 0)}/${n(a.maxCount || 0)}` : " (no limit)"}${a.primaryItemHash ? ` · ${itemName(String(a.primaryItemHash).split("::")[2])}` : ""}`);
    section("Action queue", queue);

    for (const { title, lines } of context.sections || []) section(title, lines);
    return out.join("\n") + "\n";
}
