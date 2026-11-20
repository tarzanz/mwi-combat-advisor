// What the Pi's combat runs share (pi/labyrinth-combat-entry.js, pi/combat-plan-entry.js): a pool
// of worker threads running simulations from the bundle they were started from, the game's
// data and the newest market file, and the advisor's modules loaded the way the userscript
// loads them. Bundled into each entry by build.mjs.

import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { Worker } from "node:worker_threads";
import { ENGINE_TABLES, fill } from "../src/data-shim.js";

export const readData = (file) => JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));

// entry: the bundle's import.meta.url – its worker branch runs the jobs.
export class ThreadPool {
    constructor(size, dataFile, entry) {
        this.entry = new URL(entry);
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
            const worker = new Worker(this.entry, { workerData: { dataFile: this.dataFile }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
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
export function newestMarket(rawDir) {
    if (!existsSync(rawDir)) return null;
    for (const day of readdirSync(rawDir).sort().reverse()) {
        const files = readdirSync(path.join(rawDir, day)).filter((f) => f.endsWith(".json.gz")).sort();
        if (files.length) return JSON.parse(gunzipSync(readFileSync(path.join(rawDir, day, files[files.length - 1]))).toString("utf8"));
    }
    return null;
}

// Loads the game's data and prices into the advisor's modules (game-data.js) and the engine.
export async function loadAdvisor(dataFile, rawDir) {
    const { hash, data } = readData(dataFile);
    const market = newestMarket(rawDir);
    if (!market?.marketData) throw new Error("no market file on the Pi yet");
    const nativeFetch = globalThis.fetch;
    globalThis.fetch = async (url, ...rest) => (String(url).includes("marketplace.json") ? { ok: true, json: async () => market } : nativeFetch(url, ...rest));
    const { loadClientData, loadPrices } = await import("../src/game-data.js");
    await loadClientData({ localStorageUtil: { getInitClientData: () => data } });
    await loadPrices();
    fill(Object.fromEntries(ENGINE_TABLES.map((t) => [t, data[t] || {}])));
    return { hash, data, market };
}

// A worker thread: the engine with the game's data, running what run(job) does.
export function serveWorker(parentPort, workerData, run) {
    const { data } = readData(workerData.dataFile);
    fill(Object.fromEntries(ENGINE_TABLES.map((t) => [t, data[t] || {}])));
    parentPort.on("message", async ({ id, job }) => {
        try {
            parentPort.postMessage({ id, result: await run(job) });
        } catch (error) {
            parentPort.postMessage({ id, error: String(error?.stack || error) });
        }
    });
    parentPort.postMessage({ ready: true });
}
