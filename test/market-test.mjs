// The Market tab's rules: when an order sits behind a wall, when it is stale,
// what in the inventory is offered for sale and how.
import { MARKET_RULES, keepKey, listingStatus, reservedItems, sellSuggestions, trackFills } from "../src/market.js";

let failures = 0;
const check = (name, ok, detail = "") => {
    console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
    if (!ok) failures++;
};

const HOUR = 3600e3;
const now = Date.UTC(2026, 9, 28, 12);
const sellOrder = { id: 1, itemHrid: "/items/x", isSell: true, price: 100, orderQuantity: 50, filledQuantity: 0 };
const book = (asks, bids = [], at = now - HOUR) => ({ at, asks, bids, range: null });
const summary = (perDay, usual = { a: 100, b: 90 }) => ({ hours7: 48, a: { med7: usual.a }, b: { med7: usual.b }, liquidity: { sold: { enough: perDay !== null, perDay } } });

// With an order book.
{
    const front = listingStatus(sellOrder, { book: book([{ price: 100, quantity: 50 }, { price: 110, quantity: 500 }]), own: [{ price: 100, quantity: 50 }], now });
    check("own listing taken out of the book: first in line", front.kind === "front" && !front.alert, front.kind);
    const tied = listingStatus(sellOrder, { book: book([{ price: 100, quantity: 80 }, { price: 110, quantity: 500 }]), own: [{ price: 100, quantity: 50 }], now });
    check("others at the same price: tied", tied.kind === "tied" && !tied.alert, tied.kind);
    const few = listingStatus(sellOrder, { book: book([{ price: 95, quantity: 10 }, { price: 110, quantity: 990 }]), own: [{ price: 100, quantity: 50 }], now });
    check("a few cheaper (1% of the offer): behind, no alert", few.kind === "behind" && !few.alert && few.better === 10, `${few.kind} share ${few.share}`);
    const wall = listingStatus(sellOrder, { book: book([{ price: 95, quantity: 300 }, { price: 110, quantity: 700 }]), own: [{ price: 100, quantity: 50 }], now });
    check("30% of the offer cheaper: wall and alert", wall.kind === "wall" && wall.alert && Math.abs(wall.share - 0.3) < 1e-9, `${wall.kind} ${wall.share}`);
    const slow = listingStatus(sellOrder, { book: book([{ price: 95, quantity: 100 }, { price: 110, quantity: 900 }]), own: [{ price: 100, quantity: 50 }], summary: summary(40), now });
    check("10% cheaper but 2.5 days of sales: wall", slow.kind === "wall" && slow.alert && Math.abs(slow.daysAhead - 2.5) < 1e-9, `${slow.daysAhead}`);
    const quick = listingStatus(sellOrder, { book: book([{ price: 95, quantity: 100 }, { price: 110, quantity: 900 }]), own: [{ price: 100, quantity: 50 }], summary: summary(1000), now });
    check("10% cheaper, sold within hours: no alert", quick.kind === "behind" && !quick.alert, `${quick.daysAhead}`);
    // A thin book: 37 of 98 cheaper is a big share, but they sell within the hour.
    const thin = listingStatus(sellOrder, { book: book([{ price: 78, quantity: 37 }, { price: 100, quantity: 320 }, { price: 101, quantity: 38 }, { price: 102, quantity: 23 }]), own: [{ price: 100, quantity: 320 }], summary: summary(1737), now });
    check("38% of a thin book cheaper but sold within the hour: no alert", thin.kind === "behind" && !thin.alert && thin.share > 0.3, `${thin.kind} share ${thin.share} days ${thin.daysAhead}`);
    const old = listingStatus(sellOrder, { book: book([{ price: 95, quantity: 900 }], [], now - (MARKET_RULES.bookHours + 1) * HOUR), entry: { a: 99 }, own: [{ price: 100, quantity: 50 }], now });
    check("an old order book is not used", !old.fromBook && old.kind === "cheaper" && !old.alert, `${old.kind} gap ${old.gap}`);
}

// Without an order book: only the best price from the file.
{
    const front = listingStatus(sellOrder, { entry: { a: 100, b: 90 }, now });
    check("file: best ask is yours (or equal): front", front.kind === "front");
    const small = listingStatus(sellOrder, { entry: { a: 97, b: 90 }, now });
    check("file: 3% cheaper exists: warn, no alert", small.kind === "cheaper" && !small.alert && Math.abs(small.gap - 0.03) < 1e-9);
    const big = listingStatus(sellOrder, { entry: { a: 85, b: 80 }, now });
    check("file: 15% cheaper exists: alert", big.kind === "cheaper" && big.alert);
}

// Buy orders: higher bids come first.
{
    const buy = { id: 2, itemHrid: "/items/x", isSell: false, price: 90, orderQuantity: 100, filledQuantity: 20 };
    const s = listingStatus(buy, { book: book([], [{ price: 95, quantity: 400 }, { price: 90, quantity: 100 }, { price: 80, quantity: 500 }]), own: [{ price: 90, quantity: 80 }], now });
    check("buy order: higher bids are ahead", s.kind === "wall" && s.better === 400 && s.left === 80, `${s.kind} ${s.better}`);
    const top = listingStatus(buy, { entry: { a: 100, b: 90 }, now });
    check("buy order: best bid equals yours: front", top.kind === "front");
    const generous = listingStatus({ ...buy, price: 105 }, { entry: { a: 110, b: 105 }, summary: summary(null, { a: 100, b: 90 }), now });
    check("buy order far above the usual bid is flagged", generous.generous);
    const cheap = listingStatus({ ...sellOrder, price: 80 }, { entry: { a: 80 }, summary: summary(null), now });
    check("sell order far below the usual ask is flagged", cheap.generous);
}

// Stale: no fill for 12 h.
{
    let store = trackFills([sellOrder], {}, now - 13 * HOUR);
    store = trackFills([sellOrder], store, now);
    const stale = listingStatus(sellOrder, { entry: { a: 100 }, lastFillAt: store[1].at, now });
    check("no sale for 13 h: stale", stale.stale && Math.round(stale.idleHours) === 13);
    store = trackFills([{ ...sellOrder, filledQuantity: 5 }], store, now);
    check("a sale resets the clock", store[1].at === now && store[1].filled === 5);
    const placed = trackFills([{ ...sellOrder, id: 3, createdTimestamp: new Date(now - 20 * HOUR).toISOString() }], {}, now);
    check("the game's placing time counts from when it was placed", placed[3].at === now - 20 * HOUR);
    check("closed orders are dropped", !(1 in trackFills([], store, now)));
}

// Inventory: what to sell and how.
{
    const data = {
        itemDetailMap: {
            "/items/a": { isTradable: true },
            "/items/b": { isTradable: true },
            "/items/tea": { isTradable: true },
            "/items/pin": { isTradable: true },
            "/items/bound": { isTradable: false },
            "/items/sword": { isTradable: true, equipmentDetail: {} },
            "/items/milk": { isTradable: true },
            "/items/bar": { isTradable: true, enhancementCosts: [{ itemHrid: "/items/milk", count: 1 }] },
        },
        actionDetailMap: { "/actions/cheesesmithing/x": { inputItems: [{ itemHrid: "/items/milk", count: 2 }], upgradeItemHrid: "/items/b" } },
    };
    const market = {
        "/items/a": { a: 1000, b: 990 }, // tight: sell now
        "/items/b": { a: 2000, b: 1000 }, // wide: list
        "/items/tea": { a: 100, b: 90 },
        "/items/pin": { a: 100, b: 90 },
        "/items/bound": { a: 100, b: 90 },
        "/items/sword": { a: 50000, b: 40000 },
        "/items/milk": { a: 10, b: 9 },
    };
    const items = [
        { hrid: "/items/coin", count: 1e6 },
        { hrid: "/items/a", count: 100 },
        { hrid: "/items/b", count: 3 },
        { hrid: "/items/tea", count: 50 },
        { hrid: "/items/pin", count: 500 },
        { hrid: "/items/bound", count: 5 },
        { hrid: "/items/sword", count: 1, level: 2 },
        { hrid: "/items/milk", count: 1000 },
    ];
    const character = { actionTypeDrinkSlotsMap: { "/action_types/milking": [{ itemHrid: "/items/tea" }, null] }, characterActions: [{ actionHrid: "/actions/cheesesmithing/x" }] };
    const reserved = reservedItems(character, new Map(), data);
    check("reserved: teas in slots and the queue's materials", reserved.get("/items/tea") === "in your slots" && reserved.get("/items/milk") === "for your queue" && reserved.get("/items/b") === "for your queue");
    const { rows, kept } = sellSuggestions(items, { data, entryOf: (hrid, level) => (level ? { a: 60000, b: 45000 } : market[hrid]), reserved: new Map([["/items/tea", "in your slots"]]), keep: new Set([keepKey("/items/pin")]) });
    const row = (hrid) => rows.find((r) => r.hrid === hrid);
    check("coins, untradable, pinned and reserved items are not offered", !row("/items/coin") && !row("/items/bound") && !row("/items/pin") && !row("/items/tea"));
    check("pinned and reserved are listed as kept", kept.some((k) => k.hrid === "/items/pin" && k.why === "pinned") && kept.some((k) => k.hrid === "/items/tea"));
    check("tight spread: sell now", row("/items/a").how === "sell" && Math.round(row("/items/a").nowValue) === Math.round(990 * 100 * 0.96));
    check("wide spread: list, capped at 1.5× the bid without history", row("/items/b").how === "list" && row("/items/b").listPrice === 1500, `${row("/items/b").listPrice}`);
    check("+level items use their own prices and are marked as equipment", row("/items/sword").level === 2 && row("/items/sword").bid === 45000 && row("/items/sword").equipment);
    check("rows sorted by value", rows.every((r, i) => i === 0 || rows[i - 1].value >= r.value));
    check("small amounts are marked", row("/items/b").small === true && row("/items/a").small === false);
    const withHistory = sellSuggestions([{ hrid: "/items/b", count: 3 }], { data, entryOf: (hrid) => market[hrid], summaryOf: () => summary(1, { a: 1200, b: 800 }) }).rows[0];
    check("with history: listed at most at the usual ask; above-usual bids are a good moment", withHistory.listPrice === 1200 && withHistory.bidVsUsual.label === "above" && withHistory.daysToSell === 3);
}

console.log(failures ? `${failures} FAILED` : "All checks passed");
process.exitCode = failures ? 1 : 0;
