// Prices for a listing: match, wall and the 1/8/24-hour prices, and where a price stands.

import { FILLED, HORIZONS, findWall, horizonPrice, listingPrices, otherLevels, standing, takenPerHour } from "../src/listing-price.js";
import { quantile } from "../src/price-history.js";

let failures = 0;
const check = (name, ok, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`);
};

check("quantiles of the week", quantile([[1, 1], [2, 1], [3, 1], [4, 1]], 0.25) === 1 && quantile([[1, 1], [2, 1], [3, 1], [4, 1]], 0.75) === 3 && quantile([], 0.5) === null);

// The order book from the screenshot: 9,552 / 6,082 / 22,886 / 90,000 / 25 listed.
const asks = [{ price: 1096, quantity: 9552 }, { price: 1100, quantity: 6082 }, { price: 1120, quantity: 22886 }, { price: 1140, quantity: 90000 }, { price: 1300, quantity: 25 }];
const bids = [{ price: 1040, quantity: 500 }, { price: 1000, quantity: 10000 }, { price: 800, quantity: 10000 }];
const range = { min: 984, max: 1205 };
const levels = otherLevels(asks, [{ price: 1100, quantity: 82 }], range, "sell");
check("others' levels: own listings out, outside the range dropped", levels.length === 4 && levels[1].quantity === 6000 && !levels.some((l) => l.price === 1300), JSON.stringify(levels));
const wall = findWall(levels);
check("the wall is the first level with a fifth of all", wall.price === 1140 && wall.ahead === 9552 + 6000 + 22886, JSON.stringify(wall));
check("standing: cheaper and at the same price", JSON.stringify(standing(1120, levels, "sell")) === JSON.stringify({ better: 15552, same: 22886 }));

const summary = { hours7: 40, a: { med7: 1150, q75: 1250 }, b: { med7: 990, q25: 950 } };
const sell = listingPrices({ side: "sell", book: { asks, bids }, own: [], best: 1096, range, summary });
const kinds = Object.fromEntries(sell.suggestions.map((s) => [s.kind === "horizon" ? `h${s.horizon}` : s.kind, s]));
check("sell: match, wall and the horizons", kinds.match.price === 1096 && kinds.wall.price === 1140 && kinds.wall.step === -1 && sell.usual === 1150, JSON.stringify(sell.suggestions));
check("no hours: the horizons ask for history", HORIZONS.every((h) => kinds[`h${h}`].price === null && kinds[`h${h}`].why === "history"), JSON.stringify(sell.suggestions));
const buy = listingPrices({ side: "buy", book: { asks, bids }, best: 1040, range, summary });
const bk = Object.fromEntries(buy.suggestions.map((s) => [s.kind, s]));
check("buy: wall one step over", bk.wall.price === 1000 && bk.wall.step === 1 && buy.usual === 990, JSON.stringify(buy.suggestions));
const fresh = listingPrices({ side: "sell", book: null, best: 1096, range, summary: { hours7: 5, a: { med7: 1150, q75: 1250 } } });
check("without history or book: match, and horizons without a price", fresh.suggestions[0].kind === "match" && fresh.suggestions.filter((s) => s.price !== null).length === 1 && fresh.usual === null);

// A week of hours: the lowest ask 100, every fourth hour 104; the best bid 90, every fourth hour 86.
// 200 trade an hour at 98: 80% of them at the ask (98 lies 0.8 of the way from 90 to 100),
// in the fourth hours two thirds (from 86 to 104): 153⅓ an hour from the sell listings.
const week = (opts = {}) => Array.from({ length: 7 * 24 }, (_, hour) => ({ hour, a: hour % 4 === 3 ? 104 : 100, b: hour % 4 === 3 ? 86 : 90, p: 98, v: 200, sold: true, ...(opts.at?.(hour) || {}) }));
const hours = week();
const taken = takenPerHour(hours, "sell");
check("taken an hour: the trades' share at the ask", Math.abs(taken.perHour - 460 / 3) < 1e-9 && Math.abs(takenPerHour(hours, "buy").perHour - 140 / 3) < 1e-9, JSON.stringify(taken));
const spiky = week({ at: (hour) => (hour === 5 ? { v: 100000 } : null) });
check("taken an hour: a huge hour is capped", Math.abs(takenPerHour(spiky, "sell").perHour - (460 / 3 + (600 - 200) * 0.8 / 168)) < 1e-9, String(takenPerHour(spiky, "sell").perHour));
check("taken an hour: too few hours say nothing", takenPerHour(hours.slice(0, 5), "sell") === null);
const at = (horizon, opts = {}) => horizonPrice({ side: "sell", hours, horizon, quantity: 10, best: 104, taken, ...opts });
const h1 = at(1);
check("<1h: one step under the best offer, first in line now", h1.price === 104 && h1.under && h1.chance === 1, JSON.stringify(h1));
const h8 = at(8);
check("<8h: the best offer itself, reached in every 8 hours", h8.price === 104 && !h8.under && h8.chance === 1, JSON.stringify(h8));
check("a price never reached is never suggested", at(24, { levels: [{ price: 108, quantity: 5 }] }).price === 104);
const many = at(1, { quantity: 1000 });
check("too many to go in time: no price, and why", many.price === null && many.why === "quantity" && Math.abs(many.need - (1000 * FILLED) / taken.perHour) < 1e-9, JSON.stringify(many));
check("…but 8 hours of first in line at 104 is too much: 100 is", at(8, { quantity: 800 }).price === 100, JSON.stringify(at(8, { quantity: 800 })));
const odd = at(1, { best: 130 });
check("a best offer far above the week's: first in line at the week's price, not just under it", odd.price === 104 && !odd.under, JSON.stringify(odd));
check("the tradable range limits the candidates", at(1, { range: { min: 50, max: 99 } }).price === null && at(8, { range: { min: 50, max: 101 } }).price === 100, JSON.stringify(at(8, { range: { min: 50, max: 101 } })));
const gappy = hours.filter((r) => r.hour % 2 === 0);
check("hours with gaps: a stretch needs half its hours", horizonPrice({ side: "sell", hours: gappy, horizon: 1, best: 104 }).why === "history" && horizonPrice({ side: "sell", hours: gappy, horizon: 8, best: 104 }).price !== null);
const bidAt = (horizon) => horizonPrice({ side: "buy", hours, horizon, quantity: 10, best: 90, taken: takenPerHour(hours, "buy") });
check("buy: the bid's dips are reached within 8 hours, not 1", bidAt(1).price === 90 && bidAt(8).price === 86, JSON.stringify([bidAt(1), bidAt(8)]));

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
