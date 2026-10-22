// Builds dist/mwi-combat-advisor.user.js:
//  1. bundles the simulator engine + worker into one script (as a string),
//  2. bundles the userscript, embedding that string for a Blob worker.
// Engine JSON imports are redirected to src/data-shim.js so the live game
// data is used instead of the copies in engine/data.

import { build } from "esbuild";
import { readFileSync } from "node:fs";
import path from "node:path";

const root = path.dirname(new URL(import.meta.url).pathname);
const pkg = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8"));
const shim = path.join(root, "src/data-shim.js");

const liveDataPlugin = {
    name: "live-game-data",
    setup(b) {
        b.onResolve({ filter: /\/data\/[A-Za-z]+\.json$/ }, (args) => ({
            path: path.basename(args.path, ".json"),
            namespace: "game-data",
        }));
        b.onLoad({ filter: /.*/, namespace: "game-data" }, (args) => ({
            contents: `import { slot } from ${JSON.stringify(shim)}; export default slot(${JSON.stringify(args.path)});`,
            resolveDir: root,
        }));
    },
};

const worker = await build({
    entryPoints: [path.join(root, "src/worker.js")],
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    drop: ["console"],
    write: false,
    plugins: [liveDataPlugin],
    legalComments: "none",
});
const workerSource = worker.outputFiles[0].text;

function thirdPartyNotices() {
    const licence = (file) => readFileSync(path.join(root, file), "utf8").trim().replace(/^/gm, "// ");
    return `\n// ---- Third-party licences ----\n// MWICombatSimulator (engine/):\n${licence("engine/LICENSE")}\n//\n// heap-js:\n${licence("node_modules/heap-js/LICENSE")}\n`;
}

// The built script is committed, so userscript managers install and update straight from GitHub.
const UPDATE_URL = "https://raw.githubusercontent.com/tarzanz/mwi-combat-advisor/main/dist/mwi-combat-advisor.user.js";

const header = `// ==UserScript==
// @name         MWI Combat Advisor
// @namespace    local.mwi-combat-advisor
// @version      ${pkg.version}
// @description  Recommends zones, gear, abilities, food and drinks for Milky Way Idle combat by simulating your own character.
// @match        https://www.milkywayidle.com/*
// @match        https://test.milkywayidle.com/*
// @match        https://www.milkywayidlecn.com/*
// @run-at       document-start
// @grant        none
// @license      MIT
// @homepageURL  https://github.com/tarzanz/mwi-combat-advisor
// @downloadURL  ${UPDATE_URL}
// @updateURL    ${UPDATE_URL}
// ==/UserScript==

// Combat engine: MWICombatSimulator by AmVoidGuy / shykai (MIT licence),
// https://github.com/shykai/MWICombatSimulatorTest. Licences at the end of this file.
`;

await build({
    entryPoints: [path.join(root, "src/main.js")],
    bundle: true,
    format: "iife",
    target: "es2020",
    outfile: path.join(root, "dist/mwi-combat-advisor.user.js"),
    banner: { js: header },
    footer: { js: thirdPartyNotices() },
    legalComments: "none",
    plugins: [
        {
            name: "worker-source",
            setup(b) {
                b.onResolve({ filter: /^virtual:worker-source$/ }, () => ({ path: "worker-source", namespace: "virtual" }));
                b.onLoad({ filter: /.*/, namespace: "virtual" }, () => ({
                    contents: `export default ${JSON.stringify(workerSource)};`,
                    loader: "js",
                }));
            },
        },
    ],
});

const size = readFileSync(path.join(root, "dist/mwi-combat-advisor.user.js")).length;
console.log(`Built dist/mwi-combat-advisor.user.js (${(size / 1024).toFixed(0)} KiB)`);
