// Your own market orders as this device sees them, sent to your Pi (when it
// takes them, see pi/order-store.mjs) to judge the listing prices later: an
// event whenever an order is first seen or changes (filled more, done), and
// when it is gone from the game's full list without a word. An order placed
// within a quarter of an hour of a listing window for the same item, side and
// +level carries what that window's price buttons said. Every order counts,
// whether a button set its price or not.

import { listingDone, onStateChange } from "./game-state.js";

const SEEN_KEY = "mwia-order-seen"; // { id: { sig, at, done } }: each order as last seen
const QUEUE_KEY = "mwia-order-queue"; // events not yet on the Pi, oldest first
const DEVICE_KEY = "mwia-device";
// Events kept for the Pi while it can't be reached (the oldest go first).
export const MAX_QUEUE = 500;
// A listing window counts for an order placed this soon after it.
export const PREDICTION_MS = 15 * 60 * 1000;
// Finished orders are remembered this long, so they are not reported again.
const DONE_KEEP_MS = 30 * 24 * 3600 * 1000;

const o = { shown: new Map(), listeners: new Set() };

// The order as the Pi keeps it, and the game's own fields (only plain values) for anything else.
function normalize(listing) {
    const raw = {};
    for (const [key, value] of Object.entries(listing)) if (value === null || ["string", "number", "boolean"].includes(typeof value)) raw[key] = value;
    const order = {
        id: listing.id,
        item: listing.itemHrid,
        level: Number(listing.enhancementLevel) || 0,
        side: listing.isSell ? "sell" : "buy",
        price: Number(listing.price) || 0,
        quantity: Number(listing.orderQuantity) || 0,
        filled: Number(listing.filledQuantity) || 0,
        status: listing.status ?? null,
        done: listingDone(listing),
    };
    return { order, raw };
}

const signature = (order) => `${order.filled}|${order.status}|${order.done}`;
const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => b.toString(16).padStart(2, "0")).join("");

// The events for listings from the game. listings: the full list (full: true)
// or the ones that changed; seen: as returned last time. predictionFor(order):
// what a listing window said, or null. Returns { events, seen }.
export function orderEvents(listings, seen = {}, { full = false, now = Date.now(), predictionFor = () => null, newId = randomId } = {}) {
    const next = { ...seen };
    const events = [];
    const present = new Set();
    for (const listing of listings || []) {
        if (!listing || listing.id === undefined || listing.id === null) continue;
        const { order, raw } = normalize(listing);
        present.add(String(order.id));
        const before = next[order.id];
        const sig = signature(order);
        if (before?.sig === sig) continue;
        const event = { uid: newId(), at: now, kind: "seen", order, raw };
        if (!before) {
            const prediction = predictionFor(order);
            if (prediction) event.prediction = prediction;
        }
        events.push(event);
        next[order.id] = { sig, at: now, done: order.done, order: order.done ? undefined : order };
    }
    for (const [id, entry] of Object.entries(next)) {
        // Gone from the full list while still open: how it ended isn't known.
        if (full && !entry.done && !present.has(id)) {
            events.push({ uid: newId(), at: now, kind: "gone", order: entry.order ?? { id } });
            next[id] = { sig: "gone", at: now, done: true };
        }
        if (next[id].done && now - next[id].at > DONE_KEEP_MS) delete next[id];
    }
    return { events, seen: next };
}

// What a listing window's buttons said, kept for an order placed soon after (from listing-price-ui.js).
export function notePrediction(snapshot, now = Date.now()) {
    o.shown.set(`${snapshot.side}|${snapshot.item}|${snapshot.level}`, { ...snapshot, shownAt: now });
}

function predictionFor(order, now = Date.now()) {
    const shown = o.shown.get(`${order.side}|${order.item}|${order.level}`);
    return shown && now - shown.shownAt <= PREDICTION_MS ? shown : null;
}

const readJson = (key, fallback) => {
    try {
        return JSON.parse(localStorage.getItem(key) || "null") ?? fallback;
    } catch {
        return fallback;
    }
};
const writeJson = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // kept in memory until the next change
    }
};

// This device, as the Pi tells the devices apart: a random id and what kind of device it is.
export function deviceName() {
    let id = readJson(DEVICE_KEY, null);
    if (!id) writeJson(DEVICE_KEY, (id = randomId()));
    const kind = /iPhone|iPad|Android|Windows|Mac|Linux/.exec(navigator.userAgent)?.[0] || "other";
    return `${id} ${kind}`;
}

// The events waiting for the Pi; sent: drop those (by uid) once the Pi has them.
export const queuedOrders = () => readJson(QUEUE_KEY, []);
export function dropQueued(uids) {
    const sent = new Set(uids);
    writeJson(QUEUE_KEY, queuedOrders().filter((event) => !sent.has(event.uid)));
}

// Called when new events are queued.
export function onOrderEvents(listener) {
    o.listeners.add(listener);
}

function observe(listings, full) {
    const { events, seen } = orderEvents(listings, readJson(SEEN_KEY, {}), { full, predictionFor });
    writeJson(SEEN_KEY, seen);
    if (!events.length) return;
    writeJson(QUEUE_KEY, [...queuedOrders(), ...events].slice(-MAX_QUEUE));
    for (const listener of o.listeners) listener(events.length);
}

export function startOrderLog() {
    onStateChange((type, data) => {
        try {
            if (type === "init_character_data") observe(data.myMarketListings || [], true);
            else if (type === "market_listings_updated") {
                const full = data.myMarketListings ?? data.marketListings;
                observe(Array.isArray(full) ? full : data.endMarketListings || [], Array.isArray(full));
            }
        } catch (error) {
            console.warn("[MWI Advisor] order log", error);
        }
    });
}
