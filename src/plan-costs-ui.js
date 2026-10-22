// Material costs in the MWITools planning tab: under each step-2 row what the
// item costs bought, made in one step or made with the full chain, and above
// the calculate bar the same for the whole plan. Lowest ask prices; what is in
// the inventory is not bought again.

import { askPrice, getClientData, loadClientData, loadPrices, pricesAge } from "./game-data.js";
import { state } from "./game-state.js";
import { esc, parseCoins, shortCoins } from "./format.js";
import { inventoryCounts, itemCosts, planCosts, readPlanningTab } from "./plan-train.js";
import { enableTapTips } from "./touch.js";

const RECOMPUTE_MS = 3000;
const RETRY_MS = 30000;
const ROW_TIP =
    "Market cost of the materials you would buy (lowest ask), after what is in your inventory. " +
    "One step: make it from bought ingredients. Full chain: make everything that has a recipe, buy only raw materials. " +
    "This row is counted on its own, so inventory shared with other rows counts here too. Artisan Tea is not counted.";
const TOTAL_TIP =
    "Market cost of the materials to buy for the whole plan (lowest ask), after what is in your inventory. " +
    "Your choices is what the plan train lists as missing materials. Coins for the upgrade itself and Artisan Tea are not counted.";

const c = { loading: false, triedAt: 0, priceError: null, signature: "", at: 0 };

function costText(cost) {
    if (!cost) return null;
    let text = shortCoins(cost.coins);
    if (cost.unpriced.length) text += " + ?";
    return text;
}

// "Buy 1.2M · One step 950k · Full chain 810k", the cheapest fully priced one marked.
function costLine(options) {
    const priced = options.filter((option) => option.cost && !option.cost.unpriced.length);
    const best = priced.length > 1 ? Math.min(...priced.map((option) => option.cost.coins)) : null;
    const unpriced = [...new Set(options.flatMap((option) => option.cost?.unpriced || []))];
    const parts = options
        .filter((option) => option.cost)
        .map((option) => {
            const cheapest = best !== null && !option.cost.unpriced.length && option.cost.coins === best;
            return `<span class="${cheapest ? "mwia-plan-cost-best" : ""}">${esc(option.label)} ${costText(option.cost)}</span>`;
        });
    let html = parts.join(" · ");
    if (unpriced.length) html += ` <span class="mwia-dim">(no price: ${esc(unpriced.join(", "))})</span>`;
    return html;
}

function place(html, existing, create) {
    const element = existing || create();
    if (element.dataset.html !== html) {
        element.dataset.html = html;
        element.innerHTML = html;
    }
}

function costElement(className, tip) {
    const element = document.createElement("div");
    element.className = className;
    element.title = tip;
    // Inside a <summary>, a tap would also open or close the row.
    element.addEventListener("click", (event) => event.preventDefault());
    enableTapTips(element);
    return element;
}

// The row's own amount when the current choices leave it out of the plan.
function shownRequired(summary) {
    const text = summary.querySelector(".planning-step-count")?.textContent || summary.textContent;
    const match = text.match(/Required\s*([\d.,]+\s*[kmb]?)/i);
    return match ? parseCoins(match[1].replace(/\s+/g, "")) : null;
}

export function showPlanCosts(win) {
    const steps = document.querySelectorAll(".planning-step");
    if (!steps.length) return;
    if (!state.character) return;
    const data = getClientData();
    if (!data || (pricesAge() === null && !c.priceError)) {
        // One attempt at a time, and not again right after a failure.
        if (!c.loading && Date.now() - c.triedAt > RETRY_MS) {
            c.loading = true;
            c.triedAt = Date.now();
            Promise.all([data || loadClientData(win), loadPrices()])
                .then(() => {
                    c.priceError = null;
                })
                .catch((error) => {
                    c.priceError = error.message;
                })
                .finally(() => {
                    c.loading = false;
                    c.at = 0;
                    if (getClientData()) showPlanCosts(win);
                });
        }
        return;
    }
    const plan = readPlanningTab(document, data);
    const signature = JSON.stringify([plan.goals, [...plan.policies], pricesAge() !== null && Date.now() - pricesAge()]);
    const fresh = signature === c.signature && Date.now() - c.at < RECOMPUTE_MS;
    const missing = [...steps].some((step) => !step.querySelector(".mwia-plan-cost")) || document.querySelector(".planning-calculate-bar") && !document.querySelector(".mwia-plan-costs");
    if (fresh && !missing) return;
    c.signature = signature;
    c.at = Date.now();

    const owned = inventoryCounts(state.items);
    const houseLevels = {};
    for (const room of Object.values(state.character.characterHouseRoomMap || {})) houseLevels[room.houseRoomHrid] = room.level;
    const price = (hrid) => askPrice(hrid);

    let totalHtml;
    let wanted = new Map();
    if (c.priceError) totalHtml = `Material cost: ${esc(c.priceError)}`;
    else if (!plan.goals.length) totalHtml = "Material cost: no active goals.";
    else {
        const totals = planCosts(plan, data, { owned, houseLevels, price });
        wanted = totals.wanted;
        totalHtml =
            "<b>Materials to buy:</b> " +
            costLine([
                { label: "your choices", cost: totals.current },
                { label: "all Buy", cost: totals.buy },
                { label: "all One step", cost: totals.single },
                { label: "all Full chain", cost: totals.chain },
            ]);
    }
    for (const stage of document.querySelectorAll(".planning-stage")) {
        const bar = stage.querySelector(".planning-calculate-bar");
        if (!bar) continue;
        place(totalHtml, stage.querySelector(".mwia-plan-costs"), () => {
            const element = costElement("mwia-plan-costs", TOTAL_TIP);
            bar.before(element);
            return element;
        });
    }

    const byName = new Map(Object.values(data.itemDetailMap).map((item) => [item.name, item.hrid]));
    for (const step of steps) {
        const summary = step.querySelector(":scope > summary") || step;
        const use = summary.querySelector(".planning-row-icon use");
        const bare = (use?.getAttribute("href") || use?.getAttribute("xlink:href") || "").split("#")[1];
        const hrid = bare ? "/items/" + bare : byName.get(summary.querySelector(".planning-step-name")?.textContent.trim());
        const count = wanted.get(hrid) || shownRequired(summary);
        let html = "";
        if (c.priceError || !hrid || !data.itemDetailMap[hrid]) html = "";
        else if (!count) html = '<span class="mwia-dim">Not needed with the current choices</span>';
        else {
            const costs = itemCosts(hrid, count, data, { owned, price });
            html = costLine([
                { label: "Buy", cost: costs.buy },
                { label: "One step", cost: costs.single },
                { label: "Full chain", cost: costs.chain },
            ]);
        }
        place(html, summary.querySelector(".mwia-plan-cost"), () => {
            const element = costElement("mwia-plan-cost", ROW_TIP);
            const policySwitch = summary.querySelector(".planning-policy-switch");
            if (policySwitch) policySwitch.after(element);
            else summary.appendChild(element);
            return element;
        });
    }
}
