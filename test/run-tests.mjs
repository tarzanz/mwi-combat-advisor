// Bundles test/harness.js the same way as the userscript (engine data from the shim) and runs it.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const shim = path.join(root, "src/data-shim.js");
const out = path.join(mkdtempSync(path.join(process.env.TMPDIR || tmpdir(), "mwia-")), "harness.mjs");
await build({
    entryPoints: [path.join(root, "test/harness.js")],
    bundle: true,
    platform: "node",
    format: "esm",
    mainFields: ["module", "main"],
    outfile: out,
    drop: ["console"],
    banner: { js: "globalThis.__log = console.log;" },
    plugins: [{
        name: "live-game-data",
        setup(b) {
            b.onResolve({ filter: /\/data\/[A-Za-z]+\.json$/ }, (a) => ({ path: path.basename(a.path, ".json"), namespace: "game-data" }));
            b.onLoad({ filter: /.*/, namespace: "game-data" }, (a) => ({ contents: `import { slot } from ${JSON.stringify(shim)}; export default slot(${JSON.stringify(a.path)});`, resolveDir: root }));
        },
    }],
});
const [dataDir = path.join(root, "engine/data"), market = process.env.MWIA_MARKET] = process.argv.slice(2);
if (!market) throw new Error("Pass a marketplace.json snapshot: npm test -- <dataDir> <marketplace.json>");
execFileSync("node", [out, dataDir, market], { stdio: "inherit" });
