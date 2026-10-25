// The Skilling tab: gathering and crafting ranked by gold per day, with the
// calculation behind every number one tap away.

import { getClientData, itemName, marketEntry, marketListings, pricesStamp } from "./game-data.js";
import { state } from "./game-state.js";
import { coinsInput, esc, shortCoins } from "./format.js";
import { ASK_WINDOW, CALM_SWING, MARKET_TAX, NEAR_LEVELS, SKILLING_SKILLS, heldStock, marketPricer, rankSkilling, skillingCharacter } from "./skilling.js";
import { UPGRADES_SHOWN, rankUpgrades } from "./skilling-upgrades.js";
import { historyVersion, priceSummary, versusUsual } from "./price-history.js";

const SHORT_LIST = 25;
const PLAN_DAYS = [0.5, 1, 2, 3, 7];
const MIN_JOB_HOURS = [0, 0.5, 1, 2, 4, 8];

// open: the rows and headings the player has opened, kept across re-renders.
const view = { upgradesKey: "", upgrades: null, showAll: false, open: new Set() };

const dec = (n, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (fraction) => `${fraction >= 0 ? "+" : ""}${dec(fraction * 100, 1)}%`;
const count = (n) => (n >= 100 ? dec(n, 0) : n >= 1 ? dec(n, 2) : n.toPrecision(2));
const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const skillLabel = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
const skillOf = (entry) => entry.skill.split("/").pop();
const names = (teas) => teas.map(itemName).join(", ");

const goldShare = (s) => (s.skillingGold === undefined || s.skillingGold === "" ? 100 : Number(s.skillingGold));
const focusLabel = (gold) => (gold === 0 ? "XP only" : gold === 100 ? "Gold only" : `${100 - gold}% XP · ${gold}% gold`);

function hoursText(hours) {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${dec(hours, hours < 10 ? 1 : 0)} h`;
    return `${dec(hours / 24, hours < 240 ? 1 : 0)} days`;
}

export function skillingSettingsHtml(s) {
    const option = (value, label, current) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`;
    return `<div class="mwia-settings">
      <label>Skill <select data-setting="skillingSkill">${option("all", "All skills", s.skillingSkill)}${SKILLING_SKILLS.map((k) => option(k, skillLabel(k), s.skillingSkill)).join("")}</select></label>
      <label title="Products are listed at the cheapest ask (you wait for a buyer) or sold instantly to the best bid. The 4% market tax is taken off either way.">Sell at <select data-setting="skillingSellAt">${option("ask", "Ask (list it)", s.skillingSellAt)}${option("bid", "Bid (sell now)", s.skillingSellAt)}</select></label>
      <label title="Rank with the teas you have in the skill's drink slots now, or with the setup that earns the most.">Teas <select data-setting="skillingTeas">${option("current", "My current teas", s.skillingTeas)}${option("best", "Best teas", s.skillingTeas)}</select></label>
      <label title="How many of one crafted item the market takes a day, e.g. 500 or 2k. Past it the action only runs part of the day. Empty: no limit. Gathered raw materials are never limited.">Max sold/day <input data-setting="skillingSellCap" type="text" inputmode="decimal" size="6" placeholder="no limit" value="${Number(s.skillingSellCap) > 0 ? coinsInput(Number(s.skillingSellCap)) : ""}"></label>
      <label title="How many days of sales the suggested amount should cover.">Make for <select data-setting="skillingDays">${PLAN_DAYS.map((d) => option(String(d), `${d} day${d === 1 ? "" : "s"}`, String(s.skillingDays))).join("")}</select></label>
      <label title="Suggested jobs shorter than this are greyed out and listed last: not worth a trip to the market.">Shortest job <select data-setting="skillingMinJob">${MIN_JOB_HOURS.map((h) => option(String(h), h ? hoursText(h) : "any", String(s.skillingMinJob))).join("")}</select></label>
      <label class="mwia-focus" title="Rank by gold per day, XP per day, or a mix. Each counts as a share of the most any action in the list gives. The best teas follow the same focus.">
        Focus: <span class="mwia-focus-text">${focusLabel(goldShare(s))}</span>
        <span class="mwia-focus-row">XP <input type="range" min="0" max="100" step="10" value="${goldShare(s)}" data-setting="skillingGold"> Gold</span></label>
    </div>`;
}

// The last few rankings (the tab's skill, and the one open in the game's action window).
const rankings = new Map();
const KEPT_RANKINGS = 3;

function ranking(settings) {
    const key = [state.updatedAt, pricesStamp(), settings.skillingSkill, settings.skillingSellAt, settings.skillingTeas, settings.skillingSellCap, settings.skillingDays, settings.skillingMinJob, goldShare(settings), historyVersion()].join("|");
    if (!rankings.has(key)) {
        rankings.set(key, computeRanking(settings));
        while (rankings.size > KEPT_RANKINGS) rankings.delete(rankings.keys().next().value);
    }
    return rankings.get(key);
}

// One action's row, worked out with the tab's settings but always within its own
// skill, so the advice doesn't depend on which skill the tab shows.
export function skillingAdvice(actionHrid, settings) {
    const skill = actionHrid.split("/")[2];
    if (!SKILLING_SKILLS.includes(skill)) return null;
    const result = ranking({ ...settings, skillingSkill: skill });
    return result.available.find((entry) => entry.hrid === actionHrid) || null;
}

function computeRanking(settings) {
    const data = getClientData();
    {
        const who = skillingCharacter(state.character, state.items, data);
        const market = marketPricer((hrid) => marketEntry(hrid), data, settings.skillingSellAt);
        const have = (hrid) => heldStock(state.character, state.items, hrid).inventory;
        const plan = {
            stock: (action) => heldStock(state.character, state.items, action.outputItems?.[0]?.itemHrid),
            book: (action) => state.orderBooks.get(action.outputItems?.[0]?.itemHrid) || null,
            days: Number(settings.skillingDays) || 1,
            minJobHours: Number(settings.skillingMinJob) || 0,
            coins: have("/items/coin"),
            have,
            sellAt: settings.skillingSellAt,
            price: (action) => priceNow(action.outputItems?.[0]?.itemHrid, settings.skillingSellAt),
        };
        const result = rankSkilling(who, data, market, { skill: settings.skillingSkill, teaMode: settings.skillingTeas, sellCap: Number(settings.skillingSellCap) || 0, plan, goldWeight: goldShare(settings) / 100 });
        for (const entry of [...result.available, ...result.upcoming]) entry.warnings = [...entry.warnings, ...priceWarnings(entry)];
        return result;
    }
}

// The selling side's typical swing and where its price is now against the usual one (once there is enough history).
function priceNow(itemHrid, sellAt) {
    const summary = itemHrid ? priceSummary(itemHrid) : null;
    if (!summary?.enough) return null;
    const side = sellAt === "bid" ? "b" : "a";
    const now = marketEntry(itemHrid)?.[side];
    const usual = summary[side].med7;
    return { swing: summary[side].swing, diff: now > 0 && usual > 0 ? now / usual - 1 : null };
}

// Prices far from their usual level (once enough history is collected): the
// product you sell, and materials you buy.
function priceWarnings(entry) {
    const warnings = [];
    const main = entry.outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0];
    if (main && (main.sell.source === "ask" || main.sell.source === "bid")) {
        const summary = priceSummary(main.itemHrid);
        const side = main.sell.source === "ask" ? "a" : "b";
        const versus = summary?.enough ? versusUsual(main.sell[main.sell.source], summary[side].med7) : null;
        if (versus && versus.label !== "near") warnings.push({ kind: versus.label === "above" ? "pricehigh" : "pricelow", itemHrid: main.itemHrid, diff: versus.diff, usual: summary[side].med7 });
        // A margin smaller than the price's normal swing can vanish on an ordinary day.
        const swing = summary?.enough ? summary[side].swing : null;
        if (swing > CALM_SWING && entry.margin > 0 && entry.margin < swing) warnings.push({ kind: "swing", itemHrid: main.itemHrid, swing, margin: entry.margin });
    }
    for (const input of entry.inputs) {
        const summary = priceSummary(input.itemHrid);
        const versus = summary?.enough ? versusUsual(input.price, summary.a.med7) : null;
        if (versus?.label === "above") warnings.push({ kind: "inputhigh", itemHrid: input.itemHrid, diff: versus.diff, usual: summary.a.med7 });
    }
    return warnings;
}

// Remembers which rows and headings are open (toggle events don't bubble: listen in the capture phase).
export function rememberToggle(event) {
    const key = event.target.dataset?.open;
    if (!key) return;
    if (event.target.open) view.open.add(key);
    else view.open.delete(key);
}

export function toggleShowAll() {
    view.showAll = !view.showAll;
}

export function renderSkilling(settings) {
    const { available, upcoming } = ranking(settings);
    let html = skillingSettingsHtml(settings);
    html += `<p class="mwia-dim">Gold per day after the ${dec(MARKET_TAX * 100, 0)}% market tax, with materials and teas bought at the cheapest ask. Only what your levels allow. Tap a row to see how it was worked out.</p>`;
    if (available[0] && !available[0].buffsKnown) {
        html += `<div class="mwia-notice mwia-notice-warn">The game hasn't sent your buffs (house, equipment, community) yet, so only levels and teas are counted. Reload the page to fix it.</div>`;
    }
    const shown = view.showAll ? available : available.slice(0, SHORT_LIST);
    html += `<section><h3>Best now</h3>`;
    if (!available.length) html += `<p class="mwia-dim">Nothing to do in this skill at your level.</p>`;
    html += `<div class="mwia-skill-list">${shown.map((entry, i) => rowHtml(entry, i === 0 && entry.valid && entry.profitPerHour > 0)).join("")}</div>`;
    if (available.length > SHORT_LIST) {
        html += `<button class="mwia-link" data-action="skilling-all">${view.showAll ? "Show fewer" : `Show all ${available.length}`}</button>`;
    }
    html += `</section>`;
    html += upgradesHtml(settings);
    if (upcoming.length) {
        html += `<section><h3>Unlocks soon</h3><p class="mwia-dim">Within ${NEAR_LEVELS} levels, worked out at the level it unlocks. The time assumes you train the skill with its fastest XP action you have now.</p>
          <div class="mwia-skill-list">${upcoming.map((entry) => rowHtml(entry, false, true)).join("")}</div></section>`;
    }
    return html;
}

function warningText(warning) {
    const item = itemName(warning.itemHrid);
    switch (warning.kind) {
        case "noinput":
            return `Nobody sells ${names(warning.items)} right now.`;
        case "nobids":
            return `No buy orders for ${item}: it may take a while to sell.`;
        case "noasks":
            return `No one lists ${item}; priced at the best bid.`;
        case "spread":
            return `Thin market for ${item}: the cheapest ask (${coins(warning.ask)}) is ${dec(warning.ask / warning.bid, 1)}× the best bid (${coins(warning.bid)}).`;
        case "vendor":
            return `${item} isn't on the market; valued at the vendor price.`;
        case "pricehigh":
            return `${item} sells ${Math.round(warning.diff * 100)}% above its usual price (7-day median ${coins(warning.usual)}): it may drop back.`;
        case "pricelow":
            return `${item} sells ${Math.round(-warning.diff * 100)}% below its usual price (7-day median ${coins(warning.usual)}): waiting may pay.`;
        case "inputhigh":
            return `${item} costs ${Math.round(warning.diff * 100)}% more than usual (7-day median ${coins(warning.usual)}).`;
        case "swing":
            return `${item}'s price usually swings ±${Math.round(warning.swing * 100)}% – more than the ${dec(warning.margin * 100, 1)}% margin.`;
        case "margin":
            return `Thin margin: a ${dec(warning.margin * 100, 1)}% drop in the selling price wipes out the profit.`;
        case "unsellable":
            return `${item} can't be sold.`;
        default:
            return "";
    }
}

function rowHtml(entry, best, upcoming = false) {
    const day = entry.goldPerDay;
    const sub = upcoming
        ? `${skillLabel(skillOf(entry))} ${entry.action.levelRequirement.level} · in ${entry.needLevels} level${entry.needLevels === 1 ? "" : "s"}${entry.hoursToUnlock !== null ? ` · ~${hoursText(entry.hoursToUnlock)}` : ""}`
        : `${skillLabel(skillOf(entry))} ${entry.action.levelRequirement.level}${entry.capped ? ` · ${dec(entry.hoursPerDay, 1)} h/day (sales limit)` : ""}${suggestionShort(entry.suggestion)}`;
    const warn = entry.warnings.length ? ` <span class="mwia-warn" title="${esc(entry.warnings.map(warningText).join(" "))}">⚠</span>` : "";
    const teaHint = !upcoming && entry.teaMode === "current" && entry.betterTeas
        ? `<span class="mwia-skill-hint">🍵 ${teaGain(entry.best.result, entry.current)} with other teas</span>`
        : "";
    const gold = entry.valid ? `<span class="${day < 0 ? "mwia-bad" : best ? "mwia-ok" : ""}">${coins(day)}/day</span>` : `<span class="mwia-dim">–</span>`;
    const chainHint = !upcoming && entry.chain && entry.chain.goldPerDay > entry.goldPerDay + 1
        ? `<span class="mwia-skill-hint">⛓ ${coins(entry.chain.goldPerDay)}/day making the materials yourself</span>`
        : "";
    const faded = !entry.valid || day <= 0 || entry.suggestion?.short;
    return `<details class="mwia-skill-row${best && !faded ? " mwia-best" : ""}${faded ? " mwia-faded" : ""}" data-hrid="${esc(entry.hrid)}" data-open="${esc(entry.hrid)}"${view.open.has(entry.hrid) ? " open" : ""}>
      <summary><span class="mwia-skill-name">${esc(entry.action.name)}${warn}<small>${sub}</small>${teaHint}${chainHint}</span>
        <span class="mwia-skill-nums"><b>${gold}</b><span class="mwia-dim">${coins(entry.xpPerDay)} XP/day</span></span></summary>
      <div class="mwia-skill-detail">${detailHtml(entry, upcoming)}</div></details>`;
}

// The detail of a row: action buttons and warnings up top, then one line per
// topic that opens to show how it was worked out.
function detailHtml(e, upcoming) {
    const section = (title, summary, body) => {
        const key = `${e.hrid}|${title}`;
        return `<details class="mwia-skill-sec" data-open="${esc(key)}"${view.open.has(key) ? " open" : ""}><summary><b>${title}</b> ${summary}</summary>${body.map((line) => `<p>${line}</p>`).join("")}</details>`;
    };
    const sections = [];
    const buttons = upcoming ? "" : actionButtons(e);
    const warnings = e.warnings.map((warning) => `<p class="mwia-warn">⚠ ${esc(warningText(warning))}</p>`).join("");

    const speed = e.speed ? ` → ${dec(e.cycleSeconds, 2)} s with ${pct(e.speed)} speed${e.cycleSeconds <= 3 + 1e-9 ? " (3 s is the floor)" : ""}` : "";
    const buffEfficiency = e.efficiency - e.levelEfficiency;
    sections.push(section("⏱ Speed", `${dec(e.actionsPerHour, 0)} actions/h`, [
        `${dec(e.baseSeconds, 1)} s${speed}. Efficiency ${pct(e.efficiency)} (levels ${pct(e.levelEfficiency)}: level ${dec(e.effectiveLevel, 0)} vs ${dec(e.requiredLevel, 0)} needed${buffEfficiency ? `, buffs ${pct(buffEfficiency)}` : ""}) → <b>${dec(e.actionsPerHour, 0)} actions/h</b>.`,
    ]));

    const gold = [];
    const outputs = e.outputs.filter((o) => o.value > 0 || o.kind === "product").map((o) => {
        const how = o.sell.source === "ask" || o.sell.source === "bid" ? ` <span class="mwia-dim">(${o.sell.source} −${dec(MARKET_TAX * 100, 0)}%)</span>` : o.sell.source === "vendor" || o.sell.source === "contents" ? ` <span class="mwia-dim">(${o.sell.source})</span>` : "";
        return `${count(o.count)} × ${esc(itemName(o.itemHrid))} @ ${coins(o.price)}${how}`;
    });
    const boosts = [e.quantity && `quantity ${pct(e.quantity)}`, e.processing && `processing ${pct(e.processing)}`].filter(Boolean).join(", ");
    gold.push(`<b>Each action gives</b>${boosts ? ` (${boosts})` : ""}: ${outputs.join(" · ")} = ${coins(e.revenuePerAction)}`);
    if (e.inputs.length) {
        const inputs = e.inputs.map((i) => `${count(i.count)} × ${esc(itemName(i.itemHrid))} @ ${i.price === null ? "–" : coins(i.price)}`);
        gold.push(`<b>Each action uses</b>${e.artisan ? ` (artisan ${pct(-e.artisan)})` : ""}: ${inputs.join(" · ")} = ${coins(e.costPerAction)}`);
    }
    if (e.teas.length) {
        gold.push(`<b>Teas:</b> ${e.teaCosts.map((t) => `${esc(itemName(t.itemHrid))} @ ${coins(t.price)}`).join(" · ")}, ${dec(e.drinksPerHour, 1)} of each per hour = ${coins(e.teaPerHour)}/h`);
    }
    const hours = e.capped ? ` × ${dec(e.hoursPerDay, 1)} h` : " × 24";
    gold.push(`(${coins(e.revenuePerAction)} − ${coins(e.costPerAction)}) × ${dec(e.actionsPerHour, 0)}${e.teas.length ? ` − ${coins(e.teaPerHour)}` : ""} = ${coins(e.profitPerHour)}/h${hours} = <b>${coins(e.goldPerDay)}/day</b>`);
    if (e.capped) gold.push(`<span class="mwia-dim">The market takes ${coins(e.mainCount * e.actionsPerHour * e.hoursPerDay)} a day (your limit), so this runs ${dec(e.hoursPerDay, 1)} h a day; fill the rest with something else.</span>`);
    sections.push(section("💰 Gold", `${coins(e.profitPerHour)}/h${e.margin !== null ? ` · margin ${dec(e.margin * 100, 1)}%` : ""}`, gold));
    if (e.chain) sections.push(section("⛓ Yourself", `${coins(e.chain.profitPerHour)}/h making the materials`, [chainHtml(e)]));

    sections.push(section("✨ XP", `${coins(e.xpPerHour)}/h`, [`${dec(e.xpPerAction, 1)} per action × ${dec(e.actionsPerHour, 0)} = ${coins(e.xpPerHour)}/h${hours} = <b>${coins(e.xpPerDay)}/day</b>`]));
    if (!upcoming && e.suggestion) sections.push(section("📦 How many", suggestionSummary(e.suggestion), [suggestionHtml(e)]));
    if (!upcoming) sections.push(section("🍵 Teas", teaSummary(e), [teaHtml(e)]));
    return buttons + warnings + sections.join("");
}

// Making the materials yourself, compared with buying them.
function chainHtml(e) {
    const c = e.chain;
    const shares = [`${dec(c.craftShare * 100, 0)}% ${esc(e.action.name)}`, ...[...c.shares].sort((a, b) => b.share - a.share).map((s) => `${dec(s.share * 100, 0)}% ${esc(itemName(s.itemHrid))} <span class="mwia-dim">(${skillLabel(s.action.type.split("/").pop())}, ${count(s.count)} each)</span>`)];
    const better = c.profitPerHour > e.profitPerHour;
    return `Make every material your levels allow, buy the rest: <b>${coins(c.profitPerHour)}/h = ${coins(c.goldPerDay)}/day</b>
        <span class="${better ? "mwia-ok" : "mwia-dim"}">(${better ? "+" : "−"}${coins(Math.abs(c.goldPerDay - e.goldPerDay))}/day vs buying)</span>.
        <br>Of each hour: ${shares.join(" · ")}.${c.bought.length ? `<br>Still bought: ${esc(names(c.bought))}.` : ""}
        <br><span class="mwia-dim">Each step uses that skill's teas; the gold is per hour of the whole chain.</span>`;
}

// ▶ Make N, 🍵 Buy teas and 🏪 Market, always in view when a row is open.
function actionButtons(e) {
    const crafted = e.action.function === "/action_functions/production";
    const productHrid = e.action.outputItems?.[0]?.itemHrid;
    const s = e.suggestion;
    const make = crafted && s?.count ? `<button class="mwia-btn" data-action="skilling-make" data-hrid="${esc(e.hrid)}" data-count="${s.count}">▶ Make ${s.count.toLocaleString("en-US")}</button>` : "";
    const plan = e.teaPlan;
    const teas = plan?.items.length
        ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-cart" data-teas="${esc(JSON.stringify(plan.items.map(({ hrid, quantity }) => ({ hrid, quantity }))))}" title="Adds the best teas for ${hoursText(plan.hours)} to the MWITools cart: ${esc(plan.items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", "))}">🍵 Buy teas</button>`
        : "";
    const market = crafted ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-market" data-item="${esc(productHrid)}" title="Opens ${esc(itemName(productHrid))} on the market; its buy and sell orders are read from there.">🏪 Market</button>` : "";
    return make || teas || market ? `<div class="mwia-skill-buttons">${make}${teas}${market}</div>` : "";
}

// What the better teas add: gold, or XP when the focus leans that way and gold drops.
function teaGain(best, current) {
    const gold = best.goldPerDay - current.goldPerDay;
    return gold >= 0 ? `+${coins(gold)}/day` : `+${coins(best.xpPerDay - current.xpPerDay)} XP/day`;
}

function teaSummary(entry) {
    const { best } = entry;
    if (entry.betterTeas) return `best: ${esc(names(best.result.teas)) || "none"} <span class="mwia-ok">${teaGain(best.result, entry.current)}</span>`;
    if (!best.result.teas.length) return "none pays off";
    return "yours are the best";
}

function teaHtml(entry) {
    const { current, best } = entry;
    const now = (current.teas.length ? `Your teas: ${esc(names(current.teas))}.` : "You have no teas in this skill.") + ` ${slotsLine(entry)}`;
    if (!entry.betterTeas) {
        if (!best.result.teas.length) return `${now} No tea earns back its cost here.`;
        return `${now} That is already the best setup. ${worthText(best.worth)}${purchaseText(entry.teaPlan)}`;
    }
    return `${now} Best: <b>${esc(names(best.result.teas)) || "none"}</b> → ${coins(best.result.goldPerDay)}/day, ${coins(best.result.xpPerDay)} XP/day
        (<span class="mwia-ok">${teaGain(best.result, current)}</span>). ${worthText(best.worth)}${purchaseText(entry.teaPlan)}`;
}

// "2 tea slots (Large Pouch)": one, plus what the pouch adds.
export function slotsLine(entry) {
    const n = entry.teaSlots;
    return `<span class="mwia-dim">${n} tea slot${n === 1 ? "" : "s"} (${entry.pouch ? esc(itemName(entry.pouch)) : "no pouch"}).</span>`;
}

function worthText(worth) {
    if (!worth.length) return "";
    return worth
        .map((w) => (w.gainPerDay >= 0 ? `${esc(itemName(w.itemHrid))} earns ${coins(w.gainPerDay)}/day more than it costs.` : `${esc(itemName(w.itemHrid))} costs ${coins(-w.gainPerDay)}/day and adds ${coins(w.xpPerDay)} XP/day.`))
        .join(" ");
}

function purchaseText(plan) {
    if (!plan) return "";
    const have = plan.items.length ? ` To buy: ${plan.items.map((i) => `${i.quantity.toLocaleString("en-US")} ${esc(itemName(i.hrid))}${i.have ? ` (you have ${i.have.toLocaleString("en-US")})` : ""}`).join(", ")}.` : " You have enough of each.";
    return `<br>For this job (${hoursText(plan.hours)}): ${plan.perTea.toLocaleString("en-US")} of each.${have}`;
}

function suggestionShort(suggestion) {
    if (!suggestion?.known) return "";
    return " · " + suggestionSummary(suggestion);
}

function suggestionSummary(s) {
    if (!s.known) return "open it on the market";
    if (!s.demand) return s.nearAsks === null ? "no buyers above break-even" : "no buyers or sellers to go by";
    if (!s.count) return "you hold enough";
    return `make ${s.count.toLocaleString("en-US")} (${hoursText(s.hours)}${s.short ? ", short job" : ""}) · ${coins(s.batch.materials)} in, ${s.batch.profit >= 0 ? "+" : "−"}${coins(Math.abs(s.batch.profit))}`;
}

function suggestionHtml(e) {
    const s = e.suggestion;
    const product = esc(itemName(e.action.outputItems[0].itemHrid));
    const bookAge = s.bookAt ? ` <span class="mwia-dim">(order book ${hoursText((Date.now() - s.bookAt) / 3600000)} old)</span>` : "";
    if (!s.known) {
        return `Open ${product} on the market once with 🏪 Market (its buy orders are read from there), or set <i>Max sold/day</i>, to get a suggestion.`;
    }
    if (!s.demand) {
        const sellers = s.nearAsks === null ? "" : " and nobody else lists it";
        return `No buy orders pay ${coins(s.breakEven)} or more, the price where it stops paying off${sellers}${bookAge}. Selling at the ask still works, but how many sell is unknown: set <i>Max sold/day</i> for a count.`;
    }
    const sources = [];
    if (s.fromCap !== null) sources.push(`${s.fromCap.toLocaleString("en-US")} by your <i>Max sold/day</i> × days`);
    if (s.profitableBids !== null) sources.push(`${s.profitableBids.toLocaleString("en-US")} in buy orders at ≥ ${coins(s.breakEven)}${bookAge}`);
    if (s.nearAsks) sources.push(`${s.nearAsks.toLocaleString("en-US")} listed by others within ${dec(ASK_WINDOW * 100, 0)}% of the lowest ask (${coins(s.lowestAsk)})`);
    const held = s.stock.inventory || s.stock.listed ? ` − ${(s.stock.inventory + s.stock.listed).toLocaleString("en-US")} you already have (${s.stock.inventory.toLocaleString("en-US")} in inventory, ${s.stock.listed.toLocaleString("en-US")} listed)` : "";
    let html = `The market takes ${s.demand.toLocaleString("en-US")}${sources.length > 1 ? ", the most of" : ":"} ${sources.join(" · ")}${held}.`;
    if (s.profitableBids === null) html += ` Break-even price ${coins(s.breakEven)}.`;
    const sw = s.swing;
    if (sw && sw.share < 1) {
        const why = [];
        if (sw.bySwing < 1) why.push(`its price usually swings ±${Math.round(sw.swing * 100)}%`);
        if (sw.high) why.push(`it is ${Math.round(sw.diff * 100)}% above its usual price now – sell it while it lasts`);
        html += ` Made ${Math.round(sw.share * 100)}% of that: ${why.join(", and ")}.`;
    }
    if (sw?.low) html += ` <span class="mwia-warn">It sells ${Math.round(-sw.diff * 100)}% below its usual price now – waiting, or making something else, may pay.</span>`;
    if (s.limitedByCoins) html += ` <span class="mwia-warn">Your coins only buy materials for ${s.count.toLocaleString("en-US")}.</span>`;
    if (s.limitedByDays && !s.limitedByCoins) html += ` Capped at ${s.days} day${s.days === 1 ? "" : "s"} of crafting (<i>Make for</i>).`;
    if (!s.count) return html + " You already hold enough – nothing to make.";
    html += ` → <b>make ${s.count.toLocaleString("en-US")}</b> (${hoursText(s.hours)}${s.short ? ", shorter than your shortest job" : ""}).`;
    const b = s.batch;
    const owned = b.materials - b.toBuy;
    html += `<br><b>This batch:</b> materials ${coins(b.materials)}${owned > 1 ? ` (you buy ${coins(b.toBuy)}; ${coins(owned)} worth is already in your inventory)` : ""}${b.teas > 1 ? `, teas ${coins(b.teas)}` : ""}.
        It sells for ${coins(b.revenue)} after tax → <b class="${b.profit >= 0 ? "mwia-ok" : "mwia-bad"}">${b.profit >= 0 ? "+" : "−"}${coins(Math.abs(b.profit))}</b>.
        <span class="mwia-dim">The coins come back as the items sell, so a slow seller ties them up for a while.</span>`;
    return html;
}

// ---------- upgrades that pay back ----------

const INVENTORY = "/item_locations/inventory";

function upgradeRanking(settings) {
    const skill = settings.skillingSkill;
    const key = [state.updatedAt, pricesStamp(), skill, settings.skillingSellAt, settings.skillingSellCap].join("|");
    if (view.upgradesKey !== key) {
        const data = getClientData();
        const equipped = {};
        const owned = {};
        for (const item of state.items.values()) {
            if (!item.itemHrid) continue;
            if (item.itemLocationHrid === INVENTORY) (owned[item.itemHrid] ||= []).push(item.enhancementLevel || 0);
            else equipped[item.itemLocationHrid] = { itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 };
        }
        const houseLevels = {};
        for (const [hrid, room] of Object.entries(state.character.characterHouseRoomMap || {})) houseLevels[hrid] = room.level || 0;
        view.upgrades = rankUpgrades(skillingCharacter(state.character, state.items, data), data, marketPricer((hrid) => marketEntry(hrid), data, settings.skillingSellAt), skill, {
            equipped,
            owned,
            listings: (hrid) => marketListings(hrid),
            houseLevels,
            sellCap: Number(settings.skillingSellCap) || 0,
            gameEquipmentBuffs: state.character.equipmentActionTypeBuffsMap || null,
        });
        view.upgradesKey = key;
    }
    return view.upgrades;
}

function upgradesHtml(settings) {
    if (settings.skillingSkill === "all") {
        return `<section><h3>Upgrades that pay back</h3><p class="mwia-dim">Pick a skill above to see which tools, clothes, jewellery and house rooms pay for themselves.</p></section>`;
    }
    const { base, upgrades, check } = upgradeRanking(settings);
    let html = `<section><h3>Upgrades that pay back</h3>`;
    if (!base) return html + `<p class="mwia-dim">Nothing in this skill earns gold at your level yet.</p></section>`;
    html += `<p class="mwia-dim">Each tried in place of what you wear now, measured on the skill's best action (now ${esc(base.action.name)}, ${coins(base.goldPerDay)}/day). Payback = price ÷ extra gold a day.</p>`;
    if (check && !check.matches) {
        html += `<div class="mwia-notice mwia-notice-warn">Your gear's action speed here is ${pct(check.game)} by the game but ${pct(check.mine)} by the item stats, so these numbers may be a little off.</div>`;
    }
    if (!upgrades.length) return html + `<p class="mwia-dim">Nothing for sale would earn more here.</p></section>`;
    html += `<div class="mwia-upgrade-list">${upgrades.slice(0, UPGRADES_SHOWN).map(upgradeRowHtml).join("")}</div></section>`;
    return html;
}

function upgradeRowHtml(u) {
    const payback = u.paybackDays === null ? "price unknown" : u.paybackDays === 0 ? "free – you own it" : `pays back in ${hoursText(u.paybackDays * 24)}`;
    const gain = `+${coins(u.gainPerDay)}/day${u.xpPerDay > 1 ? `, +${coins(u.xpPerDay)} XP/day` : ""}`;
    if (u.kind === "house") {
        const cart = u.materials.filter((m) => m.itemHrid !== "/items/coin").map((m) => ({ hrid: m.itemHrid, quantity: m.count }));
        const coinsNeeded = u.materials.find((m) => m.itemHrid === "/items/coin")?.count || 0;
        return `<div class="mwia-upgrade"><div><b>🏠 ${esc(u.name)} → level ${u.level}</b> <span class="mwia-dim">${u.price === null ? "" : coins(u.price)}</span>
            <small>${gain} · ${payback}${coinsNeeded ? ` · incl. ${coins(coinsNeeded)} coins` : ""}</small></div>
            ${cart.length ? `<button class="mwia-cart-btn" data-action="skilling-cart" data-teas="${esc(JSON.stringify(cart))}" title="Adds the materials to the MWITools cart">🛒 Materials</button>` : ""}</div>`;
    }
    const name = `${esc(itemName(u.itemHrid))}${u.enhancementLevel ? ` <span class="mwia-enh">+${u.enhancementLevel}</span>` : ""}`;
    const replaces = u.replaces ? `replaces ${esc(itemName(u.replaces.itemHrid))}${u.replaces.enhancementLevel ? ` +${u.replaces.enhancementLevel}` : ""}` : "empty slot";
    const cart = u.owned ? "" : `<button class="mwia-cart-btn" data-action="skilling-cart" data-teas="${esc(JSON.stringify([{ hrid: u.itemHrid, quantity: 1, enhancementLevel: u.enhancementLevel }]))}" title="Adds it to the MWITools cart">🛒 Add</button>`;
    return `<div class="mwia-upgrade"><div><b>${name}</b> <span class="mwia-dim">${u.owned ? "you own it" : coins(u.price)}</span>
        <small>${gain} · ${payback} · ${replaces}${slotsText(u)}</small></div>${cart}</div>`;
}

// A pouch with more drink slots, and the teas that fill them.
function slotsText(u) {
    if (!u.extraSlots) return "";
    const slots = `${u.extraSlots > 0 ? "+" : ""}${u.extraSlots} tea slot${Math.abs(u.extraSlots) === 1 ? "" : "s"}`;
    return ` · ${slots}${u.teas?.length ? ` (with ${esc(names(u.teas))} on ${esc(u.bestAction.name)})` : ""}`;
}
