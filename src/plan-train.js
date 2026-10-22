// Turns a plan from the MWITools planning tab into an ordered "train" of
// production stops. MWITools keeps its planner inside its own sandbox, so the
// plan is read from what the planning tab shows: the goals (house level or item
// quantity) and the Full chain / One step / Buy choice per item from step 2.
// The amounts are then worked out again from the game's recipes, because the
// tab rounds large numbers (1.27K).

const INVENTORY = "/item_locations/inventory";
const PRODUCE = new Set(["chain", "single", "mixed"]);

function itemFromIcon(element) {
    for (const use of element?.querySelectorAll("use") || []) {
        const href = use.getAttribute("href") || use.getAttribute("xlink:href") || "";
        const bare = href.split("#")[1];
        if (bare) return "/items/" + bare;
    }
    return null;
}

function activePolicy(element) {
    if (!element) return null;
    if (element.querySelector(".planning-policy-mixed")) return "mixed";
    const active = element.querySelector('.planning-policy-switch button[aria-pressed="true"], .planning-policy-switch button[data-active="true"]');
    return active?.dataset.policy || null;
}

// Reads the planning tab. Returns { goals, policies, error }.
export function readPlanningTab(doc, data) {
    const byName = new Map(Object.values(data.itemDetailMap).map((item) => [item.name, item.hrid]));
    const goals = [];
    for (const row of doc.querySelectorAll(".planning-goal")) {
        const enabled = row.querySelector('input[type="checkbox"]')?.checked !== false;
        const id = row.querySelector(".planning-goal-current")?.dataset.goalId || "";
        const match = id.match(/^(house|item):(.+)$/);
        const target = Math.floor(Number(row.querySelector('input[type="number"]')?.value));
        if (!enabled || !match || !(target > 0)) continue;
        goals.push({ kind: match[1], hrid: match[2], target });
    }
    const policies = new Map();
    for (const row of doc.querySelectorAll(".planning-step")) {
        const summary = row.querySelector(":scope > summary") || row;
        const hrid = itemFromIcon(summary.querySelector(".planning-row-icon")) || byName.get(summary.querySelector(".planning-step-name")?.textContent.trim());
        const policy = activePolicy(summary);
        if (hrid && policy) policies.set(hrid, policy);
    }
    let error = null;
    if (!goals.length) error = "No active goals found in the MWITools planning tab.";
    else if (!policies.size) error = "Press “Calculate Step 2” in the MWITools planning tab first, so the production choices are shown.";
    return { goals, policies, error };
}

export function inventoryCounts(items) {
    const counts = new Map();
    for (const item of items.values ? items.values() : items) {
        if (item.itemLocationHrid !== INVENTORY || (item.enhancementLevel || 0) !== 0) continue;
        counts.set(item.itemHrid, (counts.get(item.itemHrid) || 0) + item.count);
    }
    return counts;
}

// The production action that makes an item (not alchemy or enhancing).
const actionsCache = new WeakMap();
export function productionActions(data) {
    if (actionsCache.has(data)) return actionsCache.get(data);
    const byItem = new Map();
    const actions = Object.values(data.actionDetailMap)
        .filter((action) => action.function === "/action_functions/production" && action.outputItems?.length)
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    for (const action of actions) {
        const hrid = action.outputItems[0].itemHrid;
        if (!byItem.has(hrid)) byItem.set(hrid, action);
    }
    actionsCache.set(data, byItem);
    return byItem;
}

// The gathering action that yields the most of each item per action, with the
// mean and variance of that yield (a drop chance times an even spread of counts).
const gatherCache = new WeakMap();
export function gatheringSources(data) {
    if (gatherCache.has(data)) return gatherCache.get(data);
    const byItem = new Map();
    const actions = Object.values(data.actionDetailMap)
        .filter((action) => action.function === "/action_functions/gathering")
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    for (const action of actions) {
        for (const drop of action.dropTable || []) {
            const p = drop.dropRate ?? 1;
            const low = drop.minCount ?? 1;
            const high = drop.maxCount ?? low;
            const spread = (high + low) / 2;
            const mean = p * spread;
            const variance = p * (((high - low + 1) ** 2 - 1) / 12 + spread ** 2) - mean ** 2;
            const best = byItem.get(drop.itemHrid);
            if (mean > 0 && (!best || mean > best.mean)) byItem.set(drop.itemHrid, { action, mean, variance });
        }
    }
    gatherCache.set(data, byItem);
    return byItem;
}

// Actions to queue so the gathered amount covers the need about nine times in
// ten (normal approximation). Gathering bonuses such as teas only add to it.
const SAFETY_Z = 1.28;
export function gatherCount(need, { mean, variance }) {
    let count = Math.max(1, Math.ceil(need / mean - 1e-9));
    while (count * mean - SAFETY_Z * Math.sqrt(count * variance) < need - 1e-9) count++;
    return count;
}

function inputsOf(action) {
    const inputs = (action.inputItems || []).map((input) => ({ hrid: input.itemHrid, count: input.count }));
    if (action.upgradeItemHrid) inputs.push({ hrid: action.upgradeItemHrid, count: 1 });
    return inputs;
}

// What the goals ask for: house upgrade costs from the current level, or items.
function goalDemand(goals, data, houseLevels) {
    const name = (hrid) => data.itemDetailMap[hrid]?.name || hrid.split("/").pop();
    const demand = new Map();
    const add = (hrid, count) => demand.set(hrid, (demand.get(hrid) || 0) + count);
    const titles = [];
    for (const goal of goals) {
        if (goal.kind === "house") {
            const room = data.houseRoomDetailMap?.[goal.hrid];
            const current = houseLevels[goal.hrid] || 0;
            titles.push(`${room?.name || goal.hrid.split("/").pop()} → ${goal.target}`);
            for (let level = current + 1; level <= goal.target; level++) {
                for (const cost of room?.upgradeCostsMap?.[level] || []) add(cost.itemHrid, cost.count);
            }
        } else {
            titles.push(`${name(goal.hrid)} ×${goal.target}`);
            add(goal.hrid, goal.target);
        }
    }
    return { demand, titles };
}

// Follows the demand down the recipes. produced(hrid) says whether an item is
// made (its inputs are then needed too) or bought. Returns the items with inputs
// before what is made from them, and per item { hrid, name, wanted, have, need,
// action?, count? }.
function resolve(goalItems, produced, actions, owned, name) {
    const demand = new Map(goalItems);
    const add = (hrid, count) => demand.set(hrid, (demand.get(hrid) || 0) + count);

    // Inputs before the things made from them (depth-first post-order).
    const order = [];
    const seen = new Set();
    const visit = (hrid) => {
        if (seen.has(hrid)) return;
        seen.add(hrid);
        if (produced(hrid)) for (const input of inputsOf(actions.get(hrid))) visit(input.hrid);
        order.push(hrid);
    };
    for (const hrid of demand.keys()) visit(hrid);

    // Consumers first, so every item knows its full demand before it is made.
    const rows = new Map();
    for (const hrid of [...order].reverse()) {
        const wanted = demand.get(hrid) || 0;
        const have = owned.get(hrid) || 0;
        const need = Math.max(0, wanted - have);
        const row = { hrid, name: name(hrid), wanted, have, need };
        if (produced(hrid)) {
            const action = actions.get(hrid);
            const perAction = action.outputItems[0].count || 1;
            row.action = action;
            row.count = Math.ceil(need / perAction - 1e-9);
            for (const input of inputsOf(action)) add(input.hrid, row.count * input.count);
        }
        rows.set(hrid, row);
    }
    return { order, rows };
}

// goals: [{kind:"house"|"item", hrid, target}], policies: Map itemHrid -> policy,
// owned: Map itemHrid -> count, houseLevels: {roomHrid: level}, skills: {skillHrid: level}.
export function buildTrain({ goals, policies }, data, { owned, houseLevels = {}, skills = {} }) {
    const actions = productionActions(data);
    const name = (hrid) => data.itemDetailMap[hrid]?.name || hrid.split("/").pop();
    const warnings = [];
    const { demand, titles } = goalDemand(goals, data, houseLevels);

    const produced = (hrid) => PRODUCE.has(policies.get(hrid)) && actions.has(hrid);
    for (const [hrid, policy] of policies) {
        if (policy === "mixed") warnings.push(`${name(hrid)} has different choices per goal; the train makes all of it.`);
        if (PRODUCE.has(policy) && !actions.has(hrid)) warnings.push(`${name(hrid)} has no production action; get it yourself.`);
    }
    const { order, rows } = resolve(demand, produced, actions, owned, name);

    const height = new Map();
    const heightOf = (hrid) => {
        if (height.has(hrid)) return height.get(hrid);
        const row = rows.get(hrid);
        const value = row?.action ? 1 + Math.max(0, ...inputsOf(row.action).map((input) => heightOf(input.hrid))) : 0;
        height.set(hrid, value);
        return value;
    };
    const madeRows = order.map((hrid) => rows.get(hrid)).filter((row) => row.action);
    const stops = madeRows
        .filter((row) => row.count > 0)
        .sort((a, b) => heightOf(a.hrid) - heightOf(b.hrid) || a.action.type.localeCompare(b.action.type) || (a.action.sortIndex ?? 0) - (b.action.sortIndex ?? 0))
        .map((row) => {
            const required = row.action.levelRequirement;
            return {
                itemHrid: row.hrid,
                name: row.name,
                actionHrid: row.action.hrid,
                actionName: row.action.name,
                skill: row.action.type.split("/").pop(),
                category: row.action.category,
                count: row.count,
                output: row.count * (row.action.outputItems[0].count || 1),
                need: row.need,
                levelRequired: required?.level || 0,
                level: skills[required?.skillHrid] ?? null,
                skillHrid: required?.skillHrid || null,
            };
        });
    const covered = madeRows.filter((row) => row.count === 0).map((row) => row.name);
    const shortages = order
        .map((hrid) => rows.get(hrid))
        .filter((row) => !row.action && row.need > 0)
        .map((row) => ({ itemHrid: row.hrid, name: row.name, need: Math.ceil(row.need - 1e-9), buy: policies.get(row.hrid) === "buy" }));
    // Raw materials that can be gathered: gathered by default where the level allows.
    const sources = gatheringSources(data);
    const gather = shortages
        .filter((shortage) => sources.has(shortage.itemHrid))
        .map((shortage) => {
            const { action, mean, variance } = sources.get(shortage.itemHrid);
            const required = action.levelRequirement;
            const level = skills[required?.skillHrid] ?? null;
            const count = gatherCount(shortage.need, { mean, variance });
            return {
                itemHrid: shortage.itemHrid,
                name: shortage.name,
                actionHrid: action.hrid,
                actionName: action.name,
                skill: action.type.split("/").pop(),
                category: action.category,
                count,
                output: Math.round(count * mean),
                need: shortage.need,
                levelRequired: required?.level || 0,
                level,
                skillHrid: required?.skillHrid || null,
                gather: true,
                on: level !== null && level >= (required?.level || 0),
            };
        });
    return { title: titles.join(", "), stops, gather, covered, shortages, warnings };
}

// The stops in train order: the raw materials to gather first, then production.
// train.made holds the production stops; trains saved before gathering existed
// only have train.stops.
export function trainStops(train) {
    return [...(train.gather || []).filter((item) => item.on), ...(train.made || train.stops)];
}

// What is left to buy: the shortages minus what is gathered.
export function toBuy(train) {
    const gathered = new Set((train.gather || []).filter((item) => item.on).map((item) => item.itemHrid));
    return train.shortages.filter((shortage) => !gathered.has(shortage.itemHrid));
}

// ----- material costs ----------------------------------------------------------

const COIN = "/items/coin";

// Market cost of everything that has to be bought. price(hrid) is coins per
// item, or null when nobody sells it. Coins themselves are left out: they cost
// the same whichever way the materials are sourced.
function boughtCost(rows, price) {
    let coins = 0;
    const unpriced = [];
    for (const row of rows.values()) {
        if (row.action || row.need <= 0 || row.hrid === COIN) continue;
        const each = price(row.hrid);
        if (each === null || each === undefined) unpriced.push(row.name);
        else coins += Math.ceil(row.need - 1e-9) * each;
    }
    return { coins, unpriced };
}

// The whole plan sourced four ways: the planning tab's own choices, everything
// bought ready-made, every goal item made from bought inputs (one step), and
// everything made down to raw materials (full chain). Inventory is shared
// across the plan, as in the train. Also returns how many of each item the
// plan wants with the current choices.
export function planCosts({ goals, policies }, data, { owned, houseLevels = {}, price }) {
    const actions = productionActions(data);
    const name = (hrid) => data.itemDetailMap[hrid]?.name || hrid.split("/").pop();
    const { demand } = goalDemand(goals, data, houseLevels);
    const run = (produced) => resolve(demand, produced, actions, owned, name).rows;
    const current = run((hrid) => PRODUCE.has(policies.get(hrid)) && actions.has(hrid));
    const wanted = new Map([...current.values()].map((row) => [row.hrid, row.wanted]));
    return {
        wanted,
        current: boughtCost(current, price),
        buy: boughtCost(run(() => false), price),
        single: boughtCost(run((hrid) => demand.has(hrid) && actions.has(hrid)), price),
        chain: boughtCost(run((hrid) => actions.has(hrid)), price),
    };
}

// One item on its own: bought, made from bought inputs, or made down to raw
// materials. single and chain are null when the item has no recipe.
export function itemCosts(hrid, count, data, { owned, price }) {
    const actions = productionActions(data);
    const name = (h) => data.itemDetailMap[h]?.name || h.split("/").pop();
    const run = (produced) => boughtCost(resolve(new Map([[hrid, count]]), produced, actions, owned, name).rows, price);
    const craftable = actions.has(hrid);
    return {
        buy: run(() => false),
        single: craftable ? run((h) => h === hrid) : null,
        chain: craftable ? run((h) => actions.has(h)) : null,
    };
}
