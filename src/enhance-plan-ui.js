// A box under the game's Enhancing window, for the item in the slot: what reaching
// each +level typically costs and takes, with bad luck, the protection worth using
// (and from which +level), and the materials it takes against what you have. The
// tries are simulated only when you press 🎲 (it can take a few seconds); the plan is
// kept for the item until the prices, your teas or your Enhancing change.

import { getClientData, itemName, pricesStamp } from "./game-data.js";
import { onStateChange, state } from "./game-state.js";
import { esc, shortCoins } from "./format.js";
import { inventoryItemHash, levelingPanels, navDiagnostics, setEnhancing } from "./game-nav.js";
import { heldStock, skillingCharacter } from "./skilling.js";
import { itemOfHash, levelOfHash, skillingMarket } from "./skilling-ui.js";
import { enhancePlan, withStock } from "./enhance-plan.js";

const SCAN_MS = 400;
const TYPE = "/action_types/enhancing";
const SKILL = "/skills/enhancing";
const COIN = "/items/coin";
// Rows shown before "Higher targets": this many past the +level you have, or past what your coins carry.
const SHOWN = 5;
const PAST_REACH = 3;

// plans: "<item>+<start>" -> { key, plan } (plan null: the item can't be planned).
const e = { deps: null, scanTimer: null, loading: null, plans: new Map(), busy: null, open: new Set(), statuses: new Map(), panels: new Map() };

const coins = (n) => shortCoins(Math.round(n));
const count = (n) => Math.round(n).toLocaleString("en-US");
const have = (hrid) => (state.character ? heldStock(state.character, state.items, hrid).inventory : 0);

export function duration(hours) {
    const s = hours * 3600;
    if (s < 90) return `${Math.max(1, Math.round(s))} s`;
    if (s < 90 * 60) return `${Math.round(s / 60)} min`;
    if (hours < 48) return `${hours < 10 ? Math.round(hours * 10) / 10 : Math.round(hours)} h`;
    return `${Math.round((hours / 24) * 10) / 10} d`;
}

// deps: prepare() -> loads game data and prices, addToCart(items) -> the cart outcome.
export function startEnhancePlan(deps) {
    e.deps = deps;
    onStateChange(() => scheduleScan());
    new MutationObserver((records) => {
        if (records.every((r) => r.target.closest?.(".mwia-plan-box"))) return; // our own re-render
        scheduleScan();
    }).observe(document.body, { childList: true, subtree: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("toggle", onToggle, true);
}

function scheduleScan() {
    if (e.scanTimer) return;
    e.scanTimer = setTimeout(() => {
        e.scanTimer = null;
        try {
            scan();
        } catch (error) {
            console.warn("[MWI Advisor] enhancing plan", error);
        }
    }, SCAN_MS);
}

// What the plan depends on besides the item: prices, your Enhancing, gear, house and teas.
function planInputs(itemHrid, start) {
    const data = getClientData();
    const who = skillingCharacter(state.character, state.items, data);
    const key = JSON.stringify([pricesStamp(), who.levels[SKILL], who.drinks[TYPE], who.concentration, who.equipped, who.houseLevels, who.buffs?.[TYPE] || null]);
    return { id: `${itemHrid}+${start}`, key, who, data };
}

function scan() {
    const panels = levelingPanels().filter((p) => p.kind === "enhancing" && itemOfHash(p.itemHash));
    if (panels.length && (!getClientData() || !pricesStamp())) {
        e.loading ||= e.deps.prepare().then(scheduleScan, (error) => console.warn("[MWI Advisor] enhancing plan", error)).finally(() => (e.loading = null));
        return;
    }
    const shown = new Set();
    e.panels.clear();
    if (state.character) {
        for (const { panel, itemHash } of panels) {
            const itemHrid = itemOfHash(itemHash);
            const start = levelOfHash(itemHash) || 0;
            const { id, key } = planInputs(itemHrid, start);
            e.panels.set(id, { panel, itemHash });
            shown.add(placeBox(panel, id, boxHtml(itemHrid, start, id, key)));
        }
    }
    document.querySelectorAll(".mwia-plan-box").forEach((box) => shown.has(box) || box.remove());
}

// Under the whole Enhancing window (the table wants the full width), kept while nothing changes.
function placeBox(panel, id, html) {
    let box = panel.nextElementSibling?.classList.contains("mwia-plan-box") ? panel.nextElementSibling : null;
    if (!box) {
        box = document.createElement("div");
        box.className = "mwia-plan-box";
        panel.insertAdjacentElement("afterend", box);
    }
    if (box.dataset.plan !== id || box.dataset.html !== html) {
        box.dataset.plan = id;
        box.dataset.html = html;
        box.innerHTML = html;
    }
    return box;
}

const head = (title, note) => `<div class="mwia-guide-head"><b>${title}</b> <span>${note}</span></div>`;

function boxHtml(itemHrid, start, id, key) {
    const status = e.statuses.get(id);
    const statusHtml = status ? `<div class="mwia-guide-status">${esc(status)}</div>` : "";
    const title = head("🎯 Enhancing plan", `MWI Advisor · ${esc(itemName(itemHrid))}${start ? ` +${start}` : ""}`);
    if (start >= 20) return title + `<div class="mwia-guide-note">Already at +20.</div>`;
    const saved = e.plans.get(id);
    const button = (label) => `<button class="mwia-guide-cart mwia-plan-run" data-plan-run="${esc(id)}" ${e.busy ? "disabled" : ""}>${label}</button>`;
    if (e.busy === id) return title + `<div class="mwia-guide-note mwia-plan-busy">🎲 Simulating thousands of tries from +${start} to every target… this can take a few seconds.</div>`;
    if (!saved) {
        return (
            title +
            `<div class="mwia-guide-note">What reaching each +level typically costs and takes, with bad luck, which protection is worth it and the materials against what you have – simulated with your odds here (it can take a few seconds).</div>` +
            button(`🎲 Simulate +${start + 1} … +20`) +
            statusHtml
        );
    }
    if (!saved.plan) return title + `<div class="mwia-guide-note">Can't plan this item: it has no enhancing materials, or one of them isn't for sale.</div>` + statusHtml;
    const plan = withStock(saved.plan, have);
    const stale = saved.key !== key ? `<div class="mwia-guide-note mwia-guide-low">Prices, your teas or your Enhancing have changed since. ${button("🎲 Simulate again")}</div>` : "";
    return title + stale + summaryHtml(plan) + tableHtml(plan, id) + statusHtml;
}

// The odds per +level (where they change), the time and cost of an attempt, and what your coins carry.
function summaryHtml(plan) {
    const odds = [];
    plan.rates.forEach((r, L) => {
        if (L >= plan.start && (L === plan.start || Math.abs(r - plan.rates[L - 1]) > 1e-9)) odds.push(`+${L} ${(r * 100).toFixed(1)}%`);
    });
    const teas = plan.teas.length ? plan.teas.map(itemName).join(", ") : "no teas";
    const reach = (t) => (t === null ? "not even the next level" : `<b>+${t}</b>`);
    return (
        `<div class="mwia-guide-note">Success per attempt: ${odds.join(" · ")}${plan.blessed > 0 ? ` · ${(plan.blessed * 100).toFixed(1)}% of successes go up two` : ""}. ` +
        `${plan.cycleSeconds.toFixed(2)} s and ${coins(plan.attemptCost)} an attempt (${esc(teas)}; everything at the ask).</div>` +
        `<div class="mwia-guide-note">With your ${coins(plan.coins)} coins and what you have: ${reach(plan.reach.typical)} typically, ${reach(plan.reach.unlucky)} even with bad luck.</div>`
    );
}

function tableHtml(plan, id) {
    const top = Math.max(plan.start + SHOWN, (plan.reach.typical ?? plan.start) + PAST_REACH);
    const rows = plan.targets.map((t) => rowHtml(plan, t, id));
    const first = plan.targets.filter((t) => t.target <= top).length;
    const header = `<div class="mwia-plan-grid mwia-plan-header"><span>Target</span><span>Protect</span><span>Typical</span><span>Bad luck</span><span>Time</span></div>`;
    const more = rows.length > first
        ? `<details class="mwia-plan-more" data-plan-toggle="${esc(id)}:more"${e.open.has(`${id}:more`) ? " open" : ""}><summary>Higher targets (+${plan.targets[first].target} … +${plan.targets[rows.length - 1].target})</summary>${rows.slice(first).join("")}</details>`
        : "";
    return `<div class="mwia-plan-table">${header}${rows.slice(0, first).join("")}${more}</div>` +
        `<div class="mwia-guide-dim">Typical: half the time it costs less (the median). Bad luck: 9 times in 10 it costs less. Tap a row for the materials and to set it.</div>`;
}

function rowHtml(plan, t, id) {
    const toggle = `${id}:${t.target}`;
    const sim = t.typical;
    const cls = [sim ? "" : "mwia-plan-avg", (sim || t.mean).affordable ? "" : "mwia-plan-dear", t.target === plan.reach.typical ? "mwia-plan-reach" : ""].filter(Boolean).join(" ");
    const cells = [
        `<b>+${t.target}</b>`,
        t.protect ? `🛡 +${t.protect.from}` : "–",
        sim ? coins(sim.cost) : `≈${coins(t.mean.cost)}`,
        t.unlucky ? coins(t.unlucky.cost) : "–",
        duration((sim || t.mean).hours),
    ];
    return `<details class="mwia-plan-row ${cls}" data-plan-toggle="${esc(toggle)}"${e.open.has(toggle) ? " open" : ""}><summary class="mwia-plan-grid">${cells.map((c) => `<span>${c}</span>`).join("")}</summary>${detailHtml(plan, t)}</details>`;
}

function detailHtml(plan, t) {
    const lines = [];
    if (t.protect) {
        const saves = t.without ? ` On average ${coins(t.mean.cost)} with it against ${coins(t.without.cost)} without.` : "";
        lines.push(`🛡 Protect from +${t.protect.from} with ${esc(itemName(t.protect.itemHrid))} (${coins(t.protect.price)}): a failure from +${t.protect.from} on drops one level and uses one up; below it the item goes back to +0.${saves}`);
    } else lines.push(`No protection: it costs more than it saves for +${t.target}. A failure drops the item to +0.`);
    const sim = t.typical;
    if (sim) lines.push(`Typically ${count(sim.attempts)} attempts (${duration(sim.hours)}), with bad luck ${count(t.unlucky.attempts)} (${duration(t.unlucky.hours)}); on average ${count(t.mean.attempts)} attempts for ${coins(t.mean.cost)}.`);
    else lines.push(`Too many attempts to simulate: on average ${count(t.mean.attempts)} attempts (${duration(t.mean.hours)}), ${coins(t.mean.cost)}.`);
    const base = sim || t.mean;
    const bad = t.unlucky;
    const items = base.list.map((n, i) => {
        const b = bad?.list[i];
        const amount = `${count(n.count)}${b ? ` (bad luck ${count(b.count)})` : ""}`;
        const verdict = n.short > 0 ? `<b class="mwia-guide-low">${count(n.short)} short</b>` : b?.short > 0 ? `enough typically, ${count(b.short)} short with bad luck` : `<span class="mwia-ok">✓ ${count(n.have - (b || n).count)} to spare</span>`;
        return `<li>${esc(n.itemHrid === COIN ? "Coins" : itemName(n.itemHrid))}${n.protection ? " (protection)" : ""}${n.tea ? " (tea)" : ""}: ${amount} · have ${count(n.have)} · ${verdict}</li>`;
    });
    const cart = (outcome, label) => {
        const list = outcome ? outcome.list.filter((n) => n.itemHrid !== COIN && n.short > 0).map((n) => ({ hrid: n.itemHrid, quantity: n.short })) : [];
        return list.length ? `<button class="mwia-guide-cart" data-plan-cart="${esc(JSON.stringify(list))}" title="Adds to the MWITools cart: ${esc(list.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", "))}">${label}</button>` : "";
    };
    const protectHave = t.protect ? base.list.find((n) => n.protection)?.have || 0 : 0;
    const set = `<button class="mwia-guide-cart" data-plan-set="${t.target}"${t.protect && protectHave > 0 ? ` data-protect="${esc(t.protect.itemHrid)}" data-from="${t.protect.from}"` : ""}>▶ Set +${t.target}${t.protect ? (protectHave > 0 ? ` and protection from +${t.protect.from}` : "") : ""}</button>`;
    return (
        lines.map((l) => `<div class="mwia-guide-note">${l}</div>`).join("") +
        `<ul class="mwia-guide-list">${items.join("")}</ul>` +
        `<div class="mwia-plan-buttons">${set}${cart(sim ? sim : t.mean, sim ? "🛒 What's short (typical)" : "🛒 What's short (average)")}${cart(bad, "🛒 What's short (bad luck)")}</div>` +
        (t.protect && protectHave <= 0 ? `<div class="mwia-guide-dim">Buy the protection first, then ▶ puts it in too.</div>` : "")
    );
}

function runPlan(id) {
    const [itemHrid, startText] = [id.slice(0, id.lastIndexOf("+")), id.slice(id.lastIndexOf("+") + 1)];
    const start = Number(startText) || 0;
    e.busy = id;
    e.statuses.delete(id);
    scheduleScan();
    // Let the "Simulating…" line show before the work blocks the page.
    setTimeout(() => {
        try {
            const { key, who, data } = planInputs(itemHrid, start);
            e.plans.set(id, { key, plan: enhancePlan({ itemHrid, start, who, data, market: skillingMarket("bid") }) });
        } catch (error) {
            console.warn("[MWI Advisor] enhancing plan", error);
            e.statuses.set(id, `Could not simulate: ${error.message}`);
        }
        e.busy = null;
        scheduleScan();
    }, SCAN_MS + 150);
}

async function setTarget(button, id) {
    const target = Number(button.dataset.planSet);
    const where = e.panels.get(id);
    const characterId = state.character?.character?.id;
    const protectHrid = button.dataset.protect;
    const protect = protectHrid && characterId ? { hash: inventoryItemHash(characterId, protectHrid), from: Number(button.dataset.from) } : null;
    const result = where ? await setEnhancing(where.panel, target, protect) : false;
    e.statuses.set(
        id,
        result === "item"
            ? `Target +${target} set${protect ? `, protection from +${protect.from}` : ""} – press the game's Enhance.`
            : result === "partial"
              ? `Target +${target} set, but put in ${itemName(protectHrid)} from +${button.dataset.from} yourself (${navDiagnostics()}).`
              : `Could not set it: enter +${target} yourself (${navDiagnostics() || "no Enhancing window"}).`
    );
    scheduleScan();
}

async function onClick(event) {
    const button = event.target.closest?.(".mwia-plan-box button");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const id = button.closest(".mwia-plan-box").dataset.plan;
    if (button.dataset.planRun) return runPlan(button.dataset.planRun);
    if (button.dataset.planSet) return setTarget(button, id);
    if (button.dataset.planCart) {
        const names = (list) => list.map((i) => itemName(i.hrid)).join(", ");
        try {
            const outcome = await e.deps.addToCart(JSON.parse(button.dataset.planCart));
            const parts = [];
            if (outcome.added.length) parts.push(`added ${names(outcome.added)}`);
            if (outcome.updated.length) parts.push(`topped up ${names(outcome.updated)}`);
            if (outcome.present.length) parts.push(`${names(outcome.present)} already in the cart`);
            if (outcome.failed.length) parts.push(`could not add ${names(outcome.failed)}`);
            e.statuses.set(id, "Cart: " + parts.join("; ") + ".");
        } catch (error) {
            e.statuses.set(id, error.message);
        }
        scheduleScan();
    }
}

// Rows stay open (or closed) when the box is drawn again.
function onToggle(event) {
    const el = event.target;
    const key = el?.closest?.(".mwia-plan-box") && el.dataset?.planToggle;
    if (!key) return;
    if (el.open) e.open.add(key);
    else e.open.delete(key);
}
