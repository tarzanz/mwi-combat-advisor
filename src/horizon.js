// 📈 The N-day plan: from where the character is now, which order of 8-hour
// skilling jobs leaves it worth the most in N days (30 by default). It is
// worked out on the Pi (pi/planner.mjs) a few times a day, from what the
// userscript sends about the character and the Pi's own price history; the
// userscript only shows the result. Pure: no browser, no files.
//
// The model, in short:
// - Time goes in blocks of 8 hours (one job while you are away). In each block
//   the character runs the job that earns the most (or, while training a skill
//   towards a level, that skill's job with the most gold or the fastest XP);
//   when coins or the market cut a job short, the rest of the block goes to the
//   next best one queued behind it – two jobs at most, none under an hour.
// - Prices are the usual ones, not today's: the week's median ask (to buy, and
//   to list at, never above 1.5× the usual bid) and median bid (the floor). A
//   cautious run buys at the week's upper quartile and lists at its lower one.
// - The market takes only so much: of a product, a share (marketShare) of what
//   sells a day; the rest waits in stock and sells in later blocks first (a job
//   is chosen by what sells in its block, so stock doesn't pile up). The
//   same share caps what can be bought of a material a block. Coins pay for
//   materials and teas at the start of a block; sales come in at its end.
// - Levels come from the XP as the game's table gives it, and with them new
//   jobs and tools. A better tool for the skill being worked is bought when its
//   extra gold over the days left (plus levelDays) pays for it, less what it
//   sells for again (the old one is sold at the bid). Any tier the levels allow,
//   at +0 or at any +level the market has had asks for this week – the one that
//   pays the most.
// - Clothes, jewellery, charms and capes: each skill is worked in a loadout of
//   its own (swapped for nothing) – of each slot, what the character owns that
//   earns the most on the skill's best job. One piece for the skill being worked
//   is bought when it pays the same way, also at a +level (a lower level of the
//   same piece is then sold); what it replaces is kept for other skills. The
//   pouch and task badges stay as they are.
// - The skill's house room goes up a level when its extra gold pays for the
//   coins and materials (bought at the ask, no more than the market sells in a
//   week) – it can't be sold again, so it pays only within the days left plus
//   levelDays.
// - Worth at the end = coins + tools and clothes at the bid for their +level + stock (at the bid for up to
//   a day of sales, the shop price for the rest). Levels and house rooms can't be sold, so the
//   score adds levelDays × the gold a day the character can earn at the end –
//   otherwise a plan would never train near its end.
// - The community buffs (gathering quantity, production efficiency, XP) last
//   only as long as players keep buying them: the best plans are also run
//   without them, to show how much a plan leans on them.
// - Plans compared: earning the most every block; "only skill S"; and up to two
//   training phases (skill S to a level where a job or tool unlocks, earning in
//   S or at its fastest XP) before earning – the best single phases are
//   extended with a second one (a beam search).
//
// Combat can join later as another kind of activity: everything below works
// on activities with an XP rate per skill, items made and used per hour and
// coins per hour (see rates()), not on skilling actions as such.

import { MARKET_TAX, SKILLING_SKILLS, WIDE_SPREAD, bestTeas, daily, evaluateAction, marketPricer, skillingActions } from "./skilling.js";
import { itemSkillBuffs } from "./skilling-upgrades.js";
import { experienceOf, fractionalLevel } from "./levels.js";

export const HORIZON_DEFAULTS = { days: 30, blockHours: 8, marketShare: 0.5, levelDays: 7 };
// Training targets per skill: the next levels where a job or a tool unlocks, within this many levels.
const UNLOCK_TARGETS = 4;
const UNLOCK_REACH = 30;
// Single-phase plans extended with a second phase.
const BEAM = 6;
// Plans also run with cautious prices, and plans shown.
const CAUTIOUS_TOP = 6;
export const PLANS_SHOWN = 8;
// The earning jobs tried in a block: the best by gold an hour within the market's limits.
const CANDIDATES = 40;
const NO_MATERIALS = 8;
// A block is one job, and at most one more queued behind it when the first
// can't fill the hours (coins, materials); no job shorter than an hour.
const JOBS_PER_BLOCK = 2;
const MIN_JOB_HOURS = 1;
// The best teas are worked out once per this many levels.
const TEA_BUCKET = 10;
// A cheap tool (this share of the coins at most, after its resale) is bought while training for XP.
const CHEAP_TOOL = 0.05;
// Clothes, jewellery, charms and capes are worn per skill (a loadout each); the
// pouch (it sets the drink slots) and task badges stay as they are.
const FIXED_GEAR = new Set(["/equipment_types/pouch", "/equipment_types/trinket"]);
const WISDOM = "/buff_types/wisdom";
// House rooms: the highest level, and how many days of the market's sales of a material an upgrade may buy.
const MAX_HOUSE_LEVEL = 8;
const HOUSE_BUY_DAYS = 7;
// Enhanced +levels tried, at most.
const MAX_PLUS = 20;
// The rates kept, at most (about 1.5 kB each): past this the caches start over, so the planner stays within its heap.
const RATE_CACHE_MAX = 100000;
// A tool or piece of clothing is weighed only when it adds at least this share to the job's gold (no +1 steps day after day).
const MIN_GAIN = 0.01;
// What a purchase adds is worked out at levels this far apart (the lower one), so it is done once per few levels.
const OFFER_LEVELS = 5;

const ACTION_TYPE = "/action_types/";
const toolTypeOf = (actionType) => "/equipment_types/" + actionType.slice(ACTION_TYPE.length) + "_tool";
const skillNameOf = (skillHrid) => skillHrid.split("/").pop();
const titleCase = (text) => text.charAt(0).toUpperCase() + text.slice(1);

// Prices for the plan from the Pi's usual prices: prices[hrid] = { a, b, aLow,
// aHigh, bLow, sold } (the week's median ask and bid, its quartiles, sold a day).
// Returns the typical and the cautious market, each { name, buy, sell } as
// evaluateAction wants them.
export function planMarkets(prices, data) {
    const capped = (a, b) => (a > 0 && b > 0 ? Math.min(a, WIDE_SPREAD * b) : a);
    const entry = (hrid, askKey, bidKey) => {
        const p = prices[hrid];
        if (!p) return null;
        const a = p[askKey] > 0 ? p[askKey] : p.a;
        const b = p[bidKey] > 0 ? p[bidKey] : p.b;
        return { a: capped(a, b), b };
    };
    const typical = marketPricer((hrid) => entry(hrid, "a", "b"), data, "ask");
    const buyHigh = marketPricer((hrid) => entry(hrid, "aHigh", "b"), data, "ask");
    const sellLow = marketPricer((hrid) => entry(hrid, "aLow", "bLow"), data, "ask");
    // An enhanced item ("hrid+10"): bought at the ask as it is, sold at the bid after tax.
    const plus = (askKey, bidKey) => (hrid, level) => {
        const p = prices[`${hrid}+${level}`];
        const a = p ? (p[askKey] > 0 ? p[askKey] : p.a) : null;
        const b = p ? (p[bidKey] > 0 ? p[bidKey] : p.b) : null;
        return { buy: a > 0 ? a : null, bid: b > 0 ? b * (1 - MARKET_TAX) : null };
    };
    return {
        typical: { name: "typical", buy: typical.buy, sell: typical.sell, plus: plus("a", "b") },
        cautious: { name: "cautious", buy: buyHigh.buy, sell: sellLow.sell, plus: plus("aHigh", "bLow") },
    };
}

// Everything a plan needs that doesn't change while it runs.
// snapshot: { who (skillingCharacter), coins, owned: { itemHrid: count at +0 } }.
function context(snapshot, data, prices, options) {
    const o = { ...HORIZON_DEFAULTS, ...options };
    // What a device asks for, kept within sense.
    const within = (v, low, high, fallback) => (Number.isFinite(Number(v)) ? Math.min(high, Math.max(low, Number(v))) : fallback);
    o.days = within(o.days, 1, 365, HORIZON_DEFAULTS.days);
    o.blockHours = within(o.blockHours, 1, 24, HORIZON_DEFAULTS.blockHours);
    o.marketShare = within(o.marketShare, 0.01, 1, HORIZON_DEFAULTS.marketShare);
    o.levelDays = within(o.levelDays, 0, 365, HORIZON_DEFAULTS.levelDays);
    const table = data.levelExperienceTable;
    if (!Array.isArray(table) || table.length < 3) throw new Error("the game's level table (levelExperienceTable) is missing");
    const who = snapshot.who;
    const skills = SKILLING_SKILLS.map((s) => "/skills/" + s).filter((s) => who.levels[s] !== undefined);
    const actions = skillingActions(data).filter((a) => skills.includes(a.levelRequirement.skillHrid));
    // Tools per tool type, lowest tier first, and what the character wears now.
    const tiers = {};
    for (const item of Object.values(data.itemDetailMap)) {
        const detail = item.equipmentDetail;
        const req = detail?.levelRequirements?.[0];
        if (!detail || !/_tool$/.test(detail.type || "") || !req) continue;
        (tiers[detail.type] ||= []).push({ itemHrid: item.hrid, skillHrid: req.skillHrid, level: req.level });
    }
    for (const list of Object.values(tiers)) list.sort((x, y) => x.level - y.level);
    const tools = {};
    for (const worn of who.equipped || []) {
        const type = data.itemDetailMap[worn.itemHrid]?.equipmentDetail?.type;
        if (type && tiers[type]) tools[type] = { itemHrid: worn.itemHrid, level: worn.enhancementLevel || 0 };
    }
    // Clothes: what is worn now (in the game's buffs) and all the character owns – worn or in the inventory.
    const gearType = (itemHrid) => {
        const detail = data.itemDetailMap[itemHrid]?.equipmentDetail;
        return Object.keys(detail?.noncombatStats || {}).length && !/_tool$/.test(detail.type || "") && !FIXED_GEAR.has(detail.type) ? detail.type : null;
    };
    const wornGear = {};
    const ownedGear = new Map();
    const addGear = (itemHrid, level) => {
        if (!gearType(itemHrid)) return;
        const item = { itemHrid, level: level || 0 };
        ownedGear.set(toolKey(item), item);
        return item;
    };
    for (const worn of who.equipped || []) {
        const item = addGear(worn.itemHrid, worn.enhancementLevel);
        if (item) wornGear[gearType(worn.itemHrid)] = item;
    }
    for (const held of snapshot.gear || []) addGear(held.itemHrid, held.enhancementLevel);
    // What could be bought for each skill: clothes that add more than XP to it.
    const shop = {};
    for (const skill of skills) {
        shop[skill] = [];
        for (const item of Object.values(data.itemDetailMap)) {
            const type = gearType(item.hrid);
            if (!type || item.isTradable === false) continue;
            if (itemSkillBuffs(item.hrid, 0, skillNameOf(skill), data).buffs.some((b) => b.typeHrid !== WISDOM)) shop[skill].push({ itemHrid: item.hrid, type });
        }
    }
    const markets = planMarkets(prices, data);
    // The +levels of each item the market has had asks for this week.
    const offers = new Map();
    for (const [key, p] of Object.entries(prices)) {
        const m = /^(.+)\+(\d+)$/.exec(key);
        if (!m || !(p?.a > 0) || Number(m[2]) > MAX_PLUS) continue;
        if (!offers.has(m[1])) offers.set(m[1], []);
        offers.get(m[1]).push(Number(m[2]));
    }
    for (const levels of offers.values()) levels.sort((x, y) => x - y);
    // House rooms: their levels now (only when the game sent them – the buffs hold them then) and the room of each skill.
    const house = who.houseLevels && typeof who.houseLevels === "object" ? { ...who.houseLevels } : null;
    const allRooms = house ? Object.values(data.houseRoomDetailMap || {}) : [];
    const rooms = {};
    for (const room of allRooms) if (skills.includes(room.skillHrid) && room.upgradeCostsMap) rooms[room.skillHrid] = room;
    return {
        o,
        data,
        who,
        table,
        skills,
        actions,
        tiers,
        tools,
        wornGear,
        wornGearKey: gearKey(wornGear),
        ownedGear: [...ownedGear.values()],
        gearType,
        shop,
        actionById: new Map(actions.map((a) => [a.hrid, a])),
        skillTypes: Object.fromEntries(skills.map((s) => [s, ACTION_TYPE + skillNameOf(s)])),
        owned: snapshot.owned || {},
        coins: Math.max(0, Number(snapshot.coins) || 0),
        markets,
        offers,
        house: house || {},
        allRooms,
        rooms,
        sold: (hrid) => (Number.isFinite(prices[hrid]?.sold) ? prices[hrid].sold : null),
        blocks: Math.max(1, Math.round((o.days * 24) / o.blockHours)),
        rateCache: new Map(),
        teaCache: new Map(),
        listCache: new Map(),
        loadoutCache: new Map(),
        offerCache: new Map(),
        buffCache: new Map(),
        whoCache: new Map(),
        relevantCache: new Map(),
        actionsOf: Object.fromEntries(skills.map((s) => [s, actions.filter((a) => a.levelRequirement.skillHrid === s)])),
        listIds: 0,
        unknownSales: new Set(),
    };
}

// The character with another tool, clothes and house for one action type: the game's
// buffs already hold what is worn now, so it is taken off and the other put on;
// the skill's house room, built up since, adds what its new levels add.
// gear: type -> { itemHrid, level }, the skill's loadout; house: { levels, key }.
function whoWith(ctx, actionType, tool, gear, house = null) {
    const toolType = toolTypeOf(actionType);
    const worn = ctx.tools[toolType] || null;
    const sameTool = toolKey(worn) === toolKey(tool);
    const sameGear = gearKey(gear) === ctx.wornGearKey;
    const rk = roomKey(ctx, actionType, house);
    const sameHouse = !rk;
    if (sameTool && sameGear && sameHouse) return ctx.who;
    // The same character serves every job of the skill: worked out once.
    const whoKey = `${actionType}|${toolKey(tool)}|${gearKey(gear)}|${rk}`;
    const kept = ctx.whoCache.get(whoKey);
    if (kept) return kept;
    const skill = actionType.slice(ACTION_TYPE.length);
    // Only when the game sent the equipment's buffs is what is worn now in them.
    const inBuffs = !!ctx.who.sources?.equipmentActionTypeBuffsMap;
    const buffsOf = (item) => skillBuffs(ctx, item, skill);
    const off = [];
    const on = [];
    if (!sameTool) {
        if (worn && inBuffs) off.push(...buffsOf(worn));
        if (tool) on.push(...buffsOf(tool));
    }
    if (!sameGear) {
        if (inBuffs) for (const item of Object.values(ctx.wornGear)) off.push(...buffsOf(item));
        for (const item of Object.values(gear)) on.push(...buffsOf(item));
    }
    if (!sameHouse) on.push(...houseBuffs(ctx, actionType, house.levels));
    const buffs = [...(ctx.who.buffs?.[actionType] || []), ...off.map((b) => ({ ...b, flatBoost: -b.flatBoost })), ...on];
    const who = { ...ctx.who, buffs: { ...(ctx.who.buffs || {}), [actionType]: buffs } };
    ctx.whoCache.set(whoKey, who);
    return who;
}

// What an item at its +level does for a skill (by name), as buffs – worked out once.
function skillBuffs(ctx, item, skill) {
    const key = `${item.itemHrid}+${item.level || 0}|${skill}`;
    let buffs = ctx.buffCache.get(key);
    if (!buffs) {
        buffs = itemSkillBuffs(item.itemHrid, item.level, skill, ctx.data).buffs;
        ctx.buffCache.set(key, buffs);
    }
    return buffs;
}

// The clothes owned that do something for a skill, and a key for them: a
// skill's loadout changes only when one of these does.
function relevantGear(ctx, state, skill) {
    const key = `${state.gearKey}|${skill}`;
    let found = ctx.relevantCache.get(key);
    if (!found) {
        const name = skillNameOf(skill);
        const items = state.gear.filter((item) => skillBuffs(ctx, item, name).length);
        found = { items, key: ownedGearKey(items) };
        ctx.relevantCache.set(key, found);
    }
    return found;
}

// What the room of an action type's skill, built up since the snapshot, adds
// to it: a room's action buffs are its flat boost at level 1 and the level
// bonus for each level above. Its global buffs (a sliver of XP and rare find
// for every skill) are left out, so a room changes only its own skill's jobs.
function houseBuffs(ctx, actionType, levels) {
    const out = [];
    const at = (b, field, level) => (level > 0 ? (b[field] || 0) + (level - 1) * (b[field + "LevelBonus"] || 0) : 0);
    for (const room of ctx.allRooms) {
        const from = ctx.house[room.hrid] || 0;
        const to = levels[room.hrid] || 0;
        if (to <= from || !room.usableInActionTypeMap?.[actionType]) continue;
        out.push(...(room.actionBuffs || []).map((b) => ({ uniqueHrid: b.uniqueHrid, typeHrid: b.typeHrid, flatBoost: at(b, "flatBoost", to) - at(b, "flatBoost", from), ratioBoost: at(b, "ratioBoost", to) - at(b, "ratioBoost", from) })));
    }
    return out;
}

// The house as the state holds it: { levels, key } – key names the rooms built up since the snapshot ("" for none).
const houseState = (ctx, levels) => ({ levels, key: ctx.allRooms.filter((r) => (levels[r.hrid] || 0) > (ctx.house[r.hrid] || 0)).map((r) => `${r.hrid}=${levels[r.hrid]}`).join(",") });
// The level of an action type's own room when built up since the snapshot, else "": what its rates depend on.
function roomKey(ctx, actionType, house) {
    if (!house?.key) return "";
    const room = ctx.rooms["/skills/" + actionType.slice(ACTION_TYPE.length)];
    return room && (house.levels[room.hrid] || 0) > (ctx.house[room.hrid] || 0) ? String(house.levels[room.hrid]) : "";
}

const toolKey = (tool) => (tool ? `${tool.itemHrid}+${tool.level}` : "-");
// A loadout as one text, worked out once per loadout (they are kept, not changed).
const gearKeys = new WeakMap();
const gearKey = (gear) => {
    let key = gearKeys.get(gear);
    if (key === undefined) {
        key = Object.keys(gear).sort().map((type) => toolKey(gear[type])).join(",");
        gearKeys.set(gear, key);
    }
    return key;
};

// One job's rates at a level with a tool and clothes: per hour, what it makes
// (each with the listing price and the floor after tax), uses, costs in teas
// and the XP it gives. mode "gold" picks its teas for gold, "xp" for XP; teas,
// when given, are used as they are (to compare clothes on the same job).
// keep: false for a one-off (a purchase tried): worked out but not kept.
function rates(ctx, market, action, level, tool, mode, gear = ctx.wornGear, fixedTeas = null, house = null, keep = true) {
    const gk = gearKey(gear);
    const rk = roomKey(ctx, action.type, house);
    const key = `${market.name}|${action.hrid}|${level}|${toolKey(tool)}|${gk}|${rk}|${mode}${fixedTeas ? "|" + fixedTeas.join("+") : ""}`;
    let r = ctx.rateCache.get(key);
    if (r) return r;
    if (keep && ctx.rateCache.size >= RATE_CACHE_MAX) clearCaches(ctx);
    const who = whoWith(ctx, action.type, tool, gear, house);
    const evaluate = (teas) => daily(evaluateAction(action, who, ctx.data, market, teas, level));
    // The teas are picked once per tool tier and few levels: its +level, clothes and the house hardly change which pay.
    const teaKey = `${market.name}|${action.hrid}|${Math.floor(level / TEA_BUCKET)}|${tool?.itemHrid || "-"}|${mode}`;
    let teas = fixedTeas || ctx.teaCache.get(teaKey);
    if (!teas) {
        teas = bestTeas(action, who, ctx.data, market, evaluate, mode === "xp" ? (x) => x.xpPerDay : (x) => x.goldPerDay).result.teas;
        ctx.teaCache.set(teaKey, teas);
    }
    const e = evaluate(teas);
    const skill = action.levelRequirement.skillHrid;
    const outputs = e.outputs.map((out) => {
        const limited = out.sell.source === "ask" || out.sell.source === "bid";
        if (limited && ctx.sold(out.itemHrid) === null) ctx.unknownSales.add(out.itemHrid);
        return { hrid: out.itemHrid, perHour: out.count * e.actionsPerHour, list: out.price, floor: Math.min(out.price, out.sell.floor ?? out.price), limited };
    });
    const inputs = e.inputs.map((input) => ({ hrid: input.itemHrid, perHour: input.count * e.actionsPerHour, price: input.price || 0 }));
    const costPerHour = inputs.reduce((sum, i) => sum + i.perHour * i.price, 0) + e.teaPerHour;
    // The gold an hour the market leaves of it over a block (nothing in stock, coins aside):
    // what jobs are ranked by – a pair of trousers worth 277M an hour on paper sells a few a day.
    const hours = ctx.o.blockHours;
    const room = (hrid) => {
        const sold = ctx.sold(hrid);
        return sold === null ? Infinity : (sold * ctx.o.marketShare * hours) / 24;
    };
    let h = hours;
    for (const input of inputs) if (input.perHour > 0) h = Math.min(h, room(input.hrid) / input.perHour);
    let marketPerHour = -Infinity;
    if (h >= MIN_JOB_HOURS) {
        let value = -costPerHour * h;
        for (const out of outputs) value += (out.limited ? Math.min(out.perHour * h, room(out.hrid)) : out.perHour * h) * out.list;
        marketPerHour = value / h;
    }
    r = {
        id: action.hrid,
        name: action.name,
        skill,
        type: action.type,
        level,
        tool: tool?.itemHrid || null,
        loadout: gear,
        teas,
        valid: e.valid,
        actionsPerHour: e.actionsPerHour,
        xp: { [skill]: e.xpPerHour },
        xpPerHour: e.xpPerHour,
        outputs,
        inputs,
        teaPerHour: e.teaPerHour,
        costPerHour,
        profitPerHour: e.profitPerHour,
        marketPerHour,
    };
    if (keep) ctx.rateCache.set(key, r);
    return r;
}

// The caches start over: what is in use stays referenced by the plan running, the rest goes.
function clearCaches(ctx) {
    for (const cache of [ctx.rateCache, ctx.listCache, ctx.loadoutCache, ctx.offerCache, ctx.relevantCache, ctx.whoCache]) cache.clear();
}

// Whether the character's levels allow an item.
const meets = (ctx, state, itemHrid) => (ctx.data.itemDetailMap[itemHrid]?.equipmentDetail?.levelRequirements || []).every((req) => (state.level[req.skillHrid] ?? ctx.who.levels[req.skillHrid] ?? 0) >= req.level);

// The clothes a skill is worked in – a loadout of its own, swapped for nothing:
// of each slot, what the character owns that earns the most on the skill's best
// job (as it is worn now when nothing owned does better).
function loadoutOf(ctx, market, state, skill) {
    const level = state.level[skill];
    const tools = (type) => state.tools[toolTypeOf(type)] || null;
    const owned = relevantGear(ctx, state, skill);
    const key = `${market.name}|${skill}|${level}|${toolKey(tools(ctx.skillTypes[skill]))}|${owned.key}|${roomKey(ctx, ctx.skillTypes[skill], state.house)}`;
    let gear = ctx.loadoutCache.get(key);
    if (gear) return gear;
    gear = { ...ctx.wornGear };
    let top = null;
    for (const action of ctx.actionsOf[skill]) {
        if (action.levelRequirement.level > level) continue;
        const r = rates(ctx, market, action, level, tools(action.type), "gold", ctx.wornGear, null, state.house);
        if (r.valid && (!top || r.marketPerHour > top.marketPerHour)) top = r;
    }
    if (top) {
        const action = ctx.actionById.get(top.id);
        let best = top.marketPerHour;
        for (const item of owned.items) {
            const type = ctx.gearType(item.itemHrid);
            if (toolKey(gear[type]) === toolKey(item) || !meets(ctx, state, item.itemHrid)) continue;
            const trial = { ...gear, [type]: item };
            const r = rates(ctx, market, action, level, tools(action.type), "gold", trial, top.teas, state.house);
            if (r.valid && r.marketPerHour > best) {
                best = r.marketPerHour;
                gear = trial;
            }
        }
    }
    ctx.loadoutCache.set(key, gear);
    return gear;
}

// The jobs of one skill the state's level allows, with their rates, best first:
// kept per skill, so a tool, clothes or room bought for one skill leaves the others' lists as they are.
function skillJobs(ctx, market, state, mode, skill) {
    const type = ctx.skillTypes[skill];
    const tool = state.tools[toolTypeOf(type)] || null;
    const gear = loadoutOf(ctx, market, state, skill);
    const level = state.level[skill];
    const key = `${market.name}|${mode}|${skill}|${level}|${toolKey(tool)}|${gearKey(gear)}|${roomKey(ctx, type, state.house)}`;
    let list = ctx.listCache.get(key);
    if (list) return list;
    list = [];
    for (const action of ctx.actionsOf[skill]) {
        if (action.levelRequirement.level > level) continue;
        const r = rates(ctx, market, action, level, tool, mode, gear, null, state.house);
        if (r.valid) list.push(r);
    }
    list.sort((x, y) => (mode === "xp" ? y.xpPerHour - x.xpPerHour : y.marketPerHour - x.marketPerHour || 0));
    list.id = ++ctx.listIds;
    ctx.listCache.set(key, list);
    return list;
}

// The jobs the state's levels allow, with their rates: all of one skill, or the best earners of all.
function jobs(ctx, market, state, mode, skill = null) {
    if (skill) return skillJobs(ctx, market, state, mode, skill);
    const lists = ctx.skills.map((s) => skillJobs(ctx, market, state, mode, s));
    const key = `${market.name}|${mode}|*|${lists.map((l) => l.id).join(",")}`;
    let list = ctx.listCache.get(key);
    if (list) return list;
    list = lists.flat();
    list.sort((x, y) => (mode === "xp" ? y.xpPerHour - x.xpPerHour : y.marketPerHour - x.marketPerHour || 0));
    // The best earners, and the best jobs that need no materials: those still run when coins are short.
    list = [...list.slice(0, CANDIDATES), ...list.slice(CANDIDATES).filter((r) => !r.inputs.length).slice(0, NO_MATERIALS)];
    ctx.listCache.set(key, list);
    return list;
}

// What one sells for at once: the bid after tax (the floor when listing), else
// what it is worth anyway (a crate's contents, the shop).
const tradeBid = (ctx, market, hrid) => {
    const sell = market.sell(hrid);
    if (sell.source === "bid") return sell.price;
    return Number.isFinite(sell.floor) ? sell.floor : sell.price;
};

// What a tool or piece of clothing brings back when sold: the bid for its +level
// after tax – with nobody buying that level, the nearest lower level's (an
// enhanced one is worth at least that) – else the shop price.
function toolResale(ctx, market, tool) {
    if (!tool) return 0;
    const base = tradeBid(ctx, market, tool.itemHrid) || ctx.data.itemDetailMap[tool.itemHrid]?.sellPrice || 0;
    for (let level = tool.level || 0; level > 0; level--) {
        const bid = market.plus(tool.itemHrid, level).bid;
        if (bid > 0) return Math.max(bid, base);
    }
    return base;
}

// What a tool or piece of clothing costs at the market at its +level (null: none for sale).
const buyPrice = (market, item) => (item.level ? market.plus(item.itemHrid, item.level).buy : market.buy(item.itemHrid));

// What the stock left at the end is worth: the floor for up to a day of the
// market's sales, the shop price for the rest.
function stockWorth(ctx, market, stock) {
    let worth = 0;
    for (const [hrid, n] of Object.entries(stock)) {
        if (!(n > 0)) continue;
        const sold = ctx.sold(hrid);
        const atFloor = sold === null ? n : Math.min(n, sold);
        worth += atFloor * tradeBid(ctx, market, hrid) + (n - atFloor) * (ctx.data.itemDetailMap[hrid]?.sellPrice || 0);
    }
    return worth;
}

const worthOf = (ctx, market, state) => state.coins + stockWorth(ctx, market, state.stock) + [...Object.values(state.tools), ...state.gear].reduce((sum, item) => sum + toolResale(ctx, market, item), 0);

function initialState(ctx) {
    const xp = {};
    const level = {};
    for (const s of ctx.skills) {
        level[s] = ctx.who.levels[s];
        xp[s] = experienceOf(ctx.table, ctx.who.experience?.[s], level[s]);
    }
    return { coins: ctx.coins, xp, level, tools: { ...ctx.tools }, stock: {}, owned: { ...ctx.owned }, gear: ctx.ownedGear, gearKey: ownedGearKey(ctx.ownedGear), house: houseState(ctx, { ...ctx.house }) };
}

// The clothes owned, as one text (the loadouts and job lists are kept per set).
const ownedGearKey = (gear) => gear.map(toolKey).sort().join(",");

const cloneState = (state) => ({ coins: state.coins, xp: { ...state.xp }, level: { ...state.level }, tools: { ...state.tools }, stock: { ...state.stock }, owned: { ...state.owned }, gear: state.gear, gearKey: state.gearKey, house: state.house });

// One block of `hours`: the stock sells first, then jobs fill the hours.
// phase: { skill, style } while training, else null (earn the most).
// Returns what ran: [{ r, hours }], the income and the costs.
function runBlock(ctx, market, state, phase, hours) {
    const share = ctx.o.marketShare;
    const capacity = new Map();
    const supply = new Map();
    const limitOf = (map, hrid) => {
        if (!map.has(hrid)) {
            const sold = ctx.sold(hrid);
            map.set(hrid, sold === null ? Infinity : (sold * share * hours) / 24);
        }
        return map.get(hrid);
    };
    let income = 0;
    for (const [hrid, n] of Object.entries(state.stock)) {
        if (!(n > 0)) continue;
        const sell = Math.min(n, limitOf(capacity, hrid));
        if (sell <= 0) continue;
        income += sell * market.sell(hrid).price;
        capacity.set(hrid, limitOf(capacity, hrid) - sell);
        state.stock[hrid] = n - sell;
    }
    // What h hours of a job bring in this block: what the market has room for,
    // at the listing price. The rest goes to stock and counts for nothing here –
    // it isn't coins until it sells – so a job doesn't sink the coins into stock.
    const valueOf = (r, h) => {
        let value = -r.costPerHour * h;
        for (const out of r.outputs) {
            const made = out.perHour * h;
            value += (out.limited ? Math.min(made, Math.max(0, limitOf(capacity, out.hrid))) : made) * out.list;
        }
        return value;
    };
    let coins = state.coins;
    const hoursFor = (r, left) => {
        let h = left;
        if (r.costPerHour > 0) h = Math.min(h, coins / r.costPerHour);
        for (const input of r.inputs) if (input.perHour > 0) h = Math.min(h, Math.max(0, limitOf(supply, input.hrid)) / input.perHour);
        return h;
    };
    const ran = [];
    let left = hours;
    let costs = 0;
    for (let round = 0; round < JOBS_PER_BLOCK && left >= MIN_JOB_HOURS; round++) {
        let best = null;
        const consider = (list, byXp) => {
            for (const r of list) {
                const h = hoursFor(r, left);
                if (h < MIN_JOB_HOURS) continue;
                const value = valueOf(r, h);
                if (!byXp && value <= 0) continue;
                const score = byXp ? r.xpPerHour : value / h;
                if (!best || score > best.score) best = { r, h, value, score };
            }
        };
        if (phase) consider(jobs(ctx, market, state, phase.style, phase.skill), phase.style === "xp");
        if (!best) consider(jobs(ctx, market, state, "gold"), false);
        if (!best) break;
        const { r, h } = best;
        const cost = r.costPerHour * h;
        coins -= cost;
        costs += cost;
        for (const out of r.outputs) {
            const made = out.perHour * h;
            if (!out.limited) {
                income += made * out.list;
                continue;
            }
            const room = Math.max(0, limitOf(capacity, out.hrid));
            const sell = Math.min(made, room);
            income += sell * out.list;
            capacity.set(out.hrid, room - sell);
            if (made > sell) state.stock[out.hrid] = (state.stock[out.hrid] || 0) + made - sell;
        }
        for (const input of r.inputs) supply.set(input.hrid, limitOf(supply, input.hrid) - input.perHour * h);
        for (const [skill, perHour] of Object.entries(r.xp)) state.xp[skill] = (state.xp[skill] || 0) + perHour * h;
        ran.push({ r, hours: h });
        left -= h;
    }
    state.coins = coins + income;
    return { ran, income, costs, idle: left };
}

// Levels from the XP; returns the skills that went up as [{ skill, from, to }].
function levelUp(ctx, state) {
    const ups = [];
    for (const s of ctx.skills) {
        const level = Math.max(state.level[s], Math.floor(fractionalLevel(ctx.table, state.xp[s])));
        if (level > state.level[s]) {
            ups.push({ skill: s, from: state.level[s], to: level });
            state.level[s] = level;
        }
    }
    return ups;
}

// Coins must still buy a block of the job's materials and teas after a purchase,
// or it may take at most half of them.
const leaves = (ctx, state, top, after) => after >= (top?.costPerHour || 0) * ctx.o.blockHours || after >= state.coins / 2;

// The skill's best job now and its loadout: what a purchase is measured on.
function topJob(ctx, market, state, skill) {
    const top = jobs(ctx, market, state, "gold", skill)[0];
    if (!top) return null;
    return { top, action: ctx.actionById.get(top.id), gear: loadoutOf(ctx, market, state, skill), tool: state.tools[toolTypeOf(top.type)] || null };
}

// The purchases worth weighing: of those that add gold, only the ones no other
// beats on price, net cost (price less resale) and gold a day alike – whichever
// is chosen later, by the days left and the coins, is one of these.
function paretoFront(offers) {
    return offers.filter((o) => !offers.some((p) => p !== o && p.price <= o.price && p.netCost <= o.netCost && p.gainPerDay >= o.gainPerDay && (p.price < o.price || p.netCost < o.netCost || p.gainPerDay > o.gainPerDay)));
}

// The offers for one slot of the skill's top job: each candidate { item, price,
// netCost, ... } with the gold a day it adds, worked out once per OFFER_LEVELS
// levels, tool, loadout and house (not kept as rates: there are hundreds) and
// kept as the front only. replace(gear, item) gives the tool and loadout with it.
function offersFor(ctx, market, state, skill, job, slotKey, candidates, replace) {
    const level = state.level[skill];
    const at = Math.max(1, level - (level % OFFER_LEVELS));
    const key = `${market.name}|${slotKey}|${skill}|${at}|${job.top.id}|${toolKey(job.tool)}|${gearKey(job.gear)}|${roomKey(ctx, job.action.type, state.house)}`;
    let front = ctx.offerCache.get(key);
    if (front) return front;
    const base = rates(ctx, market, job.action, at, job.tool, "gold", job.gear, job.top.teas, state.house, false);
    const now = base.valid ? Math.max(0, base.marketPerHour) : 0;
    const offers = [];
    for (const c of candidates()) {
        const { tool, gear } = replace(c.item);
        const r = rates(ctx, market, job.action, at, tool, "gold", gear, job.top.teas, state.house, false);
        const gainPerDay = ((r.valid ? Math.max(0, r.marketPerHour) : 0) - now) * 24;
        if (gainPerDay > Math.max(0, MIN_GAIN * now * 24)) offers.push({ ...c, gainPerDay });
    }
    front = paretoFront(offers);
    ctx.offerCache.set(key, front);
    return front;
}

// Before a block: a better tool for the skill being worked, when it pays – of
// every tier the levels allow, at +0 or a +level for sale, the one whose extra
// gold over the days left (plus levelDays) beats its cost less its resale by
// the most. While training for XP, the next tier at +0 is bought anyway when cheap.
function maybeBuyTool(ctx, market, state, actionType, phase, daysLeft) {
    if (!actionType) return null;
    const toolType = toolTypeOf(actionType);
    const tiers = ctx.tiers[toolType];
    if (!tiers) return null;
    const skill = tiers[0].skillHrid;
    const current = state.tools[toolType] || null;
    const currentTier = current ? tiers.find((t) => t.itemHrid === current.itemHrid)?.level ?? -1 : -1;
    const resale = toolResale(ctx, market, current);
    const inStock = (hrid) => (state.owned[hrid] || 0) > 0;
    const allowed = tiers.filter((t) => (state.level[t.skillHrid] ?? 0) >= t.level);
    const job = topJob(ctx, market, state, skill);
    let front = [];
    if (job) {
        const slotKey = `tool:${allowed.length}:${allowed.map((t) => (inStock(t.itemHrid) ? 1 : 0)).join("")}`;
        const candidates = () => {
            const out = [];
            for (const tier of allowed) {
                for (const level of [0, ...(ctx.offers.get(tier.itemHrid) || [])]) {
                    const item = { itemHrid: tier.itemHrid, level };
                    if (toolKey(item) === toolKey(current)) continue;
                    const owned = inStock(tier.itemHrid) && level === 0;
                    const price = owned ? 0 : buyPrice(market, item);
                    if (price === null) continue;
                    out.push({ item, price, owned, netCost: owned ? 0 : price - toolResale(ctx, market, item) });
                }
            }
            return out;
        };
        front = offersFor(ctx, market, state, skill, job, slotKey, candidates, (item) => ({ tool: item, gear: job.gear }));
    }
    let chosen = null;
    for (const o of front) {
        if (o.price > state.coins || !leaves(ctx, state, job.top, state.coins - o.price + resale)) continue;
        const value = o.gainPerDay * (daysLeft + ctx.o.levelDays) - o.netCost;
        if (value > 0 && (!chosen || value > chosen.value)) chosen = { ...o, value };
    }
    if (!chosen && phase?.style === "xp" && phase.skill === skill) {
        // Training for XP: the highest tier at +0 above the one worn, when cheap.
        for (const tier of allowed) {
            if (tier.level <= currentTier) continue;
            const item = { itemHrid: tier.itemHrid, level: 0 };
            const owned = inStock(tier.itemHrid);
            const price = owned ? 0 : buyPrice(market, item);
            if (price === null || price > state.coins) continue;
            const netCost = owned ? 0 : price - toolResale(ctx, market, item);
            if (netCost <= CHEAP_TOOL * state.coins) chosen = { item, price, owned, netCost, gainPerDay: 0 };
        }
    }
    if (!chosen) return null;
    state.coins += resale - chosen.price;
    if (chosen.owned) state.owned[chosen.item.itemHrid]--;
    state.tools[toolType] = chosen.item;
    return { kind: "tool", itemHrid: chosen.item.itemHrid, level: chosen.item.level, price: chosen.price, owned: chosen.owned, sold: current?.itemHrid || null, soldLevel: current?.level || 0, resale, gainPerDay: chosen.gainPerDay };
}

// Before a block: one piece of clothing for the skill being worked, at +0 or a
// +level for sale, when its extra gold (within the market's limits, on the
// skill's best job) over the days left plus levelDays pays for it, less what it
// sells for again. What it replaces is kept – another skill may wear it – but
// a lower level of the same piece is sold.
function maybeBuyGear(ctx, market, state, actionType, daysLeft) {
    if (!actionType) return null;
    const skill = "/skills/" + actionType.slice(ACTION_TYPE.length);
    const shop = ctx.shop[skill];
    if (!shop?.length || state.level[skill] === undefined) return null;
    const job = topJob(ctx, market, state, skill);
    if (!job || !(job.top.marketPerHour > 0)) return null;
    const ownedLevel = new Map();
    for (const item of state.gear) ownedLevel.set(item.itemHrid, Math.max(ownedLevel.get(item.itemHrid) ?? -1, item.level));
    const usable = shop.filter(({ itemHrid }) => meets(ctx, state, itemHrid));
    const candidates = () => {
        const out = [];
        for (const { itemHrid, type } of usable) {
            const have = ownedLevel.get(itemHrid) ?? -1;
            for (const level of [0, ...(ctx.offers.get(itemHrid) || [])]) {
                if (level <= have) continue;
                const item = { itemHrid, level, type };
                const price = buyPrice(market, item);
                if (!(price > 0)) continue;
                out.push({ item, price, netCost: price - toolResale(ctx, market, item) });
            }
        }
        return out;
    };
    const slotKey = `gear:${usable.length}:${state.gearKey}`;
    const front = offersFor(ctx, market, state, skill, job, slotKey, candidates, (item) => ({ tool: job.tool, gear: { ...job.gear, [item.type]: { itemHrid: item.itemHrid, level: item.level } } }));
    let best = null;
    for (const o of front) {
        const old = ownedLevel.has(o.item.itemHrid) ? state.gear.find((g) => g.itemHrid === o.item.itemHrid && g.level === ownedLevel.get(o.item.itemHrid)) : null;
        const oldResale = toolResale(ctx, market, old);
        if (o.price > state.coins || !leaves(ctx, state, job.top, state.coins - o.price + oldResale)) continue;
        const value = o.gainPerDay * (daysLeft + ctx.o.levelDays) - o.netCost;
        if (value > 0 && (!best || value > best.value)) best = { ...o, old, oldResale, value };
    }
    if (!best) return null;
    const item = { itemHrid: best.item.itemHrid, level: best.item.level };
    state.coins += best.oldResale - best.price;
    state.gear = [...state.gear.filter((g) => g !== best.old), item];
    state.gearKey = ownedGearKey(state.gear);
    return { kind: "gear", itemHrid: item.itemHrid, level: item.level, price: best.price, owned: false, sold: best.old ? best.old.itemHrid : null, soldLevel: best.old?.level || 0, resale: best.old ? best.oldResale : best.price - best.netCost, gainPerDay: best.gainPerDay, gear: true };
}

// Before a block: the skill's house room one level up, when its extra gold over
// the days left plus levelDays pays for the coins and materials (at the ask; no
// material more than HOUSE_BUY_DAYS of the market's share of its sales).
function maybeBuyHouse(ctx, market, state, actionType, daysLeft) {
    if (!actionType) return null;
    const skill = "/skills/" + actionType.slice(ACTION_TYPE.length);
    const room = ctx.rooms[skill];
    if (!room) return null;
    const level = state.house.levels[room.hrid] || 0;
    if (level >= MAX_HOUSE_LEVEL) return null;
    let price = 0;
    for (const c of room.upgradeCostsMap[String(level + 1)] || []) {
        const each = market.buy(c.itemHrid);
        if (each === null) return null;
        const sold = c.itemHrid === "/items/coin" ? null : ctx.sold(c.itemHrid);
        if (sold !== null && c.count > sold * ctx.o.marketShare * HOUSE_BUY_DAYS) return null;
        price += each * c.count;
    }
    const job = topJob(ctx, market, state, skill);
    if (!job || price > state.coins || !leaves(ctx, state, job.top, state.coins - price)) return null;
    const house = houseState(ctx, { ...state.house.levels, [room.hrid]: level + 1 });
    const r = rates(ctx, market, job.action, state.level[skill], job.tool, "gold", job.gear, job.top.teas, house);
    const gainPerDay = r.valid ? (r.marketPerHour - Math.max(0, job.top.marketPerHour)) * 24 : 0;
    if (!(gainPerDay * (daysLeft + ctx.o.levelDays) > price)) return null;
    state.coins -= price;
    state.house = house;
    return { kind: "house", roomHrid: room.hrid, level: level + 1, price, owned: false, sold: null, resale: 0, gainPerDay };
}

// The gold a day the state can earn: a day of the best jobs with the market's full room.
function earnRate(ctx, market, state) {
    const copy = cloneState(state);
    copy.stock = {};
    const before = copy.coins;
    runBlock(ctx, market, copy, null, 24);
    return copy.coins - before + stockWorth(ctx, market, copy.stock);
}

// One plan run through every block. Returns its worth at the end, score and timeline.
function simulate(ctx, market, phases) {
    const state = initialState(ctx);
    const startWorth = worthOf(ctx, market, state);
    const blockHours = ctx.o.blockHours;
    const timeline = [];
    const purchases = [];
    const levelUps = [];
    const worthByDay = [];
    let p = 0;
    let lastType = null;
    for (let b = 0; b < ctx.blocks; b++) {
        while (p < phases.length && state.level[phases[p].skill] >= phases[p].level) p++;
        const phase = phases[p] || null;
        const daysLeft = ((ctx.blocks - b) * blockHours) / 24;
        // The skill this block works: the phase's, else the best earner's (or the last block's).
        const focusType = phase ? ctx.actions.find((a) => a.levelRequirement.skillHrid === phase.skill)?.type : jobs(ctx, market, state, "gold")[0]?.type || lastType;
        const bought = maybeBuyTool(ctx, market, state, focusType, phase, daysLeft);
        if (bought) purchases.push({ block: b, ...bought });
        const clothes = maybeBuyGear(ctx, market, state, focusType, daysLeft);
        if (clothes) purchases.push({ block: b, ...clothes });
        const room = maybeBuyHouse(ctx, market, state, focusType, daysLeft);
        if (room) purchases.push({ block: b, ...room });
        const block = runBlock(ctx, market, state, phase, blockHours);
        for (const up of levelUp(ctx, state)) levelUps.push({ block: b, ...up });
        const main = block.ran.slice().sort((x, y) => y.hours - x.hours)[0] || null;
        lastType = main?.r.type || lastType;
        timeline.push({ phase: p < phases.length ? p : null, ran: block.ran.map(({ r, hours }) => ({ r, hours })), income: block.income, costs: block.costs, idle: block.idle });
        if (((b + 1) * blockHours) % 24 === 0) worthByDay.push(Math.round(worthOf(ctx, market, state)));
    }
    const worth = worthOf(ctx, market, state);
    const endRate = earnRate(ctx, market, state);
    return { phases, startWorth, worth, gain: worth - startWorth, endRate, score: worth + ctx.o.levelDays * endRate, timeline, purchases, levelUps, worthByDay, end: state };
}

// Training targets: the next levels of each skill where a job or a tool unlocks.
function phaseOptions(ctx) {
    const options = [];
    for (const skill of ctx.skills) {
        const now = ctx.who.levels[skill];
        const levels = new Set();
        for (const a of ctx.actions) if (a.levelRequirement.skillHrid === skill && a.levelRequirement.level > now) levels.add(a.levelRequirement.level);
        for (const list of Object.values(ctx.tiers)) for (const t of list) if (t.skillHrid === skill && t.level > now) levels.add(t.level);
        const targets = [...levels].filter((l) => l <= now + UNLOCK_REACH && l < ctx.table.length).sort((x, y) => x - y).slice(0, UNLOCK_TARGETS);
        for (const level of targets) for (const style of ["gold", "xp"]) options.push({ skill, level, style });
        options.push({ skill, level: Infinity, style: "gold" });
    }
    return options;
}

export function planName(phases) {
    if (!phases.length) return "Earn the most every block";
    const part = (ph) => {
        const skill = titleCase(skillNameOf(ph.skill));
        if (ph.level === Infinity) return `only ${skill}`;
        return `${skill} to ${ph.level} (${ph.style === "xp" ? "fastest XP" : "earning in it"})`;
    };
    const text = phases.map(part).join(", then ");
    return titleCase(phases.at(-1).level === Infinity ? text : `${text}, then earn the most`);
}

// The clothes a job is worked in that do something for it.
const wornFor = (ctx, r) => Object.values(r.loadout).filter((item) => itemSkillBuffs(item.itemHrid, item.level, skillNameOf(r.skill), ctx.data).buffs.length).map((item) => item.itemHrid);

// The blocks as stretches of the same main job: what to do from day x to day y.
function segments(ctx, run) {
    const out = [];
    const blockDays = ctx.o.blockHours / 24;
    run.timeline.forEach((block, b) => {
        const main = block.ran.slice().sort((x, y) => y.hours - x.hours)[0] || null;
        const id = main ? main.r.id : "idle";
        const last = out.at(-1);
        const income = block.income - block.costs;
        if (last && last.hrid === id && last.phase === block.phase) {
            last.to = (b + 1) * blockDays;
            last.blocks++;
            last.gold += income;
            for (const [skill, xp] of xpOf(block)) last.xp[skill] = (last.xp[skill] || 0) + xp;
            for (const { r } of block.ran) if (r.id !== id) last.also.add(r.name);
            return;
        }
        const xp = {};
        for (const [skill, amount] of xpOf(block)) xp[skill] = amount;
        out.push({
            from: b * blockDays,
            to: (b + 1) * blockDays,
            blocks: 1,
            phase: block.phase,
            hrid: id,
            name: main ? main.r.name : "Nothing pays",
            skill: main ? main.r.skill : null,
            teas: main ? main.r.teas : [],
            tool: main ? main.r.tool : null,
            gear: main ? wornFor(ctx, main.r) : [],
            gold: income,
            xp,
            also: new Set(block.ran.filter(({ r }) => r.id !== id).map(({ r }) => r.name)),
        });
    });
    return out.map((s) => ({ ...s, gold: Math.round(s.gold), xp: Object.fromEntries(Object.entries(s.xp).map(([k, v]) => [k, Math.round(v)])), also: [...s.also] }));
}

function xpOf(block) {
    const sum = new Map();
    for (const { r, hours } of block.ran) for (const [skill, perHour] of Object.entries(r.xp)) sum.set(skill, (sum.get(skill) || 0) + perHour * hours);
    return sum;
}

// What to do in the first block: each job, its hours and teas.
function firstBlock(ctx, run) {
    const block = run.timeline[0];
    if (!block) return null;
    return {
        jobs: block.ran.map(({ r, hours }) => ({ hrid: r.id, name: r.name, skill: r.skill, hours: Math.round(hours * 100) / 100, actions: Math.round(r.actionsPerHour * hours), teas: r.teas, gear: wornFor(ctx, r), goldPerHour: Math.round(r.profitPerHour), xpPerHour: Math.round(r.xpPerHour) })),
        idle: Math.round(block.idle * 100) / 100,
    };
}

function summary(ctx, run, cautious = null, bare = null) {
    const startLevels = initialState(ctx).level;
    const short = (r) => (r ? { score: Math.round(r.score), gain: Math.round(r.gain), endRate: Math.round(r.endRate) } : null);
    return {
        name: planName(run.phases),
        phases: run.phases.map((ph) => ({ skill: ph.skill, level: ph.level === Infinity ? null : ph.level, style: ph.style })),
        score: Math.round(run.score),
        worth: Math.round(run.worth),
        gain: Math.round(run.gain),
        endRate: Math.round(run.endRate),
        cautious: short(cautious),
        noCommunity: short(bare),
        segments: segments(ctx, run),
        purchases: run.purchases.map((x) => ({ day: (x.block * ctx.o.blockHours) / 24, kind: x.kind, itemHrid: x.itemHrid || null, roomHrid: x.roomHrid || null, level: x.level || 0, price: Math.round(x.price), owned: x.owned, sold: x.sold, soldLevel: x.soldLevel || 0, resale: Math.round(x.resale), gainPerDay: Math.round(x.gainPerDay), gear: !!x.gear })),
        levels: Object.fromEntries(ctx.skills.filter((s) => run.end.level[s] !== startLevels[s]).map((s) => [s, [startLevels[s], run.end.level[s]]])),
        house: Object.fromEntries(ctx.allRooms.filter((r) => (run.end.house.levels[r.hrid] || 0) !== (ctx.house[r.hrid] || 0)).map((r) => [r.hrid, [ctx.house[r.hrid] || 0, run.end.house.levels[r.hrid]]])),
        worthByDay: run.worthByDay,
        first: firstBlock(ctx, run),
    };
}

// The same plan twice (a phase already reached, say) shows once: the simplest.
const signature = (run) => run.timeline.map((b) => b.ran.map(({ r, hours }) => `${r.id}:${Math.round(hours * 10)}`).join("+")).join("|");

// The whole plan: every candidate plan simulated, the best first.
// snapshot: { who, coins, owned }; prices: see planMarkets; options: HORIZON_DEFAULTS.
export function planHorizon(snapshot, data, prices, options = {}, now = Date.now()) {
    const started = Date.now();
    const ctx = context(snapshot, data, prices, options);
    const market = ctx.markets.typical;
    const options1 = phaseOptions(ctx);
    const runs = [simulate(ctx, market, [])];
    for (const option of options1) runs.push(simulate(ctx, market, [option]));
    // The best single training phases, each with a second phase after it.
    const beam = runs.filter((r) => r.phases.length === 1 && r.phases[0].level !== Infinity).sort((x, y) => y.score - x.score).slice(0, BEAM);
    for (const first of beam) {
        for (const second of options1) {
            if (second.skill === first.phases[0].skill && second.level !== Infinity && second.level <= first.phases[0].level) continue;
            runs.push(simulate(ctx, market, [first.phases[0], second]));
        }
    }
    runs.sort((x, y) => y.score - x.score || x.phases.length - y.phases.length);
    const seen = new Set();
    const distinct = [];
    for (const run of runs) {
        const sig = signature(run);
        if (seen.has(sig)) continue;
        seen.add(sig);
        distinct.push(run);
    }
    const baseline = runs.find((r) => !r.phases.length);
    // The skill earning now, kept to, for comparison ("only Tailoring").
    const nowSkill = baseline.timeline[0]?.ran[0]?.r.skill || null;
    const only = nowSkill ? runs.find((r) => r.phases.length === 1 && r.phases[0].skill === nowSkill && r.phases[0].level === Infinity) : null;
    const shown = distinct.slice(0, PLANS_SHOWN);
    for (const extra of [baseline, only]) if (extra && !shown.includes(extra)) shown.push(extra);
    const cautious = new Map();
    for (const run of shown.slice(0, CAUTIOUS_TOP).concat([baseline, only].filter(Boolean))) {
        if (!cautious.has(run)) cautious.set(run, simulate(ctx, ctx.markets.cautious, run.phases));
    }
    // The same plans without the community buffs, as if nobody bought them again.
    const bare = new Map();
    const bareSnapshot = withoutCommunity(snapshot);
    if (bareSnapshot) {
        const ctx2 = context(bareSnapshot, data, prices, options);
        for (const run of cautious.keys()) bare.set(run, simulate(ctx2, ctx2.markets.typical, run.phases));
    }
    const plans = shown.map((run) => summary(ctx, run, cautious.get(run) || null, bare.get(run) || null));
    const best = plans[0];
    const cautiousBest = plans.filter((x) => x.cautious).sort((x, y) => y.cautious.score - x.cautious.score)[0];
    const bareBest = plans.filter((x) => x.noCommunity).sort((x, y) => y.noCommunity.score - x.noCommunity.score)[0];
    return {
        at: now,
        options: ctx.o,
        start: { coins: Math.round(ctx.coins), worth: Math.round(baseline.startWorth), levels: initialState(ctx).level, tools: ctx.tools, gear: ctx.ownedGear, house: ctx.house },
        plans,
        best: 0,
        baseline: plans.indexOf(plans.find((x) => !x.phases.length)),
        only: only ? plans.findIndex((x) => x.phases.length === 1 && x.phases[0].level === null && x.phases[0].skill === nowSkill) : -1,
        // When cautious prices favour another plan, it says so.
        cautiousBest: cautiousBest && cautiousBest !== best ? plans.indexOf(cautiousBest) : null,
        // And when the plans do best in another order without the community buffs.
        noCommunityBest: bareBest && bareBest !== best ? plans.indexOf(bareBest) : null,
        community: !!bareSnapshot,
        tried: runs.length,
        unknownSales: [...ctx.unknownSales].slice(0, 20),
        ms: Date.now() - started,
    };
}

// The snapshot without the community buffs (null when it has none).
function withoutCommunity(snapshot) {
    const buffs = snapshot.who?.buffs;
    if (!buffs) return null;
    let removed = false;
    const out = {};
    for (const [type, list] of Object.entries(buffs)) {
        out[type] = (list || []).filter((b) => {
            const community = /_community_buff$/.test(b.uniqueHrid || "");
            removed ||= community;
            return !community;
        });
    }
    return removed ? { ...snapshot, who: { ...snapshot.who, buffs: out } } : null;
}

// What the plan says to do first, as one line to compare against (for the 🧭 dot).
export function planAdviceKey(plan) {
    const best = plan?.plans?.[plan.best];
    if (!best) return "";
    return [best.name, best.first?.jobs?.[0]?.hrid || ""].join("|");
}

// For the tests: one plan simulated on its own.
export function simulatePlan(snapshot, data, prices, phases, options = {}, scenario = "typical") {
    const ctx = context(scenario === "noCommunity" ? withoutCommunity(snapshot) || snapshot : snapshot, data, prices, options);
    if (scenario === "noCommunity") scenario = "typical";
    return simulate(ctx, ctx.markets[scenario], phases);
}

// The part of the game's data the plan needs, to send to the Pi (well under
// 1 MB): the gathering and production actions, the house rooms, and of each item what the
// skilling maths reads. hash: changes with the game's data (a patch), so it is
// sent again only then.
const ACTION_FIELDS = ["hrid", "function", "type", "category", "name", "levelRequirement", "baseTimeCost", "experienceGain", "dropTable", "essenceDropTable", "rareDropTable", "upgradeItemHrid", "inputItems", "outputItems", "sortIndex"];
export function planData(data) {
    const pick = (object, fields) => Object.fromEntries(fields.filter((f) => object[f] !== undefined).map((f) => [f, object[f]]));
    const types = new Set(SKILLING_SKILLS.map((s) => ACTION_TYPE + s));
    const actionDetailMap = {};
    for (const [hrid, action] of Object.entries(data.actionDetailMap || {})) {
        if (types.has(action.type) && /\/(gathering|production)$/.test(action.function || "")) actionDetailMap[hrid] = pick(action, ACTION_FIELDS);
    }
    const itemDetailMap = {};
    for (const [hrid, item] of Object.entries(data.itemDetailMap || {})) {
        const out = pick(item, ["hrid", "name", "isTradable", "sellPrice", "sortIndex"]);
        if (item.consumableDetail) out.consumableDetail = pick(item.consumableDetail, ["usableInActionTypeMap", "buffs"]);
        if (item.equipmentDetail) out.equipmentDetail = pick(item.equipmentDetail, ["type", "levelRequirements", "noncombatStats", "noncombatEnhancementBonuses"]);
        itemDetailMap[hrid] = out;
    }
    const houseRoomDetailMap = {};
    for (const [hrid, room] of Object.entries(data.houseRoomDetailMap || {})) houseRoomDetailMap[hrid] = pick(room, ["hrid", "name", "skillHrid", "usableInActionTypeMap", "actionBuffs", "globalBuffs", "upgradeCostsMap"]);
    const trimmed = {
        actionDetailMap,
        itemDetailMap,
        houseRoomDetailMap,
        openableLootDropMap: data.openableLootDropMap || {},
        levelExperienceTable: data.levelExperienceTable || null,
        enhancementLevelTotalBonusMultiplierTable: data.enhancementLevelTotalBonusMultiplierTable || null,
    };
    return { hash: textHash(JSON.stringify(trimmed)), data: trimmed };
}

// A short hash of a text (FNV-1a, 2 × 32 bits): enough to tell two versions of the game's data apart.
export function textHash(text) {
    let h1 = 0x811c9dc5;
    let h2 = 0x01000193 ^ text.length;
    for (let i = 0; i < text.length; i++) {
        const c = text.charCodeAt(i);
        h1 = Math.imul(h1 ^ c, 0x01000193);
        h2 = Math.imul(h2 ^ c, 0x5bd1e995);
    }
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}
