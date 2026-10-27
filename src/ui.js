// The in-game panel.

import {
    ACCURACY,
    SPENDING,
    CONFIDENCE_LEVEL,
    analyzeUpgrades,
    deathLimit,
    refineUncertain,
    uncertainCandidates,
    isSpawnCapped,
    rateUpgrades,
    xpValue,
    zoneGoal,
    analyzeZones,
    applyPlan,
    buildPlan,
    pickBestZone,
    score,
    verifyPlan,
} from "./analysis.js";
import {
    abilityName,
    actionName,
    askPrice,
    combatZones,
    engineTables,
    getClientData,
    itemName,
    loadClientData,
    loadPrices,
    pricesAge,
} from "./game-data.js";
import { onStateChange, state } from "./game-state.js";
import { COMBAT_SKILLS, buildProfile, combatLevel, slotCounts } from "./profile.js";
import { SimPool } from "./pool.js";
import { CSS } from "./style.js";
import { coinsInput, esc, parseCoins } from "./format.js";
import { addToCart } from "./mwitools-cart.js";
import { rememberToggle, renderSkilling, toggleShowAll } from "./skilling-ui.js";
import { onHistoryChange } from "./price-history-ui.js";
import { rememberCombatSetup, startConsumableGuide } from "./consumable-guide.js";
import { startToolNotice } from "./tool-notice.js";
import { startTeaSlots } from "./tea-slots.js";
import { findActionPanel, inventoryItemHash, navDiagnostics, openAction, openAlchemy, openEnhancing, openMarketplace, setReactInput, visible } from "./game-nav.js";
import { enableTapTips, isTouch, labelTableCells, makeDraggable } from "./touch.js";
import { startTrain } from "./train-ui.js";

const SETTINGS_KEY = "mwia-settings";
const DEFAULT_SETTINGS = { goldWeight: 0, acceptRareDeaths: false, accuracy: "normal", budget: 2000000, spending: "balanced", maxTier: 1, zone: "auto", skillingSkill: "all", skillingSellAt: "ask", skillingTeas: "current", skillingSellCap: 0, skillingMode: "away", skillingGold: 100 };

const SKILL_NAMES = {
    stamina: "Stamina",
    intelligence: "Intelligence",
    attack: "Attack",
    melee: "Melee",
    defense: "Defense",
    ranged: "Ranged",
    magic: "Magic",
};

const SLOT_NAMES = {
    main_hand: "Weapon",
    two_hand: "Two-hand",
    off_hand: "Off-hand",
    head: "Head",
    body: "Body",
    legs: "Legs",
    feet: "Feet",
    hands: "Hands",
    neck: "Neck",
    earrings: "Earrings",
    ring: "Ring",
    back: "Back",
    pouch: "Pouch",
    charm: "Charm",
};

const ui = {
    root: null,
    tab: "overview",
    settings: loadSettings(),
    pool: null,
    busy: false,
    zoneResults: null,
    upgradeRaw: null, // simulated upgrades, independent of the XP/gold goal
    upgradeResult: null, // upgradeRaw rated for the current goal
    plan: null,
    verified: null,
    error: null,
    progress: null,
    workerSource: null,
    win: null,
    notice: null,
    cartItems: new Map(), // button id -> items for the MWITools cart (rebuilt on every render)
    skillingLoad: null, // { loading, error } while the Skilling tab fetches game data and prices
    returnRow: null, // Skilling row to scroll back to when the panel opens again
    marketWatch: null, // timer waiting for the marketplace to close
};

const MARKET_PANEL = '[class*="MarketplacePanel_marketplacePanel"]';
const MARKET_SHOW_MS = 8000;
const MARKET_POLL_MS = 300;

function loadSettings() {
    try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") };
    } catch {
        return { ...DEFAULT_SETTINGS };
    }
}

function saveSettings() {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(ui.settings));
    } catch {
        /* settings just won't persist */
    }
}

// ---------- formatting ----------

const int = (n) => Math.round(n).toLocaleString("en-US");
const dec = (n, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (n) => (n >= 0 ? "+" : "") + dec(n * 100, 1) + "%";

const HOURS_PER_DAY = 24;
const perDay = (perHour) => perHour * HOURS_PER_DAY;

function coins(n) {
    if (n === null || n === undefined) return "–";
    const abs = Math.abs(n);
    if (abs >= 1e9) return dec(n / 1e9, 2) + "B";
    if (abs >= 1e6) return dec(n / 1e6, abs >= 1e7 ? 1 : 2) + "M";
    if (abs >= 1e4) return dec(n / 1e3, 0) + "k";
    return int(n);
}

function gearLabel(gear) {
    if (!gear) return '<span class="mwia-dim">empty</span>';
    return esc(itemName(gear.hrid)) + (gear.enhancementLevel ? ` <span class="mwia-enh">+${gear.enhancementLevel}</span>` : "");
}

function zoneLabel(zone) {
    return esc(actionName(zone.zoneHrid)) + (zone.tier ? ` <span class="mwia-tier">T${zone.tier}</span>` : "");
}

function deathBadge(deaths) {
    if (deaths === 0) return '<span class="mwia-ok" title="Never died in the simulation">✔ safe</span>';
    if (deaths <= deathLimit(ui.settings)) return `<span class="mwia-ok" title="Deaths per hour – within what you accept">✔ ${dec(deaths, 2)}/h</span>`;
    if (deaths < 1) return `<span class="mwia-warn" title="Deaths per hour">⚠ ${dec(deaths, 2)}/h</span>`;
    return `<span class="mwia-bad" title="Deaths per hour">✖ ${dec(deaths, 1)}/h</span>`;
}

const signed = (text, n) => (n >= 0 ? "+" : "−") + text(Math.abs(n));
const focusText = (gold) => (gold === 0 ? "XP only" : gold === 100 ? "Gold only" : `${100 - gold}% XP · ${gold}% gold`);

const XP_LABEL = "Combat XP/h";

// ---------- data ----------

function currentProfile() {
    const data = getClientData();
    if (!state.character || !data) return null;
    return buildProfile(state.character, state.items, data);
}

async function ensureReady() {
    const data = await loadClientData(ui.win);
    await loadPrices();
    if (!state.character) throw new Error("No character data yet. Reload the game page (F5) with the script enabled.");
    if (!ui.pool) {
        // Fewer workers on phones and tablets: they get hot and throttle.
        const size = Math.max(1, Math.min((navigator.hardwareConcurrency || 4) - 1, isTouch() ? 4 : 8));
        ui.pool = new SimPool(ui.workerSource, engineTables(), size);
        await ui.pool.start();
    }
    return data;
}

async function runTask(task) {
    if (ui.busy) return;
    ui.busy = true;
    ui.error = null;
    ui.progress = { done: 0, total: 0, label: "Preparing…" };
    render();
    try {
        await ensureReady();
        await task();
    } catch (error) {
        if (error.message !== "Cancelled") {
            console.error("[Combat Advisor]", error);
            ui.error = error.message || String(error);
        }
    } finally {
        ui.busy = false;
        ui.progress = null;
        render();
    }
}

function progress(label) {
    return (done, total) => {
        ui.progress = { done, total, label };
        renderProgress();
    };
}

function runSettings() {
    const accuracy = ACCURACY[ui.settings.accuracy] || ACCURACY.normal;
    return { ...accuracy, budget: Number(ui.settings.budget) || 0, maxTier: Number(ui.settings.maxTier) || 0 };
}

async function doZones() {
    const profile = currentProfile();
    ui.zoneResults = await analyzeZones(ui.pool, profile, runSettings(), progress("Simulating zones"));
}

function chosenZone(profile) {
    const selected = ui.settings.zone;
    if (selected && selected !== "auto") {
        const [zoneHrid, tier] = selected.split("#");
        return { zoneHrid, tier: Number(tier) || 0 };
    }
    const best = pickBestZone(ui.zoneResults, ui.settings);
    if (best) return best.zone;
    return profile.currentZone || null;
}

// Re-scores the last analysis for the current goal and rebuilds the shopping list.
function rerateUpgrades() {
    if (!ui.upgradeRaw) return;
    ui.upgradeResult = rateUpgrades(ui.upgradeRaw, ui.settings);
    ui.plan = buildPlan(ui.upgradeResult, Number(ui.settings.budget) || 0, ui.settings.spending);
    ui.verified = null;
    saveCombatSetup();
}

// The drinks and food the plan leaves you with, for the box in the game's combat window.
function saveCombatSetup() {
    const raw = ui.upgradeRaw;
    const plan = ui.plan;
    if (!raw || !plan) return;
    const target = applyPlan(raw.baseProfile, { picks: [], drink: plan.drink, food: plan.food });
    const slots = slotCounts(raw.baseProfile, getClientData());
    const perHour = { ...raw.base.consumables, ...(plan.drink?.result?.consumables || {}), ...(plan.food?.result?.consumables || {}), ...(ui.verified?.planned?.consumables || {}) };
    // Fights an hour with the gear you have now: the plan's gear isn't bought yet.
    rememberCombatSetup(raw.zone, { drinks: target.drinks.slice(0, slots.drinks), food: target.food.slice(0, slots.food), perHour, encountersPerHour: raw.base.encounters });
}

async function doRefine() {
    await refineUncertain(ui.pool, ui.upgradeRaw, ui.settings, progress("Re-running uncertain suggestions"));
    rerateUpgrades();
}

async function doUpgrades() {
    const profile = currentProfile();
    if (ui.settings.zone === "auto" && !ui.zoneResults) await doZones();
    const zone = chosenZone(profile);
    if (!zone) throw new Error("Pick a zone first.");
    const settings = runSettings();
    ui.upgradeRaw = await analyzeUpgrades(ui.pool, profile, zone, settings, progress("Testing upgrades"), progress("Re-running uncertain suggestions"));
    rerateUpgrades();
    if (ui.plan.picks.length || ui.plan.drink || ui.plan.food) {
        ui.verified = await verifyPlan(ui.pool, profile, ui.plan, zone, settings, progress("Checking the shopping list"));
        saveCombatSetup();
    }
}

// ---------- rendering ----------

function render() {
    if (!ui.root) return;
    const body = ui.root.querySelector(".mwia-body");
    ui.root.querySelectorAll(".mwia-tab").forEach((t) => t.classList.toggle("mwia-active", t.dataset.tab === ui.tab));
    ui.root.querySelector(".mwia-status").innerHTML = statusLine();
    ui.cartItems = new Map();
    let html = "";
    if (ui.error) html += `<div class="mwia-error">${esc(ui.error)}</div>`;
    if (ui.notice && (ui.tab === "upgrades" || ui.tab === "skilling")) html += `<div class="mwia-notice mwia-notice-${ui.notice.level}">${esc(ui.notice.text)}</div>`;
    if (ui.busy) html += progressHtml();
    if (ui.tab === "overview") html += renderOverview();
    else if (ui.tab === "zones") html += renderZones();
    else if (ui.tab === "upgrades") html += renderUpgrades();
    else if (ui.tab === "skilling") html += renderSkillingTab();
    else html += renderGuide();
    body.innerHTML = html;
    labelTableCells(body);
}

function statusLine() {
    if (!state.character) return '<span class="mwia-warn">Waiting for character data – reload the page if this stays.</span>';
    const age = pricesAge();
    const prices = age === null ? "prices load on first analysis" : `prices ${Math.round(age / 60000)} min old`;
    return `${esc(state.character.character?.name || "")} · ${prices}`;
}

function progressHtml() {
    const p = ui.progress || { done: 0, total: 0, label: "" };
    const share = p.total ? (100 * p.done) / p.total : 0;
    return `<div class="mwia-progress"><div class="mwia-progress-label"><span>${esc(p.label)} ${p.total ? `${p.done}/${p.total}` : ""}</span>
        <button class="mwia-link" data-action="cancel">Cancel</button></div>
        <div class="mwia-bar"><div style="width:${share}%"></div></div></div>`;
}

function renderProgress() {
    const node = ui.root?.querySelector(".mwia-progress");
    if (!node) return render();
    const p = ui.progress;
    node.querySelector(".mwia-progress-label span").textContent = `${p.label} ${p.total ? `${p.done}/${p.total}` : ""}`;
    node.querySelector(".mwia-bar div").style.width = `${p.total ? (100 * p.done) / p.total : 0}%`;
}

function settingsHtml(fields) {
    const s = ui.settings;
    const parts = [];
    if (fields.includes("focus")) {
        const gold = Math.round((Number(s.goldWeight) || 0) * 100);
        parts.push(`<label class="mwia-focus" title="What to optimise for: XP per hour, gold (loot minus food/drink cost) per hour, or a mix. Changing it re-ranks instantly – no new simulation needed.">
            Focus: <span class="mwia-focus-text">${focusText(gold)}</span>
            <span class="mwia-focus-row">XP <input type="range" min="0" max="100" step="10" value="${gold}" data-setting="goldWeight"> Gold</span></label>`);
    }
    if (fields.includes("accuracy")) {
        parts.push(`<label>Accuracy <select data-setting="accuracy">${Object.entries(ACCURACY)
            .map(([k, v]) => `<option value="${k}" ${s.accuracy === k ? "selected" : ""}>${v.label}</option>`)
            .join("")}</select></label>`);
    }
    if (fields.includes("risk")) {
        parts.push(`<label title="A death costs 150 s of waiting, which is already counted in XP/h and profit. Allowing rare deaths lets harder, more rewarding zones and upgrades be recommended.">
            Deaths <span class="mwia-focus-row"><input type="checkbox" data-setting="acceptRareDeaths" ${s.acceptRareDeaths ? "checked" : ""}> Accept rare deaths (≤ ${dec(0.5, 1)}/h)</span></label>`);
    }
    if (fields.includes("maxTier")) {
        parts.push(`<label title="Difficulty tier. Higher tiers give more XP but are more dangerous.">Max tier <select data-setting="maxTier">${[0, 1, 2, 3, 4, 5]
            .map((t) => `<option value="${t}" ${Number(s.maxTier) === t ? "selected" : ""}>T${t}</option>`)
            .join("")}</select></label>`);
    }
    if (fields.includes("budget")) {
        parts.push(`<label title="E.g. 500k, 2M, 1.5M">Budget (coins) <input data-setting="budget" type="text" inputmode="decimal" size="8" value="${coinsInput(Number(s.budget) || 0)}"></label>`);
    }
    if (fields.includes("spending")) {
        parts.push(`<label title="How much a purchase must give back. Frugal: at least +10% XP/h per 1M coins, Balanced: +3%, All in: anything within budget.">Spending <select data-setting="spending">${Object.entries(SPENDING)
            .map(([k, v]) => `<option value="${k}" ${s.spending === k ? "selected" : ""}>${v.label}</option>`)
            .join("")}</select></label>`);
    }
    if (fields.includes("zone")) {
        const options = ['<option value="auto">Automatic (best safe zone)</option>'];
        for (const zone of getClientData() ? combatZones() : []) {
            for (let t = 0; t <= Math.min(5, zone.maxDifficulty ?? 0); t++) {
                const value = `${zone.hrid}#${t}`;
                options.push(`<option value="${value}" ${s.zone === value ? "selected" : ""}>${esc(zone.name)}${t ? " T" + t : ""}</option>`);
            }
        }
        parts.push(`<label>Zone <select data-setting="zone">${options.join("")}</select></label>`);
    }
    return `<div class="mwia-settings">${parts.join("")}</div>`;
}

function renderOverview() {
    const data = getClientData();
    if (!state.character) {
        return `<p>The script hasn't seen your character yet. It reads it when the game connects, so <b>reload the page (F5)</b> with the script enabled.</p>`;
    }
    if (!data) {
        return `<p>Game data isn't loaded yet.</p><button class="mwia-btn" data-action="load">Load</button>`;
    }
    const profile = currentProfile();
    const slots = slotCounts(profile, data);
    const levels = profile.levels;
    const tips = overviewTips(profile, slots, data);

    const levelRows = COMBAT_SKILLS.map((s) => `<tr><td>${SKILL_NAMES[s]}</td><td class="mwia-num">${levels[s]}</td></tr>`).join("");
    const gearRows = Object.keys(SLOT_NAMES)
        .filter((t) => t !== "two_hand" || profile.equipment.two_hand)
        .filter((t) => t !== "main_hand" || !profile.equipment.two_hand)
        .map((t) => `<tr><td>${SLOT_NAMES[t]}</td><td>${gearLabel(profile.equipment[t])}</td></tr>`)
        .join("");
    const abilityRows = [];
    for (let i = 1; i <= Math.max(slots.abilities, 1); i++) {
        const a = profile.abilities[i];
        abilityRows.push(
            `<li>${i <= slots.abilities ? (a ? `${esc(abilityName(a.hrid))} <span class="mwia-dim">lvl ${a.level}</span>` : '<span class="mwia-warn">empty slot</span>') : '<span class="mwia-dim">locked</span>'}</li>`
        );
    }
    const consumableList = (list, count) =>
        Array.from({ length: count }, (_, i) => `<li>${list[i] ? esc(itemName(list[i])) : '<span class="mwia-warn">empty slot</span>'}</li>`).join("");

    return `
    <div class="mwia-grid">
      <section><h3>Levels</h3>
        <table class="mwia-table">${levelRows}
        <tr class="mwia-sum"><td>Combat level</td><td class="mwia-num">${dec(combatLevel(levels), 1)}</td></tr></table></section>
      <section><h3>Equipment</h3><table class="mwia-table">${gearRows}</table></section>
      <section><h3>Abilities (${slots.abilities} slot${slots.abilities === 1 ? "" : "s"})</h3><ol>${abilityRows.join("")}</ol>
        <h3>Food (${slots.food})</h3><ul>${consumableList(profile.food, slots.food)}</ul>
        <h3>Drinks (${slots.drinks})</h3><ul>${consumableList(profile.drinks, slots.drinks)}</ul></section>
    </div>
    <h3>Tips for your character</h3>
    <ul class="mwia-tips">${tips.map((t) => `<li class="mwia-tip-${t.level}">${t.html}</li>`).join("")}</ul>
    <p class="mwia-dim">Next step: the <b>Where to fight</b> tab, then <b>Upgrades</b>.</p>`;
}

function overviewTips(profile, slots, data) {
    const tips = [];
    const weapon = profile.equipment.main_hand || profile.equipment.two_hand;
    const weaponStats = weapon ? data.itemDetailMap[weapon.hrid]?.equipmentDetail?.combatStats : null;
    if (!weapon) {
        tips.push({ level: "bad", html: "You have no weapon. A mage needs a <b>staff</b> (e.g. Wooden/Birch/Cedar Water/Nature/Fire Staff)." });
    } else if (!(weaponStats?.combatStyleHrids || []).includes("/combat_styles/magic")) {
        tips.push({ level: "bad", html: `${esc(itemName(weapon.hrid))} is not a magic weapon, so you don't train Magic. Switch to a staff.` });
    }
    const emptyAbilities = [];
    for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilities.push(i);
    if (emptyAbilities.length) {
        tips.push({ level: "bad", html: `You have ${emptyAbilities.length} empty ability slot(s). Abilities are a mage's main source of damage – see <b>Upgrades</b> for which one pays off.` });
    }
    const requirements = data.abilitySlotsLevelRequirementList || [];
    const nextSlotLevel = requirements.slice(2).find((lvl) => lvl > profile.levels.intelligence);
    if (nextSlotLevel && nextSlotLevel - profile.levels.intelligence <= 8) {
        tips.push({ level: "info", html: `At Intelligence ${nextSlotLevel} you unlock another ability slot (you're at ${profile.levels.intelligence}).` });
    }
    if (!profile.food.slice(0, slots.food).some(Boolean)) {
        tips.push({ level: "bad", html: "You have no food for combat. Food is eaten automatically when you lose HP and keeps you from dying." });
    }
    if (profile.drinks.slice(0, slots.drinks).some((d) => !d)) {
        tips.push({ level: "warn", html: "You have an empty drink slot. Coffee gives a 5-minute buff – <b>Upgrades</b> shows whether it pays off for you." });
    }
    const badArmor = Object.entries(profile.equipment)
        .filter(([type]) => !["main_hand", "two_hand"].includes(type))
        .filter(([, gear]) => (data.itemDetailMap[gear.hrid]?.equipmentDetail?.combatStats?.magicAccuracy || 0) < 0)
        .map(([, gear]) => itemName(gear.hrid));
    if (badArmor.length) {
        tips.push({ level: "warn", html: `${badArmor.map(esc).join(", ")} lower(s) your magic accuracy. Mage clothing (cotton/linen/…) is usually better – check <b>Upgrades</b>.` });
    }
    if (!profile.equipment.charm) {
        tips.push({ level: "info", html: "No charm. A <b>Magic Charm</b> sends 70% of your combat XP to Magic (otherwise it's split across five skills) – wear one if Magic is your priority." });
    }
    if (!tips.length) tips.push({ level: "ok", html: "No obvious gaps. Run the zone and upgrade analyses to fine-tune." });
    return tips;
}

const CAPPED_TITLE = "You kill faster than new monsters appear (one encounter per 3 s at most), so more damage barely helps here";
const cappedBadge = (r) => (isSpawnCapped(r) ? ` <span class="mwia-warn" title="${CAPPED_TITLE}">⏱</span>` : "");

function renderZones() {
    let html = `<p>Simulates your current setup against every combat zone and shows where you get the most XP or gold per hour
      <b>${ui.settings.acceptRareDeaths ? "while dying rarely at most" : "without dying"}</b>.</p>
      ${settingsHtml(["focus", "risk", "accuracy", "maxTier"])}
      <button class="mwia-btn" data-action="zones" ${ui.busy ? "disabled" : ""}>Run zone analysis</button>`;
    if (!ui.zoneResults) return html;

    const goal = zoneGoal(ui.zoneResults, ui.settings);
    const best = pickBestZone(ui.zoneResults, ui.settings);
    const profile = currentProfile();
    const current =
        profile?.currentZone && ui.zoneResults.find((z) => z.zone.zoneHrid === profile.currentZone.zoneHrid && z.zone.tier === profile.currentZone.tier);
    const summary = (r) => `<b>${int(xpValue(r))} ${XP_LABEL}</b> and <b>${coins(perDay(r.profit))}</b> profit/day`;
    if (best) {
        html += `<div class="mwia-reco"><b>Recommendation:</b> ${zoneLabel(best.zone)} – about ${summary(best.result)}, ${deathBadge(best.result.deaths)}.`;
        if (isSpawnCapped(best.result)) {
            html += `<br>⏱ You kill monsters here as fast as they appear, so this zone is too easy for you.
              ${Number(ui.settings.maxTier) < 5 ? "Raise <b>Max tier</b> and run again – a harder tier gives more XP per kill." : "Try zones with tougher monsters."}`;
        }
        if (current && current !== best) html += `<br>You're currently fighting in ${zoneLabel(current.zone)}: ${summary(current.result)}.`;
        html += `</div>`;
    }
    const bestScore = best ? score(best.result, goal) : 1;
    const rows = [...ui.zoneResults].sort((a, b) => score(b.result, goal) - score(a.result, goal));
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Zone</th><th class="mwia-num" title="How well the zone fits your focus; 100 = the recommended zone">Match</th>
      <th class="mwia-num">${XP_LABEL}</th><th class="mwia-num" title="Value of drops (bid price) minus food/drink cost, per day">Profit/day</th>
      <th class="mwia-num">Kills/h</th><th>Risk</th></tr></thead><tbody>`;
    for (const z of rows.slice(0, 40)) {
        const r = z.result;
        const match = bestScore > 0 ? int((100 * score(r, goal)) / bestScore) : "–";
        html += `<tr class="${z === best ? "mwia-best" : ""}"><td>${zoneLabel(z.zone)}${cappedBadge(r)}</td><td class="mwia-num">${match}</td><td class="mwia-num">${int(xpValue(r))}</td>
          <td class="mwia-num">${coins(perDay(r.profit))}</td><td class="mwia-num">${dec(r.killsTotal, 0)}</td><td>${deathBadge(r.deaths)}</td></tr>`;
    }
    html += `</tbody></table><p class="mwia-dim">Simulated ${int(Math.max(1, runSettings().hours / 2))} h per zone. These are estimates – differences of a few percent are noise.
      ⏱ = you kill faster than monsters appear there.</p>`;
    return html;
}

function upgradeNotes(c, base) {
    const notes = [];
    if (c.owned && c.cost === 0) notes.push('<span class="mwia-ok">you own it</span>');
    if (c.deathsDelta < 0 && base.deaths > 0) notes.push(`<span class="mwia-ok">fewer deaths</span>`);
    if (!c.safe) notes.push(`<span class="mwia-bad">more deaths</span>`);
    return notes.join(" ");
}

// ---------- MWITools shopping cart ----------

// What to put in the cart for one suggestion. Consumables: enough for a day of combat.
function cartItems(c) {
    const forOneDay = (hrid) => Math.max(1, Math.ceil(perDay(c.result?.consumables?.[hrid] || 0)));
    if (c.kind === "abilityLevel") return [{ hrid: c.bookHrid, quantity: c.books }];
    if (c.kind === "ability") return c.cost ? [{ hrid: c.bookHrid, quantity: 1 }] : [];
    if (c.kind === "food" || c.kind === "drinks") return c.remove ? [] : [{ hrid: c.hrid, quantity: forOneDay(c.hrid) }];
    const items = c.cost ? [{ hrid: c.hrid, quantity: 1, enhancementLevel: c.enhancementLevel || 0 }] : [];
    if (c.extraFood) items.push({ hrid: c.extraFood, quantity: forOneDay(c.extraFood) });
    return items;
}

const cartLabel = (i) => `${i.quantity ? i.quantity + "× " : ""}${itemName(i.hrid)}${i.enhancementLevel ? " +" + i.enhancementLevel : ""}`;

function cartButton(items, label = "🛒 Add") {
    if (!items.length) return "";
    const id = String(ui.cartItems.size + 1);
    ui.cartItems.set(id, items);
    return `<button class="mwia-cart-btn" data-action="cart-add" data-cart="${id}" title="Add to the MWITools shopping cart: ${esc(items.map(cartLabel).join(", "))}">${label}</button>`;
}

async function sendToCart(id) {
    const items = ui.cartItems.get(id);
    if (items) await sendItemsToCart(items);
}

async function sendItemsToCart(items) {
    try {
        const outcome = await addToCart(ui.win, items);
        const names = (list) => list.map(cartLabel).join(", ");
        const parts = [];
        if (outcome.added.length) parts.push(`added ${names(outcome.added)}`);
        if (outcome.updated.length) parts.push(`topped up ${names(outcome.updated)}`);
        if (outcome.present.length) parts.push(`${names(outcome.present)} already in the cart`);
        if (outcome.failed.length) parts.push(`could not add ${names(outcome.failed)}`);
        ui.notice = { level: outcome.failed.length ? "warn" : "ok", text: "Shopping cart: " + parts.join("; ") + "." };
    } catch (error) {
        ui.notice = { level: "bad", text: error.message };
    }
    render();
}

function renderUpgrades() {
    let html = `<p>Tests one change at a time (gear incl. enhanced +N copies, new abilities, levelling abilities with extra books, drinks, food) in the chosen zone
      and measures how much it improves your focus – XP per hour, gold per hour, or a mix. Buy the things that give the most per coin first.</p>
      ${settingsHtml(["focus", "zone", "budget", "spending", "risk", "accuracy"])}
      <button class="mwia-btn" data-action="upgrades" ${ui.busy ? "disabled" : ""}>Analyze upgrades</button>`;
    const result = ui.upgradeResult;
    if (!result) return html;
    const base = result.base;
    const label = XP_LABEL;
    html += `<p>Zone: ${zoneLabel(result.zone)}. Now: <b>${int(xpValue(base))} ${label}</b>, profit <b>${coins(perDay(base.profit))}/day</b>
      (loot ${coins(perDay(base.loot))} − food/drinks ${coins(perDay(base.cost))}), ${deathBadge(base.deaths)}.</p>`;
    if (isSpawnCapped(base)) {
        html += `<p class="mwia-reco">⏱ In ${zoneLabel(result.zone)} you kill monsters as fast as they appear, so upgrades that add damage hardly matter here.
          A harder zone or tier is the biggest improvement – run <b>Where to fight</b> with a higher Max tier.</p>`;
    }
    const bestNow = ui.settings.zone === "auto" && pickBestZone(ui.zoneResults, ui.settings);
    if (bestNow && (bestNow.zone.zoneHrid !== result.zone.zoneHrid || bestNow.zone.tier !== result.zone.tier)) {
        html += `<p class="mwia-reco">With this focus the best zone is ${zoneLabel(bestNow.zone)}, not ${zoneLabel(result.zone)}. Analyze again to see upgrades for that zone.</p>`;
    }

    const plan = ui.plan;
    const uncertain = uncertainCandidates(ui.upgradeRaw, ui.settings).length;
    if (uncertain) {
        html += `<p>${uncertain} promising suggestion${uncertain === 1 ? " is" : "s are"} not yet beyond doubt.
          <button class="mwia-btn" data-action="refine" ${ui.busy ? "disabled" : ""}>🎯 Run more simulations for them</button></p>`;
    }
    html += `<h3>📋 Recommended shopping list</h3>`;
    if (!plan || (!plan.picks.length && !plan.drink && !plan.food)) {
        html += `<p>Nothing within budget gave a reliable improvement that is worth its price. Try Spending "All in", raise the budget, try another zone,
          or just keep levelling – at some levels that really is the best move.</p>`;
    } else {
        html += `<ol class="mwia-plan">`;
        for (const p of plan.picks) {
            let what;
            if (p.kind === "abilityLevel") {
                what = `${p.books}× <b>${esc(itemName(p.bookHrid))}</b> and read them: ${esc(abilityName(p.hrid))} level ${p.fromLevel} → ${p.level}`;
            } else if (p.kind === "ability") {
                what = `ability <b>${esc(abilityName(p.hrid))}</b>${p.cost ? ` (buy the book ${esc(itemName(p.bookHrid))})` : ` (level ${p.level})`}`;
            } else {
                what = `<b>${gearLabel(p)}</b> in ${SLOT_NAMES[p.slot]}${p.extraFood ? ` and put <b>${esc(itemName(p.extraFood))}</b> in the new food slot` : ""}`;
            }
            const replaces = p.replaces ? ` – replaces ${p.kind === "ability" ? esc(abilityName(p.replaces)) : gearLabel(p.replaces)}` : "";
            html += `<li>${p.cost ? "Buy" : "Use"} ${what}${replaces}: ${gainText(p)} ${p.cost ? `for ${coins(p.cost)}` : "(free)"} ${cartButton(cartItems(p))}</li>`;
        }
        for (const [kind, pick, max] of [["Food", plan.food, plan.foodMax], ["Drink", plan.drink, plan.drinkMax]]) {
            if (!pick) continue;
            if (pick.remove) {
                html += `<li>Stop using <b>${esc(itemName(pick.hrid))}</b> (empty that ${kind.toLowerCase()} slot): ${gainText(pick)},
                  saves about ${coins(perDay(-pick.costPerHourDelta))}/day`;
            } else {
                const where = pick.replaces ? `instead of ${esc(itemName(pick.replaces))}` : "in an empty slot";
                const money = pick.costPerHourDelta < 0 ? `saves about ${coins(perDay(-pick.costPerHourDelta))}/day` : `costs about ${coins(perDay(pick.costPerHourDelta))}/day extra`;
                html += `<li>${kind} <b>${esc(itemName(pick.hrid))}</b> ${where}: ${gainText(pick)}, ${money}
                  <span class="mwia-dim">(optional – a running cost)</span> ${cartButton(cartItems(pick), "🛒 1 day")}`;
            }
            if (dropsHpFood(pick)) {
                html += `<br><span class="mwia-warn">You don't need HP food in this zone, but keep some at hand – put it back before you move to a harder zone or tier.</span>`;
            }
            if (max) html += `<br><span class="mwia-dim">Biggest gain: ${esc(itemName(max.hrid))} (${gainText(max)}) at ${coins(perDay(max.costPerHourDelta))}/day.</span>`;
            html += `</li>`;
        }
        html += `</ol><p>Total one-time cost: <b>${coins(plan.spent)}</b> of your ${coins(Number(ui.settings.budget) || 0)} budget.
          ${cartButton(plan.picks.flatMap(cartItems), "🛒 Add all purchases to cart")}</p>`;
        if (ui.verified) {
            const v = ui.verified;
            const before = xpValue(v.base);
            const after = xpValue(v.planned);
            html += `<div class="mwia-reco">Everything combined (simulated): <b>${int(before)} → ${int(after)} ${label}</b> (${pct(after / Math.max(1, before) - 1)}),
              profit <b>${coins(perDay(v.base.profit))} → ${coins(perDay(v.planned.profit))}</b> per day (food/drinks ${coins(perDay(v.base.cost))} → ${coins(perDay(v.planned.cost))}),
              deaths ${dec(v.base.deaths, 2)} → ${dec(v.planned.deaths, 2)} per hour.
              <br><span class="mwia-dim">Run the zone analysis again after buying – with better gear a harder zone may become the best.</span></div>`;
        }
    }

    html += upgradeTable("Equipment", result.gear, base, (c) => SLOT_NAMES[c.slot], (c) => gearLabel(c) + (c.extraFood ? ` <span class="mwia-dim">+ ${esc(itemName(c.extraFood))} in new slot</span>` : ""), (c) => (c.replaces ? gearLabel(c.replaces) : "–"), "Item");
    html += upgradeTable(
        "Abilities",
        result.abilities,
        base,
        (c) => `Slot ${c.slot.replace("ability", "")}`,
        (c) =>
            esc(abilityName(c.hrid)) +
            (c.kind === "abilityLevel"
                ? ` <span class="mwia-dim">lvl ${c.fromLevel} → ${c.level} (${c.books} books)</span>`
                : ` <span class="mwia-dim">lvl ${c.level}</span>`),
        (c) => (c.kind === "abilityLevel" ? '<span class="mwia-dim">level up</span>' : c.replaces ? esc(abilityName(c.replaces)) : "–"),
        "Ability"
    );
    if (!getClientData().levelExperienceTable) {
        html += `<p class="mwia-dim">The game data has no level table, so levelling up abilities with extra books could not be evaluated.</p>`;
    }
    html += consumableTable("Drinks", result.drinks, base);
    html += consumableTable("Food", result.food, base);
    if (result.food.some((c) => !c.safe && c.delta > 0) && result.gear.some((c) => c.extraFood && c.safe && c.delta > 0)) {
        html += `<p class="mwia-reco">Some food gives more XP but makes you die, because it replaces your only HP food. A bigger pouch gives an extra
          food slot so you can keep both – see the pouch row under Equipment.</p>`;
    }
    html += `<p class="mwia-dim">Prices = lowest sell order on the market right now, also for enhanced (+N) gear. "Gain" = improvement of your focus as a share of
      what you have now (XP/h and/or profit/h, weighted by the slider); "Gain per 1M" = gain per million coins spent. Profit counts loot minus food/drink cost,
      so with a gold focus expensive drinks drop out by themselves.
      Items you already own cost 0. "Sure" = how certain it is that a suggestion is a real improvement and not luck; faded rows are below ${Math.round(CONFIDENCE_LEVEL * 100)}%
      and never go on the shopping list. Changes that make you die more often than you accept
      (✖) are never put on the shopping list.</p>`;
    return html;
}

// True when a food suggestion leaves you without any HP-restoring food.
function dropsHpFood(c) {
    if (c.kind !== "food") return false;
    const items = getClientData().itemDetailMap;
    const heals = (hrid) => (items[hrid]?.consumableDetail?.hitpointRestore || 0) > 0;
    const before = currentProfile()?.food || [];
    const after = c.profile?.food || [];
    return before.some((h) => h && heals(h)) && !after.some((h) => h && heals(h));
}

// "+4.2% Combat XP/h", "+120k profit/day" or both, depending on the focus.
function gainText(c) {
    const gold = ui.upgradeResult.goal.gold;
    const profit = `${signed(coins, perDay(c.profitDelta))} profit/day`;
    if (gold === 0) return `${pct(c.deltaPct)} ${XP_LABEL}`;
    if (gold === 1) return profit;
    return `${pct(c.deltaPct)} gain (${signed(int, c.xpDelta)} ${XP_LABEL}, ${profit})`;
}

function confidenceCell(c) {
    const value = Math.round(c.confidence * 100);
    const cls = c.confidence >= CONFIDENCE_LEVEL ? "mwia-ok" : c.confidence >= 0.7 ? "mwia-warn" : "mwia-dim";
    return `<span class="${cls}" title="Chance that this really improves your focus, from ${c.runs.length} paired simulations">${value}%</span>`;
}

const CONF_TITLE = "How sure we are that this is an improvement and not luck (paired t-test over several simulations with different random seeds). Only ≥ 90% goes on the shopping list.";

const GAIN_TITLE = "Improvement of your focus as a share of what you have now: XP/h and profit/h, weighted by the XP–Gold slider";

function upgradeTable(title, list, base, slotText, nameHtml, replacesHtml, nameHeader) {
    const shown = list.filter((c) => c.delta > 0).slice(0, 20);
    let html = `<h3>${title}</h3>`;
    if (!shown.length) return html + `<p class="mwia-dim">Nothing within budget improved your focus.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Slot</th><th>${nameHeader}</th><th>Replaces</th><th class="mwia-num">Price</th>
      <th class="mwia-num">+${XP_LABEL}</th><th class="mwia-num">+Profit/day</th><th class="mwia-num" title="${GAIN_TITLE}">Gain</th>
      <th class="mwia-num">Gain per 1M</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th></th><th></th></tr></thead><tbody>`;
    for (const c of shown) {
        const efficiency = c.cost > 0 ? pct((c.delta / c.cost) * 1e6) : "∞";
        html += `<tr class="${c.significant ? "" : "mwia-faded"}"><td>${slotText(c)}</td><td>${nameHtml(c)}</td><td>${replacesHtml(c)}</td>
          <td class="mwia-num">${c.cost ? coins(c.cost) : "0"}</td><td class="mwia-num">${signed(int, c.xpDelta)}</td><td class="mwia-num">${signed(coins, perDay(c.profitDelta))}</td>
          <td class="mwia-num">${pct(c.deltaPct)}</td><td class="mwia-num">${efficiency}</td><td class="mwia-num">${confidenceCell(c)}</td>
          <td>${upgradeNotes(c, base)}</td><td>${cartButton(cartItems(c))}</td></tr>`;
    }
    return html + `</tbody></table>`;
}

function consumableTable(title, list, base) {
    const shown = list.filter((c) => c.delta > 0 || c.deathsDelta < 0).slice(0, 10);
    let html = `<h3>${title}</h3>`;
    if (!shown.length) return html + `<p class="mwia-dim">No ${title.toLowerCase()} noticeably improved your focus.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>${title === "Food" ? "Food" : "Drink"}</th><th>Replaces</th><th class="mwia-num">Unit price</th>
      <th class="mwia-num">Extra cost/day</th><th class="mwia-num">+${XP_LABEL}</th><th class="mwia-num" title="Includes the extra food/drink cost">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th class="mwia-num">Deaths/h</th><th class="mwia-num" title="Extra cost per 1000 extra XP">Cost per 1000 XP</th><th></th></tr></thead><tbody>`;
    for (const c of shown) {
        const per1000 =
            c.xpDelta > 0 ? coins((c.costPerHourDelta / c.xpDelta) * 1000)
            : c.remove && c.xpDelta < 0 ? `saves ${coins((c.costPerHourDelta / c.xpDelta) * 1000)}`
            : "–";
        const name =
            (c.remove ? `<i>Stop using</i> ${esc(itemName(c.hrid))}` : esc(itemName(c.hrid))) +
            (dropsHpFood(c) ? ' <span class="mwia-warn" title="Leaves you without HP food – fine in this zone, risky in harder ones">⚠ no HP food</span>' : "");
        html += `<tr class="${c.significant ? "" : "mwia-faded"}"><td>${name}</td><td>${c.replaces ? esc(itemName(c.replaces)) : "–"}</td>
          <td class="mwia-num">${c.remove ? "–" : coins(askPrice(c.hrid))}</td><td class="mwia-num">${coins(perDay(c.costPerHourDelta))}</td><td class="mwia-num">${signed(int, c.xpDelta)}</td>
          <td class="mwia-num">${signed(coins, perDay(c.profitDelta))}</td><td class="mwia-num">${pct(c.deltaPct)}</td><td class="mwia-num">${confidenceCell(c)}</td>
          <td class="mwia-num ${c.safe ? "" : "mwia-bad"}">${dec(c.result.deaths, 2)}${c.safe ? "" : " ✖"}</td><td class="mwia-num">${per1000}</td>
          <td>${cartButton(cartItems(c), "🛒 1 day")}</td></tr>`;
    }
    return html + `</tbody></table>`;
}

function renderGuide() {
    return `<div class="mwia-guide">
    <h3>How combat XP works</h3>
    <p>Every kill gives XP. As a mage, <b>30%</b> goes to Magic and the remaining <b>70%</b> is split evenly between Stamina, Intelligence,
    Attack, Defense and Magic – so Magic gets 44% in total. With a <b>charm</b> that has a focus (e.g. Trainee Magic Charm) the whole 70% share
    goes to that skill instead. More damage and fewer deaths mean more kills per hour, and therefore more XP.</p>
    <h3>What the skills do</h3>
    <ul>
      <li><b>Magic</b> – raises your magic max damage (both auto-attacks and abilities).</li>
      <li><b>Attack</b> – accuracy. Misses deal no damage at all.</li>
      <li><b>Intelligence</b> – max mana (10 × (10 + level)) and more ability slots (at levels 20, 50 and 90).</li>
      <li><b>Stamina</b> – max HP (10 × (10 + level)).</li>
      <li><b>Defense</b> – evasion against enemy attacks.</li>
    </ul>
    <h3>Abilities</h3>
    <p>A mage's auto-attack is weak – staves halve auto-attack damage. Most of your damage comes from <b>abilities</b> (e.g. Water Strike, Fireball,
    Entangle). They cost mana, are learned by reading an ability book (bought on the market) and get stronger as they level up, which happens
    when you use them or read more copies of the same book. Order matters: the topmost ability that can be cast goes first.</p>
    <h3>Food and drinks</h3>
    <p><b>Food</b> is eaten automatically according to its triggers (by default when you're missing enough HP/MP). HP food keeps you alive,
    MP food lets you keep casting abilities. <b>Drinks</b> (coffee) give a 5-minute buff, e.g. Magic Coffee (+Magic level)
    or Wisdom Coffee (+XP). A <b>pouch</b> gives extra food and drink slots.</p>
    <h3>What this script does</h3>
    <p>It reads your character from the game, fetches current market prices and runs combat simulations with the same engine as the community
    Combat Simulator (shykai/AmVoidGuy, MIT licence), but fed with the game's own current data. Every suggestion is tested by simulating
    several hours of combat with and without the change. These are estimates – reality can differ by a few percent.</p>
    <p class="mwia-dim">The script only reads data and shows suggestions. It never buys, equips or clicks anything for you.</p>
    </div>`;
}

// Needs no simulation, only game data and prices, which load on first open.
function renderSkillingTab() {
    if (!state.character) {
        return `<p>The script hasn't seen your character yet. It reads it when the game connects, so <b>reload the page (F5)</b> with the script enabled.</p>`;
    }
    if (getClientData() && pricesAge() !== null) return renderSkilling(ui.settings);
    const load = ui.skillingLoad;
    if (load?.error) {
        return `<div class="mwia-error">${esc(load.error)}</div><button class="mwia-btn" data-action="skilling-load">Try again</button>`;
    }
    if (!load?.loading) {
        ui.skillingLoad = { loading: true };
        Promise.all([loadClientData(ui.win), loadPrices()])
            .then(() => (ui.skillingLoad = null))
            .catch((error) => (ui.skillingLoad = { error: error.message || String(error) }))
            .finally(() => ui.tab === "skilling" && render());
    }
    return `<p class="mwia-dim">Loading game data and market prices…</p>`;
}

// The panel comes back by itself when the marketplace it opened is closed,
// scrolled to the row the player came from.
function returnAfterMarket() {
    clearInterval(ui.marketWatch);
    const started = Date.now();
    let seen = false;
    ui.marketWatch = setInterval(() => {
        if (!ui.root.classList.contains("mwia-hidden")) return clearInterval(ui.marketWatch);
        const open = [...document.querySelectorAll(MARKET_PANEL)].some(visible);
        if (open) seen = true;
        else if (seen) {
            clearInterval(ui.marketWatch);
            showPanel();
        } else if (Date.now() - started > MARKET_SHOW_MS) clearInterval(ui.marketWatch);
    }, MARKET_POLL_MS);
}

function showPanel() {
    ui.root.classList.remove("mwia-hidden");
    render();
    const row = ui.returnRow && ui.tab === "skilling" ? [...ui.root.querySelectorAll(".mwia-skill-row")].find((r) => r.dataset.hrid === ui.returnRow) : null;
    row?.scrollIntoView({ block: "start" });
    ui.returnRow = null;
}

// Opens a Skilling suggestion in the game with the count filled in; the player
// clicks the game's own button.
async function openWithCount(actionHrid, count) {
    const data = getClientData();
    const action = data?.actionDetailMap[actionHrid];
    if (!action || !count) return;
    ui.root.classList.add("mwia-hidden");
    if (await openAction(ui.win, action, data)) {
        const found = findActionPanel(action.name);
        if (found?.input) setReactInput(found.input, count);
        return;
    }
    ui.root.classList.remove("mwia-hidden");
    ui.notice = { level: "warn", text: `Could not open ${action.name} automatically. Open it yourself and enter ${count}. (${navDiagnostics()})` };
    render();
}

// Opens Enhancing or Alchemy in the game with the item (when you have it) and
// the target or count filled in; the player clicks the game's own button.
async function openLeveling(dataset) {
    const { item, kind, label } = dataset;
    const value = Number(dataset.value) || 0;
    const owned = [...state.items.values()].some((i) => i.itemHrid === item && i.itemLocationHrid === "/item_locations/inventory" && !i.enhancementLevel && i.count > 0);
    const hash = owned ? inventoryItemHash(state.character?.character?.id, item) : null;
    ui.root.classList.add("mwia-hidden");
    const opened = kind === "enhance" ? await openEnhancing(hash, value) : await openAlchemy(hash, label, value);
    if (opened === "item") return;
    ui.root.classList.remove("mwia-hidden");
    const what = kind === "enhance" ? `set the target to +${value}` : `pick ${label}${value ? ` and enter ${value}` : ""}`;
    ui.notice = opened === "page"
        ? { level: "info", text: `${owned ? "Opened the page but could not put the item in." : "You don't have the item yet – buy it first (🛒)."} Pick it in the game and ${what}.` }
        : { level: "warn", text: `Could not open it automatically. Open it yourself and ${what}. (${navDiagnostics()})` };
    render();
}

// ---------- events ----------

function onClick(event) {
    const target = event.target.closest("[data-action],[data-tab]");
    if (!target || !ui.root.contains(target)) return;
    if (target.dataset.tab) {
        ui.tab = target.dataset.tab;
        render();
        return;
    }
    switch (target.dataset.action) {
        case "close":
            ui.root.classList.add("mwia-hidden");
            break;
        case "zones":
            runTask(doZones);
            break;
        case "upgrades":
            runTask(doUpgrades);
            break;
        case "refine":
            runTask(doRefine);
            break;
        case "load":
            runTask(async () => {});
            break;
        case "skilling-load":
            ui.skillingLoad = null;
            render();
            break;
        case "skilling-make":
            ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
            openWithCount(target.dataset.hrid, Number(target.dataset.count));
            break;
        case "skilling-level":
            ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
            openLeveling(target.dataset);
            break;
        case "skilling-train": {
            const plan = JSON.parse(target.dataset.plan);
            ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
            ui.root.classList.add("mwia-hidden");
            startTrain({ goals: [{ kind: "item", hrid: plan.product, target: plan.target }], policies: new Map(plan.made.map((hrid) => [hrid, "chain"])), title: plan.title });
            break;
        }
        case "skilling-cart":
            sendItemsToCart(JSON.parse(target.dataset.teas || "[]"));
            break;
        case "skilling-market":
            ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
            if (openMarketplace(ui.win, target.dataset.item)) {
                ui.root.classList.add("mwia-hidden");
                returnAfterMarket();
            } else {
                ui.notice = { level: "warn", text: "Could not open the marketplace automatically. Open it yourself and pick the item." };
                render();
            }
            break;
        case "skilling-all":
            toggleShowAll();
            render();
            break;
        case "cart-add":
            sendToCart(target.dataset.cart);
            break;
        case "cancel":
            ui.pool?.cancel();
            break;
    }
}

function onChange(event) {
    const key = event.target.dataset?.setting;
    if (!key) return;
    if (key === "skillingSellCap") {
        const text = event.target.value.trim();
        const value = text === "" ? 0 : parseCoins(text);
        event.target.classList.toggle("mwia-invalid", value === null);
        if (value === null) return;
        ui.settings.skillingSellCap = value;
    } else if (key === "budget") {
        const value = parseCoins(event.target.value);
        event.target.classList.toggle("mwia-invalid", value === null);
        if (value === null) return;
        ui.settings.budget = value;
        event.target.value = coinsInput(value);
    } else if (key === "acceptRareDeaths") {
        ui.settings.acceptRareDeaths = event.target.checked;
    } else if (key === "goldWeight") {
        ui.settings.goldWeight = Number(event.target.value) / 100;
    } else {
        ui.settings[key] = event.target.value;
    }
    saveSettings();
    if (key.startsWith("skilling")) {
        render();
        return;
    }
    // Re-rating and re-planning are cheap; only the combined check needs a new analysis.
    if (["budget", "spending", "goldWeight", "acceptRareDeaths"].includes(key) && !ui.busy) {
        if (["goldWeight", "acceptRareDeaths"].includes(key)) rerateUpgrades();
        else if (ui.upgradeResult) {
            ui.plan = buildPlan(ui.upgradeResult, Number(ui.settings.budget) || 0, ui.settings.spending);
            ui.verified = null;
        }
        render();
    }
}

export function mountUI(win, workerSource) {
    ui.win = win;
    ui.workerSource = workerSource;

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const button = document.createElement("button");
    button.className = "mwia-launcher";
    button.title = "Combat Advisor";
    button.textContent = "⚔ Advisor";
    document.body.appendChild(button);
    makeDraggable(button);

    const root = document.createElement("div");
    root.className = "mwia-panel mwia-hidden";
    root.innerHTML = `
      <div class="mwia-header">
        <div><b>⚔ Combat Advisor</b> <span class="mwia-status mwia-dim"></span></div>
        <button class="mwia-link" data-action="close" title="Close">✕</button>
      </div>
      <nav class="mwia-tabs">
        <button class="mwia-tab" data-tab="overview">Overview</button>
        <button class="mwia-tab" data-tab="zones">Where to fight</button>
        <button class="mwia-tab" data-tab="upgrades">Upgrades</button>
        <button class="mwia-tab" data-tab="skilling">Skilling</button>
        <button class="mwia-tab" data-tab="guide">Guide</button>
      </nav>
      <div class="mwia-body"></div>`;
    document.body.appendChild(root);
    const gameDeps = {
        settings: () => ui.settings,
        prepare: async () => {
            await loadClientData(ui.win);
            await loadPrices();
        },
        addToCart: (items) => addToCart(ui.win, items),
    };
    startConsumableGuide(gameDeps);
    startToolNotice(gameDeps);
    startTeaSlots(gameDeps);
    ui.root = root;

    root.addEventListener("click", onClick);
    root.addEventListener("change", onChange);
    root.addEventListener("toggle", rememberToggle, true);
    enableTapTips(root);
    // Live label while dragging the XP–Gold slider; the re-rating happens on "change".
    root.addEventListener("input", (event) => {
        if (!["goldWeight", "skillingGold"].includes(event.target.dataset?.setting)) return;
        const label = event.target.closest(".mwia-focus")?.querySelector(".mwia-focus-text");
        if (label) label.textContent = focusText(Number(event.target.value));
    });
    button.addEventListener("click", async () => {
        const opening = root.classList.contains("mwia-hidden");
        if (!opening) {
            root.classList.add("mwia-hidden");
            return;
        }
        if (!getClientData()) {
            try {
                await loadClientData(win);
            } catch (error) {
                ui.error = error.message;
            }
        }
        showPanel();
    });
    // New price history can change the Skilling tab's price warnings.
    onHistoryChange(() => {
        if (!root.classList.contains("mwia-hidden") && !ui.busy && ui.tab === "skilling") render();
    });
    onStateChange(() => {
        if (!root.classList.contains("mwia-hidden") && !ui.busy) {
            root.querySelector(".mwia-status").innerHTML = statusLine();
        }
    });
}
