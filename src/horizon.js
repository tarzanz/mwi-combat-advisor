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
//   sells for again (the old one is sold at the bid).
// - Worth at the end = coins + tools at their bid + stock (at the bid for up to
//   a day of sales, the shop price for the rest). Levels can't be sold, so the
//   score adds levelDays × the gold a day the character can earn at the end –
//   otherwise a plan would never train near its end.
// - Plans compared: earning the most every block; "only skill S"; and up to two
//   training phases (skill S to a level where a job or tool unlocks, earning in
//   S or at its fastest XP) before earning – the best single phases are
//   extended with a second one (a beam search).
//
// Combat can join later as another kind of activity: everything below works
// on activities with an XP rate per skill, items made and used per hour and
// coins per hour (see rates()), not on skilling actions as such.

import { SKILLING_SKILLS, WIDE_SPREAD, bestTeas, daily, evaluateAction, marketPricer, skillingActions } from "./skilling.js";
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
// The earning jobs tried in a block: the best by gold an hour before the market's limits.
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
    return {
        typical: { name: "typical", buy: typical.buy, sell: typical.sell },
        cautious: { name: "cautious", buy: buyHigh.buy, sell: sellLow.sell },
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
    const markets = planMarkets(prices, data);
    return {
        o,
        data,
        who,
        table,
        skills,
        actions,
        tiers,
        tools,
        owned: snapshot.owned || {},
        coins: Math.max(0, Number(snapshot.coins) || 0),
        markets,
        sold: (hrid) => (Number.isFinite(prices[hrid]?.sold) ? prices[hrid].sold : null),
        blocks: Math.max(1, Math.round((o.days * 24) / o.blockHours)),
        rateCache: new Map(),
        teaCache: new Map(),
        listCache: new Map(),
        unknownSales: new Set(),
    };
}

// The character with another tool for one action type: the game's buffs
// already hold the tool worn now, so it is taken off and the other put on.
function whoWithTool(ctx, actionType, tool) {
    const toolType = toolTypeOf(actionType);
    const worn = ctx.tools[toolType] || null;
    if ((worn?.itemHrid || "") === (tool?.itemHrid || "") && (worn?.level || 0) === (tool?.level || 0)) return ctx.who;
    const skill = actionType.slice(ACTION_TYPE.length);
    // Only when the game sent the equipment's buffs is the tool worn now in them.
    const inBuffs = !!ctx.who.sources?.equipmentActionTypeBuffsMap;
    const off = worn && inBuffs ? itemSkillBuffs(worn.itemHrid, worn.level, skill, ctx.data).buffs : [];
    const on = tool ? itemSkillBuffs(tool.itemHrid, tool.level, skill, ctx.data).buffs : [];
    const buffs = [...(ctx.who.buffs?.[actionType] || []), ...off.map((b) => ({ ...b, flatBoost: -b.flatBoost })), ...on];
    return { ...ctx.who, buffs: { ...(ctx.who.buffs || {}), [actionType]: buffs } };
}

const toolKey = (tool) => (tool ? `${tool.itemHrid}+${tool.level}` : "-");

// One job's rates at a level with a tool: per hour, what it makes (each with
// the listing price and the floor after tax), uses, costs in teas and the XP
// it gives. mode "gold" picks its teas for gold, "xp" for XP.
function rates(ctx, market, action, level, tool, mode) {
    const key = `${market.name}|${action.hrid}|${level}|${toolKey(tool)}|${mode}`;
    let r = ctx.rateCache.get(key);
    if (r) return r;
    const who = whoWithTool(ctx, action.type, tool);
    const evaluate = (teas) => daily(evaluateAction(action, who, ctx.data, market, teas, level));
    const teaKey = `${market.name}|${action.hrid}|${Math.floor(level / TEA_BUCKET)}|${toolKey(tool)}|${mode}`;
    let teas = ctx.teaCache.get(teaKey);
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
    r = {
        id: action.hrid,
        name: action.name,
        skill,
        type: action.type,
        level,
        tool: tool?.itemHrid || null,
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
    };
    ctx.rateCache.set(key, r);
    return r;
}

// The jobs the state's levels allow, with their rates: all of one skill, or the best earners of all.
function jobs(ctx, market, state, mode, skill = null) {
    const key = `${market.name}|${mode}|${skill || "*"}|${ctx.skills.map((s) => state.level[s]).join(",")}|${Object.values(state.tools).map(toolKey).join(",")}`;
    let list = ctx.listCache.get(key);
    if (list) return list;
    list = [];
    for (const action of ctx.actions) {
        const s = action.levelRequirement.skillHrid;
        if ((skill && s !== skill) || action.levelRequirement.level > state.level[s]) continue;
        const r = rates(ctx, market, action, state.level[s], state.tools[toolTypeOf(action.type)] || null, mode);
        if (r.valid) list.push(r);
    }
    list.sort((x, y) => (mode === "xp" ? y.xpPerHour - x.xpPerHour : y.profitPerHour - x.profitPerHour));
    // The best earners, and the best jobs that need no materials: those still run when coins are short.
    if (!skill) list = [...list.slice(0, CANDIDATES), ...list.slice(CANDIDATES).filter((r) => !r.inputs.length).slice(0, NO_MATERIALS)];
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

// What a tool brings back when sold: the bid for the item at +0 after tax (an
// enhanced one is worth at least that), else the shop price.
const toolResale = (ctx, market, tool) => (tool ? tradeBid(ctx, market, tool.itemHrid) || ctx.data.itemDetailMap[tool.itemHrid]?.sellPrice || 0 : 0);

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

const worthOf = (ctx, market, state) => state.coins + stockWorth(ctx, market, state.stock) + Object.values(state.tools).reduce((sum, tool) => sum + toolResale(ctx, market, tool), 0);

function initialState(ctx) {
    const xp = {};
    const level = {};
    for (const s of ctx.skills) {
        level[s] = ctx.who.levels[s];
        xp[s] = experienceOf(ctx.table, ctx.who.experience?.[s], level[s]);
    }
    return { coins: ctx.coins, xp, level, tools: { ...ctx.tools }, stock: {}, owned: { ...ctx.owned } };
}

const cloneState = (state) => ({ coins: state.coins, xp: { ...state.xp }, level: { ...state.level }, tools: { ...state.tools }, stock: { ...state.stock }, owned: { ...state.owned } });

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

// Before a block: a better tool for the skill being worked, when it pays.
function maybeBuyTool(ctx, market, state, actionType, phase, daysLeft) {
    if (!actionType) return null;
    const toolType = toolTypeOf(actionType);
    const tiers = ctx.tiers[toolType];
    if (!tiers) return null;
    const skill = tiers[0].skillHrid;
    const current = state.tools[toolType] || null;
    const currentTier = current ? tiers.find((t) => t.itemHrid === current.itemHrid)?.level ?? -1 : -1;
    const next = tiers.filter((t) => t.level > currentTier && (state.level[t.skillHrid] ?? 0) >= t.level).pop();
    if (!next) return null;
    const owned = (state.owned[next.itemHrid] || 0) > 0;
    const price = owned ? 0 : market.buy(next.itemHrid);
    if (price === null || price > state.coins) return null;
    const tool = { itemHrid: next.itemHrid, level: 0 };
    const best = (t) => {
        const list = jobs(ctx, market, { ...state, tools: { ...state.tools, [toolType]: t } }, "gold", skill);
        return list.length ? list[0].profitPerHour : 0;
    };
    const gainPerDay = (best(tool) - best(current)) * 24;
    // Coins must still buy a block of the job's materials and teas afterwards,
    // or the tool may take at most half of them.
    const withTool = jobs(ctx, market, { ...state, tools: { ...state.tools, [toolType]: tool } }, "gold", skill)[0];
    const resale = toolResale(ctx, market, current);
    const after = state.coins - price + resale;
    if (after < (withTool?.costPerHour || 0) * ctx.o.blockHours && after < state.coins / 2) return null;
    const netCost = owned ? 0 : price - toolResale(ctx, market, tool);
    const pays = gainPerDay * (daysLeft + ctx.o.levelDays) > netCost;
    const cheap = phase?.style === "xp" && phase.skill === skill && netCost <= CHEAP_TOOL * state.coins;
    if (!pays && !cheap) return null;
    state.coins += resale - price;
    if (owned) state.owned[next.itemHrid]--;
    state.tools[toolType] = tool;
    return { itemHrid: next.itemHrid, price, owned, sold: current?.itemHrid || null, resale, gainPerDay };
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
function firstBlock(run) {
    const block = run.timeline[0];
    if (!block) return null;
    return {
        jobs: block.ran.map(({ r, hours }) => ({ hrid: r.id, name: r.name, skill: r.skill, hours: Math.round(hours * 100) / 100, actions: Math.round(r.actionsPerHour * hours), teas: r.teas, goldPerHour: Math.round(r.profitPerHour), xpPerHour: Math.round(r.xpPerHour) })),
        idle: Math.round(block.idle * 100) / 100,
    };
}

function summary(ctx, run, cautious = null) {
    const startLevels = initialState(ctx).level;
    return {
        name: planName(run.phases),
        phases: run.phases.map((ph) => ({ skill: ph.skill, level: ph.level === Infinity ? null : ph.level, style: ph.style })),
        score: Math.round(run.score),
        worth: Math.round(run.worth),
        gain: Math.round(run.gain),
        endRate: Math.round(run.endRate),
        cautious: cautious ? { score: Math.round(cautious.score), gain: Math.round(cautious.gain), endRate: Math.round(cautious.endRate) } : null,
        segments: segments(ctx, run),
        purchases: run.purchases.map((x) => ({ day: (x.block * ctx.o.blockHours) / 24, itemHrid: x.itemHrid, price: Math.round(x.price), owned: x.owned, sold: x.sold, resale: Math.round(x.resale), gainPerDay: Math.round(x.gainPerDay) })),
        levels: Object.fromEntries(ctx.skills.filter((s) => run.end.level[s] !== startLevels[s]).map((s) => [s, [startLevels[s], run.end.level[s]]])),
        worthByDay: run.worthByDay,
        first: firstBlock(run),
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
    const plans = shown.map((run) => summary(ctx, run, cautious.get(run) || null));
    const best = plans[0];
    const cautiousBest = plans.filter((x) => x.cautious).sort((x, y) => y.cautious.score - x.cautious.score)[0];
    return {
        at: now,
        options: ctx.o,
        start: { coins: Math.round(ctx.coins), worth: Math.round(baseline.startWorth), levels: initialState(ctx).level, tools: ctx.tools },
        plans,
        best: 0,
        baseline: plans.indexOf(plans.find((x) => !x.phases.length)),
        only: only ? plans.findIndex((x) => x.phases.length === 1 && x.phases[0].level === null && x.phases[0].skill === nowSkill) : -1,
        // When cautious prices favour another plan, it says so.
        cautiousBest: cautiousBest && cautiousBest !== best ? plans.indexOf(cautiousBest) : null,
        tried: runs.length,
        unknownSales: [...ctx.unknownSales].slice(0, 20),
        ms: Date.now() - started,
    };
}

// What the plan says to do first, as one line to compare against (for the 🧭 dot).
export function planAdviceKey(plan) {
    const best = plan?.plans?.[plan.best];
    if (!best) return "";
    return [best.name, best.first?.jobs?.[0]?.hrid || ""].join("|");
}

// For the tests: one plan simulated on its own.
export function simulatePlan(snapshot, data, prices, phases, options = {}, scenario = "typical") {
    const ctx = context(snapshot, data, prices, options);
    return simulate(ctx, ctx.markets[scenario], phases);
}

// The part of the game's data the plan needs, to send to the Pi (well under
// 1 MB): the gathering and production actions, and of each item what the
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
    const trimmed = {
        actionDetailMap,
        itemDetailMap,
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
