// Price buttons in the game's Sell Listing and Buy Listing windows: match the
// best offer, stop in front of the next wall in the order book, or take the
// week's usual or a patient price – with a line on where your price stands.
// The player still posts the listing with the game's own button.

import { itemName } from "./game-data.js";
import { state } from "./game-state.js";
import { esc, parseCoins, shortCoins } from "./format.js";
import { setReactInput, visible } from "./game-nav.js";
import { priceSummary, versusUsual } from "./price-history.js";
import { listingPrices, standing } from "./listing-price.js";

const MODAL = '[class*="MarketplacePanel_modalContent"]';
const HEADER = '[class*="MarketplacePanel_header"]';
const PRICE_INPUTS = '[class*="MarketplacePanel_priceInputs"]';
const BEST = '[class*="MarketplacePanel_bestPrice"]';
const SCAN_MS = 300;
const BOOK_OLD_MS = 10 * 60 * 1000;

const LABELS = { match: "Match", wall: "Wall", usual: "Usual", patient: "Patient" };

const l = { scanTimer: null };

const num = (n) => Math.round(n).toLocaleString("en-US");
// The last number in a text ("Best Sell Offer: 1 096" -> 1096), or null.
const numberIn = (text) => {
    const found = String(text).match(/\d[\d\s,.]*[kmb]?/gi);
    return found ? parseCoins(found[found.length - 1].trim()) : null;
};
const tick = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

export function startListingPrices() {
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-listprice"))) return; // our own re-render
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("input", (event) => {
        if (event.target.closest?.(MODAL)) scheduleScan();
    }, true);
}

function scheduleScan() {
    if (l.scanTimer) return;
    l.scanTimer = setTimeout(() => {
        l.scanTimer = null;
        try {
            scan();
        } catch (error) {
            console.warn("[Combat Advisor] listing prices", error);
        }
    }, SCAN_MS);
}

// The listing window's item, side and controls, or null for any other window (Buy Now, Sell Now …).
function readModal(modal) {
    const header = modal.querySelector(HEADER)?.textContent || "";
    const side = /sell listing|sell order/i.test(header) ? "sell" : /buy listing|buy order/i.test(header) ? "buy" : null;
    const inputs = modal.querySelector(PRICE_INPUTS);
    const input = inputs?.querySelector("input");
    if (!side || !input) return null;
    const use = modal.querySelector("svg use");
    const id = (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#").pop();
    if (!id) return null;
    const text = modal.textContent || "";
    const range = /Tradable range:\s*(\d[\d\s,.]*)\s*[–-]\s*(\d[\d\s,.]*)/i.exec(text);
    const enhanced = /\+(\d+)/.exec(modal.querySelector("svg")?.closest("div")?.parentElement?.textContent || "");
    return {
        side,
        hrid: "/items/" + id,
        level: enhanced ? Number(enhanced[1]) : 0,
        inputs,
        input,
        best: numberIn(modal.querySelector(BEST)?.textContent || ""),
        range: range ? { min: parseCoins(range[1]), max: parseCoins(range[2]) } : null,
    };
}

function ownListings(hrid, side) {
    return (state.character?.myMarketListings || [])
        .filter((listing) => listing.itemHrid === hrid && !listing.enhancementLevel && !!listing.isSell === (side === "sell"))
        .map((listing) => ({ price: Number(listing.price) || 0, quantity: Math.max(0, (listing.orderQuantity || 0) - (listing.filledQuantity || 0)) }));
}

function context(modal) {
    const m = readModal(modal);
    if (!m || m.level) return m;
    const book = state.orderBooks.get(m.hrid) || null;
    return { ...m, book, ...listingPrices({ side: m.side, book, own: ownListings(m.hrid, m.side), best: m.best, range: m.range, summary: priceSummary(m.hrid) }) };
}

function scan() {
    for (const modal of document.querySelectorAll(MODAL)) {
        if (!visible(modal)) continue;
        const c = context(modal);
        let box = modal.querySelector(".mwia-listprice");
        if (!c) {
            box?.remove();
            continue;
        }
        if (!box) {
            box = document.createElement("div");
            box.className = "mwia-listprice";
            c.inputs.insertAdjacentElement("afterend", box);
        }
        const html = boxHtml(c);
        if (box.dataset.html !== html) {
            box.dataset.html = html;
            box.innerHTML = html;
        }
    }
}

function boxHtml(c) {
    if (c.level) return `<div class="mwia-listprice-info">Price help is for +0 items only.</div>`;
    const sell = c.side === "sell";
    const buttons = c.suggestions.map((s, i) => {
        const shown = s.kind === "wall" ? `${sell ? "<" : ">"} ${shortCoins(s.price)}` : shortCoins(s.price);
        return `<button type="button" data-listprice="${i}" title="${esc(titleFor(s, c))}"><b>${LABELS[s.kind]}</b><small>${shown}</small></button>`;
    });
    return `${buttons.length ? `<div class="mwia-listprice-buttons">${buttons.join("")}</div>` : ""}<div class="mwia-listprice-info">${infoHtml(c)}</div>`;
}

function titleFor(s, c) {
    const sell = c.side === "sell";
    const cap = s.capped ? ` (the tradable range's ${s.capped})` : "";
    if (s.kind === "match") return `The best ${sell ? "sell" : "buy"} offer now: ${num(s.price)}${cap}.`;
    if (s.kind === "wall") return `One step ${sell ? "under" : "over"} ${num(s.wall.quantity)} at ${num(s.price)}, the first level with a fifth of all ${sell ? "listed" : "bid"}; ${num(s.wall.ahead)} lie in front of it.`;
    if (s.kind === "usual") return `The week's median ${sell ? "ask" : "bid"}: ${num(s.price)}${cap}.`;
    return `${sell ? "A quarter of the week's asks were at or above" : "A quarter of the week's bids were at or below"} ${num(s.price)}${cap}: for when you're in no hurry.`;
}

// Where the price in the box stands: what is offered in front of it, and against the usual price.
function infoHtml(c) {
    const sell = c.side === "sell";
    const price = numberIn(c.input.value);
    const parts = [];
    if (price > 0 && c.book) {
        const { better, same } = standing(price, c.levels, c.side);
        parts.push(`${num(better)} ${sell ? "listed cheaper" : "bid higher"}${same ? `, ${num(same)} at ${num(price)}` : ""}`);
        const age = Date.now() - c.book.at;
        if (age > BOOK_OLD_MS) parts.push(`order book ${Math.round(age / 60000)} min old`);
    } else if (!c.book) parts.push(`open ${esc(itemName(c.hrid))} on the market for the order book`);
    const vs = price > 0 ? versusUsual(price, c.usual) : null;
    if (vs) parts.push(`${vs.diff >= 0 ? "+" : "−"}${Math.abs(Math.round(vs.diff * 100))}% vs usual ${sell ? "ask" : "bid"} (${num(c.usual)})`);
    else if (!c.usual) parts.push(`usual price after 12 h of prices${c.hours ? ` (${c.hours} so far)` : ""}`);
    return parts.join(" · ");
}

function controls(c) {
    const buttons = [...c.inputs.querySelectorAll("button")];
    const by = (pattern) => buttons.find((b) => pattern.test(b.textContent.trim()));
    return { minus: by(/^[-−]$/), plus: by(/^\+$/), min: by(/^min$/i), max: by(/^max$/i) };
}

// Puts a suggestion in the price box, with the game's own −/+ for the steps
// (the game knows which prices are valid).
async function apply(modal, index) {
    const c = context(modal);
    const s = c?.suggestions?.[index];
    if (!s) return;
    const b = controls(c);
    if (s.capped === "max" && b.max) b.max.click();
    else if (s.capped === "min" && b.min) b.min.click();
    else {
        setReactInput(c.input, Math.round(s.price));
        await tick();
        if (s.step) (s.step < 0 ? b.minus : b.plus)?.click();
        else if (s.snap && b.plus && b.minus) {
            // A price from the history may fall between valid prices: up a step and back down lands on one.
            b.plus.click();
            await tick();
            b.minus.click();
        }
    }
    await tick();
    scheduleScan();
}

function onClick(event) {
    const button = event.target.closest?.(".mwia-listprice [data-listprice]");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    apply(button.closest(MODAL), Number(button.dataset.listprice));
}
