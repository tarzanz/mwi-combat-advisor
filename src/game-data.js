// Static game data (from the game client itself) and market prices.

import { ENGINE_TABLES } from "./data-shim.js";

const FALLBACK_DATA_URL = "https://raw.githubusercontent.com/shykai/MWICombatSimulatorTest/dev/src/combatsimulator/data/";
const PRICE_TTL_MS = 30 * 60 * 1000;

let clientData = null;
let prices = null;
let pricesFetchedAt = 0;

function readClientData(win) {
    try {
        const util = win.localStorageUtil;
        if (util && typeof util.getInitClientData === "function") {
            const data = util.getInitClientData();
            if (data && data.itemDetailMap) return data;
        }
    } catch (error) {
        console.warn("[Combat Advisor] localStorageUtil failed", error);
    }
    return null;
}

export async function loadClientData(win) {
    if (clientData) return clientData;
    const data = readClientData(win);
    if (!data) throw new Error("Game data not found yet. Wait for the game to finish loading and try again.");
    // Any table the client does not ship is taken from the simulator's repository.
    for (const table of [...ENGINE_TABLES, "abilitySlotsLevelRequirementList"]) {
        if (data[table]) continue;
        try {
            const response = await fetch(FALLBACK_DATA_URL + table + ".json");
            if (response.ok) data[table] = await response.json();
        } catch (error) {
            console.warn("[Combat Advisor] Could not fetch", table, error);
        }
        if (!data[table]) data[table] = table === "abilitySlotsLevelRequirementList" ? [0, 1, 1, 20, 50, 90] : {};
    }
    clientData = data;
    return clientData;
}

export function getClientData() {
    return clientData;
}

export function engineTables() {
    const tables = {};
    for (const table of ENGINE_TABLES) tables[table] = clientData[table];
    return tables;
}

const priceListeners = new Set();

// Called with (marketData, timestamp) every time a fresh price file arrives.
export function onPricesLoaded(listener) {
    priceListeners.add(listener);
}

export async function loadPrices(force = false) {
    if (prices && !force && Date.now() - pricesFetchedAt < PRICE_TTL_MS) return prices;
    const response = await fetch("/game_data/marketplace.json", { cache: "no-store" });
    if (!response.ok) throw new Error("Could not fetch market prices (" + response.status + ")");
    const json = await response.json();
    prices = json.marketData || {};
    pricesFetchedAt = Date.now();
    for (const listener of priceListeners) {
        try {
            listener(prices, json.timestamp);
        } catch (error) {
            console.error("[Combat Advisor]", error);
        }
    }
    return prices;
}

export function pricesAge() {
    return pricesFetchedAt ? Date.now() - pricesFetchedAt : null;
}

// The market's { a: cheapest ask, b: best bid } for an item, or null.
export function marketEntry(itemHrid, enhancementLevel = 0) {
    return prices?.[itemHrid]?.[String(enhancementLevel)] || null;
}

// When the prices in use were fetched (changes on every refresh).
export function pricesStamp() {
    return pricesFetchedAt;
}

// Cheapest price to buy right now, or null when nobody sells it.
export function askPrice(itemHrid, enhancementLevel = 0) {
    if (itemHrid === "/items/coin") return 1;
    const entry = prices?.[itemHrid]?.[String(enhancementLevel)];
    return entry && entry.a > 0 ? entry.a : null;
}

// Every enhancement level of an item that is for sale right now, cheapest first.
export function marketListings(itemHrid) {
    return Object.entries(prices?.[itemHrid] || {})
        .filter(([, entry]) => entry.a > 0)
        .map(([level, entry]) => ({ enhancementLevel: Number(level), price: entry.a }))
        .sort((a, b) => a.price - b.price);
}

// What an item is worth when sold: best bid, else the vendor price.
export function sellValue(itemHrid) {
    if (itemHrid === "/items/coin") return 1;
    const entry = prices?.[itemHrid]?.["0"];
    if (entry && entry.b > 0) return entry.b;
    return clientData?.itemDetailMap?.[itemHrid]?.sellPrice || 0;
}

export function itemName(hrid) {
    return clientData?.itemDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
}

export function abilityName(hrid) {
    return clientData?.abilityDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
}

export function actionName(hrid) {
    return clientData?.actionDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
}

export function monsterName(hrid) {
    return clientData?.combatMonsterDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
}

export function combatZones() {
    return Object.values(clientData.actionDetailMap)
        .filter(
            (action) =>
                action.type === "/action_types/combat" &&
                !action.combatZoneInfo?.isDungeon &&
                action.combatZoneInfo?.fightInfo?.randomSpawnInfo
        )
        .sort((a, b) => a.sortIndex - b.sortIndex);
}

// Expected coin value of the loot from one kill of a monster at a difficulty
// tier. Mirrors the "no RNG" revenue in the community simulator.
export function expectedLootPerKill(monsterHrid, tier, sim) {
    const monster = clientData.combatMonsterDetailMap[monsterHrid];
    if (!monster) return 0;
    let value = 0;
    const quantity = 1 + (sim.combatDropQuantity || 0);
    for (const drop of monster.dropTable || []) {
        if (drop.minDifficultyTier > tier) continue;
        const rate = Math.min(1, (1 + 0.1 * tier) * (drop.dropRate + (drop.dropRatePerDifficultyTier ?? 0) * tier));
        if (rate <= 0) continue;
        const finalRate = Math.min(1, rate * (sim.dropRateMultiplier || 1));
        value += finalRate * ((drop.minCount + drop.maxCount) / 2) * quantity * sellValue(drop.itemHrid);
    }
    for (const drop of monster.rareDropTable || []) {
        if (drop.minDifficultyTier > tier) continue;
        const finalRate = drop.dropRate * (sim.rareFindMultiplier || 1);
        value += finalRate * ((drop.minCount + drop.maxCount) / 2) * quantity * sellValue(drop.itemHrid);
    }
    return value;
}
