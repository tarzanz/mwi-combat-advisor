// Works out one character's 📈 plan (src/horizon.js) and exits: started by
// plan-store.mjs at the lowest priority, so the Pi's other work goes first.
//   node pi/planner.mjs <character folder> <game-data.json> <prices.json>
import os from "node:os";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";
import { planHorizon } from "../src/horizon.js";

try {
    os.setPriority(19);
} catch {
    // already as low as it goes, or not allowed: the parent set it
}
const [charDir, dataFile, pricesFile] = process.argv.slice(2);
const snapshot = JSON.parse(readFileSync(path.join(charDir, "snapshot.json"), "utf8"));
const { data, hash } = JSON.parse(readFileSync(dataFile, "utf8"));
const { prices, at: pricesAt } = JSON.parse(readFileSync(pricesFile, "utf8"));
const plan = planHorizon(snapshot, data, prices, snapshot.options || {});
plan.snapshotAt = snapshot.at ?? null;
plan.pricesAt = pricesAt;
plan.dataHash = hash;
plan.character = snapshot.character?.name || null;
const file = path.join(charDir, "plan.json");
writeFileSync(file + ".tmp", JSON.stringify(plan));
renameSync(file + ".tmp", file);
