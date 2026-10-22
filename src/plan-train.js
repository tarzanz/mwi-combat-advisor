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
export function productionActions(data) {
    const byItem = new Map();
    const actions = Object.values(data.actionDetailMap)
        .filter((action) => action.function === "/action_functions/production" && action.outputItems?.length)
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
    for (const action of actions) {
        const hrid = action.outputItems[0].itemHrid;
        if (!byItem.has(hrid)) byItem.set(hrid, action);
    }
    return byItem;
}

function inputsOf(action) {
    const inputs = (action.inputItems || []).map((input) => ({ hrid: input.itemHrid, count: input.count }));
    if (action.upgradeItemHrid) inputs.push({ hrid: action.upgradeItemHrid, count: 1 });
    return inputs;
}

// goals: [{kind:"house"|"item", hrid, target}], policies: Map itemHrid -> policy,
// owned: Map itemHrid -> count, houseLevels: {roomHrid: level}, skills: {skillHrid: level}.
export function buildTrain({ goals, policies }, data, { owned, houseLevels = {}, skills = {} }) {
    const actions = productionActions(data);
    const name = (hrid) => data.itemDetailMap[hrid]?.name || hrid.split("/").pop();
    const warnings = [];
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

    const produced = (hrid) => PRODUCE.has(policies.get(hrid)) && actions.has(hrid);
    for (const [hrid, policy] of policies) {
        if (policy === "mixed") warnings.push(`${name(hrid)} has different choices per goal; the train makes all of it.`);
        if (PRODUCE.has(policy) && !actions.has(hrid)) warnings.push(`${name(hrid)} has no production action; get it yourself.`);
    }

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
    return { title: titles.join(", "), stops, covered, shortages, warnings };
}
