// The Labyrinth's combat analyses for one character on the Pi (src/labyrinth-combat.js):
// bundled by build.mjs into dist/pi-labyrinth-combat.mjs (the engine's data from the
// shim, as in the userscript) and started by pi/labyrinth-combat-store.mjs at the lowest
// priority, once a night. The rooms are simulated in worker threads of this same file.
//   node dist/pi-labyrinth-combat.mjs <character folder> <game-data.json.gz> <raw market folder>
// MWIA_LAB_COMBAT_WORKERS: the threads (2 when not set).

import os from "node:os";
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { ENGINE_TABLES, fill } from "../src/data-shim.js";
import { runLabyrinthSim } from "../src/sim-core.js";

const readData = (file) => JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));

class ThreadPool {
    constructor(size, dataFile) {
        this.size = size;
        this.dataFile = dataFile;
        this.workers = [];
        this.queue = [];
        this.pending = new Map();
        this.nextId = 1;
    }

    async start() {
        const ready = [];
        for (let i = 0; i < this.size; i++) {
            const worker = new Worker(new URL(import.meta.url), { workerData: { dataFile: this.dataFile }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
            const entry = { worker, busy: true };
            ready.push(
                new Promise((resolve, reject) => {
                    worker.once("error", reject);
                    worker.on("message", (message) => {
                        if (message.ready) {
                            entry.busy = false;
                            resolve();
                            return this.pump();
                        }
                        entry.busy = false;
                        const task = this.pending.get(message.id);
                        this.pending.delete(message.id);
                        if (message.error) task?.reject(new Error(message.error));
                        else task?.resolve(message.result);
                        this.pump();
                    });
                })
            );
            this.workers.push(entry);
        }
        await Promise.all(ready);
        for (const entry of this.workers) entry.worker.on("error", (error) => this.fail(error));
    }

    fail(error) {
        for (const task of [...this.queue, ...this.pending.values()]) task.reject(error);
        this.queue = [];
        this.pending.clear();
    }

    run(job) {
        return new Promise((resolve, reject) => {
            this.queue.push({ id: this.nextId++, job, resolve, reject });
            this.pump();
        });
    }

    runAll(jobs, onProgress) {
        let done = 0;
        return Promise.all(jobs.map((job) => this.run(job).then((result) => (onProgress?.(++done, jobs.length), result))));
    }

    pump() {
        for (const entry of this.workers) {
            if (entry.busy || !this.queue.length) continue;
            const task = this.queue.shift();
            entry.busy = true;
            this.pending.set(task.id, task);
            entry.worker.postMessage({ id: task.id, job: task.job });
        }
    }

    terminate() {
        return Promise.all(this.workers.map((entry) => entry.worker.terminate()));
    }
}

// The newest market file the Pi fetched (history-store.mjs keeps them as they came).
function newestMarket(rawDir) {
    if (!existsSync(rawDir)) return null;
    for (const day of readdirSync(rawDir).sort().reverse()) {
        const files = readdirSync(path.join(rawDir, day)).filter((f) => f.endsWith(".json.gz")).sort();
        if (files.length) return JSON.parse(gunzipSync(readFileSync(path.join(rawDir, day, files[files.length - 1]))).toString("utf8"));
    }
    return null;
}

async function main() {
    try {
        os.setPriority(19);
    } catch {
        // already as low as it goes, or not allowed: the parent set it
    }
    const [charDir, dataFile, rawDir] = process.argv.slice(2);
    const started = Date.now();
    const request = JSON.parse(readFileSync(path.join(charDir, "request.json"), "utf8"));
    const { hash, data } = readData(dataFile);
    const market = newestMarket(rawDir);
    if (!market?.marketData) throw new Error("no market file on the Pi yet");

    // The advisor's modules read the game data and the prices the way the userscript does.
    const nativeFetch = globalThis.fetch;
    globalThis.fetch = async (url, ...rest) => (String(url).includes("marketplace.json") ? { ok: true, json: async () => market } : nativeFetch(url, ...rest));
    const { loadClientData, loadPrices, marketEntry } = await import("../src/game-data.js");
    const { marketPricer } = await import("../src/skilling.js");
    const { selfEnhanceCosts } = await import("../src/enhancing.js");
    const { runLabyrinthCombat } = await import("../src/labyrinth-combat.js");
    await loadClientData({ localStorageUtil: { getInitClientData: () => data } });
    await loadPrices();
    fill(Object.fromEntries(ENGINE_TABLES.map((t) => [t, data[t] || {}])));

    let enhanceCost = null;
    if (request.who) {
        const market = marketPricer((hrid) => marketEntry(hrid), data, "bid");
        enhanceCost = (hrid, starts) => selfEnhanceCosts(hrid, request.who, data, market, starts);
    }

    const write = (name, value) => {
        const file = path.join(charDir, name);
        writeFileSync(file + ".tmp", JSON.stringify(value));
        renameSync(file + ".tmp", file);
    };
    const base = { at: started, requestAt: request.at ?? null, character: request.character?.name || null, dataHash: hash, pricesAt: market.timestamp ? market.timestamp * 1000 : null, version: request.version || null };
    let shown = 0;
    const progress = (stage, done, total) => {
        if (Date.now() - shown < 3000 && done < total) return;
        shown = Date.now();
        write("progress.json", { stage, done, total, at: shown });
    };

    const workers = Math.max(1, Math.min(4, Number(process.env.MWIA_LAB_COMBAT_WORKERS) || 2));
    const pool = new ThreadPool(workers, dataFile);
    await pool.start();
    try {
        const result = await runLabyrinthCombat(pool, request, data, {
            enhanceCost,
            onProgress: progress,
            onStage: (stage, partial) => write("result.json", { ...base, stage, done: false, ...partial }),
        });
        write("result.json", { ...base, stage: "done", done: true, finishedAt: Date.now(), ...result });
    } finally {
        await pool.terminate();
    }
}

// A worker runs rooms; the main thread the analyses.
if (!isMainThread) {
    const { data } = readData(workerData.dataFile);
    fill(Object.fromEntries(ENGINE_TABLES.map((t) => [t, data[t] || {}])));
    parentPort.on("message", async ({ id, job }) => {
        try {
            parentPort.postMessage({ id, result: await runLabyrinthSim(job) });
        } catch (error) {
            parentPort.postMessage({ id, error: String(error?.stack || error) });
        }
    });
    parentPort.postMessage({ ready: true });
} else {
    await main();
}
