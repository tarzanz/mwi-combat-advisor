// Your market orders as events for the Pi: first seen, filled more, done,
// gone without a word; and what the listing window said, on a new order.

import { orderEvents } from "../src/order-log.js";

let failures = 0;
const check = (name, ok, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`);
};

let n = 0;
const newId = () => `u${++n}`;
const listing = (id, filled, extra = {}) => ({ id, itemHrid: "/items/beast_leather", enhancementLevel: 0, isSell: true, price: 2224, orderQuantity: 1316, filledQuantity: filled, status: "/market_order_status/active", createdTimestamp: "2026-10-30T06:34:00Z", nested: { skip: true }, ...extra });
const shown = { side: "sell", item: "/items/beast_leather", level: 0, quantity: 1316, buttons: [{ h: 1, price: 2232, under: true }] };

const first = orderEvents([listing(1, 0), listing(2, 5, { isSell: false, itemHrid: "/items/cheese" })], {}, { full: true, now: 1000, newId, predictionFor: (order) => (order.item === shown.item ? shown : null) });
const [e1, e2] = first.events;
check("every order on first sight", first.events.length === 2 && e1.kind === "seen" && e1.order.side === "sell" && e1.order.filled === 0 && e2.order.side === "buy" && e1.at === 1000);
check("the game's own plain fields go along", e1.raw.createdTimestamp === "2026-10-30T06:34:00Z" && e1.raw.status === "/market_order_status/active" && !("nested" in e1.raw), JSON.stringify(e1.raw));
check("a new order carries what the window said", e1.prediction === shown && !e2.prediction);

const same = orderEvents([listing(1, 0)], first.seen, { now: 2000, newId, predictionFor: () => shown });
check("nothing changed: no event", same.events.length === 0);
const filled = orderEvents([listing(1, 600)], same.seen, { now: 3000, newId, predictionFor: () => shown });
check("filled more: an event, without the window again", filled.events.length === 1 && filled.events[0].order.filled === 600 && !filled.events[0].prediction);
// Filled, the order stays until its coins are collected; collected (or cancelled), it is done.
const done = orderEvents([listing(1, 1316, { status: "/market_order_status/cancelled" })], filled.seen, { now: 4000, newId });
check("done: an event, and remembered as done", done.events.length === 1 && done.events[0].order.done && done.seen[1].done, JSON.stringify(done.events[0]?.order));
const doneAgain = orderEvents([listing(1, 1316, { status: "/market_order_status/cancelled" })], done.seen, { full: true, now: 5000, newId });
check("a done order seen again: no event; the open one missing from the full list: gone", doneAgain.events.length === 1 && doneAgain.events[0].kind === "gone" && doneAgain.events[0].order.id === 2 && doneAgain.events[0].order.item === "/items/cheese", JSON.stringify(doneAgain.events));
const changedOnly = orderEvents([listing(3, 0)], doneAgain.seen, { full: false, now: 6000, newId });
check("only the changed ones: nothing counts as gone", changedOnly.events.length === 1 && changedOnly.events[0].order.id === 3);
const later = orderEvents([], changedOnly.seen, { now: 6000 + 31 * 24 * 3600 * 1000, newId });
check("finished orders are forgotten after a month", !later.seen[1] && !later.seen[2] && later.seen[3]);
check("every event has its own id", new Set([...first.events, ...filled.events, ...done.events, ...doneAgain.events].map((e) => e.uid)).size === 5);

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
