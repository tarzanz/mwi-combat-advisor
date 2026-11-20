// Built from pi/combat-plan-entry.js by build.mjs – don't edit.
// Combat engine: MWICombatSimulator by AmVoidGuy / shykai (MIT licence); heap-js (BSD-3-Clause). Licences at the end of this file.
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/data-shim.js
function slot(name) {
  if (!store[name]) {
    store[name] = ARRAY_TABLES.has(name) ? [] : {};
  }
  return store[name];
}
function fill(data) {
  for (const [name, value] of Object.entries(data)) {
    const target = slot(name);
    if (Array.isArray(target)) {
      target.length = 0;
      target.push(...value);
    } else {
      for (const key of Object.keys(target)) delete target[key];
      Object.assign(target, value);
    }
  }
}
var ARRAY_TABLES, store, ENGINE_TABLES;
var init_data_shim = __esm({
  "src/data-shim.js"() {
    ARRAY_TABLES = /* @__PURE__ */ new Set(["enhancementLevelTotalBonusMultiplierTable", "abilitySlotsLevelRequirementList"]);
    store = globalThis.__MWIA_DATA ||= {};
    ENGINE_TABLES = [
      "abilityDetailMap",
      "achievementDetailMap",
      "achievementTierDetailMap",
      "actionDetailMap",
      "combatMonsterDetailMap",
      "combatStyleDetailMap",
      "combatTriggerDependencyDetailMap",
      "enhancementLevelTotalBonusMultiplierTable",
      "houseRoomDetailMap",
      "itemDetailMap",
      "labyrinthCrateDetailMap"
    ];
  }
});

// src/game-data.js
var game_data_exports = {};
__export(game_data_exports, {
  abilityName: () => abilityName,
  actionName: () => actionName,
  askPrice: () => askPrice,
  combatZones: () => combatZones,
  engineTables: () => engineTables,
  expectedLootPerKill: () => expectedLootPerKill,
  getClientData: () => getClientData,
  itemName: () => itemName,
  loadClientData: () => loadClientData,
  loadPrices: () => loadPrices,
  marketBids: () => marketBids,
  marketEntry: () => marketEntry,
  marketListings: () => marketListings,
  monsterName: () => monsterName,
  onPricesLoaded: () => onPricesLoaded,
  pricesAge: () => pricesAge,
  pricesStamp: () => pricesStamp,
  sellValue: () => sellValue
});
function readClientData(win) {
  try {
    const util = win.localStorageUtil;
    if (util && typeof util.getInitClientData === "function") {
      const data = util.getInitClientData();
      if (data && data.itemDetailMap) return data;
    }
  } catch (error) {
    console.warn("[MWI Advisor] localStorageUtil failed", error);
  }
  return null;
}
async function loadClientData(win) {
  if (clientData) return clientData;
  const data = readClientData(win);
  if (!data) throw new Error("Game data not found yet. Wait for the game to finish loading and try again.");
  for (const table of [...ENGINE_TABLES, "abilitySlotsLevelRequirementList"]) {
    if (data[table]) continue;
    try {
      const response = await fetch(FALLBACK_DATA_URL + table + ".json");
      if (response.ok) data[table] = await response.json();
    } catch (error) {
      console.warn("[MWI Advisor] Could not fetch", table, error);
    }
    if (!data[table]) data[table] = table === "abilitySlotsLevelRequirementList" ? [0, 1, 1, 20, 50, 90] : {};
  }
  clientData = data;
  return clientData;
}
function getClientData() {
  return clientData;
}
function engineTables() {
  const tables = {};
  for (const table of ENGINE_TABLES) tables[table] = clientData[table];
  return tables;
}
function onPricesLoaded(listener) {
  priceListeners.add(listener);
}
async function loadPrices(force = false) {
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
      console.error("[MWI Advisor]", error);
    }
  }
  return prices;
}
function pricesAge() {
  return pricesFetchedAt ? Date.now() - pricesFetchedAt : null;
}
function marketEntry(itemHrid, enhancementLevel = 0) {
  return prices?.[itemHrid]?.[String(enhancementLevel)] || null;
}
function pricesStamp() {
  return pricesFetchedAt;
}
function askPrice(itemHrid, enhancementLevel = 0) {
  if (itemHrid === "/items/coin") return 1;
  const entry = prices?.[itemHrid]?.[String(enhancementLevel)];
  return entry && entry.a > 0 ? entry.a : null;
}
function marketListings(itemHrid) {
  return Object.entries(prices?.[itemHrid] || {}).filter(([, entry]) => entry.a > 0).map(([level, entry]) => ({ enhancementLevel: Number(level), price: entry.a, bid: entry.b > 0 ? entry.b : null })).sort((a, b) => a.price - b.price);
}
function marketBids(itemHrid) {
  return Object.entries(prices?.[itemHrid] || {}).filter(([, entry]) => entry.b > 0).map(([level, entry]) => ({ enhancementLevel: Number(level), bid: entry.b }));
}
function sellValue(itemHrid) {
  if (itemHrid === "/items/coin") return 1;
  const entry = prices?.[itemHrid]?.["0"];
  if (entry && entry.b > 0) return entry.b;
  return clientData?.itemDetailMap?.[itemHrid]?.sellPrice || 0;
}
function itemName(hrid) {
  return clientData?.itemDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
}
function abilityName(hrid) {
  return clientData?.abilityDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
}
function actionName(hrid) {
  return clientData?.actionDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
}
function monsterName(hrid) {
  return clientData?.combatMonsterDetailMap?.[hrid]?.name || hrid?.split("/").pop() || "";
}
function combatZones() {
  return Object.values(clientData.actionDetailMap).filter(
    (action) => action.type === "/action_types/combat" && !action.combatZoneInfo?.isDungeon && action.combatZoneInfo?.fightInfo?.randomSpawnInfo
  ).sort((a, b) => a.sortIndex - b.sortIndex);
}
function expectedLootPerKill(monsterHrid, tier, sim) {
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
var FALLBACK_DATA_URL, PRICE_TTL_MS, clientData, prices, pricesFetchedAt, priceListeners;
var init_game_data = __esm({
  "src/game-data.js"() {
    init_data_shim();
    FALLBACK_DATA_URL = "https://raw.githubusercontent.com/shykai/MWICombatSimulatorTest/dev/src/combatsimulator/data/";
    PRICE_TTL_MS = 30 * 60 * 1e3;
    clientData = null;
    prices = null;
    pricesFetchedAt = 0;
    priceListeners = /* @__PURE__ */ new Set();
  }
});

// src/stats.js
function logGamma(x) {
  const c = [76.18009172947146, -86.50532032941678, 24.01409824083091, -1.231739572450155, 0.001208650973866179, -5395239384953e-18];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let series = 1.000000000190015;
  for (const coefficient of c) series += coefficient / ++y;
  return -tmp + Math.log(2.5066282746310007 * series / x);
}
function betaContinuedFraction(a, b, x) {
  const tiny = 1e-30;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 3e-12) break;
  }
  return h;
}
function incompleteBeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const front = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? front * betaContinuedFraction(a, b, x) / a : 1 - front * betaContinuedFraction(b, a, 1 - x) / b;
}
function studentTCdf(t, df) {
  const tail = 0.5 * incompleteBeta(df / (df + t * t), df / 2, 0.5);
  return t > 0 ? 1 - tail : tail;
}
function confidenceGreater(a, b) {
  const stats = (x) => {
    const mean = x.reduce((s, v) => s + v, 0) / x.length;
    return { n: x.length, mean, variance: x.reduce((s, v) => s + (v - mean) ** 2, 0) / (x.length - 1) };
  };
  if (a.length < 2 || b.length < 2) return null;
  const A = stats(a);
  const B = stats(b);
  const va = A.variance / A.n;
  const vb = B.variance / B.n;
  const diff = A.mean - B.mean;
  if (va + vb <= 1e-18) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
  const df = (va + vb) ** 2 / (va * va / (A.n - 1) + vb * vb / (B.n - 1));
  return studentTCdf(diff / Math.sqrt(va + vb), df);
}
function confidenceOneRun(value, reference, margin = 0) {
  const n = reference.length;
  if (n < 2) return null;
  const mean = reference.reduce((s, v) => s + v, 0) / n;
  const sd = Math.sqrt(reference.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1));
  const diff = value - margin - mean;
  if (sd <= 1e-9) return diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
  return studentTCdf(diff / (sd * Math.sqrt(1 + 1 / n)), n - 1);
}
var init_stats = __esm({
  "src/stats.js"() {
  }
});

// src/profile.js
function emptyTriggers(list) {
  return (list || []).map((t) => ({
    dependencyHrid: t.dependencyHrid,
    conditionHrid: t.conditionHrid,
    comparatorHrid: t.comparatorHrid,
    value: t.value ?? 0
  }));
}
function styleOfItem(item) {
  const first = item?.equipmentDetail?.combatStats?.combatStyleHrids?.[0];
  return Object.keys(STYLES).find((style) => STYLES[style].includes(first)) || null;
}
function weaponOf(profile) {
  return profile.equipment.main_hand || profile.equipment.two_hand || null;
}
function weaponStyle(profile, data) {
  const weapon = weaponOf(profile);
  return weapon && styleOfItem(data.itemDetailMap[weapon.hrid]) || "melee";
}
function styleSkills(style, data) {
  const map = data.combatStyleDetailMap?.[STYLES[style][0]]?.skillExpMap;
  return map ? Object.keys(map).map((hrid) => hrid.split("/").pop()) : ["stamina", "intelligence", "attack", "defense", style];
}
function consumableKinds(hrid, data) {
  const detail = data.itemDetailMap[hrid]?.consumableDetail;
  if (!detail) return [hrid];
  const timed = (detail.recoveryDuration || 0) > 0 ? "time" : "instant";
  if ((detail.hitpointRestore || 0) > 0) return ["hp:" + timed];
  if ((detail.manapointRestore || 0) > 0) return ["mp:" + timed];
  const buffs = (detail.buffs || []).map((b) => b.uniqueHrid || b.typeHrid).filter(Boolean);
  return buffs.length ? buffs : [hrid];
}
function sameKind(a, b, data) {
  if (!a || !b) return false;
  if (a === b) return true;
  const kinds = new Set(consumableKinds(a, data));
  return consumableKinds(b, data).some((kind) => kinds.has(kind));
}
function cloneProfile(profile) {
  return structuredClone(profile);
}
function meetsRequirements(profile, requirements) {
  return (requirements || []).every((req) => {
    const level = req.skillHrid === "/skills/total_level" ? profile.totalLevel : profile.allLevels[req.skillHrid] ?? 0;
    return level >= req.level;
  });
}
function gearStat(data, gear, stat) {
  if (!gear) return 0;
  const detail = data.itemDetailMap[gear.hrid]?.equipmentDetail;
  return detail?.combatStats?.[stat] || 0;
}
function slotCounts(profile, data) {
  const requirements = data.abilitySlotsLevelRequirementList || [0, 1, 1, 20, 50, 90];
  let abilitySlots = 0;
  for (let i = 1; i <= 4; i++) {
    if (profile.levels.intelligence >= (requirements[i + 1] ?? Infinity)) abilitySlots++;
  }
  return {
    food: 1 + gearStat(data, profile.equipment.pouch, "foodSlots"),
    drinks: 1 + gearStat(data, profile.equipment.pouch, "drinkSlots"),
    abilities: abilitySlots,
    // normal slots 1..n
    special: profile.levels.intelligence >= (requirements[1] ?? Infinity)
  };
}
function battleAbilityOrder(profile, data) {
  const slots = slotCounts(profile, data);
  const entries = profile.abilities.slice(1, slots.abilities + 1).filter(Boolean);
  const noCooldown = (e) => !(data.abilityDetailMap[e.hrid]?.cooldownDuration > 0);
  return [...entries.filter((e) => !noCooldown(e)), ...entries.filter(noCooldown)];
}
function toDTO(profile, data) {
  const slots = slotCounts(profile, data);
  const equipment = {};
  for (const [type, gear] of Object.entries(profile.equipment)) {
    if (gear) equipment["/equipment_types/" + type] = { hrid: gear.hrid, enhancementLevel: gear.enhancementLevel };
  }
  const consumable = (hrid) => hrid ? {
    hrid,
    triggers: emptyTriggers(profile.consumableTriggers[hrid] || data.itemDetailMap[hrid]?.consumableDetail?.defaultCombatTriggers)
  } : null;
  const ability = (entry, index) => {
    if (!entry) return null;
    if (index === 0 ? !slots.special : index > slots.abilities) return null;
    return {
      hrid: entry.hrid,
      level: entry.level,
      triggers: emptyTriggers(profile.abilityTriggers[entry.hrid] || data.abilityDetailMap[entry.hrid]?.defaultCombatTriggers)
    };
  };
  return {
    hrid: "player1",
    staminaLevel: profile.levels.stamina,
    intelligenceLevel: profile.levels.intelligence,
    attackLevel: profile.levels.attack,
    meleeLevel: profile.levels.melee,
    defenseLevel: profile.levels.defense,
    rangedLevel: profile.levels.ranged,
    magicLevel: profile.levels.magic,
    equipment,
    food: profile.food.slice(0, slots.food).map(consumable),
    drinks: profile.drinks.slice(0, slots.drinks).map(consumable),
    abilities: [ability(profile.abilities[0], 0), ...battleAbilityOrder(profile, data).map((e, i) => ability(e, i + 1))],
    houseRooms: profile.houseRooms,
    achievements: profile.achievements,
    debuffOnLevelGap: 0
  };
}
function equip(profile, type, gear) {
  const equipment = profile.equipment;
  if (type === "two_hand") {
    delete equipment.main_hand;
    delete equipment.off_hand;
  } else if (type === "main_hand") {
    delete equipment.two_hand;
  }
  equipment[type] = gear;
}
var COMBAT_SKILLS, GEAR_TYPES, STYLES;
var init_profile = __esm({
  "src/profile.js"() {
    COMBAT_SKILLS = ["stamina", "intelligence", "attack", "melee", "defense", "ranged", "magic"];
    GEAR_TYPES = [
      "main_hand",
      "two_hand",
      "off_hand",
      "head",
      "body",
      "legs",
      "feet",
      "hands",
      "neck",
      "earrings",
      "ring",
      "back",
      "pouch",
      "charm"
    ];
    STYLES = {
      magic: ["/combat_styles/magic"],
      ranged: ["/combat_styles/ranged"],
      melee: ["/combat_styles/stab", "/combat_styles/slash", "/combat_styles/smash"]
    };
  }
});

// src/levels.js
function fractionalLevel(table, xp) {
  let low = 1;
  let high = table.length - 1;
  if (xp >= table[high]) return high;
  while (high - low > 1) {
    const mid = low + high >> 1;
    if (table[mid] <= xp) low = mid;
    else high = mid;
  }
  return low + (xp - table[low]) / Math.max(1, table[low + 1] - table[low]);
}
function experienceOf(table, experience, level) {
  return Math.max(Number(experience) || 0, table[level] ?? 0);
}
function levelsPerHour(table, skills, xpPerHour, hours = LEVEL_HORIZON_HOURS) {
  let levels = 0;
  for (const [key, rate] of Object.entries(xpPerHour || {})) {
    const skill = skills[key];
    if (!skill || !(rate > 0)) continue;
    const now2 = experienceOf(table, skill.xp, skill.level);
    levels += fractionalLevel(table, now2 + rate * hours) - fractionalLevel(table, now2);
  }
  return levels / hours;
}
var LEVEL_HORIZON_HOURS;
var init_levels = __esm({
  "src/levels.js"() {
    LEVEL_HORIZON_HOURS = 24;
  }
});

// src/alchemy.js
var init_alchemy = __esm({
  "src/alchemy.js"() {
    init_skilling();
  }
});

// src/enhancing.js
var MAX_TARGET, SOLVE, NO_XP;
var init_enhancing = __esm({
  "src/enhancing.js"() {
    init_skilling();
    MAX_TARGET = 20;
    SOLVE = { a: new Float64Array(3 * (MAX_TARGET + 2)), b: new Float64Array(MAX_TARGET + 2), d: new Float64Array(MAX_TARGET + 2) };
    NO_XP = new Array(MAX_TARGET + 2).fill(0);
  }
});

// src/alchemy-chain.js
var init_alchemy_chain = __esm({
  "src/alchemy-chain.js"() {
    init_alchemy();
  }
});

// src/skilling.js
var MARKET_TAX;
var init_skilling = __esm({
  "src/skilling.js"() {
    init_levels();
    init_alchemy();
    init_enhancing();
    init_alchemy_chain();
    MARKET_TAX = 0.04;
  }
});

// src/skilling-upgrades.js
function resaleValue(itemHrid, level, ownBid, data, bids = null) {
  if (ownBid > 0) return { value: ownBid * (1 - MARKET_TAX), bidLevel: level };
  const lower = (bids?.(itemHrid) || []).filter((b) => b.bid > 0 && b.enhancementLevel < level).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
  if (lower) return { value: lower.bid * (1 - MARKET_TAX), bidLevel: lower.enhancementLevel };
  return { value: data.itemDetailMap[itemHrid]?.sellPrice || 0, bidLevel: null };
}
var init_skilling_upgrades = __esm({
  "src/skilling-upgrades.js"() {
    init_skilling();
    init_enhancing();
    init_alchemy();
  }
});

// src/version-tag.js
var VERSION, UPDATE_URL, LATEST_URL, CHECK_EVERY_MS, scriptVersion;
var init_version_tag = __esm({
  "src/version-tag.js"() {
    VERSION = true ? "0.85.0" : "dev";
    UPDATE_URL = typeof __MWIA_UPDATE_URL__ !== "undefined" ? __MWIA_UPDATE_URL__ : "";
    LATEST_URL = UPDATE_URL.replace(/dist\/[^/]+$/, "package.json");
    CHECK_EVERY_MS = 6 * 60 * 60 * 1e3;
    scriptVersion = () => VERSION;
  }
});

// src/sim-cache.js
function hash(text) {
  let h1 = 3735928559;
  let h2 = 1103547991;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ h1 >>> 16, 2246822507) ^ Math.imul(h2 ^ h2 >>> 13, 3266489909);
  h2 = Math.imul(h2 ^ h2 >>> 16, 2246822507) ^ Math.imul(h1 ^ h1 >>> 13, 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}
function generation() {
  const tables = engineTables();
  const sameData = fingerprint.tables && Object.keys(tables).every((k) => tables[k] === fingerprint.tables[k]);
  if (!sameData) fingerprint = { tables, value: hash(JSON.stringify(tables)) };
  return scriptVersion() + "|" + fingerprint.value;
}
function jobKey(job) {
  const { telemetry, ...rest } = job;
  return hash(JSON.stringify(rest));
}
function dropOldStore() {
  try {
    globalThis.localStorage?.removeItem(OLD_STORE);
  } catch {
  }
}
function open(gen) {
  opening ||= (async () => {
    dropOldStore();
    if (!globalThis.indexedDB) return null;
    try {
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const store3 = req.result.createObjectStore(RUNS, { keyPath: "key" });
          store3.createIndex("used", "used");
          req.result.createObjectStore(META);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      return { db, gen: null };
    } catch {
      return null;
    }
  })();
  return opening.then(async (state) => {
    if (!state || state.gen === gen) return state?.db || null;
    const tx = state.db.transaction(META, "readonly");
    const stored = await request(tx.objectStore(META).get("generation"));
    if (stored !== gen) {
      const wipe = state.db.transaction([RUNS, META], "readwrite");
      wipe.objectStore(RUNS).clear();
      wipe.objectStore(META).put(gen, "generation");
      await finished(wipe);
    }
    state.gen = gen;
    return state.db;
  });
}
async function lookup(db, keys) {
  if (!db) {
    memory ||= /* @__PURE__ */ new Map();
    return keys.map((k) => memory.has(k) ? structuredClone(memory.get(k)) : null);
  }
  const store3 = db.transaction(RUNS, "readonly").objectStore(RUNS);
  return Promise.all(keys.map((k) => request(store3.get(k)).then((v) => v ?? null)));
}
async function store2(db, entries) {
  if (!entries.length) return;
  if (!db) {
    memory ||= /* @__PURE__ */ new Map();
    for (const e of entries) {
      memory.delete(e.key);
      memory.set(e.key, structuredClone(e));
    }
    while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value);
    return;
  }
  const tx = db.transaction(RUNS, "readwrite");
  const runs = tx.objectStore(RUNS);
  for (const e of entries) runs.put(e);
  const count = await request(runs.count());
  if (count > MAX_ENTRIES) {
    let excess = count - MAX_ENTRIES + Math.round(MAX_ENTRIES / 10);
    const cursor = runs.index("used").openKeyCursor();
    cursor.onsuccess = () => {
      const c = cursor.result;
      if (!c || excess-- <= 0) return;
      runs.delete(c.primaryKey);
      c.continue();
    };
  }
  await finished(tx);
}
async function runCached(pool, jobs, onProgress) {
  let db = null;
  try {
    db = await open(generation());
  } catch {
    db = null;
  }
  const keys = jobs.map(jobKey);
  let found = [];
  try {
    found = await lookup(db, keys);
  } catch {
    found = keys.map(() => null);
  }
  const usable = (entry, job) => entry && (!job.telemetry || entry.telemetry);
  const toRun = [];
  const slotOf = /* @__PURE__ */ new Map();
  const plan = jobs.map((job, i) => {
    if (usable(found[i], job)) return { entry: found[i] };
    const key = keys[i];
    if (!slotOf.has(key)) {
      slotOf.set(key, toRun.length);
      toRun.push(job);
    } else if (job.telemetry) toRun[slotOf.get(key)] = job;
    return { run: slotOf.get(key) };
  });
  const kept = jobs.length - plan.filter((p) => p.run !== void 0).length;
  if (kept) onProgress?.(kept, jobs.length);
  const results = toRun.length ? await pool.runAll(toRun, (done) => onProgress?.(kept + done, kept + toRun.length)) : [];
  const used = now();
  const writes = /* @__PURE__ */ new Map();
  const out = plan.map((p, i) => {
    if (p.entry) {
      writes.set(keys[i], { ...p.entry, used });
      const { result: result2, telemetry: telemetry2 } = p.entry;
      return jobs[i].telemetry ? { ...result2, telemetry: telemetry2 } : { ...result2 };
    }
    const { telemetry, ...result } = results[p.run];
    const entry = { key: keys[i], result, used };
    if (telemetry) entry.telemetry = telemetry;
    writes.set(keys[i], entry);
    return jobs[i].telemetry ? { ...result, telemetry } : { ...result };
  });
  store2(db, [...writes.values()]).catch(() => {
  });
  return out;
}
var DB_NAME, RUNS, META, MAX_ENTRIES, OLD_STORE, fingerprint, memory, opening, request, finished, clock, now;
var init_sim_cache = __esm({
  "src/sim-cache.js"() {
    init_version_tag();
    init_game_data();
    DB_NAME = "mwia-sim-cache";
    RUNS = "runs";
    META = "meta";
    MAX_ENTRIES = 2e4;
    OLD_STORE = "mwia-sim-cache";
    fingerprint = { tables: null, value: "" };
    memory = null;
    opening = null;
    request = (req) => new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    finished = (tx) => new Promise((resolve, reject) => {
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    clock = 0;
    now = () => Math.max(Date.now(), ++clock);
  }
});

// src/triggers.js
function cleanTriggers(list) {
  return (list || []).map((t) => ({ dependencyHrid: t.dependencyHrid, conditionHrid: t.conditionHrid, comparatorHrid: t.comparatorHrid, value: t.value ?? 0 }));
}
function abilityTriggers(profile, hrid, data) {
  return cleanTriggers(profile.abilityTriggers?.[hrid] || data.abilityDetailMap[hrid]?.defaultCombatTriggers);
}
function consumableTriggers(profile, hrid, data) {
  return cleanTriggers(profile.consumableTriggers?.[hrid] || data.itemDetailMap[hrid]?.consumableDetail?.defaultCombatTriggers);
}
function mergeTelemetry(list) {
  const out = { abilities: {}, consumables: {}, maxEnemies: 0, deaths: 0, deathsFoodWaiting: 0, hours: 0 };
  for (const t of list.filter(Boolean)) {
    out.maxEnemies = Math.max(out.maxEnemies, t.maxEnemies);
    out.deaths += t.deaths;
    out.deathsFoodWaiting += t.deathsFoodWaiting;
    out.hours += t.hours;
    for (const [hrid, s] of Object.entries(t.abilities)) {
      const o = out.abilities[hrid] ||= { casts: 0, blocked: 0, enemiesAtCast: {}, hits: 0, hitDamage: 0, kills: [], healed: 0, overheal: 0, heals: 0, healSamples: [] };
      for (const k of ["casts", "blocked", "hits", "hitDamage", "healed", "overheal", "heals"]) o[k] += s[k];
      for (const [n, count] of Object.entries(s.enemiesAtCast)) o.enemiesAtCast[n] = (o.enemiesAtCast[n] || 0) + count;
      o.kills.push(...s.kills);
      o.healSamples.push(...s.healSamples);
    }
    for (const [hrid, s] of Object.entries(t.consumables)) {
      const o = out.consumables[hrid] ||= { uses: 0, restore: 0, wasted: 0 };
      for (const k of ["uses", "restore", "wasted"]) o[k] += s[k];
    }
  }
  return out;
}
function effectTypes(ability) {
  return (ability?.abilityEffects || []).map((e) => e.effectType.split("/").pop() + ":" + e.targetType);
}
function setCondition(list, dependencyHrid, conditionHrid, comparatorHrid, value) {
  const rest = list.filter((t) => !(t.dependencyHrid === dependencyHrid && t.conditionHrid === conditionHrid));
  return [...rest, { dependencyHrid, conditionHrid, comparatorHrid, value }];
}
function valueOf(list, dependencyHrid, conditionHrid, comparatorHrid) {
  return list.find((t) => t.dependencyHrid === dependencyHrid && t.conditionHrid === conditionHrid && t.comparatorHrid === comparatorHrid)?.value ?? null;
}
function triggerChanges(profile, battle, telemetry, data, options = {}) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (target, hrid, was, triggers, rule, why) => {
    if (triggers.length > MAX_CONDITIONS) return;
    const key = hrid + "|" + triggersKey(triggers);
    if (triggersKey(triggers) === triggersKey(was) || seen.has(key)) return;
    seen.add(key);
    out.push({ target, hrid, triggers, was, rule, why });
  };
  const stats = (hrid) => telemetry.abilities[hrid] || { casts: 0, blocked: 0, enemiesAtCast: {}, hits: 0, hitDamage: 0, kills: [], healed: 0, overheal: 0, heals: 0, healSamples: [] };
  const cost = (hrid) => data.abilityDetailMap[hrid]?.manaCost || 0;
  const onlyHrids = options.only ? new Set(options.only) : null;
  const starved = battle.filter((e) => {
    const s = stats(e.hrid);
    return s.blocked >= 3 && s.blocked >= SHARE * Math.max(1, s.casts);
  });
  battle.forEach((entry, position) => {
    const hrid = entry.hrid;
    if (onlyHrids && !onlyHrids.has(hrid)) return;
    const ability = data.abilityDetailMap[hrid];
    if (!ability) return;
    const was = abilityTriggers(profile, hrid, data);
    const s = stats(hrid);
    const kinds = effectTypes(ability);
    const later = battle.slice(position + 1);
    if (starved.includes(entry) && later.some((e) => cost(e.hrid) < cost(hrid)) && !(valueOf(was, SELF, C("current_mp"), GTE) >= cost(hrid))) {
      add("ability", hrid, was, setCondition(was, SELF, C("current_mp"), GTE, cost(hrid)), "mana", { blocked: s.blocked, casts: s.casts });
    }
    const above = battle.slice(0, position).filter((e) => starved.includes(e) && cost(e.hrid) > 0);
    if (above.length && s.casts > 0 && cost(hrid) > 0) {
      const first = above.sort((a, b) => stats(b.hrid).blocked - stats(a.hrid).blocked)[0];
      add("ability", hrid, was, setCondition(was, SELF, C("current_mp"), GTE, cost(first.hrid) + cost(hrid)), "reserve", { for: first.hrid, blocked: stats(first.hrid).blocked });
    }
    if (kinds.includes("damage:enemy") && !kinds.includes("damage:allEnemies") && s.hits > 0) {
      const typical = s.hitDamage / s.hits;
      const wasted = s.kills.filter((hp) => hp < 0.5 * typical).length;
      if (typical >= 2 && wasted >= SHARE * Math.max(1, s.casts)) {
        for (const factor of [0.5, 1]) {
          add("ability", hrid, was, setCondition(was, TARGET, C("current_hp"), GTE, whole(factor * typical)), "overkill", { typical: Math.round(typical), wasted, casts: s.casts });
        }
      }
    }
    if (kinds.includes("damage:allEnemies") && telemetry.maxEnemies >= 2) {
      const now2 = valueOf(was, ENEMIES, C("number_of_active_units"), GTE) ?? 1;
      const castsBelow = (k) => Object.entries(s.enemiesAtCast).reduce((sum2, [n, count]) => sum2 + (Number(n) < k ? count : 0), 0);
      for (let k = 1; k <= telemetry.maxEnemies; k++) {
        if (k === now2) continue;
        if (k > now2 && castsBelow(k) < SHARE * Math.max(1, s.casts)) continue;
        add("ability", hrid, was, setCondition(was, ENEMIES, C("number_of_active_units"), GTE, k), "aoe", { from: now2, to: k });
      }
    }
    if (kinds.some((k) => k.startsWith("heal:")) && (s.heals > 0 || s.blocked > 0)) {
      const typical = median(s.healSamples) ?? (s.heals ? s.healed / s.heals : null);
      if (typical >= 2) {
        const hpConditions = [C("current_hp"), C("missing_hp"), C("lowest_hp_percentage")];
        const base = was.filter((t) => !hpConditions.includes(t.conditionHrid));
        const now2 = valueOf(was, SELF, C("missing_hp"), GTE);
        for (const factor of [0.5, 1, 2]) {
          const value = whole(factor * typical);
          if (now2 !== null && Math.abs(value - now2) <= 0.1 * Math.max(now2, 1)) continue;
          add("ability", hrid, was, [...base, { dependencyHrid: SELF, conditionHrid: C("missing_hp"), comparatorHrid: GTE, value }], "heal", { typical: Math.round(typical), overheal: s.overheal, heals: s.heals });
        }
      }
    }
  });
  const blockedTotal = battle.reduce((sum2, e) => sum2 + stats(e.hrid).blocked, 0);
  const castsTotal = battle.reduce((sum2, e) => sum2 + stats(e.hrid).casts, 0);
  for (const hrid of new Set((options.food || []).filter(Boolean))) {
    if (onlyHrids && !onlyHrids.has(hrid)) continue;
    const detail = data.itemDetailMap[hrid]?.consumableDetail;
    const used = telemetry.consumables[hrid]?.uses || 0;
    if (!detail || !used) continue;
    const was = consumableTriggers(profile, hrid, data);
    for (const [condition, restore, short] of [
      [C("missing_hp"), detail.hitpointRestore, telemetry.deaths > 0],
      [C("missing_mp"), detail.manapointRestore, blockedTotal >= SHARE * Math.max(1, castsTotal)]
    ]) {
      if (!(restore > 0)) continue;
      const now2 = valueOf(was, SELF, condition, GTE);
      if (now2 === null) continue;
      const value = short ? whole(now2 / 2) : whole(now2 * 1.5);
      if (value !== now2) add("food", hrid, was, setCondition(was, SELF, condition, GTE, value), "food", { earlier: short, deaths: telemetry.deaths, blocked: blockedTotal });
    }
  }
  return out;
}
var SELF, TARGET, ENEMIES, C, GTE, MAX_CONDITIONS, SHARE, whole, median, triggersKey;
var init_triggers = __esm({
  "src/triggers.js"() {
    SELF = "/combat_trigger_dependencies/self";
    TARGET = "/combat_trigger_dependencies/targeted_enemy";
    ENEMIES = "/combat_trigger_dependencies/all_enemies";
    C = (name) => "/combat_trigger_conditions/" + name;
    GTE = "/combat_trigger_comparators/greater_than_equal";
    MAX_CONDITIONS = 4;
    SHARE = 0.1;
    whole = (x) => Math.max(1, Math.round(x));
    median = (list) => {
      if (!list.length) return null;
      const sorted = [...list].sort((a, b) => a - b);
      return sorted[sorted.length >> 1];
    };
    triggersKey = (list) => cleanTriggers(list).map((t) => [t.dependencyHrid, t.conditionHrid, t.comparatorHrid, t.value].join(":")).sort().join("|");
  }
});

// src/analysis.js
function offStyleStats(style) {
  const own = /* @__PURE__ */ new Set([...STYLE_STATS[style], ...style === "magic" ? [] : PHYSICAL_STATS]);
  return new Set([...Object.values(STYLE_STATS).flat(), ...PHYSICAL_STATS].filter((stat) => !own.has(stat)));
}
function xpValue(result, settings) {
  return settings?.countLevels && result.levels !== null && result.levels !== void 0 ? result.levels : result.xpTotal;
}
function makeGoal(settings, reference) {
  return {
    countLevels: !!settings.countLevels,
    gold: Math.min(1, Math.max(0, Number(settings.goldWeight) || 0)),
    xpRef: Math.max(settings.countLevels ? 1e-6 : 1, reference.xp),
    goldRef: Math.max(MIN_GOLD_REF, reference.gold)
  };
}
function score(result, goal) {
  return (1 - goal.gold) * xpValue(result, goal) / goal.xpRef + goal.gold * result.profit / goal.goldRef;
}
function deathLimit(settings) {
  return settings.acceptRareDeaths ? RARE_DEATHS_PER_HOUR : 0;
}
function zoneGoal(zoneResults, settings) {
  const safe = zoneResults.filter((z) => acceptable(z.result, settings));
  const pool = safe.length ? safe : zoneResults;
  return makeGoal(settings, {
    xp: Math.max(...pool.map((z) => xpValue(z.result, settings))),
    gold: Math.max(...pool.map((z) => z.result.loot))
  });
}
function consumableCost(result) {
  let cost = 0;
  for (const [hrid, perHour2] of Object.entries(result.consumables)) cost += perHour2 * (askPrice(hrid) ?? sellValue(hrid));
  return cost;
}
function lootValue(result, tier) {
  let value = 0;
  for (const [monster, perHour2] of Object.entries(result.kills)) value += perHour2 * expectedLootPerKill(monster, tier, result);
  return value;
}
function average(results) {
  const n = results.length;
  const mean = (pick) => results.reduce((sum2, r) => sum2 + pick(r), 0) / n;
  const meanMap = (pick) => {
    const out = {};
    for (const r of results) for (const [k, v] of Object.entries(pick(r))) out[k] = (out[k] || 0) + v / n;
    return out;
  };
  return {
    ...results[0],
    xp: meanMap((r) => r.xp),
    xpTotal: mean((r) => r.xpTotal),
    deaths: mean((r) => r.deaths),
    encounters: mean((r) => r.encounters),
    kills: meanMap((r) => r.kills),
    consumables: meanMap((r) => r.consumables),
    manaUsed: meanMap((r) => r.manaUsed)
  };
}
function combatLevelsPerHour(result, profile) {
  const table = getClientData()?.levelExperienceTable;
  if (!Array.isArray(table) || !profile) return null;
  const skills = {};
  for (const [skill, level] of Object.entries(profile.levels)) skills[skill] = { level, xp: profile.allExperience?.["/skills/" + skill] ?? null };
  return levelsPerHour(table, skills, result.xp);
}
function enrich(result, tier, profile) {
  const loot = lootValue(result, tier);
  const cost = consumableCost(result);
  return { ...result, loot, cost, profit: loot - cost, levels: combatLevelsPerHour(result, profile), killsTotal: Object.values(result.kills).reduce((a, b) => a + b, 0) };
}
async function simulateRuns(pool, items, zone, hours, onProgress) {
  const data = getClientData();
  const jobs = [];
  for (const item of items) {
    const player = toDTO(item.profile, data);
    for (const seed of item.seeds) {
      const job = { player, zoneHrid: zone.zoneHrid, tier: zone.tier, hours, seed: seedFor(seed), extraBuffs: item.profile.extraBuffs };
      jobs.push(item.telemetry ? { ...job, telemetry: true } : job);
    }
  }
  const results = await runCached(pool, jobs, onProgress);
  let next = 0;
  return items.map(
    (item) => item.seeds.map((seed) => {
      const { telemetry, ...result } = results[next++];
      if (item.telemetry) (item.telemetryOut ||= []).push(telemetry);
      return { ...enrich(result, zone.tier, item.profile), seed };
    })
  );
}
async function simulateVariants(pool, variants, zone, settings, onProgress) {
  const seeds = Array.from({ length: settings.seeds }, (_, i) => i);
  const runs = await simulateRuns(pool, variants.map((v) => ({ profile: v.profile, seeds })), zone, settings.hours, onProgress);
  return variants.map((variant, i) => ({ ...variant, result: summarize(runs[i], zone.tier, variant.profile), runs: runs[i] }));
}
async function analyzeZones(pool, profile, settings, onProgress) {
  const variants = [];
  if (settings.zones) for (const zone of settings.zones) variants.push({ zone: { zoneHrid: zone.zoneHrid, tier: zone.tier } });
  else {
    for (const zone of combatZones()) {
      for (let tier = 0; tier <= Math.min(settings.maxTier, zone.maxDifficulty ?? 0); tier++) {
        variants.push({ zone: { zoneHrid: zone.hrid, tier } });
      }
    }
  }
  const data = getClientData();
  const player = toDTO(profile, data);
  const hours = Math.max(1, settings.hours / 2);
  const jobs = variants.map((v) => ({ player, zoneHrid: v.zone.zoneHrid, tier: v.zone.tier, hours, seed: seedFor(0), extraBuffs: profile.extraBuffs }));
  const results = await runCached(pool, jobs, onProgress);
  return variants.map((v, i) => ({ ...v, result: enrich(results[i], v.zone.tier, profile) }));
}
function pickBestZone(zoneResults, settings) {
  if (!zoneResults?.length) return null;
  const goal = zoneGoal(zoneResults, settings);
  const sorted = [...zoneResults].sort((a, b) => score(b.result, goal) - score(a.result, goal));
  return sorted.find((z) => acceptable(z.result, settings)) || sorted[0];
}
function isUsefulFor(style, stats) {
  const offStyle = offStyleStats(style);
  return Object.entries(stats || {}).some(([key, value]) => typeof value === "number" && value > 0 && !offStyle.has(key) && key !== "attackInterval");
}
function displaced(profile, type, starter) {
  const slots = type === "two_hand" ? ["two_hand", "main_hand", "off_hand"] : type === "main_hand" ? ["main_hand", "two_hand"] : [type];
  return slots.filter((slot2) => profile.equipment[slot2] && !(starter && (slot2 === "main_hand" || slot2 === "two_hand"))).map((slot2) => profile.equipment[slot2]);
}
function resaleOf(gear, data) {
  const bid = marketEntry(gear.hrid, gear.enhancementLevel)?.b;
  return resaleValue(gear.hrid, gear.enhancementLevel, bid > 0 ? bid : null, data, marketBids).value;
}
function gearCandidates(profile, settings) {
  const { budget, starter = null, enhanceCost = null } = settings;
  const data = getClientData();
  const style = weaponStyle(profile, data);
  const candidates = [];
  for (const item of Object.values(data.itemDetailMap)) {
    const detail = item.equipmentDetail;
    if (!detail) continue;
    const type = detail.type?.split("/").pop();
    if (!GEAR_TYPES.includes(type)) continue;
    if (!meetsRequirements(profile, detail.levelRequirements)) continue;
    const stats = detail.combatStats || {};
    const weapon = type === "main_hand" || type === "two_hand";
    if (weapon) {
      if (styleOfItem(item) !== style) continue;
    } else if (!isUsefulFor(style, stats)) {
      continue;
    }
    if (type === "off_hand" && profile.equipment.two_hand) continue;
    const current = profile.equipment[type];
    const worn = current?.hrid === item.hrid && !(starter && weapon) ? current : null;
    const taken = displaced(profile, type, starter);
    const resale = taken.reduce((sum2, gear) => sum2 + resaleOf(gear, data), 0);
    let options = gearOptions(profile, item.hrid, budget, { worn, enhanceCost, resale });
    if (type === "pouch") options = options.slice(0, 1);
    for (const option of options) {
      if (current && current.hrid === item.hrid && current.enhancementLevel >= option.enhancementLevel) continue;
      const gear = { hrid: item.hrid, enhancementLevel: option.enhancementLevel };
      const variant = cloneProfile(profile);
      equip(variant, type, gear);
      if (type === "pouch") {
        const before = slotCounts(profile, data);
        const after = slotCounts(variant, data);
        if (after.food < before.food || after.drinks < before.drinks) continue;
      }
      const candidate = {
        kind: "gear",
        slot: type,
        hrid: item.hrid,
        enhancementLevel: option.enhancementLevel,
        price: option.price,
        resale: option.resale,
        sold: option.resale ? taken : [],
        cost: option.cost,
        owned: option.owned,
        enhance: option.enhance || null,
        replaces: current || null,
        profile: variant
      };
      candidates.push(candidate);
      const foodSlotsNow = slotCounts(profile, data).food;
      if (type === "pouch" && slotCounts(variant, data).food > foodSlotsNow) {
        for (const food of combatConsumables("food")) {
          if (profile.food.slice(0, foodSlotsNow).some((had) => sameKind(had, food, data))) continue;
          const withFood = cloneProfile(variant);
          while (withFood.food.length <= foodSlotsNow) withFood.food.push(null);
          withFood.food[foodSlotsNow] = food;
          candidates.push({ ...candidate, extraFood: food, extraFoodSlot: foodSlotsNow, profile: withFood });
        }
      }
    }
  }
  return candidates;
}
function gearOptions(profile, hrid, budget, { worn = null, enhanceCost = null, resale = 0 } = {}) {
  const owned = profile.inventory.filter((i) => i.hrid === hrid).sort((a, b) => b.enhancementLevel - a.enhancementLevel)[0];
  const options = owned ? [{ enhancementLevel: owned.enhancementLevel, price: 0, resale, cost: 0, owned: true }] : [];
  const cheapest = /* @__PURE__ */ new Map();
  const offer = (o) => {
    o.price = o.cost;
    o.resale = o.enhance?.start === "worn" ? 0 : resale;
    o.cost = Math.max(0, o.price - o.resale);
    if (o.cost > budget || owned && o.enhancementLevel <= owned.enhancementLevel) return;
    const known = cheapest.get(o.enhancementLevel);
    if (!known || o.cost < known.cost) cheapest.set(o.enhancementLevel, o);
  };
  for (const listing of marketListings(hrid)) offer({ enhancementLevel: listing.enhancementLevel, cost: listing.price, owned: false });
  if (enhanceCost) {
    const starts = [];
    if (worn) starts.push({ from: worn.enhancementLevel, base: 0, start: "worn" });
    if (owned) starts.push({ from: owned.enhancementLevel, base: 0, start: "owned" });
    const ask = askPrice(hrid, 0);
    if (ask !== null) starts.push({ from: 0, base: ask, start: "buy" });
    const lookup2 = starts.length ? enhanceCost(hrid, starts.map((s) => s.from)) : null;
    for (let target = 1; lookup2 && target <= MAX_TARGET; target++) {
      for (const s of starts) {
        const made = s.from < target ? lookup2(s.from, target) : null;
        if (made) offer({ enhancementLevel: target, cost: s.base + made.cost, owned: false, enhance: { ...made, from: s.from, start: s.start, basePrice: s.base } });
      }
    }
  }
  const front = [];
  for (const o of [...cheapest.values()].sort((a, b) => a.cost - b.cost || b.enhancementLevel - a.enhancementLevel)) {
    if (front.length && o.enhancementLevel <= front[front.length - 1].enhancementLevel) continue;
    front.push(o);
  }
  let picked = front;
  if (front.length > MAX_LEVELS) {
    const step = (front.length - 1) / (MAX_LEVELS - 1);
    picked = Array.from({ length: MAX_LEVELS }, (_, i) => front[Math.round(i * step)]);
  }
  return [...options, ...picked];
}
function combatConsumables(kind) {
  const category = kind === "food" ? "/item_categories/food" : "/item_categories/drink";
  return Object.values(getClientData().itemDetailMap).filter((item) => item.categoryHrid === category && item.consumableDetail?.usableInActionTypeMap?.["/action_types/combat"]).filter((item) => askPrice(item.hrid, 0) !== null).map((item) => item.hrid);
}
function abilityCandidates(profile, budget, replace = null) {
  const data = getClientData();
  const slots = slotCounts(profile, data);
  if (slots.abilities === 0) return [];
  const books = {};
  for (const item of Object.values(data.itemDetailMap)) {
    if (item.abilityBookDetail) books[item.abilityBookDetail.abilityHrid] = item;
  }
  const equipped = new Set(profile.abilities.filter(Boolean).map((a) => a.hrid));
  const indices = [];
  for (let i = 1; i <= slots.abilities; i++) indices.push(i);
  const empty = indices.filter((i) => !profile.abilities[i]);
  const placements = empty.length ? [empty[0]] : replace && profile.abilities[replace] ? [replace] : indices;
  const candidates = [];
  for (const ability of Object.values(data.abilityDetailMap)) {
    if (ability.isSpecialAbility || equipped.has(ability.hrid)) continue;
    let level = profile.learnedAbilities[ability.hrid];
    let cost = 0;
    const book = books[ability.hrid];
    if (!level) {
      if (!book || !meetsRequirements(profile, book.abilityBookDetail.levelRequirements)) continue;
      const price = askPrice(book.hrid, 0);
      if (price === null || price > budget) continue;
      level = 1;
      cost = price;
    }
    for (const index of placements) {
      const variant = cloneProfile(profile);
      variant.abilities[index] = { hrid: ability.hrid, level };
      candidates.push({
        kind: "ability",
        slot: "ability" + index,
        hrid: ability.hrid,
        bookHrid: book?.hrid,
        level,
        cost,
        owned: cost === 0,
        replaces: profile.abilities[index]?.hrid || null,
        profile: variant
      });
    }
  }
  return [...candidates, ...abilityLevelCandidates(profile, budget, books)];
}
function abilityLevelCandidates(profile, budget, books) {
  const data = getClientData();
  const table = data.levelExperienceTable;
  if (!table) return [];
  const slots = slotCounts(profile, data);
  const candidates = [];
  profile.abilities.forEach((entry, index) => {
    if (!entry || (index === 0 ? !slots.special : index > slots.abilities)) return;
    const book = books[entry.hrid];
    const xpPerBook = book?.abilityBookDetail?.experienceGain;
    const price = book && askPrice(book.hrid, 0);
    if (!xpPerBook || !price) return;
    const xpNow = profile.abilityExperience[entry.hrid] ?? table[entry.level] ?? 0;
    for (const step of LEVEL_STEPS) {
      const target = entry.level + step;
      if (table[target] === void 0) break;
      const count = Math.max(1, Math.ceil((table[target] - xpNow) / xpPerBook));
      if (count * price > budget) break;
      const variant = cloneProfile(profile);
      variant.abilities[index] = { hrid: entry.hrid, level: target };
      candidates.push({
        kind: "abilityLevel",
        slot: "ability" + index,
        hrid: entry.hrid,
        bookHrid: book.hrid,
        fromLevel: entry.level,
        level: target,
        books: count,
        cost: count * price,
        owned: false,
        replaces: null,
        profile: variant
      });
    }
  });
  return candidates;
}
function stylesInUse(profile, data) {
  const styles = /* @__PURE__ */ new Set([weaponStyle(profile, data)]);
  const ofHrid = (hrid) => hrid === "/combat_styles/ranged" ? "ranged" : hrid === "/combat_styles/magic" ? "magic" : hrid ? "melee" : null;
  for (const hrid of Object.keys(profile.learnedAbilities || {})) {
    for (const effect of data.abilityDetailMap[hrid]?.abilityEffects || []) if (ofHrid(effect.combatStyleHrid)) styles.add(ofHrid(effect.combatStyleHrid));
  }
  return styles;
}
function useless(hrid, styles, data) {
  const buffs = data.itemDetailMap[hrid]?.consumableDetail?.buffs || [];
  const style = (b) => /\/buff_types\/(melee|ranged|magic)_level$/.exec(b.typeHrid || "")?.[1];
  return buffs.length > 0 && buffs.every((b) => style(b) && !styles.has(style(b)));
}
function consumableCandidates(profile, kind, { onlyUseful = false, replace = null } = {}) {
  const data = getClientData();
  const styles = onlyUseful ? stylesInUse(profile, data) : null;
  const slots = slotCounts(profile, data);
  const count = kind === "food" ? slots.food : slots.drinks;
  const current = (kind === "food" ? profile.food : profile.drinks).slice(0, count);
  while (current.length < count) current.push(null);
  const empty = current.findIndex((h) => !h);
  const placements = empty !== -1 ? [empty] : replace !== null && current[replace] ? [replace] : current.map((_, i) => i);
  const candidates = [];
  for (const hrid of combatConsumables(kind)) {
    if (current.includes(hrid) || styles && useless(hrid, styles, data)) continue;
    const clash = current.findIndex((had) => sameKind(had, hrid, data));
    for (const index of clash !== -1 ? [clash] : placements) {
      const variant = cloneProfile(profile);
      const list = kind === "food" ? variant.food : variant.drinks;
      while (list.length < count) list.push(null);
      list[index] = hrid;
      candidates.push({ kind, slot: kind + index, hrid, cost: 0, replaces: current[index] || null, profile: variant });
    }
  }
  current.forEach((hrid, index) => {
    if (!hrid) return;
    const variant = cloneProfile(profile);
    (kind === "food" ? variant.food : variant.drinks)[index] = null;
    candidates.push({ kind, remove: true, slot: kind + index, hrid, cost: 0, replaces: hrid, profile: variant });
  });
  return candidates;
}
function houseCandidates(profile, budget) {
  const data = getClientData();
  const candidates = [];
  for (const room of Object.values(data.houseRoomDetailMap || {})) {
    if (!room.usableInActionTypeMap?.["/action_types/combat"]) continue;
    const level = profile.houseRooms?.[room.hrid] || 0;
    const costs = room.upgradeCostsMap?.[String(level + 1)];
    if (!costs?.length) continue;
    const materials = costs.map((c) => ({ hrid: c.itemHrid, count: c.count, price: askPrice(c.itemHrid, 0) }));
    if (materials.some((m) => m.price === null)) continue;
    const cost = materials.reduce((sum2, m) => sum2 + m.count * m.price, 0);
    if (cost > budget) continue;
    const variant = cloneProfile(profile);
    variant.houseRooms = { ...variant.houseRooms, [room.hrid]: level + 1 };
    candidates.push({ kind: "house", slot: "house:" + room.hrid, hrid: room.hrid, name: room.name, fromLevel: level, level: level + 1, cost, materials, owned: false, replaces: null, profile: variant });
  }
  return candidates;
}
function skillLevelCandidates(profile) {
  const data = getClientData();
  const style = weaponStyle(profile, data);
  const top = Array.isArray(data.levelExperienceTable) ? data.levelExperienceTable.length - 1 : 200;
  const candidates = [];
  for (const skill of COMBAT_SKILLS) {
    if (["melee", "ranged", "magic"].includes(skill) && skill !== style) continue;
    const from = profile.levels[skill];
    for (const step of SKILL_STEPS) {
      if (from + step > top) break;
      const variant = cloneProfile(profile);
      variant.levels[skill] = from + step;
      candidates.push({ kind: "skillLevel", slot: "skill:" + skill, hrid: skill, fromLevel: from, level: from + step, cost: 0, owned: true, replaces: null, profile: variant });
    }
  }
  return candidates;
}
function abilityOrderCandidates(profile) {
  const data = getClientData();
  const slots = slotCounts(profile, data);
  const indices = [];
  for (let i = 1; i <= slots.abilities; i++) if (profile.abilities[i]) indices.push(i);
  if (indices.length < 2) return [];
  const entries = indices.map((i) => profile.abilities[i]);
  const keyOf = (list) => list.map((e) => e.hrid).join(">");
  const now2 = battleAbilityOrder(profile, data);
  const seen = /* @__PURE__ */ new Set([keyOf(now2)]);
  const candidates = [];
  for (const permuted of permutations(entries)) {
    const order = battleAbilityOrder({ ...profile, abilities: [null, ...permuted] }, data);
    const key = keyOf(order);
    if (seen.has(key)) continue;
    seen.add(key);
    const variant = cloneProfile(profile);
    indices.forEach((slot2, k) => variant.abilities[slot2] = { ...order[k] });
    candidates.push({ kind: "abilityOrder", slot: "abilityOrder", hrid: key, order: order.map((e) => e.hrid), was: now2.map((e) => e.hrid), cost: 0, owned: true, replaces: null, profile: variant });
  }
  return candidates;
}
function permutations(list) {
  if (list.length <= 1) return [list];
  return list.flatMap((item, i) => permutations([...list.slice(0, i), ...list.slice(i + 1)]).map((rest) => [item, ...rest]));
}
function bestPerItem(evaluated) {
  const groups = /* @__PURE__ */ new Map();
  for (const c of evaluated) {
    const key = [c.kind, c.hrid, c.enhancementLevel ?? "", ["abilityLevel", "house", "skillLevel"].includes(c.kind) ? c.level : "", c.remove ? "remove" : ""].join("|");
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.values()].map((options) => {
    const pool = options.some((c) => c.safe) ? options.filter((c) => c.safe) : options;
    const top = pool.reduce((a, b) => b.delta > a.delta ? b : a);
    if (!top.extraFood || top.delta <= 0) return top;
    return pool.filter((c) => c.delta >= 0.85 * top.delta).sort((a, b) => a.costPerHourDelta - b.costPerHourDelta)[0];
  });
}
function triggerCandidates(profile, telemetry, only = null) {
  const data = getClientData();
  const slots = slotCounts(profile, data);
  const changes = triggerChanges(profile, battleAbilityOrder(profile, data), telemetry, data, { food: profile.food.slice(0, slots.food), only });
  return changes.map((change) => ({ change, profile: withTriggers(profile, change) }));
}
function withTriggers(profile, change) {
  const variant = cloneProfile(profile);
  const map = change.target === "ability" ? "abilityTriggers" : "consumableTriggers";
  variant[map] = { ...variant[map] || {}, [change.hrid]: change.triggers };
  return variant;
}
function screenGoals(base, settings) {
  const ends = [{ goldWeight: 0, countLevels: false }, { goldWeight: 1, countLevels: false }];
  if (base.levels !== null && base.levels !== void 0) ends.push({ goldWeight: 0, countLevels: true });
  return ends.map((end) => {
    const s = { ...settings, ...end };
    return makeGoal(s, { xp: xpValue(base, s), gold: base.loot });
  });
}
function ruledOut(run, baseRuns, goals) {
  return goals.every((goal) => (confidenceOneRun(score(run, goal), baseRuns.map((r) => score(r, goal)), SCREEN_MARGIN) ?? 1) < SCREEN_BELOW);
}
async function simulateScreened(pool, candidates, items, baseRuns, base, zone, settings, onProgress) {
  if (settings.seeds < 2) return simulateRuns(pool, items, zone, settings.hours, onProgress);
  const goals = screenGoals(base, settings);
  const firstItems = items.map((item) => ({ ...item, seeds: item.seeds.slice(0, 1) }));
  let total = items.reduce((sum2, item) => sum2 + item.seeds.length, 0);
  const first = await simulateRuns(pool, firstItems, zone, settings.hours, (done) => onProgress?.(done, total));
  const keep = items.map((item, i) => item.seeds.length < 2 || NOT_SCREENED.has(candidates[i].kind) || !ruledOut(first[i][0], baseRuns, goals));
  const restItems = items.map((item, i) => keep[i] ? { ...item, seeds: item.seeds.slice(1) } : null).filter(Boolean);
  const done0 = firstItems.length;
  total = done0 + restItems.reduce((sum2, item) => sum2 + item.seeds.length, 0);
  const rest = await simulateRuns(pool, restItems, zone, settings.hours, (done) => onProgress?.(done0 + done, total));
  let r = 0;
  return items.map((item, i) => {
    if (item.telemetry) item.telemetryOut = [...firstItems[i].telemetryOut || []];
    if (!keep[i]) {
      candidates[i].screened = true;
      return first[i];
    }
    const restItem = restItems[r];
    const runs = [...first[i], ...rest[r++]];
    if (item.telemetry) item.telemetryOut.push(...restItem.telemetryOut || []);
    return runs;
  });
}
async function analyzeUpgrades(pool, profile, zone, settings, onProgress, onRefineProgress) {
  const budget = settings.budget;
  const all = settings.scope !== "abilities";
  const seeds = (n) => Array.from({ length: n }, (_, i) => i);
  const keep = settings.keep || (() => true);
  const candidates = [
    ...all ? gearCandidates(profile, settings) : [],
    ...abilityCandidates(profile, budget),
    ...abilityOrderCandidates(profile),
    ...all ? houseCandidates(profile, budget) : [],
    ...all && !settings.noSkillLevels ? skillLevelCandidates(profile) : [],
    ...all ? consumableCandidates(profile, "drinks") : [],
    ...all ? consumableCandidates(profile, "food") : []
  ].filter(keep);
  const baseItem = { profile, seeds: seeds(settings.seeds * BASE_SEED_FACTOR), telemetry: true };
  const planned = baseItem.seeds.length + candidates.length * settings.seeds;
  const [baseRuns] = await simulateRuns(pool, [baseItem], zone, settings.hours, (done) => onProgress?.(done, planned));
  const telemetry = mergeTelemetry(baseItem.telemetryOut);
  for (const { change, profile: variant } of settings.noTriggers ? [] : triggerCandidates(profile, telemetry)) {
    candidates.push(triggerCandidate(change, variant));
  }
  candidates.forEach((c, id) => c.id = id);
  const items = candidates.map((c) => ({ profile: c.profile, seeds: seeds(settings.seeds), telemetry: !settings.noTriggers && c.kind === "ability" }));
  const done0 = baseItem.seeds.length;
  const base = summarize(baseRuns, zone.tier, profile);
  const runs = await simulateScreened(pool, candidates, items, baseRuns, base, zone, settings, (done, total) => onProgress?.(done0 + done, done0 + total));
  const simulated = candidates.map((c, i) => ({ ...c, result: summarize(runs[i], zone.tier, c.profile), runs: runs[i], telemetry: items[i].telemetry ? mergeTelemetry(items[i].telemetryOut) : void 0 }));
  const slots = slotCounts(profile, getClientData());
  const emptyAbilitySlots = [];
  for (let i = 1; i <= slots.abilities; i++) if (!profile.abilities[i]) emptyAbilitySlots.push(i);
  const raw = {
    zone,
    hours: settings.hours,
    seedsPerRound: settings.seeds,
    scope: all ? "all" : "abilities",
    emptyAbilitySlots,
    starter: settings.starter || null,
    baseProfile: profile,
    base,
    baseRuns,
    telemetry: summaryOfTelemetry(telemetry),
    candidates: simulated
  };
  if (!settings.noTriggers) await tuneNewAbilities(pool, raw, settings, onRefineProgress);
  for (const c of raw.candidates) delete c.telemetry;
  for (let round = 0; round < 2; round++) {
    if (!await refineUncertain(pool, raw, settings, onRefineProgress)) break;
  }
  return raw;
}
function triggerCandidate(change, profile) {
  return { kind: "trigger", slot: "trigger:" + change.hrid, hrid: change.hrid, target: change.target, triggers: change.triggers, was: change.was, rule: change.rule, why: change.why, cost: 0, owned: true, replaces: null, profile };
}
function summaryOfTelemetry(t) {
  const perHour2 = (n) => t.hours ? n / t.hours : 0;
  const abilities = {};
  for (const [hrid, s] of Object.entries(t.abilities)) {
    abilities[hrid] = { castsPerHour: perHour2(s.casts), waitingPerHour: perHour2(s.blocked), healed: s.heals ? s.healed / s.heals : null };
  }
  return { abilities, maxEnemies: t.maxEnemies, deathsFoodWaiting: perHour2(t.deathsFoodWaiting) };
}
async function tuneNewAbilities(pool, raw, settings, onProgress) {
  const rated = rateUpgrades(raw, settings);
  const top = rated.abilities.filter((c) => c.kind === "ability" && c.delta > 0).slice(0, TUNED_ABILITIES);
  const tries = [];
  for (const rated2 of top) {
    const c = raw.candidates.find((x) => x.id === rated2.id);
    if (!c?.telemetry) continue;
    for (const { change, profile } of triggerCandidates(c.profile, c.telemetry, [c.hrid])) {
      const { result, runs: runs2, telemetry, id: id2, screened, ...rest } = c;
      tries.push({ ...rest, profile, triggers: change.triggers, was: change.was, rule: change.rule });
    }
  }
  if (!tries.length) return 0;
  const seeds = Array.from({ length: raw.seedsPerRound }, (_, i) => i);
  const runs = await simulateRuns(pool, tries.map((t) => ({ profile: t.profile, seeds })), raw.zone, raw.hours, onProgress);
  const scores = (c) => c.runs.map((r) => score(r, rated.goal));
  const mean = (list) => list.reduce((a, b) => a + b, 0) / list.length;
  let id = Math.max(...raw.candidates.map((c) => c.id)) + 1;
  for (const plain of top.map((r) => raw.candidates.find((x) => x.id === r.id))) {
    const mine = tries.map((t, i) => ({ ...t, result: summarize(runs[i], raw.zone.tier, t.profile), runs: runs[i] })).filter((t) => t.hrid === plain.hrid && t.slot === plain.slot);
    const better = mine.filter((t) => mean(scores(t)) > mean(scores(plain)) && (confidenceGreater(scores(t), scores(plain)) ?? 0) >= TUNED_CONFIDENCE).sort((a, b) => mean(scores(b)) - mean(scores(a)))[0];
    if (better) raw.candidates[raw.candidates.indexOf(plain)] = { ...better, id: id++ };
  }
  return tries.length;
}
function uncertainCandidates(raw, settings) {
  const rated = rateUpgrades(raw, settings);
  const maxRuns = raw.seedsPerRound * MAX_SEED_FACTOR;
  return [...rated.gear, ...rated.abilities, ...rated.house, ...rated.orders, ...rated.triggers, ...rated.drinks, ...rated.food].filter((c) => c.delta > 0 && c.safe && c.confidence < REFINE_BELOW && c.runs.length < maxRuns).sort((a, b) => b.delta - a.delta).slice(0, MAX_REFINED);
}
async function refineUncertain(pool, raw, settings, onProgress) {
  const rated = rateUpgrades(raw, settings);
  const maxRuns = raw.seedsPerRound * MAX_SEED_FACTOR;
  const rows = uncertainCandidates(raw, settings);
  const siblings = rated.triggerVariants.filter((v) => rows.some((r) => r.kind === "trigger" && r.hrid === v.hrid && r.id !== v.id) && v.delta > 0 && v.safe && v.confidence < REFINE_BELOW && v.runs.length < maxRuns);
  const targets = [...rows, ...siblings].map((c) => raw.candidates.find((x) => x.id === c.id));
  if (!targets.length) return 0;
  const items = targets.map((c) => {
    const first = Math.max(...c.runs.map((r) => r.seed)) + 1;
    return { profile: c.profile, seeds: Array.from({ length: raw.seedsPerRound }, (_, i) => first + i) };
  });
  const runs = await simulateRuns(pool, items, raw.zone, raw.hours, onProgress);
  targets.forEach((c, i) => {
    delete c.screened;
    c.runs = [...c.runs, ...runs[i]];
    c.result = summarize(c.runs, raw.zone.tier, c.profile);
  });
  return targets.length;
}
function rateUpgrades(raw, settings) {
  const { base } = raw;
  const goal = makeGoal(settings, { xp: xpValue(base, settings), gold: base.loot });
  const baseScore = score(base, goal);
  const baseScores = raw.baseRuns.map((r) => score(r, goal));
  const used = (c) => c.remove || !["food", "drinks"].includes(c.kind) || (c.result.consumables[c.hrid] || 0) > 0.01;
  const evaluated = raw.candidates.filter(used).map((c) => {
    const delta = score(c.result, goal) - baseScore;
    const confidence = (c.runs.length < 2 ? confidenceOneRun(score(c.runs[0], goal), baseScores) : confidenceGreater(c.runs.map((r) => score(r, goal)), baseScores)) ?? 0.5;
    return {
      ...c,
      delta,
      deltaPct: delta,
      // scores are already fractions of the reference
      confidence,
      significant: confidence >= CONFIDENCE_LEVEL,
      xpDelta: xpValue(c.result, settings) - xpValue(base, settings),
      profitDelta: c.result.profit - base.profit,
      // A change that makes you die noticeably more often is never recommended, whatever the
      // gain – unless you accept rare deaths and it stays within that limit.
      safe: c.result.deaths <= Math.max(base.deaths * 1.1 + 0.3, deathLimit(settings)),
      costPerHourDelta: c.result.cost - base.cost,
      deathsDelta: c.result.deaths - base.deaths
    };
  });
  const best = bestPerItem(evaluated);
  const byDelta = (a, b) => b.delta - a.delta;
  const table = getClientData()?.levelExperienceTable;
  for (const c of best) {
    if (c.kind !== "skillLevel") continue;
    const rate = base.xp?.[c.hrid] || 0;
    const xpNow = Array.isArray(table) ? experienceOf(table, raw.baseProfile.allExperience?.["/skills/" + c.hrid], c.fromLevel) : null;
    const need = Array.isArray(table) && table[c.level] !== void 0 ? Math.max(0, table[c.level] - xpNow) : null;
    c.xpNeeded = need;
    c.hoursToReach = need === null || !(rate > 0) ? null : need / rate;
  }
  return {
    ...raw,
    goal,
    baseScore,
    gear: best.filter((c) => c.kind === "gear").sort(byDelta),
    abilities: best.filter((c) => c.kind === "ability" || c.kind === "abilityLevel").sort(byDelta),
    orders: best.filter((c) => c.kind === "abilityOrder").sort(byDelta),
    triggers: best.filter((c) => c.kind === "trigger").sort(byDelta),
    triggerVariants: evaluated.filter((c) => c.kind === "trigger"),
    house: best.filter((c) => c.kind === "house").sort(byDelta),
    levels: best.filter((c) => c.kind === "skillLevel").sort((a, b) => a.hrid.localeCompare(b.hrid) || a.level - b.level),
    drinks: best.filter((c) => c.kind === "drinks").sort(byDelta),
    food: best.filter((c) => c.kind === "food").sort(byDelta)
  };
}
function stepConfidence(analysis, from, to) {
  if (!from) return to.confidence;
  const scores = (c) => c.runs.map((r) => score(r, analysis.goal));
  return confidenceGreater(scores(to), scores(from)) ?? 0.5;
}
function hullSteps(group, options, minGain, minEfficiency, confident) {
  const points = [{ cost: 0, delta: 0, candidate: null }, ...options.map((c) => ({ cost: c.cost, delta: c.delta, candidate: c }))].sort(
    (a, b) => a.cost - b.cost || b.delta - a.delta
  );
  const rising = [];
  for (const p of points) {
    const last = rising[rising.length - 1];
    if (last && (p.cost === last.cost || p.delta <= last.delta)) continue;
    rising.push(p);
  }
  const slope = (a, b) => (b.delta - a.delta) / (b.cost - a.cost);
  const hull = [];
  for (const p of rising) {
    while (hull.length >= 2 && slope(hull[hull.length - 2], hull[hull.length - 1]) <= slope(hull[hull.length - 1], p)) hull.pop();
    hull.push(p);
  }
  const steps = [];
  if (hull[0].candidate) steps.push({ group, to: hull[0].candidate, cost: 0, gain: hull[0].delta, efficiency: Infinity });
  let from = hull[0];
  let firstPaidEfficiency = null;
  for (let i = 1; i < hull.length; i++) {
    const to = hull[i];
    const gain = to.delta - from.delta;
    if (gain < (firstPaidEfficiency === null ? minGain : 2 * minGain) || !confident(from.candidate, to.candidate)) continue;
    const efficiency = gain / (to.cost - from.cost);
    if (efficiency < minEfficiency) break;
    if (firstPaidEfficiency === null) firstPaidEfficiency = efficiency;
    else if (efficiency < firstPaidEfficiency / 4) break;
    steps.push({ group, to: to.candidate, cost: to.cost - from.cost, gain, efficiency });
    from = to;
  }
  return steps;
}
function pickConsumable(list, gold) {
  const ok = list.filter((c) => c.significant && c.safe && c.delta > 0);
  if (!ok.length) return { value: null, max: null };
  const max = ok.reduce((a, b) => b.delta > a.delta + 1e-9 || Math.abs(b.delta - a.delta) <= 1e-9 && b.remove ? b : a);
  const preferStopping = (a, b) => (b.remove ? 1 : 0) - (a.remove ? 1 : 0);
  const value = gold > 0 ? max : ok.filter((c) => c.delta >= 0.5 * max.delta).sort((a, b) => a.costPerHourDelta - b.costPerHourDelta || preferStopping(a, b))[0];
  const stop = ok.find((c) => c.remove && c.slot === value.slot && c !== value && c.delta >= value.delta - STOP_TOLERANCE);
  const chosen = stop || value;
  return { value: chosen, max: max === chosen ? null : max };
}
function buildPlan(analysis, budget, spending = "balanced") {
  budget -= analysis.starter?.cost || 0;
  const minGain = 0.01;
  const minEfficiency = (SPENDING[spending] || SPENDING.balanced).minPctPerMillion / 100 / 1e6;
  const usable = (c) => c.significant && c.safe && c.delta > 0;
  const groups = /* @__PURE__ */ new Map();
  for (const c of analysis.gear.filter(usable)) {
    const key = c.slot === "main_hand" || c.slot === "two_hand" ? "weapon" : c.slot;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  for (const c of analysis.abilities.filter(usable)) {
    const key = c.kind === "abilityLevel" || c.replaces ? c.slot : "new-ability:" + c.hrid;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  for (const c of (analysis.house || []).filter(usable)) groups.set(c.slot, [...groups.get(c.slot) || [], c]);
  const confident = (from, to) => stepConfidence(analysis, from, to) >= CONFIDENCE_LEVEL;
  const steps = [...groups.entries()].flatMap(([key, options]) => hullSteps(key, options, minGain, minEfficiency, confident));
  steps.sort((a, b) => b.efficiency - a.efficiency || b.gain - a.gain);
  const chosen = /* @__PURE__ */ new Map();
  const blocked = /* @__PURE__ */ new Set();
  const freeAbilitySlots = [...analysis.emptyAbilitySlots];
  const usedAbilities = /* @__PURE__ */ new Set();
  let spent = 0;
  for (const step of steps) {
    if (blocked.has(step.group)) continue;
    const isNewAbility = step.group.startsWith("new-ability:");
    if (spent + step.cost > budget || isNewAbility && !freeAbilitySlots.length || usedAbilities.has(step.to.hrid)) {
      blocked.add(step.group);
      continue;
    }
    spent += step.cost;
    if (isNewAbility) {
      chosen.set(step.group, { ...step.to, slot: "ability" + freeAbilitySlots.shift() });
    } else {
      chosen.set(step.group, step.to);
    }
    if (step.to.kind === "ability") usedAbilities.add(step.to.hrid);
  }
  let picks = [...chosen.values()];
  if (picks.some((p) => p.slot === "two_hand")) picks = picks.filter((p) => p.slot !== "off_hand");
  const isWeapon = (p) => p.slot === "main_hand" || p.slot === "two_hand";
  const starter = analysis.starter && !picks.some(isWeapon) ? analysis.starter : null;
  if (analysis.starter) picks = picks.map((p) => isWeapon(p) ? { ...p, replaces: analysis.starter.replaces } : p);
  spent = picks.reduce((sum2, p) => sum2 + p.cost, 0) + (starter?.cost || 0);
  const drink = pickConsumable(analysis.drinks, analysis.goal.gold);
  const food = pickConsumable(analysis.food, analysis.goal.gold);
  const data = getClientData();
  if (food.value && !food.value.remove && picks.some((p) => p.extraFood && sameKind(p.extraFood, food.value.hrid, data))) food.value = null;
  const order = (analysis.orders || []).filter((c) => usable(c) && c.delta >= STOP_TOLERANCE).sort((a, b) => b.delta - a.delta)[0] || null;
  const gone = /* @__PURE__ */ new Set([...picks.filter((p) => p.kind === "ability" && p.replaces).map((p) => p.replaces), ...[food.value, drink.value].filter((p) => p?.remove || p?.replaces).map((p) => p.replaces || p.hrid)]);
  const triggers = [];
  for (const c of analysis.triggers || []) {
    if (!usable(c) || c.delta < STOP_TOLERANCE || gone.has(c.hrid) || triggers.some((t) => t.hrid === c.hrid)) continue;
    triggers.push(c);
  }
  return { picks, starter, spent, drink: drink.value, drinkMax: drink.max, food: food.value, foodMax: food.max, order, triggers };
}
function reorderAbilities(profile, order) {
  const slots = [];
  profile.abilities.forEach((entry, index) => {
    if (index > 0 && entry && order.includes(entry.hrid)) slots.push(index);
  });
  const entries = slots.map((i) => profile.abilities[i]).sort((a, b) => order.indexOf(a.hrid) - order.indexOf(b.hrid));
  slots.forEach((slot2, k) => profile.abilities[slot2] = entries[k]);
}
function putConsumable(list, slot2, hrid) {
  const index = Number(slot2.replace(/\D+/g, ""));
  while (list.length <= index) list.push(null);
  list[index] = hrid;
}
function applyPlan(profile, plan) {
  const result = cloneProfile(profile);
  for (const pick of plan.picks) {
    if (pick.kind === "gear") {
      equip(result, pick.slot, { hrid: pick.hrid, enhancementLevel: pick.enhancementLevel });
      if (pick.extraFood) putConsumable(result.food, "food" + pick.extraFoodSlot, pick.extraFood);
    } else if (pick.kind === "ability" || pick.kind === "abilityLevel") {
      result.abilities[Number(pick.slot.replace("ability", ""))] = { hrid: pick.hrid, level: pick.level };
      if (pick.triggers) result.abilityTriggers = { ...result.abilityTriggers || {}, [pick.hrid]: pick.triggers };
    } else if (pick.kind === "house") {
      result.houseRooms = { ...result.houseRooms, [pick.hrid]: pick.level };
    }
  }
  if (plan.order) reorderAbilities(result, plan.order.order);
  for (const t of plan.triggers || []) {
    const map = t.target === "ability" ? "abilityTriggers" : "consumableTriggers";
    result[map] = { ...result[map] || {}, [t.hrid]: t.triggers };
  }
  for (const pick of [plan.drink, plan.food]) {
    if (pick) putConsumable(pick.kind === "food" ? result.food : result.drinks, pick.slot, pick.remove ? null : pick.hrid);
  }
  return result;
}
var ACCURACY, CONFIDENCE_LEVEL, MAX_SEED_FACTOR, BASE_SEED_FACTOR, MAX_REFINED, REFINE_BELOW, seedFor, SPENDING, STYLE_STATS, PHYSICAL_STATS, MIN_GOLD_REF, RARE_DEATHS_PER_HOUR, acceptable, ENEMY_RESPAWN_SECONDS, MAX_ENCOUNTERS_PER_HOUR, summarize, MAX_LEVELS, LEVEL_STEPS, SKILL_STEPS, SCREEN_MARGIN, SCREEN_BELOW, NOT_SCREENED, TUNED_ABILITIES, TUNED_CONFIDENCE, STOP_TOLERANCE;
var init_analysis = __esm({
  "src/analysis.js"() {
    init_game_data();
    init_stats();
    init_profile();
    init_levels();
    init_skilling_upgrades();
    init_enhancing();
    init_sim_cache();
    init_triggers();
    ACCURACY = {
      fast: { label: "Fast", hours: 1, seeds: 3 },
      normal: { label: "Normal", hours: 2, seeds: 4 },
      thorough: { label: "Thorough", hours: 4, seeds: 6 }
    };
    CONFIDENCE_LEVEL = 0.9;
    MAX_SEED_FACTOR = 3;
    BASE_SEED_FACTOR = 3;
    MAX_REFINED = 40;
    REFINE_BELOW = 0.99;
    seedFor = (index) => Math.imul(index + 1, 2654435761) >>> 1 || 1;
    SPENDING = {
      frugal: { label: "Frugal", minPctPerMillion: 10 },
      balanced: { label: "Balanced", minPctPerMillion: 3 },
      all: { label: "All in", minPctPerMillion: 0 }
    };
    STYLE_STATS = {
      melee: ["stabAccuracy", "slashAccuracy", "smashAccuracy", "stabDamage", "slashDamage", "smashDamage", "meleeExperience", "defensiveDamage"],
      ranged: ["rangedAccuracy", "rangedDamage", "rangedExperience"],
      magic: ["magicAccuracy", "magicDamage", "magicExperience"]
    };
    PHYSICAL_STATS = ["physicalAmplify", "armorPenetration"];
    MIN_GOLD_REF = 1e3;
    RARE_DEATHS_PER_HOUR = 0.5;
    acceptable = (result, settings) => result.deaths <= deathLimit(settings);
    ENEMY_RESPAWN_SECONDS = 3;
    MAX_ENCOUNTERS_PER_HOUR = 3600 / ENEMY_RESPAWN_SECONDS;
    summarize = (runs, tier, profile) => enrich(average(runs), tier, profile);
    MAX_LEVELS = 5;
    LEVEL_STEPS = [1, 2, 3, 5, 10, 20];
    SKILL_STEPS = [1, 5];
    SCREEN_MARGIN = 0.01;
    SCREEN_BELOW = 0.02;
    NOT_SCREENED = /* @__PURE__ */ new Set(["skillLevel"]);
    TUNED_ABILITIES = 3;
    TUNED_CONFIDENCE = 0.8;
    STOP_TOLERANCE = 5e-3;
  }
});

// src/combat-plan.js
var combat_plan_exports = {};
__export(combat_plan_exports, {
  COMBAT_PLAN_DAYS: () => COMBAT_PLAN_DAYS,
  COMBAT_PLAN_DEFAULTS: () => COMBAT_PLAN_DEFAULTS,
  combatPlanSettings: () => combatPlanSettings,
  planCombat: () => planCombat,
  skillingAt: () => skillingAt,
  startSetup: () => startSetup
});
function combatPlanSettings(settings) {
  const s = { ...COMBAT_PLAN_DEFAULTS, ...settings || {} };
  if (!["magic", "ranged", "melee"].includes(s.style)) s.style = COMBAT_PLAN_DEFAULTS.style;
  if (!["any", "stab", "slash", "smash"].includes(s.meleeType)) s.meleeType = "any";
  s.days = Math.max(1, Math.min(90, Math.round(Number(s.days) || COMBAT_PLAN_DEFAULTS.days)));
  s.reserve = Math.max(0, Number(s.reserve) || 0);
  s.levelDays = Math.max(0, Math.min(30, Number(s.levelDays ?? COMBAT_PLAN_DEFAULTS.levelDays)));
  s.charms = !!s.charms;
  if (!ACCURACY[s.accuracy]) s.accuracy = "normal";
  return s;
}
function subStyleOf(data, hrid) {
  const first = data.itemDetailMap[hrid]?.equipmentDetail?.combatStats?.combatStyleHrids?.[0] || "";
  return first.startsWith("/combat_styles/") ? first.split("/").pop() : null;
}
function fitsStyle(data, hrid, s) {
  const item = data.itemDetailMap[hrid];
  if (styleOfItem(item) !== s.style) return false;
  return s.style !== "melee" || s.meleeType === "any" || subStyleOf(data, hrid) === s.meleeType;
}
function startSetup(setups, data, s) {
  if (s.setupId !== "auto") {
    const asked = setups.find((x) => x.id === s.setupId);
    if (asked) return asked;
  }
  const weaponFits = (x) => {
    const weapon = weaponOf(x.profile);
    return weapon && fitsStyle(data, weapon.hrid, s);
  };
  return setups.find((x) => x.id !== "equipped" && weaponFits(x)) || setups.find(weaponFits) || setups.find((x) => x.id === "equipped") || setups[0];
}
function withStyleWeapon(profile, data, s) {
  const weapon = weaponOf(profile);
  if (weapon && fitsStyle(data, weapon.hrid, s)) return { profile, starter: null };
  const fits = (item) => item.equipmentDetail && fitsStyle(data, item.hrid, s) && item.equipmentDetail.combatStats?.primaryTraining === SKILL(s.style) && meetsRequirements(profile, item.equipmentDetail.levelRequirements);
  const weapons = new Map(Object.values(data.itemDetailMap).filter(fits).map((item) => [item.hrid, item]));
  const owned = profile.inventory.filter((i) => weapons.has(i.hrid)).sort((a, b) => (weapons.get(b.hrid).itemLevel || 0) - (weapons.get(a.hrid).itemLevel || 0) || b.enhancementLevel - a.enhancementLevel)[0];
  let starter = null;
  if (owned) starter = { hrid: owned.hrid, enhancementLevel: owned.enhancementLevel, cost: 0, owned: true };
  else {
    for (const item of weapons.values()) {
      const price = askPrice(item.hrid, 0);
      if (price !== null && (!starter || price < starter.cost)) starter = { hrid: item.hrid, enhancementLevel: 0, cost: price, owned: false };
    }
  }
  if (!starter) throw new Error(`No ${s.style}${s.style === "melee" && s.meleeType !== "any" ? ` (${s.meleeType})` : ""} weapon you can wear is for sale.`);
  const variant = cloneProfile(profile);
  starter.slot = data.itemDetailMap[starter.hrid].equipmentDetail.type.split("/").pop();
  starter.replaces = weapon || null;
  equip(variant, starter.slot, { hrid: starter.hrid, enhancementLevel: starter.enhancementLevel });
  return { profile: variant, starter };
}
function keeper(data, s) {
  return (c) => {
    if (c.kind !== "gear") return true;
    if (c.slot === "charm" && !s.charms) return false;
    if (c.slot === "main_hand" || c.slot === "two_hand") return fitsStyle(data, c.hrid, s);
    return true;
  };
}
function skillingAt(skilling, day) {
  const list = skilling || [];
  const seg = list.find((x) => day >= x.from && day < x.to) || list[list.length - 1] || null;
  return seg ? { gold: Math.max(0, seg.perDay || 0) / BLOCKS_A_DAY, name: seg.name || null, skill: seg.skill || null } : { gold: 0, name: null, skill: null };
}
function skillingGold(skilling, fromBlock, blocks) {
  let sum2 = 0;
  for (let b = fromBlock; b < fromBlock + blocks; b++) sum2 += skillingAt(skilling, b / BLOCKS_A_DAY).gold;
  return sum2;
}
function addExperience(profile, xpPerHour, hours, table) {
  for (const skill of COMBAT_SKILLS) {
    const rate = xpPerHour?.[skill] || 0;
    if (!(rate > 0)) continue;
    const key = SKILL(skill);
    const now2 = experienceOf(table, profile.allExperience?.[key], profile.levels[skill]);
    const xp = now2 + rate * hours;
    const level = Math.floor(fractionalLevel(table, xp));
    profile.allExperience = { ...profile.allExperience, [key]: xp };
    const gained = level - profile.levels[skill];
    profile.levels[skill] = level;
    profile.allLevels = { ...profile.allLevels, [key]: level };
    if (gained > 0 && Number.isFinite(profile.totalLevel)) profile.totalLevel += gained;
  }
}
function levelsOf(profile, skills, table) {
  const out = {};
  for (const skill of skills) out[skill] = fractionalLevel(table, experienceOf(table, profile.allExperience?.[SKILL(skill)], profile.levels[skill]));
  return out;
}
function slim(profile) {
  return {
    equipment: profile.equipment,
    abilities: profile.abilities,
    food: profile.food,
    drinks: profile.drinks,
    abilityTriggers: profile.abilityTriggers,
    consumableTriggers: profile.consumableTriggers,
    houseRooms: profile.houseRooms
  };
}
function zonesToTry(last) {
  if (!last) return null;
  const data = getClientData();
  const picked = /* @__PURE__ */ new Map();
  for (const z of last.slice(0, ZONES_KEPT)) {
    picked.set(zoneKey(z.zone), z.zone);
    const max = Math.min(MAX_TIER, data.actionDetailMap[z.zone.zoneHrid]?.maxDifficulty ?? 0);
    if (z.zone.tier < max) {
      const up = { zoneHrid: z.zone.zoneHrid, tier: z.zone.tier + 1 };
      picked.set(zoneKey(up), up);
    }
  }
  return [...picked.values()];
}
function rankZones(results, settings) {
  const best = pickBestZone(results, settings);
  if (!best) return { best: null, ranked: [] };
  const fine = (z) => z.result.deaths <= (settings.acceptRareDeaths ? 0.5 : 0);
  const ranked = [...results].sort((a, b) => (fine(b) ? 1 : 0) - (fine(a) ? 1 : 0) || xpValue(b.result, settings) - xpValue(a.result, settings));
  return { best, ranked };
}
function purchaseOf(pick) {
  return {
    kind: pick.kind,
    slot: pick.slot,
    hrid: pick.hrid,
    bookHrid: pick.bookHrid || null,
    enhancementLevel: pick.enhancementLevel ?? null,
    level: pick.level ?? null,
    books: pick.books ?? (pick.kind === "ability" && pick.cost > 0 ? 1 : null),
    fromLevel: pick.fromLevel ?? null,
    materials: pick.materials ? pick.materials.map((m) => ({ hrid: m.hrid, count: m.count })) : null,
    cost: Math.round(pick.cost || 0),
    price: Math.round(pick.price ?? pick.cost ?? 0),
    owned: !!pick.owned,
    replaces: pick.replaces || null,
    sold: (pick.sold || []).map((g) => ({ hrid: g.hrid, enhancementLevel: g.enhancementLevel })),
    delta: pick.delta ?? null
  };
}
function planGain(plan) {
  let gain = 0;
  for (const p of plan.picks) gain += Math.max(0, p.delta || 0);
  for (const p of [plan.drink, plan.food, plan.order, ...plan.triggers || []]) if (p) gain += Math.max(0, p.delta || 0);
  return gain;
}
function putOn(profile, plan) {
  const next = applyPlan(profile, plan);
  for (const pick of plan.picks) {
    if (pick.kind === "ability" || pick.kind === "abilityLevel") {
      next.learnedAbilities = { ...next.learnedAbilities, [pick.hrid]: Math.max(pick.level, next.learnedAbilities?.[pick.hrid] || 0) };
      const table = getClientData()?.levelExperienceTable;
      if (table?.[pick.level] !== void 0) next.abilityExperience = { ...next.abilityExperience, [pick.hrid]: Math.max(table[pick.level], next.abilityExperience?.[pick.hrid] || 0) };
    }
    if (pick.kind === "gear") {
      const sold = new Set((pick.sold || []).map((g) => `${g.hrid}+${g.enhancementLevel}`));
      next.inventory = next.inventory.filter((i) => !sold.has(`${i.hrid}+${i.enhancementLevel}`));
      if (pick.owned) {
        const i = next.inventory.findIndex((x) => x.hrid === pick.hrid && x.enhancementLevel === pick.enhancementLevel);
        if (i >= 0) next.inventory.splice(i, 1);
      }
    }
  }
  return next;
}
function freeChanges(plan) {
  return { picks: plan.picks.filter((p) => !(p.cost > 0)), order: plan.order, triggers: plan.triggers, drink: null, food: null };
}
async function planCombat(pool, input, data, { onProgress = () => {
}, onStage = () => {
} } = {}) {
  const s = combatPlanSettings(input.settings);
  const table = data.levelExperienceTable;
  if (!Array.isArray(table)) throw new Error("The game's level table is missing.");
  const skills = styleSkills(s.style, data);
  const setup = startSetup(input.setups || [], data, s);
  if (!setup) throw new Error("No loadout to start from.");
  const keep = keeper(data, s);
  const accuracy = (name) => ({ ...ACCURACY[name] });
  const analysisSettings = (acc) => ({ countLevels: true, goldWeight: 0, acceptRareDeaths: s.acceptRareDeaths, spending: "all", maxTier: MAX_TIER, ...accuracy(acc), keep, noSkillLevels: true });
  const styled = withStyleWeapon(cloneProfile(setup.profile), data, s);
  let profile = styled.profile;
  let coins = Math.max(0, Number(input.coins) || 0) - (styled.starter?.cost || 0);
  const startProfile = cloneProfile(profile);
  const totalBlocks = s.days * BLOCKS_A_DAY;
  const segment = Math.max(BLOCKS_A_DAY, Math.ceil(totalBlocks / CHECKPOINTS));
  const checkpoints = Math.ceil(totalBlocks / segment);
  const phases = [];
  const stats = { combatBlocks: 0, skillingBlocks: 0, skillingGold: 0, spent: styled.starter?.cost || 0, combatProfit: 0 };
  let lastZones = null;
  const seen = /* @__PURE__ */ new Set();
  const useful = /* @__PURE__ */ new Set();
  const candidateKey = (c) => [c.kind, c.slot === "main_hand" || c.slot === "two_hand" ? "weapon" : c.kind === "gear" ? c.slot : "", c.hrid, c.enhancementLevel ?? "", c.level ?? "", c.extraFood ?? ""].join("|");
  const keepNow = (c) => keep(c) && (seen.size === 0 || c.kind === "abilityOrder" || !seen.has(candidateKey(c)) || useful.has(candidateKey(c)));
  let tuned = false;
  let block = 0;
  let lastRate = null;
  const progress = (stage) => (done, total) => onProgress(stage, done, total);
  for (let cp = 0; block < totalBlocks; cp++) {
    const acc = cp === 0 ? s.accuracy : "fast";
    const aset = analysisSettings(acc);
    const stage = `checkpoint ${cp + 1}/${checkpoints}`;
    const zoneResults = await analyzeZones(pool, profile, { ...aset, zones: zonesToTry(lastZones) }, progress(stage + ": zones"));
    let { best, ranked } = rankZones(zoneResults, aset);
    lastZones = ranked;
    if (!best) throw new Error("No combat zone to simulate.");
    const remaining = totalBlocks - block;
    const n = Math.min(segment, remaining);
    const reach = Math.max(0, coins - s.reserve) + skillingGold(input.skilling, block, remaining) / 2;
    const raw = await analyzeUpgrades(pool, profile, best.zone, { ...aset, budget: reach, noTriggers: true, keep: keepNow }, progress(stage + ": upgrades"), progress(stage + ": upgrades"));
    const rated = rateUpgrades(raw, aset);
    const baseValue = xpValue(raw.base, aset);
    for (const c of raw.candidates) {
      seen.add(candidateKey(c));
      if (c.result && xpValue(c.result, aset) > baseValue) useful.add(candidateKey(c));
    }
    const rateNow = xpValue(rated.base, aset) * 24;
    const upkeep = (blocks) => Math.max(0, -(rated.base.profit || 0)) * blocks * BLOCK_HOURS;
    const earns = skillingGold(input.skilling, block, remaining) > 0;
    const minSkilling = earns && coins < s.reserve ? blocksFor(input.skilling, block, s.reserve - coins, remaining) : 0;
    let choice = null;
    for (let k2 = minSkilling; k2 <= remaining; k2 += k2 < segment ? 1 : segment) {
      const avail = Math.max(0, coins - s.reserve + skillingGold(input.skilling, block, k2) - upkeep(Math.max(0, n - k2)));
      const plan2 = buildPlan(rated, avail, "all");
      const rate = rateNow * (1 + planGain(plan2));
      const value = rate * (remaining - k2) / BLOCKS_A_DAY + s.levelDays * rate;
      if (!choice || value > choice.value + 1e-9) choice = { k: k2, value, plan: plan2 };
      if (k2 >= remaining) break;
    }
    const k = Math.min(choice.k, n);
    if (k > 0) {
      const gold = skillingGold(input.skilling, block, k);
      const job = skillingAt(input.skilling, block / BLOCKS_A_DAY);
      coins += gold;
      stats.skillingBlocks += k;
      stats.skillingGold += gold;
      phases.push({ kind: "skilling", from: block / BLOCKS_A_DAY, to: (block + k) / BLOCKS_A_DAY, blocks: k, job: job.name, skill: job.skill, gold: Math.round(gold), coins: Math.round(coins), why: choice.k > n ? "saving up" : "for the purchases" });
      block += k;
    }
    if (choice.k >= n && k === n) {
      onStage(stage);
      continue;
    }
    const plan = buildPlan(rated, Math.max(0, coins - s.reserve - upkeep(n - k)), "all");
    const buys = plan.picks.filter((p) => p.cost > 0 || !p.owned).map(purchaseOf);
    const changes = [];
    if (plan.picks.length || plan.order || plan.drink || plan.food || plan.triggers?.length) {
      profile = putOn(profile, plan);
      coins -= plan.spent;
      stats.spent += plan.spent;
      for (const p of plan.picks.filter((x) => x.owned && !(x.cost > 0))) changes.push(purchaseOf(p));
      for (const c of [plan.drink, plan.food]) if (c) changes.push({ kind: c.kind, slot: c.slot, hrid: c.remove ? null : c.hrid, replaces: c.replaces || (c.remove ? c.hrid : null) });
      if (plan.order) changes.push({ kind: "order", order: plan.order.order });
    }
    let triggerChanges2 = [];
    if (!tuned) {
      const free = await analyzeUpgrades(pool, profile, best.zone, { ...aset, scope: "abilities", budget: 0 }, progress(stage + ": triggers"), progress(stage + ": triggers"));
      const freePlan = buildPlan(rateUpgrades(free, aset), 0, "all");
      const apply = freeChanges(freePlan);
      if (apply.picks.length || apply.order || apply.triggers?.length) profile = putOn(profile, apply);
      for (const p of apply.picks) {
        const i = buys.findIndex((b) => b.kind === "ability" && b.hrid === p.replaces);
        if (i < 0) continue;
        coins += buys[i].cost;
        stats.spent -= buys[i].cost;
        buys.splice(i, 1);
      }
      triggerChanges2 = (apply.triggers || []).map((t) => ({ hrid: t.hrid, target: t.target, triggers: t.triggers, was: t.was, why: t.why }));
      if (apply.order) changes.push({ kind: "order", order: apply.order.order });
      for (const p of apply.picks) changes.push(purchaseOf(p));
      tuned = true;
    }
    const again = await analyzeZones(pool, profile, { ...aset, zones: zonesToTry(ranked) }, progress(stage + ": zones"));
    ({ best, ranked } = rankZones(again, aset));
    lastZones = ranked;
    const [measured2] = await simulateVariants(pool, [{ profile }], best.zone, aset, progress(stage + ": measuring"));
    const r = measured2.result;
    let fight = n - k;
    const short = s.reserve - (coins + Math.min(0, r.profit) * fight * BLOCK_HOURS);
    if (short > 0 && earns && fight > 1) {
      const extra = Math.min(fight - 1, blocksFor(input.skilling, block, short, fight - 1));
      const gold = skillingGold(input.skilling, block, extra);
      coins += gold;
      stats.skillingBlocks += extra;
      stats.skillingGold += gold;
      const job = skillingAt(input.skilling, block / BLOCKS_A_DAY);
      phases.push({ kind: "skilling", from: block / BLOCKS_A_DAY, to: (block + extra) / BLOCKS_A_DAY, blocks: extra, job: job.name, skill: job.skill, gold: Math.round(gold), coins: Math.round(coins), why: "for the fight's drinks and food" });
      block += extra;
      fight -= extra;
    }
    const hours = fight * BLOCK_HOURS;
    const levelsBefore = levelsOf(profile, skills, table);
    addExperience(profile, r.xp, hours, table);
    coins += r.profit * hours;
    stats.combatBlocks += fight;
    stats.combatProfit += r.profit * hours;
    lastRate = { levelsPerDay: xpValue(r, aset) * 24, xpPerHour: r.xp };
    const levelsAfter = levelsOf(profile, skills, table);
    phases.push({
      kind: "combat",
      from: block / BLOCKS_A_DAY,
      to: (block + fight) / BLOCKS_A_DAY,
      blocks: fight,
      zone: best.zone,
      loadout: slim(profile),
      buys,
      changes,
      triggers: triggerChanges2,
      rates: {
        xpPerHour: r.xp,
        levelsPerDay: lastRate.levelsPerDay,
        profitPerHour: Math.round(r.profit),
        lootPerHour: Math.round(r.loot),
        costPerHour: Math.round(r.cost),
        deathsPerHour: r.deaths,
        consumablesPerHour: r.consumables,
        encountersPerHour: r.encounters
      },
      gained: Object.fromEntries(skills.map((x) => [x, levelsAfter[x] - levelsBefore[x]])),
      levels: Object.fromEntries(Object.entries(levelsAfter).map(([x, v]) => [x, Math.floor(v)])),
      coins: Math.round(coins)
    });
    block += fight;
    onStage(stage);
  }
  const end = levelsOf(profile, skills, table);
  const start = levelsOf(startProfile, skills, table);
  const endRate = lastRate?.levelsPerDay || 0;
  const result = {
    settings: s,
    setup: { id: setup.id, name: setup.name },
    skills,
    starter: styled.starter ? purchaseOf({ kind: "gear", ...styled.starter, owned: styled.starter.owned }) : null,
    start: { levels: start, coins: Math.round(Number(input.coins) || 0) },
    end: { levels: end, coins: Math.round(coins), levelsPerDay: endRate },
    gained: sum(end) - sum(start),
    score: sum(end) + s.levelDays * endRate,
    phases: mergePhases(phases),
    stats: { ...stats, spent: Math.round(stats.spent), skillingGold: Math.round(stats.skillingGold), combatProfit: Math.round(stats.combatProfit) },
    // What skilling would have earned in the combat blocks (the 📈 plan's jobs).
    skillingForgone: Math.round(forgone(input.skilling, phases))
  };
  result.baseline = await baseline(pool, startProfile, s, skills, table, analysisSettings, progress("as you are"));
  return result;
}
function blocksFor(skilling, fromBlock, need, max) {
  let got = 0;
  for (let k = 1; k <= max; k++) {
    got += skillingAt(skilling, (fromBlock + k - 1) / BLOCKS_A_DAY).gold;
    if (got >= need) return k;
  }
  return max;
}
function forgone(skilling, phases) {
  let total = 0;
  for (const p of phases) if (p.kind === "combat") total += skillingGold(skilling, Math.round(p.from * BLOCKS_A_DAY), p.blocks);
  return total;
}
function mergePhases(phases) {
  const out = [];
  for (const p of phases) {
    const last = out[out.length - 1];
    const same = last && last.kind === p.kind && (p.kind === "skilling" ? last.job === p.job : zoneKey(last.zone) === zoneKey(p.zone) && !p.buys.length && !p.changes.length && !p.triggers.length && JSON.stringify(last.loadout) === JSON.stringify(p.loadout));
    if (!same) {
      out.push({ ...p });
      continue;
    }
    last.to = p.to;
    last.blocks += p.blocks;
    last.coins = p.coins;
    if (p.kind === "skilling") last.gold += p.gold;
    else {
      for (const [x, v] of Object.entries(p.gained)) last.gained[x] = (last.gained[x] || 0) + v;
      last.levels = p.levels;
      last.rates = p.rates;
    }
  }
  return out;
}
async function baseline(pool, startProfile, s, skills, table, analysisSettings, onProgress) {
  const profile = cloneProfile(startProfile);
  const totalBlocks = s.days * BLOCKS_A_DAY;
  const segment = Math.max(BLOCKS_A_DAY, Math.ceil(totalBlocks / CHECKPOINTS));
  const aset = analysisSettings("fast");
  let last = null;
  let rate = 0;
  let profit = 0;
  for (let block = 0; block < totalBlocks; block += segment) {
    const n = Math.min(segment, totalBlocks - block);
    const results = await analyzeZones(pool, profile, { ...aset, zones: zonesToTry(last) }, onProgress);
    const { best, ranked } = rankZones(results, aset);
    last = ranked;
    const r = best.result;
    addExperience(profile, r.xp, n * BLOCK_HOURS, table);
    profit += r.profit * n * BLOCK_HOURS;
    rate = xpValue(r, aset) * 24;
  }
  const start = levelsOf(startProfile, skills, table);
  const end = levelsOf(profile, skills, table);
  return { levels: end, gained: sum(end) - sum(start), levelsPerDay: rate, score: sum(end) + s.levelDays * rate, combatProfit: Math.round(profit) };
}
var COMBAT_PLAN_DEFAULTS, COMBAT_PLAN_DAYS, BLOCK_HOURS, BLOCKS_A_DAY, CHECKPOINTS, MAX_TIER, ZONES_KEPT, SKILL, sum, zoneKey;
var init_combat_plan = __esm({
  "src/combat-plan.js"() {
    init_game_data();
    init_analysis();
    init_profile();
    init_levels();
    COMBAT_PLAN_DEFAULTS = {
      style: "magic",
      // magic | ranged | melee
      meleeType: "any",
      // any | stab | slash | smash
      days: 30,
      reserve: 5e6,
      charms: false,
      // charms put their XP into one skill
      levelDays: 7,
      setupId: "auto",
      accuracy: "normal",
      acceptRareDeaths: false
    };
    COMBAT_PLAN_DAYS = [7, 14, 30, 60, 90];
    BLOCK_HOURS = 8;
    BLOCKS_A_DAY = 24 / BLOCK_HOURS;
    CHECKPOINTS = 10;
    MAX_TIER = 5;
    ZONES_KEPT = 10;
    SKILL = (name) => "/skills/" + name;
    sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
    zoneKey = (z) => `${z.zoneHrid}#${z.tier}`;
  }
});

// pi/combat-plan-entry.js
import os from "node:os";
import { existsSync as existsSync2, readFileSync as readFileSync2, renameSync, writeFileSync } from "node:fs";
import path2 from "node:path";
import { isMainThread, parentPort, workerData } from "node:worker_threads";

// engine/combatUtilities.js
var CombatUtilities = class _CombatUtilities {
  static getTarget(enemies) {
    if (!enemies) {
      return null;
    }
    let target = enemies.find((enemy) => enemy.combatDetails.currentHitpoints > 0);
    return target ?? null;
  }
  static randomInt(min, max) {
    if (max < min) {
      let temp = min;
      min = max;
      max = temp;
    }
    let minCeil = Math.ceil(min);
    let maxFloor = Math.floor(max);
    if (Math.floor(min) == maxFloor) {
      return Math.floor((min + max) / 2 + Math.random());
    }
    let minTail = -1 * (min - minCeil);
    let maxTail = max - maxFloor;
    let balancedWeight = 2 * minTail + (maxFloor - minCeil);
    let balancedAverage = (maxFloor + minCeil) / 2;
    let average2 = (max + min) / 2;
    let extraTailWeight = balancedWeight * (average2 - balancedAverage) / (maxFloor + 1 - average2);
    let extraTailChance = Math.abs(extraTailWeight / (extraTailWeight + balancedWeight));
    if (Math.random() < extraTailChance) {
      if (maxTail > minTail) {
        return Math.floor(maxFloor + 1);
      } else {
        return Math.floor(minCeil - 1);
      }
    }
    if (maxTail > minTail) {
      return Math.floor(min + Math.random() * (maxFloor + minTail - min + 1));
    } else {
      return Math.floor(minCeil - maxTail + Math.random() * (max - (minCeil - maxTail) + 1));
    }
  }
  static processAttack(source, target, abilityEffect = null) {
    let combatStyle = abilityEffect ? abilityEffect.combatStyleHrid : source.combatDetails.combatStats.combatStyleHrid;
    let damageType = abilityEffect ? abilityEffect.damageType : source.combatDetails.combatStats.damageType;
    let sourceAccuracyRating = 1;
    let sourceAutoAttackMaxDamage = 1;
    let targetEvasionRating = 1;
    switch (combatStyle) {
      case "/combat_styles/stab":
        sourceAccuracyRating = source.combatDetails.stabAccuracyRating;
        sourceAutoAttackMaxDamage = source.combatDetails.stabMaxDamage;
        targetEvasionRating = target.combatDetails.stabEvasionRating;
        break;
      case "/combat_styles/slash":
        sourceAccuracyRating = source.combatDetails.slashAccuracyRating;
        sourceAutoAttackMaxDamage = source.combatDetails.slashMaxDamage;
        targetEvasionRating = target.combatDetails.slashEvasionRating;
        break;
      case "/combat_styles/smash":
        sourceAccuracyRating = source.combatDetails.smashAccuracyRating;
        sourceAutoAttackMaxDamage = source.combatDetails.smashMaxDamage;
        targetEvasionRating = target.combatDetails.smashEvasionRating;
        break;
      case "/combat_styles/ranged":
        sourceAccuracyRating = source.combatDetails.rangedAccuracyRating;
        sourceAutoAttackMaxDamage = source.combatDetails.rangedMaxDamage;
        targetEvasionRating = target.combatDetails.rangedEvasionRating;
        break;
      case "/combat_styles/magic":
        sourceAccuracyRating = source.combatDetails.magicAccuracyRating;
        sourceAutoAttackMaxDamage = source.combatDetails.magicMaxDamage;
        targetEvasionRating = target.combatDetails.magicEvasionRating;
        break;
      default:
        throw new Error("Unknown combat style: " + combatStyle);
    }
    let sourceDamageMultiplier = 1;
    let sourceResistance = 0;
    let sourcePenetration = 0;
    let targetResistance = 0;
    let targetThornPower = 0;
    let targetPenetration = 0;
    let thornType;
    switch (damageType) {
      case "/damage_types/physical":
        sourceDamageMultiplier = 1 + source.combatDetails.combatStats.physicalAmplify;
        sourceResistance = source.combatDetails.totalArmor;
        sourcePenetration = source.combatDetails.combatStats.armorPenetration;
        targetResistance = target.combatDetails.totalArmor;
        targetThornPower = target.combatDetails.combatStats.physicalThorns;
        targetPenetration = target.combatDetails.combatStats.armorPenetration;
        thornType = "physicalThorns";
        break;
      case "/damage_types/water":
        sourceDamageMultiplier = 1 + source.combatDetails.combatStats.waterAmplify;
        sourceResistance = source.combatDetails.totalWaterResistance;
        sourcePenetration = source.combatDetails.combatStats.waterPenetration;
        targetResistance = target.combatDetails.totalWaterResistance;
        targetThornPower = target.combatDetails.combatStats.elementalThorns;
        targetPenetration = target.combatDetails.combatStats.waterPenetration;
        thornType = "elementalThorns";
        break;
      case "/damage_types/nature":
        sourceDamageMultiplier = 1 + source.combatDetails.combatStats.natureAmplify;
        sourceResistance = source.combatDetails.totalNatureResistance;
        sourcePenetration = source.combatDetails.combatStats.naturePenetration;
        targetResistance = target.combatDetails.totalNatureResistance;
        targetThornPower = target.combatDetails.combatStats.elementalThorns;
        targetPenetration = target.combatDetails.combatStats.naturePenetration;
        thornType = "elementalThorns";
        break;
      case "/damage_types/fire":
        sourceDamageMultiplier = 1 + source.combatDetails.combatStats.fireAmplify;
        sourceResistance = source.combatDetails.totalFireResistance;
        sourcePenetration = source.combatDetails.combatStats.firePenetration;
        targetResistance = target.combatDetails.totalFireResistance;
        targetThornPower = target.combatDetails.combatStats.elementalThorns;
        targetPenetration = target.combatDetails.combatStats.firePenetration;
        thornType = "elementalThorns";
        break;
      default:
        throw new Error("Unknown damage type: " + damageType);
    }
    let hitChance = 1;
    let critChance = 0;
    let isCrit = false;
    let bonusCritChance = source.combatDetails.combatStats.criticalRate;
    let bonusCritDamage = source.combatDetails.combatStats.criticalDamage;
    if (abilityEffect) {
      sourceAccuracyRating *= 1 + abilityEffect.bonusAccuracyRatio;
    }
    if (source.isWeakened) {
      sourceAccuracyRating = sourceAccuracyRating - source.weakenPercentage * sourceAccuracyRating;
    }
    hitChance = Math.pow(sourceAccuracyRating, 1.4) / (Math.pow(sourceAccuracyRating, 1.4) + Math.pow(targetEvasionRating, 1.4));
    if (combatStyle == "/combat_styles/ranged") {
      critChance = 0.3 * hitChance;
    }
    critChance = critChance + bonusCritChance;
    let baseDamageFlat = abilityEffect ? abilityEffect.damageFlat : 0;
    let baseDamageRatio = abilityEffect ? abilityEffect.damageRatio : 1;
    let armorDamageRatioFlat = abilityEffect ? abilityEffect.armorDamageRatio * source.combatDetails.totalArmor : 0;
    let sourceMinDamage = sourceDamageMultiplier * (1 + baseDamageFlat + armorDamageRatioFlat);
    let sourceMaxDamage = sourceDamageMultiplier * (baseDamageRatio * sourceAutoAttackMaxDamage + baseDamageFlat + armorDamageRatioFlat);
    if (Math.random() < critChance) {
      sourceMaxDamage = sourceMaxDamage * (1 + bonusCritDamage);
      sourceMinDamage = sourceMaxDamage;
      isCrit = true;
    }
    let damageRoll = _CombatUtilities.randomInt(sourceMinDamage, sourceMaxDamage);
    damageRoll *= 1 + source.combatDetails.combatStats.taskDamage;
    damageRoll *= 1 + target.combatDetails.combatStats.damageTaken;
    if (!abilityEffect) {
      damageRoll += damageRoll * source.combatDetails.combatStats.autoAttackDamage;
    } else {
      damageRoll *= 1 + source.combatDetails.combatStats.abilityDamage;
    }
    let damageDone = 0;
    let thornDamageDone = 0;
    let didHit = false;
    if (Math.random() < hitChance) {
      didHit = true;
      let penetratedTargetResistance = targetResistance;
      if (sourcePenetration > 0 && targetResistance > 0) {
        penetratedTargetResistance = targetResistance / (1 + sourcePenetration);
      }
      let targetDamageTakenRatio = 100 / (100 + penetratedTargetResistance);
      if (penetratedTargetResistance < 0) {
        targetDamageTakenRatio = (100 - penetratedTargetResistance) / 100;
      }
      let mitigatedDamage = Math.ceil(targetDamageTakenRatio * damageRoll);
      damageDone = Math.min(mitigatedDamage, target.combatDetails.currentHitpoints);
      target.combatDetails.currentHitpoints -= damageDone;
    }
    if (targetThornPower > 0 && targetResistance > -99) {
      let penetratedSourceResistance = sourceResistance;
      if (sourceResistance > 0) {
        penetratedSourceResistance = sourceResistance / (1 + targetPenetration);
      }
      let sourceDamageTakenRatio = 100 / (100 + penetratedSourceResistance);
      if (penetratedSourceResistance < 0) {
        sourceDamageTakenRatio = (100 - penetratedSourceResistance) / 100;
      }
      let targetTaskDamageMultiplier = 1 + target.combatDetails.combatStats.taskDamage;
      let sourceDamageTakenMultiplier = 1 + source.combatDetails.combatStats.damageTaken;
      let targetDamageMultiplier = targetTaskDamageMultiplier * sourceDamageTakenMultiplier;
      let thornsDamageRoll = _CombatUtilities.randomInt(
        1,
        targetDamageMultiplier * target.combatDetails.defensiveMaxDamage * (1 + targetResistance / 100) * targetThornPower
      );
      let mitigatedThornsDamage = Math.ceil(sourceDamageTakenRatio * thornsDamageRoll);
      thornDamageDone = Math.min(mitigatedThornsDamage, source.combatDetails.currentHitpoints);
      source.combatDetails.currentHitpoints -= thornDamageDone;
    }
    let retaliationDamageDone = 0;
    if (target.combatDetails.combatStats.retaliation > 0) {
      let retaliationHitChance = Math.pow(target.combatDetails.smashAccuracyRating, 1.4) / (Math.pow(target.combatDetails.smashAccuracyRating, 1.4) + Math.pow(source.combatDetails.smashEvasionRating, 1.4));
      if (retaliationHitChance > Math.random()) {
        let sourceEffectiveArmor = source.combatDetails.totalArmor;
        if (sourceEffectiveArmor > 0) {
          sourceEffectiveArmor = sourceEffectiveArmor / (1 + target.combatDetails.combatStats.armorPenetration);
        }
        let sourceDamageTakenRatio = 100 / (100 + sourceEffectiveArmor);
        if (sourceEffectiveArmor < 0) {
          sourceDamageTakenRatio = (100 - sourceEffectiveArmor) / 100;
        }
        let targetTaskDamageMultiplier = 1 + target.combatDetails.combatStats.taskDamage;
        let sourceDamageTakenMultiplier = 1 + source.combatDetails.combatStats.damageTaken;
        let retaliationDamageMultiplier = targetTaskDamageMultiplier * sourceDamageTakenMultiplier;
        let premitigatedDamage = damageRoll;
        premitigatedDamage = Math.min(premitigatedDamage, target.combatDetails.defensiveMaxDamage * 5);
        let retaliationMinDamage = retaliationDamageMultiplier * target.combatDetails.combatStats.retaliation * premitigatedDamage;
        let retaliationMaxDamage = retaliationDamageMultiplier * target.combatDetails.combatStats.retaliation * (target.combatDetails.defensiveMaxDamage + premitigatedDamage);
        let retaliationDamageRoll = _CombatUtilities.randomInt(retaliationMinDamage, retaliationMaxDamage);
        let mitigatedRetaliationDamage = Math.ceil(sourceDamageTakenRatio * retaliationDamageRoll);
        retaliationDamageDone = Math.min(mitigatedRetaliationDamage, source.combatDetails.currentHitpoints);
        source.combatDetails.currentHitpoints -= retaliationDamageDone;
      }
    }
    let lifeStealHeal = 0;
    if (!abilityEffect && didHit && source.combatDetails.combatStats.lifeSteal > 0) {
      lifeStealHeal = source.addHitpoints(Math.floor(source.combatDetails.combatStats.lifeSteal * damageDone));
    }
    let hpDrain = 0;
    if (abilityEffect && didHit && abilityEffect.hpDrainRatio > 0) {
      let healingAmplify = 1 + source.combatDetails.combatStats.healingAmplify;
      hpDrain = source.addHitpoints(Math.floor(abilityEffect.hpDrainRatio * damageDone * healingAmplify));
    }
    let manaLeechMana = 0;
    if (!abilityEffect && didHit && source.combatDetails.combatStats.manaLeech > 0) {
      manaLeechMana = source.addManapoints(Math.floor(source.combatDetails.combatStats.manaLeech * damageDone));
    }
    return { damageDone, didHit, thornDamageDone, thornType, retaliationDamageDone, lifeStealHeal, hpDrain, manaLeechMana, isCrit };
  }
  static processHeal(source, abilityEffect, target) {
    if (abilityEffect.combatStyleHrid != "/combat_styles/magic") {
      throw new Error("Heal ability effect not supported for combat style: " + abilityEffect.combatStyleHrid);
    }
    let healingAmplify = 1 + source.combatDetails.combatStats.healingAmplify;
    let magicMaxDamage = source.combatDetails.magicMaxDamage;
    let baseHealFlat = abilityEffect.damageFlat;
    let baseHealRatio = abilityEffect.damageRatio;
    let minHeal = healingAmplify * (1 + baseHealFlat);
    let maxHeal = healingAmplify * (baseHealRatio * magicMaxDamage + baseHealFlat);
    let heal = this.randomInt(minHeal, maxHeal);
    let amountHealed = target.addHitpoints(heal);
    return amountHealed;
  }
  static processRevive(source, abilityEffect, target) {
    if (abilityEffect.combatStyleHrid != "/combat_styles/magic") {
      throw new Error("Heal ability effect not supported for combat style: " + abilityEffect.combatStyleHrid);
    }
    let healingAmplify = 1 + source.combatDetails.combatStats.healingAmplify;
    let magicMaxDamage = source.combatDetails.magicMaxDamage;
    let baseHealFlat = abilityEffect.damageFlat;
    let baseHealRatio = abilityEffect.damageRatio;
    let minHeal = healingAmplify * (1 + baseHealFlat);
    let maxHeal = healingAmplify * (baseHealRatio * magicMaxDamage + baseHealFlat);
    let heal = this.randomInt(minHeal, maxHeal);
    let amountHealed = target.addHitpoints(heal);
    target.combatDetails.currentManapoints = target.combatDetails.maxManapoints;
    target.clearCCs();
    return amountHealed;
  }
  static processSpendHp(source, abilityEffect) {
    let currentHp = source.combatDetails.currentHitpoints;
    let spendHpRatio = abilityEffect.spendHpRatio;
    let spentHp = Math.floor(currentHp * spendHpRatio);
    source.combatDetails.currentHitpoints -= spentHp;
    return spentHp;
  }
  static calculateTickValue(totalValue, totalTicks, currentTick) {
    let currentSum = Math.floor(currentTick * totalValue / totalTicks);
    let previousSum = Math.floor((currentTick - 1) * totalValue / totalTicks);
    return currentSum - previousSum;
  }
};
var combatUtilities_default = CombatUtilities;

// engine/events/combatEvent.js
var CombatEvent = class {
  constructor(type, time) {
    this.type = type;
    this.time = time;
  }
};
var combatEvent_default = CombatEvent;

// engine/events/autoAttackEvent.js
var AutoAttackEvent = class _AutoAttackEvent extends combatEvent_default {
  static type = "autoAttack";
  constructor(time, source) {
    super(_AutoAttackEvent.type, time);
    this.source = source;
  }
};
var autoAttackEvent_default = AutoAttackEvent;

// engine/events/damageOverTimeEvent.js
var DamageOverTimeEvent = class _DamageOverTimeEvent extends combatEvent_default {
  static type = "damageOverTime";
  constructor(time, sourceRef, target, damage, totalTicks, currentTick, combatStyleHrid) {
    super(_DamageOverTimeEvent.type, time);
    this.sourceRef = sourceRef;
    this.target = target;
    this.damage = damage;
    this.totalTicks = totalTicks;
    this.currentTick = currentTick;
    this.combatStyleHrid = combatStyleHrid;
  }
};
var damageOverTimeEvent_default = DamageOverTimeEvent;

// engine/events/checkBuffExpirationEvent.js
var CheckBuffExpirationEvent = class _CheckBuffExpirationEvent extends combatEvent_default {
  static type = "checkBuffExpiration";
  constructor(time, source) {
    super(_CheckBuffExpirationEvent.type, time);
    this.source = source;
  }
};
var checkBuffExpirationEvent_default = CheckBuffExpirationEvent;

// engine/events/combatStartEvent.js
var CombatStartEvent = class _CombatStartEvent extends combatEvent_default {
  static type = "combatStart";
  constructor(time) {
    super(_CombatStartEvent.type, time);
  }
};
var combatStartEvent_default = CombatStartEvent;

// engine/events/consumableTickEvent.js
var ConsumableTickEvent = class _ConsumableTickEvent extends combatEvent_default {
  static type = "consumableTick";
  constructor(time, source, consumable, totalTicks, currentTick) {
    super(_ConsumableTickEvent.type, time);
    this.source = source;
    this.consumable = consumable;
    this.totalTicks = totalTicks;
    this.currentTick = currentTick;
  }
};
var consumableTickEvent_default = ConsumableTickEvent;

// engine/events/cooldownReadyEvent.js
var CooldownReadyEvent = class _CooldownReadyEvent extends combatEvent_default {
  static type = "cooldownReady";
  constructor(time) {
    super(_CooldownReadyEvent.type, time);
  }
};
var cooldownReadyEvent_default = CooldownReadyEvent;

// engine/events/enemyRespawnEvent.js
var EnemyRespawnEvent = class _EnemyRespawnEvent extends combatEvent_default {
  static type = "enemyRespawn";
  constructor(time) {
    super(_EnemyRespawnEvent.type, time);
  }
};
var enemyRespawnEvent_default = EnemyRespawnEvent;

// node_modules/heap-js/dist/heap-js.es5.js
var __awaiter = function(thisArg, _arguments, P, generator) {
  function adopt(value) {
    return value instanceof P ? value : new P(function(resolve) {
      resolve(value);
    });
  }
  return new (P || (P = Promise))(function(resolve, reject) {
    function fulfilled(value) {
      try {
        step(generator.next(value));
      } catch (e) {
        reject(e);
      }
    }
    function rejected(value) {
      try {
        step(generator["throw"](value));
      } catch (e) {
        reject(e);
      }
    }
    function step(result) {
      result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected);
    }
    step((generator = generator.apply(thisArg, _arguments || [])).next());
  });
};
var __generator$1 = function(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
};
var __read$1 = function(o, n) {
  var m = typeof Symbol === "function" && o[Symbol.iterator];
  if (!m) return o;
  var i = m.call(o), r, ar = [], e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i["return"])) m.call(i);
    } finally {
      if (e) throw e.error;
    }
  }
  return ar;
};
var __spreadArray$1 = function(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};
var __values = function(o) {
  var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
  if (m) return m.call(o);
  if (o && typeof o.length === "number") return {
    next: function() {
      if (o && i >= o.length) o = void 0;
      return { value: o && o[i++], done: !o };
    }
  };
  throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var HeapAsync = (
  /** @class */
  (function() {
    function HeapAsync2(compare) {
      if (compare === void 0) {
        compare = HeapAsync2.minComparator;
      }
      var _this = this;
      this.compare = compare;
      this.heapArray = [];
      this._limit = 0;
      this.offer = this.add;
      this.element = this.peek;
      this.poll = this.pop;
      this._invertedCompare = function(a, b) {
        return _this.compare(a, b).then(function(res) {
          return -1 * res;
        });
      };
    }
    HeapAsync2.getChildrenIndexOf = function(idx) {
      return [idx * 2 + 1, idx * 2 + 2];
    };
    HeapAsync2.getParentIndexOf = function(idx) {
      if (idx <= 0) {
        return -1;
      }
      var whichChildren = idx % 2 ? 1 : 2;
      return Math.floor((idx - whichChildren) / 2);
    };
    HeapAsync2.getSiblingIndexOf = function(idx) {
      if (idx <= 0) {
        return -1;
      }
      var whichChildren = idx % 2 ? 1 : -1;
      return idx + whichChildren;
    };
    HeapAsync2.minComparator = function(a, b) {
      return __awaiter(this, void 0, void 0, function() {
        return __generator$1(this, function(_a) {
          if (a > b) {
            return [2, 1];
          } else if (a < b) {
            return [2, -1];
          } else {
            return [2, 0];
          }
        });
      });
    };
    HeapAsync2.maxComparator = function(a, b) {
      return __awaiter(this, void 0, void 0, function() {
        return __generator$1(this, function(_a) {
          if (b > a) {
            return [2, 1];
          } else if (b < a) {
            return [2, -1];
          } else {
            return [2, 0];
          }
        });
      });
    };
    HeapAsync2.minComparatorNumber = function(a, b) {
      return __awaiter(this, void 0, void 0, function() {
        return __generator$1(this, function(_a) {
          return [2, a - b];
        });
      });
    };
    HeapAsync2.maxComparatorNumber = function(a, b) {
      return __awaiter(this, void 0, void 0, function() {
        return __generator$1(this, function(_a) {
          return [2, b - a];
        });
      });
    };
    HeapAsync2.defaultIsEqual = function(a, b) {
      return __awaiter(this, void 0, void 0, function() {
        return __generator$1(this, function(_a) {
          return [2, a === b];
        });
      });
    };
    HeapAsync2.print = function(heap) {
      function deep(i2) {
        var pi = HeapAsync2.getParentIndexOf(i2);
        return Math.floor(Math.log2(pi + 1));
      }
      function repeat(str, times) {
        var out = "";
        for (; times > 0; --times) {
          out += str;
        }
        return out;
      }
      var node = 0;
      var lines = [];
      var maxLines = deep(heap.length - 1) + 2;
      var maxLength = 0;
      while (node < heap.length) {
        var i = deep(node) + 1;
        if (node === 0) {
          i = 0;
        }
        var nodeText = String(heap.get(node));
        if (nodeText.length > maxLength) {
          maxLength = nodeText.length;
        }
        lines[i] = lines[i] || [];
        lines[i].push(nodeText);
        node += 1;
      }
      return lines.map(function(line, i2) {
        var times = Math.pow(2, maxLines - i2) - 1;
        return repeat(" ", Math.floor(times / 2) * maxLength) + line.map(function(el) {
          var half = (maxLength - el.length) / 2;
          return repeat(" ", Math.ceil(half)) + el + repeat(" ", Math.floor(half));
        }).join(repeat(" ", times * maxLength));
      }).join("\n");
    };
    HeapAsync2.heapify = function(arr, compare) {
      return __awaiter(this, void 0, void 0, function() {
        var heap;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              heap = new HeapAsync2(compare);
              heap.heapArray = arr;
              return [4, heap.init()];
            case 1:
              _a.sent();
              return [2, heap];
          }
        });
      });
    };
    HeapAsync2.heappop = function(heapArr, compare) {
      var heap = new HeapAsync2(compare);
      heap.heapArray = heapArr;
      return heap.pop();
    };
    HeapAsync2.heappush = function(heapArr, item, compare) {
      return __awaiter(this, void 0, void 0, function() {
        var heap;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              heap = new HeapAsync2(compare);
              heap.heapArray = heapArr;
              return [4, heap.push(item)];
            case 1:
              _a.sent();
              return [
                2
                /*return*/
              ];
          }
        });
      });
    };
    HeapAsync2.heappushpop = function(heapArr, item, compare) {
      var heap = new HeapAsync2(compare);
      heap.heapArray = heapArr;
      return heap.pushpop(item);
    };
    HeapAsync2.heapreplace = function(heapArr, item, compare) {
      var heap = new HeapAsync2(compare);
      heap.heapArray = heapArr;
      return heap.replace(item);
    };
    HeapAsync2.heaptop = function(heapArr, n, compare) {
      if (n === void 0) {
        n = 1;
      }
      var heap = new HeapAsync2(compare);
      heap.heapArray = heapArr;
      return heap.top(n);
    };
    HeapAsync2.heapbottom = function(heapArr, n, compare) {
      if (n === void 0) {
        n = 1;
      }
      var heap = new HeapAsync2(compare);
      heap.heapArray = heapArr;
      return heap.bottom(n);
    };
    HeapAsync2.nlargest = function(n, iterable, compare) {
      return __awaiter(this, void 0, void 0, function() {
        var heap;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              heap = new HeapAsync2(compare);
              heap.heapArray = __spreadArray$1([], __read$1(iterable), false);
              return [4, heap.init()];
            case 1:
              _a.sent();
              return [2, heap.top(n)];
          }
        });
      });
    };
    HeapAsync2.nsmallest = function(n, iterable, compare) {
      return __awaiter(this, void 0, void 0, function() {
        var heap;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              heap = new HeapAsync2(compare);
              heap.heapArray = __spreadArray$1([], __read$1(iterable), false);
              return [4, heap.init()];
            case 1:
              _a.sent();
              return [2, heap.bottom(n)];
          }
        });
      });
    };
    HeapAsync2.prototype.add = function(element) {
      return __awaiter(this, void 0, void 0, function() {
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              return [4, this._sortNodeUp(this.heapArray.push(element) - 1)];
            case 1:
              _a.sent();
              this._applyLimit();
              return [2, true];
          }
        });
      });
    };
    HeapAsync2.prototype.addAll = function(elements) {
      return __awaiter(this, void 0, void 0, function() {
        var i, l;
        var _a;
        return __generator$1(this, function(_b) {
          switch (_b.label) {
            case 0:
              i = this.length;
              (_a = this.heapArray).push.apply(_a, __spreadArray$1([], __read$1(elements), false));
              l = this.length;
              _b.label = 1;
            case 1:
              if (!(i < l)) return [3, 4];
              return [4, this._sortNodeUp(i)];
            case 2:
              _b.sent();
              _b.label = 3;
            case 3:
              ++i;
              return [3, 1];
            case 4:
              this._applyLimit();
              return [2, true];
          }
        });
      });
    };
    HeapAsync2.prototype.bottom = function() {
      return __awaiter(this, arguments, void 0, function(n) {
        if (n === void 0) {
          n = 1;
        }
        return __generator$1(this, function(_a) {
          if (this.heapArray.length === 0 || n <= 0) {
            return [2, []];
          } else if (this.heapArray.length === 1) {
            return [2, [this.heapArray[0]]];
          } else if (n >= this.heapArray.length) {
            return [2, __spreadArray$1([], __read$1(this.heapArray), false)];
          } else {
            return [2, this._bottomN_push(~~n)];
          }
        });
      });
    };
    HeapAsync2.prototype.check = function() {
      return __awaiter(this, void 0, void 0, function() {
        var j, el, children, children_1, children_1_1, ch, e_1_1;
        var e_1, _a;
        return __generator$1(this, function(_b) {
          switch (_b.label) {
            case 0:
              j = 0;
              _b.label = 1;
            case 1:
              if (!(j < this.heapArray.length)) return [3, 10];
              el = this.heapArray[j];
              children = this.getChildrenOf(j);
              _b.label = 2;
            case 2:
              _b.trys.push([2, 7, 8, 9]);
              children_1 = (e_1 = void 0, __values(children)), children_1_1 = children_1.next();
              _b.label = 3;
            case 3:
              if (!!children_1_1.done) return [3, 6];
              ch = children_1_1.value;
              return [4, this.compare(el, ch)];
            case 4:
              if (_b.sent() > 0) {
                return [2, el];
              }
              _b.label = 5;
            case 5:
              children_1_1 = children_1.next();
              return [3, 3];
            case 6:
              return [3, 9];
            case 7:
              e_1_1 = _b.sent();
              e_1 = { error: e_1_1 };
              return [3, 9];
            case 8:
              try {
                if (children_1_1 && !children_1_1.done && (_a = children_1.return)) _a.call(children_1);
              } finally {
                if (e_1) throw e_1.error;
              }
              return [
                7
                /*endfinally*/
              ];
            case 9:
              ++j;
              return [3, 1];
            case 10:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    };
    HeapAsync2.prototype.clear = function() {
      this.heapArray = [];
    };
    HeapAsync2.prototype.clone = function() {
      var cloned = new HeapAsync2(this.comparator());
      cloned.heapArray = this.toArray();
      cloned._limit = this._limit;
      return cloned;
    };
    HeapAsync2.prototype.comparator = function() {
      return this.compare;
    };
    HeapAsync2.prototype.contains = function(o_1) {
      return __awaiter(this, arguments, void 0, function(o, fn) {
        var _a, _b, el, e_2_1;
        var e_2, _c;
        if (fn === void 0) {
          fn = HeapAsync2.defaultIsEqual;
        }
        return __generator$1(this, function(_d) {
          switch (_d.label) {
            case 0:
              _d.trys.push([0, 5, 6, 7]);
              _a = __values(this.heapArray), _b = _a.next();
              _d.label = 1;
            case 1:
              if (!!_b.done) return [3, 4];
              el = _b.value;
              return [4, fn(el, o)];
            case 2:
              if (_d.sent()) {
                return [2, true];
              }
              _d.label = 3;
            case 3:
              _b = _a.next();
              return [3, 1];
            case 4:
              return [3, 7];
            case 5:
              e_2_1 = _d.sent();
              e_2 = { error: e_2_1 };
              return [3, 7];
            case 6:
              try {
                if (_b && !_b.done && (_c = _a.return)) _c.call(_a);
              } finally {
                if (e_2) throw e_2.error;
              }
              return [
                7
                /*endfinally*/
              ];
            case 7:
              return [2, false];
          }
        });
      });
    };
    HeapAsync2.prototype.init = function(array) {
      return __awaiter(this, void 0, void 0, function() {
        var i;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              if (array) {
                this.heapArray = __spreadArray$1([], __read$1(array), false);
              }
              i = Math.floor(this.heapArray.length);
              _a.label = 1;
            case 1:
              if (!(i >= 0)) return [3, 4];
              return [4, this._sortNodeDown(i)];
            case 2:
              _a.sent();
              _a.label = 3;
            case 3:
              --i;
              return [3, 1];
            case 4:
              this._applyLimit();
              return [
                2
                /*return*/
              ];
          }
        });
      });
    };
    HeapAsync2.prototype.isEmpty = function() {
      return this.length === 0;
    };
    HeapAsync2.prototype.leafs = function() {
      if (this.heapArray.length === 0) {
        return [];
      }
      var pi = HeapAsync2.getParentIndexOf(this.heapArray.length - 1);
      return this.heapArray.slice(pi + 1);
    };
    Object.defineProperty(HeapAsync2.prototype, "length", {
      /**
       * Length of the heap.
       * @return {Number}
       */
      get: function() {
        return this.heapArray.length;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(HeapAsync2.prototype, "limit", {
      /**
       * Get length limit of the heap.
       * @return {Number}
       */
      get: function() {
        return this._limit;
      },
      /**
       * Set length limit of the heap.
       * @return {Number}
       */
      set: function(_l) {
        this._limit = ~~_l;
        this._applyLimit();
      },
      enumerable: false,
      configurable: true
    });
    HeapAsync2.prototype.peek = function() {
      return this.heapArray[0];
    };
    HeapAsync2.prototype.pop = function() {
      return __awaiter(this, void 0, void 0, function() {
        var last;
        return __generator$1(this, function(_a) {
          last = this.heapArray.pop();
          if (this.length > 0 && last !== void 0) {
            return [2, this.replace(last)];
          }
          return [2, last];
        });
      });
    };
    HeapAsync2.prototype.push = function() {
      var elements = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        elements[_i] = arguments[_i];
      }
      return __awaiter(this, void 0, void 0, function() {
        return __generator$1(this, function(_a) {
          if (elements.length < 1) {
            return [2, false];
          } else if (elements.length === 1) {
            return [2, this.add(elements[0])];
          } else {
            return [2, this.addAll(elements)];
          }
        });
      });
    };
    HeapAsync2.prototype.pushpop = function(element) {
      return __awaiter(this, void 0, void 0, function() {
        var _a;
        return __generator$1(this, function(_b) {
          switch (_b.label) {
            case 0:
              return [4, this.compare(this.heapArray[0], element)];
            case 1:
              if (!(_b.sent() < 0)) return [3, 3];
              _a = __read$1([this.heapArray[0], element], 2), element = _a[0], this.heapArray[0] = _a[1];
              return [4, this._sortNodeDown(0)];
            case 2:
              _b.sent();
              _b.label = 3;
            case 3:
              return [2, element];
          }
        });
      });
    };
    HeapAsync2.prototype.remove = function(o_1) {
      return __awaiter(this, arguments, void 0, function(o, fn) {
        var queue, idx, children;
        var _this = this;
        if (fn === void 0) {
          fn = HeapAsync2.defaultIsEqual;
        }
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              if (!this.heapArray.length)
                return [2, false];
              if (!(o === void 0)) return [3, 2];
              return [4, this.pop()];
            case 1:
              _a.sent();
              return [2, true];
            case 2:
              queue = [0];
              _a.label = 3;
            case 3:
              if (!queue.length) return [3, 13];
              idx = queue.shift();
              return [4, fn(this.heapArray[idx], o)];
            case 4:
              if (!_a.sent()) return [3, 11];
              if (!(idx === 0)) return [3, 6];
              return [4, this.pop()];
            case 5:
              _a.sent();
              return [3, 10];
            case 6:
              if (!(idx === this.heapArray.length - 1)) return [3, 7];
              this.heapArray.pop();
              return [3, 10];
            case 7:
              this.heapArray.splice(idx, 1, this.heapArray.pop());
              return [4, this._sortNodeUp(idx)];
            case 8:
              _a.sent();
              return [4, this._sortNodeDown(idx)];
            case 9:
              _a.sent();
              _a.label = 10;
            case 10:
              return [2, true];
            case 11:
              children = HeapAsync2.getChildrenIndexOf(idx).filter(function(c) {
                return c < _this.heapArray.length;
              });
              queue.push.apply(queue, __spreadArray$1([], __read$1(children), false));
              _a.label = 12;
            case 12:
              return [3, 3];
            case 13:
              return [2, false];
          }
        });
      });
    };
    HeapAsync2.prototype.replace = function(element) {
      return __awaiter(this, void 0, void 0, function() {
        var peek;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              peek = this.heapArray[0];
              this.heapArray[0] = element;
              return [4, this._sortNodeDown(0)];
            case 1:
              _a.sent();
              return [2, peek];
          }
        });
      });
    };
    HeapAsync2.prototype.size = function() {
      return this.length;
    };
    HeapAsync2.prototype.top = function() {
      return __awaiter(this, arguments, void 0, function(n) {
        if (n === void 0) {
          n = 1;
        }
        return __generator$1(this, function(_a) {
          if (this.heapArray.length === 0 || n <= 0) {
            return [2, []];
          } else if (this.heapArray.length === 1 || n === 1) {
            return [2, [this.heapArray[0]]];
          } else if (n >= this.heapArray.length) {
            return [2, __spreadArray$1([], __read$1(this.heapArray), false)];
          } else {
            return [2, this._topN_push(~~n)];
          }
        });
      });
    };
    HeapAsync2.prototype.toArray = function() {
      return __spreadArray$1([], __read$1(this.heapArray), false);
    };
    HeapAsync2.prototype.toString = function() {
      return this.heapArray.toString();
    };
    HeapAsync2.prototype.get = function(i) {
      return this.heapArray[i];
    };
    HeapAsync2.prototype.getChildrenOf = function(idx) {
      var _this = this;
      return HeapAsync2.getChildrenIndexOf(idx).map(function(i) {
        return _this.heapArray[i];
      }).filter(function(e) {
        return e !== void 0;
      });
    };
    HeapAsync2.prototype.getParentOf = function(idx) {
      var pi = HeapAsync2.getParentIndexOf(idx);
      return this.heapArray[pi];
    };
    HeapAsync2.prototype[Symbol.iterator] = function() {
      return __generator$1(this, function(_a) {
        switch (_a.label) {
          case 0:
            if (!this.length) return [3, 2];
            return [4, this.pop()];
          case 1:
            _a.sent();
            return [3, 0];
          case 2:
            return [
              2
              /*return*/
            ];
        }
      });
    };
    HeapAsync2.prototype.iterator = function() {
      return this;
    };
    HeapAsync2.prototype._applyLimit = function() {
      if (this._limit && this._limit < this.heapArray.length) {
        var rm = this.heapArray.length - this._limit;
        while (rm) {
          this.heapArray.pop();
          --rm;
        }
      }
    };
    HeapAsync2.prototype._bottomN_push = function(n) {
      return __awaiter(this, void 0, void 0, function() {
        var bottomHeap, startAt, parentStartAt, indices, i, arr, i;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              bottomHeap = new HeapAsync2(this.compare);
              bottomHeap.limit = n;
              bottomHeap.heapArray = this.heapArray.slice(-n);
              return [4, bottomHeap.init()];
            case 1:
              _a.sent();
              startAt = this.heapArray.length - 1 - n;
              parentStartAt = HeapAsync2.getParentIndexOf(startAt);
              indices = [];
              for (i = startAt; i > parentStartAt; --i) {
                indices.push(i);
              }
              arr = this.heapArray;
              _a.label = 2;
            case 2:
              if (!indices.length) return [3, 6];
              i = indices.shift();
              return [4, this.compare(arr[i], bottomHeap.peek())];
            case 3:
              if (!(_a.sent() > 0)) return [3, 5];
              return [4, bottomHeap.replace(arr[i])];
            case 4:
              _a.sent();
              if (i % 2) {
                indices.push(HeapAsync2.getParentIndexOf(i));
              }
              _a.label = 5;
            case 5:
              return [3, 2];
            case 6:
              return [2, bottomHeap.toArray()];
          }
        });
      });
    };
    HeapAsync2.prototype._moveNode = function(j, k) {
      var _a;
      _a = __read$1([this.heapArray[k], this.heapArray[j]], 2), this.heapArray[j] = _a[0], this.heapArray[k] = _a[1];
    };
    HeapAsync2.prototype._sortNodeDown = function(i) {
      return __awaiter(this, void 0, void 0, function() {
        var length, left, right, best, _a, _b;
        return __generator$1(this, function(_c) {
          switch (_c.label) {
            case 0:
              length = this.heapArray.length;
              _c.label = 1;
            case 1:
              left = 2 * i + 1;
              right = left + 1;
              best = i;
              _a = left < length;
              if (!_a) return [3, 3];
              return [4, this.compare(this.heapArray[left], this.heapArray[best])];
            case 2:
              _a = _c.sent() < 0;
              _c.label = 3;
            case 3:
              if (_a) {
                best = left;
              }
              _b = right < length;
              if (!_b) return [3, 5];
              return [4, this.compare(this.heapArray[right], this.heapArray[best])];
            case 4:
              _b = _c.sent() < 0;
              _c.label = 5;
            case 5:
              if (_b) {
                best = right;
              }
              if (best === i)
                return [3, 7];
              this._moveNode(i, best);
              i = best;
              _c.label = 6;
            case 6:
              return [3, 1];
            case 7:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    };
    HeapAsync2.prototype._sortNodeUp = function(i) {
      return __awaiter(this, void 0, void 0, function() {
        var pi;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              if (!(i > 0)) return [3, 2];
              pi = HeapAsync2.getParentIndexOf(i);
              return [4, this.compare(this.heapArray[i], this.heapArray[pi])];
            case 1:
              if (_a.sent() < 0) {
                this._moveNode(i, pi);
                i = pi;
              } else
                return [3, 2];
              return [3, 0];
            case 2:
              return [
                2
                /*return*/
              ];
          }
        });
      });
    };
    HeapAsync2.prototype._topN_push = function(n) {
      return __awaiter(this, void 0, void 0, function() {
        var topHeap, indices, arr, i;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              topHeap = new HeapAsync2(this._invertedCompare);
              topHeap.limit = n;
              indices = [0];
              arr = this.heapArray;
              _a.label = 1;
            case 1:
              if (!indices.length) return [3, 7];
              i = indices.shift();
              if (!(i < arr.length)) return [3, 6];
              if (!(topHeap.length < n)) return [3, 3];
              return [4, topHeap.push(arr[i])];
            case 2:
              _a.sent();
              indices.push.apply(indices, __spreadArray$1([], __read$1(HeapAsync2.getChildrenIndexOf(i)), false));
              return [3, 6];
            case 3:
              return [4, this.compare(arr[i], topHeap.peek())];
            case 4:
              if (!(_a.sent() < 0)) return [3, 6];
              return [4, topHeap.replace(arr[i])];
            case 5:
              _a.sent();
              indices.push.apply(indices, __spreadArray$1([], __read$1(HeapAsync2.getChildrenIndexOf(i)), false));
              _a.label = 6;
            case 6:
              return [3, 1];
            case 7:
              return [2, topHeap.toArray()];
          }
        });
      });
    };
    HeapAsync2.prototype._topN_fill = function(n) {
      return __awaiter(this, void 0, void 0, function() {
        var heapArray, topHeap, branch, indices, i, i;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              heapArray = this.heapArray;
              topHeap = new HeapAsync2(this._invertedCompare);
              topHeap.limit = n;
              topHeap.heapArray = heapArray.slice(0, n);
              return [4, topHeap.init()];
            case 1:
              _a.sent();
              branch = HeapAsync2.getParentIndexOf(n - 1) + 1;
              indices = [];
              for (i = branch; i < n; ++i) {
                indices.push.apply(indices, __spreadArray$1([], __read$1(HeapAsync2.getChildrenIndexOf(i).filter(function(l) {
                  return l < heapArray.length;
                })), false));
              }
              if ((n - 1) % 2) {
                indices.push(n);
              }
              _a.label = 2;
            case 2:
              if (!indices.length) return [3, 6];
              i = indices.shift();
              if (!(i < heapArray.length)) return [3, 5];
              return [4, this.compare(heapArray[i], topHeap.peek())];
            case 3:
              if (!(_a.sent() < 0)) return [3, 5];
              return [4, topHeap.replace(heapArray[i])];
            case 4:
              _a.sent();
              indices.push.apply(indices, __spreadArray$1([], __read$1(HeapAsync2.getChildrenIndexOf(i)), false));
              _a.label = 5;
            case 5:
              return [3, 2];
            case 6:
              return [2, topHeap.toArray()];
          }
        });
      });
    };
    HeapAsync2.prototype._topN_heap = function(n) {
      return __awaiter(this, void 0, void 0, function() {
        var topHeap, result, i, _a, _b;
        return __generator$1(this, function(_c) {
          switch (_c.label) {
            case 0:
              topHeap = this.clone();
              result = [];
              i = 0;
              _c.label = 1;
            case 1:
              if (!(i < n)) return [3, 4];
              _b = (_a = result).push;
              return [4, topHeap.pop()];
            case 2:
              _b.apply(_a, [_c.sent()]);
              _c.label = 3;
            case 3:
              ++i;
              return [3, 1];
            case 4:
              return [2, result];
          }
        });
      });
    };
    HeapAsync2.prototype._topIdxOf = function(list) {
      return __awaiter(this, void 0, void 0, function() {
        var idx, top, i, comp;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              if (!list.length) {
                return [2, -1];
              }
              idx = 0;
              top = list[idx];
              i = 1;
              _a.label = 1;
            case 1:
              if (!(i < list.length)) return [3, 4];
              return [4, this.compare(list[i], top)];
            case 2:
              comp = _a.sent();
              if (comp < 0) {
                idx = i;
                top = list[i];
              }
              _a.label = 3;
            case 3:
              ++i;
              return [3, 1];
            case 4:
              return [2, idx];
          }
        });
      });
    };
    HeapAsync2.prototype._topOf = function() {
      var list = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        list[_i] = arguments[_i];
      }
      return __awaiter(this, void 0, void 0, function() {
        var heap;
        return __generator$1(this, function(_a) {
          switch (_a.label) {
            case 0:
              heap = new HeapAsync2(this.compare);
              return [4, heap.init(list)];
            case 1:
              _a.sent();
              return [2, heap.peek()];
          }
        });
      });
    };
    return HeapAsync2;
  })()
);
var __generator = function(thisArg, body) {
  var _ = { label: 0, sent: function() {
    if (t[0] & 1) throw t[1];
    return t[1];
  }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
  return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() {
    return this;
  }), g;
  function verb(n) {
    return function(v) {
      return step([n, v]);
    };
  }
  function step(op) {
    if (f) throw new TypeError("Generator is already executing.");
    while (g && (g = 0, op[0] && (_ = 0)), _) try {
      if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
      if (y = 0, t) op = [op[0] & 2, t.value];
      switch (op[0]) {
        case 0:
        case 1:
          t = op;
          break;
        case 4:
          _.label++;
          return { value: op[1], done: false };
        case 5:
          _.label++;
          y = op[1];
          op = [0];
          continue;
        case 7:
          op = _.ops.pop();
          _.trys.pop();
          continue;
        default:
          if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
            _ = 0;
            continue;
          }
          if (op[0] === 3 && (!t || op[1] > t[0] && op[1] < t[3])) {
            _.label = op[1];
            break;
          }
          if (op[0] === 6 && _.label < t[1]) {
            _.label = t[1];
            t = op;
            break;
          }
          if (t && _.label < t[2]) {
            _.label = t[2];
            _.ops.push(op);
            break;
          }
          if (t[2]) _.ops.pop();
          _.trys.pop();
          continue;
      }
      op = body.call(thisArg, _);
    } catch (e) {
      op = [6, e];
      y = 0;
    } finally {
      f = t = 0;
    }
    if (op[0] & 5) throw op[1];
    return { value: op[0] ? op[1] : void 0, done: true };
  }
};
var __read = function(o, n) {
  var m = typeof Symbol === "function" && o[Symbol.iterator];
  if (!m) return o;
  var i = m.call(o), r, ar = [], e;
  try {
    while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
  } catch (error) {
    e = { error };
  } finally {
    try {
      if (r && !r.done && (m = i["return"])) m.call(i);
    } finally {
      if (e) throw e.error;
    }
  }
  return ar;
};
var __spreadArray = function(to, from, pack) {
  if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
    if (ar || !(i in from)) {
      if (!ar) ar = Array.prototype.slice.call(from, 0, i);
      ar[i] = from[i];
    }
  }
  return to.concat(ar || Array.prototype.slice.call(from));
};
var Heap = (
  /** @class */
  (function() {
    function Heap2(compare) {
      if (compare === void 0) {
        compare = Heap2.minComparator;
      }
      var _this = this;
      this.compare = compare;
      this.heapArray = [];
      this._limit = 0;
      this.offer = this.add;
      this.element = this.peek;
      this.poll = this.pop;
      this.removeAll = this.clear;
      this._invertedCompare = function(a, b) {
        return -1 * _this.compare(a, b);
      };
    }
    Heap2.getChildrenIndexOf = function(idx) {
      return [idx * 2 + 1, idx * 2 + 2];
    };
    Heap2.getParentIndexOf = function(idx) {
      if (idx <= 0) {
        return -1;
      }
      var whichChildren = idx % 2 ? 1 : 2;
      return Math.floor((idx - whichChildren) / 2);
    };
    Heap2.getSiblingIndexOf = function(idx) {
      if (idx <= 0) {
        return -1;
      }
      var whichChildren = idx % 2 ? 1 : -1;
      return idx + whichChildren;
    };
    Heap2.minComparator = function(a, b) {
      if (a > b) {
        return 1;
      } else if (a < b) {
        return -1;
      } else {
        return 0;
      }
    };
    Heap2.maxComparator = function(a, b) {
      if (b > a) {
        return 1;
      } else if (b < a) {
        return -1;
      } else {
        return 0;
      }
    };
    Heap2.minComparatorNumber = function(a, b) {
      return a - b;
    };
    Heap2.maxComparatorNumber = function(a, b) {
      return b - a;
    };
    Heap2.defaultIsEqual = function(a, b) {
      return a === b;
    };
    Heap2.print = function(heap) {
      function deep(i2) {
        var pi = Heap2.getParentIndexOf(i2);
        return Math.floor(Math.log2(pi + 1));
      }
      function repeat(str, times) {
        var out = "";
        for (; times > 0; --times) {
          out += str;
        }
        return out;
      }
      var node = 0;
      var lines = [];
      var maxLines = deep(heap.length - 1) + 2;
      var maxLength = 0;
      while (node < heap.length) {
        var i = deep(node) + 1;
        if (node === 0) {
          i = 0;
        }
        var nodeText = String(heap.get(node));
        if (nodeText.length > maxLength) {
          maxLength = nodeText.length;
        }
        lines[i] = lines[i] || [];
        lines[i].push(nodeText);
        node += 1;
      }
      return lines.map(function(line, i2) {
        var times = Math.pow(2, maxLines - i2) - 1;
        return repeat(" ", Math.floor(times / 2) * maxLength) + line.map(function(el) {
          var half = (maxLength - el.length) / 2;
          return repeat(" ", Math.ceil(half)) + el + repeat(" ", Math.floor(half));
        }).join(repeat(" ", times * maxLength));
      }).join("\n");
    };
    Heap2.heapify = function(arr, compare) {
      var heap = new Heap2(compare);
      heap.heapArray = arr;
      heap.init();
      return heap;
    };
    Heap2.heappop = function(heapArr, compare) {
      var heap = new Heap2(compare);
      heap.heapArray = heapArr;
      return heap.pop();
    };
    Heap2.heappush = function(heapArr, item, compare) {
      var heap = new Heap2(compare);
      heap.heapArray = heapArr;
      heap.push(item);
    };
    Heap2.heappushpop = function(heapArr, item, compare) {
      var heap = new Heap2(compare);
      heap.heapArray = heapArr;
      return heap.pushpop(item);
    };
    Heap2.heapreplace = function(heapArr, item, compare) {
      var heap = new Heap2(compare);
      heap.heapArray = heapArr;
      return heap.replace(item);
    };
    Heap2.heaptop = function(heapArr, n, compare) {
      if (n === void 0) {
        n = 1;
      }
      var heap = new Heap2(compare);
      heap.heapArray = heapArr;
      return heap.top(n);
    };
    Heap2.heapbottom = function(heapArr, n, compare) {
      if (n === void 0) {
        n = 1;
      }
      var heap = new Heap2(compare);
      heap.heapArray = heapArr;
      return heap.bottom(n);
    };
    Heap2.nlargest = function(n, iterable, compare) {
      var heap = new Heap2(compare);
      heap.heapArray = __spreadArray([], __read(iterable), false);
      heap.init();
      return heap.top(n);
    };
    Heap2.nsmallest = function(n, iterable, compare) {
      var heap = new Heap2(compare);
      heap.heapArray = __spreadArray([], __read(iterable), false);
      heap.init();
      return heap.bottom(n);
    };
    Heap2.prototype.add = function(element) {
      this._sortNodeUp(this.heapArray.push(element) - 1);
      this._applyLimit();
      return true;
    };
    Heap2.prototype.addAll = function(elements) {
      var _a;
      var i = this.length;
      (_a = this.heapArray).push.apply(_a, __spreadArray([], __read(elements), false));
      for (var l = this.length; i < l; ++i) {
        this._sortNodeUp(i);
      }
      this._applyLimit();
      return true;
    };
    Heap2.prototype.bottom = function(n) {
      if (n === void 0) {
        n = 1;
      }
      if (this.heapArray.length === 0 || n <= 0) {
        return [];
      } else if (this.heapArray.length === 1) {
        return [this.heapArray[0]];
      } else if (n >= this.heapArray.length) {
        return __spreadArray([], __read(this.heapArray), false);
      } else {
        return this._bottomN_push(~~n);
      }
    };
    Heap2.prototype.check = function() {
      var _this = this;
      return this.heapArray.find(function(el, j) {
        return !!_this.getChildrenOf(j).find(function(ch) {
          return _this.compare(el, ch) > 0;
        });
      });
    };
    Heap2.prototype.clear = function() {
      this.heapArray = [];
    };
    Heap2.prototype.clone = function() {
      var cloned = new Heap2(this.comparator());
      cloned.heapArray = this.toArray();
      cloned._limit = this._limit;
      return cloned;
    };
    Heap2.prototype.comparator = function() {
      return this.compare;
    };
    Heap2.prototype.contains = function(o, callbackFn) {
      if (callbackFn === void 0) {
        callbackFn = Heap2.defaultIsEqual;
      }
      return this.indexOf(o, callbackFn) !== -1;
    };
    Heap2.prototype.init = function(array) {
      if (array) {
        this.heapArray = __spreadArray([], __read(array), false);
      }
      for (var i = Math.floor(this.heapArray.length); i >= 0; --i) {
        this._sortNodeDown(i);
      }
      this._applyLimit();
    };
    Heap2.prototype.isEmpty = function() {
      return this.length === 0;
    };
    Heap2.prototype.indexOf = function(element, callbackFn) {
      if (callbackFn === void 0) {
        callbackFn = Heap2.defaultIsEqual;
      }
      if (this.heapArray.length === 0) {
        return -1;
      }
      var indexes = [];
      var currentIndex = 0;
      while (currentIndex < this.heapArray.length) {
        var currentElement = this.heapArray[currentIndex];
        if (callbackFn(currentElement, element)) {
          return currentIndex;
        } else if (this.compare(currentElement, element) <= 0) {
          indexes.push.apply(indexes, __spreadArray([], __read(Heap2.getChildrenIndexOf(currentIndex)), false));
        }
        currentIndex = indexes.shift() || this.heapArray.length;
      }
      return -1;
    };
    Heap2.prototype.indexOfEvery = function(element, callbackFn) {
      if (callbackFn === void 0) {
        callbackFn = Heap2.defaultIsEqual;
      }
      if (this.heapArray.length === 0) {
        return [];
      }
      var indexes = [];
      var foundIndexes = [];
      var currentIndex = 0;
      while (currentIndex < this.heapArray.length) {
        var currentElement = this.heapArray[currentIndex];
        if (callbackFn(currentElement, element)) {
          foundIndexes.push(currentIndex);
          indexes.push.apply(indexes, __spreadArray([], __read(Heap2.getChildrenIndexOf(currentIndex)), false));
        } else if (this.compare(currentElement, element) <= 0) {
          indexes.push.apply(indexes, __spreadArray([], __read(Heap2.getChildrenIndexOf(currentIndex)), false));
        }
        currentIndex = indexes.shift() || this.heapArray.length;
      }
      return foundIndexes;
    };
    Heap2.prototype.leafs = function() {
      if (this.heapArray.length === 0) {
        return [];
      }
      var pi = Heap2.getParentIndexOf(this.heapArray.length - 1);
      return this.heapArray.slice(pi + 1);
    };
    Object.defineProperty(Heap2.prototype, "length", {
      /**
       * Length of the heap. Aliases: {@link size}.
       * @return {Number}
       * @see size
       */
      get: function() {
        return this.heapArray.length;
      },
      enumerable: false,
      configurable: true
    });
    Object.defineProperty(Heap2.prototype, "limit", {
      /**
       * Get length limit of the heap.
       * Use {@link setLimit} or {@link limit} to set the limit.
       * @return {Number}
       * @see setLimit
       */
      get: function() {
        return this._limit;
      },
      /**
       * Set length limit of the heap. Same as using {@link setLimit}.
       * @description If the heap is longer than the limit, the needed amount of leafs are removed.
       * @param {Number} _l Limit, defaults to 0 (no limit). Negative, Infinity, or NaN values set the limit to 0.
       * @see setLimit
       */
      set: function(_l) {
        if (_l < 0 || isNaN(_l)) {
          this._limit = 0;
        } else {
          this._limit = ~~_l;
        }
        this._applyLimit();
      },
      enumerable: false,
      configurable: true
    });
    Heap2.prototype.setLimit = function(_l) {
      this.limit = _l;
      if (_l < 0 || isNaN(_l)) {
        return NaN;
      } else {
        return this._limit;
      }
    };
    Heap2.prototype.peek = function() {
      return this.heapArray[0];
    };
    Heap2.prototype.pop = function() {
      var last = this.heapArray.pop();
      if (this.length > 0 && last !== void 0) {
        return this.replace(last);
      }
      return last;
    };
    Heap2.prototype.push = function() {
      var elements = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        elements[_i] = arguments[_i];
      }
      if (elements.length < 1) {
        return false;
      } else if (elements.length === 1) {
        return this.add(elements[0]);
      } else {
        return this.addAll(elements);
      }
    };
    Heap2.prototype.pushpop = function(element) {
      var _a;
      if (this.compare(this.heapArray[0], element) < 0) {
        _a = __read([this.heapArray[0], element], 2), element = _a[0], this.heapArray[0] = _a[1];
        this._sortNodeDown(0);
      }
      return element;
    };
    Heap2.prototype.remove = function(o, callbackFn) {
      var _this = this;
      if (callbackFn === void 0) {
        callbackFn = Heap2.defaultIsEqual;
      }
      if (!this.heapArray.length)
        return false;
      if (o === void 0) {
        this.pop();
        return true;
      }
      var queue = [0];
      while (queue.length) {
        var idx = queue.shift();
        if (callbackFn(this.heapArray[idx], o)) {
          if (idx === 0) {
            this.pop();
          } else if (idx === this.heapArray.length - 1) {
            this.heapArray.pop();
          } else {
            this.heapArray.splice(idx, 1, this.heapArray.pop());
            this._sortNodeUp(idx);
            this._sortNodeDown(idx);
          }
          return true;
        } else if (this.compare(this.heapArray[idx], o) <= 0) {
          var children = Heap2.getChildrenIndexOf(idx).filter(function(c) {
            return c < _this.heapArray.length;
          });
          queue.push.apply(queue, __spreadArray([], __read(children), false));
        }
      }
      return false;
    };
    Heap2.prototype.replace = function(element) {
      var peek = this.heapArray[0];
      this.heapArray[0] = element;
      this._sortNodeDown(0);
      return peek;
    };
    Heap2.prototype.size = function() {
      return this.length;
    };
    Heap2.prototype.top = function(n) {
      if (n === void 0) {
        n = 1;
      }
      if (this.heapArray.length === 0 || n <= 0) {
        return [];
      } else if (this.heapArray.length === 1 || n === 1) {
        return [this.heapArray[0]];
      } else if (n >= this.heapArray.length) {
        return __spreadArray([], __read(this.heapArray), false);
      } else {
        return this._topN_push(~~n);
      }
    };
    Heap2.prototype.toArray = function() {
      return __spreadArray([], __read(this.heapArray), false);
    };
    Heap2.prototype.toString = function() {
      return this.heapArray.toString();
    };
    Heap2.prototype.get = function(i) {
      return this.heapArray[i];
    };
    Heap2.prototype.getChildrenOf = function(idx) {
      var _this = this;
      return Heap2.getChildrenIndexOf(idx).map(function(i) {
        return _this.heapArray[i];
      }).filter(function(e) {
        return e !== void 0;
      });
    };
    Heap2.prototype.getParentOf = function(idx) {
      var pi = Heap2.getParentIndexOf(idx);
      return this.heapArray[pi];
    };
    Heap2.prototype[Symbol.iterator] = function() {
      return __generator(this, function(_a) {
        switch (_a.label) {
          case 0:
            if (!this.length) return [3, 2];
            return [4, this.pop()];
          case 1:
            _a.sent();
            return [3, 0];
          case 2:
            return [
              2
              /*return*/
            ];
        }
      });
    };
    Heap2.prototype.iterator = function() {
      return this.toArray();
    };
    Heap2.prototype._applyLimit = function() {
      if (this._limit > 0 && this._limit < this.heapArray.length) {
        var rm = this.heapArray.length - this._limit;
        while (rm) {
          this.heapArray.pop();
          --rm;
        }
      }
    };
    Heap2.prototype._bottomN_push = function(n) {
      var bottomHeap = new Heap2(this.compare);
      bottomHeap.limit = n;
      bottomHeap.heapArray = this.heapArray.slice(-n);
      bottomHeap.init();
      var startAt = this.heapArray.length - 1 - n;
      var parentStartAt = Heap2.getParentIndexOf(startAt);
      var indices = [];
      for (var i = startAt; i > parentStartAt; --i) {
        indices.push(i);
      }
      var arr = this.heapArray;
      while (indices.length) {
        var i = indices.shift();
        if (this.compare(arr[i], bottomHeap.peek()) > 0) {
          bottomHeap.replace(arr[i]);
          if (i % 2) {
            indices.push(Heap2.getParentIndexOf(i));
          }
        }
      }
      return bottomHeap.toArray();
    };
    Heap2.prototype._moveNode = function(j, k) {
      var _a;
      _a = __read([this.heapArray[k], this.heapArray[j]], 2), this.heapArray[j] = _a[0], this.heapArray[k] = _a[1];
    };
    Heap2.prototype._sortNodeDown = function(i) {
      var length = this.heapArray.length;
      while (true) {
        var left = 2 * i + 1;
        var right = left + 1;
        var best = i;
        if (left < length && this.compare(this.heapArray[left], this.heapArray[best]) < 0) {
          best = left;
        }
        if (right < length && this.compare(this.heapArray[right], this.heapArray[best]) < 0) {
          best = right;
        }
        if (best === i)
          break;
        this._moveNode(i, best);
        i = best;
      }
    };
    Heap2.prototype._sortNodeUp = function(i) {
      while (i > 0) {
        var pi = Heap2.getParentIndexOf(i);
        if (this.compare(this.heapArray[i], this.heapArray[pi]) < 0) {
          this._moveNode(i, pi);
          i = pi;
        } else
          break;
      }
    };
    Heap2.prototype._topN_push = function(n) {
      var topHeap = new Heap2(this._invertedCompare);
      topHeap.limit = n;
      var indices = [0];
      var arr = this.heapArray;
      while (indices.length) {
        var i = indices.shift();
        if (i < arr.length) {
          if (topHeap.length < n) {
            topHeap.push(arr[i]);
            indices.push.apply(indices, __spreadArray([], __read(Heap2.getChildrenIndexOf(i)), false));
          } else if (this.compare(arr[i], topHeap.peek()) < 0) {
            topHeap.replace(arr[i]);
            indices.push.apply(indices, __spreadArray([], __read(Heap2.getChildrenIndexOf(i)), false));
          }
        }
      }
      return topHeap.toArray();
    };
    Heap2.prototype._topN_fill = function(n) {
      var heapArray = this.heapArray;
      var topHeap = new Heap2(this._invertedCompare);
      topHeap.limit = n;
      topHeap.heapArray = heapArray.slice(0, n);
      topHeap.init();
      var branch = Heap2.getParentIndexOf(n - 1) + 1;
      var indices = [];
      for (var i = branch; i < n; ++i) {
        indices.push.apply(indices, __spreadArray([], __read(Heap2.getChildrenIndexOf(i).filter(function(l) {
          return l < heapArray.length;
        })), false));
      }
      if ((n - 1) % 2) {
        indices.push(n);
      }
      while (indices.length) {
        var i = indices.shift();
        if (i < heapArray.length) {
          if (this.compare(heapArray[i], topHeap.peek()) < 0) {
            topHeap.replace(heapArray[i]);
            indices.push.apply(indices, __spreadArray([], __read(Heap2.getChildrenIndexOf(i)), false));
          }
        }
      }
      return topHeap.toArray();
    };
    Heap2.prototype._topN_heap = function(n) {
      var topHeap = this.clone();
      var result = [];
      for (var i = 0; i < n; ++i) {
        result.push(topHeap.pop());
      }
      return result;
    };
    Heap2.prototype._topIdxOf = function(list) {
      if (!list.length) {
        return -1;
      }
      var idx = 0;
      var top = list[idx];
      for (var i = 1; i < list.length; ++i) {
        var comp = this.compare(list[i], top);
        if (comp < 0) {
          idx = i;
          top = list[i];
        }
      }
      return idx;
    };
    Heap2.prototype._topOf = function() {
      var list = [];
      for (var _i = 0; _i < arguments.length; _i++) {
        list[_i] = arguments[_i];
      }
      var heap = new Heap2(this.compare);
      heap.init(list);
      return heap.peek();
    };
    return Heap2;
  })()
);

// engine/events/eventQueue.js
var EventQueue = class {
  constructor() {
    this.minHeap = new Heap((a, b) => a.time - b.time);
  }
  addEvent(event) {
    this.minHeap.push(event);
  }
  getNextEvent() {
    return this.minHeap.pop();
  }
  containsEventOfType(type) {
    let heapEvents = this.minHeap.toArray();
    return heapEvents.some((event) => event.type == type);
  }
  containsEventOfTypeAndHrid(type, hrid) {
    let heapEvents = this.minHeap.toArray();
    return heapEvents.some((event) => event.type == type && event.hrid == hrid);
  }
  clear() {
    this.minHeap = new Heap((a, b) => a.time - b.time);
  }
  clearEventsForUnit(unit) {
    this.clearMatching((event) => event.source == unit || event.target == unit);
  }
  clearEventsOfType(type) {
    this.clearMatching((event) => event.type == type);
  }
  clearMatching(fn) {
    let cleared = false;
    let heapEvents = this.minHeap.toArray();
    for (const event of heapEvents) {
      if (fn(event)) {
        this.minHeap.remove(event);
        cleared = true;
      }
    }
    return cleared;
  }
  getMatching(fn) {
    let heapEvents = this.minHeap.toArray();
    for (const event of heapEvents) {
      if (fn(event)) {
        return event;
      }
    }
    return null;
  }
};
var eventQueue_default = EventQueue;

// engine/events/playerRespawnEvent.js
var PlayerRespawnEvent = class _PlayerRespawnEvent extends combatEvent_default {
  static type = "playerRespawn";
  constructor(time, hrid) {
    super(_PlayerRespawnEvent.type, time);
    this.hrid = hrid;
  }
};
var playerRespawnEvent_default = PlayerRespawnEvent;

// engine/events/regenTickEvent.js
var RegenTickEvent = class _RegenTickEvent extends combatEvent_default {
  static type = "regenTick";
  constructor(time) {
    super(_RegenTickEvent.type, time);
  }
};
var regenTickEvent_default = RegenTickEvent;

// engine/events/stunExpirationEvent.js
var StunExpirationEvent = class _StunExpirationEvent extends combatEvent_default {
  static type = "stunExpiration";
  constructor(time, source) {
    super(_StunExpirationEvent.type, time);
    this.source = source;
  }
};
var stunExpirationEvent_default = StunExpirationEvent;

// engine/events/blindExpirationEvent.js
var BlindExpirationEvent = class _BlindExpirationEvent extends combatEvent_default {
  static type = "blindExpiration";
  constructor(time, source) {
    super(_BlindExpirationEvent.type, time);
    this.source = source;
  }
};
var blindExpirationEvent_default = BlindExpirationEvent;

// engine/events/silenceExpirationEvent.js
var SilenceExpirationEvent = class _SilenceExpirationEvent extends combatEvent_default {
  static type = "silenceExpiration";
  constructor(time, source) {
    super(_SilenceExpirationEvent.type, time);
    this.source = source;
  }
};
var silenceExpirationEvent_default = SilenceExpirationEvent;

// engine/events/curseExpirationEvent.js
var CurseExpirationEvent = class _CurseExpirationEvent extends combatEvent_default {
  static type = "curseExpiration";
  static maxCurseStacks = 5;
  constructor(time, curseAmount, source) {
    super(_CurseExpirationEvent.type, time);
    this.curseAmount = Math.min(curseAmount + 1, _CurseExpirationEvent.maxCurseStacks);
    this.source = source;
  }
};
var curseExpirationEvent_default = CurseExpirationEvent;

// engine/events/weakenExpirationEvent.js
var WeakenExpirationEvent = class _WeakenExpirationEvent extends combatEvent_default {
  static type = "weakenExpiration";
  static maxWeakenStacks = 5;
  constructor(time, weakenAmount, source) {
    super(_WeakenExpirationEvent.type, time);
    this.weakenAmount = Math.min(
      weakenAmount + 1,
      _WeakenExpirationEvent.maxWeakenStacks
    );
    this.source = source;
  }
};
var weakenExpirationEvent_default = WeakenExpirationEvent;

// engine/events/furyExpirationEvent.js
var FuryExpirationEvent = class _FuryExpirationEvent extends combatEvent_default {
  static type = "furyExpiration";
  constructor(time, furyAmount, source) {
    super(_FuryExpirationEvent.type, time);
    this.furyAmount = furyAmount;
    this.source = source;
  }
};
var furyExpirationEvent_default = FuryExpirationEvent;

// engine/events/enrageTickEvent.js
var EnrageTickEvent = class _EnrageTickEvent extends combatEvent_default {
  static type = "enrageTick";
  constructor(time, encounterTime) {
    super(_EnrageTickEvent.type, time);
    this.encounterTime = encounterTime;
  }
};
var enrageTickEvent_default = EnrageTickEvent;

// game-data:combatStyleDetailMap
init_data_shim();
var combatStyleDetailMap_default = slot("combatStyleDetailMap");

// engine/simResult.js
var SimResult = class {
  constructor(zone, labyrinth, numberOfPlayers) {
    this.deaths = {};
    this.experienceGained = {};
    this.encounters = 0;
    this.attacks = {};
    this.consumablesUsed = {};
    this.hitpointsGained = {};
    this.manapointsGained = {};
    this.debuffOnLevelGap = {};
    this.dropRateMultiplier = {};
    this.rareFindMultiplier = {};
    this.combatDropQuantity = {};
    this.playerRanOutOfMana = {
      "player1": false,
      "player2": false,
      "player3": false,
      "player4": false,
      "player5": false
    };
    this.playerRanOutOfManaTime = {};
    this.manaUsed = {};
    this.timeSpentAlive = [];
    this.bossSpawns = [];
    this.hitpointsSpent = {};
    this.zoneName = zone?.hrid;
    this.difficultyTier = zone?.difficultyTier;
    this.labyrinthName = labyrinth?.monsterHrid;
    this.roomLevel = labyrinth?.roomLevel;
    this.isDungeon = false;
    this.isLabyrinth = labyrinth ? true : false;
    this.dungeonsCompleted = 0;
    this.dungeonsFailed = 0;
    this.maxWaveReached = 0;
    this.numberOfPlayers = numberOfPlayers;
    this.maxEnrageStack = 0;
    this.minDungenonTime = 0;
    this.maxDungenonTime = 0;
    this.lastDungeonFinishTime = 0;
    this.lastEncounterFinishTime = 0;
    this.labyAttemptCount = 0;
    this.wipeEvents = [];
    this.timeSeriesData = {
      timestamps: [],
      players: {}
    };
  }
  addWipeEvent(logs, simulationTime, wave) {
    this.wipeEvents.push({
      simulationTime,
      logs,
      wave,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  addDeath(unit) {
    if (!this.deaths[unit.hrid]) {
      this.deaths[unit.hrid] = 0;
    }
    this.deaths[unit.hrid] += 1;
  }
  updateTimeSpentAlive(name, alive2, time) {
    const i = this.timeSpentAlive.findIndex((e) => e.name === name);
    if (alive2) {
      if (i !== -1) {
        this.timeSpentAlive[i].alive = true;
        this.timeSpentAlive[i].spawnedAt = time;
      } else {
        this.timeSpentAlive.push({ name, timeSpentAlive: 0, spawnedAt: time, alive: true, count: 0 });
      }
    } else {
      const timeAlive = time - this.timeSpentAlive[i].spawnedAt;
      this.timeSpentAlive[i].alive = false;
      this.timeSpentAlive[i].timeSpentAlive += timeAlive;
      this.timeSpentAlive[i].count += 1;
    }
  }
  updateDungenonFinish(beginFlag, finishTime) {
    const i = this.timeSpentAlive.findIndex((e) => e.name === beginFlag);
    if (i == -1) {
      return;
    }
    const currentDungenonTime = finishTime - this.timeSpentAlive[i].spawnedAt;
    if (this.minDungenonTime == 0 || this.minDungenonTime > currentDungenonTime) {
      this.minDungenonTime = currentDungenonTime;
    }
    if (this.maxDungenonTime < currentDungenonTime) {
      this.maxDungenonTime = currentDungenonTime;
    }
  }
  addExperienceGain(unit, experience) {
    if (!unit.isPlayer) {
      return;
    }
    if (!this.experienceGained[unit.hrid]) {
      this.experienceGained[unit.hrid] = {
        stamina: 0,
        intelligence: 0,
        attack: 0,
        melee: 0,
        defense: 0,
        ranged: 0,
        magic: 0
      };
    }
    let experienceGainedRate = {
      "stamina": 0,
      "intelligence": 0,
      "attack": 0,
      "melee": 0,
      "defense": 0,
      "ranged": 0,
      "magic": 0
    };
    const primaryTraining = unit.combatDetails.combatStats.primaryTraining;
    experienceGainedRate[primaryTraining.split("/")[2]] = 0.3;
    const skillExpMap = combatStyleDetailMap_default[unit.combatDetails.combatStats.combatStyleHrid].skillExpMap;
    const skillExpMapLength = Object.keys(skillExpMap).length;
    const focusTraining = unit.combatDetails.combatStats.focusTraining;
    if (focusTraining && skillExpMap[focusTraining]) {
      experienceGainedRate[focusTraining.split("/")[2]] += 0.7;
    } else {
      Object.keys(skillExpMap).forEach((skillHrid) => {
        experienceGainedRate[skillHrid.split("/")[2]] += 0.7 / skillExpMapLength;
      });
    }
    for (const [type, rate] of Object.entries(experienceGainedRate)) {
      if (rate <= 0) continue;
      const skillExperience = rate * (1 + unit.combatDetails.combatStats[type + "Experience"]);
      this.experienceGained[unit.hrid][type] += experience * (1 + unit.combatDetails.combatStats.combatExperience) * skillExperience * (1 + unit.debuffOnLevelGap);
    }
  }
  addEncounterEnd() {
    this.encounters++;
  }
  addAttack(source, target, ability, hit) {
    if (!this.attacks[source.hrid]) {
      this.attacks[source.hrid] = {};
    }
    if (!this.attacks[source.hrid][target.hrid]) {
      this.attacks[source.hrid][target.hrid] = {};
    }
    if (!this.attacks[source.hrid][target.hrid][ability]) {
      this.attacks[source.hrid][target.hrid][ability] = {};
    }
    if (!this.attacks[source.hrid][target.hrid][ability][hit]) {
      this.attacks[source.hrid][target.hrid][ability][hit] = 0;
    }
    this.attacks[source.hrid][target.hrid][ability][hit] += 1;
  }
  addConsumableUse(unit, consumable) {
    if (!this.consumablesUsed[unit.hrid]) {
      this.consumablesUsed[unit.hrid] = {};
    }
    if (!this.consumablesUsed[unit.hrid][consumable.hrid]) {
      this.consumablesUsed[unit.hrid][consumable.hrid] = 0;
    }
    this.consumablesUsed[unit.hrid][consumable.hrid] += 1;
  }
  addHitpointsGained(unit, source, amount) {
    if (!this.hitpointsGained[unit.hrid]) {
      this.hitpointsGained[unit.hrid] = {};
    }
    if (!this.hitpointsGained[unit.hrid][source]) {
      this.hitpointsGained[unit.hrid][source] = 0;
    }
    this.hitpointsGained[unit.hrid][source] += amount;
  }
  addManapointsGained(unit, source, amount) {
    if (!this.manapointsGained[unit.hrid]) {
      this.manapointsGained[unit.hrid] = {};
    }
    if (!this.manapointsGained[unit.hrid][source]) {
      this.manapointsGained[unit.hrid][source] = 0;
    }
    this.manapointsGained[unit.hrid][source] += amount;
  }
  setDropRateMultipliers(unit) {
    if (!this.dropRateMultiplier[unit.hrid]) {
      this.dropRateMultiplier[unit.hrid] = {};
    }
    this.dropRateMultiplier[unit.hrid] = 1 + unit.combatDetails.combatStats.combatDropRate;
    if (!this.rareFindMultiplier[unit.hrid]) {
      this.rareFindMultiplier[unit.hrid] = {};
    }
    this.rareFindMultiplier[unit.hrid] = 1 + unit.combatDetails.combatStats.combatRareFind;
    if (!this.combatDropQuantity[unit.hrid]) {
      this.combatDropQuantity[unit.hrid] = {};
    }
    this.combatDropQuantity[unit.hrid] = unit.combatDetails.combatStats.combatDropQuantity;
    if (!this.debuffOnLevelGap[unit.hrid]) {
      this.debuffOnLevelGap[unit.hrid] = {};
    }
    this.debuffOnLevelGap[unit.hrid] = unit.debuffOnLevelGap;
  }
  setManaUsed(unit) {
    this.manaUsed[unit.hrid] = {};
    for (let [key, value] of unit.abilityManaCosts.entries()) {
      this.manaUsed[unit.hrid][key] = value;
    }
  }
  addHitpointsSpent(unit, source, amount) {
    if (!this.hitpointsSpent[unit.hrid]) {
      this.hitpointsSpent[unit.hrid] = {};
    }
    if (!this.hitpointsSpent[unit.hrid][source]) {
      this.hitpointsSpent[unit.hrid][source] = 0;
    }
    this.hitpointsSpent[unit.hrid][source] += amount;
  }
  addRanOutOfManaCount(unit, isOutOfMana, time) {
    if (isOutOfMana) this.playerRanOutOfMana[unit.hrid] = true;
    if (!this.playerRanOutOfManaTime[unit.hrid]) {
      this.playerRanOutOfManaTime[unit.hrid] = { isOutOfMana: false, startTimeForOutOfMana: 0, totalTimeForOutOfMana: 0 };
    }
    if (isOutOfMana) {
      if (!this.playerRanOutOfManaTime[unit.hrid].isOutOfMana) {
        this.playerRanOutOfManaTime[unit.hrid].isOutOfMana = true;
        this.playerRanOutOfManaTime[unit.hrid].startTimeForOutOfMana = time;
      }
    } else {
      if (this.playerRanOutOfManaTime[unit.hrid].isOutOfMana) {
        this.playerRanOutOfManaTime[unit.hrid].isOutOfMana = false;
        this.playerRanOutOfManaTime[unit.hrid].totalTimeForOutOfMana += time - this.playerRanOutOfManaTime[unit.hrid].startTimeForOutOfMana;
      }
    }
  }
  // 添加时间序列数据点
  addTimeSeriesSnapshot(time, players) {
    this.timeSeriesData.timestamps.push(time);
    players.forEach((player) => {
      if (!this.timeSeriesData.players[player.hrid]) {
        this.timeSeriesData.players[player.hrid] = {
          hp: [],
          mp: [],
          maxHp: [],
          maxMp: []
        };
      }
      const playerData = this.timeSeriesData.players[player.hrid];
      playerData.hp.push(player.combatDetails.currentHitpoints);
      playerData.mp.push(player.combatDetails.currentManapoints);
      playerData.maxHp.push(player.combatDetails.maxHitpoints);
      playerData.maxMp.push(player.combatDetails.maxManapoints);
    });
  }
};
var simResult_default = SimResult;

// engine/events/abilityCastEndEvent.js
var AbilityCastEndEvent = class _AbilityCastEndEvent extends combatEvent_default {
  static type = "abilityCastEndEvent";
  constructor(time, source, ability) {
    super(_AbilityCastEndEvent.type, time);
    this.source = source;
    this.ability = ability;
  }
};
var abilityCastEndEvent_default = AbilityCastEndEvent;

// engine/events/awaitCooldownEvent.js
var AwaitCooldownEvent = class _AwaitCooldownEvent extends combatEvent_default {
  static type = "awaitCooldownEvent";
  constructor(time, source) {
    super(_AwaitCooldownEvent.type, time);
    this.source = source;
  }
};
var awaitCooldownEvent_default = AwaitCooldownEvent;

// engine/buff.js
var Buff = class {
  startTime;
  constructor(buff, level = 1) {
    this.uniqueHrid = buff.uniqueHrid;
    this.typeHrid = buff.typeHrid;
    this.ratioBoost = buff.ratioBoost + (level - 1) * buff.ratioBoostLevelBonus;
    this.flatBoost = buff.flatBoost + (level - 1) * buff.flatBoostLevelBonus;
    this.duration = buff.duration;
    this.multiplierForSkillHrid = buff.multiplierForSkillHrid ?? "";
    this.multiplierPerSkillLevel = buff.multiplierPerSkillLevel ?? 0;
  }
};
var buff_default = Buff;

// game-data:abilityDetailMap
init_data_shim();
var abilityDetailMap_default = slot("abilityDetailMap");

// game-data:combatTriggerDependencyDetailMap
init_data_shim();
var combatTriggerDependencyDetailMap_default = slot("combatTriggerDependencyDetailMap");

// engine/trigger.js
var Trigger = class _Trigger {
  constructor(dependencyHrid, conditionHrid, comparatorHrid, value = 0) {
    this.dependencyHrid = dependencyHrid;
    this.conditionHrid = conditionHrid;
    this.comparatorHrid = comparatorHrid;
    this.value = value;
  }
  static createFromDTO(dto) {
    let trigger = new _Trigger(dto.dependencyHrid, dto.conditionHrid, dto.comparatorHrid, dto.value);
    return trigger;
  }
  isActive(source, target, friendlies, enemies, currentTime) {
    if (combatTriggerDependencyDetailMap_default[this.dependencyHrid].isSingleTarget) {
      return this.isActiveSingleTarget(source, target, currentTime);
    } else {
      return this.isActiveMultiTarget(friendlies, enemies, currentTime);
    }
  }
  isActiveSingleTarget(source, target, currentTime) {
    let dependencyValue;
    switch (this.dependencyHrid) {
      case "/combat_trigger_dependencies/self":
        dependencyValue = this.getDependencyValue(source, currentTime);
        break;
      case "/combat_trigger_dependencies/targeted_enemy":
        if (!target) {
          return false;
        }
        dependencyValue = this.getDependencyValue(target, currentTime);
        break;
      default:
        throw new Error("Unknown dependencyHrid in trigger: " + this.dependencyHrid);
    }
    return this.compareValue(dependencyValue);
  }
  isActiveMultiTarget(friendlies, enemies, currentTime) {
    let dependency;
    switch (this.dependencyHrid) {
      case "/combat_trigger_dependencies/all_allies":
        dependency = friendlies;
        break;
      case "/combat_trigger_dependencies/all_enemies":
        if (!enemies) {
          return false;
        }
        dependency = enemies;
        break;
      default:
        throw new Error("Unknown dependencyHrid in trigger: " + this.dependencyHrid);
    }
    let dependencyValue;
    switch (this.conditionHrid) {
      case "/combat_trigger_conditions/number_of_active_units":
        dependencyValue = dependency.filter((unit) => unit.combatDetails.currentHitpoints > 0).length;
        break;
      case "/combat_trigger_conditions/number_of_dead_units":
        dependencyValue = dependency.filter((unit) => unit.combatDetails.currentHitpoints <= 0).length;
        break;
      case "/combat_trigger_conditions/lowest_hp_percentage":
        dependencyValue = dependency.filter((unit) => unit.combatDetails.currentHitpoints > 0).reduce((prev, curr) => {
          let currentHpPercentage = curr.combatDetails.currentHitpoints / curr.combatDetails.maxHitpoints;
          return currentHpPercentage < prev ? currentHpPercentage : prev;
        }, 2) * 100;
        break;
      default:
        dependencyValue = dependency.filter((unit) => unit.combatDetails.currentHitpoints > 0).map((unit) => this.getDependencyValue(unit, currentTime)).reduce((prev, cur) => prev + cur, 0);
        break;
    }
    return this.compareValue(dependencyValue);
  }
  getDependencyValue(source, currentTime) {
    switch (this.conditionHrid) {
      case "/combat_trigger_conditions/berserk":
      case "/combat_trigger_conditions/frenzy":
      case "/combat_trigger_conditions/precision":
      case "/combat_trigger_conditions/vampirism":
      case "/combat_trigger_conditions/attack_coffee":
      case "/combat_trigger_conditions/defense_coffee":
      case "/combat_trigger_conditions/lucky_coffee":
      case "/combat_trigger_conditions/magic_coffee":
      case "/combat_trigger_conditions/melee_coffee":
      case "/combat_trigger_conditions/ranged_coffee":
      case "/combat_trigger_conditions/swiftness_coffee":
      case "/combat_trigger_conditions/wisdom_coffee":
      case "/combat_trigger_conditions/ice_spear":
      case "/combat_trigger_conditions/puncture":
      case "/combat_trigger_conditions/frost_surge":
      case "/combat_trigger_conditions/elusiveness":
      case "/combat_trigger_conditions/channeling_coffee":
      case "/combat_trigger_conditions/fierce_aura":
      case "/combat_trigger_conditions/invincible_armor":
      case "/combat_trigger_conditions/invincible_fire_resistance":
      case "/combat_trigger_conditions/invincible_nature_resistance":
      case "/combat_trigger_conditions/invincible_water_resistance":
      case "/combat_trigger_conditions/provoke":
      case "/combat_trigger_conditions/taunt":
      case "/combat_trigger_conditions/crippling_slash":
      case "/combat_trigger_conditions/mana_spring":
      case "/combat_trigger_conditions/retribution":
      case "/combat_trigger_conditions/fracturing_impact":
      case "/combat_trigger_conditions/maim":
      case "/combat_trigger_conditions/curse":
      case "/combat_trigger_conditions/weaken":
        let buffHrid = "/buff_uniques";
        buffHrid += this.conditionHrid.slice(this.conditionHrid.lastIndexOf("/"));
        return source.combatBuffs[buffHrid];
      case "/combat_trigger_conditions/critical_aura":
      case "/combat_trigger_conditions/critical_coffee":
      case "/combat_trigger_conditions/intelligence_coffee":
      case "/combat_trigger_conditions/stamina_coffee":
      case "/combat_trigger_conditions/elemental_affinity":
      case "/combat_trigger_conditions/fury":
      case "/combat_trigger_conditions/guardian_aura":
      case "/combat_trigger_conditions/insanity":
      case "/combat_trigger_conditions/spike_shell":
      case "/combat_trigger_conditions/toxic_pollen":
      case "/combat_trigger_conditions/invincible":
      case "/combat_trigger_conditions/mystic_aura":
      case "/combat_trigger_conditions/pestilent_shot":
      case "/combat_trigger_conditions/smoke_burst":
      case "/combat_trigger_conditions/speed_aura":
      case "/combat_trigger_conditions/toughness":
      case "/combat_trigger_conditions/enrage":
        let buffPrefix = "/buff_uniques";
        buffPrefix += this.conditionHrid.slice(this.conditionHrid.lastIndexOf("/"));
        let buffs = Object.keys(source.combatBuffs).filter((buff) => buff.startsWith(buffPrefix));
        return source.combatBuffs[buffs?.[0]];
      case "/combat_trigger_conditions/current_hp":
        return source.combatDetails.currentHitpoints;
      case "/combat_trigger_conditions/current_mp":
        return source.combatDetails.currentManapoints;
      case "/combat_trigger_conditions/missing_hp":
        return source.combatDetails.maxHitpoints - source.combatDetails.currentHitpoints;
      case "/combat_trigger_conditions/missing_mp":
        return source.combatDetails.maxManapoints - source.combatDetails.currentManapoints;
      case "/combat_trigger_conditions/stun_status":
        return source.isStunned || source.stunExpireTime == currentTime;
      case "/combat_trigger_conditions/blind_status":
        return source.isBlinded || source.blindExpireTime == currentTime;
      case "/combat_trigger_conditions/silence_status":
        return source.isSilenced || source.silenceExpireTime == currentTime;
      default:
        throw new Error("Unknown conditionHrid in trigger: " + this.conditionHrid);
    }
  }
  compareValue(dependencyValue) {
    switch (this.comparatorHrid) {
      case "/combat_trigger_comparators/greater_than_equal":
        return dependencyValue >= this.value;
      case "/combat_trigger_comparators/less_than_equal":
        return dependencyValue <= this.value;
      case "/combat_trigger_comparators/is_active":
        return !!dependencyValue;
      case "/combat_trigger_comparators/is_inactive":
        return !dependencyValue;
      default:
        throw new Error("Unknown comparatorHrid in trigger: " + this.comparatorHrid);
    }
  }
};
var trigger_default = Trigger;

// engine/ability.js
var abilityFromCombatStat = {
  "blaze": {
    "hrid": "/abilities/blaze",
    "name": "Blaze",
    "description": "",
    "isSpecialAbility": false,
    "manaCost": 0,
    "cooldownDuration": 0,
    "castDuration": 0,
    "abilityEffects": [
      {
        "targetType": "allEnemies",
        "effectType": "/ability_effect_types/damage",
        "combatStyleHrid": "/combat_styles/magic",
        "damageType": "/damage_types/fire",
        "baseDamageFlat": 0,
        "baseDamageFlatLevelBonus": 0,
        "baseDamageRatio": 0.3,
        "baseDamageRatioLevelBonus": 0,
        "bonusAccuracyRatio": 0,
        "bonusAccuracyRatioLevelBonus": 0,
        "damageOverTimeRatio": 0,
        "damageOverTimeDuration": 0,
        "armorDamageRatio": 0,
        "armorDamageRatioLevelBonus": 0,
        "hpDrainRatio": 0,
        "pierceChance": 0,
        "blindChance": 0,
        "blindDuration": 0,
        "silenceChance": 0,
        "silenceDuration": 0,
        "stunChance": 0,
        "stunDuration": 0,
        "spendHpRatio": 0,
        "buffs": null
      }
    ],
    "defaultCombatTriggers": [
      {
        "dependencyHrid": "/combat_trigger_dependencies/all_enemies",
        "conditionHrid": "/combat_trigger_conditions/number_of_active_units",
        "comparatorHrid": "/combat_trigger_comparators/greater_than_equal",
        "value": 1
      },
      {
        "dependencyHrid": "/combat_trigger_dependencies/all_enemies",
        "conditionHrid": "/combat_trigger_conditions/current_hp",
        "comparatorHrid": "/combat_trigger_comparators/greater_than_equal",
        "value": 1
      }
    ]
  },
  "bloom": {
    "hrid": "/abilities/bloom",
    "name": "Bloom",
    "description": "",
    "isSpecialAbility": false,
    "manaCost": 0,
    "cooldownDuration": 0,
    "castDuration": 0,
    "abilityEffects": [
      {
        "targetType": "lowestHpAlly",
        "effectType": "/ability_effect_types/heal",
        "combatStyleHrid": "/combat_styles/magic",
        "damageType": "",
        "baseDamageFlat": 10,
        "baseDamageFlatLevelBonus": 0,
        "baseDamageRatio": 0.15,
        "baseDamageRatioLevelBonus": 0,
        "bonusAccuracyRatio": 0,
        "bonusAccuracyRatioLevelBonus": 0,
        "damageOverTimeRatio": 0,
        "damageOverTimeDuration": 0,
        "armorDamageRatio": 0,
        "armorDamageRatioLevelBonus": 0,
        "hpDrainRatio": 0,
        "pierceChance": 0,
        "blindChance": 0,
        "blindDuration": 0,
        "silenceChance": 0,
        "silenceDuration": 0,
        "stunChance": 0,
        "stunDuration": 0,
        "spendHpRatio": 0,
        "buffs": null
      }
    ],
    "defaultCombatTriggers": [
      {
        "dependencyHrid": "/combat_trigger_dependencies/all_allies",
        "conditionHrid": "/combat_trigger_conditions/lowest_hp_percentage",
        "comparatorHrid": "/combat_trigger_comparators/less_than_equal",
        "value": 100
      }
    ]
  }
};
var Ability = class _Ability {
  constructor(hrid, level = 1, triggers = null) {
    this.hrid = hrid;
    this.level = level;
    let gameAbility = abilityDetailMap_default[hrid];
    if (!gameAbility) {
      gameAbility = abilityFromCombatStat[hrid];
    }
    if (!gameAbility) {
      throw new Error("No ability found for hrid: " + this.hrid);
    }
    this.manaCost = gameAbility.manaCost;
    this.cooldownDuration = gameAbility.cooldownDuration;
    this.castDuration = gameAbility.castDuration;
    this.isSpecialAbility = gameAbility.isSpecialAbility;
    this.abilityEffects = [];
    for (const effect of gameAbility.abilityEffects) {
      let abilityEffect = {
        targetType: effect.targetType,
        effectType: effect.effectType,
        combatStyleHrid: effect.combatStyleHrid,
        damageType: effect.damageType,
        damageFlat: effect.baseDamageFlat + (this.level - 1) * effect.baseDamageFlatLevelBonus,
        damageRatio: effect.baseDamageRatio + (this.level - 1) * effect.baseDamageRatioLevelBonus,
        bonusAccuracyRatio: effect.bonusAccuracyRatio + (this.level - 1) * effect.bonusAccuracyRatioLevelBonus,
        damageOverTimeRatio: effect.damageOverTimeRatio,
        damageOverTimeDuration: effect.damageOverTimeDuration,
        armorDamageRatio: effect.armorDamageRatio + (this.level - 1) * effect.armorDamageRatioLevelBonus,
        hpDrainRatio: effect.hpDrainRatio,
        pierceChance: effect.pierceChance,
        blindChance: effect.blindChance,
        blindDuration: effect.blindDuration,
        silenceChance: effect.silenceChance,
        silenceDuration: effect.silenceDuration,
        stunChance: effect.stunChance,
        stunDuration: effect.stunDuration,
        spendHpRatio: effect.spendHpRatio,
        buffs: null
      };
      if (effect.buffs) {
        abilityEffect.buffs = [];
        for (const buff of effect.buffs) {
          abilityEffect.buffs.push(new buff_default(buff, this.level));
        }
      }
      this.abilityEffects.push(abilityEffect);
    }
    if (triggers) {
      this.triggers = triggers;
    } else {
      this.triggers = [];
      for (const defaultTrigger of gameAbility.defaultCombatTriggers) {
        let trigger = new trigger_default(
          defaultTrigger.dependencyHrid,
          defaultTrigger.conditionHrid,
          defaultTrigger.comparatorHrid,
          defaultTrigger.value
        );
        this.triggers.push(trigger);
      }
    }
    this.lastUsed = Number.MIN_SAFE_INTEGER;
  }
  static createFromDTO(dto) {
    let triggers = dto.triggers.map((trigger) => trigger_default.createFromDTO(trigger));
    let ability = new _Ability(dto.hrid, dto.level, triggers);
    return ability;
  }
  shouldTrigger(currentTime, source, target, friendlies, enemies) {
    if (source.isStunned) {
      return false;
    }
    if (source.isSilenced) {
      return false;
    }
    let haste = source.combatDetails.combatStats.abilityHaste;
    let cooldownDuration = this.cooldownDuration;
    if (haste > 0) {
      cooldownDuration = cooldownDuration * 100 / (100 + haste);
    }
    if (this.lastUsed + cooldownDuration > currentTime) {
      return false;
    }
    if (this.triggers.length == 0) {
      return true;
    }
    let shouldTrigger = true;
    for (const trigger of this.triggers) {
      if (!trigger.isActive(source, target, friendlies, enemies, currentTime)) {
        shouldTrigger = false;
      }
    }
    return shouldTrigger;
  }
};
var ability_default = Ability;

// engine/combatUnit.js
var CombatUnit = class {
  isPlayer;
  isStunned = false;
  stunExpireTime = null;
  isBlinded = false;
  blindExpireTime = null;
  isSilenced = false;
  silenceExpireTime = null;
  isOutOfMana = false;
  // Base levels which don't change after initialization
  staminaLevel = 1;
  intelligenceLevel = 1;
  attackLevel = 1;
  meleeLevel = 1;
  defenseLevel = 1;
  rangedLevel = 1;
  magicLevel = 1;
  experience = 0;
  experienceRate = 0;
  enrageTime = 0;
  abilities = [null, null, null, null];
  food = [null, null, null];
  drinks = [null, null, null];
  houseRooms = [];
  achievements = null;
  dropTable = [];
  rareDropTable = [];
  abilityManaCosts = /* @__PURE__ */ new Map();
  // Calculated combat stats including temporary buffs
  combatDetails = {
    staminaLevel: 1,
    intelligenceLevel: 1,
    attackLevel: 1,
    meleeLevel: 1,
    defenseLevel: 1,
    rangedLevel: 1,
    magicLevel: 1,
    maxHitpoints: 110,
    currentHitpoints: 110,
    maxManapoints: 110,
    currentManapoints: 110,
    stabAccuracyRating: 11,
    slashAccuracyRating: 11,
    smashAccuracyRating: 11,
    rangedAccuracyRating: 11,
    magicAccuracyRating: 11,
    stabMaxDamage: 11,
    slashMaxDamage: 11,
    smashMaxDamage: 11,
    rangedMaxDamage: 11,
    magicMaxDamage: 11,
    stabEvasionRating: 11,
    slashEvasionRating: 11,
    smashEvasionRating: 11,
    rangedEvasionRating: 11,
    magicEvasionRating: 11,
    defensiveMaxDamage: 0,
    totalArmor: 0.2,
    totalWaterResistance: 0.4,
    totalNatureResistance: 0.4,
    totalFireResistance: 0.4,
    abilityHaste: 0,
    tenacity: 0,
    totalThreat: 100,
    combatStats: {
      combatStyleHrid: "/combat_styles/smash",
      damageType: "/damage_types/physical",
      attackInterval: 3e9,
      autoAttackDamage: 0,
      abilityDamage: 0,
      criticalRate: 0,
      criticalDamage: 0,
      stabAccuracy: 0,
      slashAccuracy: 0,
      smashAccuracy: 0,
      rangedAccuracy: 0,
      magicAccuracy: 0,
      stabDamage: 0,
      slashDamage: 0,
      smashDamage: 0,
      rangedDamage: 0,
      magicDamage: 0,
      defensiveDamage: 0,
      taskDamage: 0,
      physicalAmplify: 0,
      waterAmplify: 0,
      natureAmplify: 0,
      fireAmplify: 0,
      healingAmplify: 0,
      physicalThorns: 0,
      elementalThorns: 0,
      maxHitpoints: 0,
      maxManapoints: 0,
      stabEvasion: 0,
      slashEvasion: 0,
      smashEvasion: 0,
      rangedEvasion: 0,
      magicEvasion: 0,
      armor: 0,
      waterResistance: 0,
      natureResistance: 0,
      fireResistance: 0,
      lifeSteal: 0,
      hpRegenPer10: 0.01,
      mpRegenPer10: 0.01,
      combatDropRate: 0,
      combatDropQuantity: 0,
      combatRareFind: 0,
      combatExperience: 0,
      foodSlots: 1,
      drinkSlots: 1,
      armorPenetration: 0,
      waterPenetration: 0,
      naturePenetration: 0,
      firePenetration: 0,
      manaLeech: 0,
      castSpeed: 0,
      threat: 100,
      parry: 0,
      mayhem: 0,
      pierce: 0,
      curse: 0,
      ripple: 0,
      bloom: 0,
      blaze: 0,
      weaken: 0,
      fury: 0,
      foodHaste: 0,
      drinkConcentration: 0,
      damageTaken: 0,
      attackSpeed: 0,
      armorDamageRatio: 0,
      hpDrainRatio: 0,
      primaryTraining: "",
      focusTraining: "",
      staminaExperience: 0,
      intelligenceExperience: 0,
      attackExperience: 0,
      defenseExperience: 0,
      meleeExperience: 0,
      rangedExperience: 0,
      magicExperience: 0,
      retaliation: 0,
      maxHitpointsRatio: 0,
      maxManapointsRatio: 0
    }
  };
  combatBuffs = {};
  permanentBuffs = {};
  zoneBuffs = {};
  extraBuffs = {};
  constructor() {
  }
  updateCombatDetails() {
    if (this.isPlayer) {
      if (this.combatDetails.combatStats.hpRegenPer10 === 0) {
        this.combatDetails.combatStats.hpRegenPer10 = 0.01;
      } else {
        this.combatDetails.combatStats.hpRegenPer10 = 0.01 + this.combatDetails.combatStats.hpRegenPer10;
      }
      if (this.combatDetails.combatStats.mpRegenPer10 === 0) {
        this.combatDetails.combatStats.mpRegenPer10 = 0.01;
      } else {
        this.combatDetails.combatStats.mpRegenPer10 = 0.01 + this.combatDetails.combatStats.mpRegenPer10;
      }
    }
    ["stamina", "intelligence", "attack", "melee", "defense", "ranged", "magic"].forEach((stat) => {
      this.combatDetails[stat + "Level"] = this[stat + "Level"];
      let boosts = this.getBuffBoosts("/buff_types/" + stat + "_level");
      boosts.forEach((buff) => {
        this.combatDetails[stat + "Level"] += this[stat + "Level"] * buff.ratioBoost;
        this.combatDetails[stat + "Level"] += buff.flatBoost;
      });
    });
    this.combatDetails.maxHitpoints = Math.floor(
      (10 * (10 + this.combatDetails.staminaLevel) + this.combatDetails.combatStats.maxHitpoints) * (1 + this.combatDetails.combatStats.maxHitpointsRatio)
    );
    this.combatDetails.maxManapoints = Math.floor(
      (10 * (10 + this.combatDetails.intelligenceLevel) + this.combatDetails.combatStats.maxManapoints) * (1 + this.combatDetails.combatStats.maxManapointsRatio)
    );
    let accuracyRatioBoostFromFury = this.getBuffBoost("/buff_types/fury_accuracy").ratioBoost;
    let damageRatioBoostFromFury = this.getBuffBoost("/buff_types/fury_damage").ratioBoost;
    let accuracyRatioBoost = this.getBuffBoost("/buff_types/accuracy").ratioBoost;
    let damageRatioBoost = this.getBuffBoost("/buff_types/damage").ratioBoost;
    ["stab", "slash", "smash"].forEach((style) => {
      this.combatDetails[style + "AccuracyRating"] = (10 + this.combatDetails.attackLevel) * (1 + this.combatDetails.combatStats[style + "Accuracy"]) * (1 + accuracyRatioBoost) * (1 + accuracyRatioBoostFromFury);
      this.combatDetails[style + "MaxDamage"] = (10 + this.combatDetails.meleeLevel) * (1 + this.combatDetails.combatStats[style + "Damage"]) * (1 + damageRatioBoost) * (1 + damageRatioBoostFromFury);
      let baseEvasion = (10 + this.combatDetails.defenseLevel) * (1 + this.combatDetails.combatStats[style + "Evasion"]);
      this.combatDetails[style + "EvasionRating"] = baseEvasion;
      let evasionBoosts2 = this.getBuffBoosts("/buff_types/evasion");
      for (const boost of evasionBoosts2) {
        this.combatDetails[style + "EvasionRating"] += boost.flatBoost;
        this.combatDetails[style + "EvasionRating"] += baseEvasion * boost.ratioBoost;
      }
    });
    this.combatDetails.defensiveMaxDamage = (10 + this.combatDetails.defenseLevel) * (1 + this.combatDetails.combatStats.defensiveDamage) * (1 + damageRatioBoost) * (1 + damageRatioBoostFromFury);
    if (this.equipment?.["/equipment_types/two_hand"]?.hrid.includes("bulwark")) {
      this.combatDetails.smashMaxDamage += this.combatDetails.defensiveMaxDamage;
    }
    this.combatDetails.rangedAccuracyRating = (10 + this.combatDetails.attackLevel) * (1 + this.combatDetails.combatStats.rangedAccuracy) * (1 + accuracyRatioBoost) * (1 + accuracyRatioBoostFromFury);
    this.combatDetails.rangedMaxDamage = (10 + this.combatDetails.rangedLevel) * (1 + this.combatDetails.combatStats.rangedDamage) * (1 + damageRatioBoost) * (1 + damageRatioBoostFromFury);
    let baseRangedEvasion = (10 + this.combatDetails.defenseLevel) * (1 + this.combatDetails.combatStats.rangedEvasion);
    this.combatDetails.rangedEvasionRating = baseRangedEvasion;
    let evasionBoosts = this.getBuffBoosts("/buff_types/evasion");
    for (const boost of evasionBoosts) {
      this.combatDetails.rangedEvasionRating += boost.flatBoost;
      this.combatDetails.rangedEvasionRating += baseRangedEvasion * boost.ratioBoost;
    }
    this.combatDetails.combatStats.damageTaken = this.getBuffBoost("/buff_types/damage_taken").flatBoost;
    this.combatDetails.magicAccuracyRating = (10 + this.combatDetails.attackLevel) * (1 + this.combatDetails.combatStats.magicAccuracy) * (1 + accuracyRatioBoost) * (1 + accuracyRatioBoostFromFury);
    this.combatDetails.magicMaxDamage = (10 + this.combatDetails.magicLevel) * (1 + this.combatDetails.combatStats.magicDamage) * (1 + damageRatioBoost) * (1 + damageRatioBoostFromFury);
    let baseMagicEvasion = (10 + this.combatDetails.defenseLevel) * (1 + this.combatDetails.combatStats.magicEvasion);
    this.combatDetails.magicEvasionRating = baseMagicEvasion;
    for (const boost of evasionBoosts) {
      this.combatDetails.magicEvasionRating += boost.flatBoost;
      this.combatDetails.magicEvasionRating += baseMagicEvasion * boost.ratioBoost;
    }
    this.combatDetails.combatStats.physicalAmplify += this.getBuffBoost("/buff_types/physical_amplify").flatBoost;
    this.combatDetails.combatStats.waterAmplify += this.getBuffBoost("/buff_types/water_amplify").flatBoost;
    this.combatDetails.combatStats.natureAmplify += this.getBuffBoost("/buff_types/nature_amplify").flatBoost;
    this.combatDetails.combatStats.fireAmplify += this.getBuffBoost("/buff_types/fire_amplify").flatBoost;
    this.combatDetails.combatStats.healingAmplify += this.getBuffBoost("/buff_types/healing_amplify").flatBoost;
    this.combatDetails.combatStats.attackInterval /= 1 + this.combatDetails.attackLevel / 2e3;
    let baseAttackSpeed = this.combatDetails.combatStats.attackSpeed;
    this.combatDetails.combatStats.attackInterval /= 1 + baseAttackSpeed;
    let attackIntervalBoosts = this.getBuffBoosts("/buff_types/attack_speed");
    let attackIntervalRatioBoost = attackIntervalBoosts.map((boost) => boost.ratioBoost).reduce((prev, cur) => prev + cur, 0);
    this.combatDetails.combatStats.attackInterval /= 1 + attackIntervalRatioBoost;
    let baseArmor = 0.2 * this.combatDetails.defenseLevel + this.combatDetails.combatStats.armor;
    this.combatDetails.totalArmor = baseArmor;
    let armorBoosts = this.getBuffBoosts("/buff_types/armor");
    for (const boost of armorBoosts) {
      this.combatDetails.totalArmor += boost.flatBoost;
      this.combatDetails.totalArmor += baseArmor * boost.ratioBoost;
    }
    let baseWaterResistance = 0.2 * this.combatDetails.defenseLevel + this.combatDetails.combatStats.waterResistance;
    this.combatDetails.totalWaterResistance = baseWaterResistance;
    let waterResistanceBoosts = this.getBuffBoosts("/buff_types/water_resistance");
    for (const boost of waterResistanceBoosts) {
      this.combatDetails.totalWaterResistance += boost.flatBoost;
      this.combatDetails.totalWaterResistance += baseWaterResistance * boost.ratioBoost;
    }
    let baseNatureResistance = 0.2 * this.combatDetails.defenseLevel + this.combatDetails.combatStats.natureResistance;
    this.combatDetails.totalNatureResistance = baseNatureResistance;
    let natureResistanceBoosts = this.getBuffBoosts("/buff_types/nature_resistance");
    for (const boost of natureResistanceBoosts) {
      this.combatDetails.totalNatureResistance += boost.flatBoost;
      this.combatDetails.totalNatureResistance += baseNatureResistance * boost.ratioBoost;
    }
    let baseFireResistance = 0.2 * this.combatDetails.defenseLevel + this.combatDetails.combatStats.fireResistance;
    this.combatDetails.totalFireResistance = baseFireResistance;
    let fireResistanceBoosts = this.getBuffBoosts("/buff_types/fire_resistance");
    for (const boost of fireResistanceBoosts) {
      this.combatDetails.totalFireResistance += boost.flatBoost;
      this.combatDetails.totalFireResistance += baseFireResistance * boost.ratioBoost;
    }
    let hpRegenBoosts = this.getBuffBoost("/buff_types/hp_regen");
    this.combatDetails.combatStats.hpRegenPer10 += this.combatDetails.combatStats.hpRegenPer10 * hpRegenBoosts.ratioBoost;
    this.combatDetails.combatStats.hpRegenPer10 += hpRegenBoosts.flatBoost;
    let mpRegenBoosts = this.getBuffBoost("/buff_types/mp_regen");
    this.combatDetails.combatStats.mpRegenPer10 += this.combatDetails.combatStats.mpRegenPer10 * mpRegenBoosts.ratioBoost;
    this.combatDetails.combatStats.mpRegenPer10 += mpRegenBoosts.flatBoost;
    this.combatDetails.combatStats.lifeSteal += this.getBuffBoost("/buff_types/life_steal").flatBoost;
    this.combatDetails.combatStats.physicalThorns += this.getBuffBoost(
      "/buff_types/physical_thorns"
    ).flatBoost;
    this.combatDetails.combatStats.elementalThorns += this.getBuffBoost(
      "/buff_types/elemental_thorns"
    ).flatBoost;
    this.combatDetails.combatStats.combatExperience += this.getBuffBoost("/buff_types/wisdom").flatBoost;
    this.combatDetails.combatStats.criticalRate += this.getBuffBoost("/buff_types/critical_rate").flatBoost;
    this.combatDetails.combatStats.criticalDamage += this.getBuffBoost("/buff_types/critical_damage").flatBoost;
    this.combatDetails.combatStats.castSpeed += this.getBuffBoost("/buff_types/cast_speed").flatBoost;
    this.combatDetails.combatStats.castSpeed += this.combatDetails["attackLevel"] / 2e3;
    let combatDropRateBoosts = this.getBuffBoost("/buff_types/combat_drop_rate");
    this.combatDetails.combatStats.combatDropRate += (1 + this.combatDetails.combatStats.combatDropRate) * combatDropRateBoosts.ratioBoost;
    this.combatDetails.combatStats.combatDropRate += combatDropRateBoosts.flatBoost;
    let combatRareFindBoosts = this.getBuffBoost("/buff_types/rare_find");
    this.combatDetails.combatStats.combatRareFind += (1 + this.combatDetails.combatStats.combatRareFind) * combatRareFindBoosts.ratioBoost;
    this.combatDetails.combatStats.combatRareFind += combatRareFindBoosts.flatBoost;
    let combatDropQuantityBoosts = this.getBuffBoost("/buff_types/combat_drop_quantity");
    this.combatDetails.combatStats.combatDropQuantity += (1 + this.combatDetails.combatStats.combatDropQuantity) * combatDropQuantityBoosts.ratioBoost;
    this.combatDetails.combatStats.combatDropQuantity += combatDropQuantityBoosts.flatBoost;
    let baseThreat = 100 + this.combatDetails.combatStats.threat;
    this.combatDetails.totalThreat = baseThreat;
    let threatBoosts = this.getBuffBoost("/buff_types/threat");
    if (threatBoosts.ratioBoost !== 0) {
      this.combatDetails.combatStats.threat += baseThreat * threatBoosts.ratioBoost;
    } else {
      this.combatDetails.combatStats.threat = baseThreat;
    }
    this.combatDetails.combatStats.threat += threatBoosts.flatBoost;
    this.combatDetails.combatStats.retaliation += this.getBuffBoost("/buff_types/retaliation").flatBoost;
    this.combatDetails.combatStats.tenacity += this.getBuffBoost("/buff_types/tenacity").flatBoost;
  }
  addBuffs(buffs, currentTime) {
    buffs.forEach((buff) => buff.startTime = currentTime);
    let needUpdate = false;
    for (const buff of buffs) {
      if (!this.combatBuffs[buff.uniqueHrid] || this.combatBuffs[buff.uniqueHrid].ratioBoost != buff.ratioBoost || this.combatBuffs[buff.uniqueHrid].flatBoost != buff.flatBoost) {
        needUpdate = true;
      }
      this.combatBuffs[buff.uniqueHrid] = buff;
    }
    if (needUpdate) {
      this.updateCombatDetails();
    }
  }
  addBuff(buff, currentTime) {
    buff.startTime = currentTime;
    let needUpdate = true;
    if (this.combatBuffs[buff.uniqueHrid] && this.combatBuffs[buff.uniqueHrid].ratioBoost === buff.ratioBoost && this.combatBuffs[buff.uniqueHrid].flatBoost === buff.flatBoost) {
      needUpdate = false;
    }
    this.combatBuffs[buff.uniqueHrid] = buff;
    if (needUpdate) {
      this.updateCombatDetails();
    }
  }
  removeBuffs(buffs) {
    let needUpdate = false;
    buffs.forEach((buff) => {
      if (!this.combatBuffs[buff.uniqueHrid]) {
        return;
      }
      delete this.combatBuffs[buff.uniqueHrid];
      needUpdate = true;
    });
    if (needUpdate) {
      this.updateCombatDetails();
    }
  }
  removeBuff(buff) {
    if (!this.combatBuffs[buff.uniqueHrid]) {
      return;
    }
    delete this.combatBuffs[buff.uniqueHrid];
    this.updateCombatDetails();
  }
  addPermanentBuff(buff) {
    if (this.permanentBuffs[buff.typeHrid]) {
      this.permanentBuffs[buff.typeHrid].flatBoost += buff.flatBoost;
      this.permanentBuffs[buff.typeHrid].ratioBoost += buff.ratioBoost;
    } else {
      this.permanentBuffs[buff.typeHrid] = {
        uniqueHrid: buff.uniqueHrid,
        typeHrid: buff.typeHrid,
        flatBoost: buff.flatBoost,
        ratioBoost: buff.ratioBoost,
        duration: buff.duration
      };
    }
  }
  generatePermanentBuffs() {
    for (let i = 0; i < this.houseRooms.length; i++) {
      const houseRoom = this.houseRooms[i];
      houseRoom.buffs.forEach((buff) => {
        this.addPermanentBuff(buff);
      });
    }
    if (this.achievements) {
      this.achievements.buffs.forEach((buff) => {
        this.addPermanentBuff(buff);
      });
    }
    if (this.zoneBuffs) {
      this.zoneBuffs.forEach((buff) => {
        this.addPermanentBuff(buff);
      });
    }
    if (this.extraBuffs) {
      this.extraBuffs.forEach((buff) => {
        this.addPermanentBuff(buff);
      });
    }
  }
  removeExpiredBuffs(currentTime) {
    let expiredBuffs = Object.values(this.combatBuffs).filter(
      (buff) => buff.startTime + buff.duration <= currentTime
    );
    expiredBuffs.forEach((buff) => {
      delete this.combatBuffs[buff.uniqueHrid];
    });
    this.updateCombatDetails();
  }
  clearBuffs() {
    this.combatBuffs = structuredClone(this.permanentBuffs);
    this.updateCombatDetails();
  }
  clearCCs() {
    this.isStunned = false;
    this.stunExpireTime = null;
    this.isSilenced = false;
    this.silenceExpireTime = null;
    this.isBlinded = false;
    this.blindExpireTime = null;
    this.combatDetails.combatStats.damageTaken = 0;
  }
  getBuffBoosts(type) {
    let boosts = [];
    Object.values(this.combatBuffs).filter((buff) => buff.typeHrid == type).forEach((buff) => {
      boosts.push({ ratioBoost: buff.ratioBoost, flatBoost: buff.flatBoost });
    });
    return boosts;
  }
  getBuffBoost(type) {
    let boosts = this.getBuffBoosts(type);
    let boost = {
      ratioBoost: 0,
      flatBoost: 0
    };
    for (let i = 0; i < boosts.length; i++) {
      boost.ratioBoost += boosts[i]?.ratioBoost ?? 0;
      boost.flatBoost += boosts[i]?.flatBoost ?? 0;
    }
    return boost;
  }
  reset(currentTime = 0) {
    this.clearCCs();
    if (currentTime == 0 || !this.isPlayer) {
      this.clearBuffs();
      this.resetCooldowns(currentTime);
    } else {
      this.removeExpiredBuffs(currentTime);
    }
    this.combatDetails.currentHitpoints = this.combatDetails.maxHitpoints;
    this.combatDetails.currentManapoints = this.combatDetails.maxManapoints;
  }
  resetCooldowns(currentTime = 0) {
    this.food.filter((food) => food != null).forEach((food) => food.lastUsed = Number.MIN_SAFE_INTEGER);
    this.drinks.filter((drink) => drink != null).forEach((drink) => drink.lastUsed = Number.MIN_SAFE_INTEGER);
    let haste = this.combatDetails.combatStats.abilityHaste;
    this.abilities.filter((ability) => ability != null).forEach((ability) => {
      if (this.isPlayer) {
        ability.lastUsed = Number.MIN_SAFE_INTEGER;
      } else {
        let cooldownDuration = ability.cooldownDuration;
        if (haste > 0) {
          cooldownDuration = cooldownDuration * 100 / (100 + haste);
        }
        ability.lastUsed = currentTime - Math.floor(cooldownDuration * 0.5) + Math.floor(Math.random() * cooldownDuration * 0.5);
      }
    });
  }
  addHitpoints(hitpoints) {
    let hitpointsAdded = 0;
    if (this.combatDetails.currentHitpoints >= this.combatDetails.maxHitpoints) {
      return hitpointsAdded;
    }
    let newHitpoints = Math.min(this.combatDetails.currentHitpoints + hitpoints, this.combatDetails.maxHitpoints);
    hitpointsAdded = newHitpoints - this.combatDetails.currentHitpoints;
    this.combatDetails.currentHitpoints = newHitpoints;
    return hitpointsAdded;
  }
  addManapoints(manapoints) {
    let manapointsAdded = 0;
    if (this.combatDetails.currentManapoints >= this.combatDetails.maxManapoints) {
      return manapointsAdded;
    }
    let newManapoints = Math.min(
      this.combatDetails.currentManapoints + manapoints,
      this.combatDetails.maxManapoints
    );
    manapointsAdded = newManapoints - this.combatDetails.currentManapoints;
    this.combatDetails.currentManapoints = newManapoints;
    return manapointsAdded;
  }
};
var combatUnit_default = CombatUnit;

// game-data:combatMonsterDetailMap
init_data_shim();
var combatMonsterDetailMap_default = slot("combatMonsterDetailMap");

// engine/drops.js
var Drops = class {
  constructor(itemHrid, dropRate, minCount, maxCount, difficultyTier) {
    this.itemHrid = itemHrid;
    this.dropRate = dropRate;
    this.minCount = minCount;
    this.maxCount = maxCount;
    this.difficultyTier = difficultyTier;
  }
};
var drops_default = Drops;

// engine/monster.js
var Monster = class extends combatUnit_default {
  difficultyTier = 0;
  LabyrinthMonsterBaseRoomLevel = 100;
  //Base stats are designed for room level 100, and scale proportionally    
  roomLevel = 0;
  constructor(hrid, difficultyTier = 0, roomLevel = 0) {
    super();
    this.isPlayer = false;
    this.hrid = hrid;
    this.difficultyTier = difficultyTier;
    this.roomLevel = roomLevel;
    if (this.roomLevel <= 0) {
      this.roomLevel = this.LabyrinthMonsterBaseRoomLevel;
    }
    let gameMonster = combatMonsterDetailMap_default[this.hrid];
    if (!gameMonster) {
      throw new Error("No monster found for hrid: " + this.hrid);
    }
    this.enrageTime = gameMonster.enrageTime;
    let labyrinthScaleFactor = this.roomLevel / this.LabyrinthMonsterBaseRoomLevel;
    for (let i = 0; i < gameMonster.abilities.length; i++) {
      if (gameMonster.abilities[i].minDifficultyTier > this.difficultyTier) {
        continue;
      }
      this.abilities[i] = new ability_default(gameMonster.abilities[i].abilityHrid, Math.floor(gameMonster.abilities[i].level * labyrinthScaleFactor));
    }
    if (gameMonster.dropTable)
      for (let i = 0; i < gameMonster.dropTable.length; i++) {
        this.dropTable[i] = new drops_default(gameMonster.dropTable[i].itemHrid, gameMonster.dropTable[i].dropRate, gameMonster.dropTable[i].minCount, gameMonster.dropTable[i].maxCount, gameMonster.dropTable[i].difficultyTier);
      }
    for (let i = 0; i < gameMonster.rareDropTable.length; i++) {
      let dropTableItem = gameMonster.dropTable && i < gameMonster.dropTable.length ? gameMonster.dropTable[i] : null;
      let difficultyTier2 = dropTableItem?.difficultyTier ?? gameMonster.rareDropTable[i].minDifficultyTier;
      this.rareDropTable[i] = new drops_default(gameMonster.rareDropTable[i].itemHrid, gameMonster.rareDropTable[i].dropRate, gameMonster.rareDropTable[i].minCount, difficultyTier2);
    }
  }
  updateCombatDetails() {
    let gameMonster = combatMonsterDetailMap_default[this.hrid];
    let levelMultiplier = 1 + 0.25 * this.difficultyTier;
    let defLevelMultiplier = 1 + 0.15 * this.difficultyTier;
    let levelBonus = 20 * this.difficultyTier;
    let labyrinthScaleFactor = this.roomLevel / this.LabyrinthMonsterBaseRoomLevel;
    this.staminaLevel = levelMultiplier * (gameMonster.combatDetails.staminaLevel + levelBonus) * labyrinthScaleFactor;
    this.intelligenceLevel = levelMultiplier * (gameMonster.combatDetails.intelligenceLevel + levelBonus) * labyrinthScaleFactor;
    this.attackLevel = levelMultiplier * (gameMonster.combatDetails.attackLevel + levelBonus) * labyrinthScaleFactor;
    this.meleeLevel = levelMultiplier * (gameMonster.combatDetails.meleeLevel + levelBonus) * labyrinthScaleFactor;
    this.defenseLevel = defLevelMultiplier * (gameMonster.combatDetails.defenseLevel + levelBonus) * labyrinthScaleFactor;
    this.rangedLevel = levelMultiplier * (gameMonster.combatDetails.rangedLevel + levelBonus) * labyrinthScaleFactor;
    this.magicLevel = levelMultiplier * (gameMonster.combatDetails.magicLevel + levelBonus) * labyrinthScaleFactor;
    let expMultiplier = 1 + 0.5 * this.difficultyTier;
    let expBonus = 5 * this.difficultyTier;
    this.experience = expMultiplier * (gameMonster.experience + expBonus);
    this.combatDetails.combatStats.combatStyleHrid = gameMonster.combatDetails.combatStats.combatStyleHrids[0];
    for (const [key, value] of Object.entries(gameMonster.combatDetails.combatStats)) {
      this.combatDetails.combatStats[key] = value;
    }
    this.combatDetails.combatStats.armor *= labyrinthScaleFactor;
    this.combatDetails.combatStats.waterResistance *= labyrinthScaleFactor;
    this.combatDetails.combatStats.natureResistance *= labyrinthScaleFactor;
    this.combatDetails.combatStats.fireResistance *= labyrinthScaleFactor;
    [
      "stabAccuracy",
      "slashAccuracy",
      "smashAccuracy",
      "rangedAccuracy",
      "magicAccuracy",
      "stabDamage",
      "slashDamage",
      "smashDamage",
      "rangedDamage",
      "magicDamage",
      "defensiveDamage",
      "taskDamage",
      "physicalAmplify",
      "waterAmplify",
      "natureAmplify",
      "fireAmplify",
      "healingAmplify",
      "stabEvasion",
      "slashEvasion",
      "smashEvasion",
      "rangedEvasion",
      "magicEvasion",
      "armor",
      "waterResistance",
      "natureResistance",
      "fireResistance",
      "maxHitpoints",
      "maxManapoints",
      "lifeSteal",
      "hpRegenPer10",
      "mpRegenPer10",
      "physicalThorns",
      "elementalThorns",
      "combatDropRate",
      "combatRareFind",
      "combatDropQuantity",
      "combatExperience",
      "criticalRate",
      "criticalDamage",
      "armorPenetration",
      "waterPenetration",
      "naturePenetration",
      "firePenetration",
      "abilityHaste",
      "tenacity",
      "manaLeech",
      "castSpeed",
      "threat",
      "parry",
      "mayhem",
      "pierce",
      "curse",
      "fury",
      "weaken",
      "ripple",
      "bloom",
      "blaze",
      "attackSpeed",
      "foodHaste",
      "drinkConcentration",
      "autoAttackDamage",
      "abilityDamage",
      "retaliation"
    ].forEach((stat) => {
      if (gameMonster.combatDetails.combatStats[stat] == null) {
        this.combatDetails.combatStats[stat] = 0;
      }
    });
    if (this.combatDetails.combatStats.attackInterval == 0) {
      this.combatDetails.combatStats.attackInterval = gameMonster.combatDetails.attackInterval;
    }
    super.updateCombatDetails();
  }
};
var monster_default = Monster;

// engine/combatSimulator.js
var ONE_SECOND = 1e9;
var HOT_TICK_INTERVAL = 5 * ONE_SECOND;
var DOT_TICK_INTERVAL = 3 * ONE_SECOND;
var REGEN_TICK_INTERVAL = 10 * ONE_SECOND;
var ENEMY_RESPAWN_INTERVAL = 3 * ONE_SECOND;
var PLAYER_RESPAWN_INTERVAL = 150 * ONE_SECOND;
var RESTART_INTERVAL = 3 * ONE_SECOND;
var ENRAGE_TICK_INTERVAL = 60 * ONE_SECOND;
var CombatSimulator = class extends EventTarget {
  constructor(players, zone, labyrinth, options = {}) {
    super();
    this.players = players;
    this.zone = zone;
    this.labyrinth = labyrinth;
    this.eventQueue = new eventQueue_default();
    this.simResult = new simResult_default(zone, labyrinth, players.length);
    this.allPlayersDead = false;
    this.enableHpMpVisualization = options.enableHpMpVisualization || false;
    this.wipeLogs = {
      buffer: new Array(200),
      index: 0,
      count: 0,
      maxSize: 200
    };
  }
  addToWipeLogs(logEntry) {
    const { buffer, maxSize } = this.wipeLogs;
    buffer[this.wipeLogs.index] = logEntry;
    this.wipeLogs.index = (this.wipeLogs.index + 1) % maxSize;
    this.wipeLogs.count = Math.min(this.wipeLogs.count + 1, maxSize);
  }
  logAndResetWipeLogs() {
    const logs = this.getOrderedWipeLogs();
    logs.forEach((log) => {
      if (log.error) {
        console.log(log.error);
        return;
      }
      const time = (log.time / 1e9).toFixed(2);
    });
    this.wipeLogs.index = 0;
    this.wipeLogs.count = 0;
  }
  buildCombatLog(source, ability, target, damageDone) {
    try {
      const sourceHrid = source?.hrid || "UNKNOWN_SOURCE";
      const targetHrid = target?.hrid || "UNKNOWN_TARGET";
      const afterHp = target?.combatDetails?.currentHitpoints || 0;
      const beforeHp = Math.max(0, afterHp + damageDone);
      const playersHp = this.players.map((p) => ({
        hrid: p.hrid || "UNKNOWN_PLAYER",
        current: p.combatDetails?.currentHitpoints ?? 0,
        max: p.combatDetails?.maxHitpoints ?? 0
      }));
      return {
        time: this.simulationTime,
        wave: this.zone.encountersKilled - 1,
        source: sourceHrid,
        ability,
        target: targetHrid,
        damage: damageDone,
        beforeHp,
        afterHp,
        playersHp,
        // enemiesHp: enemiesHp,
        isCrit: false
      };
    } catch (e) {
      return {
        error: `[\u65E5\u5FD7\u751F\u6210\u9519\u8BEF] ${e.message}`
      };
    }
  }
  generateCombatLog(source, ability, target, attackResult) {
    try {
      const sourceHrid = source?.hrid || "UNKNOWN_SOURCE";
      const targetHrid = target?.hrid || "UNKNOWN_TARGET";
      const damage = attackResult?.damageDone || 0;
      const afterHp = target?.combatDetails?.currentHitpoints || 0;
      const beforeHp = Math.max(0, afterHp + damage);
      const playersHp = this.players.map((p) => ({
        hrid: p.hrid || "UNKNOWN_PLAYER",
        current: p.combatDetails?.currentHitpoints ?? 0,
        max: p.combatDetails?.maxHitpoints ?? 0
      }));
      return {
        time: this.simulationTime,
        wave: this.zone.encountersKilled - 1,
        source: sourceHrid,
        ability,
        target: targetHrid,
        damage,
        beforeHp,
        afterHp,
        playersHp,
        // enemiesHp: enemiesHp,
        isCrit: attackResult?.isCrit || false
      };
    } catch (e) {
      return {
        error: `[\u65E5\u5FD7\u751F\u6210\u9519\u8BEF] ${e.message}`
      };
    }
  }
  getOrderedWipeLogs() {
    const { buffer, maxSize, count } = this.wipeLogs;
    const logs = [];
    for (let i = 0; i < count; i++) {
      const idx = (this.wipeLogs.index - count + maxSize + i) % maxSize;
      logs.push(buffer[idx]);
    }
    return logs;
  }
  saveWipeLogsToSimResult(wave) {
    const logs = this.getOrderedWipeLogs();
    this.simResult.addWipeEvent(logs, this.simulationTime, wave);
  }
  async simulate(simulationTimeLimit) {
    this.reset();
    let ticks = 0;
    let combatStartEvent = new combatStartEvent_default(0);
    this.eventQueue.addEvent(combatStartEvent);
    while (this.simulationTime < simulationTimeLimit) {
      let nextEvent = this.eventQueue.getNextEvent();
      await this.processEvent(nextEvent);
      ticks++;
      if (ticks == 1e3) {
        ticks = 0;
        if (this.enableHpMpVisualization) {
          this.simResult.addTimeSeriesSnapshot(this.simulationTime, this.players);
        }
        let progressEvent = new CustomEvent("progress", {
          detail: {
            zone: this.zone?.hrid,
            difficultyTier: this.zone?.difficultyTier,
            labyrinth: this.labyrinth?.hrid,
            roomLevel: this.labyrinth?.roomLevel,
            progress: Math.min(this.simulationTime / simulationTimeLimit, 1),
            timeSeriesData: this.enableHpMpVisualization ? this.simResult.timeSeriesData : null
          }
        });
        this.dispatchEvent(progressEvent);
      }
    }
    this.simResult.isDungeon = this.zone?.isDungeon ?? false;
    if (this.zone && this.simResult.isDungeon) {
      console.log("Timeout now at wave #" + (this.zone.encountersKilled - 1));
      this.simResult.dungeonsCompleted = this.zone.dungeonsCompleted;
      this.simResult.dungeonsFailed = this.zone.dungeonsFailed;
      if (this.simResult.dungeonsCompleted < 1) {
        this.simResult.maxWaveReached = 0;
        for (let i = 1; i <= this.zone.dungeonSpawnInfo.maxWaves; i++) {
          let waveName = "#" + i.toString();
          const idx = this.simResult.timeSpentAlive.findIndex((e) => e.name === waveName);
          if (idx == -1 || this.simResult.timeSpentAlive[idx].count == 0) {
            break;
          }
          this.simResult.maxWaveReached = i;
        }
      } else {
        this.simResult.maxWaveReached = this.zone.dungeonSpawnInfo.maxWaves;
      }
    }
    this.simResult.simulatedTime = this.simulationTime;
    for (let i = 0; i < this.players.length; i++) {
      this.simResult.setDropRateMultipliers(this.players[i]);
      this.simResult.setManaUsed(this.players[i]);
    }
    if (this.zone?.isDungeon) {
      Object.entries(this.zone.dungeonSpawnInfo.fixedSpawnsMap).forEach(([wave, monsters]) => {
        let waveName = "#" + wave.toString();
        monsters.forEach((monster) => {
          waveName += "," + monster.combatMonsterHrid;
        });
        this.simResult.bossSpawns.push(waveName);
      });
    }
    if (this.zone?.isDungeon && this.zone.monsterSpawnInfo.bossSpawns) {
      for (const boss of this.zone.monsterSpawnInfo.bossSpawns) {
        this.simResult.bossSpawns.push(boss.combatMonsterHrid);
      }
    }
    if (this.labyrinth) {
      this.simResult.labyAttemptCount = this.labyrinth.attemptCount;
    }
    return this.simResult;
  }
  reset() {
    this.tempDungeonCount = 0;
    this.simulationTime = 0;
    this.eventQueue.clear();
    this.simResult = new simResult_default(this.zone, this.labyrinth, this.players.length);
  }
  async processEvent(event) {
    this.simulationTime = event.time;
    switch (event.type) {
      case combatStartEvent_default.type:
        this.processCombatStartEvent(event);
        break;
      case playerRespawnEvent_default.type:
        this.processPlayerRespawnEvent(event);
        break;
      case enemyRespawnEvent_default.type:
        this.processEnemyRespawnEvent(event);
        break;
      case autoAttackEvent_default.type:
        this.processAutoAttackEvent(event);
        break;
      case consumableTickEvent_default.type:
        this.processConsumableTickEvent(event);
        break;
      case damageOverTimeEvent_default.type:
        this.processDamageOverTimeTickEvent(event);
        break;
      case checkBuffExpirationEvent_default.type:
        this.processCheckBuffExpirationEvent(event);
        break;
      case regenTickEvent_default.type:
        this.processRegenTickEvent(event);
        break;
      case stunExpirationEvent_default.type:
        this.processStunExpirationEvent(event);
        break;
      case blindExpirationEvent_default.type:
        this.processBlindExpirationEvent(event);
        break;
      case silenceExpirationEvent_default.type:
        this.processSilenceExpirationEvent(event);
        break;
      case curseExpirationEvent_default.type:
        this.processCurseExpirationEvent(event);
        break;
      case weakenExpirationEvent_default.type:
        this.processWeakenExpirationEvent(event);
        break;
      case furyExpirationEvent_default.type:
        this.processFuryExpirationEvent(event);
        break;
      case enrageTickEvent_default.type:
        this.processEnrageTickEvent(event);
        break;
      case abilityCastEndEvent_default.type:
        this.tryUseAbility(event.source, event.ability);
        break;
      case awaitCooldownEvent_default.type:
        this.addNextAttackEvent(event.source);
        break;
      case cooldownReadyEvent_default.type:
        break;
    }
    this.checkTriggers();
  }
  processCombatStartEvent(event) {
    for (let i = 0; i < this.players.length; i++) {
      if (event.time == 0) {
        this.players[i].generatePermanentBuffs();
      }
      if (this.labyrinth) {
        this.players[i].reset();
      } else {
        this.players[i].reset(this.simulationTime);
      }
    }
    let regenTickEvent = new regenTickEvent_default(this.simulationTime + REGEN_TICK_INTERVAL);
    this.eventQueue.addEvent(regenTickEvent);
    this.startNewEncounter();
  }
  processPlayerRespawnEvent(event) {
    let respawningPlayer = this.players.find((player) => player.hrid === event.hrid);
    respawningPlayer.combatDetails.currentHitpoints = respawningPlayer.combatDetails.maxHitpoints;
    respawningPlayer.combatDetails.currentManapoints = respawningPlayer.combatDetails.maxManapoints;
    respawningPlayer.clearBuffs();
    respawningPlayer.clearCCs();
    if (this.allPlayersDead) {
      this.allPlayersDead = false;
      this.startAttacks();
    } else {
      this.addNextAttackEvent(respawningPlayer);
    }
  }
  processEnemyRespawnEvent(event) {
    this.startNewEncounter();
  }
  startNewEncounter() {
    if (this.allPlayersDead) {
      this.allPlayersDead = false;
      if (this.zone) {
        this.zone.failWave();
      }
    }
    if (this.zone) {
      if (!this.zone.isDungeon) {
        this.enemies = this.zone.getRandomEncounter();
      } else {
        this.enemies = this.zone.getNextWave();
        this.simResult.updateTimeSpentAlive("#" + (this.zone.encountersKilled - 1).toString(), true, this.simulationTime);
        let currentDungeonCount = this.zone.dungeonsCompleted;
        if (currentDungeonCount > this.tempDungeonCount) {
          this.tempDungeonCount = currentDungeonCount;
          for (let i = 0; i < this.players.length; i++) {
            this.players[i].combatDetails.currentHitpoints = this.players[i].combatDetails.maxHitpoints;
            this.players[i].combatDetails.currentManapoints = this.players[i].combatDetails.maxManapoints;
          }
        }
      }
    }
    if (this.labyrinth) {
      this.enemies = this.labyrinth.getMonster();
      this.labyrinth.updateEnconterStartTime(this.simulationTime);
    }
    this.enemies.forEach((enemy) => {
      enemy.reset(this.simulationTime);
      this.simResult.updateTimeSpentAlive(enemy.hrid, true, this.simulationTime);
    });
    this.eventQueue.clearEventsOfType(enrageTickEvent_default.type);
    let enrageTickEvent = new enrageTickEvent_default(this.simulationTime + ENRAGE_TICK_INTERVAL, ENRAGE_TICK_INTERVAL);
    this.eventQueue.addEvent(enrageTickEvent);
    this.enrageBeginTime = this.simulationTime;
    this.eventQueue.clearEventsOfType(abilityCastEndEvent_default.type);
    this.checkTriggers();
    this.startAttacks();
  }
  startAttacks() {
    let units = [...this.players];
    if (this.enemies) {
      units.push(...this.enemies);
    }
    for (const unit of units) {
      if (unit.combatDetails.currentHitpoints <= 0) {
        continue;
      }
      this.addNextAttackEvent(unit);
    }
  }
  checkParry(targets) {
    let parryUnits = targets.filter((unit) => unit && unit.combatDetails.currentHitpoints > 0 && unit.combatDetails.combatStats.parry > 0);
    if (parryUnits.length <= 0) {
      return void 0;
    }
    let randomIndex = Math.floor(Math.random() * parryUnits.length);
    if (parryUnits[randomIndex].combatDetails.combatStats.parry > Math.random()) {
      return parryUnits[randomIndex];
    }
    return void 0;
  }
  processAutoAttackEvent(event) {
    let targets = event.source.isPlayer ? this.enemies : this.players;
    if (!targets) {
      return;
    }
    const aliveTargets = targets.filter((unit) => unit && unit.combatDetails.currentHitpoints > 0);
    for (let i = 0; i < aliveTargets.length; i++) {
      let target = aliveTargets[i];
      if (!event.source.isPlayer && aliveTargets.length > 1) {
        let cumulativeThreat = 0;
        let cumulativeRanges = [];
        aliveTargets.forEach((player) => {
          let playerThreat = player.combatDetails.combatStats.threat;
          cumulativeThreat += playerThreat;
          cumulativeRanges.push({
            player,
            rangeStart: cumulativeThreat - playerThreat,
            rangeEnd: cumulativeThreat
          });
        });
        let randomValueHit = Math.random() * cumulativeThreat;
        target = cumulativeRanges.find((range) => randomValueHit >= range.rangeStart && randomValueHit < range.rangeEnd).player;
      }
      let source = event.source;
      let parryTarget = this.checkParry(targets);
      if (parryTarget) {
        target = source;
        source = parryTarget;
      }
      let attackResult = combatUtilities_default.processAttack(source, target);
      if (this.zone?.isDungeon && target.isPlayer && attackResult.didHit && attackResult.damageDone > 0) {
        const log = this.generateCombatLog(source, "autoAttack", target, attackResult);
        this.addToWipeLogs(log);
      }
      let mayhem = source.combatDetails.combatStats.mayhem > Math.random();
      if (attackResult.didHit && source.combatDetails.combatStats.curse > 0) {
        const curseExpireTime = 15e9;
        let currentCurseEvent = this.eventQueue.getMatching((event2) => event2.type == curseExpirationEvent_default.type && event2.source == target);
        let currentCurseAmount = 0;
        if (currentCurseEvent) currentCurseAmount = currentCurseEvent.curseAmount;
        this.eventQueue.clearMatching((event2) => event2.type == curseExpirationEvent_default.type && event2.source == target);
        let curseExpirationEvent = new curseExpirationEvent_default(this.simulationTime + curseExpireTime, currentCurseAmount, target);
        const curseBuff = {
          "uniqueHrid": "/buff_uniques/curse",
          "typeHrid": "/buff_types/damage_taken",
          "ratioBoost": 0,
          "ratioBoostLevelBonus": 0,
          "flatBoost": source.combatDetails.combatStats.curse * curseExpirationEvent.curseAmount,
          "flatBoostLevelBonus": 0,
          "startTime": "0001-01-01T00:00:00Z",
          "duration": curseExpireTime
        };
        target.addBuff(curseBuff, this.simulationTime);
        this.eventQueue.addEvent(curseExpirationEvent);
      }
      if (source.combatDetails.combatStats.fury > 0) {
        let currentFuryEvent = this.eventQueue.getMatching((event2) => event2.type == furyExpirationEvent_default.type && event2.source == source);
        this.eventQueue.clearMatching((event2) => event2.type == furyExpirationEvent_default.type && event2.source == source);
        const furyExpireTime = 15e9;
        const maxFuryStack = 5;
        let furyAmount = 0;
        if (currentFuryEvent) furyAmount = currentFuryEvent.furyAmount;
        if (attackResult.didHit) {
          furyAmount = Math.min(furyAmount + 1, maxFuryStack);
        } else {
          furyAmount = furyAmount / 2;
        }
        const furyAccuracyBuf = {
          "uniqueHrid": "/buff_uniques/fury_accuracy",
          "typeHrid": "/buff_types/fury_accuracy",
          "ratioBoost": furyAmount * source.combatDetails.combatStats.fury,
          "ratioBoostLevelBonus": 0,
          "flatBoost": 0,
          "flatBoostLevelBonus": 0,
          "startTime": "0001-01-01T00:00:00Z",
          "duration": furyExpireTime
        };
        const furyDamageBuf = {
          "uniqueHrid": "/buff_uniques/fury_damage",
          "typeHrid": "/buff_types/fury_damage",
          "ratioBoost": furyAmount * source.combatDetails.combatStats.fury,
          "ratioBoostLevelBonus": 0,
          "flatBoost": 0,
          "flatBoostLevelBonus": 0,
          "startTime": "0001-01-01T00:00:00Z",
          "duration": furyExpireTime
        };
        if (furyAmount > 0) {
          let furyExpirationEvent = new furyExpirationEvent_default(this.simulationTime + furyExpireTime, furyAmount, source);
          this.eventQueue.addEvent(furyExpirationEvent);
          source.addBuffs([furyAccuracyBuf, furyDamageBuf], this.simulationTime);
        } else {
          source.removeBuffs([furyAccuracyBuf, furyDamageBuf]);
        }
      }
      if (target.combatDetails.combatStats.weaken > 0) {
        const weakenExpireTime = 15e9;
        let currentWeakenEvent = this.eventQueue.getMatching((event2) => event2.type == weakenExpirationEvent_default.type && event2.source == source);
        let weakenAmount = 0;
        if (currentWeakenEvent)
          weakenAmount = currentWeakenEvent.weakenAmount;
        this.eventQueue.clearMatching((event2) => event2.type == weakenExpirationEvent_default.type && event2.source == source);
        let weakenExpirationEvent = new weakenExpirationEvent_default(this.simulationTime + 15e9, weakenAmount, source);
        const weakenBuff = {
          "uniqueHrid": "/buff_uniques/weaken",
          "typeHrid": "/buff_types/damage",
          "ratioBoost": -1 * target.combatDetails.combatStats.weaken * weakenExpirationEvent.weakenAmount,
          "ratioBoostLevelBonus": 0,
          "flatBoost": 0,
          "flatBoostLevelBonus": 0,
          "startTime": "0001-01-01T00:00:00Z",
          "duration": weakenExpireTime
        };
        source.addBuff(weakenBuff, this.simulationTime);
        this.eventQueue.addEvent(weakenExpirationEvent);
      }
      if (!mayhem || mayhem && attackResult.didHit || mayhem && i == aliveTargets.length - 1) {
        let attackType = "autoAttack";
        if (parryTarget) attackType = "parry";
        this.simResult.addAttack(
          source,
          target,
          attackType,
          attackResult.didHit ? attackResult.damageDone : "miss"
        );
      }
      if (attackResult.lifeStealHeal > 0) {
        this.simResult.addHitpointsGained(source, "lifesteal", attackResult.lifeStealHeal);
      }
      if (attackResult.manaLeechMana > 0) {
        this.simResult.addManapointsGained(source, "manaLeech", attackResult.manaLeechMana);
      }
      if (attackResult.thornDamageDone > 0) {
        this.simResult.addAttack(target, source, attackResult.thornType, attackResult.thornDamageDone);
      }
      if (this.zone?.isDungeon && attackResult.thornDamageDone > 0 && source.isPlayer) {
        const log = this.buildCombatLog(target, attackResult.thornType, source, attackResult.thornDamageDone);
        this.addToWipeLogs(log);
      }
      if (target.combatDetails.combatStats.retaliation > 0) {
        this.simResult.addAttack(target, source, "retaliation", attackResult.retaliationDamageDone > 0 ? attackResult.retaliationDamageDone : "miss");
      }
      if (this.zone?.isDungeon && attackResult.retaliationDamageDone > 0 && source.isPlayer) {
        const log = this.buildCombatLog(target, "retaliation", source, attackResult.retaliationDamageDone);
        this.addToWipeLogs(log);
      }
      if (target.combatDetails.currentHitpoints == 0) {
        this.eventQueue.clearEventsForUnit(target);
        this.simResult.addDeath(target);
        if (!target.isPlayer) {
          this.simResult.updateTimeSpentAlive(target.hrid, false, this.simulationTime);
        }
      }
      if (source.combatDetails.currentHitpoints == 0 && (attackResult.thornDamageDone != 0 || attackResult.retaliationDamageDone != 0)) {
        this.eventQueue.clearEventsForUnit(source);
        this.simResult.addDeath(source);
        if (!source.isPlayer) {
          this.simResult.updateTimeSpentAlive(source.hrid, false, this.simulationTime);
        }
        break;
      }
      if (mayhem && !attackResult.didHit) {
        continue;
      }
      if (!attackResult.didHit || parryTarget || source.combatDetails.combatStats.pierce <= Math.random()) {
        break;
      }
    }
    if (!this.checkEncounterEnd()) {
      this.addNextAttackEvent(event.source);
    }
  }
  checkEncounterEnd() {
    if (this.enemies) {
      let deadEnemies = this.enemies.filter((enemy) => enemy.combatDetails.currentHitpoints <= 0 && enemy.experienceRate == 0);
      if (deadEnemies.length > 0) {
        deadEnemies.forEach((enemy) => {
          let aliveDuration = this.simulationTime - this.enrageBeginTime;
          if (aliveDuration > enemy.enrageTime) {
            aliveDuration = enemy.enrageTime;
          }
          enemy.experienceRate = 1 + aliveDuration / enemy.enrageTime;
        });
      }
    }
    let encounterEnded = false;
    if (this.enemies && !this.enemies.some((enemy) => enemy.combatDetails.currentHitpoints > 0)) {
      this.eventQueue.clearEventsOfType(autoAttackEvent_default.type);
      let enemyRespawnEvent = new enemyRespawnEvent_default(this.simulationTime + ENEMY_RESPAWN_INTERVAL);
      this.eventQueue.addEvent(enemyRespawnEvent);
      if (this.enemies.some((enemy) => enemy.experienceRate <= 0)) {
        console.log("WARN: Some enemies have no experience rate");
      }
      let totalExp = this.enemies.map((enemy) => enemy.experience * enemy.experienceRate).reduce((a, b) => a + b, 0);
      this.players.forEach((player) => {
        this.simResult.addExperienceGain(player, totalExp / this.players.length);
      });
      this.enemies = null;
      if (this.zone?.isDungeon) {
        this.simResult.updateTimeSpentAlive("#" + (this.zone.encountersKilled - 1).toString(), false, this.simulationTime);
        if (this.zone.encountersKilled > this.zone.dungeonSpawnInfo.maxWaves) {
          this.simResult.updateDungenonFinish("#1", this.simulationTime);
          this.simResult.lastDungeonFinishTime = this.simulationTime;
        }
      }
      this.simResult.addEncounterEnd();
      this.simResult.lastEncounterFinishTime = this.simulationTime;
      encounterEnded = true;
    }
    this.players.forEach((player) => {
      if (player.combatDetails.currentHitpoints <= 0 && !this.eventQueue.containsEventOfTypeAndHrid(playerRespawnEvent_default.type, player.hrid)) {
        if (this.zone && !this.zone.isDungeon) {
          let playerRespawnEvent = new playerRespawnEvent_default(this.simulationTime + PLAYER_RESPAWN_INTERVAL, player.hrid);
          this.eventQueue.addEvent(playerRespawnEvent);
        }
        this.simResult.addRanOutOfManaCount(player, false, this.simulationTime);
      }
    });
    if (!this.players.some((player) => player.combatDetails.currentHitpoints > 0)) {
      if (this.zone) {
        if (this.zone.isDungeon) {
          console.log("All Players died at wave #" + (this.zone.encountersKilled - 1) + " with ememies: " + this.enemies.map((enemy) => enemy.hrid + "(" + (enemy.combatDetails.currentHitpoints * 100 / enemy.combatDetails.maxHitpoints).toFixed(2) + "%)").join(", "));
          this.saveWipeLogsToSimResult(this.zone.encountersKilled - 1);
          this.wipeLogs.index = 0;
          this.wipeLogs.count = 0;
          this.eventQueue.clearEventsOfType(autoAttackEvent_default.type);
          this.eventQueue.clearEventsOfType(abilityCastEndEvent_default.type);
          this.eventQueue.clearEventsOfType(damageOverTimeEvent_default.type);
          this.eventQueue.clearEventsOfType(consumableTickEvent_default.type);
          this.eventQueue.clearEventsOfType(regenTickEvent_default.type);
          this.eventQueue.clearEventsOfType(enrageTickEvent_default.type);
          this.eventQueue.clearEventsOfType(stunExpirationEvent_default.type);
          this.eventQueue.clearEventsOfType(blindExpirationEvent_default.type);
          this.eventQueue.clearEventsOfType(silenceExpirationEvent_default.type);
          this.eventQueue.clearEventsOfType(awaitCooldownEvent_default.type);
          this.enemies = null;
          let combatStartEvent = new combatStartEvent_default(this.simulationTime + RESTART_INTERVAL);
          this.eventQueue.addEvent(combatStartEvent);
        } else {
          this.eventQueue.clearEventsOfType(autoAttackEvent_default.type);
          this.eventQueue.clearEventsOfType(abilityCastEndEvent_default.type);
        }
      }
      encounterEnded = true;
      this.allPlayersDead = true;
    }
    if (this.labyrinth && (this.labyrinth.checkTimeout(this.simulationTime) || encounterEnded)) {
      this.enemies = null;
      encounterEnded = true;
      this.eventQueue.clear();
      let combatStartEvent = new combatStartEvent_default(this.simulationTime);
      this.eventQueue.addEvent(combatStartEvent);
    }
    return encounterEnded;
  }
  addNextAttackEvent(source) {
    if (this.eventQueue.getMatching((event) => (event.type == abilityCastEndEvent_default.type || event.type == autoAttackEvent_default.type) && event.source == source)) {
      return;
    }
    let target;
    let friendlies;
    let enemies;
    if (source.isPlayer) {
      target = combatUtilities_default.getTarget(this.enemies);
      friendlies = this.players;
      enemies = this.enemies;
    } else {
      target = combatUtilities_default.getTarget(this.players);
      friendlies = this.enemies;
      enemies = this.players;
    }
    let usedAbility = false;
    let skipNextAbility = false;
    source.abilities.filter((ability) => ability != null).forEach((ability) => {
      if (!usedAbility && !skipNextAbility && ability.shouldTrigger(this.simulationTime, source, target, friendlies, enemies)) {
        if (!this.canUseAbility(source, ability, true)) {
          skipNextAbility = true;
        }
        if (!skipNextAbility) {
          let castDuration = ability.castDuration;
          castDuration /= 1 + source.combatDetails.combatStats.castSpeed;
          let abilityCastEndEvent = new abilityCastEndEvent_default(this.simulationTime + castDuration, source, ability);
          this.eventQueue.addEvent(abilityCastEndEvent);
          usedAbility = true;
        }
      }
    });
    if (usedAbility) {
      source.isOutOfMana = false;
      return;
    }
    if (!enemies) {
      return;
    }
    if (!source.isBlinded) {
      let autoAttackEvent = new autoAttackEvent_default(
        this.simulationTime + source.combatDetails.combatStats.attackInterval,
        source
      );
      this.eventQueue.addEvent(autoAttackEvent);
    } else {
      source.isOutOfMana = true;
    }
  }
  processConsumableTickEvent(event) {
    if (event.consumable.hitpointRestore > 0) {
      let tickValue = combatUtilities_default.calculateTickValue(
        event.consumable.hitpointRestore,
        event.totalTicks,
        event.currentTick
      );
      let hitpointsAdded = event.source.addHitpoints(tickValue);
      this.simResult.addHitpointsGained(event.source, event.consumable.hrid, hitpointsAdded);
    }
    if (event.consumable.manapointRestore > 0) {
      let tickValue = combatUtilities_default.calculateTickValue(
        event.consumable.manapointRestore,
        event.totalTicks,
        event.currentTick
      );
      let manapointsAdded = event.source.addManapoints(tickValue);
      this.simResult.addManapointsGained(event.source, event.consumable.hrid, manapointsAdded);
      if (event.source.isOutOfMana) {
        let awaitCooldownEvent = new awaitCooldownEvent_default(
          this.simulationTime,
          event.source
        );
        this.eventQueue.addEvent(awaitCooldownEvent);
      }
    }
    if (event.currentTick < event.totalTicks) {
      let consumableTickEvent = new consumableTickEvent_default(
        this.simulationTime + HOT_TICK_INTERVAL,
        event.source,
        event.consumable,
        event.totalTicks,
        event.currentTick + 1
      );
      this.eventQueue.addEvent(consumableTickEvent);
    }
  }
  processDamageOverTimeTickEvent(event) {
    let tickDamage = combatUtilities_default.calculateTickValue(event.damage, event.totalTicks, event.currentTick);
    let damage = Math.min(tickDamage, event.target.combatDetails.currentHitpoints);
    event.target.combatDetails.currentHitpoints -= damage;
    this.simResult.addAttack(event.sourceRef, event.target, "damageOverTime", damage);
    if (this.zone?.isDungeon && event.target.isPlayer) {
      const log = this.buildCombatLog("", "damageOverTime", event.target, damage);
      this.addToWipeLogs(log);
    }
    if (event.currentTick < event.totalTicks) {
      let damageOverTimeTickEvent = new damageOverTimeEvent_default(
        this.simulationTime + DOT_TICK_INTERVAL,
        event.sourceRef,
        event.target,
        event.damage,
        event.totalTicks,
        event.currentTick + 1,
        event.combatStyleHrid
      );
      this.eventQueue.addEvent(damageOverTimeTickEvent);
    }
    if (event.target.combatDetails.currentHitpoints == 0) {
      this.eventQueue.clearEventsForUnit(event.target);
      this.simResult.addDeath(event.target);
      if (!event.target.isPlayer) {
        this.simResult.updateTimeSpentAlive(event.target.hrid, false, this.simulationTime);
      }
    }
    this.checkEncounterEnd();
  }
  processRegenTickEvent(event) {
    let units = [...this.players];
    for (const unit of units) {
      if (unit.combatDetails.currentHitpoints <= 0) {
        continue;
      }
      let hitpointRegen = Math.floor(unit.combatDetails.maxHitpoints * unit.combatDetails.combatStats.hpRegenPer10);
      let hitpointsAdded = unit.addHitpoints(hitpointRegen);
      this.simResult.addHitpointsGained(unit, "regen", hitpointsAdded);
      let manapointRegen = Math.floor(unit.combatDetails.maxManapoints * unit.combatDetails.combatStats.mpRegenPer10);
      let manapointsAdded = unit.addManapoints(manapointRegen);
      this.simResult.addManapointsGained(unit, "regen", manapointsAdded);
      if (unit.isOutOfMana) {
        let awaitCooldownEvent = new awaitCooldownEvent_default(
          this.simulationTime,
          unit
        );
        this.eventQueue.addEvent(awaitCooldownEvent);
      }
    }
    let regenTickEvent = new regenTickEvent_default(this.simulationTime + REGEN_TICK_INTERVAL);
    this.eventQueue.addEvent(regenTickEvent);
  }
  processCheckBuffExpirationEvent(event) {
    event.source.removeExpiredBuffs(this.simulationTime);
  }
  processStunExpirationEvent(event) {
    event.source.isStunned = false;
    this.addNextAttackEvent(event.source);
  }
  processBlindExpirationEvent(event) {
    event.source.isBlinded = false;
    this.addNextAttackEvent(event.source);
  }
  processSilenceExpirationEvent(event) {
    event.source.isSilenced = false;
  }
  processCurseExpirationEvent(event) {
    event.source.removeExpiredBuffs(this.simulationTime);
  }
  processWeakenExpirationEvent(event) {
    event.source.removeExpiredBuffs(this.simulationTime);
  }
  processFuryExpirationEvent(event) {
    event.source.removeExpiredBuffs(this.simulationTime);
    console.log("Fury Timeout");
  }
  processEnrageTickEvent(event) {
    if (!this.enemies) return;
    const maxEnrageStack = 10;
    this.enemies.filter((enemy) => enemy.combatDetails.currentHitpoints > 0).forEach((enemy) => {
      let nowStack = Math.min(maxEnrageStack, Math.floor(event.encounterTime / enemy.enrageTime));
      if (nowStack <= 0) {
        return;
      }
      console.log(enemy.hrid, nowStack, " stack Enrage at ", event.encounterTime / ONE_SECOND);
      const enrageDamageBuff = {
        "uniqueHrid": "/buff_uniques/enrage_damage",
        "typeHrid": "/buff_types/damage",
        "ratioBoost": nowStack * 0.1,
        "ratioBoostLevelBonus": 0,
        "flatBoost": 0,
        "flatBoostLevelBonus": 0,
        "startTime": "0001-01-01T00:00:00Z",
        "duration": ENRAGE_TICK_INTERVAL
      };
      const enrageAccuracyBuff = {
        "uniqueHrid": "/buff_uniques/enrage_accuracy",
        "typeHrid": "/buff_types/accuracy",
        "ratioBoost": nowStack * 0.1,
        "ratioBoostLevelBonus": 0,
        "flatBoost": 0,
        "flatBoostLevelBonus": 0,
        "startTime": "0001-01-01T00:00:00Z",
        "duration": ENRAGE_TICK_INTERVAL
      };
      enemy.addBuffs([enrageDamageBuff, enrageAccuracyBuff]);
      this.simResult.maxEnrageStack = Math.max(this.simResult.maxEnrageStack, nowStack);
    });
    let enrageTickEvent = new enrageTickEvent_default(this.simulationTime + ENRAGE_TICK_INTERVAL, event.encounterTime + ENRAGE_TICK_INTERVAL);
    this.eventQueue.addEvent(enrageTickEvent);
  }
  checkTriggers() {
    let triggeredSomething;
    do {
      triggeredSomething = false;
      this.players.filter((player) => player.combatDetails.currentHitpoints > 0).forEach((player) => {
        if (this.checkTriggersForUnit(player, this.players, this.enemies)) {
          triggeredSomething = true;
        }
      });
      if (this.enemies) {
        this.enemies.filter((enemy) => enemy.combatDetails.currentHitpoints > 0).forEach((enemy) => {
          if (this.checkTriggersForUnit(enemy, this.enemies, this.players)) {
            triggeredSomething = true;
          }
        });
      }
    } while (triggeredSomething);
  }
  checkTriggersForUnit(unit, friendlies, enemies) {
    if (unit.combatDetails.currentHitpoints <= 0) {
      throw new Error("Checking triggers for a dead unit");
    }
    let triggeredSomething = false;
    let target = combatUtilities_default.getTarget(enemies);
    for (const food of unit.food) {
      if (food && food.shouldTrigger(this.simulationTime, unit, target, friendlies, enemies)) {
        let result = this.tryUseConsumable(unit, food);
        if (result) {
          triggeredSomething = true;
        }
      }
    }
    for (const drink of unit.drinks) {
      if (drink && drink.shouldTrigger(this.simulationTime, unit, target, friendlies, enemies)) {
        let result = this.tryUseConsumable(unit, drink);
        if (result) {
          triggeredSomething = true;
        }
      }
    }
    return triggeredSomething;
  }
  tryUseConsumable(source, consumable) {
    if (source.combatDetails.currentHitpoints <= 0) {
      return false;
    }
    consumable.lastUsed = this.simulationTime;
    let consumeCooldown = consumable.cooldownDuration;
    if (source.combatDetails.combatStats.drinkConcentration > 0 && consumable.catagoryHrid.includes("drink")) {
      consumeCooldown = consumeCooldown / (1 + source.combatDetails.combatStats.drinkConcentration);
    } else if (source.combatDetails.combatStats.foodHaste > 0 && consumable.catagoryHrid.includes("food")) {
      consumeCooldown = consumeCooldown / (1 + source.combatDetails.combatStats.foodHaste);
    }
    let cooldownReadyEvent = new cooldownReadyEvent_default(this.simulationTime + consumeCooldown);
    this.eventQueue.addEvent(cooldownReadyEvent);
    this.simResult.addConsumableUse(source, consumable);
    if (consumable.recoveryDuration == 0) {
      if (consumable.hitpointRestore > 0) {
        let hitpointsAdded = source.addHitpoints(consumable.hitpointRestore);
        this.simResult.addHitpointsGained(source, consumable.hrid, hitpointsAdded);
      }
      if (consumable.manapointRestore > 0) {
        let manapointsAdded = source.addManapoints(consumable.manapointRestore);
        this.simResult.addManapointsGained(source, consumable.hrid, manapointsAdded);
        if (source.isOutOfMana) {
          let awaitCooldownEvent = new awaitCooldownEvent_default(
            this.simulationTime,
            source
          );
          this.eventQueue.addEvent(awaitCooldownEvent);
        }
      }
    } else {
      let consumableTickEvent = new consumableTickEvent_default(
        this.simulationTime + HOT_TICK_INTERVAL,
        source,
        consumable,
        consumable.recoveryDuration / HOT_TICK_INTERVAL,
        1
      );
      this.eventQueue.addEvent(consumableTickEvent);
    }
    for (const buff of consumable.buffs) {
      let currentBuff = structuredClone(buff);
      if (source.combatDetails.combatStats.drinkConcentration > 0 && consumable.catagoryHrid.includes("drink")) {
        currentBuff.ratioBoost *= 1 + source.combatDetails.combatStats.drinkConcentration;
        currentBuff.flatBoost *= 1 + source.combatDetails.combatStats.drinkConcentration;
        currentBuff.duration = currentBuff.duration / (1 + source.combatDetails.combatStats.drinkConcentration);
      }
      source.addBuff(currentBuff, this.simulationTime);
      let checkBuffExpirationEvent = new checkBuffExpirationEvent_default(this.simulationTime + currentBuff.duration, source);
      this.eventQueue.addEvent(checkBuffExpirationEvent);
    }
    return true;
  }
  canUseAbility(source, ability, oomCheck) {
    if (source.combatDetails.currentHitpoints <= 0) {
      return false;
    }
    if (source.combatDetails.currentManapoints < ability.manaCost) {
      if (source.isPlayer && oomCheck) {
        this.simResult.addRanOutOfManaCount(source, true, this.simulationTime);
      }
      return false;
    }
    if (source.isPlayer && oomCheck) {
      this.simResult.addRanOutOfManaCount(source, false, this.simulationTime);
    }
    return true;
  }
  tryUseAbility(source, ability) {
    if (!this.canUseAbility(source, ability, true)) {
      return false;
    }
    if (source.isPlayer) {
      if (source.abilityManaCosts.has(ability.hrid)) {
        source.abilityManaCosts.set(ability.hrid, source.abilityManaCosts.get(ability.hrid) + ability.manaCost);
      } else {
        source.abilityManaCosts.set(ability.hrid, ability.manaCost);
      }
    }
    source.combatDetails.currentManapoints -= ability.manaCost;
    ability.lastUsed = this.simulationTime;
    let haste = source.combatDetails.combatStats.abilityHaste;
    let cooldownDuration = ability.cooldownDuration;
    if (haste > 0) {
      cooldownDuration = cooldownDuration * 100 / (100 + haste);
    }
    let todoAbilities = [ability];
    if (source.combatDetails.combatStats.blaze > 0 && Math.random() < source.combatDetails.combatStats.blaze) {
      todoAbilities.push(new ability_default("blaze"));
    }
    if (source.combatDetails.combatStats.bloom > 0 && Math.random() < source.combatDetails.combatStats.bloom) {
      todoAbilities.push(new ability_default("bloom"));
    }
    for (const todoAbility of todoAbilities) {
      for (const abilityEffect of todoAbility.abilityEffects) {
        switch (abilityEffect.effectType) {
          case "/ability_effect_types/buff":
            this.processAbilityBuffEffect(source, todoAbility, abilityEffect);
            break;
          case "/ability_effect_types/damage":
            this.processAbilityDamageEffect(source, todoAbility, abilityEffect);
            break;
          case "/ability_effect_types/heal":
            this.processAbilityHealEffect(source, todoAbility, abilityEffect);
            break;
          case "/ability_effect_types/spend_hp":
            this.processAbilitySpendHpEffect(source, todoAbility, abilityEffect);
            break;
          case "/ability_effect_types/revive":
            this.processAbilityReviveEffect(source, todoAbility, abilityEffect);
            break;
          case "/ability_effect_types/promote":
            this.eventQueue.clearEventsForUnit(source);
            source = this.processAbilityPromoteEffect(source, todoAbility, abilityEffect);
            this.addNextAttackEvent(source);
            break;
          default:
            throw new Error("Unsupported effect type for ability: " + todoAbility.hrid + " effectType: " + abilityEffect.effectType);
        }
      }
    }
    if (source.combatDetails.combatStats.ripple > 0 && Math.random() < source.combatDetails.combatStats.ripple) {
      let manapointsAdded = source.addManapoints(10);
      this.simResult.addManapointsGained(source, "ripple", manapointsAdded);
      for (const ability2 of source.abilities) {
        if (ability2 && ability2.lastUsed) {
          const remainingCooldown = ability2.lastUsed + ability2.cooldownDuration - this.simulationTime;
          if (remainingCooldown > 0) {
            ability2.lastUsed = Math.max(ability2.lastUsed - ONE_SECOND * 2, this.simulationTime - ability2.cooldownDuration);
          }
        }
      }
    }
    this.addNextAttackEvent(source);
    if (source.combatDetails.currentHitpoints == 0) {
      this.eventQueue.clearEventsForUnit(source);
      this.simResult.addDeath(source);
      if (!source.isPlayer) {
        this.simResult.updateTimeSpentAlive(source.hrid, false, this.simulationTime);
      }
    }
    this.checkEncounterEnd();
    return true;
  }
  processAbilityBuffEffect(source, ability, abilityEffect) {
    if (abilityEffect.targetType == "allAllies") {
      let targets = source.isPlayer ? this.players : this.enemies;
      for (const target of targets.filter((unit) => unit && unit.combatDetails.currentHitpoints > 0)) {
        for (const buff of abilityEffect.buffs) {
          if (ability.isSpecialAbility && buff.multiplierForSkillHrid && buff.multiplierPerSkillLevel > 0) {
            let multiplier = 1 + source.combatDetails[buff.multiplierForSkillHrid.split("/")[2] + "Level"] * buff.multiplierPerSkillLevel;
            let currentBuff = structuredClone(buff);
            currentBuff.flatBoost *= multiplier;
            currentBuff.ratioBoost *= multiplier;
            target.addBuff(currentBuff, this.simulationTime);
          } else {
            target.addBuff(buff, this.simulationTime);
          }
          let checkBuffExpirationEvent = new checkBuffExpirationEvent_default(this.simulationTime + buff.duration, target);
          this.eventQueue.addEvent(checkBuffExpirationEvent);
        }
      }
      return;
    }
    if (abilityEffect.targetType != "self") {
      throw new Error("Unsupported target type for buff ability effect: " + ability.hrid);
    }
    for (const buff of abilityEffect.buffs) {
      source.addBuff(buff, this.simulationTime);
      let checkBuffExpirationEvent = new checkBuffExpirationEvent_default(this.simulationTime + buff.duration, source);
      this.eventQueue.addEvent(checkBuffExpirationEvent);
    }
  }
  processAbilityDamageEffect(source, ability, abilityEffect) {
    let targets;
    switch (abilityEffect.targetType) {
      case "enemy":
      case "allEnemies":
        targets = source.isPlayer ? this.enemies : this.players;
        break;
      default:
        throw new Error("Unsupported target type for damage ability effect: " + ability.hrid);
    }
    if (!targets) {
      return;
    }
    let avoidTarget = [];
    let isSkipParry = false;
    for (let target of targets.filter((unit) => unit && unit.combatDetails.currentHitpoints > 0)) {
      let parryTarget = void 0;
      if (!isSkipParry) {
        parryTarget = this.checkParry(targets);
        isSkipParry = true;
      }
      if (parryTarget) {
        let tempTarget = source;
        let tempSource = parryTarget;
        let attackResult = combatUtilities_default.processAttack(tempSource, tempTarget);
        this.simResult.addAttack(
          tempSource,
          tempTarget,
          "parry",
          attackResult.didHit ? attackResult.damageDone : "miss"
        );
        if (attackResult.lifeStealHeal > 0) {
          this.simResult.addHitpointsGained(tempSource, "lifesteal", attackResult.lifeStealHeal);
        }
        if (attackResult.manaLeechMana > 0) {
          this.simResult.addManapointsGained(tempSource, "manaLeech", attackResult.manaLeechMana);
        }
        if (attackResult.thornDamageDone > 0) {
          this.simResult.addAttack(tempTarget, tempSource, attackResult.thornType, attackResult.thornDamageDone);
        }
        if (tempTarget.combatDetails.combatStats.retaliation > 0) {
          this.simResult.addAttack(tempTarget, tempSource, "retaliation", attackResult.retaliationDamageDone > 0 ? attackResult.retaliationDamageDone : "miss");
        }
        if (tempTarget.combatDetails.currentHitpoints == 0) {
          this.eventQueue.clearEventsForUnit(tempTarget);
          this.simResult.addDeath(tempTarget);
          if (!tempTarget.isPlayer) {
            this.simResult.updateTimeSpentAlive(tempTarget.hrid, false, this.simulationTime);
          }
        }
        if (tempSource.combatDetails.currentHitpoints == 0 && (attackResult.thornDamageDone != 0 || attackResult.retaliationDamageDone != 0)) {
          this.eventQueue.clearEventsForUnit(tempSource);
          this.simResult.addDeath(tempSource);
          if (!tempSource.isPlayer) {
            this.simResult.updateTimeSpentAlive(tempSource.hrid, false, this.simulationTime);
          }
        }
      } else {
        targets = targets.filter((unit) => unit && !avoidTarget.includes(unit.hrid) && unit.combatDetails.currentHitpoints > 0);
        if (!source.isPlayer && targets.length > 0 && abilityEffect.targetType == "enemy") {
          let cumulativeThreat = 0;
          let cumulativeRanges = [];
          targets.forEach((player) => {
            let playerThreat = player.combatDetails.combatStats.threat;
            cumulativeThreat += playerThreat;
            cumulativeRanges.push({
              player,
              rangeStart: cumulativeThreat - playerThreat,
              rangeEnd: cumulativeThreat
            });
          });
          let randomValueHit = Math.random() * cumulativeThreat;
          target = cumulativeRanges.find((range) => randomValueHit >= range.rangeStart && randomValueHit < range.rangeEnd).player;
          avoidTarget.push(target.hrid);
        }
        if (targets.length <= 0) {
          break;
        }
        let attackResult = combatUtilities_default.processAttack(source, target, abilityEffect);
        if (this.zone?.isDungeon && target.isPlayer && attackResult.didHit && attackResult.damageDone > 0) {
          const log = this.generateCombatLog(source, ability.hrid, target, attackResult);
          this.addToWipeLogs(log);
        }
        if (attackResult.hpDrain > 0) {
          this.simResult.addHitpointsGained(source, ability.hrid, attackResult.hpDrain);
        }
        if (attackResult.didHit && abilityEffect.buffs) {
          for (const buff of abilityEffect.buffs) {
            target.addBuff(buff, this.simulationTime);
            let checkBuffExpirationEvent = new checkBuffExpirationEvent_default(
              this.simulationTime + buff.duration,
              target
            );
            this.eventQueue.addEvent(checkBuffExpirationEvent);
          }
        }
        if (abilityEffect.damageOverTimeRatio > 0 && attackResult.damageDone > 0) {
          let damageOverTimeEvent = new damageOverTimeEvent_default(
            this.simulationTime + DOT_TICK_INTERVAL,
            source,
            target,
            attackResult.damageDone * abilityEffect.damageOverTimeRatio,
            abilityEffect.damageOverTimeDuration / DOT_TICK_INTERVAL,
            1,
            abilityEffect.combatStyleHrid
          );
          this.eventQueue.addEvent(damageOverTimeEvent);
        }
        if (attackResult.didHit && abilityEffect.stunChance > 0 && Math.random() < abilityEffect.stunChance * 100 / (100 + target.combatDetails.combatStats.tenacity)) {
          target.isStunned = true;
          target.stunExpireTime = this.simulationTime + abilityEffect.stunDuration;
          this.eventQueue.clearMatching((event) => (event.type == autoAttackEvent_default.type || event.type == abilityCastEndEvent_default.type || event.type == stunExpirationEvent_default.type) && event.source == target);
          let stunExpirationEvent = new stunExpirationEvent_default(target.stunExpireTime, target);
          this.eventQueue.addEvent(stunExpirationEvent);
        }
        if (attackResult.didHit && abilityEffect.blindChance > 0 && Math.random() < abilityEffect.blindChance * 100 / (100 + target.combatDetails.combatStats.tenacity)) {
          target.isBlinded = true;
          target.blindExpireTime = this.simulationTime + abilityEffect.blindDuration;
          this.eventQueue.clearMatching((event) => event.type == blindExpirationEvent_default.type && event.source == target);
          if (this.eventQueue.clearMatching((event) => event.type == autoAttackEvent_default.type && event.source == target)) {
            this.addNextAttackEvent(target);
          }
          let blindExpirationEvent = new blindExpirationEvent_default(target.blindExpireTime, target);
          this.eventQueue.addEvent(blindExpirationEvent);
        }
        if (attackResult.didHit && abilityEffect.silenceChance > 0 && Math.random() < abilityEffect.silenceChance * 100 / (100 + target.combatDetails.combatStats.tenacity)) {
          target.isSilenced = true;
          target.silenceExpireTime = this.simulationTime + abilityEffect.silenceDuration;
          this.eventQueue.clearMatching((event) => event.type == silenceExpirationEvent_default.type && event.source == target);
          if (this.eventQueue.clearMatching((event) => event.type == abilityCastEndEvent_default.type && event.source == target)) {
            this.addNextAttackEvent(target);
          }
          let silenceExpirationEvent = new silenceExpirationEvent_default(target.silenceExpireTime, target);
          this.eventQueue.addEvent(silenceExpirationEvent);
        }
        if (attackResult.didHit && source.combatDetails.combatStats.curse > 0) {
          const curseExpireTime = 15e9;
          let currentCurseEvent = this.eventQueue.getMatching((event) => event.type == curseExpirationEvent_default.type && event.source == target);
          let currentCurseAmount = 0;
          if (currentCurseEvent) currentCurseAmount = currentCurseEvent.curseAmount;
          this.eventQueue.clearMatching((event) => event.type == curseExpirationEvent_default.type && event.source == target);
          let curseExpirationEvent = new curseExpirationEvent_default(this.simulationTime + curseExpireTime, currentCurseAmount, target);
          const curseBuff = {
            "uniqueHrid": "/buff_uniques/curse",
            "typeHrid": "/buff_types/damage_taken",
            "ratioBoost": 0,
            "ratioBoostLevelBonus": 0,
            "flatBoost": source.combatDetails.combatStats.curse * curseExpirationEvent.curseAmount,
            "flatBoostLevelBonus": 0,
            "startTime": "0001-01-01T00:00:00Z",
            "duration": curseExpireTime
          };
          target.addBuff(curseBuff, this.simulationTime);
          this.eventQueue.addEvent(curseExpirationEvent);
        }
        if (source.combatDetails.combatStats.fury > 0) {
          let currentFuryEvent = this.eventQueue.getMatching((event) => event.type == furyExpirationEvent_default.type && event.source == source);
          this.eventQueue.clearMatching((event) => event.type == furyExpirationEvent_default.type && event.source == source);
          const furyExpireTime = 15e9;
          const maxFuryStack = 5;
          let furyAmount = 0;
          if (currentFuryEvent) furyAmount = currentFuryEvent.furyAmount;
          if (attackResult.didHit) {
            furyAmount = Math.min(furyAmount + 1, maxFuryStack);
          } else {
            furyAmount = furyAmount / 2;
          }
          const furyAccuracyBuf = {
            "uniqueHrid": "/buff_uniques/fury_accuracy",
            "typeHrid": "/buff_types/fury_accuracy",
            "ratioBoost": furyAmount * source.combatDetails.combatStats.fury,
            "ratioBoostLevelBonus": 0,
            "flatBoost": 0,
            "flatBoostLevelBonus": 0,
            "startTime": "0001-01-01T00:00:00Z",
            "duration": furyExpireTime
          };
          const furyDamageBuf = {
            "uniqueHrid": "/buff_uniques/fury_damage",
            "typeHrid": "/buff_types/fury_damage",
            "ratioBoost": furyAmount * source.combatDetails.combatStats.fury,
            "ratioBoostLevelBonus": 0,
            "flatBoost": 0,
            "flatBoostLevelBonus": 0,
            "startTime": "0001-01-01T00:00:00Z",
            "duration": furyExpireTime
          };
          if (furyAmount > 0) {
            let furyExpirationEvent = new furyExpirationEvent_default(this.simulationTime + furyExpireTime, furyAmount, source);
            this.eventQueue.addEvent(furyExpirationEvent);
            source.addBuffs([furyAccuracyBuf, furyDamageBuf], this.simulationTime);
          } else {
            source.removeBuffs([furyAccuracyBuf, furyDamageBuf]);
          }
        }
        if (target.combatDetails.combatStats.weaken > 0) {
          const weakenExpireTime = 15e9;
          source.weakenExpireTime = this.simulationTime + weakenExpireTime;
          let currentWeakenEvent = this.eventQueue.getMatching((event) => event.type == weakenExpirationEvent_default.type && event.source == source);
          let weakenAmount = 0;
          if (currentWeakenEvent)
            weakenAmount = currentWeakenEvent.weakenAmount;
          this.eventQueue.clearMatching((event) => event.type == weakenExpirationEvent_default.type && event.source == source);
          let weakenExpirationEvent = new weakenExpirationEvent_default(this.simulationTime + weakenExpireTime, weakenAmount, source);
          const weakenBuff = {
            "uniqueHrid": "/buff_uniques/weaken",
            "typeHrid": "/buff_types/damage",
            "ratioBoost": -1 * target.combatDetails.combatStats.weaken * weakenExpirationEvent.weakenAmount,
            "ratioBoostLevelBonus": 0,
            "flatBoost": 0,
            "flatBoostLevelBonus": 0,
            "startTime": "0001-01-01T00:00:00Z",
            "duration": weakenExpireTime
          };
          source.addBuff(weakenBuff, this.simulationTime);
          this.eventQueue.addEvent(weakenExpirationEvent);
        }
        this.simResult.addAttack(
          source,
          target,
          ability.hrid,
          attackResult.didHit ? attackResult.damageDone : "miss"
        );
        if (attackResult.thornDamageDone > 0) {
          this.simResult.addAttack(target, source, attackResult.thornType, attackResult.thornDamageDone);
        }
        if (this.zone?.isDungeon && attackResult.thornDamageDone > 0 && source.isPlayer) {
          const log = this.buildCombatLog(target, attackResult.thornType, source, attackResult.thornDamageDone);
          this.addToWipeLogs(log);
        }
        if (target.combatDetails.combatStats.retaliation > 0) {
          this.simResult.addAttack(target, source, "retaliation", attackResult.retaliationDamageDone > 0 ? attackResult.retaliationDamageDone : "miss");
        }
        if (this.zone?.isDungeon && attackResult.retaliationDamageDone > 0 && source.isPlayer) {
          const log = this.buildCombatLog(target, "retaliation", source, attackResult.retaliationDamageDone);
          this.addToWipeLogs(log);
        }
        if (target.combatDetails.currentHitpoints == 0) {
          this.eventQueue.clearEventsForUnit(target);
          this.simResult.addDeath(target);
          if (!target.isPlayer) {
            this.simResult.updateTimeSpentAlive(target.hrid, false, this.simulationTime);
          }
        }
        if (attackResult.didHit && abilityEffect.pierceChance > Math.random()) {
          continue;
        }
      }
      if (parryTarget) {
        break;
      }
      if (abilityEffect.targetType == "enemy") {
        break;
      }
    }
  }
  processAbilityHealEffect(source, ability, abilityEffect) {
    if (abilityEffect.targetType == "allAllies") {
      let targets = source.isPlayer ? this.players : this.enemies;
      for (const target of targets.filter((unit) => unit && unit.combatDetails.currentHitpoints > 0)) {
        let amountHealed2 = combatUtilities_default.processHeal(source, abilityEffect, target);
        this.simResult.addHitpointsGained(target, ability.hrid, amountHealed2);
      }
      return;
    }
    if (abilityEffect.targetType == "lowestHpAlly") {
      let targets = source.isPlayer ? this.players : this.enemies;
      let healTarget;
      for (const target of targets.filter((unit) => unit && unit.combatDetails.currentHitpoints > 0)) {
        if (!healTarget) {
          healTarget = target;
          continue;
        }
        const targetHpPercent = target.combatDetails.currentHitpoints / target.combatDetails.maxHitpoints;
        const healTargetHpPercent = healTarget.combatDetails.currentHitpoints / healTarget.combatDetails.maxHitpoints;
        if (targetHpPercent < healTargetHpPercent) {
          healTarget = target;
        }
      }
      if (healTarget) {
        let amountHealed2 = combatUtilities_default.processHeal(source, abilityEffect, healTarget);
        this.simResult.addHitpointsGained(healTarget, ability.hrid, amountHealed2);
      }
      return;
    }
    if (abilityEffect.targetType != "self") {
      throw new Error("Unsupported target type for heal ability effect: " + ability.hrid);
    }
    let amountHealed = combatUtilities_default.processHeal(source, abilityEffect, source);
    this.simResult.addHitpointsGained(source, ability.hrid, amountHealed);
  }
  processAbilityReviveEffect(source, ability, abilityEffect) {
    if (abilityEffect.targetType != "deadAlly") {
      throw new Error("Unsupported target type for revive ability effect: " + ability.hrid);
    }
    let targets = source.isPlayer ? this.players : this.enemies;
    let reviveTarget = targets.find((unit) => unit && unit.combatDetails.currentHitpoints <= 0);
    if (reviveTarget) {
      this.eventQueue.clearMatching((event) => event.type == playerRespawnEvent_default.type && event.hrid == reviveTarget.hrid);
      reviveTarget.removeExpiredBuffs(this.simulationTime);
      let amountHealed = combatUtilities_default.processRevive(source, abilityEffect, reviveTarget);
      this.simResult.addHitpointsGained(reviveTarget, ability.hrid, amountHealed);
      this.addNextAttackEvent(reviveTarget);
      if (!source.isPlayer) {
        this.simResult.updateTimeSpentAlive(reviveTarget.hrid, true, this.simulationTime);
      }
    }
    return;
  }
  processAbilityPromoteEffect(source, ability, abilityEffect) {
    const promotionHrids = ["/monsters/enchanted_rook", "/monsters/enchanted_knight", "/monsters/enchanted_bishop"];
    let randomPromotionIndex = Math.floor(Math.random() * promotionHrids.length);
    return new monster_default(promotionHrids[randomPromotionIndex], source.difficultyTier);
  }
  processAbilitySpendHpEffect(source, ability, abilityEffect) {
    if (abilityEffect.targetType != "self") {
      throw new Error("Unsupported target type for spend hp ability effect: " + ability.hrid);
    }
    let hpSpent = combatUtilities_default.processSpendHp(source, abilityEffect);
    this.simResult.addHitpointsSpent(source, ability.hrid, hpSpent);
  }
};
var combatSimulator_default = CombatSimulator;

// game-data:itemDetailMap
init_data_shim();
var itemDetailMap_default = slot("itemDetailMap");

// engine/consumable.js
var Consumable = class _Consumable {
  constructor(hrid, triggers = null) {
    this.hrid = hrid;
    let gameConsumable = itemDetailMap_default[this.hrid];
    if (!gameConsumable) {
      throw new Error("No consumable found for hrid: " + this.hrid);
    }
    this.cooldownDuration = gameConsumable.consumableDetail.cooldownDuration;
    this.hitpointRestore = gameConsumable.consumableDetail.hitpointRestore;
    this.manapointRestore = gameConsumable.consumableDetail.manapointRestore;
    this.recoveryDuration = gameConsumable.consumableDetail.recoveryDuration;
    this.catagoryHrid = gameConsumable.categoryHrid;
    this.buffs = [];
    if (gameConsumable.consumableDetail.buffs) {
      for (const consumableBuff of gameConsumable.consumableDetail.buffs) {
        let buff = new buff_default(consumableBuff);
        this.buffs.push(buff);
      }
    }
    if (triggers) {
      this.triggers = triggers;
    } else {
      this.triggers = [];
      for (const defaultTrigger of gameConsumable.consumableDetail.defaultCombatTriggers) {
        let trigger = new trigger_default(
          defaultTrigger.dependencyHrid,
          defaultTrigger.conditionHrid,
          defaultTrigger.comparatorHrid,
          defaultTrigger.value
        );
        this.triggers.push(trigger);
      }
    }
    this.lastUsed = Number.MIN_SAFE_INTEGER;
  }
  static createFromDTO(dto) {
    let triggers = dto.triggers.map((trigger) => trigger_default.createFromDTO(trigger));
    let consumable = new _Consumable(dto.hrid, triggers);
    return consumable;
  }
  shouldTrigger(currentTime, source, target, friendlies, enemies) {
    if (source.isStunned) {
      return false;
    }
    let consumableHaste;
    if (this.catagoryHrid.includes("food")) {
      consumableHaste = source.combatDetails.combatStats.foodHaste;
    } else {
      consumableHaste = source.combatDetails.combatStats.drinkConcentration;
    }
    let cooldownDuration = this.cooldownDuration;
    if (consumableHaste > 0) {
      cooldownDuration = cooldownDuration / (1 + consumableHaste);
    }
    if (this.lastUsed + cooldownDuration > currentTime) {
      return false;
    }
    if (this.triggers.length == 0) {
      return true;
    }
    let shouldTrigger = true;
    for (const trigger of this.triggers) {
      if (!trigger.isActive(source, target, friendlies, enemies, currentTime)) {
        shouldTrigger = false;
      }
    }
    return shouldTrigger;
  }
};
var consumable_default = Consumable;

// game-data:enhancementLevelTotalBonusMultiplierTable
init_data_shim();
var enhancementLevelTotalBonusMultiplierTable_default = slot("enhancementLevelTotalBonusMultiplierTable");

// engine/equipment.js
var Equipment = class _Equipment {
  constructor(hrid, enhancementLevel) {
    this.hrid = hrid;
    let gameItem = itemDetailMap_default[this.hrid];
    if (!gameItem) {
      throw new Error("No equipment found for hrid: " + this.hrid);
    }
    this.gameItem = gameItem;
    this.enhancementLevel = enhancementLevel;
  }
  static createFromDTO(dto) {
    let equipment = new _Equipment(dto.hrid, dto.enhancementLevel);
    return equipment;
  }
  getCombatStat(combatStat) {
    let multiplier = enhancementLevelTotalBonusMultiplierTable_default[this.enhancementLevel];
    if (this.gameItem.equipmentDetail.combatStats[combatStat]) {
      let enhancementBonus = this.gameItem.equipmentDetail.combatEnhancementBonuses[combatStat] || 0;
      let stat = this.gameItem.equipmentDetail.combatStats[combatStat] + multiplier * enhancementBonus;
      return stat;
    }
    return 0;
  }
  getCombatStyle() {
    return this.gameItem.equipmentDetail.combatStats.combatStyleHrids[0];
  }
  getDamageType() {
    return this.gameItem.equipmentDetail.combatStats.damageType;
  }
  getPrimaryTraining() {
    return this.gameItem.equipmentDetail.combatStats.primaryTraining;
  }
  getFocusTraining() {
    return this.gameItem.equipmentDetail.combatStats.focusTraining;
  }
};
var equipment_default = Equipment;

// game-data:houseRoomDetailMap
init_data_shim();
var houseRoomDetailMap_default = slot("houseRoomDetailMap");

// engine/houseRoom.js
var HouseRoom = class {
  constructor(hrid, level) {
    this.hrid = hrid;
    this.level = level;
    let gameHouseRoom = houseRoomDetailMap_default[this.hrid];
    if (!gameHouseRoom) {
      throw new Error("No house room found for hrid: " + this.hrid);
    }
    this.buffs = [];
    if (gameHouseRoom.actionBuffs) {
      for (const actionBuff of gameHouseRoom.actionBuffs) {
        let buff = new buff_default(actionBuff, level);
        this.buffs.push(buff);
      }
    }
    if (gameHouseRoom.globalBuffs) {
      for (const globalBuff of gameHouseRoom.globalBuffs) {
        let buff = new buff_default(globalBuff, level);
        this.buffs.push(buff);
      }
    }
  }
};
var houseRoom_default = HouseRoom;

// game-data:achievementTierDetailMap
init_data_shim();
var achievementTierDetailMap_default = slot("achievementTierDetailMap");

// game-data:achievementDetailMap
init_data_shim();
var achievementDetailMap_default = slot("achievementDetailMap");

// engine/achievement.js
var Achievement = class {
  constructor(achievements) {
    this.achievements = achievements;
    this.buffs = [];
    for (const tier of Object.values(achievementTierDetailMap_default)) {
      let isGetAll = true;
      let detailMap = Object.values(achievementDetailMap_default).filter((detail) => detail.tierHrid == tier.hrid);
      for (const achievement of Object.values(detailMap)) {
        if (!this.achievements[achievement.hrid] || this.achievements[achievement.hrid] == false) {
          isGetAll = false;
          break;
        }
      }
      if (isGetAll) {
        let buff = new buff_default(tier.buff);
        this.buffs.push(buff);
      }
    }
  }
};
var achievement_default = Achievement;

// engine/player.js
var Player = class _Player extends combatUnit_default {
  equipment = {
    "/equipment_types/head": null,
    "/equipment_types/body": null,
    "/equipment_types/legs": null,
    "/equipment_types/feet": null,
    "/equipment_types/hands": null,
    "/equipment_types/main_hand": null,
    "/equipment_types/two_hand": null,
    "/equipment_types/off_hand": null,
    "/equipment_types/pouch": null,
    "/equipment_types/back": null
  };
  constructor() {
    super();
    this.isPlayer = true;
    this.hrid = "player";
  }
  static createFromDTO(dto) {
    let player = new _Player();
    player.staminaLevel = dto.staminaLevel;
    player.intelligenceLevel = dto.intelligenceLevel;
    player.attackLevel = dto.attackLevel;
    player.meleeLevel = dto.meleeLevel;
    player.defenseLevel = dto.defenseLevel;
    player.rangedLevel = dto.rangedLevel;
    player.magicLevel = dto.magicLevel;
    player.hrid = dto.hrid;
    for (const [key, value] of Object.entries(dto.equipment)) {
      player.equipment[key] = value ? equipment_default.createFromDTO(value) : null;
    }
    player.food = dto.food.map((food) => food ? consumable_default.createFromDTO(food) : null);
    player.drinks = dto.drinks.map((drink) => drink ? consumable_default.createFromDTO(drink) : null);
    player.abilities = dto.abilities.map((ability) => ability ? ability_default.createFromDTO(ability) : null);
    Object.entries(dto.houseRooms).forEach((houseRoom) => {
      if (houseRoom[1] > 0) {
        player.houseRooms.push(new houseRoom_default(houseRoom[0], houseRoom[1]));
      }
    });
    player.achievements = new achievement_default(dto.achievements);
    player.debuffOnLevelGap = dto.debuffOnLevelGap;
    return player;
  }
  updateCombatDetails() {
    if (this.equipment["/equipment_types/main_hand"]) {
      this.combatDetails.combatStats.combatStyleHrid = this.equipment["/equipment_types/main_hand"].getCombatStyle();
      this.combatDetails.combatStats.damageType = this.equipment["/equipment_types/main_hand"].getDamageType();
      this.combatDetails.combatStats.attackInterval = this.equipment["/equipment_types/main_hand"].getCombatStat("attackInterval");
      this.combatDetails.combatStats.primaryTraining = this.equipment["/equipment_types/main_hand"].getPrimaryTraining();
    } else if (this.equipment["/equipment_types/two_hand"]) {
      this.combatDetails.combatStats.combatStyleHrid = this.equipment["/equipment_types/two_hand"].getCombatStyle();
      this.combatDetails.combatStats.damageType = this.equipment["/equipment_types/two_hand"].getDamageType();
      this.combatDetails.combatStats.attackInterval = this.equipment["/equipment_types/two_hand"].getCombatStat("attackInterval");
      this.combatDetails.combatStats.primaryTraining = this.equipment["/equipment_types/two_hand"].getPrimaryTraining();
    } else {
      this.combatDetails.combatStats.combatStyleHrid = "/combat_styles/smash";
      this.combatDetails.combatStats.damageType = "/damage_types/physical";
      this.combatDetails.combatStats.attackInterval = 3e9;
      this.combatDetails.combatStats.primaryTraining = "/skills/melee";
    }
    if (this.equipment["/equipment_types/charm"]) {
      this.combatDetails.combatStats.focusTraining = this.equipment["/equipment_types/charm"].getFocusTraining();
    } else {
      this.combatDetails.combatStats.focusTraining = "";
    }
    [
      "stabAccuracy",
      "slashAccuracy",
      "smashAccuracy",
      "rangedAccuracy",
      "magicAccuracy",
      "stabDamage",
      "slashDamage",
      "smashDamage",
      "rangedDamage",
      "magicDamage",
      "defensiveDamage",
      "taskDamage",
      "physicalAmplify",
      "waterAmplify",
      "natureAmplify",
      "fireAmplify",
      "healingAmplify",
      "stabEvasion",
      "slashEvasion",
      "smashEvasion",
      "rangedEvasion",
      "magicEvasion",
      "armor",
      "waterResistance",
      "natureResistance",
      "fireResistance",
      "maxHitpoints",
      "maxManapoints",
      "lifeSteal",
      "hpRegenPer10",
      "mpRegenPer10",
      "physicalThorns",
      "elementalThorns",
      "combatDropRate",
      "combatRareFind",
      "combatDropQuantity",
      "combatExperience",
      "criticalRate",
      "criticalDamage",
      "armorPenetration",
      "waterPenetration",
      "naturePenetration",
      "firePenetration",
      "abilityHaste",
      "tenacity",
      "manaLeech",
      "castSpeed",
      "threat",
      "parry",
      "mayhem",
      "pierce",
      "curse",
      "fury",
      "weaken",
      "ripple",
      "bloom",
      "blaze",
      "attackSpeed",
      "foodHaste",
      "drinkConcentration",
      "autoAttackDamage",
      "abilityDamage",
      "staminaExperience",
      "intelligenceExperience",
      "attackExperience",
      "defenseExperience",
      "meleeExperience",
      "rangedExperience",
      "magicExperience",
      "retaliation"
    ].forEach((stat) => {
      this.combatDetails.combatStats[stat] = Object.values(this.equipment).filter((equipment) => equipment != null).map((equipment) => equipment.getCombatStat(stat)).reduce((prev, cur) => prev + cur, 0);
    });
    if (this.equipment["/equipment_types/pouch"]) {
      this.combatDetails.combatStats.foodSlots = 1 + this.equipment["/equipment_types/pouch"].getCombatStat("foodSlots");
      this.combatDetails.combatStats.drinkSlots = 1 + this.equipment["/equipment_types/pouch"].getCombatStat("drinkSlots");
    } else {
      this.combatDetails.combatStats.foodSlots = 1;
      this.combatDetails.combatStats.drinkSlots = 1;
    }
    super.updateCombatDetails();
  }
};
var player_default = Player;

// game-data:actionDetailMap
init_data_shim();
var actionDetailMap_default = slot("actionDetailMap");

// engine/zone.js
var Zone = class {
  constructor(hrid, difficultyTier) {
    this.hrid = hrid;
    this.difficultyTier = difficultyTier;
    let gameZone = actionDetailMap_default[this.hrid];
    this.monsterSpawnInfo = gameZone.combatZoneInfo.fightInfo;
    this.dungeonSpawnInfo = gameZone.combatZoneInfo.dungeonInfo;
    this.encountersKilled = 1;
    this.monsterSpawnInfo.battlesPerBoss = 10;
    this.buffs = gameZone.buffs;
    this.isDungeon = gameZone.combatZoneInfo.isDungeon;
    this.dungeonsCompleted = 0;
    this.dungeonsFailed = 0;
    this.finalWave = false;
  }
  getRandomEncounter() {
    if (this.monsterSpawnInfo.bossSpawns && this.encountersKilled == this.monsterSpawnInfo.battlesPerBoss) {
      this.encountersKilled = 1;
      return this.monsterSpawnInfo.bossSpawns.map((monster) => new monster_default(monster.combatMonsterHrid, monster.difficultyTier + this.difficultyTier));
    }
    let totalWeight = this.monsterSpawnInfo.randomSpawnInfo.spawns.reduce((prev, cur) => prev + cur.rate, 0);
    let encounterHrids = [];
    let totalStrength = 0;
    outer: for (let i = 0; i < this.monsterSpawnInfo.randomSpawnInfo.maxSpawnCount; i++) {
      let randomWeight = totalWeight * Math.random();
      let cumulativeWeight = 0;
      for (const spawn of this.monsterSpawnInfo.randomSpawnInfo.spawns) {
        cumulativeWeight += spawn.rate;
        if (randomWeight <= cumulativeWeight) {
          totalStrength += spawn.strength;
          if (totalStrength <= this.monsterSpawnInfo.randomSpawnInfo.maxTotalStrength) {
            encounterHrids.push({ "hrid": spawn.combatMonsterHrid, "difficultyTier": spawn.difficultyTier });
          } else {
            break outer;
          }
          break;
        }
      }
    }
    this.encountersKilled++;
    return encounterHrids.map((hrid) => new monster_default(hrid.hrid, hrid.difficultyTier + this.difficultyTier));
  }
  failWave() {
    this.dungeonsFailed++;
    this.encountersKilled = 1;
  }
  getNextWave() {
    if (this.encountersKilled > this.dungeonSpawnInfo.maxWaves) {
      this.dungeonsCompleted++;
      this.encountersKilled = 1;
    }
    if (this.dungeonSpawnInfo.fixedSpawnsMap.hasOwnProperty(this.encountersKilled.toString())) {
      let currentMonsters = this.dungeonSpawnInfo.fixedSpawnsMap[this.encountersKilled.toString()];
      this.encountersKilled++;
      return currentMonsters.map((monster) => new monster_default(monster.combatMonsterHrid, monster.difficultyTier + this.difficultyTier));
    } else {
      let monsterSpawns = {};
      const waveKeys = Object.keys(this.dungeonSpawnInfo.randomSpawnInfoMap).map(Number).sort((a, b) => a - b);
      if (this.encountersKilled > waveKeys[waveKeys.length - 1]) {
        monsterSpawns = this.dungeonSpawnInfo.randomSpawnInfoMap[waveKeys[waveKeys.length - 1]];
      } else {
        for (let i = 0; i < waveKeys.length - 1; i++) {
          if (this.encountersKilled >= waveKeys[i] && this.encountersKilled <= waveKeys[i + 1]) {
            monsterSpawns = this.dungeonSpawnInfo.randomSpawnInfoMap[waveKeys[i]];
            break;
          }
        }
      }
      let totalWeight = monsterSpawns.spawns.reduce((prev, cur) => prev + cur.rate, 0);
      let encounterHrids = [];
      let totalStrength = 0;
      outer: for (let i = 0; i < monsterSpawns.maxSpawnCount; i++) {
        let randomWeight = totalWeight * Math.random();
        let cumulativeWeight = 0;
        for (const spawn of monsterSpawns.spawns) {
          cumulativeWeight += spawn.rate;
          if (randomWeight <= cumulativeWeight) {
            totalStrength += spawn.strength;
            if (totalStrength <= monsterSpawns.maxTotalStrength) {
              encounterHrids.push({ "hrid": spawn.combatMonsterHrid, "difficultyTier": spawn.difficultyTier });
            } else {
              break outer;
            }
            break;
          }
        }
      }
      this.encountersKilled++;
      return encounterHrids.map((hrid) => new monster_default(hrid.hrid, hrid.difficultyTier + this.difficultyTier));
    }
  }
};
var zone_default = Zone;

// game-data:labyrinthCrateDetailMap
init_data_shim();
var labyrinthCrateDetailMap_default = slot("labyrinthCrateDetailMap");

// engine/labyrinth.js
var Labyrinth = class {
  constructor(monsterHrid, roomLevel, crates = []) {
    this.monsterHrid = monsterHrid;
    this.roomLevel = roomLevel;
    this.buffs = [];
    if (crates) {
      for (let crate of crates) {
        this.buffs = this.buffs.concat(labyrinthCrateDetailMap_default[crate]);
      }
    }
    this.attemptCount = 0;
  }
  getMonster() {
    this.attemptCount++;
    return [new monster_default(this.monsterHrid, 0, this.roomLevel)];
  }
  updateEnconterStartTime(enconterStartTime) {
    this.enconterStartTime = enconterStartTime;
  }
  checkTimeout(currentTime) {
    return currentTime - this.enconterStartTime > 120 * 1e9;
  }
};
var labyrinth_default = Labyrinth;

// src/sim-telemetry.js
var MAX_SAMPLES = 2e3;
var ctx = null;
function abilityStats(hrid) {
  const all = ctx.data.abilities;
  return all[hrid] ||= { casts: 0, blocked: 0, enemiesAtCast: {}, hits: 0, hitDamage: 0, kills: [], healed: 0, overheal: 0, heals: 0, healSamples: [] };
}
function consumableStats(hrid) {
  return ctx.data.consumables[hrid] ||= { uses: 0, restore: 0, wasted: 0 };
}
var alive = (units) => (units || []).filter((u) => u && u.combatDetails.currentHitpoints > 0).length;
var installed = false;
function install() {
  if (installed) return;
  installed = true;
  const sim = combatSimulator_default.prototype;
  const canUseAbility = sim.canUseAbility;
  sim.canUseAbility = function(source, ability, oomCheck) {
    const ok = canUseAbility.call(this, source, ability, oomCheck);
    if (ctx && !ok && oomCheck && source.isPlayer && source.combatDetails.currentHitpoints > 0 && source.combatDetails.currentManapoints < ability.manaCost) {
      abilityStats(ability.hrid).blocked++;
    }
    return ok;
  };
  const tryUseAbility = sim.tryUseAbility;
  sim.tryUseAbility = function(source, ability) {
    if (!ctx || !source.isPlayer) return tryUseAbility.call(this, source, ability);
    const before = source.combatDetails.currentManapoints;
    const up = alive(this.enemies);
    ctx.casting = ability.hrid;
    try {
      const cast = tryUseAbility.call(this, source, ability);
      if (cast || source.combatDetails.currentManapoints < before) {
        const s = abilityStats(ability.hrid);
        s.casts++;
        s.enemiesAtCast[up] = (s.enemiesAtCast[up] || 0) + 1;
      }
      return cast;
    } finally {
      ctx.casting = null;
    }
  };
  const startNewEncounter = sim.startNewEncounter;
  sim.startNewEncounter = function(...args) {
    const out = startNewEncounter.apply(this, args);
    if (ctx) ctx.data.maxEnemies = Math.max(ctx.data.maxEnemies, (this.enemies || []).length);
    return out;
  };
  const tryUseConsumable = sim.tryUseConsumable;
  sim.tryUseConsumable = function(source, consumable) {
    if (!ctx || !source.isPlayer || source.combatDetails.currentHitpoints <= 0) return tryUseConsumable.call(this, source, consumable);
    const d = source.combatDetails;
    const missingHp = d.maxHitpoints - d.currentHitpoints;
    const missingMp = d.maxManapoints - d.currentManapoints;
    const used = tryUseConsumable.call(this, source, consumable);
    if (used) {
      const s = consumableStats(consumable.hrid);
      s.uses++;
      const hp = consumable.hitpointRestore || 0;
      const mp = consumable.manapointRestore || 0;
      s.restore += hp + mp;
      s.wasted += Math.max(0, hp - missingHp) + Math.max(0, mp - missingMp);
    }
    return used;
  };
  const processAttack = combatUtilities_default.processAttack;
  combatUtilities_default.processAttack = function(source, target, abilityEffect = null) {
    if (!ctx || !ctx.casting || !abilityEffect || !source.isPlayer || target.isPlayer) return processAttack.call(this, source, target, abilityEffect);
    const hpBefore = target.combatDetails.currentHitpoints;
    const result = processAttack.call(this, source, target, abilityEffect);
    if (result.didHit) {
      const s = abilityStats(ctx.casting);
      if (target.combatDetails.currentHitpoints <= 0) {
        if (s.kills.length < MAX_SAMPLES) s.kills.push(hpBefore);
      } else {
        s.hits++;
        s.hitDamage += result.damageDone;
      }
    }
    return result;
  };
  const addDeath = simResult_default.prototype.addDeath;
  simResult_default.prototype.addDeath = function(unit) {
    if (ctx && unit === ctx.player) {
      const now2 = ctx.simulator.simulationTime;
      ctx.data.deaths++;
      if ((unit.food || []).some((f) => f && f.hitpointRestore > 0 && f.lastUsed + f.cooldownDuration > now2)) ctx.data.deathsFoodWaiting++;
    }
    return addDeath.call(this, unit);
  };
  const processHeal = combatUtilities_default.processHeal;
  combatUtilities_default.processHeal = function(source, abilityEffect, target) {
    if (!ctx || !ctx.casting || !source.isPlayer) return processHeal.call(this, source, abilityEffect, target);
    const missing = target.combatDetails.maxHitpoints - target.combatDetails.currentHitpoints;
    const healed = processHeal.call(this, source, abilityEffect, target);
    const s = abilityStats(ctx.casting);
    s.heals++;
    s.healed += healed;
    if (healed < missing) {
      if (s.healSamples.length < MAX_SAMPLES) s.healSamples.push(healed);
    } else {
      s.overheal++;
    }
    return healed;
  };
}
async function measured(simulator, player, fn) {
  install();
  const data = { abilities: {}, consumables: {}, maxEnemies: 0, deaths: 0, deathsFoodWaiting: 0 };
  ctx = { simulator, player, data, casting: null };
  try {
    return [await fn(), data];
  } finally {
    ctx = null;
  }
}

// src/sim-core.js
var ONE_HOUR = 36e11;
var ROOM_LIMIT_NS = 12e10;
function mulberry32(seed) {
  let a = seed | 0;
  return function() {
    a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function perHour(map, hours) {
  const out = {};
  for (const [key, value] of Object.entries(map || {})) out[key] = value / hours;
  return out;
}
async function runSim(job) {
  const nativeRandom = Math.random;
  Math.random = mulberry32(job.seed);
  try {
    const zone = new zone_default(job.zoneHrid, job.tier);
    const player = player_default.createFromDTO(structuredClone(job.player));
    player.zoneBuffs = zone.buffs || [];
    player.extraBuffs = job.extraBuffs || [];
    const simulator = new combatSimulator_default([player], zone, null, {});
    const simulate = () => simulator.simulate(job.hours * ONE_HOUR);
    const [result, telemetry] = job.telemetry ? await measured(simulator, player, simulate) : [await simulate(), null];
    const hours = result.simulatedTime / ONE_HOUR;
    const kills = {};
    for (const [hrid, count] of Object.entries(result.deaths)) {
      if (hrid !== "player1") kills[hrid] = count / hours;
    }
    const xp = perHour(result.experienceGained.player1, hours);
    return {
      hours,
      xp,
      xpTotal: Object.values(xp).reduce((sum2, value) => sum2 + value, 0),
      deaths: (result.deaths.player1 || 0) / hours,
      encounters: result.encounters / hours,
      kills,
      consumables: perHour(result.consumablesUsed.player1, hours),
      manaUsed: perHour(result.manaUsed?.player1, hours),
      dropRateMultiplier: result.dropRateMultiplier.player1 ?? 1,
      rareFindMultiplier: result.rareFindMultiplier.player1 ?? 1,
      combatDropQuantity: result.combatDropQuantity.player1 ?? 0,
      ...telemetry ? { telemetry: { ...telemetry, hours } } : {}
    };
  } finally {
    Math.random = nativeRandom;
  }
}
async function runLabyrinthSim(job) {
  const nativeRandom = Math.random;
  Math.random = mulberry32(job.seed);
  try {
    const room = new labyrinth_default(job.monsterHrid, job.roomLevel, []);
    const player = player_default.createFromDTO(structuredClone(job.player));
    player.zoneBuffs = [];
    player.extraBuffs = job.extraBuffs || [];
    const simulator = new combatSimulator_default([player], null, room, {});
    const out = { attempts: 0, wins: 0, deaths: 0, timeouts: 0, winSeconds: [] };
    let open2 = null;
    const settle = () => {
      if (!open2) return;
      const deaths = simulator.simResult.deaths;
      if ((deaths[job.monsterHrid] || 0) > open2.kills) {
        out.wins++;
        out.winSeconds.push((simulator.simulationTime - open2.start) / 1e9);
      } else if ((deaths.player1 || 0) > open2.died) out.deaths++;
      else out.timeouts++;
      out.attempts++;
      open2 = null;
    };
    const nextMonster = room.getMonster.bind(room);
    room.getMonster = () => {
      settle();
      const deaths = simulator.simResult.deaths;
      open2 = { start: simulator.simulationTime, kills: deaths[job.monsterHrid] || 0, died: deaths.player1 || 0 };
      return nextMonster();
    };
    const processEvent = simulator.processEvent.bind(simulator);
    simulator.processEvent = async (event) => {
      await processEvent(event);
      if (out.attempts >= job.attempts) simulator.simulationTime = Infinity;
    };
    await simulator.simulate((job.attempts + 1) * ROOM_LIMIT_NS);
    out.winSeconds.sort((a, b) => a - b);
    const at = (q) => out.winSeconds.length ? out.winSeconds[Math.min(out.winSeconds.length - 1, Math.floor(q * out.winSeconds.length))] : null;
    const { winSeconds, ...counts } = out;
    return { ...counts, medianWinSeconds: at(0.5), slowWinSeconds: at(0.9) };
  } finally {
    Math.random = nativeRandom;
  }
}

// pi/node-pool.js
init_data_shim();
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { gunzipSync } from "node:zlib";
import { Worker } from "node:worker_threads";
var readData = (file) => JSON.parse(gunzipSync(readFileSync(file)).toString("utf8"));
var ThreadPool = class {
  constructor(size, dataFile, entry) {
    this.entry = new URL(entry);
    this.size = size;
    this.dataFile = dataFile;
    this.workers = [];
    this.queue = [];
    this.pending = /* @__PURE__ */ new Map();
    this.nextId = 1;
  }
  async start() {
    const ready = [];
    for (let i = 0; i < this.size; i++) {
      const worker = new Worker(this.entry, { workerData: { dataFile: this.dataFile }, resourceLimits: { maxOldGenerationSizeMb: 256 } });
      const entry = { worker, busy: true };
      ready.push(
        new Promise((resolve, reject) => {
          worker.once("error", reject);
          worker.on("message", (message) => {
            if (message.ready) {
              entry.busy = false;
              resolve();
              return this.pump();
            }
            entry.busy = false;
            const task = this.pending.get(message.id);
            this.pending.delete(message.id);
            if (message.error) task?.reject(new Error(message.error));
            else task?.resolve(message.result);
            this.pump();
          });
        })
      );
      this.workers.push(entry);
    }
    await Promise.all(ready);
    for (const entry of this.workers) entry.worker.on("error", (error) => this.fail(error));
  }
  fail(error) {
    for (const task of [...this.queue, ...this.pending.values()]) task.reject(error);
    this.queue = [];
    this.pending.clear();
  }
  run(job) {
    return new Promise((resolve, reject) => {
      this.queue.push({ id: this.nextId++, job, resolve, reject });
      this.pump();
    });
  }
  runAll(jobs, onProgress) {
    let done = 0;
    return Promise.all(jobs.map((job) => this.run(job).then((result) => (onProgress?.(++done, jobs.length), result))));
  }
  pump() {
    for (const entry of this.workers) {
      if (entry.busy || !this.queue.length) continue;
      const task = this.queue.shift();
      entry.busy = true;
      this.pending.set(task.id, task);
      entry.worker.postMessage({ id: task.id, job: task.job });
    }
  }
  terminate() {
    return Promise.all(this.workers.map((entry) => entry.worker.terminate()));
  }
};
function newestMarket(rawDir) {
  if (!existsSync(rawDir)) return null;
  for (const day of readdirSync(rawDir).sort().reverse()) {
    const files = readdirSync(path.join(rawDir, day)).filter((f) => f.endsWith(".json.gz")).sort();
    if (files.length) return JSON.parse(gunzipSync(readFileSync(path.join(rawDir, day, files[files.length - 1]))).toString("utf8"));
  }
  return null;
}
async function loadAdvisor(dataFile, rawDir) {
  const { hash: hash2, data } = readData(dataFile);
  const market = newestMarket(rawDir);
  if (!market?.marketData) throw new Error("no market file on the Pi yet");
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = async (url, ...rest) => String(url).includes("marketplace.json") ? { ok: true, json: async () => market } : nativeFetch(url, ...rest);
  const { loadClientData: loadClientData2, loadPrices: loadPrices2 } = await Promise.resolve().then(() => (init_game_data(), game_data_exports));
  await loadClientData2({ localStorageUtil: { getInitClientData: () => data } });
  await loadPrices2();
  fill(Object.fromEntries(ENGINE_TABLES.map((t) => [t, data[t] || {}])));
  return { hash: hash2, data, market };
}
function serveWorker(parentPort2, workerData2, run) {
  const { data } = readData(workerData2.dataFile);
  fill(Object.fromEntries(ENGINE_TABLES.map((t) => [t, data[t] || {}])));
  parentPort2.on("message", async ({ id, job }) => {
    try {
      parentPort2.postMessage({ id, result: await run(job) });
    } catch (error) {
      parentPort2.postMessage({ id, error: String(error?.stack || error) });
    }
  });
  parentPort2.postMessage({ ready: true });
}

// pi/combat-plan-entry.js
var readJson = (file) => existsSync2(file) ? JSON.parse(readFileSync2(file, "utf8")) : null;
function skillingSegments(plan) {
  const best = typeof plan?.best === "number" ? plan.plans?.[plan.best] : plan?.best || null;
  return (best?.segments || []).filter((s) => s.to > s.from).map((s) => ({ from: s.from, to: s.to, perDay: (s.gold || 0) / (s.to - s.from), name: s.name || null, skill: s.skill || null }));
}
async function main() {
  try {
    os.setPriority(19);
  } catch {
  }
  const [charDir, dataFile, rawDir, labyrinthRequest, planDir] = process.argv.slice(2);
  const started = Date.now();
  const settings = readJson(path2.join(charDir, "settings.json"));
  const request2 = readJson(labyrinthRequest);
  if (!request2?.setups?.length) throw new Error("no loadouts on the Pi yet: open the Labyrinth tab once");
  const snapshot = readJson(path2.join(planDir, "snapshot.json"));
  const plan = readJson(path2.join(planDir, "plan.json"));
  const { hash: hash2, data, market } = await loadAdvisor(dataFile, rawDir);
  const { planCombat: planCombat2 } = await Promise.resolve().then(() => (init_combat_plan(), combat_plan_exports));
  const write = (name, value) => {
    const file = path2.join(charDir, name);
    writeFileSync(file + ".tmp", JSON.stringify(value));
    renameSync(file + ".tmp", file);
  };
  let shown = 0;
  const progress = (stage, done, total) => {
    if (Date.now() - shown < 3e3 && done < total) return;
    shown = Date.now();
    write("progress.json", { stage, done, total, at: shown });
  };
  const workers = Math.max(1, Math.min(4, Number(process.env.MWIA_COMBAT_PLAN_WORKERS) || 2));
  const pool = new ThreadPool(workers, dataFile, import.meta.url);
  await pool.start();
  try {
    const input = {
      settings: settings?.settings || {},
      setups: request2.setups,
      coins: snapshot?.coins ?? 0,
      skilling: skillingSegments(plan)
    };
    const result = await planCombat2(pool, input, data, { onProgress: progress });
    write("result.json", {
      at: started,
      finishedAt: Date.now(),
      ms: Date.now() - started,
      character: request2.character?.name || null,
      dataHash: hash2,
      pricesAt: market.timestamp ? market.timestamp * 1e3 : null,
      loadoutsAt: request2.at ?? null,
      coinsAt: snapshot?.at ?? null,
      skillingPlanAt: plan?.at ?? null,
      settingsAt: settings?.at ?? null,
      version: settings?.version || request2.version || null,
      ...result
    });
  } finally {
    await pool.terminate();
  }
}
if (!isMainThread) serveWorker(parentPort, workerData, (job) => job.monsterHrid ? runLabyrinthSim(job) : runSim(job));
else await main();
export {
  skillingSegments
};

// ---- Third-party licences ----
// MWICombatSimulator (engine/):
// MIT License
// 
// Copyright (c) 2024 AmVoidGuy
// 
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
// 
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
// 
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// heap-js:
// BSD 3-Clause License
// 
// Copyright (c) 2017, Ignacio Lago
// All rights reserved.
// 
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
// 
// * Redistributions of source code must retain the above copyright notice, this
//   list of conditions and the following disclaimer.
// 
// * Redistributions in binary form must reproduce the above copyright notice,
//   this list of conditions and the following disclaimer in the documentation
//   and/or other materials provided with the distribution.
// 
// * Neither the name of the copyright holder nor the names of its
//   contributors may be used to endorse or promote products derived from
//   this software without specific prior written permission.
// 
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
// AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
// IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
// FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
// DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
// SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
// CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
// OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

