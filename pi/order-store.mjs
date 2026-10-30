// Your own market orders as your devices saw them, for judging the listing
// prices later: one JSON line per event in data/orders/<month>.jsonl (UTC), as
// the device sent it plus when it arrived. An event says what an order looked
// like when it was first seen or changed (filled more, done), or that it was
// gone when the device next looked; the first one of an order placed from a
// listing window carries what the price buttons said then. Every device sends
// its own; an event sent twice (an answer lost on the way) is kept once.

import { appendFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// One event at most this long as JSON, and this many in one request.
export const MAX_EVENT_BYTES = 16 * 1024;
export const MAX_EVENTS = 500;

const MONTH_FILE = /^\d{4}-\d\d\.jsonl$/;

export function openOrderStore(dataDir) {
    const dir = path.join(dataDir, "orders");
    mkdirSync(dir, { recursive: true });
    const uids = new Set();
    let count = 0;
    let newest = null;
    for (const file of readdirSync(dir).filter((f) => MONTH_FILE.test(f)).sort()) {
        for (const line of readFileSync(path.join(dir, file), "utf8").split("\n")) {
            if (!line) continue;
            try {
                const event = JSON.parse(line);
                uids.add(event.uid);
                count++;
                newest = event.received ?? newest;
            } catch {
                // a line cut short (the Pi lost power while writing): skipped
            }
        }
    }

    // A sane event: an id for itself and for its order, and when it was seen.
    const valid = (event) =>
        event && typeof event === "object" && !Array.isArray(event)
        && typeof event.uid === "string" && event.uid.length > 0 && event.uid.length <= 64
        && Number.isFinite(event.at) && event.order && typeof event.order === "object"
        && (typeof event.order.id === "number" || typeof event.order.id === "string");

    // Events from one device: { accepted, duplicates, rejected }.
    function add(device, events, now = Date.now()) {
        const out = { accepted: 0, duplicates: 0, rejected: 0 };
        const lines = [];
        for (const event of events) {
            const line = valid(event) ? JSON.stringify({ ...event, device: String(device || "").slice(0, 64), received: now }) : null;
            if (!line || line.length > MAX_EVENT_BYTES) out.rejected++;
            else if (uids.has(event.uid)) out.duplicates++;
            else {
                uids.add(event.uid);
                lines.push(line);
                out.accepted++;
            }
        }
        if (lines.length) {
            appendFileSync(path.join(dir, `${new Date(now).toISOString().slice(0, 7)}.jsonl`), lines.join("\n") + "\n");
            count += lines.length;
            newest = now;
        }
        return out;
    }

    const status = () => ({ events: count, newest: newest ? new Date(newest).toISOString() : null });
    return { add, status };
}
