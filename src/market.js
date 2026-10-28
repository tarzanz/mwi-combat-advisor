// The Market tab's advice: how your own orders stand, and what in the inventory
// is worth selling now. Pure: the panel is in market-ui.js.

import { WALL_SHARE, otherLevels, standing } from "./listing-price.js";
import { MIN_HOURS, versusUsual } from "./price-history.js";
import { MARKET_TAX, WIDE_SPREAD } from "./skilling.js";

export const MARKET_RULES = {
    // An order is behind a wall when more than this many days of sales come first…
    daysAhead: 1,
    // …or, while how many sell a day is unknown, this share of everything others
    // offer comes first (the same share as the Wall price button). A thin book
    // makes the share big however quickly those sell, so sales come first.
    wallShare: WALL_SHARE,
    // Without an order book: a best price this much better than yours is a wall too.
    bigGap: 0.1,
    // An order book seen on the market within this many hours counts as fresh.
    bookHours: 6,
    // No sale (or purchase) for this long: the order is stale.
    staleHours: 12,
    // Inventory worth less than this in total is listed only under "Show all".
    minValue: 10000,
    // Selling at the bid loses little when the spread is within this share of the ask.
    quickSpread: 0.05,
};

const HOUR = 3600e3;

export const remaining = (listing) => Math.max(0, (Number(listing.orderQuantity) || 0) - (Number(listing.filledQuantity) || 0));

// When an order was placed, if the game says (a timestamp or a date string).
function placedAt(listing) {
    const raw = listing.createdTimestamp ?? listing.createdAt ?? listing.created;
    const time = typeof raw === "number" ? (raw < 1e12 ? raw * 1000 : raw) : Date.parse(raw ?? "");
    return Number.isFinite(time) ? time : null;
}

// Remembers when each order last sold (or bought) something. store: { id: { filled, at } };
// returns the store for the orders still open, with at = the last change seen.
export function trackFills(listings, store = {}, now = Date.now()) {
    const out = {};
    for (const listing of listings) {
        if (listing.id === undefined || listing.id === null) continue;
        const filled = Number(listing.filledQuantity) || 0;
        const before = store[listing.id];
        if (!before) out[listing.id] = { filled, at: Math.min(now, placedAt(listing) ?? now) };
        else out[listing.id] = before.filled === filled ? before : { filled, at: now };
    }
    return out;
}

// How one of your orders stands. entry: the market file's { a, b } at its +level;
// book: orderBookAt(…) or null; own: your orders on the same side and item,
// [{ price, quantity }]; summary: the price history summary; lastFillAt: from trackFills.
// kind: "front" (nobody offers better), "tied" (others at your price, none better),
// "behind" (a few better, not enough to wait long), "wall" (a lot better, see
// MARKET_RULES), "cheaper" (the file says a better price exists; how much is
// unknown without the order book), "unknown". alert: worth a red dot.
export function listingStatus(listing, { entry = null, book = null, own = [], summary = null, lastFillAt = null, now = Date.now(), rules = MARKET_RULES } = {}) {
    const sell = !!listing.isSell;
    const side = sell ? "sell" : "buy";
    const price = Number(listing.price) || 0;
    const sold = summary?.liquidity?.sold;
    const perDay = sold?.enough && sold.perDay > 0 ? sold.perDay : null;
    const out = { side, price, left: remaining(listing), kind: "unknown", alert: false, fromBook: false, better: null, total: null, share: null, daysAhead: null, gap: null, best: null, perDay };
    const better = (a, b) => (sell ? a < b : a > b);

    if (book && now - book.at <= rules.bookHours * HOUR) {
        const levels = otherLevels(sell ? book.asks : book.bids, own, book.range, side);
        const { better: ahead, same } = standing(price, levels, side);
        const total = levels.reduce((sum, level) => sum + level.quantity, 0);
        Object.assign(out, { fromBook: true, better: ahead, total, share: total ? ahead / total : 0, daysAhead: perDay ? ahead / perDay : null, best: levels[0]?.price ?? null, bookAt: book.at });
        if (ahead === 0) out.kind = same ? "tied" : "front";
        else {
            const wall = out.daysAhead !== null ? out.daysAhead > rules.daysAhead : out.share >= rules.wallShare;
            out.kind = wall ? "wall" : "behind";
            out.gap = out.best ? Math.abs(out.best / price - 1) : null;
        }
    } else {
        const best = sell ? entry?.a : entry?.b;
        if (best > 0) {
            out.best = best;
            if (!better(best, price)) out.kind = "front";
            else {
                out.kind = "cheaper";
                out.gap = Math.abs(best / price - 1);
            }
        }
    }
    out.alert = out.kind === "wall" || (out.kind === "cheaper" && out.gap > rules.bigGap);
    out.stale = lastFillAt !== null && now - lastFillAt > rules.staleHours * HOUR;
    out.idleHours = lastFillAt !== null ? (now - lastFillAt) / HOUR : null;
    // Asking far below the usual ask (or bidding far above the usual bid) gives money away.
    const usual = summary && summary.hours7 >= MIN_HOURS ? summary[sell ? "a" : "b"].med7 : null;
    const vs = versusUsual(price, usual);
    out.usual = usual;
    out.vsUsual = vs;
    out.generous = !!vs && (sell ? vs.label === "below" : vs.label === "above");
    return out;
}

// What in the inventory is worth selling. items: [{ hrid, level, count }];
// entryOf(hrid, level): the market file's { a, b }; summaryOf(hrid, level): price
// history; reserved: Map hrid -> why it is kept (slots, queue, train); keep: Set of
// "hrid#level" you pinned; listed(hrid, level): how many are already on your sell orders.
// Returns { rows, kept } – rows sorted by value, each with its advice.
export function sellSuggestions(items, { data, entryOf, summaryOf = () => null, reserved = new Map(), keep = new Set(), listed = () => 0, rules = MARKET_RULES }) {
    const rows = [];
    const kept = [];
    for (const { hrid, level = 0, count } of items) {
        const item = data.itemDetailMap[hrid];
        if (hrid === "/items/coin" || !item || !(count > 0)) continue;
        const key = keepKey(hrid, level);
        if (keep.has(key)) {
            kept.push({ hrid, level, count, why: "pinned" });
            continue;
        }
        if (reserved.has(hrid)) {
            kept.push({ hrid, level, count, why: reserved.get(hrid) });
            continue;
        }
        if (!item.isTradable) continue;
        const entry = entryOf(hrid, level) || {};
        const ask = entry.a > 0 ? entry.a : null;
        const bid = entry.b > 0 ? entry.b : null;
        if (!ask && !bid) continue;
        const summary = summaryOf(hrid, level);
        const history = summary && summary.hours7 >= MIN_HOURS;
        const usualAsk = history ? summary.a.med7 : null;
        const usualBid = history ? summary.b.med7 : null;
        // A listing is worth the ask, but never above the usual ask (or 1.5× the bid without history).
        const ceiling = usualAsk > 0 ? usualAsk : bid ? WIDE_SPREAD * bid : Infinity;
        const listPrice = ask ? Math.min(ask, ceiling) : usualAsk > 0 ? usualAsk : null;
        const net = (price) => (price ? price * count * (1 - MARKET_TAX) : 0);
        const spread = ask && bid ? (ask - bid) / ask : null;
        const how = !bid ? "list" : !listPrice ? "sell" : spread !== null && spread <= rules.quickSpread ? "sell" : "list";
        const sold = summary?.liquidity?.sold;
        const perDay = sold?.enough && sold.perDay > 0 ? sold.perDay : null;
        rows.push({
            hrid,
            level,
            count,
            ask,
            bid,
            listPrice,
            spread,
            how,
            nowValue: net(bid),
            listValue: net(listPrice),
            value: Math.max(net(bid), net(listPrice)),
            // Buyers paying well above their usual bid: a good moment. An ask well below usual: waiting may pay.
            bidVsUsual: versusUsual(bid, usualBid),
            askVsUsual: versusUsual(ask, usualAsk),
            perDay,
            daysToSell: perDay ? count / perDay : null,
            listed: listed(hrid, level),
            equipment: !!item.equipmentDetail,
            small: Math.max(net(bid), net(listPrice)) < rules.minValue,
        });
    }
    rows.sort((a, b) => b.value - a.value);
    return { rows, kept };
}

export const keepKey = (hrid, level = 0) => `${hrid}#${level}`;

// Items your setup uses, so they are never offered for sale: teas, food and drinks
// in any slot, what the queued actions use (materials, the item being enhanced or
// alchemised and its enhancing materials), and what a running train still needs.
export function reservedItems(character, items, data, trainActions = []) {
    const reserved = new Map();
    const add = (hrid, why) => hrid && !reserved.has(hrid) && reserved.set(hrid, why);
    for (const map of [character.actionTypeDrinkSlotsMap, character.actionTypeFoodSlotsMap]) {
        for (const slots of Object.values(map || {})) for (const slot of slots || []) add(slot?.itemHrid, "in your slots");
    }
    const byHash = new Map();
    for (const item of items.values()) if (item.hash) byHash.set(item.hash, item.itemHrid);
    const actionInputs = (actionHrid, why) => {
        const action = data.actionDetailMap?.[actionHrid];
        for (const input of action?.inputItems || []) add(input.itemHrid, why);
        add(action?.upgradeItemHrid, why);
    };
    for (const queued of character.characterActions || []) {
        actionInputs(queued.actionHrid, "for your queue");
        // Enhancing and alchemy name the item by its hash in the inventory.
        for (const hash of [queued.primaryItemHash, queued.secondaryItemHash]) {
            const hrid = byHash.get(hash) || (typeof hash === "string" ? hash.split("::")[2] : null);
            if (!hrid) continue;
            add(hrid, "for your queue");
            if (queued.actionHrid?.includes("enhanc")) for (const cost of data.itemDetailMap[hrid]?.enhancementCosts || []) add(cost.itemHrid, "for your queue");
        }
    }
    for (const actionHrid of trainActions) actionInputs(actionHrid, "for your train");
    return reserved;
}
