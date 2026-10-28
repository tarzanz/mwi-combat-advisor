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

// Every action window on screen (skilling or combat), with its name and the Start buttons.
export function openActionPanels() {
    const panels = [];
    for (const name of document.querySelectorAll(PANEL_NAME)) {
        if (!visible(name)) continue;
        const panel = name.closest(PANEL) || name.parentElement;
        if (panel) panels.push({ panel, name: clean(name.textContent), buttons: panel.querySelector(BUTTONS) });
    }
    return panels;
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
    return callReactHandler(NAV_HANDLERS, [actionHrid]);
}

// Calls the first of the named methods found on the game's React components.
function callReactHandler(names, args) {
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
        for (const handler of names) {
            if (instance && typeof instance[handler] === "function") {
                try {
                    instance[handler](...args);
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

// ---------- Enhancing and Alchemy ----------
// The game opens these with an inventory item already in the slot through its
// own handlers (the item menu's Enhance / Alchemize). The item's key is
// "<character id>::/item_locations/inventory::<item>::<+level>".

const ENHANCING_PANEL = '[class*="SkillActionDetail_enhancingComponent"]';
const ALCHEMY_PANEL = '[class*="SkillActionDetail_alchemyComponent"]';

export const inventoryItemHash = (characterId, itemHrid, level = 0) => `${characterId}::/item_locations/inventory::${itemHrid}::${level}`;

// The React component behind an element that has the named method.
function componentWith(element, method) {
    for (const node of element ? [element, ...element.querySelectorAll("input, button, select")] : []) {
        const key = Object.getOwnPropertyNames(node).find((k) => /^__react(Fiber|InternalInstance)\$/.test(k));
        for (let fiber = key ? node[key] : null, steps = 0; fiber && steps < 60; fiber = fiber.return, steps++) {
            if (typeof fiber.stateNode?.[method] === "function") return fiber.stateNode;
        }
    }
    return null;
}

async function waitFor(find, timeoutMs) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        const found = find();
        if (found || Date.now() > deadline) return found || null;
        await sleep(100);
    }
}

const visiblePanel = (selector) => [...document.querySelectorAll(selector)].find(visible) || null;

// The Enhancing and Alchemy windows on screen: the item in the slot, the
// target set (Enhancing) and the selected tab (Alchemy), as the game holds them.
export function levelingPanels() {
    const out = [];
    for (const [kind, selector, method] of [["enhancing", ENHANCING_PANEL, "enhancingMaxLevelChanged"], ["alchemy", ALCHEMY_PANEL, "selectAlchemyItemHandler"]]) {
        for (const panel of document.querySelectorAll(selector)) {
            if (!visible(panel)) continue;
            const held = componentWith(panel, method)?.state || {};
            const tab = kind === "alchemy" ? [...document.querySelectorAll(TABS)].find((t) => visible(t) && t.getAttribute("aria-selected") === "true" && /^(Coinify|Decompose|Transmute)$/.test(clean(t.textContent))) : null;
            out.push({ panel, kind, itemHash: held.primaryItemHash || null, target: held.enhancingMaxLevel ?? null, tab: tab ? clean(tab.textContent) : null, buttons: panel.querySelector(BUTTONS) });
        }
    }
    return out;
}

// Opens Enhancing with the item (one you have at +0) and the target level set.
// Without the item in the inventory it only opens the Enhancing page. Returns
// "item", "page" or false.
export async function openEnhancing(itemHash, target, timeoutMs = 4000) {
    lastDiagnostics = "";
    const called = itemHash ? callReactHandler(["handleEnhanceItem"], [itemHash]) : "no item";
    if (!/called/.test(called)) {
        const link = clickSkill("enhancing");
        lastDiagnostics = `${called} · ${link ? "opened the Enhancing page" : "no Enhancing link"}`;
        return link ? "page" : false;
    }
    const panel = await waitFor(() => visiblePanel(ENHANCING_PANEL), timeoutMs);
    const component = panel && (await waitFor(() => componentWith(panel, "enhancingMaxLevelChanged"), timeoutMs));
    if (!component) {
        lastDiagnostics = panel ? "enhancing panel without its component" : "no enhancing panel";
        return panel ? "page" : false;
    }
    if (component.state?.primaryItemHash !== itemHash && typeof component.selectEnhancingItemHandler === "function") component.selectEnhancingItemHandler(itemHash);
    await sleep(150);
    component.enhancingMaxLevelChanged({ target: { value: String(target) } });
    return "item";
}

// Opens Alchemy on the action's tab with the item (one you have) and the count
// set. Without the item in the inventory it only opens the tab. Returns "item",
// "page" or false.
export async function openAlchemy(itemHash, tabLabel, count, timeoutMs = 4000) {
    lastDiagnostics = "";
    const called = itemHash ? callReactHandler(["handleAlchemizeItem"], [itemHash]) : "no item";
    if (!/called/.test(called)) {
        const link = clickSkill("alchemy");
        if (link) await waitFor(() => clickTab(tabLabel), timeoutMs);
        lastDiagnostics = `${called} · ${link ? "opened the Alchemy page" : "no Alchemy link"}`;
        return link ? "page" : false;
    }
    await waitFor(() => visiblePanel(ALCHEMY_PANEL), timeoutMs);
    // A window that was already open is drawn again first; then the tab, until it is the selected one.
    await sleep(300);
    const selected = () => [...document.querySelectorAll(TABS)].some((tab) => visible(tab) && clean(tab.textContent) === tabLabel && tab.getAttribute("aria-selected") === "true");
    await waitFor(() => (clickTab(tabLabel), selected()), timeoutMs);
    await sleep(150);
    const panel = await waitFor(() => visiblePanel(ALCHEMY_PANEL), timeoutMs);
    const component = panel && (await waitFor(() => componentWith(panel, "selectAlchemyItemHandler"), timeoutMs));
    if (!component) {
        lastDiagnostics = panel ? "alchemy panel without its component" : "no alchemy panel";
        return panel ? "page" : false;
    }
    if (component.state?.primaryItemHash !== itemHash) component.selectAlchemyItemHandler(itemHash);
    await sleep(150);
    if (count > 0 && typeof component.maxActionCountChanged === "function") component.maxActionCountChanged({ target: { value: String(count) } });
    return "item";
}

// Opens the marketplace on an item: through MWITools' public API when it is
// installed, else the game's own "go to marketplace" handler.
export function openMarketplace(win, itemHrid, level = 0) {
    try {
        const api = win.MWITools?.shopping;
        if (typeof api?.openMarketplace === "function" && api.openMarketplace(itemHrid, level)) return true;
    } catch {
        // fall back to the game's handler
    }
    return /called/.test(callReactHandler(["handleGoToMarketplace"], [itemHrid, level]));
}
