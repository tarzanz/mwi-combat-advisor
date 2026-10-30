// Price buttons in the game's Sell Listing and Buy Listing windows: match the
// best offer, stop in front of the next wall in the order book, or the best
// price that sells (buys) within 1, 8 or 24 hours – with a line on where your
// price stands.
// The player still posts the listing with the game's own button.

import { getClientData, itemName, loadClientData } from "./game-data.js";
import { orderBookAt, state } from "./game-state.js";
import { esc, parseCoins, shortCoins } from "./format.js";
import { setReactInput, visible } from "./game-nav.js";
import { isTouch, showTip } from "./touch.js";
import { historyVersion, priceSummary, recentHours, versusUsual } from "./price-history.js";
import { CONFIDENCE, FILLED, listingPrices, standing } from "./listing-price.js";

// The listing window: the game's modal around the marketplace's price inputs.
const MODAL = '[class*="Modal_modalContainer"],[class*="MarketplacePanel_modalContent"]';
const HEADER = '[class*="MarketplacePanel_header"]';
const PRICE_INPUTS = '[class*="MarketplacePanel_priceInputs"]';
const BEST = '[class*="MarketplacePanel_bestPrice"]';
const SCAN_MS = 300;
const BOOK_OLD_MS = 10 * 60 * 1000;

const LABELS = { match: "Match", wall: "Wall" };
const label = (s) => (s.kind === "horizon" ? `<${s.horizon}h` : LABELS[s.kind]);

const l = { win: null, scanTimer: null, loading: null, loadError: null, applying: false, cache: { key: null, prices: null } };

const num = (n) => Math.round(n).toLocaleString("en-US");
// The last number in a text ("Best Sell Offer: 1 096" -> 1096), or null.
const numberIn = (text) => {
    const found = String(text).match(/\d[\d\s,.]*[kmb]?/gi);
    return found ? parseCoins(found[found.length - 1].trim()) : null;
};
const tick = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export function startListingPrices(win) {
    l.win = win;
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-listprice"))) return; // our own re-render
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", (event) => {
        if (event.target.closest?.(MODAL)) scheduleScan();
    }, true);
}

const POST = /^post (sell|buy) listing$/i;
// For a note in the window when it can't be read (the script's version shows the update arrived).
const VERSION = typeof GM_info !== "undefined" ? GM_info.script?.version || "" : "";

// Every listing window on screen: the modal around a price box or a "Post … Listing" button.
function listingModals() {
    const found = new Set();
    const anchors = [...document.querySelectorAll(PRICE_INPUTS), ...[...document.querySelectorAll("button")].filter((b) => POST.test(b.textContent.trim()))];
    for (const anchor of anchors) {
        if (!visible(anchor)) continue;
        let modal = anchor.closest(MODAL);
        // No modal class we know: the nearest box around both the price and the Post button.
        for (let el = anchor.parentElement; !modal && el && el !== document.body; el = el.parentElement) {
            if ([...el.querySelectorAll("button")].some((b) => POST.test(b.textContent.trim())) && el.querySelector("input")) modal = el;
        }
        if (modal) found.add(modal);
    }
    return [...found];
}

function scheduleScan() {
    if (l.scanTimer) return;
    l.scanTimer = setTimeout(() => {
        l.scanTimer = null;
        try {
            scan();
        } catch (error) {
            console.warn("[MWI Advisor] listing prices", error);
        }
    }, SCAN_MS);
}

// The listing window's item, side and controls; null for any other window (Buy Now, Sell Now …),
// { error } when it is a listing window that can't be read.
function readModal(modal) {
    const header = modal.querySelector(HEADER)?.textContent || "";
    const post = [...modal.querySelectorAll("button")].map((b) => POST.exec(b.textContent.trim())).find(Boolean);
    const said = /sell listing|sell order/i.test(header) ? "sell" : /buy listing|buy order/i.test(header) ? "buy" : null;
    const side = said || (post ? post[1].toLowerCase() : null);
    if (!side) return null;
    const inputs = modal.querySelector(PRICE_INPUTS);
    if (!inputs) return { error: `no price box found (inputs: ${modal.querySelectorAll("input").length})` };
    // The price shows between the game's −/+ (an input, or just text that only −/+ change).
    const input = inputs.querySelector("input");
    // The item: the first icon that is an item (not the coin or the close button).
    const items = getClientData()?.itemDetailMap || {};
    const hrid = [...modal.querySelectorAll("svg use")]
        .map((use) => "/items/" + (use.getAttribute("href") || use.getAttribute("xlink:href") || "").split("#").pop())
        .find((candidate) => items[candidate] && candidate !== "/items/coin");
    if (!hrid) return { error: `no item icon found (icons: ${[...modal.querySelectorAll("svg use")].map((use) => (use.getAttribute("href") || use.getAttribute("xlink:href") || "?").split("/").pop()).join(", ") || "none"})` };
    const text = modal.textContent || "";
    const range = /Tradable range:\s*(\d[\d\s,.]*)\s*[–-]\s*(\d[\d\s,.]*)/i.exec(text);
    // Equipment has an Enhancement Level box: the first input after that label.
    const level = inputAfter(modal, /^enhancement level$/i);
    // How many: the box after "Quantity (You Have: …)".
    const quantity = inputAfter(modal, /^quantity\b/i);
    return {
        side,
        hrid,
        level: level ? Number(level.value) || 0 : 0,
        quantity: Math.max(1, (quantity && numberIn(quantity.value)) || 1),
        inputs,
        input,
        best: numberIn(modal.querySelector(BEST)?.textContent || ""),
        range: range ? { min: parseCoins(range[1]), max: parseCoins(range[2]) } : null,
    };
}

// The first input after a label (a text-only element) matching pattern.
function inputAfter(modal, pattern) {
    const label = [...modal.querySelectorAll("*")].find((el) => !el.children.length && pattern.test(el.textContent.trim()));
    return label && [...modal.querySelectorAll("input")].find((el) => label.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function ownListings(hrid, side, level = 0) {
    return (state.character?.myMarketListings || [])
        .filter((listing) => listing.itemHrid === hrid && (listing.enhancementLevel || 0) === level && !!listing.isSell === (side === "sell"))
        .map((listing) => ({ price: Number(listing.price) || 0, quantity: Math.max(0, (listing.orderQuantity || 0) - (listing.filledQuantity || 0)) }));
}

function context(modal) {
    const m = readModal(modal);
    if (!m || m.error) return m;
    const book = orderBookAt(m.hrid, m.level);
    // The range the window shows, else the one the game sent with the order book.
    const range = m.range || book?.range || null;
    const own = ownListings(m.hrid, m.side, m.level);
    // The horizons go through a week of hours: worked out again only when something they rest on changes.
    const key = JSON.stringify([m.side, m.hrid, m.level, m.quantity, m.best, range, book?.at, own, historyVersion()]);
    if (l.cache.key !== key) {
        l.cache = { key, prices: listingPrices({ side: m.side, book, own, best: m.best, range, summary: priceSummary(m.hrid, m.level), hours: recentHours(m.hrid, m.level), quantity: m.quantity }) };
    }
    return { ...m, book, range, ...l.cache.prices };
}

function scan() {
    const modals = listingModals();
    // The item names come from the game data, which may not be loaded yet after a reload.
    if (modals.length && !getClientData() && !l.loadError) {
        l.loading ||= loadClientData(l.win)
            .then(scheduleScan, (error) => {
                l.loadError = String(error?.message || error);
                scheduleScan();
            })
            .finally(() => (l.loading = null));
        return;
    }
    // −/+ change the price's text without adding nodes: look again while a window is open.
    if (modals.length) setTimeout(scheduleScan, 700);
    for (const modal of modals) {
        let c;
        try {
            c = getClientData() ? context(modal) : { error: `no game data (${l.loadError})` };
        } catch (error) {
            c = { error: String(error?.message || error) };
        }
        let box = modal.querySelector(".mwia-listprice");
        if (!c) {
            box?.remove();
            continue;
        }
        if (!box) {
            box = document.createElement("div");
            box.className = "mwia-listprice";
            const inputs = modal.querySelector(PRICE_INPUTS);
            const post = [...modal.querySelectorAll("button")].find((b) => POST.test(b.textContent.trim()));
            if (inputs) inputs.insertAdjacentElement("afterend", box);
            else if (post) post.insertAdjacentElement("beforebegin", box);
            else modal.appendChild(box);
        }
        const html = c.error ? `<div class="mwia-listprice-info">MWI Advisor ${esc(VERSION)} can't read this window: ${esc(c.error)}. A screenshot of this helps.</div>` : boxHtml(c);
        if (box.dataset.html !== html) {
            box.dataset.html = html;
            box.innerHTML = html;
        }
    }
}

function boxHtml(c) {
    const sell = c.side === "sell";
    const buttons = c.suggestions.map((s, i) => {
        const shown = s.price === null ? "—" : s.kind === "wall" || s.under ? `${sell ? "<" : ">"} ${shortCoins(s.price)}` : shortCoins(s.price);
        return `<button type="button" data-listprice="${i}"${s.price === null ? ' class="mwia-off"' : ""} title="${esc(titleFor(s, c))}"><b>${label(s)}</b><small>${shown}</small></button>`;
    });
    return `${buttons.length ? `<div class="mwia-listprice-buttons">${buttons.join("")}</div>` : ""}<div class="mwia-listprice-info">${infoHtml(c)}</div>`;
}

function titleFor(s, c) {
    const sell = c.side === "sell";
    const cap = s.capped ? ` (the tradable range's ${s.capped})` : "";
    if (s.kind === "match") return `The best ${sell ? "sell" : "buy"} offer now: ${num(s.price)}${cap}.`;
    if (s.kind === "wall") return `One step ${sell ? "under" : "over"} ${num(s.wall.quantity)} at ${num(s.price)}, the first level with a fifth of all ${sell ? "listed" : "bid"}; ${num(s.wall.ahead)} lie in front of it.`;
    return horizonTitle(s, c);
}

// What a horizon button rests on, or why it has no price.
function horizonTitle(s, c) {
    const sell = c.side === "sell";
    const goes = sell ? "sells" : "is bought";
    const pct = (share) => `${Math.round(share * 100)}%`;
    const rate = c.taken ? `${sell ? "Buyers take" : "Sellers fill"} about ${num(c.taken.perHour)} an hour from ${sell ? "sell" : "buy"} listings.` : "How many trade an hour isn't known yet, so the quantity isn't counted.";
    if (s.price === null) {
        if (s.why === "quantity") return `${num(c.quantity)} is about ${num(c.quantity / c.taken.perHour)} h of what ${sell ? "buyers take" : "sellers fill"} (${num(c.taken.perHour)} an hour): ${pct(FILLED)} of it can't go within ${s.horizon} h at any price.`;
        if (s.why === "history") return `Needs more hourly prices: ${s.windows} of the 12 stretches of ${s.horizon} h it looks back on so far.`;
        if (s.need > 1) return `${pct(FILLED)} of ${num(c.quantity)} takes about ${num(s.need)} h first in line (${num(c.taken.perHour)} an hour): no price was first in line that long in ${pct(CONFIDENCE)} of past stretches of ${s.horizon} h.`;
        return `No price ${goes} within ${s.horizon} h often enough.`;
    }
    const where = s.under ? `One step ${sell ? "under" : "over"} the best offer (${num(s.price)}): first in line now.` : `At ${num(s.price)}.`;
    return `${where} A ${pct(CONFIDENCE)} chance that ${pct(FILLED)} of ${num(c.quantity)} ${goes} within ${s.horizon} h – it did in ${pct(s.chance)} of ${s.windows} past stretches of ${s.horizon} h. ${rate}`;
}

// Where the price in the box stands: what is offered in front of it, and against the usual price.
function infoHtml(c) {
    const sell = c.side === "sell";
    const price = priceIn(c);
    const parts = [];
    if (price > 0 && c.book) {
        const { better, same } = standing(price, c.levels, c.side);
        parts.push(`${num(better)} ${sell ? "listed cheaper" : "bid higher"}${same ? `, ${num(same)} at ${num(price)}` : ""}`);
        const age = Date.now() - c.book.at;
        if (age > BOOK_OLD_MS) parts.push(`order book ${Math.round(age / 60000)} min old`);
        // The book's best offer should be the one the window shows; if not, it is old or not this +level's.
        const top = (sell ? c.book.asks : c.book.bids)[0]?.price;
        if (c.best > 0 && top > 0 && top !== c.best) parts.push(`the order book's best (${num(top)}) isn't the window's – open ${esc(itemName(c.hrid))}${c.level ? ` +${c.level}` : ""} on the market again`);
    } else if (!c.book) parts.push(`open ${esc(itemName(c.hrid))}${c.level ? ` +${c.level}` : ""} on the market for the order book`);
    const vs = price > 0 ? versusUsual(price, c.usual) : null;
    if (vs) parts.push(`${vs.diff >= 0 ? "+" : "−"}${Math.abs(Math.round(vs.diff * 100))}% vs usual ${sell ? "ask" : "bid"} (${num(c.usual)})`);
    else if (!c.usual) parts.push(`usual price after 12 h of prices${c.hours ? ` (${c.hours} so far)` : ""}`);
    return parts.join(" · ");
}

// The price in the window now.
function priceIn(c) {
    if (c.input) return numberIn(c.input.value);
    const text = [...c.inputs.childNodes].filter((node) => node.nodeName !== "BUTTON").map((node) => node.textContent).join(" ");
    return numberIn(text);
}

function controls(c) {
    const buttons = [...c.inputs.querySelectorAll("button")];
    const by = (pattern) => buttons.find((b) => pattern.test(b.textContent.trim()));
    return { minus: by(/^[-−]$/), plus: by(/^\+$/), min: by(/^min$/i), max: by(/^max$/i) };
}

const MAX_STEPS = 400;

// Clicks one of the game's buttons and waits for the price to show it; the new price, or null if it didn't move.
async function press(c, button) {
    const before = priceIn(c);
    button.click();
    for (let i = 0; i < 10; i++) {
        await tick();
        const now = priceIn(c);
        if (now !== before) return now;
    }
    return null;
}

// Steps the price with the game's own −/+ (the game knows which prices are
// valid) to the highest valid price at or under target, or – up: true – the
// lowest at or over it.
async function stepTo(c, b, target, up = false) {
    let price = priceIn(c);
    for (let i = 0; i < MAX_STEPS && price !== null; i++) {
        if (price === target) return price;
        if (price < target) {
            const next = await press(c, b.plus);
            if (next === null) return price;
            if (next > target) return up ? next : press(c, b.minus).then((back) => back ?? next);
            price = next;
        } else {
            const next = await press(c, b.minus);
            if (next === null) return price;
            if (next < target) return up ? press(c, b.plus).then((back) => back ?? next) : next;
            price = next;
        }
    }
    return price;
}

// Puts a suggestion in the price box: Min/Max at the tradable range's ends,
// otherwise the game's −/+ step by step (or typed in, where the box takes typing).
async function apply(modal, index) {
    const c = context(modal);
    const s = c?.suggestions?.[index];
    if (!s || s.price === null || l.applying) return;
    l.applying = true;
    try {
        const b = controls(c);
        if (s.capped === "max" && b.max) await press(c, b.max);
        else if (s.capped === "min" && b.min) await press(c, b.min);
        else if (b.plus && b.minus) {
            const target = Math.round(s.price);
            if (c.input) {
                setReactInput(c.input, target);
                await tick();
            }
            // Wall and "one step past": one step past the price; the rest: the valid price nearest under it.
            const reached = await stepTo(c, b, target, s.step > 0);
            if (s.step && reached === target) await press(c, s.step < 0 ? b.minus : b.plus);
        } else if (c.input) setReactInput(c.input, Math.round(s.price));
    } finally {
        l.applying = false;
    }
    scheduleScan();
}

function onClick(event) {
    const button = event.target.closest?.(".mwia-listprice [data-listprice]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    // No hover on a phone: a tap shows what the button rests on (and, without a price, why).
    if (isTouch() || button.classList.contains("mwia-off")) showTip(button, button.title);
    apply(listingModals().find((modal) => modal.contains(button)), Number(button.dataset.listprice));
}
