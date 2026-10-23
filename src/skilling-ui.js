// The Skilling tab: gathering and crafting ranked by gold per day, with the
// calculation behind every number one tap away.

import { getClientData, itemName, marketEntry, pricesStamp } from "./game-data.js";
import { state } from "./game-state.js";
import { coinsInput, esc, shortCoins } from "./format.js";
import { MARKET_TAX, NEAR_LEVELS, SKILLING_SKILLS, heldStock, marketPricer, rankSkilling, skillingCharacter } from "./skilling.js";

const SHORT_LIST = 25;
const PLAN_DAYS = [0.5, 1, 2, 3, 7];
const MIN_JOB_HOURS = [0, 0.5, 1, 2, 4, 8];

const view = { key: "", result: null, showAll: false };

const dec = (n, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (fraction) => `${fraction >= 0 ? "+" : ""}${dec(fraction * 100, 1)}%`;
const count = (n) => (n >= 100 ? dec(n, 0) : n >= 1 ? dec(n, 2) : n.toPrecision(2));
const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const skillLabel = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
const skillOf = (entry) => entry.skill.split("/").pop();
const names = (teas) => teas.map(itemName).join(", ");

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
    </div>`;
}

function ranking(settings) {
    const data = getClientData();
    const key = [state.updatedAt, pricesStamp(), settings.skillingSkill, settings.skillingSellAt, settings.skillingTeas, settings.skillingSellCap, settings.skillingDays, settings.skillingMinJob].join("|");
    if (view.key !== key) {
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
        };
        view.result = rankSkilling(who, data, market, { skill: settings.skillingSkill, teaMode: settings.skillingTeas, sellCap: Number(settings.skillingSellCap) || 0, plan });
        view.key = key;
    }
    return view.result;
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
        ? `<span class="mwia-skill-hint">🍵 +${coins(entry.best.result.goldPerDay - entry.current.goldPerDay)}/day with other teas</span>`
        : "";
    const gold = entry.valid ? `<span class="${day < 0 ? "mwia-bad" : best ? "mwia-ok" : ""}">${coins(day)}/day</span>` : `<span class="mwia-dim">–</span>`;
    const faded = !entry.valid || day <= 0 || entry.suggestion?.short;
    return `<details class="mwia-skill-row${best && !faded ? " mwia-best" : ""}${faded ? " mwia-faded" : ""}" data-hrid="${esc(entry.hrid)}">
      <summary><span class="mwia-skill-name">${esc(entry.action.name)}${warn}<small>${sub}</small>${teaHint}</span>
        <span class="mwia-skill-nums"><b>${gold}</b><span class="mwia-dim">${coins(entry.xpPerDay)} XP/day</span></span></summary>
      <div class="mwia-skill-detail">${detailHtml(entry, upcoming)}</div></details>`;
}

function detailHtml(e, upcoming) {
    const lines = [];
    const speed = e.speed ? ` → ${dec(e.cycleSeconds, 2)} s with ${pct(e.speed)} speed${e.cycleSeconds <= 3 + 1e-9 ? " (3 s is the floor)" : ""}` : "";
    const buffEfficiency = e.efficiency - e.levelEfficiency;
    lines.push(`<b>Time:</b> ${dec(e.baseSeconds, 1)} s${speed}. Efficiency ${pct(e.efficiency)} (levels ${pct(e.levelEfficiency)}: level ${dec(e.effectiveLevel, 0)} vs ${dec(e.requiredLevel, 0)} needed${buffEfficiency ? `, buffs ${pct(buffEfficiency)}` : ""}) → <b>${dec(e.actionsPerHour, 0)} actions/h</b>.`);

    const outputs = e.outputs.filter((o) => o.value > 0 || o.kind === "product").map((o) => {
        const how = o.sell.source === "ask" || o.sell.source === "bid" ? ` <span class="mwia-dim">(${o.sell.source} −${dec(MARKET_TAX * 100, 0)}%)</span>` : o.sell.source === "vendor" || o.sell.source === "contents" ? ` <span class="mwia-dim">(${o.sell.source})</span>` : "";
        return `${count(o.count)} × ${esc(itemName(o.itemHrid))} @ ${coins(o.price)}${how}`;
    });
    const boosts = [e.quantity && `quantity ${pct(e.quantity)}`, e.processing && `processing ${pct(e.processing)}`].filter(Boolean).join(", ");
    lines.push(`<b>Each action gives</b>${boosts ? ` (${boosts})` : ""}: ${outputs.join(" · ")} = ${coins(e.revenuePerAction)}`);
    if (e.inputs.length) {
        const inputs = e.inputs.map((i) => `${count(i.count)} × ${esc(itemName(i.itemHrid))} @ ${i.price === null ? "–" : coins(i.price)}`);
        lines.push(`<b>Each action uses</b>${e.artisan ? ` (artisan ${pct(-e.artisan)})` : ""}: ${inputs.join(" · ")} = ${coins(e.costPerAction)}`);
    }
    if (e.teas.length) {
        lines.push(`<b>Teas:</b> ${e.teaCosts.map((t) => `${esc(itemName(t.itemHrid))} @ ${coins(t.price)}`).join(" · ")}, ${dec(e.drinksPerHour, 1)} of each per hour = ${coins(e.teaPerHour)}/h`);
    }
    const hours = e.capped ? ` × ${dec(e.hoursPerDay, 1)} h` : " × 24";
    lines.push(`<b>Gold:</b> (${coins(e.revenuePerAction)} − ${coins(e.costPerAction)}) × ${dec(e.actionsPerHour, 0)}${e.teas.length ? ` − ${coins(e.teaPerHour)}` : ""} = ${coins(e.profitPerHour)}/h${hours} = <b>${coins(e.goldPerDay)}/day</b>${e.margin !== null ? ` <span class="mwia-dim">(margin ${dec(e.margin * 100, 1)}%)</span>` : ""}`);
    if (e.capped) lines.push(`<span class="mwia-dim">The market takes ${coins(e.mainCount * e.actionsPerHour * e.hoursPerDay)} a day (your limit), so this runs ${dec(e.hoursPerDay, 1)} h a day; fill the rest with something else.</span>`);
    lines.push(`<b>XP:</b> ${dec(e.xpPerAction, 1)} per action × ${dec(e.actionsPerHour, 0)} = ${coins(e.xpPerHour)}/h${hours} = <b>${coins(e.xpPerDay)}/day</b>`);
    for (const warning of e.warnings) lines.push(`<span class="mwia-warn">⚠ ${esc(warningText(warning))}</span>`);
    if (!upcoming && e.suggestion) lines.push(suggestionHtml(e));
    if (!upcoming) lines.push(teaHtml(e));
    return lines.map((line) => `<p>${line}</p>`).join("");
}

function teaHtml(entry) {
    const { current, best } = entry;
    const now = current.teas.length ? `Your teas: ${esc(names(current.teas))}.` : "You have no teas in this skill.";
    if (!entry.betterTeas) {
        if (!best.result.teas.length) return `<b>Teas:</b> ${now} No tea earns back its cost here.`;
        return `<b>Teas:</b> ${now} That is already the best setup. ${worthText(best.worth)}`;
    }
    return `<b>Teas:</b> ${now} Best: <b>${esc(names(best.result.teas)) || "none"}</b> → ${coins(best.result.goldPerDay)}/day
        (<span class="mwia-ok">+${coins(best.result.goldPerDay - current.goldPerDay)}</span>). ${worthText(best.worth)}`;
}

function worthText(worth) {
    if (!worth.length) return "";
    return worth.map((w) => `${esc(itemName(w.itemHrid))} earns ${coins(w.gainPerDay)}/day more than it costs.`).join(" ");
}

function suggestionShort(suggestion) {
    if (!suggestion?.known) return "";
    if (!suggestion.demand) return " · no buyers above break-even";
    if (!suggestion.count) return " · you hold enough";
    return ` · make ${suggestion.count.toLocaleString("en-US")} (${hoursText(suggestion.hours)}${suggestion.short ? ", short job" : ""})`;
}

function suggestionHtml(e) {
    const s = e.suggestion;
    const productHrid = e.action.outputItems[0].itemHrid;
    const product = esc(itemName(productHrid));
    const market = `<button class="mwia-cart-btn" data-action="skilling-market" data-item="${esc(productHrid)}" title="Opens ${product} on the market; its buy and sell orders are read from there.">🏪 Market</button>`;
    if (!s.known) {
        return `<b>How many:</b> open ${product} on the market once (its buy orders are read from there), or set <i>Max sold/day</i>, to get a suggestion. ${market}`;
    }
    if (!s.demand) {
        return `<b>How many:</b> no buy orders pay ${coins(s.breakEven)} or more, the price where it stops paying off <span class="mwia-dim">(order book ${hoursText((Date.now() - s.bookAt) / 3600000)} old)</span>.
            Selling at the ask still works, but how many sell is unknown: set <i>Max sold/day</i> for a count. ${market}`;
    }
    const sources = [];
    if (s.fromCap !== null) sources.push(`${s.fromCap.toLocaleString("en-US")} by your <i>Max sold/day</i> × days`);
    if (s.profitableBids !== null) sources.push(`${s.profitableBids.toLocaleString("en-US")} in buy orders at ≥ ${coins(s.breakEven)} <span class="mwia-dim">(order book ${hoursText((Date.now() - s.bookAt) / 3600000)} old)</span>`);
    const held = s.stock.inventory || s.stock.listed ? ` − ${(s.stock.inventory + s.stock.listed).toLocaleString("en-US")} you already have (${s.stock.inventory.toLocaleString("en-US")} in inventory, ${s.stock.listed.toLocaleString("en-US")} listed)` : "";
    let html = `<b>How many:</b> the market takes ${s.demand.toLocaleString("en-US")}: ${sources.join(" or ")}${held}.`;
    if (s.profitableBids === null) html += ` Break-even price ${coins(s.breakEven)}.`;
    if (s.limitedByCoins) html += ` <span class="mwia-warn">Your coins only buy materials for ${s.count.toLocaleString("en-US")}.</span>`;
    if (!s.count) return html + ` You already hold enough – nothing to make. ${market}`;
    html += ` → <b>make ${s.count.toLocaleString("en-US")}</b> (${hoursText(s.hours)}${s.short ? ", shorter than your shortest job" : ""}).`;
    html += `<br><button class="mwia-btn" data-action="skilling-make" data-hrid="${esc(e.hrid)}" data-count="${s.count}">▶ Open ${esc(e.action.name)} with ${s.count.toLocaleString("en-US")}</button> ${market}`;
    return html;
}
