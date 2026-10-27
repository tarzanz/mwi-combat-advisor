// Prices for a listing: match, wall, usual and patient, and where a price stands.

import { findWall, listingPrices, otherLevels, standing } from "../src/listing-price.js";
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
const kinds = Object.fromEntries(sell.suggestions.map((s) => [s.kind, s]));
check("sell: match, wall, usual, patient", kinds.match.price === 1096 && kinds.wall.price === 1140 && kinds.wall.step === -1 && kinds.usual.price === 1150 && kinds.usual.snap, JSON.stringify(sell.suggestions));
check("sell: patient capped at the range's max", kinds.patient.price === 1205 && kinds.patient.capped === "max");
const buy = listingPrices({ side: "buy", book: { asks, bids }, best: 1040, range, summary });
const bk = Object.fromEntries(buy.suggestions.map((s) => [s.kind, s]));
check("buy: wall one step over, patient the lower quartile", bk.wall.price === 1000 && bk.wall.step === 1 && bk.patient.price === 984 && bk.patient.capped === "min" && bk.usual.price === 990, JSON.stringify(buy.suggestions));
const fresh = listingPrices({ side: "sell", book: null, best: 1096, range, summary: { hours7: 5, a: { med7: 1150, q75: 1250 } } });
check("without history or book: only match", fresh.suggestions.length === 1 && fresh.suggestions[0].kind === "match" && fresh.usual === null);

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
