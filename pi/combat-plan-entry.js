// ⚔ The combat plan for one character on the Pi (src/combat-plan.js): bundled by build.mjs into
// dist/pi-combat-plan.mjs and started by pi/combat-plan-store.mjs at the lowest priority, once a
// night after the Labyrinth's run (or when a device asks). Simulations run in worker threads of
// this same file.
//   node dist/pi-combat-plan.mjs <character folder> <game-data.json.gz> <raw market folder> <labyrinth request.json> <📈 plan folder>
// The loadouts come from what the Labyrinth tab sends (its request), the coins from the 📈 plan's
// snapshot, skilling's gold a day from the 📈 plan's best plan. MWIA_COMBAT_PLAN_WORKERS: threads (2).

import os from "node:os";
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";
import { runLabyrinthSim, runSim } from "../src/sim-core.js";
import { ThreadPool, loadAdvisor, serveWorker } from "./node-pool.js";

const readJson = (file) => (existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : null);

// Skilling's gold a day along the 📈 plan's best plan: [{ from, to, perDay, name, skill }].
export function skillingSegments(plan) {
    // best is the index of the best plan in plans (an object in older plans).
    const best = typeof plan?.best === "number" ? plan.plans?.[plan.best] : plan?.best || null;
    return (best?.segments || [])
        .filter((s) => s.to > s.from)
        .map((s) => ({ from: s.from, to: s.to, perDay: (s.gold || 0) / (s.to - s.from), name: s.name || null, skill: s.skill || null }));
}

async function main() {
    try {
        os.setPriority(19);
    } catch {
        // already as low as it goes, or not allowed: the parent set it
    }
    const [charDir, dataFile, rawDir, labyrinthRequest, planDir] = process.argv.slice(2);
    const started = Date.now();
    const settings = readJson(path.join(charDir, "settings.json"));
    const request = readJson(labyrinthRequest);
    if (!request?.setups?.length) throw new Error("no loadouts on the Pi yet: open the Labyrinth tab once");
    const snapshot = readJson(path.join(planDir, "snapshot.json"));
    const plan = readJson(path.join(planDir, "plan.json"));

    const { hash, data, market } = await loadAdvisor(dataFile, rawDir);
    const { planCombat } = await import("../src/combat-plan.js");

    const write = (name, value) => {
        const file = path.join(charDir, name);
        writeFileSync(file + ".tmp", JSON.stringify(value));
        renameSync(file + ".tmp", file);
    };
    let shown = 0;
    const progress = (stage, done, total) => {
        if (Date.now() - shown < 3000 && done < total) return;
        shown = Date.now();
        write("progress.json", { stage, done, total, at: shown });
    };

    const workers = Math.max(1, Math.min(4, Number(process.env.MWIA_COMBAT_PLAN_WORKERS) || 2));
    const pool = new ThreadPool(workers, dataFile, import.meta.url);
    await pool.start();
    try {
        const input = {
            settings: settings?.settings || {},
            setups: request.setups,
            coins: snapshot?.coins ?? 0,
            skilling: skillingSegments(plan),
        };
        const result = await planCombat(pool, input, data, { onProgress: progress });
        write("result.json", {
            at: started,
            finishedAt: Date.now(),
            ms: Date.now() - started,
            character: request.character?.name || null,
            dataHash: hash,
            pricesAt: market.timestamp ? market.timestamp * 1000 : null,
            loadoutsAt: request.at ?? null,
            coinsAt: snapshot?.at ?? null,
            skillingPlanAt: plan?.at ?? null,
            settingsAt: settings?.at ?? null,
            version: settings?.version || request.version || null,
            ...result,
        });
    } finally {
        await pool.terminate();
    }
}

// A worker runs fights (zones or Labyrinth rooms); the main thread the plan.
if (!isMainThread) serveWorker(parentPort, workerData, (job) => (job.monsterHrid ? runLabyrinthSim(job) : runSim(job)));
else await main();
