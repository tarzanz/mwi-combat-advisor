// The Market tab: your own orders (is a pile of cheaper offers in front of
// them?) and what in the inventory is worth selling now. The 🧭 button gets a
// red dot when an order sits behind a wall.

import { getClientData, itemName, marketEntry } from "./game-data.js";
import { orderBookAt, state } from "./game-state.js";
import { esc, shortCoins } from "./format.js";
import { MARKET_RULES, keepKey, listingStatus, remaining, reservedItems, sellSuggestions, trackFills } from "./market.js";
import { priceSummary } from "./price-history.js";
import { trainActionsLeft } from "./train-ui.js";

const KEEP_KEY = "mwia-keep";
const FILLS_KEY = "mwia-listing-fills";
const INVENTORY = "/item_locations/inventory";

const view = { showAll: false };

const dec = (n, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const pctAbs = (fraction) => `${dec(Math.abs(fraction) * 100, fraction && Math.abs(fraction) < 0.1 ? 1 : 0)}%`;
const label = (hrid, level) => esc(itemName(hrid)) + (level ? ` <span class="mwia-enh">+${level}</span>` : "");

function readJson(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
        return fallback;
    }
}

function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // just not remembered
    }
}

const keepSet = () => new Set(readJson(KEEP_KEY, []));

export function toggleKeep(hrid, level) {
    const keep = keepSet();
    const key = keepKey(hrid, Number(level) || 0);
    if (keep.has(key)) keep.delete(key);
    else keep.add(key);
    writeJson(KEEP_KEY, [...keep]);
}

export function toggleShowAllMarket() {
    view.showAll = !view.showAll;
}

const openListings = () => (state.character?.myMarketListings || []).filter((listing) => remaining(listing) > 0);

// Every open order with its standing. The fill times are remembered across reloads.
export function listingStatuses(now = Date.now()) {
    const listings = openListings();
    const fills = trackFills(listings, readJson(FILLS_KEY, {}), now);
    writeJson(FILLS_KEY, fills);
    return listings.map((listing) => {
        const level = Number(listing.enhancementLevel) || 0;
        const own = listings
            .filter((other) => other.itemHrid === listing.itemHrid && (Number(other.enhancementLevel) || 0) === level && !!other.isSell === !!listing.isSell)
            .map((other) => ({ price: Number(other.price) || 0, quantity: remaining(other) }));
        const status = listingStatus(listing, {
            entry: marketEntry(listing.itemHrid, level),
            book: orderBookAt(listing.itemHrid, level),
            own,
            summary: priceSummary(listing.itemHrid, level),
            lastFillAt: fills[listing.id]?.at ?? null,
            now,
        });
        return { listing, level, ...status };
    });
}

// How many orders deserve the red dot on the 🧭 button.
export function marketAlerts() {
    if (!state.character || !getClientData()) return 0;
    try {
        return listingStatuses().filter((s) => s.alert).length;
    } catch {
        return 0;
    }
}

function statusText(s) {
    const days = s.daysAhead !== null ? ` – about ${dec(s.daysAhead, s.daysAhead < 10 ? 1 : 0)} days of sales` : "";
    switch (s.kind) {
        case "front":
            return `<span class="mwia-ok">✅ first in line</span>${s.fromBook ? "" : ` <span class="mwia-dim">(or sharing the price)</span>`}`;
        case "tied":
            return `<span class="mwia-ok">✅ first, sharing the price</span>`;
        case "behind":
            return `<span class="mwia-dim">${s.better.toLocaleString("en-US")} ${s.side === "sell" ? "cheaper" : "higher"} first (${pctAbs(s.share)} of the offer)${days}</span>`;
        case "wall":
            return `<span class="mwia-bad">⛔ ${s.better.toLocaleString("en-US")} ${s.side === "sell" ? "cheaper" : "higher"} first – ${pctAbs(s.share)} of the offer${days}</span>`;
        case "cheaper":
            return `<span class="${s.alert ? "mwia-bad" : "mwia-warn"}">⚠ ${s.side === "sell" ? "cheaper" : "higher"} offer at ${coins(s.best)} (${s.side === "sell" ? "−" : "+"}${pctAbs(s.gap)})</span>
              <span class="mwia-dim">– open it on the market to see how many</span>`;
        default:
            return `<span class="mwia-dim">no price in the market file</span>`;
    }
}

function listingRow(s) {
    const { listing, level } = s;
    const notes = [];
    if (s.stale) notes.push(`<span class="mwia-warn" title="No ${s.side === "sell" ? "sale" : "purchase"} on this order for ${dec(s.idleHours, 0)} h">💤 ${dec(s.idleHours, 0)} h</span>`);
    if (s.generous) {
        notes.push(`<span class="mwia-warn" title="The week's usual ${s.side === "sell" ? "ask" : "bid"} is ${coins(s.usual)}">${s.side === "sell" ? "↓ " + pctAbs(s.vsUsual.diff) + " below" : "↑ " + pctAbs(s.vsUsual.diff) + " above"} usual</span>`);
    }
    if (s.fromBook) notes.push(`<span class="mwia-dim">order book ${dec((Date.now() - s.bookAt) / 3600e3, 1)} h old</span>`);
    return `<tr class="${s.alert ? "mwia-alert-row" : ""}"><td>${s.side === "sell" ? "Sell" : "Buy"}</td><td>${label(listing.itemHrid, level)}</td>
      <td class="mwia-num">${s.left.toLocaleString("en-US")}</td><td class="mwia-num">${coins(s.price)}</td><td>${statusText(s)} ${notes.join(" ")}</td>
      <td><button class="mwia-cart-btn" data-action="market-open" data-item="${esc(listing.itemHrid)}" data-level="${level}" title="Open on the market (reads its order book)">🏪</button></td></tr>`;
}

function inventoryItems() {
    const counts = new Map();
    for (const item of state.items.values()) {
        if (item.itemLocationHrid !== INVENTORY || !item.itemHrid) continue;
        const level = Number(item.enhancementLevel) || 0;
        const key = keepKey(item.itemHrid, level);
        const entry = counts.get(key) || { hrid: item.itemHrid, level, count: 0 };
        entry.count += Number(item.count) || 0;
        counts.set(key, entry);
    }
    return [...counts.values()];
}

function sellRow(r) {
    const notes = [];
    if (r.bidVsUsual?.label === "above") notes.push(`<span class="mwia-ok">buyers pay ${pctAbs(r.bidVsUsual.diff)} above usual – a good moment</span>`);
    if (r.askVsUsual?.label === "below") notes.push(`<span class="mwia-warn">price ${pctAbs(r.askVsUsual.diff)} below usual – waiting may pay</span>`);
    if (r.daysToSell > 1) notes.push(`<span class="mwia-warn">${dec(r.daysToSell, 1)} days of sales</span>`);
    if (!r.bid) notes.push(`<span class="mwia-dim">nobody buys now</span>`);
    if (r.listed) notes.push(`<span class="mwia-dim">${r.listed.toLocaleString("en-US")} already listed</span>`);
    if (r.equipment) notes.push(`<span class="mwia-dim">equipment</span>`);
    const how =
        r.how === "sell"
            ? `<b>Sell now</b> at ${coins(r.bid)}${r.spread !== null ? ` <span class="mwia-dim">(listing gains only ${pctAbs(r.spread)})</span>` : ""}`
            : `<b>List</b> at ${coins(r.listPrice)}${r.bid ? ` <span class="mwia-dim">(now: ${coins(r.bid)})</span>` : ""}`;
    return `<tr class="${r.small ? "mwia-faded" : ""}"><td>${label(r.hrid, r.level)}</td><td class="mwia-num">${r.count.toLocaleString("en-US")}</td>
      <td class="mwia-num">${coins(r.value)}</td><td>${how}${notes.length ? "<br>" + notes.join(" · ") : ""}</td>
      <td><button class="mwia-cart-btn" data-action="market-open" data-item="${esc(r.hrid)}" data-level="${r.level}" title="Open on the market">🏪</button>
        <button class="mwia-cart-btn" data-action="market-keep" data-item="${esc(r.hrid)}" data-level="${r.level}" title="Keep it: never suggest selling it">📌</button></td></tr>`;
}

const WHY = { pinned: "📌 pinned", "in your slots": "in your slots", "for your queue": "for your queue", "for your train": "for your train" };

export function renderMarket() {
    const data = getClientData();
    if (!state.character || !data) return `<p>Waiting for the game and the market prices…</p>`;
    let html = `<h3>📤 Your orders</h3>`;
    const statuses = listingStatuses();
    if (!statuses.length) {
        html += `<p class="mwia-dim">No open orders.</p>`;
    } else {
        const order = { wall: 0, cheaper: 1, behind: 2, unknown: 3, tied: 4, front: 5 };
        statuses.sort((a, b) => b.alert - a.alert || order[a.kind] - order[b.kind] || b.stale - a.stale);
        const alerts = statuses.filter((s) => s.alert).length;
        if (alerts) html += `<p class="mwia-reco">⛔ ${alerts} order${alerts === 1 ? " is" : "s are"} behind a pile of better offers – unlikely to fill soon. Open ${alerts === 1 ? "it" : "them"} with 🏪 and pick a new price (the <b>Wall</b> button stops just in front of the pile).</p>`;
        html += `<table class="mwia-table mwia-wide"><thead><tr><th>Side</th><th>Item</th><th class="mwia-num">Left</th><th class="mwia-num">Price</th><th>Standing</th><th></th></tr></thead>
          <tbody>${statuses.map(listingRow).join("")}</tbody></table>
          <p class="mwia-dim">⛔ when at least ${pctAbs(MARKET_RULES.wallShare)} of what others offer, or more than ${MARKET_RULES.daysAhead} day of sales, comes before your order
          (from the order book, read when you open the item on the market – fresh for ${MARKET_RULES.bookHours} h), or without one when the best offer is more than
          ${pctAbs(MARKET_RULES.bigGap)} better than yours. 💤 = nothing ${"sold or bought"} for ${MARKET_RULES.staleHours} h. Prices from the market file (refreshed every 10 min while you have orders).</p>`;
    }

    const trainActions = (() => {
        try {
            return trainActionsLeft();
        } catch {
            return [];
        }
    })();
    const { rows, kept } = sellSuggestions(inventoryItems(), {
        data,
        entryOf: marketEntry,
        summaryOf: priceSummary,
        reserved: reservedItems(state.character, state.items, data, trainActions),
        keep: keepSet(),
        listed: (hrid, level) => openListings().filter((l) => l.isSell && l.itemHrid === hrid && (Number(l.enhancementLevel) || 0) === level).reduce((sum, l) => sum + remaining(l), 0),
    });
    html += `<h3>💰 Sell from your inventory</h3>`;
    const shown = view.showAll ? rows : rows.filter((r) => !r.small);
    if (!shown.length) html += `<p class="mwia-dim">Nothing worth ${coins(MARKET_RULES.minValue)} or more to sell.</p>`;
    else {
        html += `<table class="mwia-table mwia-wide"><thead><tr><th>Item</th><th class="mwia-num">Have</th><th class="mwia-num" title="After the 4% market tax">Worth</th><th>Advice</th><th></th></tr></thead>
          <tbody>${shown.map(sellRow).join("")}</tbody></table>`;
    }
    const hidden = rows.length - shown.length;
    html += `<p><button class="mwia-link" data-action="market-all">${view.showAll ? "Hide small amounts" : `Show all${hidden ? ` (${hidden} under ${coins(MARKET_RULES.minValue)})` : ""}`}</button></p>`;
    if (kept.length) {
        html += `<details class="mwia-skill-sec"><summary>Kept, not offered (${kept.length})</summary><ul>${kept
            .map((k) => `<li>${label(k.hrid, k.level)} × ${k.count.toLocaleString("en-US")} – ${esc(WHY[k.why] || k.why)}${k.why === "pinned" ? ` <button class="mwia-link" data-action="market-keep" data-item="${esc(k.hrid)}" data-level="${k.level}">unpin</button>` : ""}</li>`)
            .join("")}</ul></details>`;
    }
    html += `<p class="mwia-dim"><b>Sell now</b> when listing would gain under ${pctAbs(MARKET_RULES.quickSpread)}; else <b>List</b> at the lowest ask, never above the week's usual ask.
      Teas, food and drinks in your slots, materials for your queue or a running train, and what you pin 📌 are never offered.</p>`;
    return html;
}
