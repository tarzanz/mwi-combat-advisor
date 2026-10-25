// Checks the Skilling advice without a browser: the best teas must not change
// when you follow the advice (put them in your slots), nor with the skill the list shows.
// Usage: node test/skilling-test.mjs
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fixtureCharacter } from "./fixture-character.js";
import { SKILLING_SKILLS, marketPricer, rankSkilling, skillingCharacter } from "../src/skilling.js";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const dataDir = path.join(root, "engine/data");
const data = {};
for (const f of readdirSync(dataDir)) data[f.replace(".json", "")] = JSON.parse(readFileSync(path.join(dataDir, f), "utf8"));

let failures = 0;
const check = (name, ok, detail = "") => { console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : "")); if (!ok) failures++; };

const character = fixtureCharacter();
character.characterSkills.push({ skillHrid: "/skills/tailoring", level: 20, experience: 0 });
character.characterItems.push({ hash: "pouch", itemHrid: "/items/large_pouch", itemLocationHrid: "/item_locations/pouch", count: 1, enhancementLevel: 0 });
const items = new Map(character.characterItems.map((i) => [i.hash, i]));
const marketData = {};
for (const item of Object.values(data.itemDetailMap)) marketData[item.hrid] = { 0: { a: 3 * (item.sellPrice || 1), b: item.sellPrice || 1 } };
const market = marketPricer((hrid) => marketData[hrid]?.[0], data, "ask");
const rank = (skill, goldWeight, drinks = null) => {
    const who = skillingCharacter(character, items, data);
    if (drinks) who.drinks[drinks.type] = drinks.teas;
    return rankSkilling(who, data, market, { skill, goldWeight }).available;
};

let flips = [];
let checked = 0;
for (const skill of SKILLING_SKILLS) {
    for (const goldWeight of [0.1, 0.5, 0.9]) {
        for (const entry of rank(skill, goldWeight)) {
            const after = rank(skill, goldWeight, { type: entry.action.type, teas: entry.best.result.teas }).find((e) => e.hrid === entry.hrid);
            checked++;
            if (after.best.result.teas.join() !== entry.best.result.teas.join()) flips.push(`${entry.action.name} @${goldWeight}`);
            if (after.betterTeas) flips.push(`${entry.action.name} @${goldWeight} still says swap`);
        }
    }
}
check("following the tea advice doesn't change it", checked > 100 && !flips.length, `${flips.length} of ${checked}: ${flips.slice(0, 5).join(", ")}`);

let differ = [];
for (const goldWeight of [0.1, 0.5, 0.9]) {
    const all = rank("all", goldWeight);
    for (const skill of SKILLING_SKILLS) {
        for (const entry of rank(skill, goldWeight)) {
            if (all.find((e) => e.hrid === entry.hrid).best.result.teas.join() !== entry.best.result.teas.join()) differ.push(`${entry.action.name} @${goldWeight}`);
        }
    }
}
check("the same teas whichever skill the list shows", !differ.length, differ.slice(0, 5).join(", "));

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
