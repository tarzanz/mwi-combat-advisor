// The in-game panel.

import { preferBuyLimits } from "./buy-limits.js";
import { startJobLog } from "./job-log.js";
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
    switchStyle,
    verifyPlan,
} from "./analysis.js";
import { selfEnhanceCosts } from "./enhancing.js";
import { skillingCharacter } from "./skilling.js";
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
    onPricesLoaded,
    pricesAge,
} from "./game-data.js";
import { onStateChange, state } from "./game-state.js";
import { COMBAT_SKILLS, STYLE_NAMES, applyLoadout, buildProfile, chooseLoadout, combatLevel, combatLoadouts, slotCounts, styleSkills, weaponOf, weaponStyle } from "./profile.js";
import { experienceOf, nextPouchGoal, xpToNextLevel } from "./levels.js";
import { SimPool } from "./pool.js";
import { CSS } from "./style.js";
import { coinsInput, esc, parseCoins } from "./format.js";
import { addToCart } from "./mwitools-cart.js";
import { rememberToggle, renderSkilling, skillingExportLines, skillingMarket, toggleShowAll } from "./skilling-ui.js";
import { exportClicked, setExportContext } from "./export.js";
import { onHistoryChange } from "./price-history-ui.js";
import { rememberCombatSetup, startConsumableGuide } from "./consumable-guide.js";
import { startToolNotice } from "./tool-notice.js";
import { startTeaSlots } from "./tea-slots.js";
import { startEnhancePlan } from "./enhance-plan-ui.js";
import { findActionPanel, inventoryItemHash, navDiagnostics, openAction, openAlchemy, openEnhancing, openMarketplace, setReactInput, visible } from "./game-nav.js";
import { enableTapTips, isTouch, labelTableCells, makeDraggable } from "./touch.js";
import { startTrain } from "./train-ui.js";
import { describeTriggers } from "./triggers.js";
import { startTriggerWindow, triggerWindowReport, watchTriggerClicks } from "./trigger-window.js";
import { marketAlerts, renderMarket, toggleKeep, toggleShowAllMarket } from "./market-ui.js";
import { analyzeImprovements, analyzeLabyrinth, buildLoadout, chosenCrates, floorLevel, labyrinthLoadouts, slottedCrate } from "./labyrinth.js";
import { buildStyleSetting, labyrinthExportLines, renderLabyrinth } from "./labyrinth-ui.js";
import { labyrinthReport } from "./labyrinth-read.js";

const SETTINGS_KEY = "mwia-settings";
const DEFAULT_SETTINGS = { goldWeight: 0, countLevels: false, combatGear: "auto", combatStyle: "current", acceptRareDeaths: false, accuracy: "normal", budget: 2000000, spending: "balanced", maxTier: 1, zone: "auto", skillingSkill: "all", skillingSellAt: "ask", skillingTeas: "current", skillingMode: "away", skillingGold: 100, labyCoffee: "slots", labyFood: "slots", labyLevel: 20 };

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
    zoneStarter: null, // the weapon zones were simulated with when fighting as another style
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
    marketLoading: null, // promise while the Market tab loads game data and prices
    launcher: null, // the 🧭 button
    labResult: null, // Labyrinth: win rate by room level against each monster
    labImprove: null, // Labyrinth: what takes you further
    labBuild: null, // Labyrinth: a loadout built for one attack style's rooms
    labSetups: null, // Labyrinth: the loadouts the last check compared
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

// Combat XP/h, or levels a day with "count levels".
const countingLevels = () => !!ui.settings.countLevels && Array.isArray(getClientData()?.levelExperienceTable);
const xpLabel = () => (countingLevels() ? "Levels/day" : "Combat XP/h");
const xpNum = (v) => (countingLevels() ? dec(perDay(v), 2) : int(v));

// ---------- data ----------

// The character as it fights: the gear it wears, or a saved combat loadout (Gear from).
function currentProfile() {
    const data = getClientData();
    if (!state.character || !data) return null;
    const profile = buildProfile(state.character, state.items, data);
    return applyLoadout(profile, chooseLoadout(state.character, ui.settings.combatGear), state.items, data);
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
            console.error("[MWI Advisor]", error);
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

// The character as it would fight: with a weapon for the chosen style (bought or from the inventory).
function fightingProfile() {
    const profile = currentProfile();
    const style = ui.settings.combatStyle;
    if (!profile || !STYLE_NAMES[style]) return { profile, starter: null };
    const switched = switchStyle(profile, style, Number(ui.settings.budget) || 0);
    if (switched.missing) throw new Error(`No ${STYLE_NAMES[style]} weapon you can wear is for sale within your budget.`);
    return switched;
}

async function doZones() {
    const { profile, starter } = fightingProfile();
    ui.zoneStarter = starter;
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

// The setups the Labyrinth tab compares: every saved combat (and Labyrinth) loadout, and
// what you wear now when no loadout is the same. The game's automation can put on a
// loadout for each room type.
function labyrinthSetups() {
    const data = getClientData();
    if (!state.character || !data) return [];
    const base = buildProfile(state.character, state.items, data);
    const setups = [];
    const seen = new Set();
    const add = (id, name, profile) => {
        const key = JSON.stringify([profile.equipment, profile.abilities, profile.abilityTriggers]);
        if (seen.has(key)) return;
        seen.add(key);
        setups.push({ id, name, profile });
    };
    for (const loadout of [...combatLoadouts(state.character), ...labyrinthLoadouts(state.character)]) {
        add(loadout.id, loadout.name || "Loadout", applyLoadout(base, loadout, state.items, data));
    }
    add("equipped", "Equipped now", base);
    return setups;
}

async function doLabyrinth() {
    ui.labImprove = null;
    ui.labSetups = labyrinthSetups();
    ui.labResult = await analyzeLabyrinth(ui.pool, ui.labSetups, getClientData(), ui.settings, state.character, progress("Simulating Labyrinth rooms"));
}

async function doLabImprove() {
    if (!ui.labResult) await doLabyrinth();
    ui.labImprove = await analyzeImprovements(ui.pool, ui.labSetups, getClientData(), ui.settings, ui.labResult, progress("Testing improvements"));
}

async function doLabBuild() {
    const style = buildStyleSetting(ui.settings);
    ui.labBuild = null;
    ui.labBuild = await buildLoadout(ui.pool, currentProfile(), getClientData(), ui.settings, {
        style,
        budget: Number(ui.settings.budget) || 0,
        enhanceCost: enhanceCostFor(),
        crates: chosenCrates(ui.settings, state.character),
    }, progress(`Building a ${style} loadout`));
}

function renderLabyrinthTab() {
    const data = getClientData();
    if (!state.character) return `<p>The script hasn't seen your character yet. <b>Reload the page (F5)</b> with the script enabled.</p>`;
    if (!data) return `<p>The game data loads with the first analysis.</p><button class="mwia-btn" data-action="laby-check" ${ui.busy ? "disabled" : ""}>Check the rooms</button>`;
    const setups = ui.labSetups || labyrinthSetups();
    return renderLabyrinth({
        lab: ui.labResult,
        improve: ui.labImprove,
        build: ui.labBuild,
        profileOf: (id) => setups.find((s) => s.id === id)?.profile || null,
        data,
        settings: ui.settings,
        busy: ui.busy,
        settingsHtml,
        slotted: { coffee: slottedCrate(state.character, "coffee"), food: slottedCrate(state.character, "food") },
        setupsNote: `<p class="mwia-dim">Loadouts: ${setups.map((s) => `<b>${esc(s.name)}</b>`).join(", ")}${setups.length < 2 ? " – save a loadout per combat style in the game to compare them here" : ""}.</p>`,
        cartButton,
        coins,
    });
}

// Re-scores the last analysis for the current goal and rebuilds the shopping list.
function rerateUpgrades() {
    if (!ui.upgradeRaw) return;
    ui.upgradeResult = rateUpgrades(ui.upgradeRaw, ui.settings);
    ui.plan = buildPlan(ui.upgradeResult, Number(ui.settings.budget) || 0, ui.settings.spending);
    ui.verified = null;
    saveCombatSetup();
    saveTriggerAdvice(ui.plan);
}

// The plan's trigger changes, for the bar in the game's Combat Triggers window (▶ Fill in):
// { hrid: { triggers } } from the last analysis – also after a reload.
const ADVICE_KEY = "mwia-trigger-advice";
function saveTriggerAdvice(plan) {
    const advice = {};
    for (const t of plan?.triggers || []) advice[t.hrid] = { triggers: t.triggers };
    for (const p of plan?.picks || []) if (p.kind === "ability" && p.triggers) advice[p.hrid] = { triggers: p.triggers };
    try {
        localStorage.setItem(ADVICE_KEY, JSON.stringify(advice));
    } catch {
        // kept for this page only
    }
    ui.triggerAdvice = advice;
}
function loadTriggerAdvice() {
    if (ui.triggerAdvice) return ui.triggerAdvice;
    try {
        ui.triggerAdvice = JSON.parse(localStorage.getItem(ADVICE_KEY) || "{}") || {};
    } catch {
        ui.triggerAdvice = {};
    }
    return ui.triggerAdvice;
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

// What enhancing gear yourself costs, with your Enhancing level, tool, Observatory and the cheapest teas.
function enhanceCostFor() {
    const data = getClientData();
    try {
        const who = skillingCharacter(state.character, state.items, data);
        const market = skillingMarket("bid");
        return (hrid, starts) => selfEnhanceCosts(hrid, who, data, market, starts);
    } catch (error) {
        console.warn("[MWI Advisor] enhancing costs unavailable", error);
        return null;
    }
}

async function doRefine() {
    await refineUncertain(ui.pool, ui.upgradeRaw, ui.settings, progress("Re-running uncertain suggestions"));
    rerateUpgrades();
}

const hasPlan = (plan) => !!(plan && (plan.picks.length || plan.drink || plan.food || plan.order || plan.triggers?.length));

// scope "abilities": only abilities, their levels, order and triggers – no gear to buy.
async function doUpgrades(scope = "all") {
    const { profile, starter } = fightingProfile();
    if (ui.settings.zone === "auto" && !ui.zoneResults) await doZones();
    const zone = chosenZone(profile);
    if (!zone) throw new Error("Pick a zone first.");
    const run = runSettings();
    const settings = { ...run, budget: Math.max(0, run.budget - (starter?.cost || 0)), starter, enhanceCost: enhanceCostFor(), scope };
    ui.upgradeRaw = await analyzeUpgrades(ui.pool, profile, zone, settings, progress("Testing upgrades"), progress("Re-running uncertain suggestions"));
    rerateUpgrades();
    if (hasPlan(ui.plan)) {
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
    if (ui.notice && ["upgrades", "skilling", "market", "labyrinth"].includes(ui.tab)) html += noticeHtml(ui.notice);
    if (ui.busy) html += progressHtml();
    if (ui.tab === "overview") html += renderOverview();
    else if (ui.tab === "zones") html += renderZones();
    else if (ui.tab === "upgrades") html += renderUpgrades();
    else if (ui.tab === "skilling") html += renderSkillingTab();
    else if (ui.tab === "market") html += renderMarketTab();
    else if (ui.tab === "labyrinth") html += renderLabyrinthTab();
    else html += renderGuide();
    body.innerHTML = html;
    // A notice from a button far down the list: bring it into view.
    if (ui.showNotice) {
        ui.showNotice = false;
        body.scrollTop = 0;
    }
    labelTableCells(body);
    updateAlertDot();
}

function renderMarketTab() {
    if (!state.character) {
        return `<p>The script hasn't seen your character yet. It reads it when the game connects, so <b>reload the page (F5)</b> with the script enabled.</p>`;
    }
    if (getClientData() && pricesAge() !== null) return renderMarket();
    if (!ui.marketLoading) {
        ui.marketLoading = Promise.all([loadClientData(ui.win), loadPrices()])
            .catch((error) => (ui.error = error.message || String(error)))
            .finally(() => {
                ui.marketLoading = null;
                if (ui.tab === "market") render();
            });
    }
    return `<p>Loading the game data and market prices…</p>`;
}

// A red dot on the 🧭 button while one of your orders sits behind a wall of better offers.
function updateAlertDot() {
    if (!ui.launcher) return;
    const alerts = marketAlerts();
    ui.launcher.classList.toggle("mwia-has-alert", alerts > 0);
    ui.launcher.title = alerts ? `MWI Advisor – ${alerts} market order${alerts === 1 ? "" : "s"} behind a wall of better offers` : "MWI Advisor";
}

// While you have orders, the market file is read every MARKET_REFRESH_MS so their standing stays current.
const MARKET_REFRESH_MS = 10 * 60 * 1000;
const MARKET_FIRST_CHECK_MS = 60 * 1000;

async function refreshMarket() {
    if (!(state.character?.myMarketListings || []).length) return;
    try {
        await loadClientData(ui.win);
        await loadPrices(true);
    } catch {
        // tried again next time
    }
    updateAlertDot();
    if (!ui.root.classList.contains("mwia-hidden") && !ui.busy && ui.tab === "market") render();
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
    if (fields.includes("levels")) {
        parts.push(`<label title="Rank by how many levels the XP gives instead of by XP: XP in a low skill buys many more levels than in a high one, so this is the fastest way up in total level. Counted over a day of training.">
            Total level <span class="mwia-focus-row"><input type="checkbox" data-setting="countLevels" ${s.countLevels ? "checked" : ""}> Count levels, not XP</span></label>`);
    }
    if (fields.includes("gear")) {
        const loadouts = combatLoadouts(state.character);
        if (loadouts.length) {
            const auto = chooseLoadout(state.character, "auto");
            const options = [
                ["auto", `Default loadout (${auto?.name || "Loadout"})`],
                ["equipped", "Equipped now"],
                ...loadouts.map((l) => [l.id, `Loadout: ${l.name || "Loadout"}${l.isDefault ? " ★" : ""}`]),
            ];
            parts.push(`<label title="The gear, abilities, food and drinks to work from: a combat loadout you saved in the game, or what you wear now. Gear you own but the loadout doesn't wear counts as in your inventory.">
            Gear from <select data-setting="combatGear">${options.map(([k, v]) => `<option value="${esc(k)}" ${String(s.combatGear) === k ? "selected" : ""}>${esc(v)}</option>`).join("")}</select></label>`);
        }
    }
    if (fields.includes("style")) {
        const profile = currentProfile();
        const now = profile && getClientData() ? STYLE_NAMES[weaponStyle(profile, getClientData())] : null;
        const options = [["current", `Current weapon${now ? ` (${now})` : ""}`], ...Object.entries(STYLE_NAMES)];
        parts.push(`<label title="The style to fight with. Another style than your weapon's starts from the best weapon for it you own, or the cheapest you can wear (it goes on the shopping list); better weapons of that style are then tested as upgrades.">
            Fight as <select data-setting="combatStyle">${options.map(([k, v]) => `<option value="${k}" ${s.combatStyle === k ? "selected" : ""}>${v}</option>`).join("")}</select></label>`);
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
    ${combatLoadouts(state.character).length ? settingsHtml(["gear"]) : ""}${loadoutNote(profile)}
    <div class="mwia-grid">
      <section><h3>Levels</h3>
        <table class="mwia-table">${levelRows}
        <tr class="mwia-sum"><td>Combat level</td><td class="mwia-num">${dec(combatLevel(levels), 1)}</td></tr></table></section>
      <section><h3>Equipment</h3><table class="mwia-table">${gearRows}</table></section>
      <section><h3>Abilities (${slots.abilities} slot${slots.abilities === 1 ? "" : "s"})</h3><ol>${abilityRows.join("")}</ol>
        <h3>Food (${slots.food})</h3><ul>${consumableList(profile.food, slots.food)}</ul>
        <h3>Drinks (${slots.drinks})</h3><ul>${consumableList(profile.drinks, slots.drinks)}</ul></section>
    </div>
    ${totalLevelHtml(profile, data)}
    <h3>Tips for your character</h3>
    <ul class="mwia-tips">${tips.map((t) => `<li class="mwia-tip-${t.level}">${t.html}</li>`).join("")}</ul>
    <p class="mwia-dim">Next step: the <b>Where to fight</b> tab, then <b>Upgrades</b>.</p>`;
}

// Which gear the combat tabs work from, and what a loadout names that you no longer have.
function loadoutNote(profile) {
    if (!profile?.loadout) return "";
    const missing = profile.loadout.missing;
    return `<p class="mwia-dim">Working from your loadout <b>${esc(profile.loadout.name)}</b>, not the gear you wear now.</p>${
        missing.length ? `<p class="mwia-warn">⚠ Not in your inventory, so left empty: ${missing.map(gearLabel).join(", ")}.</p>` : ""
    }`;
}

const STYLE_WEAPONS = { magic: "a staff", ranged: "a bow or crossbow", melee: "a sword, mace or spear" };

function overviewTips(profile, slots, data) {
    const tips = [];
    const weapon = weaponOf(profile);
    const style = weaponStyle(profile, data);
    if (!weapon) {
        tips.push({ level: "bad", html: "You have no weapon. Pick a style under <b>Fight as</b> in <b>Upgrades</b>: it finds a weapon (e.g. a Wooden Bow, Cheese Sword or Wooden Staff) and what to buy next." });
    }
    const emptyAbilities = [];
    for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilities.push(i);
    if (emptyAbilities.length) {
        tips.push({ level: "bad", html: `You have ${emptyAbilities.length} empty ability slot(s). Abilities add a lot of damage – see <b>Upgrades</b> for which one pays off.` });
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
    const accuracy = style === "melee" ? null : style + "Accuracy";
    const badArmor = accuracy
        ? Object.entries(profile.equipment)
              .filter(([type]) => !["main_hand", "two_hand"].includes(type))
              .filter(([, gear]) => (data.itemDetailMap[gear.hrid]?.equipmentDetail?.combatStats?.[accuracy] || 0) < 0)
              .map(([, gear]) => itemName(gear.hrid))
        : [];
    if (badArmor.length) {
        tips.push({ level: "warn", html: `${badArmor.map(esc).join(", ")} lower(s) your ${STYLE_NAMES[style].toLowerCase()} accuracy – check <b>Upgrades</b> for armour that suits your style.` });
    }
    // Total level: the style's lowest skill gets the most levels from a focus charm,
    // and a style you hardly trained has its first levels almost for free.
    const trained = styleSkills(style, data);
    const lowest = [...trained].sort((a, b) => profile.levels[a] - profile.levels[b])[0];
    const charmFocus = profile.equipment.charm && data.itemDetailMap[profile.equipment.charm.hrid]?.equipmentDetail?.combatStats?.focusTraining?.split("/").pop();
    if (!profile.equipment.charm) {
        tips.push({ level: "info", html: `No charm. A focus charm (e.g. Trainee ${SKILL_NAMES[lowest]} Charm) sends 70% of your combat XP to one skill instead of splitting it over ${trained.map((k) => SKILL_NAMES[k]).join(", ")}.
          For total level, focus the lowest: <b>${SKILL_NAMES[lowest]}</b> (${profile.levels[lowest]}). <b>Upgrades</b> with <i>Count levels</i> measures it.` });
    } else if (charmFocus && profile.levels[charmFocus] - profile.levels[lowest] >= 10) {
        tips.push({ level: "info", html: `Your charm focuses ${SKILL_NAMES[charmFocus] || charmFocus} (${profile.levels[charmFocus]}). For total level a ${SKILL_NAMES[lowest]} charm gives more: ${SKILL_NAMES[lowest]} is only ${profile.levels[lowest]}.` });
    }
    const untrained = Object.keys(STYLE_NAMES).filter((k) => k !== style && profile.levels[k] + 15 <= profile.levels[style]);
    for (const k of untrained) {
        tips.push({ level: "info", html: `${SKILL_NAMES[k]} is only level ${profile.levels[k]}: its first levels cost very little XP. Fighting with ${STYLE_WEAPONS[k]} for a while is a quick way up in total level –
          pick <b>Fight as: ${STYLE_NAMES[k]}</b> and <i>Count levels</i> in <b>Upgrades</b>.` });
    }
    if (!tips.length) tips.push({ level: "ok", html: "No obvious gaps. Run the zone and upgrade analyses to fine-tune." });
    return tips;
}

const SKILLING_NAMES = (hrid) => {
    const name = hrid.split("/").pop();
    return name.charAt(0).toUpperCase() + name.slice(1);
};

// Total level: how far to the next pouch, and which skills give a level for the least XP.
function totalLevelHtml(profile, data) {
    const table = data.levelExperienceTable;
    const goal = nextPouchGoal(profile.totalLevel, data);
    let html = `<h3>Total level ${profile.totalLevel}</h3>`;
    if (goal) html += `<p>${goal.level - profile.totalLevel} levels to <b>${goal.level}</b>, which unlocks the <b>${esc(itemName(goal.hrid))}</b> (more food and drink slots).</p>`;
    if (!Array.isArray(table)) return html;
    const rows = Object.entries(profile.allLevels)
        .filter(([hrid]) => hrid !== "/skills/total_level")
        .map(([hrid, level]) => ({ hrid, level, need: xpToNextLevel(table, experienceOf(table, profile.allExperience?.[hrid], level), level) }))
        .filter((r) => r.need !== null)
        .sort((a, b) => a.need - b.need);
    html += `<details class="mwia-skill-sec"><summary>Cheapest levels: XP to the next level, per skill</summary><table class="mwia-table">
      <thead><tr><th>Skill</th><th class="mwia-num">Level</th><th class="mwia-num">XP to next</th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td>${esc(SKILL_NAMES[r.hrid.split("/").pop()] || SKILLING_NAMES(r.hrid))}</td><td class="mwia-num">${r.level}</td><td class="mwia-num">${int(r.need)}</td></tr>`).join("")}
      </tbody></table>
      <p class="mwia-dim">Tick <i>Count levels, not XP</i> in Where to fight, Upgrades or Skilling to rank by levels gained.</p></details>`;
    html += `<p><button class="mwia-btn" data-action="export">🧭 Export for chat</button> <span class="mwia-dim">A text file with your character, inventory, orders and the advice, to paste into a chat. The same button is under the game's inventory.</span></p>`;
    return html;
}

// What the export adds from the panel: the settings, the top Skilling rows,
// and the last zone and upgrade analyses (as their text on screen).
function exportContext() {
    const sections = [];
    const textOf = (html, selector) => {
        const box = document.createElement("div");
        box.innerHTML = html;
        return [...box.querySelectorAll(selector)].map((node) => (node.tagName === "TR" ? [...node.children].map((cell) => cell.textContent.trim()).join(" | ") : node.textContent).replace(/\s+/g, " ").trim()).filter(Boolean);
    };
    const attempt = (title, lines) => {
        try {
            const got = lines();
            if (got.length) sections.push({ title, lines: got });
        } catch (error) {
            sections.push({ title, lines: [`(not available: ${error?.message || error})`] });
        }
    };
    attempt("Skilling: best now", () => (getClientData() ? skillingExportLines(ui.settings) : []));
    if (ui.zoneResults) attempt("Where to fight (last run)", () => textOf(renderZones(), ".mwia-reco, tbody tr").slice(0, 16));
    if (ui.labResult || ui.labBuild) attempt("Labyrinth (last run)", () => labyrinthExportLines(ui.labResult, ui.labImprove, ui.labBuild, ui.settings));
    if (ui.upgradeResult) attempt("Upgrades (last run)", () => textOf(renderUpgrades(), "p, ol.mwia-plan > li").filter((line) => !line.startsWith("Tests one change")).slice(0, 20));
    return { settings: ui.settings, sections };
}

const CAPPED_TITLE = "You kill faster than new monsters appear (one encounter per 3 s at most), so more damage barely helps here";
const cappedBadge = (r) => (isSpawnCapped(r) ? ` <span class="mwia-warn" title="${CAPPED_TITLE}">⏱</span>` : "");

function renderZones() {
    let html = `<p>Simulates your current setup against every combat zone and shows where you get the most XP or gold per hour
      <b>${ui.settings.acceptRareDeaths ? "while dying rarely at most" : "without dying"}</b>.</p>
      ${settingsHtml(["focus", "levels", "gear", "style", "risk", "accuracy", "maxTier"])}${loadoutNote(currentProfile())}
      <button class="mwia-btn" data-action="zones" ${ui.busy ? "disabled" : ""}>Run zone analysis</button>`;
    if (!ui.zoneResults) return html;

    const goal = zoneGoal(ui.zoneResults, ui.settings);
    const best = pickBestZone(ui.zoneResults, ui.settings);
    if (ui.zoneStarter) {
        const w = ui.zoneStarter;
        html += `<p class="mwia-reco">Simulated with <b>${gearLabel(w)}</b> ${w.owned ? "from your inventory" : `(${coins(w.cost)} on the market)`} instead of your weapon.
          <b>Upgrades</b> shows what else to buy for this style.</p>`;
    }
    const profile = currentProfile();
    const current =
        profile?.currentZone && ui.zoneResults.find((z) => z.zone.zoneHrid === profile.currentZone.zoneHrid && z.zone.tier === profile.currentZone.tier);
    const summary = (r) => `<b>${xpNum(xpValue(r, ui.settings))} ${xpLabel()}</b> and <b>${coins(perDay(r.profit))}</b> profit/day`;
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
      <th class="mwia-num">${xpLabel()}</th><th class="mwia-num" title="Value of drops (bid price) minus food/drink cost, per day">Profit/day</th>
      <th class="mwia-num">Kills/h</th><th>Risk</th></tr></thead><tbody>`;
    for (const z of rows.slice(0, 40)) {
        const r = z.result;
        const match = bestScore > 0 ? int((100 * score(r, goal)) / bestScore) : "–";
        html += `<tr class="${z === best ? "mwia-best" : ""}"><td>${zoneLabel(z.zone)}${cappedBadge(r)}</td><td class="mwia-num">${match}</td><td class="mwia-num">${xpNum(xpValue(r, ui.settings))}</td>
          <td class="mwia-num">${coins(perDay(r.profit))}</td><td class="mwia-num">${dec(r.killsTotal, 0)}</td><td>${deathBadge(r.deaths)}</td></tr>`;
    }
    html += `</tbody></table><p class="mwia-dim">Simulated ${int(Math.max(1, runSettings().hours / 2))} h per zone. These are estimates – differences of a few percent are noise.
      ⏱ = you kill faster than monsters appear there.</p>`;
    return html;
}

function upgradeNotes(c, base) {
    const notes = [];
    if (c.owned && c.cost === 0 && c.kind === "gear") notes.push('<span class="mwia-ok">you own it</span>');
    if (c.enhance) notes.push(`<span class="mwia-dim" title="${esc(enhanceDetail(c))}">🔨 enhance yourself</span>`);
    if (c.deathsDelta < 0 && base.deaths > 0) notes.push(`<span class="mwia-ok">fewer deaths</span>`);
    if (!c.safe) notes.push(`<span class="mwia-bad">more deaths</span>`);
    return notes.join(" ");
}

// ---------- MWITools shopping cart ----------

// What to put in the cart for one suggestion. Consumables: enough for a day of combat.
function cartItems(c) {
    const forOneDay = (hrid) => Math.max(1, Math.ceil(perDay(c.result?.consumables?.[hrid] || 0)));
    if (c.kind === "house") return c.materials.filter((m) => m.hrid !== COIN).map((m) => ({ hrid: m.hrid, quantity: m.count }));
    if (c.kind === "abilityOrder" || c.kind === "skillLevel" || c.kind === "trigger") return [];
    if (c.enhance) return mergeCart([...enhanceCart(c), ...(c.extraFood ? [{ hrid: c.extraFood, quantity: forOneDay(c.extraFood) }] : [])]);
    if (c.kind === "abilityLevel") return [{ hrid: c.bookHrid, quantity: c.books }];
    if (c.kind === "ability") return c.cost ? [{ hrid: c.bookHrid, quantity: 1 }] : [];
    if (c.kind === "food" || c.kind === "drinks") return c.remove ? [] : [{ hrid: c.hrid, quantity: forOneDay(c.hrid) }];
    const items = c.cost ? [{ hrid: c.hrid, quantity: 1, enhancementLevel: c.enhancementLevel || 0 }] : [];
    if (c.extraFood) items.push({ hrid: c.extraFood, quantity: forOneDay(c.extraFood) });
    return items;
}

const COIN = "/items/coin";

// Enhancing it yourself: the +0 to buy (unless it's yours), the expected materials and
// protections, rounded up, and the teas for the hours it takes.
function enhanceCart(c) {
    const e = c.enhance;
    const items = e.start === "buy" ? [{ hrid: c.hrid, quantity: 1, enhancementLevel: 0 }] : [];
    for (const m of e.materials) if (m.itemHrid !== COIN) items.push({ hrid: m.itemHrid, quantity: Math.ceil(m.count * e.attempts) });
    if (e.protect && e.protections > 0) items.push({ hrid: e.protect.itemHrid, quantity: Math.ceil(e.protections), enhancementLevel: 0 });
    for (const tea of e.teas) items.push({ hrid: tea, quantity: Math.ceil(e.drinks) });
    return items;
}

function mergeCart(items) {
    const merged = new Map();
    for (const i of items) {
        const key = i.hrid + "#" + (i.enhancementLevel || 0);
        const known = merged.get(key);
        if (known) known.quantity += i.quantity;
        else merged.set(key, { ...i });
    }
    return [...merged.values()];
}

function hoursText(h) {
    if (h === null || h === undefined || !Number.isFinite(h)) return "–";
    if (h < 1) return `${Math.max(1, Math.round(h * 60))} min`;
    if (h < 48) return `${dec(h, 1)} h`;
    return `${dec(h / 24, 1)} days`;
}

// "+3 → +6: ~40 attempts, ~2.1 h, protected from +4 with Mirror of Protection (~3), teas: …"
function enhanceDetail(c) {
    const e = c.enhance;
    const from = e.start === "worn" ? `your +${e.from}` : e.start === "owned" ? `your copy at +${e.from}` : `a +0 bought for ${coins(e.basePrice)}`;
    const parts = [`from ${from} to +${c.enhancementLevel}: about ${int(e.attempts)} attempts (${hoursText(e.hours)} of Enhancing), materials and teas ${coins(c.price - e.basePrice)}`];
    if (e.protect) parts.push(`protected from +${e.protect.from} with ${itemName(e.protect.itemHrid)} (about ${dec(e.protections, 1)})`);
    parts.push(e.teas.length ? `teas: ${e.teas.map(itemName).join(", ")}` : "no teas");
    return parts.join("; ");
}

// "for 1.5M (2.0M − 500k for your Cheese Helmet)"
function costText(c) {
    if (!c.cost && !c.resale) return "(free)";
    const sold = c.resale ? ` (${coins(c.price)} − ${coins(c.resale)} selling your ${c.sold.map((g) => gearLabel(g)).join(" and ")})` : "";
    return `for ${c.cost ? coins(c.cost) : "nothing"}${sold}`;
}

const starterCart = (w) => (w?.cost ? [{ hrid: w.hrid, quantity: 1, enhancementLevel: w.enhancementLevel }] : []);

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
    let html = `<p>Tests one change at a time (gear incl. enhanced +N copies – bought or enhanced yourself –, new abilities, levelling abilities with extra books,
      the order of your abilities and their triggers, combat house rooms, drinks, food and their triggers, and a few more levels in each skill) in the chosen zone
      and measures how much it improves your focus – XP per hour, gold per hour, or a mix. Buy the things that give the most per coin first.</p>
      ${settingsHtml(["focus", "levels", "gear", "style", "zone", "budget", "spending", "risk", "accuracy"])}${loadoutNote(currentProfile())}
      <button class="mwia-btn" data-action="upgrades" ${ui.busy ? "disabled" : ""}>Analyze upgrades</button>
      <button class="mwia-btn" data-action="upgrades-abilities" ${ui.busy ? "disabled" : ""} title="Only abilities, their levels and order, and the triggers of your abilities and food – much quicker">Abilities &amp; triggers only</button>
      <button class="mwia-link" data-action="trigger-window" title="Open a loadout's ⚙ under an ability in the game first. Reads how the game's Combat Triggers window is built – changes nothing – for filling it in later.">📋 Read the game's trigger window</button>`;
    const result = ui.upgradeResult;
    if (!result) return html;
    const base = result.base;
    const label = xpLabel();
    html += `<p>Zone: ${zoneLabel(result.zone)}. Now: <b>${xpNum(xpValue(base, ui.settings))} ${label}</b>, profit <b>${coins(perDay(base.profit))}/day</b>
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
    if (!plan || (!hasPlan(plan) && !plan.starter)) {
        html += `<p>Nothing within budget gave a reliable improvement that is worth its price. Try Spending "All in", raise the budget, try another zone,
          or just keep levelling – at some levels that really is the best move.</p>`;
    } else {
        html += `<ol class="mwia-plan">`;
        if (plan.starter) {
            const w = plan.starter;
            html += `<li>${w.owned ? "Equip" : "Buy"} <b>${gearLabel(w)}</b> ${w.owned ? "from your inventory " : ""}to fight as ${STYLE_NAMES[ui.settings.combatStyle] || "the chosen style"}${w.replaces ? ` – replaces ${gearLabel(w.replaces)}` : ""}
              ${w.cost ? `for ${coins(w.cost)}` : "(free)"} <span class="mwia-dim">(everything here was simulated with it)</span> ${cartButton(starterCart(w))}</li>`;
        }
        for (const p of plan.picks) {
            let what;
            if (p.kind === "abilityLevel") {
                what = `${p.books}× <b>${esc(itemName(p.bookHrid))}</b> and read them: ${esc(abilityName(p.hrid))} level ${p.fromLevel} → ${p.level}`;
            } else if (p.kind === "ability") {
                what = `ability <b>${esc(abilityName(p.hrid))}</b>${p.cost ? ` (buy the book ${esc(itemName(p.bookHrid))})` : ` (level ${p.level})`}${p.triggers ? `, triggers: <b>${esc(describeTriggers(p.triggers, getClientData()))}</b>` : ""}`;
            } else if (p.kind === "house") {
                html += `<li>Build <b>${esc(p.name)}</b> level ${p.fromLevel} → ${p.level} <span class="mwia-dim">(${houseMaterials(p)})</span>: ${gainText(p)} for ${coins(p.cost)} ${cartButton(cartItems(p), "🛒 Materials")}</li>`;
                continue;
            } else if (p.enhance) {
                const own = p.enhance.start === "worn" ? `your <b>${gearLabel(p.replaces)}</b>` : p.enhance.start === "owned" ? `your <b>${gearLabel({ hrid: p.hrid, enhancementLevel: p.enhance.from })}</b>` : `a <b>${gearLabel({ hrid: p.hrid })}</b>`;
                const replaces = p.enhance.start !== "worn" && p.replaces ? ` – replaces ${gearLabel(p.replaces)}` : "";
                html += `<li>${p.enhance.start === "buy" ? "Buy" : "Take"} ${own} and enhance it to <span class="mwia-enh">+${p.enhancementLevel}</span> yourself
                  <span class="mwia-dim">(${esc(enhanceDetail(p))})</span>${replaces}: ${gainText(p)} ${costText(p)} ${cartButton(cartItems(p))}</li>`;
                continue;
            } else {
                what = `<b>${gearLabel(p)}</b> in ${SLOT_NAMES[p.slot]}${p.extraFood ? ` and put <b>${esc(itemName(p.extraFood))}</b> in the new food slot` : ""}`;
            }
            const replaces = p.replaces ? ` – replaces ${p.kind === "ability" ? esc(abilityName(p.replaces)) : gearLabel(p.replaces)}` : "";
            html += `<li>${p.cost || p.price ? "Buy" : "Use"} ${what}${replaces}: ${gainText(p)} ${costText(p)} ${cartButton(cartItems(p))}</li>`;
        }
        if (plan.order) {
            html += `<li>Put your abilities in this order: <b>${plan.order.order.map((h) => esc(abilityName(h))).join(" → ")}</b>
              <span class="mwia-dim">(now ${plan.order.was.map((h) => esc(abilityName(h))).join(" → ")})</span>: ${gainText(plan.order)} (free)</li>`;
        }
        for (const t of plan.triggers || []) {
            html += `<li>Set the triggers of <b>${esc(triggerTargetName(t))}</b> to <b>${esc(describeTriggers(t.triggers, getClientData()))}</b>
              <span class="mwia-dim">(now ${esc(describeTriggers(t.was, getClientData()))})</span>: ${gainText(t)} (free)</li>`;
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
          ${cartButton([...starterCart(plan.starter), ...plan.picks.flatMap(cartItems)], "🛒 Add all purchases to cart")}</p>`;
        if (ui.verified) {
            const v = ui.verified;
            const before = xpValue(v.base, ui.settings);
            const after = xpValue(v.planned, ui.settings);
            html += `<div class="mwia-reco">Everything combined (simulated): <b>${xpNum(before)} → ${xpNum(after)} ${label}</b> (${pct(after / Math.max(countingLevels() ? 1e-9 : 1, before) - 1)}),
              profit <b>${coins(perDay(v.base.profit))} → ${coins(perDay(v.planned.profit))}</b> per day (food/drinks ${coins(perDay(v.base.cost))} → ${coins(perDay(v.planned.cost))}),
              deaths ${dec(v.base.deaths, 2)} → ${dec(v.planned.deaths, 2)} per hour.
              <br><span class="mwia-dim">Run the zone analysis again after buying – with better gear a harder zone may become the best.</span></div>`;
        }
    }

    const all = result.scope !== "abilities";
    if (all) html += upgradeTable("Equipment", result.gear, base, (c) => SLOT_NAMES[c.slot], (c) => gearLabel(c) + (c.extraFood ? ` <span class="mwia-dim">+ ${esc(itemName(c.extraFood))} in new slot</span>` : ""), (c) => (c.replaces ? gearLabel(c.replaces) : "–"), "Item");
    html += upgradeTable(
        "Abilities",
        result.abilities,
        base,
        (c) => `Slot ${c.slot.replace("ability", "")}`,
        (c) =>
            esc(abilityName(c.hrid)) +
            (c.kind === "abilityLevel"
                ? ` <span class="mwia-dim">lvl ${c.fromLevel} → ${c.level} (${c.books} books)</span>`
                : ` <span class="mwia-dim">lvl ${c.level}</span>`) +
            (c.triggers ? `<br><span class="mwia-dim">triggers: ${esc(describeTriggers(c.triggers, getClientData()))}</span>` : ""),
        (c) => (c.kind === "abilityLevel" ? '<span class="mwia-dim">level up</span>' : c.replaces ? esc(abilityName(c.replaces)) : "–"),
        "Ability"
    );
    if (!getClientData().levelExperienceTable) {
        html += `<p class="mwia-dim">The game data has no level table, so levelling up abilities with extra books could not be evaluated.</p>`;
    }
    html += orderTable(result.orders || []);
    html += triggerTable(result.triggers || [], result);
    if (all) {
        html += upgradeTable("House", result.house || [], base, () => "House", (c) => `${esc(c.name)} <span class="mwia-dim">lvl ${c.fromLevel} → ${c.level}</span>`, () => "–", "Room");
        html += levelTable(result.levels || [], base);
        html += consumableTable("Drinks", result.drinks, base);
        html += consumableTable("Food", result.food, base);
    } else {
        html += `<p class="mwia-dim">Only abilities and triggers were tested. <b>Analyze upgrades</b> also tests gear, house rooms, drinks and food.</p>`;
    }
    if (result.food.some((c) => !c.safe && c.delta > 0) && result.gear.some((c) => c.extraFood && c.safe && c.delta > 0)) {
        html += `<p class="mwia-reco">Some food gives more XP but makes you die, because it replaces your only HP food. A bigger pouch gives an extra
          food slot so you can keep both – see the pouch row under Equipment.</p>`;
    }
    html += `<p class="mwia-dim">Prices = lowest sell order on the market right now, also for enhanced (+N) gear – or, when it is cheaper, enhancing it yourself (🔨:
      your Enhancing level, tool and Observatory, the cheapest teas and protection; from the copy you wear or own, or a +0 bought for it). Gear you take off is
      counted as sold at the best bid after the 4% tax, so the price is what the change really costs (* in the Price column); that is what the budget counts.
      House rooms cost their coins and materials at the lowest sell order. "Gain" = improvement of your focus as a share of
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
    if (gold === 0) return `${pct(c.deltaPct)} ${xpLabel()}`;
    if (gold === 1) return profit;
    return `${pct(c.deltaPct)} gain (${signed(xpNum, c.xpDelta)} ${xpLabel()}, ${profit})`;
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
      <th class="mwia-num">+${xpLabel()}</th><th class="mwia-num">+Profit/day</th><th class="mwia-num" title="${GAIN_TITLE}">Gain</th>
      <th class="mwia-num">Gain per 1M</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th></th><th></th></tr></thead><tbody>`;
    for (const c of shown) {
        const efficiency = c.cost > 0 ? pct((c.delta / c.cost) * 1e6) : "∞";
        html += `<tr class="${c.significant ? "" : "mwia-faded"}"><td>${slotText(c)}</td><td>${nameHtml(c)}</td><td>${replacesHtml(c)}</td>
          <td class="mwia-num"${c.resale ? ` title="${coins(c.price)} − ${coins(c.resale)} for what it replaces"` : ""}>${c.cost ? coins(c.cost) : "0"}${c.resale ? '<span class="mwia-dim">*</span>' : ""}</td><td class="mwia-num">${signed(xpNum, c.xpDelta)}</td><td class="mwia-num">${signed(coins, perDay(c.profitDelta))}</td>
          <td class="mwia-num">${pct(c.deltaPct)}</td><td class="mwia-num">${efficiency}</td><td class="mwia-num">${confidenceCell(c)}</td>
          <td>${upgradeNotes(c, base)}</td><td>${cartButton(cartItems(c))}</td></tr>`;
    }
    return html + `</tbody></table>`;
}

function houseMaterials(c) {
    return c.materials.map((m) => (m.hrid === COIN ? `${coins(m.count)} coins` : `${int(m.count)}× ${esc(itemName(m.hrid))}`)).join(", ");
}

function orderTable(list) {
    const shown = list.filter((c) => c.delta > 0).slice(0, 5);
    let html = `<h3>Ability order</h3>`;
    if (!list.length) return html + `<p class="mwia-dim">Fewer than two abilities in your slots – nothing to reorder.</p>`;
    if (!shown.length) return html + `<p class="mwia-dim">Your order is the best of the ${list.length + 1} orders tried.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Order</th><th class="mwia-num">+${xpLabel()}</th><th class="mwia-num">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th></th></tr></thead><tbody>`;
    for (const c of shown) {
        html += `<tr class="${c.significant ? "" : "mwia-faded"}"><td>${c.order.map((h) => esc(abilityName(h))).join(" → ")}</td>
          <td class="mwia-num">${signed(xpNum, c.xpDelta)}</td><td class="mwia-num">${signed(coins, perDay(c.profitDelta))}</td><td class="mwia-num">${pct(c.deltaPct)}</td>
          <td class="mwia-num">${confidenceCell(c)}</td><td>${upgradeNotes(c, ui.upgradeResult.base)}</td></tr>`;
    }
    return html + `</tbody></table>`;
}

const triggerTargetName = (c) => (c.target === "food" ? itemName(c.hrid) : abilityName(c.hrid));

// Trigger changes, one row per ability or food: the best one tried for it.
function triggerTable(list, result) {
    const data = getClientData();
    const shown = list.filter((c) => c.delta > 0).slice(0, 8);
    let html = `<h3>Triggers</h3>`;
    const waiting = Object.entries(result.telemetry?.abilities || {}).filter(([, s]) => s.waitingPerHour >= 0.1 * Math.max(1, s.castsPerHour) && s.waitingPerHour >= 3);
    if (waiting.length) {
        html += `<p class="mwia-dim">Waiting for mana (an auto attack instead, as its triggers held): ${waiting
            .map(([hrid, s]) => `${esc(abilityName(hrid))} ${int(s.waitingPerHour)}×/h (cast ${int(s.castsPerHour)}×/h)`)
            .join(", ")}.</p>`;
    }
    if (!list.length) return html + `<p class="mwia-dim">Nothing in the simulation pointed to a trigger worth changing.</p>`;
    if (!shown.length) return html + `<p class="mwia-dim">Your triggers are the best of the ${(result.triggerVariants || list).length + 1} settings tried.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>For</th><th>Triggers</th><th>Now</th><th class="mwia-num">+${xpLabel()}</th><th class="mwia-num">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th></th></tr></thead><tbody>`;
    for (const c of shown) {
        html += `<tr class="${c.significant ? "" : "mwia-faded"}"><td>${esc(triggerTargetName(c))}</td><td>${esc(describeTriggers(c.triggers, data))}</td>
          <td class="mwia-dim">${esc(describeTriggers(c.was, data))}</td>
          <td class="mwia-num">${signed(xpNum, c.xpDelta)}</td><td class="mwia-num">${signed(coins, perDay(c.profitDelta))}</td><td class="mwia-num">${pct(c.deltaPct)}</td>
          <td class="mwia-num">${confidenceCell(c)}</td><td>${upgradeNotes(c, ui.upgradeResult.base)}</td></tr>`;
    }
    return html + `</tbody></table>`;
}

// What more levels in a combat skill would give, and how long they take at the XP you get there now.
function levelTable(list, base) {
    if (!list.length) return "";
    let html = `<h3>More levels (not for sale)</h3><p class="mwia-dim">What a few more levels in a skill would give, to weigh against what you can buy.
      The time is at the XP an hour that skill gets now, in this zone.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>Skill</th><th>Levels</th><th class="mwia-num">+${xpLabel()}</th><th class="mwia-num">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th class="mwia-num" title="Time to get there at the XP an hour the skill gets now">Time</th><th></th></tr></thead><tbody>`;
    for (const c of list) {
        html += `<tr class="${c.significant ? "" : "mwia-faded"}"><td>${SKILL_NAMES[c.hrid] || esc(c.hrid)}</td><td>${c.fromLevel} → ${c.level}</td>
          <td class="mwia-num">${signed(xpNum, c.xpDelta)}</td><td class="mwia-num">${signed(coins, perDay(c.profitDelta))}</td><td class="mwia-num">${pct(c.deltaPct)}</td>
          <td class="mwia-num">${confidenceCell(c)}</td><td class="mwia-num">${hoursText(c.hoursToReach)}</td><td>${upgradeNotes(c, base)}</td></tr>`;
    }
    return html + `</tbody></table>`;
}

function consumableTable(title, list, base) {
    const shown = list.filter((c) => c.delta > 0 || c.deathsDelta < 0).slice(0, 10);
    let html = `<h3>${title}</h3>`;
    if (!shown.length) return html + `<p class="mwia-dim">No ${title.toLowerCase()} noticeably improved your focus.</p>`;
    html += `<table class="mwia-table mwia-wide"><thead><tr><th>${title === "Food" ? "Food" : "Drink"}</th><th>Replaces</th><th class="mwia-num">Unit price</th>
      <th class="mwia-num">Extra cost/day</th><th class="mwia-num">+${xpLabel()}</th><th class="mwia-num" title="Includes the extra food/drink cost">+Profit/day</th>
      <th class="mwia-num" title="${GAIN_TITLE}">Gain</th><th class="mwia-num" title="${CONF_TITLE}">Sure</th><th class="mwia-num">Deaths/h</th><th class="mwia-num" title="${countingLevels() ? "Extra cost per extra level" : "Extra cost per 1000 extra XP"}">${countingLevels() ? "Cost per level" : "Cost per 1000 XP"}</th><th></th></tr></thead><tbody>`;
    for (const c of shown) {
        const unit = countingLevels() ? 1 : 1000;
        const per1000 =
            c.xpDelta > 0 ? coins((c.costPerHourDelta / c.xpDelta) * unit)
            : c.remove && c.xpDelta < 0 ? `saves ${coins((c.costPerHourDelta / c.xpDelta) * unit)}`
            : "–";
        const name =
            (c.remove ? `<i>Stop using</i> ${esc(itemName(c.hrid))}` : esc(itemName(c.hrid))) +
            (dropsHpFood(c) ? ' <span class="mwia-warn" title="Leaves you without HP food – fine in this zone, risky in harder ones">⚠ no HP food</span>' : "");
        html += `<tr class="${c.significant ? "" : "mwia-faded"}"><td>${name}</td><td>${c.replaces ? esc(itemName(c.replaces)) : "–"}</td>
          <td class="mwia-num">${c.remove ? "–" : coins(askPrice(c.hrid))}</td><td class="mwia-num">${coins(perDay(c.costPerHourDelta))}</td><td class="mwia-num">${signed(xpNum, c.xpDelta)}</td>
          <td class="mwia-num">${signed(coins, perDay(c.profitDelta))}</td><td class="mwia-num">${pct(c.deltaPct)}</td><td class="mwia-num">${confidenceCell(c)}</td>
          <td class="mwia-num ${c.safe ? "" : "mwia-bad"}">${dec(c.result.deaths, 2)}${c.safe ? "" : " ✖"}</td><td class="mwia-num">${per1000}</td>
          <td>${cartButton(cartItems(c), "🛒 1 day")}</td></tr>`;
    }
    return html + `</tbody></table>`;
}

function renderGuide() {
    return `<div class="mwia-guide">
    <h3>How combat XP works</h3>
    <p>Every kill gives XP. <b>30%</b> goes to your weapon's skill (Magic for a staff, Ranged for a bow, Melee for a sword or mace, Attack for a spear)
    and the remaining <b>70%</b> is split evenly between Stamina, Intelligence, Attack, Defense and your style's skill (Magic, Ranged or Melee). With a
    <b>charm</b> that has a focus (e.g. Trainee Stamina Charm) the whole 70% share goes to that skill instead. More damage and fewer deaths mean more kills
    per hour, and therefore more XP.</p>
    <h3>Total level</h3>
    <p>Each level needs more XP than the one before, so the same XP buys far more levels in a low skill. A style you never trained (Ranged or Melee at 1)
    gives its first 20 levels for very little; so does a focus charm on your lowest combat skill. Tick <b>Count levels, not XP</b> to rank zones,
    upgrades and skilling actions by the levels they give.</p>
    <h3>What the skills do</h3>
    <ul>
      <li><b>Magic / Ranged / Melee</b> – raises your max damage with that style (both auto-attacks and abilities of that style).</li>
      <li><b>Attack</b> – accuracy. Misses deal no damage at all.</li>
      <li><b>Intelligence</b> – max mana (10 × (10 + level)) and more ability slots (at levels 20, 50 and 90).</li>
      <li><b>Stamina</b> – max HP (10 × (10 + level)).</li>
      <li><b>Defense</b> – evasion against enemy attacks.</li>
    </ul>
    <h3>Abilities</h3>
    <p>Abilities add a lot of damage – for a mage most of it, since staves halve auto-attack damage. They cost mana, are learned by reading an
    ability book (bought on the market) and get stronger as they level up, which happens when you use them or read more copies of the same book.
    Order matters: each turn the topmost ability whose triggers hold goes first – and if its mana isn't there yet, you auto-attack
    instead of casting the next one. Abilities without a cooldown (Water Strike, Fireball, Entangle) are moved behind the others in battle.
    A trigger like "own MP ≥ its cost" lets the next ability go while one waits for mana; Upgrades tries such changes (Triggers).</p>
    <h3>Food and drinks</h3>
    <p><b>Food</b> is eaten automatically according to its triggers (by default when you're missing enough HP/MP). HP food keeps you alive,
    MP food lets you keep casting abilities. <b>Drinks</b> (coffee) give a 5-minute buff, e.g. Magic or Ranged Coffee (+level)
    or Wisdom Coffee (+XP). A <b>pouch</b> gives extra food and drink slots.</p>
    <h3>The Labyrinth</h3>
    <p>A combat room is one monster, scaled to the room level, fought 1 against 1 from full HP and mana with no food or drinks (only the crates
    opened on entry) and 2 minutes to win, so single-target damage is what counts. Every monster hardly dodges one or two attack styles and dodges
    the rest many times over, and takes far more of one damage type: the Labyrinth wants magic for some rooms, ranged for others and melee for the
    rest. The game's Labyrinth automation can put on a loadout for each room type, so a loadout per combat style pays off. The <b>Labyrinth</b>
    tab shows which of your loadouts to use for each room type, which rooms to shroud or go around, what would take you further, and builds a
    loadout for the rooms of one style.</p>
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
    clearNotice();
    ui.root.classList.add("mwia-hidden");
    if (await openAction(ui.win, action, data)) {
        const found = findActionPanel(action.name);
        if (found?.input) setReactInput(found.input, count);
        return;
    }
    ui.root.classList.remove("mwia-hidden");
    showNotice({ level: "warn", text: `Could not open ${action.name} automatically. Open it yourself and enter ${count}.`, diag: navDiagnostics() });
}

// Opens Enhancing or Alchemy in the game with the item (when you have it) and
// the target or count filled in; the player clicks the game's own button.
// When it doesn't get there, the notice lists what each step found.
async function openLeveling(dataset) {
    const { item, kind, label } = dataset;
    const value = Number(dataset.value) || 0;
    // Decomposing an enhanced item: the one at that +level.
    const level = Number(dataset.level) || 0;
    const steps = [`${kind} ${item}${level ? ` +${level}` : ""} ${kind === "enhance" ? `→ +${value}` : `${label} ×${value}`}`];
    const stacks = [...state.items.values()].filter((i) => i.itemHrid === item && i.itemLocationHrid === "/item_locations/inventory");
    steps.push(stacks.length ? `inventory: ${stacks.map((i) => `${i.count} at +${i.enhancementLevel || 0}`).join(", ")}` : "not in the inventory");
    const owned = stacks.some((i) => (i.enhancementLevel || 0) === level && i.count > 0);
    const characterId = state.character?.character?.id;
    if (owned && !characterId) steps.push("no character id");
    const hash = owned && characterId ? inventoryItemHash(characterId, item, level) : null;
    // The protection (Enhancing) or catalyst (Alchemy) the row counts on, when you have one at +0.
    const ownHash = (hrid) => (hrid && characterId && [...state.items.values()].some((i) => i.itemHrid === hrid && i.itemLocationHrid === "/item_locations/inventory" && !i.enhancementLevel && i.count > 0) ? inventoryItemHash(characterId, hrid) : null);
    const protect = dataset.protect ? { hash: ownHash(dataset.protect), from: Number(dataset.protectFrom) } : null;
    const catalyst = dataset.catalyst ? { hash: ownHash(dataset.catalyst) } : null;
    clearNotice();
    ui.root.classList.add("mwia-hidden");
    const opened = kind === "enhance" ? await openEnhancing(hash, value, protect) : await openAlchemy(hash, label, value, catalyst);
    if (opened === "item") return;
    if (opened === "partial") {
        // The window is open with the item: the rest is said when you come back to the panel.
        const extra = kind === "enhance" ? `${dataset.protect ? `put ${itemName(dataset.protect)} in as protection from +${dataset.protectFrom}` : ""}` : `put ${itemName(dataset.catalyst)} in as the catalyst`;
        ui.notice = { level: "info", text: `Opened with the item, but couldn't ${extra} – do that in the game.`, diag: [...steps, navDiagnostics()].filter(Boolean).join(" · ") };
        ui.showNotice = true;
        return;
    }
    steps.push(navDiagnostics());
    ui.root.classList.remove("mwia-hidden");
    const what = kind === "enhance" ? `set the target to +${value}` : `pick ${label}${value ? ` and enter ${value}` : ""}`;
    const diag = steps.filter(Boolean).join(" · ");
    showNotice(opened === "page"
        ? { level: "info", text: `${owned ? "Opened the page but could not put the item in." : "You don't have the item yet – buy it first (🛒)."} Pick it in the game and ${what}.`, diag }
        : { level: "warn", text: `Could not open it automatically. Open it yourself and ${what}.`, diag });
}

// ---------- notices ----------

const VERSION = typeof __MWIA_VERSION__ !== "undefined" ? __MWIA_VERSION__ : "dev";

// An old notice doesn't belong to a new try.
function clearNotice() {
    ui.notice = null;
    ui.root.querySelector(".mwia-notice")?.remove();
}

// A notice in view, also when the button that set it is far down the list.
function showNotice(notice) {
    ui.notice = notice;
    ui.showNotice = true;
    render();
}

// What went wrong in a button, shown instead of lost: the panel comes back with it.
function buttonFailed(what, error) {
    ui.root?.classList.remove("mwia-hidden");
    const where = String(error?.stack || "").split("\n").slice(0, 4).join(" | ");
    showNotice({ level: "bad", text: `${what} failed: ${error?.message || error}`, diag: where });
}

// The details (monospace) and a 📋 button that copies them, with the version, for a chat.
function noticeHtml(notice) {
    const diag = notice.diag ? `<div class="mwia-notice-diag">${esc(notice.diag)}</div><button class="mwia-link mwia-notice-copy" data-action="copy-notice">📋 Copy</button>` : "";
    return `<div class="mwia-notice mwia-notice-${notice.level}">${esc(notice.text)}${diag}</div>`;
}

export const noticeCopyText = (notice, agent = navigator.userAgent) => [notice.text, notice.diag, `MWI Advisor v${VERSION} · ${agent}`].filter(Boolean).join("\n");

async function copyNotice(button) {
    if (!ui.notice) return;
    const text = noticeCopyText(ui.notice);
    let copied = false;
    try {
        await navigator.clipboard.writeText(text);
        copied = true;
    } catch {
        // Older browsers: copy from a selected text box.
        const box = document.createElement("textarea");
        box.value = text;
        box.setAttribute("readonly", "");
        box.style.cssText = "position:fixed;top:0;left:0;opacity:0";
        document.body.appendChild(box);
        box.select();
        box.setSelectionRange(0, text.length);
        try {
            copied = document.execCommand("copy");
        } catch {
            copied = false;
        }
        box.remove();
    }
    button.textContent = copied ? "✓ Copied" : "Select the text above to copy it";
}

// ---------- events ----------

function onClick(event) {
    const target = event.target.closest("[data-action],[data-tab]");
    if (!target || !ui.root.contains(target)) return;
    try {
        const running = act(target);
        running?.catch?.((error) => buttonFailed(clean(target.textContent) || target.dataset.action, error));
    } catch (error) {
        buttonFailed(clean(target.textContent) || target.dataset.action, error);
    }
}

const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();

// What a click on a tab or a button does; a promise when it goes on after the click.
function act(target) {
    if (target.dataset.tab) {
        // A notice belongs to the tab it came from.
        if (ui.tab !== target.dataset.tab) ui.notice = null;
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
            runTask(() => doUpgrades("all"));
            break;
        case "laby-check":
            runTask(doLabyrinth);
            break;
        case "laby-improve":
            runTask(doLabImprove);
            break;
        case "laby-build":
            runTask(doLabBuild);
            break;
        case "laby-read":
            ui.notice = { level: "info", text: "The game's Labyrinth, read (nothing changed). Copy it and paste it into the chat.", diag: labyrinthReport() };
            ui.showNotice = true;
            render();
            break;
        case "upgrades-abilities":
            runTask(() => doUpgrades("abilities"));
            break;
        case "trigger-window": {
            const diag = triggerWindowReport();
            const open = !diag.includes("trigger window: not open");
            ui.notice = {
                level: open ? "info" : "warn",
                text: open ? "The game's trigger window, read (nothing changed). Copy it and paste it into the chat." : "No Combat Triggers window is open. In the game: Loadouts → your combat loadout → ⚙ under an ability, then tap this again.",
                diag,
            };
            render();
            break;
        }
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
            return openWithCount(target.dataset.hrid, Number(target.dataset.count));
        case "skilling-level":
            ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
            return openLeveling(target.dataset);
        case "copy-notice":
            return copyNotice(target);
        case "skilling-train": {
            const plan = JSON.parse(target.dataset.plan);
            ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
            ui.root.classList.add("mwia-hidden");
            startTrain({ goals: [{ kind: "item", hrid: plan.product, target: plan.target }], policies: new Map(plan.made.map((hrid) => [hrid, "chain"])), title: plan.title });
            break;
        }
        case "skilling-cart":
            if (target.dataset.job) preferBuyLimits(target.dataset.job);
            sendItemsToCart(JSON.parse(target.dataset.teas || "[]"));
            break;
        case "skilling-market":
            ui.returnRow = target.closest(".mwia-skill-row")?.dataset.hrid || null;
            if (openMarketplace(ui.win, target.dataset.item, Number(target.dataset.level) || 0)) {
                ui.root.classList.add("mwia-hidden");
                returnAfterMarket();
            } else {
                ui.notice = { level: "warn", text: "Could not open the marketplace automatically. Open it yourself and pick the item." };
                render();
            }
            break;
        case "export":
            exportClicked(target);
            break;
        case "skilling-all":
            toggleShowAll();
            render();
            break;
        case "cart-add":
            sendToCart(target.dataset.cart);
            break;
        case "market-open":
            if (openMarketplace(ui.win, target.dataset.item, Number(target.dataset.level) || 0)) {
                ui.root.classList.add("mwia-hidden");
                returnAfterMarket();
            } else {
                ui.notice = { level: "warn", text: "Could not open the marketplace automatically. Open it yourself and pick the item." };
                render();
            }
            break;
        case "market-keep":
            toggleKeep(target.dataset.item, target.dataset.level);
            render();
            break;
        case "market-all":
            toggleShowAllMarket();
            render();
            break;
        case "cancel":
            ui.pool?.cancel();
            break;
    }
}

function onChange(event) {
    const key = event.target.dataset?.setting;
    if (!key) return;
    if (key === "budget") {
        const value = parseCoins(event.target.value);
        event.target.classList.toggle("mwia-invalid", value === null);
        if (value === null) return;
        ui.settings.budget = value;
        event.target.value = coinsInput(value);
    } else if (key === "acceptRareDeaths" || key === "countLevels") {
        ui.settings[key] = event.target.checked;
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
    // The room level only re-reads the curves; other crates need a new simulation.
    if (key.startsWith("laby")) {
        if (key === "labyFloor") {
            if (event.target.value) ui.settings.labyLevel = floorLevel(Number(event.target.value));
            delete ui.settings.labyFloor;
            saveSettings();
        } else if (key === "labyCoffee" || key === "labyFood") {
            ui.labResult = ui.labImprove = ui.labBuild = null;
        }
        render();
        return;
    }
    // Another style or loadout means other gear and other zones: the old results no longer apply.
    if (key === "combatStyle" || key === "combatGear") {
        ui.zoneResults = null;
        if (key === "combatGear") ui.labBuild = null;
        ui.upgradeRaw = ui.upgradeResult = ui.plan = ui.verified = null;
        render();
        return;
    }
    // Re-rating and re-planning are cheap; only the combined check needs a new analysis.
    if (["budget", "spending", "goldWeight", "acceptRareDeaths", "countLevels"].includes(key) && !ui.busy) {
        if (["goldWeight", "acceptRareDeaths", "countLevels"].includes(key)) rerateUpgrades();
        else if (ui.upgradeResult) {
            ui.plan = buildPlan(ui.upgradeResult, Number(ui.settings.budget) || 0, ui.settings.spending);
            ui.verified = null;
        }
        render();
    }
}

// Game messages come in bursts: work out the dot once they settle.
let dotTimer = null;
function scheduleDot() {
    clearTimeout(dotTimer);
    dotTimer = setTimeout(updateAlertDot, 500);
}

export function mountUI(win, workerSource) {
    ui.win = win;
    ui.workerSource = workerSource;
    setExportContext(exportContext);

    const style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    const button = document.createElement("button");
    button.className = "mwia-launcher";
    button.title = "MWI Advisor";
    button.setAttribute("aria-label", "MWI Advisor");
    button.textContent = "🧭";
    document.body.appendChild(button);
    makeDraggable(button);
    ui.launcher = button;

    const root = document.createElement("div");
    root.className = "mwia-panel mwia-hidden";
    root.innerHTML = `
      <div class="mwia-header">
        <div><b>🧭 MWI Advisor</b> <span class="mwia-status mwia-dim"></span></div>
        <button class="mwia-link" data-action="close" title="Close">✕</button>
      </div>
      <nav class="mwia-tabs">
        <button class="mwia-tab" data-tab="overview">Overview</button>
        <button class="mwia-tab" data-tab="zones">Where to fight</button>
        <button class="mwia-tab" data-tab="upgrades">Upgrades</button>
        <button class="mwia-tab" data-tab="skilling">Skilling</button>
        <button class="mwia-tab" data-tab="market">Market</button>
        <button class="mwia-tab" data-tab="labyrinth">Labyrinth</button>
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
    startJobLog(gameDeps);
    startToolNotice(gameDeps);
    startTeaSlots(gameDeps);
    startEnhancePlan(gameDeps);
    watchTriggerClicks();
    startTriggerWindow({
        advice: (hrid) => loadTriggerAdvice()[hrid] || null,
        describe: (triggers) => describeTriggers(triggers, getClientData() || {}),
        name: (hrid) => (hrid.startsWith("/items/") ? itemName(hrid) : abilityName(hrid)),
        onReport: (diag, copied) => {
            ui.tab = "upgrades"; // the notice shows there, and stays until another tab is opened
            ui.notice = { level: "info", text: `The game's trigger window, read (nothing changed)${copied ? " and copied" : ""}. Paste it into the chat.`, diag };
            render();
        },
    });
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
        scheduleDot();
    });
    onPricesLoaded(() => scheduleDot());
    setTimeout(refreshMarket, MARKET_FIRST_CHECK_MS);
    setInterval(refreshMarket, MARKET_REFRESH_MS);
}
