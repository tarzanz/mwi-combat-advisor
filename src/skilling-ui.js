// The Skilling tab: gathering and crafting ranked by gold per day, with the
// calculation behind every number one tap away.

import { setBuyLimits } from "./buy-limits.js";
import { getClientData, itemName, marketBids, marketEntry, marketListings, pricesStamp } from "./game-data.js";
import { orderBookAt, state } from "./game-state.js";
import { esc, shortCoins } from "./format.js";
import { ASK_WINDOW, CALM_SWING, LEVELING_SKILLS, LIQUIDITY, MARKET_TAX, NEAR_LEVELS, PLAN_MODES, SKILLING_SKILLS, WIDE_SPREAD, heldStock, liquidityRating, marketPricer, rankSkilling, skillingCharacter } from "./skilling.js";
import { ENHANCE_FUNCTION, MIN_PROTECT } from "./enhancing.js";
import { ALCHEMY_FUNCTION, ALCHEMY_KINDS, bulkOf, decomposeEssence } from "./alchemy.js";
import { UPGRADES_SHOWN, rankUpgrades } from "./skilling-upgrades.js";
import { MIN_HOURS, historyVersion, priceSummary, versusUsual } from "./price-history.js";

const SHORT_LIST = 25;
const RATING = { stable: "🟢 stable market", ok: "🟡 ok market", thin: "🔴 thin market" };

// open: the rows and headings the player has opened, kept across re-renders.
const view = { upgradesKey: "", upgrades: null, showAll: false, open: new Set() };

const dec = (n, d = 1) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
const pct = (fraction) => `${fraction >= 0 ? "+" : ""}${dec(fraction * 100, 1)}%`;
const count = (n) => (n >= 100 ? dec(n, 0) : n >= 1 ? dec(n, 2) : n.toPrecision(2));
const coins = (n) => (n < 0 ? "−" : "") + shortCoins(Math.abs(n));
const skillLabel = (skill) => skill.charAt(0).toUpperCase() + skill.slice(1);
const skillOf = (entry) => entry.skill.split("/").pop();
const names = (teas) => teas.map(itemName).join(", ");

const planMode = (s) => (PLAN_MODES[s.skillingMode] ? s.skillingMode : "away");
const goldShare = (s) => (s.skillingGold === undefined || s.skillingGold === "" ? 100 : Number(s.skillingGold));
const focusLabel = (gold) => (gold === 0 ? "XP only" : gold === 100 ? "Gold only" : `${100 - gold}% XP · ${gold}% gold`);

function hoursText(hours) {
    if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min`;
    if (hours < 48) return `${dec(hours, hours < 10 && Math.round(hours * 10) % 10 ? 1 : 0)} h`;
    return `${dec(hours / 24, hours < 240 ? 1 : 0)} days`;
}

export function skillingSettingsHtml(s) {
    const option = (value, label, current) => `<option value="${value}" ${current === value ? "selected" : ""}>${label}</option>`;
    return `<div class="mwia-settings">
      <label>Skill <select data-setting="skillingSkill">${option("all", "All skills", s.skillingSkill)}${SKILLING_SKILLS.map((k) => option(k, skillLabel(k), s.skillingSkill)).join("")}<optgroup label="Levelling (costs gold)">${LEVELING_SKILLS.map((k) => option(k, skillLabel(k), s.skillingSkill)).join("")}</optgroup></select></label>
      <label title="Products are listed at the cheapest ask (you wait for a buyer) or sold instantly to the best bid. The 4% market tax is taken off either way.">Sell at <select data-setting="skillingSellAt">${option("ask", "Ask (list it)", s.skillingSellAt)}${option("bid", "Bid (sell now)", s.skillingSellAt)}</select></label>
      <label title="Rank with the teas you have in the skill's drink slots now, or with the setup that earns the most.">Teas <select data-setting="skillingTeas">${option("current", "My current teas", s.skillingTeas)}${option("best", "Best teas", s.skillingTeas)}</select></label>
      <label title="Away: a careful job of about ${hoursText(PLAN_MODES.away.hours)}, little of your coins unless the market is stable, thin margins left out. Medium: ${hoursText(PLAN_MODES.medium.hours)} jobs while you look in now and then. Active: ${hoursText(PLAN_MODES.active.hours)} jobs while you play, the most of your coins. Medium and Active show thin margins.">Plan <select data-setting="skillingMode">${[["away", "Away"], ["medium", "Medium"], ["active", "Active"]].map(([mode, name]) => option(mode, `${name} (${hoursText(PLAN_MODES[mode].hours)})`, planMode(s))).join("")}</select></label>
      <label class="mwia-focus" title="Rank by gold per day, XP per day, or a mix. Each counts as a share of the most any action in the list gives. The best teas follow the same focus.">
        Focus: <span class="mwia-focus-text">${focusLabel(goldShare(s))}</span>
        <span class="mwia-focus-row">XP <input type="range" min="0" max="100" step="10" value="${goldShare(s)}" data-setting="skillingGold"> Gold</span></label>
      <label title="Count the XP as the levels it gives the skill from where it is now: a low skill's levels are cheap, so this is the fastest way up in total level. Counted over a day of training.">
        Total level <span class="mwia-focus-row"><input type="checkbox" data-setting="countLevels" ${s.countLevels ? "checked" : ""}> Count levels, not XP</span></label>
    </div>`;
}

// The last few rankings (the tab's skill, and the one open in the game's action window).
const rankings = new Map();
const KEPT_RANKINGS = 4;

// fixed: { hrid, target } – an Enhancing or Alchemy action always listed, at the target set in the game.
function ranking(settings, fixed = null) {
    const key = [state.updatedAt, pricesStamp(), settings.skillingSkill, settings.skillingSellAt, settings.skillingTeas, planMode(settings), goldShare(settings), !!settings.countLevels, historyVersion(), JSON.stringify(fixed)].join("|");
    if (!rankings.has(key)) {
        rankings.set(key, computeRanking(settings, fixed));
        while (rankings.size > KEPT_RANKINGS) rankings.delete(rankings.keys().next().value);
    }
    return rankings.get(key);
}

// One action's row, worked out with the tab's settings but always within its own
// skill, so the advice doesn't depend on which skill the tab shows. Enhancing
// and Alchemy also need the item (job: { itemHrid, target }): the row for it,
// at the target set in the game.
export function skillingAdvice(actionHrid, settings, job = null) {
    const skill = actionHrid.split("/")[2];
    if (LEVELING_SKILLS.includes(skill)) {
        if (!job?.itemHrid) return null;
        // An enhanced item has a decompose row of its own.
        const level = skill === "alchemy" && actionHrid.endsWith("/decompose") ? Number(job.level) || 0 : 0;
        const hrid = `${actionHrid}#${job.itemHrid}${level > 0 ? `#+${level}` : ""}`;
        const fixed = { hrid, target: skill === "enhancing" ? Number(job.target) || null : null };
        return ranking({ ...settings, skillingSkill: skill }, fixed).available.find((entry) => entry.hrid === hrid) || null;
    }
    if (!SKILLING_SKILLS.includes(skill)) return null;
    const result = ranking({ ...settings, skillingSkill: skill });
    return result.available.find((entry) => entry.hrid === actionHrid) || null;
}

// "Tome Of Healing → +6" for Enhancing; the action's name otherwise.
export const adviceName = (entry) => entry.action.name + (entry.target ? ` → +${entry.target}` : "");

// The item in a game item key ("<character>::<location>::/items/x::<+level>").
export const itemOfHash = (hash) => String(hash || "").split("::")[2] || null;
// …and its +level.
export const levelOfHash = (hash) => Number(String(hash || "").split("::")[3]) || 0;

function computeRanking(settings, fixed = null) {
    const data = getClientData();
    {
        const who = skillingCharacter(state.character, state.items, data);
        const market = skillingMarket(settings.skillingSellAt);
        const plan = {
            stock: (action) => heldStock(state.character, state.items, action.outputItems?.[0]?.itemHrid),
            book: (action) => state.orderBooks.get(action.outputItems?.[0]?.itemHrid) || null,
            ...PLAN_MODES[planMode(settings)],
            coins: have("/items/coin"),
            have,
            sellAt: settings.skillingSellAt,
            price: (action) => priceNow(action.outputItems?.[0]?.itemHrid, settings.skillingSellAt),
            liquidity: (action) => (action.outputItems?.[0]?.itemHrid === COIN ? COIN_MARKET : liquidityRating(action.outputItems?.[0]?.itemHrid ? priceSummary(action.outputItems[0].itemHrid) : null)),
            inputMarket: (hrid, level = 0) => ({ liquidity: liquidityRating(priceSummary(hrid, level)), book: level ? orderBookAt(hrid, level) : state.orderBooks.get(hrid) || null }),
        };
        const leveling = { ...levelingOptions(settings, data), fixed };
        const result = rankSkilling(who, data, market, { skill: settings.skillingSkill, teaMode: settings.skillingTeas, plan, goldWeight: goldShare(settings) / 100, countLevels: !!settings.countLevels, leveling });
        for (const entry of [...result.available, ...result.upcoming]) {
            entry.warnings = [...entry.warnings, ...(isEnhance(entry) ? enhanceWarnings(entry) : priceWarnings(entry)), ...rollWarnings(entry)];
            if (isAlchemy(entry) && entry.suggestion) entry.suggestion.verb = ALCHEMY_KINDS[entry.action.kind].name.toLowerCase();
        }
        return result;
    }
}

// Enhancing and Alchemy: what a +level sells for, and how many of an item you have.
// Alchemy decomposes an enhanced item too: the +levels you have or can buy,
// bought at the ask, and one you have worth what it would sell for (the bid).
const levelingOptions = (settings, data) => ({
    resale: (hrid, level) => plusResale(hrid, level, settings.skillingSellAt, data),
    owned: (hrid, level = 0) => have(hrid, level),
    plusLevels: (hrid) => [...new Set([...marketListings(hrid).map((l) => l.enhancementLevel), ...heldLevels(hrid)])].filter((level) => level > 0).sort((a, b) => a - b),
    plusBuy: (hrid, level) => marketEntry(hrid, level)?.a > 0 ? marketEntry(hrid, level).a : null,
    plusHeld: (hrid, level) => plusResale(hrid, level, "bid", data).price,
});

// Prices for the skilling advice: a listing is never valued above the item's
// usual (7-day median) ask once there are MIN_HOURS of history, and what is
// made past a day's sales goes for less (once the history knows them).
export function skillingMarket(sellAt) {
    const usualAsk = (hrid) => {
        const summary = priceSummary(hrid);
        return summary && summary.hours7 >= MIN_HOURS ? summary.a.med7 : null;
    };
    const soldOf = (hrid) => {
        const sold = priceSummary(hrid)?.liquidity?.sold;
        return sold?.enough ? sold.perDay : null;
    };
    return marketPricer((hrid) => marketEntry(hrid), getClientData(), sellAt, usualAsk, soldOf);
}

const COIN = "/items/coin";
// Coins need no buyer.
const COIN_MARKET = { rating: "stable", known: true, coin: true };
const isEnhance = (entry) => entry.action.function === ENHANCE_FUNCTION;
const isAlchemy = (entry) => entry.action.function === ALCHEMY_FUNCTION;

// What an item enhanced to +level sells for, after tax. Listed (Sell at: ask):
// the lowest ask, but never above the week's usual ask at that level (or,
// without history, 1.5× the bid) – and only when something backs it: a buyer
// at that +level, its usual ask, or sales. A lone listing nobody buys from
// says nothing. Sold now (bid): the best bid, or the usual bid when nobody
// bids right now. With neither, the nearest lower level's bid is a floor (a +6
// sells for at least what a +5 does, once listed), else the shop.
// floor: that floor, for what the market can't take (sold: a day, once known).
export function plusResale(itemHrid, level, sellAt, data) {
    const entry = marketEntry(itemHrid, level);
    const summary = priceSummary(itemHrid, level);
    const usual = summary?.hours7 >= MIN_HOURS ? summary : null;
    const ask = entry?.a > 0 ? entry.a : null;
    const bid = entry?.b > 0 ? entry.b : null;
    const usualAsk = usual?.a.med7 > 0 ? usual.a.med7 : null;
    const usualBid = usual?.b.med7 > 0 ? usual.b.med7 : null;
    const soldNow = summary?.liquidity?.sold;
    const sold = soldNow?.enough ? soldNow.perDay : null;
    const lower = marketBids(itemHrid).filter((b) => b.enhancementLevel < level).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
    const vendor = data.itemDetailMap[itemHrid]?.sellPrice || 0;
    const floor = lower ? lower.bid * (1 - MARKET_TAX) : vendor;
    const base = { ask, bid, usualAsk, usualBid, history: !!usual, sold, floor, floorLevel: lower ? lower.enhancementLevel : null };
    const out = (price, source, from = level) => ({ ...base, price: price * (1 - MARKET_TAX), source, level: from });
    const backed = bid || usualAsk || sold > 0;
    if (sellAt === "ask" && backed && (ask || usualAsk)) {
        const ceiling = usualAsk || (bid ? WIDE_SPREAD * bid : soldNow?.price || Infinity);
        return out(Math.min(ask || usualAsk, ceiling), ask ? (ask > ceiling ? (usualAsk ? "usual" : "spread") : "ask") : "usual");
    }
    if (bid || usualBid) return out(bid || usualBid, bid ? "bid" : "usualbid");
    const unbacked = sellAt === "ask" && ask ? ask : null;
    if (lower) return { ...out(lower.bid, "lower", lower.enhancementLevel), unbacked };
    return { ...base, price: vendor, source: "vendor", level: null, unbacked };
}

// Decomposing an enhanced item is one roll each: with few of them the result
// can be far from the average (the guide's "don't decompose a +20 unless you
// have more of them to average out").
export const FEW_ROLLS = 10;
function rollWarnings(entry) {
    const plus = isAlchemy(entry) ? entry.action.enhancementLevel || 0 : isEnhance(entry) && entry.finish ? entry.target : 0;
    if (!plus) return [];
    // How many a job decomposes: the suggested count, or what the planned hours of enhancing make.
    const n = isAlchemy(entry) ? entry.suggestion?.count ?? have(entry.action.itemHrid, plus) : Math.round(entry.itemsPerHour * (entry.budget?.hours ?? PLAN_MODES.away.hours));
    if (n >= FEW_ROLLS) return [];
    const successRate = isAlchemy(entry) ? entry.successRate : entry.finish.entry.successRate;
    return [{ kind: "oneroll", itemHrid: entry.action.itemHrid, level: plus, successRate, count: n }];
}

// Enhancing: a +level that only sells as a floor, or at the shop.
function enhanceWarnings(entry) {
    const sell = entry.outputs[0]?.sell;
    if (!sell || sell.source === "decompose") return [];
    if (sell.source === "lower" || sell.source === "vendor") return [{ kind: "plusfloor", itemHrid: entry.action.itemHrid, target: entry.target, from: sell.level, unbacked: sell.unbacked }];
    if (!sell.history) return [{ kind: "plusnohistory", itemHrid: entry.action.itemHrid, target: entry.target }];
    return [];
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
    setBuyLimits(
        available
            .filter((e) => e.valid && e.suggestion?.inputs?.length)
            .map((e) => ({ hrid: e.hrid, name: e.action.name, inputs: e.suggestion.inputs.map((i) => ({ itemHrid: i.itemHrid, limitPrice: i.limitPrice, margin: e.suggestion.limitMargin })) })),
    );
    let html = skillingSettingsHtml(settings);
    const leveling = LEVELING_SKILLS.includes(settings.skillingSkill);
    if (settings.skillingSkill === "enhancing") html += `<p class="mwia-dim">Enhance an item towards a target +level again and again: a failure drops it back to +0 – or, protected from a +level on, one level, using up the cheapest protection (a copy, a Mirror of Protection or the item's own) – reaching the target you sell it and buy a new one. One row per item, at the target that suits your <i>Focus</i>; gold per day is what it costs (−) after selling. Items you have at +0 are used first, valued at what they'd sell for. Tap a row for the odds and every target.</p>`;
    else if (settings.skillingSkill === "alchemy") html += `<p class="mwia-dim">Coinify, decompose or transmute items bought at the cheapest ask. The odds, the coins it costs, the bulk size, the catalyst that suits your <i>Focus</i>, Alchemy Essence and crates are counted. Gold per day after the ${dec(MARKET_TAX * 100, 0)}% market tax.</p>`;
    else html += `<p class="mwia-dim">Gold per day after the ${dec(MARKET_TAX * 100, 0)}% market tax, with materials and teas bought at the cheapest ask. Only what your levels allow. Tap a row to see how it was worked out.</p>`;
    if (available[0] && !available[0].buffsKnown) {
        html += `<div class="mwia-notice mwia-notice-warn">The game hasn't sent your buffs (house, equipment, community) yet, so only levels and teas are counted. Reload the page to fix it.</div>`;
    }
    const listed = available.filter((entry) => !entry.thinMargin);
    const thin = available.length - listed.length;
    const shown = view.showAll ? available : listed.slice(0, SHORT_LIST);
    const mode = PLAN_MODES[planMode(settings)];
    html += `<section><h3>Best now</h3><p class="mwia-dim">${settings.skillingSkill === "enhancing" ? "Ranked by your Focus: XP per day against what it costs." : `Ranked by what a ${hoursText(mode.hours)} job gives: the amount is what your coins, your stock and the market allow – no need to open the market.`}</p>`;
    if (!available.length) html += `<p class="mwia-dim">Nothing to do in this skill at your level.</p>`;
    html += `<div class="mwia-skill-list">${shown.map((entry, i) => rowHtml(entry, i === 0 && entry.valid && entry.profitPerHour > 0 && !entry.thinMargin, false, i === 0)).join("")}</div>`;
    if (available.length > shown.length || view.showAll) {
        const hidden = thin ? ` (${thin} with a thin margin)` : "";
        html += `<button class="mwia-link" data-action="skilling-all">${view.showAll ? "Show fewer" : `Show all ${available.length}${hidden}`}</button>`;
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
        case "plusfloor": {
            const listing = warning.unbacked ? ` The listing at ${coins(warning.unbacked)} isn't counted: nobody bids for +${warning.target} and it hasn't been seen selling.` : "";
            return (warning.from === null || warning.from === undefined ? `Nobody buys ${item} +${warning.target} or a lower +level: valued at the shop price.` : `Nobody buys ${item} +${warning.target} right now: valued at the +${warning.from} bid – list it to sell.`) + listing;
        }
        case "plusnohistory":
            return `Under ${MIN_HOURS} hours of prices for ${item} +${warning.target} yet: its price now is used as it is.`;
        case "oneroll":
            return `Each decompose of ${item} +${warning.level} is one roll: ${dec((1 - warning.successRate) * 100, 0)}% of the time the item is lost for nothing. ${warning.count < 1 ? "Under one of them in a job" : `With ${warning.count} of them in a job`}, the result can be far from the average shown – it evens out over many.`;
        default:
            return "";
    }
}

function rowHtml(entry, best, upcoming = false, first = false) {
    const day = entry.goldPerDay;
    const leveling = isEnhance(entry) || isAlchemy(entry);
    const perXp = leveling && entry.coinsPerXp !== null ? ` · ${entry.coinsPerXp >= 0 ? `${dec(entry.coinsPerXp, 1)} coins/XP` : `earns ${dec(-entry.coinsPerXp, 1)}/XP`}` : "";
    const levelText = leveling ? `item level ${entry.action.levelRequirement.level}${isAlchemy(entry) ? ` · ${pct(entry.successRate).replace("+", "")} success` : ""}${entry.protect ? ` · protect from +${entry.protect.from}` : ""}${perXp}${suggestionShort(entry.suggestion)}${budgetShort(entry.budget)}` : "";
    const sub = leveling
        ? levelText
        : upcoming
        ? `${skillLabel(skillOf(entry))} ${entry.action.levelRequirement.level} · in ${entry.needLevels} level${entry.needLevels === 1 ? "" : "s"}${entry.hoursToUnlock !== null ? ` · ~${hoursText(entry.hoursToUnlock)}` : ""}`
        : `${skillLabel(skillOf(entry))} ${entry.action.levelRequirement.level}${entry.salesCap ? ` · sells ~${soldText(entry.salesCap.perDay)}/day` : ""}${suggestionShort(entry.suggestion)}`;
    const warn = entry.warnings.length ? ` <span class="mwia-warn" title="${esc(entry.warnings.map(warningText).join(" "))}">⚠</span>` : "";
    const teaHint = !upcoming && entry.teaMode === "current" && entry.betterTeas
        ? `<span class="mwia-skill-hint">🍵 ${teaGain(entry.best.result, entry.current)} with other teas</span>`
        : "";
    // A job shorter than the planned hours, or with materials bought up the order
    // book: the row shows (and ranks by) what it gives in them.
    const planned = (!leveling || isAlchemy(entry)) && !upcoming && entry.suggestion?.count && Number.isFinite(entry.plannedGoldPerDay);
    const fill = planned && entry.fill < 1 ? entry.fill : 1;
    const shownDay = planned ? entry.plannedGoldPerDay : day;
    const cut = planned && coins(shownDay) !== coins(day);
    const gold = entry.valid ? `<span class="${shownDay < 0 && !leveling ? "mwia-bad" : shownDay > 0 && (best || leveling) ? "mwia-ok" : ""}">${coins(shownDay)}/day</span>` : `<span class="mwia-dim">–</span>`;
    const full = cut ? `<span class="mwia-skill-full${fill < SHORT_FILL ? " mwia-warn" : ""}" title="The rate while it runs, with the materials at their lowest ask">${fill < 1 ? `full ${hoursText(entry.suggestion.plannedHours)}` : "at the lowest ask"}: ${coins(day)}/day</span>` : "";
    const chainHint = !upcoming && entry.chain && entry.chain.goldPerDay > entry.goldPerDay + 1
        ? `<span class="mwia-skill-hint">⛓ ${coins(entry.chain.goldPerDay)}/day making the materials yourself</span>`
        : !upcoming && entry.decomposeCraft
        ? `<span class="mwia-skill-hint">🧪 decompose them: ${esc(names(entry.decomposeCraft.reused.map((x) => x.itemHrid).filter((h) => h !== COIN)) || "materials")} back</span>`
        : !upcoming && entry.alchemyChain
        ? `<span class="mwia-skill-hint">⛓ then ${esc(entry.alchemyChain.further.slice(0, 2).map((f) => f.name).join(", "))}${entry.alchemyChain.further.length > 2 ? ` +${entry.alchemyChain.further.length - 2} more` : ""}</span>`
        : "";
    // What the job made and you hold, waiting to be decomposed.
    const waiting = !upcoming ? decomposeHeld(entry) : null;
    const heldHint = waiting?.held ? `<span class="mwia-skill-hint">🧪 ${waiting.held.toLocaleString("en-US")}${waiting.level ? ` × +${waiting.level}` : ""} in your inventory to decompose</span>` : "";
    // Levelling costs gold by design: only an invalid row or one you can't afford fades.
    const faded = !entry.valid || (!leveling && day <= 0) || entry.suggestion?.count === 0 || entry.budget?.fill === 0 || entry.thinMargin;
    return `<details class="mwia-skill-row${(best || (leveling && first)) && !faded ? " mwia-best" : ""}${faded ? " mwia-faded" : ""}" data-hrid="${esc(entry.hrid)}" data-open="${esc(entry.hrid)}"${view.open.has(entry.hrid) ? " open" : ""}>
      <summary><span class="mwia-skill-name">${esc(entry.action.name)}${isEnhance(entry) ? ` <span class="mwia-enh">→ +${entry.target}${entry.finish ? " 🧪 decompose" : ""}</span>` : ""}${warn}<small>${sub}</small>${teaHint}${chainHint}${heldHint}</span>
        <span class="mwia-skill-nums"><b>${gold}</b>${full}<span class="mwia-dim">${coins(entry.xpPerDay * fill)} XP/day${entry.levelsPerDay !== null && entry.levelsPerDay !== undefined ? ` · ${dec(entry.levelsPerDay, 2)} lvl/day` : ""}</span></span></summary>
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
    if (isEnhance(e)) return buttons + warnings + enhanceSections(e, section).join("");
    if (isAlchemy(e)) sections.push(section("🎯 Odds", `${pct(e.successRate).replace("+", "")} success`, [alchemyOddsHtml(e)]));

    const speed = e.speed ? ` → ${dec(e.cycleSeconds, 2)} s with ${pct(e.speed)} speed${e.cycleSeconds <= 3 + 1e-9 ? " (3 s is the floor)" : ""}` : "";
    const buffEfficiency = e.efficiency - e.levelEfficiency;
    const ac = e.alchemyChain;
    const dc = e.decomposeCraft;
    const own = ac || dc ? e.ownActionsPerHour : e.actionsPerHour;
    sections.push(section("⏱ Speed", `${dec(e.actionsPerHour, 0)} actions/h`, [
        `${dec(e.baseSeconds, 1)} s${speed}. Efficiency ${pct(e.efficiency)} (levels ${pct(e.levelEfficiency)}: level ${dec(e.effectiveLevel, 0)} vs ${dec(e.requiredLevel, 0)} ${isAlchemy(e) ? "for the item" : "needed"}${buffEfficiency ? `, buffs ${pct(buffEfficiency)}` : ""}) → <b>${dec(own, 0)} actions/h</b>.${ac ? ` With the further steps (⛓) ${dec(ac.share * 100, 0)}% of each hour is this action: <b>${dec(e.actionsPerHour, 0)} of it an hour of the chain</b>.` : ""}${dc ? ` Decomposing what it makes (🧪) takes the rest: ${dec(dc.share * 100, 0)}% of each hour is crafting, <b>${dec(e.actionsPerHour, 0)} an hour of both</b>.` : ""}`,
    ]));

    const gold = [];
    const outputs = e.outputs.filter((o) => o.value > 0 || o.kind === "product").map((o) => {
        const capped = o.sell.capped === "usual" ? `usual ask; ${coins(o.sell.ask)} now` : o.sell.capped === "spread" ? `${dec(WIDE_SPREAD, 1)}× bid; ask ${coins(o.sell.ask)}` : o.sell.source;
        const how = o.sell.source === "ask" || o.sell.source === "bid" ? ` <span class="mwia-dim">(${capped} −${dec(MARKET_TAX * 100, 0)}%)</span>` : o.sell.source === "vendor" || o.sell.source === "contents" ? ` <span class="mwia-dim">(${o.sell.source})</span>` : "";
        if (o.decomposed) return `${count(o.count)} × ${esc(itemName(o.itemHrid))} <span class="mwia-dim">(🧪 decomposed, not sold)</span>`;
        if (o.chainValue !== undefined) return `${count(o.count)} × ${esc(itemName(o.itemHrid))} @ <b>${coins(o.chainValue)}</b> <span class="mwia-dim">(⛓ processed further; sells for ${coins(o.price)})</span>`;
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
    const hours = " × 24";
    gold.push(`(${coins(e.revenuePerAction)} − ${coins(e.costPerAction)}) × ${dec(e.actionsPerHour, 0)}${e.teas.length ? ` − ${coins(e.teaPerHour)}` : ""} = ${coins(e.profitPerHour)}/h${hours} = <b>${coins(e.goldPerDay)}/day</b>`);
    const capped = e.salesCap && e.outputs.find((o) => o.salesCap === e.salesCap);
    if (capped) gold.push(salesCapText(e.salesCap, esc(itemName(capped.itemHrid)), capped.price));
    sections.push(section("💰 Gold", `${coins(e.profitPerHour)}/h${e.margin !== null ? ` · margin ${dec(e.margin * 100, 1)}%` : ""}`, gold));
    if (e.chain) sections.push(section("⛓ Yourself", `${coins(e.chain.profitPerHour)}/h making the materials`, [chainHtml(e)]));
    if (ac) sections.push(section("⛓ Further", `+${coins(e.goldPerDay - ac.singleGoldPerDay)}/day over selling it all`, [alchemyChainHtml(e)]));
    if (dc) sections.push(section("🧪 Decompose", `+${coins(e.goldPerDay - dc.singleGoldPerDay)}/day over selling ${esc(itemName(e.action.outputItems[0].itemHrid))}`, [decomposeCraftHtml(e)]));

    sections.push(section("✨ XP", `${coins(e.xpPerHour)}/h`, [`${dec(e.xpPerAction, 1)} per action × ${dec(e.actionsPerHour, 0)} = ${coins(e.xpPerHour)}/h${hours} = <b>${coins(e.xpPerDay)}/day</b>`]));
    if (!upcoming && e.suggestion) sections.push(section("📦 How many", suggestionSummary(e.suggestion), [suggestionHtml(e)]));
    if (!upcoming) sections.push(section("🍵 Teas", teaSummary(e), [teaHtml(e)]));
    return buttons + warnings + sections.join("");
}

// Alchemy's odds: base × (1 + catalyst + tea + level penalty), and what a catalyst costs.
function alchemyOddsHtml(e) {
    const parts = [e.catalyst.itemHrid && `catalyst ${pct(e.catalyst.bonus)} (${esc(itemName(e.catalyst.itemHrid))})`, e.successBuff && `teas and buffs ${pct(e.successBuff)}`, e.penalty && `<span class="mwia-warn">item level ${e.requiredLevel} over your ${dec(e.effectiveLevel, 0)}: ${pct(e.penalty)}</span>`].filter(Boolean);
    const bulk = e.bulk > 1 ? ` Each action takes ${e.bulk} at once.` : "";
    const plus = e.action.enhancementLevel || 0;
    const essence = plus ? ` At +${plus} it also gives round(2 × (0.5 + 0.1 × 1.05^${getClientData().itemDetailMap[e.action.itemHrid]?.itemLevel || 0}) × 2^${plus}) = ${count(decomposeEssence(getClientData().itemDetailMap[e.action.itemHrid]?.itemLevel, plus))} Enhancing Essence on a success.${e.inputs[0]?.forSale === false ? " Nobody sells one at that +level: only yours, counted at what they would sell for." : ""}` : "";
    const coinsText = e.coinCost ? ` It costs ${coins(e.coinCost)} coins, lost on a failure like the item.` : "";
    const catalyst = e.catalyst.itemHrid ? ` The catalyst is used up only on a success (${coins(e.catalyst.price)} each).` : " No catalyst pays off with your Focus.";
    return `${dec(e.baseRate * 100, 0)}% base${parts.length ? ` × (1 ${parts.map((p) => "+ " + p).join(" ")})` : ""} = <b>${dec(e.successRate * 100, 2)}%</b>.${bulk}${essence}${coinsText}${catalyst} <span class="mwia-dim">A failure still gives a tenth of the XP.</span>`;
}

// Enhancing: the odds, every target, gold and XP.
function enhanceSections(e, section) {
    const sections = [];
    const item = esc(itemName(e.action.itemHrid));
    const parts = [e.levelBonus && `level ${dec(e.effectiveLevel, 0)} vs item ${e.requiredLevel}: ${pct(e.levelBonus)}`, e.successBonus && `tool, house and buffs ${pct(e.successBonus)}`].filter(Boolean);
    const rates = e.rates.slice(0, Math.max(e.target, 3)).map((r, L) => `+${L}→+${L + 1} ${dec(r * 100, 1)}%`).join(" · ");
    const pr = e.protect;
    sections.push(section("🎯 Odds", `${count(e.attempts)} attempts per +${e.target}${pr ? `, protected from +${pr.from}` : ""}`, [
        `Success = the game's rate for the +level × ${dec(e.multiplier, 3)}${parts.length ? ` (1 ${parts.map((p) => "+ " + p).join(" ")})` : ""}: ${rates}.${e.blessed ? ` Blessed: ${pct(e.blessed).replace("+", "")} of successes jump two levels.` : ""}`,
        pr
            ? `A failure below +${pr.from} drops the item to +0; from +${pr.from} on it drops one level and uses up one ${esc(itemName(pr.itemHrid))} (the cheapest protection, ${coins(pr.price)}). From +0 it takes <b>${count(e.attempts)} attempts</b> and ${count(pr.protections)} protections on average to reach +${e.target}. Protecting from another +level, or not at all, suits your Focus less.`
            : `A failure drops the item to +0. From +0 it takes <b>${count(e.attempts)} attempts</b> on average to reach +${e.target}.${e.target > MIN_PROTECT ? " Protection doesn't pay here with your Focus." : ""}`,
    ]));
    const levelSpeed = e.levelSpeed ? ` (levels ${pct(e.levelSpeed)})` : "";
    const fin = e.finish;
    const split = fin ? ` Decomposing each takes ${dec(fin.hours * 3600, 1)} s of Alchemy, so of each hour ${dec(e.enhanceShare * 100, 0)}% is enhancing and ${dec((1 - e.enhanceShare) * 100, 0)}% decomposing; the gold and XP are per hour of both.` : "";
    sections.push(section("⏱ Speed", `${dec(e.actionsPerHour, 0)} attempts/h`, [`12 s / (1 + ${pct(e.speed).replace("+", "")} speed${levelSpeed}) = ${dec(e.cycleSeconds, 2)} s → <b>${dec(e.actionsPerHour, 0)} attempts/h</b>, ${count(e.itemsPerHour)} items reach +${e.target} an hour.${split}`]));

    const sell = fin ? e.sold : e.outputs[0].sell;
    const sold = sell.source === "vendor" ? "the shop price" : sell.source === "lower" ? `the +${sell.level} bid (nobody bids for +${e.target})` : sell.source === "usualbid" ? "the usual bid (nobody bids now)" : sell.source === "usual" ? `the usual ask (${coins(sell.ask)} now)` : sell.source === "spread" ? `${dec(WIDE_SPREAD, 1)}× the bid (ask ${coins(sell.ask)})` : `the ${sell.source}`;
    const mats = e.inputs.filter((i) => !i.upgrade).map((i) => `${count(i.count)} × ${esc(itemName(i.itemHrid))}${i.protection ? " (protection)" : ""} @ ${coins(i.price)}`).join(" · ");
    const base = e.base.owned ? `one you have (worth ${coins(e.base.price)} at the bid)` : `bought at ${coins(e.base.price)}`;
    sections.push(section("💰 Gold", `${coins(e.profitPerHour)}/h`, [
        `<b>Each attempt uses</b> ${mats} = ${coins(e.costPerAttempt)}.`,
        `<b>Each attempt may drop</b> ${e.outputs.slice(1).map((o) => `${count(o.count)} × ${esc(itemName(o.itemHrid))} @ ${coins(o.price)}`).join(" · ")} = ${coins(e.dropsPerAttempt)}.`,
        fin
            ? `<b>Each +${e.target}</b> (one per ${count(e.attempts)} attempts): the item ${base}${fin.itemFloor > e.base.price ? ` – counted at ${coins(fin.itemFloor)}, what decomposing it as it is gives (that gain is the Alchemy list's)` : ""}, then <b>decomposed</b> instead of sold: ${decomposeText(fin)} = <b>${coins(fin.value)}</b> each, against ${coins(sell.price)} selling it at ${sold}.`
            : `<b>Each +${e.target}</b> (one per ${count(e.attempts)} attempts): the item ${base}, sold at ${sold} for ${coins(sell.price)} after tax.${sell.sold !== null && sell.sold !== undefined ? ` About ${soldText(sell.sold)} +${e.target} sell a day; you'd make ${count(e.itemsPerHour * 24)}.` : ""}`,
        e.salesCap ? `<span class="mwia-warn">The market takes about ${soldText(e.salesCap.perDay)} a day; the rest of the ${count(e.salesCap.made)} you'd make go for ${coins(e.salesCap.floor)} (the ${sell.floorLevel === null ? "shop" : `+${sell.floorLevel} bid`}): ${coins(e.outputs[0].price)} each on average.</span>` : "",
        budgetText(e.budget),
        e.teas.length ? `<b>Teas:</b> ${e.teaCosts.map((t) => `${esc(itemName(t.itemHrid))} @ ${coins(t.price)}`).join(" · ")}, ${dec(e.drinksPerHour, 1)} of each per hour = ${coins(e.teaPerHour)}/h.` : "",
        `${fin ? "(" : ""}(${coins(e.revenuePerAction)} − ${coins(e.costPerAction)}) × ${dec(e.actionsPerHour, 0)}${e.teas.length ? ` − ${coins(e.teaPerHour)}` : ""}${fin ? `) × ${dec(e.enhanceShare * 100, 1)}% enhancing` : ""} = ${coins(e.profitPerHour)}/h × 24 = <b>${coins(e.goldPerDay)}/day</b>.`,
    ].filter(Boolean)));
    const finXp = fin ? ` × ${dec(e.enhanceShare * 100, 1)}% enhancing` : "";
    const alchemyXp = fin ? ` Decomposing adds ${dec(fin.xp, 1)} Alchemy XP per item (${coins((fin.xp * e.itemsPerHour) * 24)}/day), not counted here.` : "";
    sections.push(section("✨ XP", `${coins(e.xpPerHour)}/h`, [`1.4 × (1 + the +level) × (10 + ${e.requiredLevel})${e.wisdom ? ` × ${dec(1 + e.wisdom, 3)} wisdom` : ""} on a success, a tenth on a failure: ${dec(e.xpPerAction, 1)} per attempt on average × ${dec(e.actionsPerHour, 0)}${finXp} = ${coins(e.xpPerHour)}/h = <b>${coins(e.xpPerDay)}/day</b>.${alchemyXp}`]));
    const rows = e.targets.filter((t) => t.target <= 12 || t.target === e.target || t.target % 5 === 0).map((t) => {
        const perXp = t.coinsPerXp === null ? "–" : t.coinsPerXp >= 0 ? `${dec(t.coinsPerXp, 1)} c/XP` : `earns ${dec(-t.coinsPerXp, 1)}/XP`;
        const text = `+${t.target}: ${count(t.attempts)} attempts${t.protect ? ` (protect from +${t.protect.from})` : ""}${t.finish ? " · 🧪 decompose" : ""} · ${coins(t.goldPerDay)}/day · ${coins(t.xpPerDay)} XP/day · ${perXp}`;
        return t.target === e.target ? `<b>${text}</b>` : text;
    });
    sections.push(section("🎚 Targets", `+${e.target} suits your Focus`, [`Stopping at a lower +level sells the item sooner (more of it comes back, each attempt gives less XP); a high target almost never gets there, so it is all materials. 🧪: decomposing the +level (Alchemy, with the teas in your Alchemy slots) suits your Focus better than selling it, counting the Alchemy time. With ${item}:`, rows.join("<br>")]));
    sections.push(section("🍵 Teas", teaSummary(e), [teaHtml(e)]));
    return sections;
}

// Crafting, then decomposing what it makes: the materials it gives back and uses again.
function decomposeCraftHtml(e) {
    const dc = e.decomposeCraft;
    const item = esc(itemName(e.action.outputItems[0].itemHrid));
    const back = dc.reused.map((x) => `${count(x.count)} ${esc(itemName(x.itemHrid))} <span class="mwia-dim">(@ ${coins(x.price)}, not bought)</span>`);
    const sold = dc.sold.filter((x) => x.value > 0.5 || x.kind === "recovered").map((x) => `${count(x.count)} ${esc(itemName(x.itemHrid))} @ ${coins(x.price)}`);
    const r = dc.decompose;
    return `Each ${item} is decomposed (Alchemy, ${dec(r.successRate * 100, 1)}% success with the teas in your Alchemy slots${r.catalyst?.itemHrid ? ` and ${esc(itemName(r.catalyst.itemHrid))}` : ""}, ${coins(r.coinCost)} coins) instead of sold for ${coins(dc.sellPrice)}: worth <b>${coins(dc.valuePerItem)}</b> each.
        Per craft it gives back ${back.join(" · ")}${sold.length ? `, and ${sold.join(" · ")} to sell` : ""}.
        <br>Of each hour ${dec(dc.share * 100, 0)}% is crafting and ${dec((1 - dc.share) * 100, 0)}% decomposing: <b>${coins(e.goldPerDay)}/day</b> against ${coins(dc.singleGoldPerDay)}/day selling them, and the XP is the craft's (${coins(e.xpPerDay)}/day; Alchemy gets ${coins(dc.alchemyXpPerHour * 24)} XP/day too).
        <span class="mwia-dim">Each decompose is one roll – a failure loses the item – so it evens out over many. ▶ makes the items; then decompose them and craft again with what comes back.</span>`;
}

// Alchemy: what the outputs are processed into further, and what is sold.
function alchemyChainHtml(e) {
    const ac = e.alchemyChain;
    const perHour = (f) => f.count * e.actionsPerHour;
    const steps = ac.further.map((f) => `${esc(f.name)}: ${count(perHour(f))} an hour <span class="mwia-dim">(${dec((f.hours * e.actionsPerHour) * 100, 0)}% of the time, ${dec(f.successRate * 100, 0)}% success${f.catalyst ? `, ${esc(itemName(f.catalyst))}` : ""})</span>`);
    const sold = ac.sold.map((x) => `${count(x.count * e.actionsPerHour)} ${esc(itemName(x.itemHrid))}`);
    return `What this action gives is worth more processed further than sold. Of each hour ${dec(ac.share * 100, 0)}% is ${esc(e.action.name)}; then:<br>${steps.join("<br>")}
        ${sold.length ? `<br>Sold, an hour: ${sold.join(" · ")}.` : ""}
        <br>Gold an hour of the whole chain: <b>${coins(e.profitPerHour)}/h = ${coins(e.goldPerDay)}/day</b>, against ${coins(ac.singleGoldPerDay)}/day selling all it gives.
        <span class="mwia-dim">Each further step is chosen when it gives more than selling, counting its hours at the chain's own gold an hour; all with this row's teas. ▶ starts this action only – queue the further steps as their outputs come in.</span>`;
}

// What decomposing an item gives: its outputs at their prices, less the coins and the catalyst.
function decomposeText(fin) {
    const r = fin.entry;
    const outs = r.outputs.filter((o) => o.value > 0).map((o) => `${count(o.count)} × ${esc(itemName(o.itemHrid))} @ ${coins(o.price)}`).join(" + ");
    const costs = r.inputs.filter((i) => i.itemHrid === COIN || i.catalyst).map((i) => (i.itemHrid === COIN ? `${coins(i.value)} coins` : `${count(i.count)} × ${esc(itemName(i.itemHrid))}`)).join(" − ");
    const teas = r.teaPerHour > 0 ? ` − ${coins(r.teaPerHour / r.actionsPerHour)} of Alchemy teas` : "";
    return `${dec(r.successRate * 100, 1)}% success, ${outs}${costs ? ` − ${costs}` : ""}${teas}`;
}

// Making the materials yourself, compared with buying them.
function chainHtml(e) {
    const c = e.chain;
    const shares = [`${dec(c.craftShare * 100, 0)}% ${esc(e.action.name)}`, ...[...c.shares].sort((a, b) => b.share - a.share).map((s) => `${dec(s.share * 100, 0)}% ${esc(itemName(s.itemHrid))} <span class="mwia-dim">(${skillLabel(s.action.type.split("/").pop())}, ${count(s.count)} each)</span>`)];
    const better = c.profitPerHour > e.profitPerHour;
    return `Make every material your levels allow, buy the rest: <b>${coins(c.profitPerHour)}/h = ${coins(c.goldPerDay)}/day</b>
        <span class="${better ? "mwia-ok" : "mwia-dim"}">(${better ? "+" : "−"}${coins(Math.abs(c.goldPerDay - e.goldPerDay))}/day vs buying)</span>.
        <br>Of each hour: ${shares.join(" · ")}.${c.bought.length ? `<br>Still bought: ${esc(names(c.bought))}.` : ""}
        <br><span class="mwia-dim">Each step uses that skill's teas; the gold is per hour of the whole chain.</span>${chainTrainText(e)}`;
}

function chainTrainText(e) {
    const t = e.chainSuggestion;
    if (!t) return "";
    const rating = `${RATING[t.liquidity.rating]}${t.ratedBy ? ` (${esc(itemName(t.ratedBy))})` : ""}`;
    const coinsText = e.chain.cashPerAction > 0 ? ` What it buys may take ${Math.round(t.coinShare * 100)}% of your coins (${coins(t.budget)}) for a ${rating}${t.limitedByCoins ? " – that caps it" : ""}.` : "";
    if (!t.count) return `<br>🚂 Nothing to train: ${t.heldOff ? "you already hold a day of sales" : "your coins don't stretch to one"}.${coinsText}`;
    return `<br>🚂 <b>Train ${t.count.toLocaleString("en-US")}</b>: the whole chain in about ${hoursText(t.hours)}${t.heldOff ? `, less the ${t.heldOff.toLocaleString("en-US")} you hold` : ""}${t.cash > 1 ? `, ${coins(t.cash)} of materials to buy` : ""}.${coinsText}`;
}

// Enhancing and Alchemy: ▶ opens the game's page with the item, 🛒 buys what
// the planned hours use, 🍵 the teas, 🏪 the item's market.
function levelingButtons(e) {
    const item = e.action.itemHrid;
    const hours = e.teaPlan?.hours || PLAN_MODES.away.hours;
    let open;
    let buy;
    if (isEnhance(e)) {
        const guard = e.protect ? ` data-protect="${esc(e.protect.itemHrid)}" data-protect-from="${e.protect.from}"` : "";
        open = `<button class="mwia-btn" data-action="skilling-level" data-kind="enhance" data-item="${esc(item)}" data-value="${e.target}"${guard} title="Opens Enhancing with ${esc(itemName(item))} (one from your inventory) and the target +${e.target}${e.protect ? `, protected from +${e.protect.from} with ${esc(itemName(e.protect.itemHrid))}` : ""}">▶ Enhance to +${e.target}</button>${loopButton(e)}${decomposeButton(decomposeHeld(e))}`;
        // Decomposing the +target (finish) takes part of the hours: fewer attempts in them.
        const attempts = Math.ceil(e.actionsPerHour * hours * (e.enhanceShare ?? 1));
        const items = e.inputs.filter((i) => !i.upgrade && !(i.protection && i.itemHrid === item)).map((i) => ({ hrid: i.itemHrid, quantity: Math.ceil(i.count * attempts) })).filter((i) => i.hrid !== COIN);
        // Copies of the item: one per +target, plus those used up as protection.
        const guards = e.protect?.itemHrid === item ? (attempts * e.protect.protections) / e.attempts : 0;
        const copies = Math.max(e.base.owned ? 0 : 1, Math.ceil(attempts / e.attempts + guards) - have(item));
        if (copies > 0) items.unshift({ hrid: item, quantity: copies });
        // Decomposing each +target: the catalyst it counts on (used up on a success).
        const catalyst = e.finish?.entry?.inputs.find((i) => i.catalyst);
        const catalysts = catalyst ? Math.ceil((attempts / e.attempts) * catalyst.count - 1e-9) - have(catalyst.itemHrid) : 0;
        if (catalysts > 0) items.push({ hrid: catalyst.itemHrid, quantity: catalysts });
        buy = items.length ? { items, title: `Adds what ${hoursText(hours)} of enhancing uses: ${items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", ")}` } : null;
    } else {
        const k = ALCHEMY_KINDS[e.action.kind];
        const n = e.suggestion?.count || 0;
        const plus = e.action.enhancementLevel || 0;
        const catalyst = e.catalyst?.itemHrid ? ` data-catalyst="${esc(e.catalyst.itemHrid)}"` : "";
        open = `<button class="mwia-btn" data-action="skilling-level" data-kind="alchemy" data-item="${esc(item)}"${plus ? ` data-level="${plus}"` : ""} data-label="${esc(k.name)}" data-value="${n}"${catalyst} title="Opens ${k.name} with ${esc(itemName(item))}${plus ? ` +${plus}` : ""} (from your inventory)${n ? ` and ${n} actions` : ""}${e.catalyst?.itemHrid ? `, with ${esc(itemName(e.catalyst.itemHrid))}` : ""}">▶ ${k.name}${n ? ` ${n.toLocaleString("en-US")}` : ""}</button>`;
        // An enhanced item only you have can't be bought.
        const items = n ? e.inputs.filter((i) => i.itemHrid !== COIN && i.forSale !== false).map((i) => ({ hrid: i.itemHrid, ...(i.enhancementLevel ? { enhancementLevel: i.enhancementLevel } : {}), quantity: Math.max(0, Math.ceil(i.count * n) - have(i.itemHrid, i.enhancementLevel || 0)) })).filter((i) => i.quantity > 0) : [];
        buy = items.length ? { items, title: `Adds what ${n.toLocaleString("en-US")} actions use, less what you have: ${items.map((i) => `${i.quantity} ${itemName(i.hrid)}${i.enhancementLevel ? ` +${i.enhancementLevel}` : ""}`).join(", ")}` } : null;
    }
    const cart = buy ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-cart" data-job="${esc(e.hrid)}" data-teas="${esc(JSON.stringify(buy.items))}" title="${esc(buy.title)}">🛒 Materials</button>` : "";
    const plan = e.teaPlan;
    const teas = plan?.items.length ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-cart" data-teas="${esc(JSON.stringify(plan.items.map(({ hrid, quantity }) => ({ hrid, quantity }))))}" title="Adds the best teas for ${hoursText(plan.hours)} to the MWITools cart">🍵 Buy teas</button>` : "";
    const plusLevel = isAlchemy(e) ? e.action.enhancementLevel || 0 : 0;
    const market = `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-market" data-item="${esc(item)}"${plusLevel ? ` data-level="${plusLevel}"` : ""} title="Opens ${esc(itemName(item))}${plusLevel ? ` +${plusLevel}` : ""} on the market">🏪 Market</button>`;
    return `<div class="mwia-skill-buttons">${open}${cart}${teas}${market}</div>`;
}

// What a job makes and decomposes instead of selling – an enhancing job's
// +target, or a craft's item – and how many of them you hold now: { item,
// level, held, actions (decomposes, each takes the bulk size), bulk, catalyst
// (the row's, or null) }, or null for a job that doesn't decompose.
function decomposeHeld(e) {
    const r = isEnhance(e) ? e.finish?.entry : e.decomposeCraft?.decompose;
    if (!r) return null;
    const item = isEnhance(e) ? e.action.itemHrid : e.action.outputItems?.[0]?.itemHrid;
    const detail = item && getClientData()?.itemDetailMap[item];
    if (!detail) return null;
    const level = isEnhance(e) ? e.target : 0;
    const bulk = bulkOf(detail);
    const held = have(item, level);
    return { item, level, held, bulk, actions: Math.floor(held / bulk), catalyst: r.catalyst?.itemHrid || null };
}

// 🧪 Decompose N: opens Alchemy's Decompose tab with what you hold of it (counted
// again on the click) and the catalyst the row counts on; the player starts it.
function decomposeButton(d) {
    if (!d?.actions) return "";
    const name = `${esc(itemName(d.item))}${d.level ? ` +${d.level}` : ""}`;
    const catalyst = d.catalyst ? ` data-catalyst="${esc(d.catalyst)}"` : "";
    return `<button class="mwia-btn" data-action="skilling-level" data-kind="alchemy" data-item="${esc(d.item)}"${d.level ? ` data-level="${d.level}"` : ""} data-label="Decompose" data-value="${d.actions}" data-all="${d.bulk}"${catalyst} title="Opens Decompose with the ${d.held.toLocaleString("en-US")} ${name} you have${d.catalyst ? `, with ${esc(itemName(d.catalyst))}` : ""}">🧪 Decompose ${d.actions.toLocaleString("en-US")}${d.level ? ` × +${d.level}` : ""}</button>`;
}

// 🔁 Loop N: an enhancing job that decomposes its +target, for each of the N
// items you hold at +0 – one job each (the game stops each at the target), then
// the +target decomposed (enhance-loop-ui.js). perItem: what one item takes, for
// buying the next round: the item, its materials and protections over the
// attempts one takes, and the decompose's catalyst.
function loopButton(e) {
    const r = e.finish?.entry;
    if (!r) return "";
    const item = e.action.itemHrid;
    const per = new Map([[item, 1]]);
    for (const i of e.inputs) if (!i.upgrade && i.itemHrid !== COIN) per.set(i.itemHrid, (per.get(i.itemHrid) || 0) + i.count * e.attempts);
    const catalyst = r.inputs.find((i) => i.catalyst);
    if (catalyst) per.set(catalyst.itemHrid, (per.get(catalyst.itemHrid) || 0) + catalyst.count);
    const loop = { itemHrid: item, target: e.target, protect: e.protect ? { itemHrid: e.protect.itemHrid, from: e.protect.from } : null, catalyst: r.catalyst?.itemHrid || null, perItem: [...per].map(([hrid, quantity]) => ({ hrid, quantity })) };
    const held = have(item);
    if (!held) return `<button class="mwia-btn" disabled title="No ${esc(itemName(item))} at +0 in your inventory – buy them first (🛒 Materials)">🔁 Loop</button>`;
    return `<button class="mwia-btn" data-action="enhance-loop" data-loop="${esc(JSON.stringify(loop))}" title="A loop for the ${held.toLocaleString("en-US")} ${esc(itemName(item))} you have at +0: one enhancing job each to +${e.target} (queue them one after another), then decompose them all. A small panel counts what the game confirms.">🔁 Loop ${held.toLocaleString("en-US")}</button>`;
}

// ▶ Make N, 🍵 Buy teas and 🏪 Market, always in view when a row is open.
function actionButtons(e) {
    if (isEnhance(e) || isAlchemy(e)) return levelingButtons(e);
    const crafted = e.action.function === "/action_functions/production";
    const productHrid = e.action.outputItems?.[0]?.itemHrid;
    const s = e.suggestion;
    const make = (crafted && s?.count ? `<button class="mwia-btn" data-action="skilling-make" data-hrid="${esc(e.hrid)}" data-count="${s.count}">▶ Make ${s.count.toLocaleString("en-US")}</button>` : "") + decomposeButton(decomposeHeld(e));
    const plan = e.teaPlan;
    const teas = plan?.items.length
        ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-cart" data-teas="${esc(JSON.stringify(plan.items.map(({ hrid, quantity }) => ({ hrid, quantity }))))}" title="Adds the best teas for ${hoursText(plan.hours)} to the MWITools cart: ${esc(plan.items.map((i) => `${i.quantity} ${itemName(i.hrid)}`).join(", "))}">🍵 Buy teas</button>`
        : "";
    const train = trainButton(e);
    const market = crafted ? `<button class="mwia-btn mwia-btn-quiet" data-action="skilling-market" data-item="${esc(productHrid)}" title="Opens ${esc(itemName(productHrid))} on the market. Not needed for the advice; the orders you see there are shown under How many.">🏪 Market</button>` : "";
    return make || train || teas || market ? `<div class="mwia-skill-buttons">${make}${train}${teas}${market}</div>` : "";
}

// 🚂 Train N: an advisor train that makes the materials too (production steps
// made, raw materials gathered where your levels allow), for the planned hours.
function trainButton(e) {
    const t = e.chainSuggestion;
    if (!t?.count) return "";
    const product = e.action.outputItems[0].itemHrid;
    const made = [product, ...e.chain.shares.filter((s) => s.action.function === "/action_functions/production").map((s) => s.itemHrid)];
    // The train counts what you have in the inventory towards the target.
    const plan = { product, target: Math.ceil(t.count * e.mainCount - 1e-9) + have(product), made, title: `${itemName(product)} ×${t.count.toLocaleString("en-US")}` };
    return `<button class="mwia-btn" data-action="skilling-train" data-plan="${esc(JSON.stringify(plan))}" title="Starts a train: the materials made and gathered first, then ${t.count.toLocaleString("en-US")} ${esc(itemName(product))} – about ${hoursText(t.hours)} in all">🚂 Train ${t.count.toLocaleString("en-US")}</button>`;
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

// Enhancing within your coins: can't afford the item, or the coins last only part of the plan.
function budgetShort(b) {
    if (!b || b.fill >= 1) return "";
    if (b.fill === 0) return ` · <span class="mwia-warn">the item (${coins(b.item)}) is over ${Math.round(b.share * 100)}% of your coins</span>`;
    return ` · your coins last ${hoursText(b.hours)} of ${hoursText(b.plannedHours)}`;
}

function budgetText(b) {
    if (!b) return "";
    const rating = `${RATING[b.rating.rating]}${b.rating.known ? "" : " (too little history)"}`;
    const what = `${b.item ? `the item (${coins(b.item)}) and ` : ""}${hoursText(b.plannedHours)} of materials and teas (${coins(b.perHour)}/h) need ${coins(b.need)}; the item's market is a ${rating}, so up to ${Math.round(b.share * 100)}% of your coins (${coins(b.budget)}) may go into it`;
    if (b.fill === 0) return `<span class="mwia-warn">${what} – not enough for the item itself.</span>`;
    if (b.fill < 1) return `<span class="mwia-warn">${what} – enough for ${hoursText(b.hours)}.</span>`;
    return `<span class="mwia-dim">${what}.</span>`;
}

function suggestionShort(suggestion) {
    if (!suggestion?.known) return "";
    return " · " + suggestionSummary(suggestion);
}

function suggestionSummary(s) {
    const rating = RATING[s.liquidity.rating] + (s.ratedBy ? " (materials)" : "");
    if (!s.count) return `${rating} · ${s.heldOff ? (s.productLiquidity.sold?.enough ? "you hold a day of sales" : "you hold enough") : s.cappedBySales && !s.plannedUnits ? "none sold lately" : "your coins don't stretch to one"}`;
    const time = s.fill < SHORT_FILL ? `<span class="mwia-warn">${hoursText(s.hours)} of ${hoursText(s.plannedHours)}${SHORT_WHY[s.short] ? ` – ${SHORT_WHY[s.short](s)}` : ""}</span>` : hoursText(s.hours);
    return `${rating} · ${s.verb || "make"} ${s.count.toLocaleString("en-US")} (${time}) · ${coins(s.batch.materials)} in, ${s.batch.profit >= 0 ? "+" : "−"}${coins(Math.abs(s.batch.profit))}`;
}

// A job under this share of the planned hours is marked on its row, with what cut it.
export const SHORT_FILL = 0.95;
const SHORT_WHY = {
    owned: () => "the ones you have",
    onelisted: (s) => `one ${esc(itemName(s.limitedByListing))} +${s.inputs.find((i) => i.itemHrid === s.limitedByListing)?.enhancementLevel} known listed`,
    held: (s) => `${s.held.toLocaleString("en-US")} in stock`,
    sales: () => "a day of sales",
    swing: () => "price swings",
    book: (s) => `few ${esc(itemName(s.limitedByBook))} listed`,
    coins: () => "coins",
};

// Made all day, more than the market takes: the rest goes for the floor.
function salesCapText(cap, name, mean) {
    return `<span class="mwia-warn">The market takes about ${soldText(cap.perDay)} ${name} a day; made all day you'd have ${count(cap.made)}, the rest going for ${coins(cap.floor)}: ${coins(mean)} each on average.</span>`;
}

// What the market's rating rests on.
function liquidityText(l) {
    const share = (x) => `${Math.round(x * 100)}%`;
    if (l.coin) return "It gives coins: no buyer needed. The materials' markets set how much of your coins it may take.";
    if (l.reused) return "What it makes is decomposed and its materials used again: no buyer needed. The materials' markets set how much of your coins it may take.";
    if (!l.known) return `${RATING.thin}: under ${MIN_HOURS} hours of prices for it yet${l.hours ? ` (${l.hours})` : ""}, so it is treated as thin.`;
    const parts = [
        `a buyer and a seller in ${share(l.both)} of the hours`,
        `spread ${dec(l.spread * 100, 1)}%`,
        `price swings ±${dec(l.swing * 100, 1)}%`,
    ];
    const sales = l.sold?.enough;
    parts.push(sales ? `something sold in ${share(l.sold.selling)} of the hours` : `the lowest ask moved in ${share(l.activity)} of the hours`);
    const s = LIQUIDITY.stable;
    const spikes = l.sold?.enough && l.sold.rawPerDay > l.sold.perDay * 1.1 ? `; ${soldText(l.sold.rawPerDay)} counting a few big hours in full` : "";
    const sold = l.sold?.enough ? ` About <b>${soldText(l.sold.perDay)} sold a day</b> (${l.sold.hours} hours of sales${spikes}).` : "";
    const note = sales ? "" : " Until 12 hours of sales are collected, how often the lowest ask moves stands in for them.";
    return `${RATING[l.rating]} over the last ${l.hours} hours of prices: ${parts.join(", ")}.${sold} <span class="mwia-dim">Stable needs ≥ ${share(s.both)}, ≤ ${share(s.spread)}, ≤ ±${share(s.swing)} and ≥ ${share(sales ? s.selling : s.activity)}; ok ≥ ${share(LIQUIDITY.ok.both)}, ≤ ${share(LIQUIDITY.ok.spread)}, ≤ ±${share(LIQUIDITY.ok.swing)}${sales ? ` and ≥ ${share(LIQUIDITY.ok.selling)}` : ""}.${note}</span>`;
}

const ago = (at) => hoursText((Date.now() - at) / 3600000);
const soldText = (n) => (n >= 10 ? Math.round(n).toLocaleString("en-US") : dec(n, 1));
// How many you have in the inventory, at +level (an enhanced item counts only at its own +level).
const have = (hrid, level = 0) => (level > 0 ? heldAt(hrid, level) : heldStock(state.character, state.items, hrid).inventory);
const heldAt = (hrid, level) => [...state.items.values()].filter((i) => i.itemHrid === hrid && i.itemLocationHrid === INVENTORY && (i.enhancementLevel || 0) === level).reduce((sum, i) => sum + (i.count || 0), 0);
// The +levels (1 and up) you have an item at.
function heldLevels(hrid) {
    const levels = [];
    for (const i of state.items.values()) if (i.itemHrid === hrid && i.itemLocationHrid === INVENTORY && i.enhancementLevel > 0 && i.count > 0) levels.push(i.enhancementLevel);
    return levels;
}

// The materials to buy, each with its market's rating – the thinnest market of
// the product and these sets the coins – and what was listed when last seen.
function materialsText(s) {
    const shown = s.inputs.filter((i) => i.toBuy > 0);
    if (!shown.length) return "";
    const parts = shown.map((i) => {
        const rating = i.liquidity || { rating: "thin", known: false };
        let text = `${i.toBuy.toLocaleString("en-US")} ${esc(itemName(i.itemHrid))} ${RATING[rating.rating]}${rating.known ? "" : " (too little history)"}`;
        if (i.bookAt) text += ` – ${i.nearAsks.toLocaleString("en-US")} listed at ≤ ${coins(i.maxPrice)} ${ago(i.bookAt)} ago${i.averagePrice > i.lowestAsk * 1.0005 ? `, ${coins(i.averagePrice)} each on average (lowest ${coins(i.lowestAsk)})` : ""}`;
        else if (rating.rating !== "stable") text += ` – <i>open it on the market to see how many are for sale</i>`;
        return i.itemHrid === s.ratedBy || i.itemHrid === s.limitedByBook ? `<span class="mwia-warn">${text}</span>` : text;
    });
    const by = s.ratedBy ? ` <span class="mwia-dim">The coins follow the thinnest market: ${esc(itemName(s.ratedBy))}.</span>` : "";
    return `To buy: ${parts.join(" · ")}.${by}`;
}

function suggestionHtml(e) {
    const s = e.suggestion;
    const product = esc(itemName(e.action.outputItems[0].itemHrid));
    const lines = [liquidityText(s.productLiquidity)];
    let plan = isAlchemy(e)
        ? `A ${hoursText(s.plannedHours)} job is ${Math.round(s.plannedUnits / e.mainCount).toLocaleString("en-US")} actions${e.bulk > 1 ? ` of ${e.bulk} ${esc(itemName(e.action.itemHrid))} each` : ""}`
        : s.cappedBySales
        ? `A ${hoursText(s.plannedHours)} job would make more than sells in a day: about a day of sales is ${s.plannedUnits.toLocaleString("en-US")} ${product}`
        : `A ${hoursText(s.plannedHours)} job is ${s.plannedUnits.toLocaleString("en-US")} ${product}`;
    const where = `(${s.stock.inventory.toLocaleString("en-US")} in inventory, ${s.stock.listed.toLocaleString("en-US")} listed)`;
    const sold = s.productLiquidity.sold?.enough ? soldText(s.productLiquidity.sold.perDay) : null;
    if (s.heldOff) plan += ` − ${s.heldOff === s.held ? "the" : `${s.heldOff.toLocaleString("en-US")} of the`} ${s.held.toLocaleString("en-US")} you already have ${where}${sold && !s.cappedBySales ? `: with them, more than the ~${sold} that sell in a day` : ""}`;
    lines.push(plan + ".");
    if (s.held && !s.heldOff) lines.push(`<span class="mwia-dim">The ${s.held.toLocaleString("en-US")} you already have ${where} don't shorten it: the market takes about ${sold} a day.</span>`);
    const sw = s.swing;
    if (sw && sw.share < 1) {
        const why = [];
        if (sw.bySwing < 1) why.push(`its price usually swings ±${Math.round(sw.swing * 100)}%`);
        if (sw.high) why.push(`it is ${Math.round(sw.diff * 100)}% above its usual price now – sell it while it lasts`);
        lines.push(`Made ${Math.round(sw.share * 100)}% of that: ${why.join(", and ")}.`);
    }
    if (sw?.low) lines.push(`<span class="mwia-warn">It sells ${Math.round(-sw.diff * 100)}% below its usual price now – waiting, or making something else, may pay.</span>`);
    const budget = `${Math.round(s.coinShare * 100)}% of your coins (${coins(s.budget)}) for a ${s.liquidity.rating} market`;
    if (s.limitedByCoins) lines.push(`<span class="mwia-warn">Materials capped at ${budget}.</span>`);
    else lines.push(`<span class="mwia-dim">Materials may take up to ${budget}.</span>`);
    const materials = materialsText(s);
    if (materials) lines.push(materials);
    if (s.inputs.some((i) => i.bookAt)) lines.push(`<span class="mwia-dim">A material seen on the market is bought up from its lowest ask while the last action still makes ${s.minMargin > 0 ? `a ${dec(s.minMargin * 100, 1)}% margin (your plan's)` : "a profit"}; the batch counts what each costs there${s.batch.aboveAsk > 0.5 ? ` (+${coins(s.batch.aboveAsk)} over the lowest ask)` : ""}.</span>`);
    if (s.limitedByListing) {
        const input = s.inputs.find((i) => i.itemHrid === s.limitedByListing);
        lines.push(`<span class="mwia-warn">Only the lowest ask of ${esc(itemName(input.itemHrid))} +${input.enhancementLevel} is known, so one listed is counted – open it on the market (🏪) to see how many are for sale.</span>`);
    }
    if (s.limitedByBook) {
        const input = s.inputs.find((i) => i.itemHrid === s.limitedByBook);
        lines.push(`<span class="mwia-warn">Capped at the ${esc(itemName(input.itemHrid))} you can get: ${input.nearAsks.toLocaleString("en-US")} listed at ≤ ${coins(input.maxPrice)} ${ago(input.bookAt)} ago${have(input.itemHrid) ? `, plus ${have(input.itemHrid).toLocaleString("en-US")} you have` : ""}.</span>`);
    }
    if (s.bookAt) {
        const age = ago(s.bookAt);
        const seen = [s.profitableBids !== null && `${s.profitableBids.toLocaleString("en-US")} in buy orders at ≥ ${coins(s.breakEven)} (break-even)`, s.nearAsks !== null && `${s.nearAsks.toLocaleString("en-US")} listed by others within ${dec(ASK_WINDOW * 100, 0)}% of the lowest ask`].filter(Boolean);
        if (seen.length) lines.push(`<span class="mwia-dim">On the market ${age} ago: ${seen.join(" · ")}.</span>`);
    }
    if (!s.count) return lines.join("<br>") + (s.heldOff ? " You already hold enough – nothing to make." : " Not enough coins for one.");
    lines.push(`→ <b>${s.verb || "make"} ${s.count.toLocaleString("en-US")}</b> (${hoursText(s.hours)}).`);
    const b = s.batch;
    const owned = b.materials - b.toBuy;
    const heldText = b.heldSaving > 0.5 ? `; ${coins(owned)} worth is already in your inventory, counted at what it would sell for at the bid after tax – ${coins(b.heldSaving)} less than buying it` : `; ${coins(owned)} worth is already in your inventory`;
    lines.push(`<b>This batch:</b> materials ${coins(b.materials)}${owned > 1 ? ` (you buy ${coins(b.toBuy)}${heldText})` : ""}${b.teas > 1 ? `, teas ${coins(b.teas)}` : ""}.
        It sells for ${coins(b.revenue)} after tax → <b class="${b.profit >= 0 ? "mwia-ok" : "mwia-bad"}">${b.profit >= 0 ? "+" : "−"}${coins(Math.abs(b.profit))}</b>.
        <span class="mwia-dim">The coins come back as the items sell, so a slow seller ties them up for a while.</span>`);
    return lines.join("<br>");
}

// ---------- upgrades that pay back ----------

const INVENTORY = "/item_locations/inventory";

// The action upgrades are measured on: the top of the skill's Skilling list –
// what you'd make – when it earns gold, else null (the skill's best).
export function topActionHrid(settings, skill) {
    if (!SKILLING_SKILLS.includes(skill) || !state.character) return null;
    return ranking({ ...settings, skillingSkill: skill }).available.find((e) => e.valid && e.goldPerDay > 0)?.hrid || null;
}

// What the top action depends on, for caches.
export const topActionKey = (settings) => [settings.skillingSellAt, settings.skillingTeas, planMode(settings), goldShare(settings), !!settings.countLevels, historyVersion()].join("|");

// Enhancing and Alchemy: the top row of the list, earning gold or not.
const topLevelingEntry = (settings, skill) => ranking({ ...settings, skillingSkill: skill }).available.find((e) => e.valid) || null;

function upgradeRanking(settings) {
    const skill = settings.skillingSkill;
    const key = [state.updatedAt, pricesStamp(), skill, topActionKey(settings)].join("|");
    if (view.upgradesKey !== key) {
        const data = getClientData();
        const isLeveling = LEVELING_SKILLS.includes(skill);
        const top = isLeveling ? topLevelingEntry(settings, skill) : null;
        const equipped = {};
        const owned = {};
        for (const item of state.items.values()) {
            if (!item.itemHrid) continue;
            if (item.itemLocationHrid === INVENTORY) (owned[item.itemHrid] ||= []).push(item.enhancementLevel || 0);
            else equipped[item.itemLocationHrid] = { itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 };
        }
        const houseLevels = {};
        for (const [hrid, room] of Object.entries(state.character.characterHouseRoomMap || {})) houseLevels[hrid] = room.level || 0;
        view.upgrades = rankUpgrades(skillingCharacter(state.character, state.items, data), data, skillingMarket(settings.skillingSellAt), skill, {
            equipped,
            owned,
            listings: (hrid) => marketListings(hrid),
            bids: (hrid) => marketBids(hrid),
            houseLevels,
            gameEquipmentBuffs: state.character.equipmentActionTypeBuffsMap || null,
            actionHrid: isLeveling ? top?.hrid || null : topActionHrid(settings, skill),
            leveling: isLeveling ? { ...levelingOptions(settings, data), xpPrice: Math.max(0, top?.coinsPerXp ?? 0) } : {},
        });
        view.upgradesKey = key;
    }
    return view.upgrades;
}

function upgradesHtml(settings) {
    if (settings.skillingSkill === "all") {
        return `<section><h3>Upgrades that pay back</h3><p class="mwia-dim">Pick a skill above to see which tools, clothes, jewellery and house rooms pay for themselves.</p></section>`;
    }
    const { base, upgrades, check, xpPrice } = upgradeRanking(settings);
    const isLeveling = LEVELING_SKILLS.includes(settings.skillingSkill);
    let html = `<section><h3>Upgrades that pay back</h3>`;
    if (!base) return html + `<p class="mwia-dim">${isLeveling ? "Nothing in the list above to measure on." : "Nothing in this skill earns gold at your level yet."}</p></section>`;
    if (isLeveling) {
        const repicked = settings.skillingSkill === "enhancing" ? "the target is picked again with the upgrade" : "the catalyst is picked again with the upgrade";
        const xp = xpPrice > 0 ? `XP counts at the ${dec(xpPrice, 1)} coins per XP it costs there – what that XP would cost you otherwise – so an upgrade that only adds XP pays back too` : "It earns gold, so only the gold counts";
        html += `<p class="mwia-dim">Each tried in place of what you wear now, measured on the top of the list above (now ${esc(adviceName(base))}, ${coins(base.goldPerDay)}/day, ${coins(base.xpPerDay)} XP/day); ${repicked}. ${xp}. Payback = what it costs, less what it sells for again at the bid, ÷ what it adds a day.</p>`;
    } else html += `<p class="mwia-dim">Each tried in place of what you wear now, measured on what you'd make: the top of the list above (now ${esc(base.action.name)}, ${coins(base.goldPerDay)}/day). Payback = what it costs, less what it sells for again at the bid, ÷ extra gold a day. A +level's step shows what it adds over the next lower one for sale.</p>`;
    if (check && !check.matches) {
        html += `<div class="mwia-notice mwia-notice-warn">Your gear's action speed here is ${pct(check.game)} by the game but ${pct(check.mine)} by the item stats, so these numbers may be a little off.</div>`;
    }
    if (!upgrades.length) return html + `<p class="mwia-dim">Nothing for sale would earn more here.</p></section>`;
    html += `<div class="mwia-upgrade-list">${upgrades.slice(0, UPGRADES_SHOWN).map((u) => upgradeRowHtml(u, xpPrice, base)).join("")}</div></section>`;
    return html;
}

// xpPrice: what an XP is worth (Enhancing and Alchemy); base: the day it is measured against.
function upgradeRowHtml(u, xpPrice = 0, base = null) {
    const payback = u.paybackDays === null ? "price unknown" : u.paybackDays === 0 ? (u.owned ? "free – you own it" : "sells again for what it costs") : `pays back in ${hoursText(u.paybackDays * 24)}`;
    const gain = xpPrice > 0 ? levelingGainText(u, base) : `+${coins(u.gainPerDay)}/day${u.xpPerDay > 1 ? `, +${coins(u.xpPerDay)} XP/day` : ""}`;
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
    const resale = !u.owned && u.resale > 1 ? ` <span class="mwia-dim">(${resaleText(u)})</span>` : "";
    const st = u.step;
    const step = st ? `<small class="mwia-dim">+${st.from} → +${u.enhancementLevel}: ${st.price >= 0 ? "+" : "−"}${coins(Math.abs(st.price))} for +${coins(st.gainPerDay)}/day${st.paybackDays === null ? " – adds nothing" : st.paybackDays === 0 ? " – no extra cost after resale" : ` – the step pays back in ${hoursText(st.paybackDays * 24)}`}</small>` : "";
    return `<div class="mwia-upgrade"><div><b>${name}</b> <span class="mwia-dim">${u.owned ? "you own it" : coins(u.price)}</span>${resale}
        <small>${gain} · ${payback} · ${replaces}${slotsText(u)}</small>${step}</div>${cart}</div>`;
}

// Enhancing and Alchemy: the worth a day, made of gold and XP, and a target that changes.
function levelingGainText(u, base) {
    const gold = Math.abs(u.goldPerDay) >= 1 ? `${u.goldPerDay >= 0 ? "+" : "−"}${coins(Math.abs(u.goldPerDay))} gold` : null;
    const xp = Math.abs(u.xpPerDay) >= 1 ? `${u.xpPerDay >= 0 ? "+" : "−"}${coins(Math.abs(u.xpPerDay))} XP` : null;
    const target = u.target && base?.target && u.target !== base.target ? `, then to +${u.target}` : "";
    return `worth +${coins(u.gainPerDay)}/day (${[gold, xp].filter(Boolean).join(", ") || "a little"}${target})`;
}

// What it sells for again, and from whose bid when nobody buys its own +level.
function resaleText(u) {
    if (u.resaleLevel === u.enhancementLevel) return `${coins(u.resale)} back when sold`;
    const none = `nobody buys${u.enhancementLevel ? ` +${u.enhancementLevel}` : " it"}`;
    if (u.resaleLevel === null) return `${coins(u.resale)} back at the shop: ${none}`;
    return `≥ ${coins(u.resale)} back: ${none}, so +${u.resaleLevel}'s bid – list it to sell`;
}

// A pouch with more drink slots, and the teas that fill them.
function slotsText(u) {
    if (!u.extraSlots) return "";
    const slots = `${u.extraSlots > 0 ? "+" : ""}${u.extraSlots} tea slot${Math.abs(u.extraSlots) === 1 ? "" : "s"}`;
    return ` · ${slots}${u.teas?.length ? ` (with ${esc(names(u.teas))} on ${esc(u.bestAction.name)})` : ""}`;
}

// The Skilling tab's top rows as plain text, with what each was worked out from – for the export.
export function skillingExportLines(settings, count = 10) {
    const { available } = ranking(settings);
    const mode = PLAN_MODES[planMode(settings)];
    const n = (x) => Math.round(x).toLocaleString("en-US");
    const lines = [`Skill ${settings.skillingSkill} · sell at ${settings.skillingSellAt} · teas ${settings.skillingTeas} · plan ${planMode(settings)} (${hoursText(mode.hours)}) · focus ${goldShare(settings)}% gold${settings.countLevels ? " · counting levels" : ""}`];
    available.filter((e) => e.valid).slice(0, count).forEach((e, i) => {
        const fill = e.fill ?? 1;
        const head = `${i + 1}. ${adviceName(e)} – ${skillLabel(skillOf(e))} ${e.action.levelRequirement.level} · ranked on ${coins(e.goldPerDay * fill)}/day${fill < 1 ? ` (${coins(e.goldPerDay)}/day running all ${hoursText(mode.hours)}, the job fills ${Math.round(fill * 100)}%)` : ""} · ${coins(e.xpPerDay * fill)} XP/day · score ${dec(e.score, 3)}`;
        const parts = [`${dec(e.actionsPerHour, 0)} actions/h`, `profit ${coins(e.profitPerHour)}/h`, `margin ${dec((e.margin || 0) * 100, 1)}%`];
        if (e.teas?.length) parts.push(`teas ${e.teas.map(itemName).join(", ")}`);
        if (e.inputs?.length) parts.push(`buys ${e.inputs.map((input) => `${dec(input.count, 2)} ${itemName(input.itemHrid)} @ ${coins(input.price || 0)}`).join(" + ")} per action`);
        const out = e.outputs?.find((o) => o.kind === "product");
        if (out) parts.push(`sells ${dec(out.count, 2)} ${itemName(out.itemHrid)} @ ${coins(out.price ?? out.value ?? 0)} after tax`);
        const lines2 = [head, `   ${parts.join(" · ")}`];
        const s = e.suggestion;
        if (s?.known) {
            const sold = s.productLiquidity.sold?.enough ? `~${n(s.productLiquidity.sold.perDay)} sold/day` : "sales unknown";
            const job = [
                `make ${n(s.count)} (${hoursText(s.hours)} of ${hoursText(s.plannedHours)}${s.short ? `, cut by ${s.short}` : ""})`,
                `market ${s.liquidity.rating}${s.ratedBy ? ` (set by ${itemName(s.ratedBy)})` : ""}, product ${s.productLiquidity.rating}, ${sold}`,
                `you hold ${n(s.held)} (${n(s.stock.inventory)} inventory, ${n(s.stock.listed)} listed)${s.heldOff ? `, ${n(s.heldOff)} taken off the job` : ""}`,
                `coins for materials ${coins(s.budget)} (${Math.round(s.coinShare * 100)}%)${s.limitedByCoins ? " – the cap" : ""}`,
                `batch materials ${coins(s.batch.materials)} (buy ${coins(s.batch.toBuy)}), sells ${coins(s.batch.revenue)}, profit ${coins(s.batch.profit)}`,
            ];
            if (s.swing && s.swing.share < 1) job.push(`made ${Math.round(s.swing.share * 100)}% for the price swing (±${dec(s.swing.swing * 100, 1)}%)`);
            if (s.limitedByBook) job.push(`${itemName(s.limitedByBook)} listed while the margin holds caps it`);
            lines2.push(`   ${job.join(" · ")}`);
        } else if (e.budget) {
            lines2.push(`   coins last ${hoursText(e.budget.hours)} of ${hoursText(e.budget.plannedHours)} · budget ${coins(e.budget.budget)} (${Math.round(e.budget.share * 100)}%)`);
        }
        const warnings = e.warnings.map(warningText).filter(Boolean);
        if (warnings.length) lines2.push(`   ⚠ ${warnings.join(" ")}`);
        lines.push(...lines2);
    });
    return lines;
}
