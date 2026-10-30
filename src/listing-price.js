// Prices to offer when listing an item on the market: matching the best offer,
// just in front of the next wall in the order book, or the best price that
// sells within 1, 8 or 24 hours (buys, for a buy listing) – worked out from the
// order book, the week's hourly prices and how many buyers take an hour. Pure:
// the window in the game is in listing-price-ui.js.

import { MIN_HOURS, SPIKE, median, quantile } from "./price-history.js";

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

// The horizons: by then, a CONFIDENCE chance that at least FILLED of the quantity has gone.
export const HORIZONS = [1, 8, 24];
export const CONFIDENCE = 0.7;
export const FILLED = 0.7;
// A past stretch of H hours counts when at least this share of its hours has prices…
export const COVERAGE = 0.5;
// …and a horizon needs at least this many such stretches to say anything.
export const MIN_WINDOWS = 12;
// Being first in line now sells at once only at a price buyers have paid lately:
// not above this quantile of the week's lowest asks (not below 1 − it of its best bids).
export const USUAL_TOP = 0.9;

// How many an hour are taken from the sell listings (side "sell") or the buy
// listings ("buy"), from the week's hours: { hours, perHour }, or null with too
// few hours. The file's v counts every trade of the hour; its average price p
// tells which side they hit – near the ask, buyers took sell listings; near the
// bid, sellers filled buy listings. Hours are capped as in soldPerDay.
export function takenPerHour(hours, side = "sell") {
    const sold = hours.filter((r) => r.sold);
    if (sold.length < MIN_HOURS) return null;
    const count = (r) => (Number.isFinite(r.v) ? r.v : 0);
    const cap = SPIKE * (median(sold.filter((r) => count(r) > 0).map((r) => [count(r), 1])) ?? 0);
    let taken = 0;
    for (const r of sold) {
        const askShare = r.a > r.b && Number.isFinite(r.p) ? Math.min(1, Math.max(0, (r.p - r.b) / (r.a - r.b))) : 0.5;
        taken += Math.min(count(r), cap) * (side === "sell" ? askShare : 1 - askShare);
    }
    return { hours: sold.length, perHour: taken / sold.length };
}

// The highest price (lowest, when buying) at which, in the past stretches of
// `horizon` hours, at least FILLED of `quantity` would have gone in CONFIDENCE
// of them. A stretch counts the hours a listing at that price would have been
// first in line – nobody else's best offer better than it; level with it, half
// an hour – and it sells when those hours times what is taken an hour cover
// FILLED of the quantity. A price better than everyone's now (best: the best
// of others' offers) is first in line in the first hour too – if it is within
// the week's usual prices (USUAL_TOP): above them, buyers may simply wait.
// hours: recentHours(…), oldest first. Returns { price, under (one step past
// best), chance, windows, need (hours first in line it takes) } or { price: null, why }.
export function horizonPrice({ side, hours, horizon, quantity = 1, best = null, levels = [], range = null, taken = null }) {
    const sell = side === "sell";
    const key = sell ? "a" : "b";
    const need = taken?.perHour > 0 ? (FILLED * quantity) / taken.perHour : 0;
    if (need > horizon) return { price: null, why: "quantity", need };
    const byHour = new Map(hours.map((r) => [r.hour, r[key]]));
    const newest = hours.length ? hours[hours.length - 1].hour : 0;
    const starts = hours.filter((r) => r.hour + horizon <= newest).map((r) => r.hour);
    // Each stretch: for every hour with prices, the others' best then (NaN: nobody).
    const windows = [];
    for (const start of starts) {
        const seen = [];
        for (let k = 1; k <= horizon; k++) if (byHour.has(start + k)) seen.push([k, byHour.get(start + k)]);
        if (seen.length >= Math.max(1, COVERAGE * horizon)) windows.push(seen);
    }
    if (windows.length < MIN_WINDOWS) return { price: null, why: "history", windows: windows.length };
    const better = (x, y) => (sell ? x < y : x > y);
    const inRange = (price) => !range || (price >= range.min && price <= range.max);
    // Candidates: one step past the best offer, and every price seen in the week or the book.
    const prices = new Set([...hours.map((r) => r[key]), ...levels.map((level) => level.price)].filter((p) => p > 0 && inRange(p)));
    // One step past the best, as far as the known prices tell the step: their smallest gap.
    const sorted = [...prices].sort((x, y) => x - y);
    const gap = Math.min(...sorted.slice(1).map((price, i) => price - sorted[i]));
    const past = best > 0 && Number.isFinite(gap) ? (sell ? best - gap : best + gap) : best;
    const candidates = [...prices].map((price) => ({ price, under: false }));
    if (best > 0 && inRange(past)) candidates.push({ price: best, under: true });
    // Best price for you first: the first that sells often enough is the answer.
    const rank = (c) => (sell ? c.price - (c.under ? 0.5 : 0) : -(c.price + (c.under ? 0.5 : 0)));
    candidates.sort((x, y) => rank(y) - rank(x));
    const top = quantile(hours.map((r) => [r[key], 1]), sell ? USUAL_TOP : 1 - USUAL_TOP);
    const usual = (price) => top === null || !better(top, price);
    for (const c of candidates) {
        const firstNow = best > 0 && (c.under ? usual(past) : better(c.price, best) && usual(c.price));
        let sold = 0;
        for (const seen of windows) {
            let front = 0;
            for (const [k, other] of seen) {
                const value = !Number.isFinite(other) ? 1 : c.under ? (better(other, c.price) ? 0 : 1) : better(other, c.price) ? 0 : other === c.price ? 0.5 : 1;
                front += firstNow && k === 1 ? 1 : value;
            }
            front *= horizon / seen.length;
            if (firstNow && seen[0][0] !== 1) front = Math.min(horizon, front + 1);
            if (front > 0 && front >= need) sold++;
        }
        const chance = sold / windows.length;
        if (chance >= CONFIDENCE) return { price: c.price, under: c.under, chance, windows: windows.length, need };
    }
    return { price: null, why: "none", windows: windows.length, need };
}

// The suggestions for a listing window. side: "sell" | "buy"; book: { asks, bids } or null;
// own: your listings on that side [{ price, quantity }]; best: the best offer the game shows;
// range: { min, max } (the tradable range) or null; summary: the item's price summary or null;
// hours: the item's recent hours (recentHours) and quantity: how many you list, for the horizons.
// Each suggestion: { kind, price (null: none – see why), step (-1/+1: one price step past
// price), capped ("min"/"max" when the range cuts it), ... }.
export function listingPrices({ side, book = null, own = [], best = null, range = null, summary = null, hours = [], quantity = 1 }) {
    const sell = side === "sell";
    const levels = otherLevels(book ? (sell ? book.asks : book.bids) : [], own, range, side);
    const clamp = (price) => {
        if (range && price > range.max) return { price: range.max, capped: "max" };
        if (range && price < range.min) return { price: range.min, capped: "min" };
        return { price, capped: null };
    };
    const out = [];
    if (best > 0) out.push({ kind: "match", ...clamp(best), step: 0 });
    const wall = findWall(levels);
    if (wall) out.push({ kind: "wall", price: wall.price, capped: null, step: sell ? -1 : 1, wall });
    // Others' best: from the book without your own listings, else the window's.
    const othersBest = book ? (levels[0]?.price ?? null) : best;
    const taken = takenPerHour(hours, side);
    for (const horizon of HORIZONS) {
        const h = horizonPrice({ side, hours, horizon, quantity, best: othersBest, levels, range, taken });
        out.push({ kind: "horizon", horizon, ...h, capped: null, step: h.under ? (sell ? -1 : 1) : 0 });
    }
    const history = summary && summary.hours7 >= MIN_HOURS ? summary[sell ? "a" : "b"] : null;
    return { levels, suggestions: out, usual: history?.med7 ?? null, hours: summary?.hours7 ?? 0, taken, quantity };
}
