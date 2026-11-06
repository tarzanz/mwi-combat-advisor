// Filling in the game's Combat Triggers window through its own controls, against a stand-in
// built like the game's (MUI selects that open on mousedown, + Condition, 🗑, a number field).
// Usage: BROWSER_PATH=<chromium> node test/trigger-fill-browser-test.mjs [screenshot-dir]
import { build } from "esbuild";
import path from "node:path";
import puppeteer from "puppeteer-core";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const [shotDir] = process.argv.slice(2);
let failures = 0;
const check = (name, ok, detail = "") => {
    console.log((ok ? "PASS " : "FAIL ") + name + (detail ? " — " + detail : ""));
    if (!ok) failures++;
};

const bundle = await build({
    stdin: { contents: `import { fillTriggerWindow, shownTriggers } from "./src/trigger-fill.js"; window.__fill = { fillTriggerWindow, shownTriggers };`, resolveDir: root },
    bundle: true,
    format: "iife",
    write: false,
});

// The stand-in: rows of three selects (dependency, condition, comparator) and a value.
const page$ = `<!doctype html><body><div class="MuiTooltip-tooltip"><div class="CombatTriggersSetting_combatTriggersEditMenu__x">
  <div class="CombatTriggersSetting_label__x">Combat Triggers</div>
  <div class="CombatTriggersSetting_triggerInputs__x"><div id="rows"></div>
  <div><button id="add">+ Condition</button><button>Reset Default</button></div></div><button>Save</button></div></div>
<script>
const OPTIONS = [
  ["/combat_trigger_dependencies/self", "/combat_trigger_dependencies/all_enemies", "/combat_trigger_dependencies/targeted_enemy"],
  ["/combat_trigger_conditions/current_hp", "/combat_trigger_conditions/number_of_active_units", "/combat_trigger_conditions/current_mp", "/combat_trigger_conditions/missing_hp"],
  ["/combat_trigger_comparators/greater_than_equal", "/combat_trigger_comparators/less_than_equal"],
];
function select(k, value) {
  const wrap = document.createElement("div");
  wrap.innerHTML = '<div role="combobox" aria-haspopup="listbox"></div><input class="MuiSelect-nativeInput" tabindex="-1">';
  const combo = wrap.firstChild, native = wrap.lastChild;
  const set = (v) => { native.value = v; combo.textContent = v.split("/").pop(); };
  set(value);
  combo.addEventListener("mousedown", () => {
    const list = document.createElement("ul");
    list.setAttribute("role", "listbox");
    list.addEventListener("keydown", (e) => e.key === "Escape" && list.remove());
    for (const v of OPTIONS[k]) {
      const li = document.createElement("li");
      li.setAttribute("data-value", v);
      li.textContent = v.split("/").pop();
      li.addEventListener("click", () => { set(v); list.remove(); });
      list.appendChild(li);
    }
    setTimeout(() => document.body.appendChild(list), 30); // the menu comes a moment later, in a portal
  });
  return wrap;
}
function row(t) {
  const r = document.createElement("div");
  r.className = "CombatTriggersSetting_combatTrigger__x";
  const inputs = document.createElement("div");
  inputs.append(select(0, t[0]), select(1, t[1]), select(2, t[2]));
  const value = document.createElement("input");
  value.type = "number"; value.value = t[3];
  inputs.append(value);
  const remove = document.createElement("button");
  remove.textContent = "🗑";
  remove.addEventListener("click", () => r.remove());
  r.append(inputs, remove);
  document.getElementById("rows").appendChild(r);
}
row(["/combat_trigger_dependencies/self", "/combat_trigger_conditions/missing_hp", "/combat_trigger_comparators/greater_than_equal", "1"]);
document.getElementById("add").addEventListener("click", () => row(["/combat_trigger_dependencies/targeted_enemy", "/combat_trigger_conditions/current_hp", "/combat_trigger_comparators/greater_than_equal", "1"]));
</script></body>`;

const browser = await puppeteer.launch({ executablePath: process.env.BROWSER_PATH, headless: true, args: ["--no-sandbox"] });
try {
    const page = await browser.newPage();
    await page.setContent(page$);
    await page.addScriptTag({ content: bundle.outputFiles[0].text });
    const T = (d, c, k, v) => ({ dependencyHrid: "/combat_trigger_dependencies/" + d, conditionHrid: "/combat_trigger_conditions/" + c, comparatorHrid: "/combat_trigger_comparators/" + k, value: v });
    const run = (triggers) =>
        page.evaluate(async (wanted) => {
            const box = document.querySelector('[class*="combatTriggersEditMenu"]');
            const result = await window.__fill.fillTriggerWindow(box, null, wanted);
            return { result, shown: window.__fill.shownTriggers(box) };
        }, triggers);

    // Firestorm-like: two conditions where there was one.
    const two = [T("all_enemies", "number_of_active_units", "greater_than_equal", 3), T("all_enemies", "current_hp", "greater_than_equal", 1)];
    let out = await run(two);
    check("controls: a row added, dropdowns picked, value typed", out.result.ok && out.shown.length === 2 && out.shown[0].conditionHrid.endsWith("number_of_active_units") && out.shown[0].value === 3, JSON.stringify(out));
    if (shotDir) await page.screenshot({ path: path.join(shotDir, "trigger-fill.png") });

    // Back to one: the extra row removed.
    const one = [T("self", "missing_hp", "greater_than_equal", 50)];
    out = await run(one);
    check("controls: an extra row removed", out.result.ok && out.shown.length === 1 && out.shown[0].value === 50, JSON.stringify(out));

    // An option the window doesn't offer: says so, nothing claimed.
    out = await run([T("self", "berserk", "is_inactive", 0)]);
    check("controls: an option that isn't there is reported, not claimed", !out.result.ok && /could not pick berserk/.test(out.result.diag), out.result.diag);
    check("controls: no menu left open", (await page.$$('[role="listbox"]')).length === 0);
} finally {
    await browser.close();
}
console.log(failures ? `${failures} FAILED` : "ALL PASSED");
process.exit(failures ? 1 : 0);
