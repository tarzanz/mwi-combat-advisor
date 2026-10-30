// The Pi's price history: every market file kept as it came (raw/, gzipped,
// to rebuild anything from later), and the same hourly and daily records the
// userscript keeps (state/), from which a browser is sent what it lacks.
//
// data/raw/2026-10-28/1793178360.json.gz   the file, named by its timestamp
// data/state/meta.json                      { epoch, items, last }
// data/state/hours/<hour>.json.gz           one full hourly record (two weeks)
// data/state/days/<day>.json.gz             one full daily record (a year)
//
// The epoch changes when the state is rebuilt (the item order may differ),
// so a browser then reads everything again.

import { mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { DAILY_DAYS, DAILY_FIELDS, HOURLY_DAYS, HOURLY_FIELDS, dayOf, encodeRecord, historyCsv, rollUpDays, snapshotRecord, weekOf } from "../src/price-history.js";
import { packRecord, unpackRecord } from "../src/history-wire.js";

const writeAtomic = (file, data) => {
    writeFileSync(file + ".tmp", data);
    renameSync(file + ".tmp", file);
};
const readGz = (file) => unpackRecord(JSON.parse(gunzipSync(readFileSync(file)).toString()));
const numbered = (dir) => readdirSync(dir).filter((f) => /^-?\d+\.json\.gz$/.test(f)).map((f) => Number(f.split(".")[0])).sort((x, y) => x - y);

export function openStore(dataDir) {
    const rawDir = path.join(dataDir, "raw");
    const stateDir = path.join(dataDir, "state");
    const hoursDir = path.join(stateDir, "hours");
    const daysDir = path.join(stateDir, "days");
    const metaFile = path.join(stateDir, "meta.json");
    const s = { epoch: randomUUID(), items: [], index: new Map(), last: 0, hours: [], days: [] };

    const reset = () => {
        rmSync(stateDir, { recursive: true, force: true });
        Object.assign(s, { epoch: randomUUID(), items: [], index: new Map(), last: 0, hours: [], days: [] });
    };
    const ensureDirs = () => [rawDir, hoursDir, daysDir].forEach((dir) => mkdirSync(dir, { recursive: true }));
    const saveMeta = () => writeAtomic(metaFile, JSON.stringify({ epoch: s.epoch, items: s.items, last: s.last }));
    const saveHour = (r) => writeAtomic(path.join(hoursDir, `${r.hour}.json.gz`), gzipSync(JSON.stringify(packRecord(r))));
    const saveDay = (d) => writeAtomic(path.join(daysDir, `${d.day}.json.gz`), gzipSync(JSON.stringify(packRecord(d))));

    function load() {
        ensureDirs();
        let meta = null;
        try {
            meta = JSON.parse(readFileSync(metaFile, "utf8"));
        } catch {
            return;
        }
        s.epoch = meta.epoch;
        s.items = meta.items;
        s.items.forEach((key, i) => s.index.set(key, i));
        s.last = meta.last || 0;
        s.hours = numbered(hoursDir).map((hour) => readGz(path.join(hoursDir, `${hour}.json.gz`)));
        s.days = numbered(daysDir).map((day) => readGz(path.join(daysDir, `${day}.json.gz`)));
    }

    // One market file (its text). Returns false for one already seen.
    function addFile(text, { keepRaw = true, save = true } = {}) {
        const json = JSON.parse(text);
        const timestamp = Number(json.timestamp);
        if (!Number.isFinite(timestamp) || !json.marketData || timestamp <= s.last) return false;
        if (keepRaw) {
            const dir = path.join(rawDir, new Date(timestamp * 1000).toISOString().slice(0, 10));
            mkdirSync(dir, { recursive: true });
            writeAtomic(path.join(dir, `${timestamp}.json.gz`), gzipSync(text));
        }
        const record = snapshotRecord(json.marketData, Math.floor(timestamp / 3600), s.items, s.index);
        s.hours = [...s.hours.filter((r) => r.hour !== record.hour), record];
        s.last = timestamp;
        // Whole days older than two weeks become daily points, as in the browser.
        const cutoffDay = Math.floor((record.hour - HOURLY_DAYS * 24) / 24);
        const old = s.hours.filter((r) => dayOf(r) < cutoffDay);
        s.hours = s.hours.filter((r) => dayOf(r) >= cutoffDay);
        const rolled = old.length ? rollUpDays(old, s.items.length) : [];
        const rolledDays = new Set(rolled.map((d) => d.day));
        const firstDay = Math.floor(record.hour / 24) - DAILY_DAYS;
        const dropped = s.days.filter((d) => d.day < firstDay);
        s.days = [...s.days.filter((d) => d.day >= firstDay && !rolledDays.has(d.day)), ...rolled].sort((x, y) => x.day - y.day);
        if (save) {
            saveHour(record);
            for (const r of old) rmSync(path.join(hoursDir, `${r.hour}.json.gz`), { force: true });
            for (const d of rolled) saveDay(d);
            for (const d of dropped) rmSync(path.join(daysDir, `${d.day}.json.gz`), { force: true });
            saveMeta();
        }
        return true;
    }

    // Recomputes the state from the raw files (a new epoch: browsers read it all again).
    function rebuild(log = () => {}) {
        reset();
        ensureDirs();
        const files = readdirSync(rawDir).sort().flatMap((day) => readdirSync(path.join(rawDir, day)).filter((f) => f.endsWith(".json.gz")).sort().map((f) => path.join(rawDir, day, f)));
        let added = 0;
        for (const file of files) {
            if (addFile(gunzipSync(readFileSync(file)).toString(), { keepRaw: false, save: false })) added++;
        }
        s.hours.forEach(saveHour);
        s.days.forEach(saveDay);
        saveMeta();
        log(`rebuilt from ${added} of ${files.length} files: ${s.hours.length} hours, ${s.days.length} days, ${s.items.length} items`);
    }

    // What a browser lacks: items after the first `items` it knows, hours after
    // `hour` and days after `day`, each list starting with a key record.
    // Another epoch than ours: everything.
    function since(query) {
        const same = query.epoch === s.epoch;
        const num = (v, fallback) => (same && v !== undefined && v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : fallback);
        const itemsFrom = Math.min(s.items.length, Math.max(0, num(query.items, 0)));
        const hour = num(query.hour, -Infinity);
        const day = num(query.day, -Infinity);
        const encodeAll = (list, fields, keyOf) => list.map((r, i) => packRecord(encodeRecord(r, list[i - 1] || null, fields, keyOf)));
        return {
            epoch: s.epoch,
            itemsFrom,
            items: s.items.slice(itemsFrom),
            hours: encodeAll(s.hours.filter((r) => r.hour > hour), HOURLY_FIELDS, dayOf),
            days: encodeAll(s.days.filter((d) => d.day > day), DAILY_FIELDS, weekOf),
        };
    }

    const status = () => ({
        items: s.items.length,
        hours: s.hours.length,
        days: s.days.length,
        newest: s.last ? new Date(s.last * 1000).toISOString() : null,
    });

    // Everything as CSV, with what sold in each hour (the browser's export gives it per day).
    const csv = () => historyCsv(s.items, s.hours, s.days, new Date(), { hourlySold: true }).csv;

    load();
    return { addFile, rebuild, since, status, csv };
}
