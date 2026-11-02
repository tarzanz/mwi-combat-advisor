// Your job results and purchases, shared between your devices: what a device
// worked out under a job in the Loot & XP Log, and what your buy orders cost,
// so every device counts the same purchases as used. One JSON line per record
// in data/jobs/<month>.jsonl (UTC), as the device sent it plus when it came.
// For each log entry the result that saw more of the job wins (more actions,
// a later end); for each buy order the one that saw more of it filled. Each
// record kept gets a number (seq), so a device asks only for what is new.

import { appendFileSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

export const MAX_JOB_RECORDS = 300;
export const MAX_RECORD_BYTES = 32 * 1024;

const MONTH_FILE = /^\d{4}-\d\d\.jsonl$/;

const validReport = (r) =>
    r && typeof r.key === "string" && r.key.length > 0 && r.key.length <= 120
    && r.report && typeof r.report === "object" && !Array.isArray(r.report)
    && Number.isFinite(r.report.endedAt) && Number.isFinite(r.report.actions) && Array.isArray(r.report.used);
const validPurchase = (p) =>
    p && typeof p.uid === "string" && p.uid.length > 0 && p.uid.length <= 64
    && p.purchase && typeof p.purchase.key === "string" && p.purchase.key.length <= 120
    && Number.isFinite(p.purchase.filled) && p.purchase.filled > 0 && Number.isFinite(p.purchase.cost) && Number.isFinite(p.purchase.at);

const betterReport = (incoming, kept) => !kept || incoming.actions > kept.actions || incoming.endedAt > kept.endedAt;
const betterPurchase = (incoming, kept) => !kept || incoming.filled > kept.filled;

export function openJobStore(dataDir) {
    const dir = path.join(dataDir, "jobs");
    mkdirSync(dir, { recursive: true });
    const reports = new Map(); // key -> { report, seq }
    const purchases = new Map(); // uid -> { purchase, seq }
    let seq = 0;
    let newest = null;

    // A record into the maps if it is better than what is there: whether it was.
    function apply(record) {
        if (record.kind === "report" && validReport(record) && betterReport(record.report, reports.get(record.key)?.report)) {
            reports.set(record.key, { report: record.report, seq: ++seq });
            return true;
        }
        if (record.kind === "purchase" && validPurchase(record) && betterPurchase(record.purchase, purchases.get(record.uid)?.purchase)) {
            purchases.set(record.uid, { purchase: record.purchase, seq: ++seq });
            return true;
        }
        return false;
    }

    for (const file of readdirSync(dir).filter((f) => MONTH_FILE.test(f)).sort()) {
        for (const line of readFileSync(path.join(dir, file), "utf8").split("\n")) {
            if (!line) continue;
            try {
                const record = JSON.parse(line);
                apply(record);
                newest = record.received ?? newest;
            } catch {
                // a line cut short (the Pi lost power while writing): skipped
            }
        }
    }

    // From one device: { reports: [{ key, report }], purchases: [{ uid, purchase }] } -> { accepted, kept, rejected }
    // (kept: the Pi already had as much).
    function add(device, { reports: rs = [], purchases: ps = [] }, now = Date.now()) {
        const out = { accepted: 0, kept: 0, rejected: 0 };
        const lines = [];
        const take = (record, valid) => {
            const line = valid ? JSON.stringify({ ...record, device: String(device || "").slice(0, 64), received: now }) : null;
            if (!line || line.length > MAX_RECORD_BYTES) out.rejected++;
            else if (apply(record)) {
                lines.push(line);
                out.accepted++;
            } else out.kept++;
        };
        for (const r of rs) take({ kind: "report", key: r?.key, report: r?.report }, validReport(r));
        for (const p of ps) take({ kind: "purchase", uid: p?.uid, purchase: p?.purchase }, validPurchase(p));
        if (lines.length) {
            appendFileSync(path.join(dir, `${new Date(now).toISOString().slice(0, 7)}.jsonl`), lines.join("\n") + "\n");
            newest = now;
        }
        return out;
    }

    // What changed after `after` (a seq a device got before), and the seq now.
    function since(after = 0) {
        const n = Number(after) || 0;
        return {
            seq,
            reports: [...reports].filter(([, v]) => v.seq > n).map(([key, v]) => ({ key, report: v.report })),
            purchases: [...purchases].filter(([, v]) => v.seq > n).map(([uid, v]) => ({ uid, purchase: v.purchase })),
        };
    }

    const status = () => ({ reports: reports.size, purchases: purchases.size, newest: newest ? new Date(newest).toISOString() : null });
    return { add, since, status };
}
