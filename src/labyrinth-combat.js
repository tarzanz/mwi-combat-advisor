// The Labyrinth's combat analyses in one go, as the Pi works them out every night
// (pi/labyrinth-combat-entry.js): "Check the rooms" (every loadout against every
// monster), "What should I improve?" and "Build a loadout" for each loadout that is
// the best against at least one monster – in its own attack style, from what it wears.
// The device sends what they start from (labyrinthCombatRequest in labyrinth-combat-sync.js).

import { analyzeImprovements, analyzeLabyrinth, buildLoadout, yourStyle } from "./labyrinth.js";

// request: { setups: [{ id, name, profile }], crates: { coffee, food }, settings: { accuracy, budget, spending } }
// onStage(stage, partial): called as each part is done, so what is ready can be kept.
// onProgress(stage, done, total).
export async function runLabyrinthCombat(pool, request, data, { enhanceCost = null, onStage = () => {}, onProgress = () => {} } = {}) {
    const setups = request.setups || [];
    if (!setups.length) throw new Error("no loadouts in the request");
    const crates = request.crates || {};
    const settings = {
        ...(request.settings || {}),
        labyCoffee: crates.coffee || "none",
        labyFood: crates.food || "none",
    };
    const out = { lab: null, improve: null, builds: [] };

    out.lab = await analyzeLabyrinth(pool, setups, data, settings, null, (done, total) => onProgress("check", done, total));
    onStage("check", out);
    out.improve = await analyzeImprovements(pool, setups, data, settings, out.lab, (done, total) => onProgress("improve", done, total));
    onStage("improve", out);

    // A build for every loadout the check picked for a monster, in that loadout's style.
    const picked = [...new Set(out.lab.monsters.map((m) => m.setupId))].map((id) => setups.find((s) => s.id === id)).filter(Boolean);
    for (const [i, setup] of picked.entries()) {
        const style = yourStyle(setup.profile, data);
        try {
            const build = await buildLoadout(pool, setup.profile, data, settings, { style, budget: Number(settings.budget) || 0, enhanceCost, crates: out.lab.crates }, (done, total) =>
                onProgress("build", i * 1000 + Math.round((1000 * done) / Math.max(1, total)), picked.length * 1000)
            );
            const { profile: _built, ...kept } = build;
            out.builds.push({ setupId: setup.id, setupName: setup.name, style, build: kept });
        } catch (error) {
            out.builds.push({ setupId: setup.id, setupName: setup.name, style, error: String(error?.message || error) });
        }
        onStage("build", out);
    }
    return out;
}
