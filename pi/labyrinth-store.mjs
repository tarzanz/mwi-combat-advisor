// Your Labyrinth attempts (src/labyrinth-log.js), from every device: one JSON line per
// attempt in data/labyrinth/<month>.jsonl (UTC), as the device sent it plus when it came.
// An attempt's uid is the same on every device that saw it, so each is kept once. Each
// gets a number (seq), so a device asks only for what is new.

import { appendFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const MAX_ATTEMPTS = 300;
export const MAX_ATTEMPT_BYTES = 16 * 1024;
// Attempts sent back per request; a device asks again for the rest.
const PAGE = 1000;

const MONTH_FILE = /^\d{4}-\d\d\.jsonl$/;

const valid = (a) => a && typeof a === "object" && !Array.isArray(a)
    && typeof a.uid === "string" && a.uid.length > 0 && a.uid.length <= 200
    && Number.isFinite(a.at) && typeof a.outcome === "string" && typeof a.what === "string";

export function openLabyrinthStore(dataDir) {
    const dir = path.join(dataDir, "labyrinth");
    mkdirSync(dir, { recursive: true });
    const attempts = new Map(); // uid -> { attempt, seq }
    let seq = 0;
    let newest = null;

    for (const file of readdirSync(dir).filter((f) => MONTH_FILE.test(f)).sort()) {
        for (const line of readFileSync(path.join(dir, file), "utf8").split("\n")) {
            if (!line) continue;
            try {
                const record = JSON.parse(line);
                if (valid(record.attempt) && !attempts.has(record.attempt.uid)) attempts.set(record.attempt.uid, { attempt: record.attempt, seq: ++seq });
                newest = record.received ?? newest;
            } catch {
                // a line cut short (the Pi lost power while writing): skipped
            }
        }
    }

    // From one device: attempts -> { accepted, duplicates, rejected }.
    function add(device, list, now = Date.now()) {
        const out = { accepted: 0, duplicates: 0, rejected: 0 };
        const lines = [];
        for (const attempt of list) {
            const line = valid(attempt) ? JSON.stringify({ attempt, device: String(device || "").slice(0, 64), received: now }) : null;
            if (!line || line.length > MAX_ATTEMPT_BYTES) out.rejected++;
            else if (attempts.has(attempt.uid)) out.duplicates++;
            else {
                attempts.set(attempt.uid, { attempt, seq: ++seq });
                lines.push(line);
                out.accepted++;
            }
        }
        if (lines.length) {
            appendFileSync(path.join(dir, `${new Date(now).toISOString().slice(0, 7)}.jsonl`), lines.join("\n") + "\n");
            newest = now;
        }
        return out;
    }

    // The attempts after `after` (a seq a device got before), oldest first, a page at a
    // time: seq is the last one sent, more whether there are others.
    function since(after = 0) {
        const n = Number(after) || 0;
        const newer = [...attempts.values()].filter((v) => v.seq > n);
        const page = newer.slice(0, PAGE);
        return { seq: page.length ? page[page.length - 1].seq : Math.min(Math.max(n, 0), seq), more: newer.length > PAGE, attempts: page.map((v) => ({ attempt: v.attempt })) };
    }

    const status = () => ({ attempts: attempts.size, newest: newest ? new Date(newest).toISOString() : null });
    return { add, since, status };
}
