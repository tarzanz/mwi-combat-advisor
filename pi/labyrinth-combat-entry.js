// The Labyrinth's combat analyses for one character on the Pi (src/labyrinth-combat.js):
// bundled by build.mjs into dist/pi-labyrinth-combat.mjs (the engine's data from the
// shim, as in the userscript) and started by pi/labyrinth-combat-store.mjs at the lowest
// priority, once a night. The rooms are simulated in worker threads of this same file.
//   node dist/pi-labyrinth-combat.mjs <character folder> <game-data.json.gz> <raw market folder>
// MWIA_LAB_COMBAT_WORKERS: the threads (2 when not set).

import os from "node:os";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";
import { runLabyrinthSim } from "../src/sim-core.js";
import { ThreadPool, loadAdvisor, serveWorker } from "./node-pool.js";

async function main() {
    try {
        os.setPriority(19);
    } catch {
        // already as low as it goes, or not allowed: the parent set it
    }
    const [charDir, dataFile, rawDir] = process.argv.slice(2);
    const started = Date.now();
    const request = JSON.parse(readFileSync(path.join(charDir, "request.json"), "utf8"));
    const { hash, data, market } = await loadAdvisor(dataFile, rawDir);
    const { marketEntry } = await import("../src/game-data.js");
    const { marketPricer } = await import("../src/skilling.js");
    const { selfEnhanceCosts } = await import("../src/enhancing.js");
    const { runLabyrinthCombat } = await import("../src/labyrinth-combat.js");

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
    const pool = new ThreadPool(workers, dataFile, import.meta.url);
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
if (!isMainThread) serveWorker(parentPort, workerData, runLabyrinthSim);
else await main();
