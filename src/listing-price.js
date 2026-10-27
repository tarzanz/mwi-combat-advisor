// Prices to offer when listing an item on the market: matching the best offer,
// just in front of the next wall in the order book, the week's usual price, or
// a patient one (the upper quartile of the week's asks when selling, the lower
// quartile of its bids when buying). Pure: the window in the game is in
// listing-price-ui.js.

import { MIN_HOURS } from "./price-history.js";

// A price level holding at least this share of everything others have listed
// on that side (within the tradable range) is a wall worth stopping in front of.
export const WALL_SHARE = 0.2;

// Others' price levels on one side, best first: your own listings taken out,
// and only what lies within the tradable range.
export function otherLevels(levels, own = [], range = null, side = "sell") {
    const mine = new Map();
    for (const listing of own) mine.set(listing.price, (mine.get(listing.price) || 0) + listing.quantity);
    return levels
        .map((level) => ({ price: level.price, quantity: level.quantity - (mine.get(level.price) || 0) }))
        .filter((level) => level.quantity > 0 && (!range || (level.price >= range.min && level.price <= range.max)))
        .sort((a, b) => (side === "sell" ? a.price - b.price : b.price - a.price));
}

// The first level holding WALL_SHARE of all, with what lies in front of it.
export function findWall(levels) {
    const total = levels.reduce((sum, level) => sum + level.quantity, 0);
    let ahead = 0;
    for (const level of levels) {
        if (total > 0 && level.quantity >= WALL_SHARE * total) return { price: level.price, quantity: level.quantity, ahead, total };
        ahead += level.quantity;
    }
    return null;
}

// Where a price stands among others' levels: how many are offered at a better
// price (cheaper when selling, higher when buying) and how many at the same.
export function standing(price, levels, side = "sell") {
    let better = 0;
    let same = 0;
    for (const level of levels) {
        if (level.price === price) same += level.quantity;
        else if (side === "sell" ? level.price < price : level.price > price) better += level.quantity;
    }
    return { better, same };
}

// The suggestions for a listing window. side: "sell" | "buy"; book: { asks, bids } or null;
// own: your listings on that side [{ price, quantity }]; best: the best offer the game shows;
// range: { min, max } (the tradable range) or null; summary: the item's price summary or null.
// Each suggestion: { kind, price, step (-1/+1: one price step past price), snap (a price
// from the history, not necessarily a valid step), capped ("min"/"max" when the range
// cuts it), ... }.
export function listingPrices({ side, book = null, own = [], best = null, range = null, summary = null }) {
    const sell = side === "sell";
    const levels = otherLevels(book ? (sell ? book.asks : book.bids) : [], own, range, side);
    const clamp = (price) => {
        if (range && price > range.max) return { price: range.max, capped: "max" };
        if (range && price < range.min) return { price: range.min, capped: "min" };
        return { price, capped: null };
    };
    const out = [];
    if (best > 0) out.push({ kind: "match", ...clamp(best), step: 0, snap: false });
    const wall = findWall(levels);
    if (wall) out.push({ kind: "wall", price: wall.price, capped: null, step: sell ? -1 : 1, snap: false, wall });
    const history = summary && summary.hours7 >= MIN_HOURS ? summary[sell ? "a" : "b"] : null;
    if (history?.med7 > 0) out.push({ kind: "usual", ...clamp(history.med7), step: 0, snap: true });
    const patient = sell ? history?.q75 : history?.q25;
    if (patient > 0) out.push({ kind: "patient", ...clamp(patient), step: 0, snap: true });
    return { levels, suggestions: out, usual: history?.med7 ?? null, hours: summary?.hours7 ?? 0 };
}
