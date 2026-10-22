// Finding and opening production actions in the game's own UI. The selectors
// follow the game's CSS-module class names (the same ones MWITools relies on).
// Nothing here queues anything: the player still clicks the game's buttons.

const NAV_LINK = '[class*="NavigationBar_navigationLink"]';
const ACTION_CARD = '[class*="SkillAction_skillAction"]';
const ACTION_CARD_NAME = '[class*="SkillAction_name"]';
const PANEL = 'div[class*="SkillActionDetail_regularComponent"],div[class*="SkillActionDetail_skillActionDetail"]';
const PANEL_NAME = 'div[class*="SkillActionDetail_name"]';
const COUNT_INPUT = 'div[class*="SkillActionDetail_maxActionCountInput"] input';
const BUTTONS = '[class*="SkillActionDetail_buttonsContainer"]';
const TABS = '[role="tab"],[class*="TabsComponent_tab"],[class*="Tab_tab"]';
const NAV_HANDLERS = [
    "handleGoToActionTypeDetail",
    "handleClickActionTypeDetail",
    "handleGoToActionType",
    "handleSelectActionType",
    "handleGoToActionDetail",
    "handleSelectAction",
    "handleClickAction",
    "handleGoToAction",
];

// What the last failed openAction saw, so a player without developer tools can report it.
let lastDiagnostics = "";
export function navDiagnostics() {
    return lastDiagnostics;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const clean = (text) => String(text || "").replace(/\s+/g, " ").trim();

export function visible(element) {
    if (!element?.isConnected || element.hidden) return false;
    const style = getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && element.getClientRects().length > 0;
}

const iconHref = (use) => use.getAttribute("href") || use.getAttribute("xlink:href") || "";

function iconIds(element) {
    return [...element.querySelectorAll("use")].map((use) => iconHref(use).split("#")[1] || "");
}

function describe(element) {
    const classes = String(element.className?.baseVal ?? element.className ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2);
    return [element.tagName.toLowerCase(), ...classes].join(".");
}

// The navigation bar as the script sees it, and where the skill's icon really sits.
function navReport(skill) {
    const links = [...document.querySelectorAll(NAV_LINK)];
    const parts = [`nav links: ${links.length} (${links.filter(visible).length} visible)`];
    if (links.length) parts.push("icons: " + links.map((link) => iconIds(link).join("+") || "?").join(","));
    const icons = [...document.querySelectorAll("use")].filter((use) => iconHref(use).endsWith("#" + skill));
    if (icons.length) {
        const chain = [];
        for (let node = icons[0].parentElement; node && node !== document.body && chain.length < 6; node = node.parentElement) chain.push(describe(node));
        parts.push(`#${skill} icons: ${icons.length}, first ${iconHref(icons[0])} in ${chain.join(" < ")}`);
    } else parts.push(`no #${skill} icon on page`);
    return parts;
}

function screenReport(categoryName) {
    const cards = [...document.querySelectorAll(ACTION_CARD)].filter(visible);
    const tabs = [...document.querySelectorAll(TABS)].filter(visible).map((tab) => clean(tab.textContent));
    return [
        `cards: ${cards.length}` + (cards.length ? " (" + cards.slice(0, 6).map((card) => clean(card.querySelector(ACTION_CARD_NAME)?.textContent) || "?").join(", ") + ")" : ""),
        `tabs: ${tabs.length}` + (tabs.length ? " (" + tabs.slice(0, 10).join(", ") + ")" : ""),
        `tab "${categoryName}": ${tabs.includes(categoryName) ? "found" : "missing"}`,
        `panel names: ${[...document.querySelectorAll(PANEL_NAME)].filter(visible).map((name) => clean(name.textContent)).join(", ") || "none"}`,
    ];
}

// The open action panel for this action, if the player has it on screen.
export function findActionPanel(actionName) {
    for (const name of document.querySelectorAll(PANEL_NAME)) {
        if (!visible(name) || clean(name.textContent) !== actionName) continue;
        const panel = name.closest(PANEL) || name.parentElement;
        const input = panel?.querySelector(COUNT_INPUT);
        if (input) return { panel, input, buttons: panel.querySelector(BUTTONS) };
    }
    return null;
}

// Sets a React-controlled input the way a keystroke would.
export function setReactInput(input, value) {
    const previous = input.value;
    const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), "value")?.set;
    if (setter) setter.call(input, String(value));
    else input.value = String(value);
    input._valueTracker?.setValue(previous);
    input.dispatchEvent(new Event("input", { bubbles: true }));
}

function clickCard(action, itemId) {
    const card = [...document.querySelectorAll(ACTION_CARD)].filter(visible).find((candidate) => {
        const name = clean(candidate.querySelector(ACTION_CARD_NAME)?.textContent);
        return name === action.name || (itemId && iconIds(candidate).includes(itemId));
    });
    card?.click();
    return !!card;
}

function clickTab(label) {
    if (!label) return false;
    const tab = [...document.querySelectorAll(TABS)].filter(visible).find((candidate) => clean(candidate.textContent) === label);
    if (!tab) return false;
    if (tab.getAttribute("aria-selected") !== "true") tab.click();
    return true;
}

// The selector also matches the container around all the links (and around
// groups of links), which holds every icon; only a link without links inside counts.
function clickSkill(skill) {
    const link = [...document.querySelectorAll(NAV_LINK)].find((candidate) => !candidate.querySelector(NAV_LINK) && iconIds(candidate).includes(skill));
    link?.click();
    return link || null;
}

// Last resort: the game's own navigation handlers on its React components.
// Returns what happened, for the diagnostics.
function callGameHandler(win, actionHrid) {
    const fibers = [];
    const root = document.getElementById("root");
    for (const element of [root, document.querySelector('[class*="GamePage_gamePage"]')]) {
        for (const key of Object.getOwnPropertyNames(element || {})) {
            if (/^__react(Container|Fiber|InternalInstance)\$/.test(key)) fibers.push(element[key]?.current ?? element[key]);
        }
    }
    const roots = fibers.length;
    const visited = new Set();
    while (fibers.length && visited.size < 50000) {
        const fiber = fibers.pop();
        if (!fiber || visited.has(fiber)) continue;
        visited.add(fiber);
        const instance = fiber.stateNode;
        for (const handler of NAV_HANDLERS) {
            if (instance && typeof instance[handler] === "function") {
                try {
                    instance[handler](actionHrid);
                    return `react: ${handler} called`;
                } catch {
                    // try the next one
                }
            }
        }
        if (fiber.return) fibers.push(fiber.return);
        if (fiber.child) fibers.push(fiber.child);
        if (fiber.sibling) fibers.push(fiber.sibling);
    }
    return `react: no handler (roots ${roots}, fibers ${visited.size})`;
}

// Opens the action's panel: skill page, category tab, action card. Resolves
// true once the panel is on screen.
export async function openAction(win, action, data, timeoutMs = 4000) {
    lastDiagnostics = "";
    if (findActionPanel(action.name)) return true;
    const itemId = action.outputItems?.[0]?.itemHrid?.split("/").pop();
    const skill = action.type.split("/").pop();
    const categoryName = data.actionCategoryDetailMap?.[action.category]?.name;
    const report = [];
    if (!clickCard(action, itemId)) {
        const link = clickSkill(skill);
        report.push(...navReport(skill), link ? `clicked ${describe(link)}` : `no nav link with #${skill}`);
        const deadline = Date.now() + timeoutMs;
        let clicked = false;
        while (!clicked && Date.now() < deadline) {
            await sleep(120);
            clicked = clickCard(action, itemId) || (clickTab(categoryName) && (await sleep(120), clickCard(action, itemId)));
        }
        if (!clicked) report.push(...screenReport(categoryName), callGameHandler(win, action.hrid));
    } else report.push("card was on screen and clicked");
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (findActionPanel(action.name)) return true;
        await sleep(100);
    }
    report.push(`no panel for "${action.name}"`);
    lastDiagnostics = report.join(" · ");
    return false;
}
