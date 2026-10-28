// Listens to the game's WebSocket and keeps a copy of the parts of the
// character that matter for combat and skilling: skills, equipment, inventory, abilities,
// consumable slots, triggers, house rooms, achievements and buffs.

const INTERESTING = new RegExp(
    '"type":"(' +
        [
            "init_character_data",
            "items_updated",
            "action_completed",
            "abilities_updated",
            "skills_updated",
            "character_stats_updated",
            "action_type_consumable_slots_updated",
            "all_combat_triggers_updated",
            "combat_triggers_updated",
            "actions_updated",
            "achievements_updated",
            "community_buffs_updated",
            "moo_pass_buffs_updated",
            "personal_buffs_updated",
            "guild_buffs_updated",
            "house_rooms_updated",
            "achievement_buffs_updated",
            "consumable_buffs_updated",
            "equipment_buffs_updated",
            "market_listings_updated",
            "market_item_order_books_updated",
        ].join("|") +
        ')"'
);

// The buffs the game keeps per action type (skilling speed, efficiency, XP...).
// Any of these messages can carry any of the maps.
const BUFF_MAPS = [
    "mooPassActionTypeBuffsMap",
    "communityActionTypeBuffsMap",
    "houseActionTypeBuffsMap",
    "guildActionTypeBuffsMap",
    "achievementActionTypeBuffsMap",
    "consumableActionTypeBuffsMap",
    "equipmentActionTypeBuffsMap",
    "personalActionTypeBuffsMap",
];

const listeners = new Set();

// Order books arrive only when the player opens an item on the market, so the
// last ones seen are kept across reloads for a day.
const BOOKS_KEY = "mwia-order-books";
const BOOK_MAX_AGE_MS = 24 * 3600 * 1000;
const MAX_BOOKS = 150;

function loadOrderBooks() {
    try {
        const saved = JSON.parse(localStorage.getItem(BOOKS_KEY) || "{}");
        return new Map(Object.entries(saved).filter(([, book]) => Date.now() - book.at < BOOK_MAX_AGE_MS));
    } catch {
        return new Map();
    }
}

function saveOrderBooks() {
    const newest = [...state.orderBooks].sort((a, b) => b[1].at - a[1].at).slice(0, MAX_BOOKS);
    state.orderBooks = new Map(newest);
    try {
        localStorage.setItem(BOOKS_KEY, JSON.stringify(Object.fromEntries(newest)));
    } catch {
        // kept for this session only
    }
}

const normalizeOrder = (order) =>
    Array.isArray(order)
        ? { price: Number(order[0]) || 0, quantity: Number(order[1]) || 0 }
        : { price: Number(order?.price) || 0, quantity: Number(order?.quantity ?? (order?.orderQuantity ?? 0) - (order?.filledQuantity ?? 0)) || 0 };

// The game sends one book per +level (orderBooks[level]) and each level's
// tradable range (priceBandMins / priceBandMaxs by level). +0's asks and bids
// sit on the entry itself; other levels with orders under levels.
function applyOrderBook(data) {
    const payload = data.marketItemOrderBooks ?? data;
    if (!payload.itemHrid || !payload.orderBooks) return;
    const sides = (book) => ({
        asks: (book?.asks || []).map(normalizeOrder).filter((o) => o.quantity > 0),
        bids: (book?.bids || []).map(normalizeOrder).filter((o) => o.quantity > 0),
    });
    const levels = {};
    const seen = [];
    for (const [level, book] of Object.entries(payload.orderBooks)) {
        if (!book) continue;
        seen.push(Number(level));
        const both = sides(book);
        if (Number(level) > 0 && (both.asks.length || both.bids.length)) levels[Number(level)] = both;
    }
    const bands = {};
    for (const level of new Set([...Object.keys(payload.priceBandMins || {}), ...Object.keys(payload.priceBandMaxs || {})])) {
        const max = Number(payload.priceBandMaxs?.[level]) || 0;
        bands[Number(level)] = { min: Number(payload.priceBandMins?.[level]) || 0, max: max > 0 ? max : null };
    }
    state.orderBooks.set(payload.itemHrid, { at: Date.now(), ...sides(payload.orderBooks[0] ?? payload.orderBooks["0"]), levels, seen, bands });
    saveOrderBooks();
}

// One +level's order book: { at, asks, bids, range: { min, max } | null }, or
// null when the item hasn't been opened on the market, or the game sent no
// book for that +level (an empty book means nobody is at that level).
export function orderBookAt(itemHrid, level = 0) {
    const entry = state.orderBooks.get(itemHrid);
    if (!entry || (level && !entry.seen?.includes(level))) return null;
    const both = level ? entry.levels[level] || { asks: [], bids: [] } : entry;
    const band = entry.bands?.[level];
    return { at: entry.at, asks: both.asks, bids: both.bids, range: band ? { min: band.min, max: band.max ?? Infinity } : null };
}

const listingDone = (listing) =>
    !!(listing.isDone || listing.isCancelled || listing.isCanceled || listing.isExpired) || /(cancel|complete|expire|closed|done)/i.test(String(listing.status ?? ""));

// The player's own market orders: a full list, or only the changed ones.
function applyListings(data) {
    const full = data.myMarketListings ?? data.marketListings;
    if (Array.isArray(full)) {
        state.character.myMarketListings = full.filter((listing) => !listingDone(listing));
        return;
    }
    const listings = [...(state.character.myMarketListings || [])];
    for (const listing of data.endMarketListings || []) {
        const index = listings.findIndex((other) => other.id === listing.id);
        if (index >= 0) listings.splice(index, 1);
        if (!listingDone(listing)) listings.push(listing);
    }
    state.character.myMarketListings = listings;
}

export const state = {
    character: null, // the latest init_character_data, patched by later messages
    items: new Map(), // hash/id -> character item
    orderBooks: loadOrderBooks(), // itemHrid -> { at, asks, bids (+0), levels: { level: { asks, bids } }, seen: [levels sent], bands: { level: { min, max } } }, from viewing it on the market
    updatedAt: 0,
};

export function onStateChange(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function itemKey(item) {
    if (item.hash) return "h:" + item.hash;
    if (item.id !== undefined && item.id !== null) return "i:" + item.id;
    return `x:${item.itemHrid}:${item.itemLocationHrid}:${item.enhancementLevel || 0}`;
}

function applyItems(updates) {
    for (const item of updates || []) {
        if (!item) continue;
        const key = itemKey(item);
        if (item.count === 0) state.items.delete(key);
        else state.items.set(key, item.hash ? item : { ...(state.items.get(key) || {}), ...item });
    }
}

function mergeAbilities(updates) {
    if (!state.character || !Array.isArray(updates)) return;
    const abilities = [...(state.character.characterAbilities || [])];
    for (const updated of updates) {
        const index = abilities.findIndex((a) => a.abilityHrid === updated.abilityHrid);
        if (index === -1) abilities.push(updated);
        else abilities[index] = updated;
    }
    state.character.characterAbilities = abilities;
}

function mergeSkills(updates) {
    if (!state.character || !Array.isArray(updates)) return;
    const skills = state.character.characterSkills || [];
    for (const updated of updates) {
        const skill = skills.find((s) => s.skillHrid === updated.skillHrid);
        if (skill) Object.assign(skill, updated);
        else skills.push(updated);
    }
    state.character.characterSkills = skills;
}

function mergeActions(updates) {
    if (!state.character || !Array.isArray(updates)) return;
    let actions = [...(state.character.characterActions || [])];
    for (const action of updates) {
        actions = actions.filter((a) => a.id !== action.id);
        if (!action.isDone) actions.push(action);
    }
    actions.sort((a, b) => (a.ordinal ?? 0) - (b.ordinal ?? 0));
    state.character.characterActions = actions;
}

function copyFields(data, fields) {
    for (const field of fields) {
        if (data[field] !== undefined) state.character[field] = data[field];
    }
}

function handle(data) {
    if (data.type === "init_character_data") {
        state.character = data;
        state.items = new Map();
        applyItems(data.characterItems);
    } else if (data.type === "market_item_order_books_updated") {
        applyOrderBook(data);
    } else if (!state.character) {
        return;
    } else {
        switch (data.type) {
            case "items_updated":
                applyItems(data.endCharacterItems);
                break;
            case "action_completed":
                applyItems(data.endCharacterItems);
                mergeSkills(data.endCharacterSkills);
                mergeAbilities(data.endCharacterAbilities);
                break;
            case "abilities_updated":
                mergeAbilities(data.endCharacterAbilities);
                break;
            case "skills_updated":
                if (data.characterSkills) state.character.characterSkills = data.characterSkills;
                mergeSkills(data.endCharacterSkills);
                break;
            case "character_stats_updated":
                copyFields(data, ["combatUnit", "noncombatStats"]);
                break;
            case "action_type_consumable_slots_updated":
                copyFields(data, ["actionTypeFoodSlotsMap", "actionTypeDrinkSlotsMap", ...BUFF_MAPS]);
                break;
            case "all_combat_triggers_updated":
                copyFields(data, ["abilityCombatTriggersMap", "consumableCombatTriggersMap"]);
                break;
            case "combat_triggers_updated":
                if (data.combatTriggerTypeHrid === "/combat_trigger_types/ability" && data.abilityHrid) {
                    state.character.abilityCombatTriggersMap = {
                        ...(state.character.abilityCombatTriggersMap || {}),
                        [data.abilityHrid]: data.combatTriggers,
                    };
                } else if (data.itemHrid) {
                    state.character.consumableCombatTriggersMap = {
                        ...(state.character.consumableCombatTriggersMap || {}),
                        [data.itemHrid]: data.combatTriggers,
                    };
                }
                break;
            case "house_rooms_updated":
                copyFields(data, ["characterHouseRoomMap", ...BUFF_MAPS]);
                break;
            case "market_listings_updated":
                applyListings(data);
                break;
            case "actions_updated":
                mergeActions(data.endCharacterActions);
                break;
            case "achievements_updated":
                copyFields(data, ["characterAchievements"]);
                break;
            case "community_buffs_updated":
            case "moo_pass_buffs_updated":
            case "personal_buffs_updated":
            case "guild_buffs_updated":
            case "achievement_buffs_updated":
            case "consumable_buffs_updated":
            case "equipment_buffs_updated":
                copyFields(data, BUFF_MAPS);
                break;
        }
    }
    state.updatedAt = Date.now();
    for (const listener of listeners) {
        try {
            listener(data.type, data);
        } catch (error) {
            console.error("[MWI Advisor]", error);
        }
    }
}

function onMessage(event) {
    const raw = event.data;
    if (typeof raw !== "string" || !INTERESTING.test(raw)) return;
    try {
        handle(JSON.parse(raw));
    } catch (error) {
        console.error("[MWI Advisor] Could not parse message", error);
    }
}

function isGameSocket(url) {
    return /milkywayidle(cn)?\.com\/ws/.test(String(url));
}

// Must run before the game opens its socket (userscript @run-at document-start).
export function installSocketHook(win) {
    const NativeWebSocket = win.WebSocket;
    if (!NativeWebSocket || NativeWebSocket.__mwiaHooked) return;
    const Hooked = new Proxy(NativeWebSocket, {
        construct(target, args, newTarget) {
            const socket = Reflect.construct(target, args, newTarget === Hooked ? target : newTarget);
            if (isGameSocket(args[0])) socket.addEventListener("message", onMessage);
            return socket;
        },
        get(target, property, receiver) {
            if (property === "__mwiaHooked") return true;
            return Reflect.get(target, property, target);
        },
    });
    win.WebSocket = Hooked;
}
