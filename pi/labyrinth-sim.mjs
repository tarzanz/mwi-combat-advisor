// Simulates whole Labyrinth runs for one character (src/labyrinth-run.js) and exits:
// started by labyrinth-sim-store.mjs at the lowest priority, so the Pi's other work goes first.
//   node pi/labyrinth-sim.mjs <character folder> <data folder>
import os from "node:os";
import { existsSync, readFileSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { simulateLabyrinth } from "../src/labyrinth-run.js";

try {
    os.setPriority(19);
} catch {
    // already as low as it goes, or not allowed: the parent set it
}
const [charDir, dataDir] = process.argv.slice(2);
const request = JSON.parse(readFileSync(path.join(charDir, "request.json"), "utf8"));

// The game's Labyrinth states this character's devices sent (labyrinth-store.mjs), a file
// at a time: what the floors are learned from.
function* recordedStates() {
    const dir = path.join(dataDir, "labyrinth");
    if (!existsSync(dir)) return;
    const mine = String(request.character?.id ?? "");
    for (const file of readdirSync(dir).filter((f) => /^states-\d{4}-\d\d\.jsonl$/.test(f)).sort()) {
        for (const line of readFileSync(path.join(dir, file), "utf8").split("\n")) {
            if (!line) continue;
            try {
                const state = JSON.parse(line).state;
                if (state?.labyrinth && (!mine || String(state.labyrinth.characterID ?? mine) === mine)) yield state;
            } catch {
                // a line cut short: skipped
            }
        }
    }
}

// MWIA_LAB_RUNS: the runs per setup (2000 when not set; fewer is quicker and less sure).
const result = simulateLabyrinth(request, { states: recordedStates(), runs: Number(process.env.MWIA_LAB_RUNS) || undefined });
result.requestAt = request.at ?? null;
result.character = request.character?.name || null;
const file = path.join(charDir, "result.json");
writeFileSync(file + ".tmp", JSON.stringify(result));
renameSync(file + ".tmp", file);
