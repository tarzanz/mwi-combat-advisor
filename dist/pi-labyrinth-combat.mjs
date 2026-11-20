// Built from pi/labyrinth-combat-entry.js by build.mjs – don't edit.
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
    const rate2 = Math.min(1, (1 + 0.1 * tier) * (drop.dropRate + (drop.dropRatePerDifficultyTier ?? 0) * tier));
    if (rate2 <= 0) continue;
    const finalRate = Math.min(1, rate2 * (sim.dropRateMultiplier || 1));
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
function levelsPerDay(table, xpNow, xpPerDay) {
  if (!(xpPerDay > 0)) return 0;
  return fractionalLevel(table, xpNow + xpPerDay) - fractionalLevel(table, xpNow);
}
var init_levels = __esm({
  "src/levels.js"() {
  }
});

// src/alchemy.js
function levelPenalty(level, itemLevel) {
  return level < itemLevel && itemLevel > 0 ? 0.9 / itemLevel * (level - itemLevel) : 0;
}
function coinCost(kind, detail) {
  const bulk = bulkOf(detail);
  if (kind === "decompose") return 5 * (10 + (detail.itemLevel || 0)) * bulk;
  if (kind === "transmute") return Math.max(50, Math.floor((detail.sellPrice || 0) / 5)) * bulk;
  return 0;
}
function decomposeEssence(itemLevel, level) {
  return level > 0 ? Math.round(2 * (0.5 + 0.1 * Math.pow(1.05, itemLevel || 0)) * Math.pow(2, level)) : 0;
}
function successOutputs(kind, detail, level = 0) {
  const a = detail.alchemyDetail;
  if (kind === "coinify") return [{ itemHrid: COIN, count: 5 * (detail.sellPrice || 0) }];
  if (kind === "decompose") {
    const out = (a.decomposeItems || []).map((d) => ({ itemHrid: d.itemHrid, count: d.count }));
    const essence = decomposeEssence(detail.itemLevel, level);
    if (essence >= 1) out.push({ itemHrid: ENHANCING_ESSENCE, count: essence });
    return out;
  }
  return (a.transmuteDropTable || []).map((d) => ({ itemHrid: d.itemHrid, count: meanCount(d) }));
}
function crateDrop(itemLevel) {
  if (itemLevel < 35) return { itemHrid: "/items/small_artisans_crate", rate: (100 + itemLevel) / 144e3 };
  if (itemLevel < 70) return { itemHrid: "/items/medium_artisans_crate", rate: (65 + itemLevel) / 216e3 };
  return { itemHrid: "/items/large_artisans_crate", rate: (30 + itemLevel) / 288e3 };
}
function alchemyAction(kind, detail, level = 0) {
  const k = ALCHEMY_KINDS[kind];
  const outputs = successOutputs(kind, detail, level).filter((o) => o.itemHrid !== detail.hrid);
  const main2 = kind === "coinify" ? COIN : level > 0 ? ENHANCING_ESSENCE : outputs.sort((x, y) => y.count - x.count)[0]?.itemHrid;
  return {
    hrid: alchemyHrid(kind, detail.hrid, level),
    name: `${k.name} ${detail.name}${level > 0 ? ` +${level}` : ""}`,
    kind,
    itemHrid: detail.hrid,
    enhancementLevel: level,
    type: TYPE,
    function: ALCHEMY_FUNCTION,
    levelRequirement: { skillHrid: SKILL, level: detail.itemLevel || 1 },
    baseTimeCost: BASE_SECONDS * 1e9,
    outputItems: main2 ? [{ itemHrid: main2, count: 1 }] : [],
    sortIndex: detail.sortIndex || 0
  };
}
function alchemyActions(data, market, plusLevels = () => []) {
  const list = [];
  for (const detail of Object.values(data.itemDetailMap)) {
    const a = detail.alchemyDetail;
    if (a && detail.isTradable && decomposesEnhanced(detail)) {
      for (const level of plusLevels(detail.hrid)) if (level > 0) list.push(alchemyAction("decompose", detail, level));
    }
    if (!a || !detail.isTradable || market.buy(detail.hrid) === null) continue;
    const kinds = [];
    if (a.isCoinifiable && detail.sellPrice > 0) kinds.push("coinify");
    if (a.decomposeItems?.length) kinds.push("decompose");
    if (a.transmuteDropTable?.length && a.transmuteSuccessRate > 0) kinds.push("transmute");
    for (const kind of kinds) list.push(alchemyAction(kind, detail));
  }
  return list.sort((a, b) => a.levelRequirement.level - b.levelRequirement.level || a.sortIndex - b.sortIndex || (a.enhancementLevel || 0) - (b.enhancementLevel || 0));
}
function evaluateAlchemy(action, who, data, market, teas, { score = (r) => r.goldPerDay, plusBuy = () => null, plusHeld = () => 0, itemPrice = null } = {}) {
  const detail = data.itemDetailMap[action.itemHrid];
  const kind = action.kind;
  const k = ALCHEMY_KINDS[kind];
  const buff = totals([...who.buffs?.[TYPE] || [], ...teaBuffs(teas, who.concentration, data)]);
  const fraction = (type) => buff(type).flat + buff(type).ratio;
  const level = who.levels[SKILL] ?? 1;
  const levelBuff = buff("/buff_types/alchemy_level");
  const effectiveLevel = (1 + levelBuff.ratio) * level + levelBuff.flat;
  const itemLevel = detail.itemLevel || 1;
  const bulk = bulkOf(detail);
  const levelEfficiency = Math.max(0, effectiveLevel - itemLevel) / 100;
  const efficiency = fraction("/buff_types/efficiency") + levelEfficiency;
  const speed = fraction("/buff_types/action_speed");
  const cycleSeconds = Math.max(MIN_CYCLE_SECONDS, BASE_SECONDS / (1 + speed));
  const actionsPerHour = 3600 / cycleSeconds * (1 + efficiency);
  const baseRate = kind === "transmute" ? detail.alchemyDetail.transmuteSuccessRate : k.rate;
  const penalty = levelPenalty(effectiveLevel, itemLevel);
  const successBuff = fraction("/buff_types/alchemy_success");
  const wisdom = fraction("/buff_types/wisdom");
  const xpBase = k.xp * (10 + itemLevel) * (1 + wisdom);
  const plus = action.enhancementLevel || 0;
  const plusAsk = plus > 0 ? plusBuy(action.itemHrid, plus) : null;
  const forSale = plus === 0 || plusAsk !== null;
  const price = itemPrice !== null ? itemPrice : plus > 0 ? plusAsk ?? plusHeld(action.itemHrid, plus) : market.buy(action.itemHrid);
  const coins = coinCost(kind, detail);
  const drinksPerHour = 12 * who.concentration;
  const teaCosts = teas.map((hrid) => {
    const p = market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
    return { itemHrid: hrid, price: p, perHour: p * drinksPerHour };
  });
  const teaPerHour = teaCosts.reduce((sum, t) => sum + t.perHour, 0);
  const essence = { itemHrid: ESSENCE, count: (100 + itemLevel) / 1800 * (1 + fraction("/buff_types/essence_find")) };
  const crate = crateDrop(itemLevel);
  const rare = { itemHrid: crate.itemHrid, count: crate.rate * (1 + fraction("/buff_types/rare_find")) };
  const catalysts = [{ itemHrid: null, bonus: 0 }];
  for (const [hrid, bonus] of [[k.catalyst, CATALYST_BONUS.kind], [PRIME, CATALYST_BONUS.prime]]) {
    if (market.buy(hrid) !== null) catalysts.push({ itemHrid: hrid, bonus, price: market.buy(hrid) });
  }
  let best = null;
  for (const catalyst of catalysts) {
    const successRate = Math.min(1, Math.max(0, baseRate * (1 + catalyst.bonus + successBuff + penalty)));
    const outputs = [];
    const add = (itemHrid, count, kindOf) => {
      if (count <= 0) return;
      const sell = itemHrid === COIN ? { price: 1, source: "coin" } : market.sell(itemHrid);
      outputs.push({ itemHrid, count, kind: kindOf, price: sell.price, sell, value: count * sell.price });
    };
    let selfBack = 0;
    for (const o of successOutputs(kind, detail, plus)) {
      if (o.itemHrid === action.itemHrid) selfBack += o.count * bulk * successRate;
      else add(o.itemHrid, o.count * bulk * successRate, "product");
    }
    add(essence.itemHrid, essence.count, "essence");
    add(rare.itemHrid, rare.count, "rare");
    const inputs = [{ itemHrid: action.itemHrid, enhancementLevel: plus, count: bulk - selfBack, price, value: (bulk - selfBack) * (price || 0), ...forSale ? {} : { forSale: false } }];
    if (coins) inputs.push({ itemHrid: COIN, count: coins, price: 1, value: coins });
    if (catalyst.itemHrid) inputs.push({ itemHrid: catalyst.itemHrid, count: successRate, price: catalyst.price, value: successRate * catalyst.price, catalyst: true });
    const revenuePerAction = outputs.reduce((sum, o) => sum + o.value, 0);
    const costPerAction = inputs.reduce((sum, i) => sum + i.value, 0);
    const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
    const xpPerAction = xpBase * (successRate + FAIL_XP * (1 - successRate));
    const main2 = plus > 0 && outputs.find((o) => o.itemHrid === ENHANCING_ESSENCE) || outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0] || null;
    const warnings = [];
    if (main2 && main2.sell.note) warnings.push({ kind: main2.sell.note, itemHrid: main2.itemHrid, ask: main2.sell.ask, bid: main2.sell.bid });
    const r = {
      action,
      hrid: action.hrid,
      skill: SKILL,
      teas,
      level,
      effectiveLevel,
      requiredLevel: itemLevel,
      efficiency,
      levelEfficiency,
      speed,
      baseSeconds: BASE_SECONDS,
      cycleSeconds,
      actionsPerHour,
      quantity: 0,
      artisan: 0,
      processing: 0,
      outputs,
      inputs,
      teaCosts,
      drinksPerHour,
      revenuePerAction,
      costPerAction,
      teaPerHour,
      profitPerHour,
      margin: revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null,
      mainCount: main2 ? main2.count : bulk,
      xpPerAction,
      xpPerHour: actionsPerHour * xpPerAction,
      valid: price !== null && price !== void 0 && successRate > 0 && (!!main2 || kind === "coinify"),
      enhancementLevel: plus,
      warnings,
      buffsKnown: !!who.buffs,
      bulk,
      coinCost: coins,
      baseRate,
      successRate,
      penalty,
      successBuff,
      catalyst,
      wisdom,
      goldPerDay: profitPerHour * 24,
      xpPerDay: actionsPerHour * xpPerAction * 24
    };
    r.coinsPerXp = r.xpPerHour > 0 ? -r.profitPerHour / r.xpPerHour : null;
    if (!best || score(r) > score(best) + 1e-12) best = r;
  }
  return best;
}
var ALCHEMY, TYPE, SKILL, ALCHEMY_FUNCTION, BASE_SECONDS, MIN_CYCLE_SECONDS, FAIL_XP, COIN, ESSENCE, ENHANCING_ESSENCE, ALCHEMY_KINDS, PRIME, CATALYST_BONUS, bulkOf, meanCount, decomposesEnhanced, alchemyHrid, decomposeAction;
var init_alchemy = __esm({
  "src/alchemy.js"() {
    init_skilling();
    ALCHEMY = "alchemy";
    TYPE = "/action_types/alchemy";
    SKILL = "/skills/alchemy";
    ALCHEMY_FUNCTION = "/action_functions/alchemy";
    BASE_SECONDS = 20;
    MIN_CYCLE_SECONDS = 3;
    FAIL_XP = 0.1;
    COIN = "/items/coin";
    ESSENCE = "/items/alchemy_essence";
    ENHANCING_ESSENCE = "/items/enhancing_essence";
    ALCHEMY_KINDS = {
      coinify: { name: "Coinify", hrid: "/actions/alchemy/coinify", rate: 0.7, xp: 1, catalyst: "/items/catalyst_of_coinification" },
      decompose: { name: "Decompose", hrid: "/actions/alchemy/decompose", rate: 0.6, xp: 1.4, catalyst: "/items/catalyst_of_decomposition" },
      transmute: { name: "Transmute", hrid: "/actions/alchemy/transmute", rate: null, xp: 1.6, catalyst: "/items/catalyst_of_transmutation" }
    };
    PRIME = "/items/prime_catalyst";
    CATALYST_BONUS = { kind: 0.15, prime: 0.25 };
    bulkOf = (detail) => Math.max(1, Math.floor(detail.alchemyDetail?.bulkMultiplier || 1));
    meanCount = (drop) => (Number(drop.dropRate ?? 1) || 0) * ((Number(drop.minCount ?? 1) + Number(drop.maxCount ?? 1)) / 2);
    decomposesEnhanced = (detail) => !!(detail?.equipmentDetail && detail.enhancementCosts?.length && detail.alchemyDetail?.decomposeItems?.length);
    alchemyHrid = (kind, itemHrid, level = 0) => `${ALCHEMY_KINDS[kind].hrid}#${itemHrid}${level > 0 ? `#+${level}` : ""}`;
    decomposeAction = (detail, level) => alchemyAction("decompose", detail, level);
  }
});

// src/enhancing.js
var enhancing_exports = {};
__export(enhancing_exports, {
  BASE_RATES: () => BASE_RATES,
  ENHANCE_FUNCTION: () => ENHANCE_FUNCTION,
  ENHANCING: () => ENHANCING,
  MAX_TARGET: () => MAX_TARGET,
  MIN_PROTECT: () => MIN_PROTECT,
  cheapestProtection: () => cheapestProtection,
  enhanceCrate: () => enhanceCrate,
  enhanceCycles: () => enhanceCycles,
  enhanceRates: () => enhanceRates,
  enhancingActions: () => enhancingActions,
  evaluateEnhance: () => evaluateEnhance,
  levelBonus: () => levelBonus,
  materials: () => materials,
  protectedCycle: () => protectedCycle,
  selfEnhanceCosts: () => selfEnhanceCosts
});
function enhanceCrate(itemLevel) {
  if (itemLevel < 35) return { itemHrid: "/items/small_artisans_crate", rate: (100 + itemLevel) / 12e4 };
  if (itemLevel < 70) return { itemHrid: "/items/medium_artisans_crate", rate: (65 + itemLevel) / 18e4 };
  return { itemHrid: "/items/large_artisans_crate", rate: (30 + itemLevel) / 24e4 };
}
function levelBonus(level, itemLevel) {
  if (level >= itemLevel) return OBSERVATORY_SUCCESS * (level - itemLevel);
  return -0.5 * (1 - level / itemLevel);
}
function enhanceCycles(p, blessed, xpAt) {
  const reach = [1];
  for (let L = 1; L <= MAX_TARGET; L++) reach[L] = reach[L - 1] * p[L - 1] * (1 - blessed) + (L >= 2 ? reach[L - 2] * p[L - 2] * blessed : 0);
  const attempts = [0];
  const xp = [0];
  let visits = 0;
  let gained = 0;
  for (let T = 1; T <= MAX_TARGET; T++) {
    const L = T - 1;
    visits += reach[L];
    gained += reach[L] * (p[L] + FAIL_XP2 * (1 - p[L])) * xpAt[L];
    const done = reach[L] * p[L] + (L >= 1 ? reach[L - 1] * p[L - 1] * blessed : 0);
    attempts[T] = done > 0 ? visits / done : Infinity;
    xp[T] = done > 0 ? gained / done : Infinity;
  }
  return { attempts, xp, reach };
}
function protectedCycle(p, blessed, target, from, xpPer, start = 0) {
  const { a, b, d } = SOLVE;
  a.fill(0, 3 * target, 3 * (target + 2));
  b[target] = b[target + 1] = d[target] = d[target + 1] = 0;
  for (let L = target - 1; L >= 0; L--) {
    const up1 = p[L] * (1 - blessed);
    const up2 = p[L] * blessed;
    const fail = 1 - p[L];
    const guarded = L >= from;
    const b1 = b[L + 1];
    const b2 = b[L + 2];
    const keep = 1 - up1 * b1 - up2 * b2 * b1;
    if (keep <= 1e-15) return null;
    const cost = [1, xpPer[L], guarded ? fail : 0];
    for (let i = 0; i < 3; i++) {
      const a1 = a[3 * (L + 1) + i];
      a[3 * L + i] = (cost[i] + up1 * a1 + up2 * (a[3 * (L + 2) + i] + b2 * a1)) / keep;
    }
    b[L] = guarded ? fail / keep : 0;
    d[L] = (up1 * d[L + 1] + up2 * (b2 * d[L + 1] + d[L + 2]) + (guarded ? 0 : fail)) / keep;
  }
  const rest = 1 - d[0];
  if (rest <= 1e-15) return null;
  const e0 = [a[0] / rest, a[1] / rest, a[2] / rest];
  let e = e0;
  for (let L = 1; L <= start && L < target; L++) e = e.map((prev, i) => a[3 * L + i] + b[L] * prev + d[L] * e0[i]);
  return { attempts: e[0], xp: e[1], protections: e[2] };
}
function protectedCycles(p, blessed, target, from) {
  if (!protectedCycle(p, blessed, target, from, NO_XP)) return null;
  const { a, b, d } = SOLVE;
  const rest = 1 - d[0];
  const attempts = [a[0] / rest];
  const protections = [a[2] / rest];
  for (let L = 1; L < target; L++) {
    attempts[L] = a[3 * L] + b[L] * attempts[L - 1] + d[L] * attempts[0];
    protections[L] = a[3 * L + 2] + b[L] * protections[L - 1] + d[L] * protections[0];
  }
  return { attempts, protections };
}
function cheapestProtection(detail, market) {
  let best = null;
  for (const itemHrid of /* @__PURE__ */ new Set([detail.hrid, MIRROR, ...detail.protectionItemHrids || []])) {
    const price = market.buy(itemHrid);
    if (price !== null && (!best || price < best.price)) best = { itemHrid, price };
  }
  return best;
}
function materials(detail, market) {
  const inputs = [];
  for (const cost of detail.enhancementCosts || []) {
    const price = market.buy(cost.itemHrid);
    if (price === null) return null;
    inputs.push({ itemHrid: cost.itemHrid, count: cost.count, price, value: cost.count * price });
  }
  return inputs.length ? inputs : null;
}
function enhancingActions(data, market, owned = () => 0) {
  const list = [];
  for (const detail of Object.values(data.itemDetailMap)) {
    if (!detail.equipmentDetail || !detail.enhancementCosts?.length || !detail.isTradable) continue;
    if (market.buy(detail.hrid) === null && !(owned(detail.hrid) > 0)) continue;
    if (!materials(detail, market)) continue;
    list.push({
      hrid: `/actions/enhancing/enhance#${detail.hrid}`,
      name: detail.name,
      itemHrid: detail.hrid,
      type: TYPE2,
      function: ENHANCE_FUNCTION,
      levelRequirement: { skillHrid: SKILL2, level: detail.itemLevel || 1 },
      baseTimeCost: BASE_SECONDS2 * 1e9,
      sortIndex: detail.sortIndex || 0
    });
  }
  return list.sort((a, b) => a.levelRequirement.level - b.levelRequirement.level || a.sortIndex - b.sortIndex);
}
function missingSuccess(who, data) {
  const sent = (key) => (who.sources?.[key]?.[TYPE2] || []).some((b) => b.typeHrid === SUCCESS);
  let bonus = 0;
  if (!sent("equipmentActionTypeBuffsMap")) {
    const multipliers = data.enhancementLevelTotalBonusMultiplierTable || [];
    for (const item of who.equipped || []) {
      const detail = data.itemDetailMap[item.itemHrid]?.equipmentDetail;
      const base = detail?.noncombatStats?.enhancingSuccess || 0;
      const extra = detail?.noncombatEnhancementBonuses?.enhancingSuccess || 0;
      bonus += base + extra * (multipliers[item.enhancementLevel || 0] || 0);
    }
  }
  if (!sent("houseActionTypeBuffsMap")) bonus += OBSERVATORY_SUCCESS * (who.houseLevels?.[OBSERVATORY] || 0);
  return bonus;
}
function baseItem(action, market, owned) {
  const have = owned(action.itemHrid) > 0;
  if (have) {
    const bid = market.sell(action.itemHrid).bid;
    return { price: bid ? bid * (1 - MARKET_TAX) : 0, owned: true };
  }
  const price = market.buy(action.itemHrid);
  return price === null ? null : { price, owned: false };
}
function enhanceRates(who, data, teas, itemLevel) {
  const buff = totals([...who.buffs?.[TYPE2] || [], ...teaBuffs(teas, who.concentration, data)]);
  const fraction = (type) => buff(type).flat + buff(type).ratio;
  const level = who.levels[SKILL2] ?? 1;
  const levelBuff = buff("/buff_types/enhancing_level");
  const effectiveLevel = (1 + levelBuff.ratio) * level + levelBuff.flat;
  const success = fraction(SUCCESS) + missingSuccess(who, data);
  const bonus = levelBonus(effectiveLevel, itemLevel);
  const multiplier = Math.max(0, 1 + bonus + success);
  const rates = BASE_RATES.map((r) => Math.min(1, r * multiplier));
  const blessed = Math.max(0, fraction("/buff_types/blessed"));
  const levelSpeed = Math.max(0, effectiveLevel - itemLevel) / 100;
  const speed = fraction("/buff_types/action_speed") + levelSpeed;
  return { fraction, level, effectiveLevel, success, bonus, multiplier, rates, blessed, levelSpeed, speed, cycleSeconds: BASE_SECONDS2 / (1 + speed) };
}
function evaluateEnhance(action, who, data, market, teas, { resale, owned = () => 0, score = (r) => r.goldPerDay, target: fixedTarget = null, finish = () => null } = {}) {
  const itemLevel = action.levelRequirement.level;
  const detail = data.itemDetailMap[action.itemHrid];
  const { fraction, level, effectiveLevel, success, bonus, multiplier, rates, blessed, levelSpeed, speed, cycleSeconds } = enhanceRates(who, data, teas, itemLevel);
  const actionsPerHour = 3600 / cycleSeconds;
  const wisdom = fraction("/buff_types/wisdom");
  const xpAt = rates.map((_, L) => 1.4 * (1 + L) * (10 + itemLevel) * (1 + wisdom));
  const cycles = enhanceCycles(rates, blessed, xpAt);
  const inputs = materials(detail, market) || [];
  const costPerAttempt = inputs.reduce((sum, i) => sum + i.value, 0);
  const drops = [];
  const crate = enhanceCrate(itemLevel);
  for (const [itemHrid, count, kind] of [[ESSENCE2, (100 + itemLevel) / 1e3 * (1 + fraction("/buff_types/essence_find")), "essence"], [crate.itemHrid, crate.rate * (1 + fraction("/buff_types/rare_find")), "rare"]]) {
    const sell = market.sell(itemHrid);
    drops.push({ itemHrid, count, kind, price: sell.price, sell, value: count * sell.price });
  }
  const dropsPerAttempt = drops.reduce((sum, d) => sum + d.value, 0);
  const base = baseItem(action, market, owned);
  const drinksPerHour = 12 * who.concentration;
  const teaCosts = teas.map((hrid) => {
    const price = market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
    return { itemHrid: hrid, price, perHour: price * drinksPerHour };
  });
  const teaPerHour = teaCosts.reduce((sum, t) => sum + t.perHour, 0);
  const common = {
    action,
    hrid: action.hrid,
    skill: SKILL2,
    teas,
    level,
    effectiveLevel,
    requiredLevel: itemLevel,
    efficiency: 0,
    levelEfficiency: 0,
    speed,
    levelSpeed,
    baseSeconds: BASE_SECONDS2,
    cycleSeconds,
    actionsPerHour,
    quantity: 0,
    artisan: 0,
    processing: 0,
    teaCosts,
    drinksPerHour,
    teaPerHour,
    rates,
    multiplier,
    levelBonus: bonus,
    successBonus: success,
    blessed,
    wisdom,
    base,
    warnings: [],
    buffsKnown: !!who.buffs
  };
  const guard = cheapestProtection(detail, market);
  const valid = !!base && inputs.length > 0;
  const build = (target, sold, cycle, protect, full = false, fin = null) => {
    const { attempts } = cycle;
    const perCycle = 1 / attempts;
    const share = fin ? attempts / actionsPerHour / (attempts / actionsPerHour + fin.hours) : 1;
    const madePerDay = actionsPerHour / attempts * 24 * share;
    const { price, salesCap } = fin ? { price: fin.value, salesCap: null } : salesLimited({ ...sold, floor: sold.floor === void 0 ? void 0 : Math.min(sold.floor, sold.price) }, madePerDay);
    const guardValue = protect ? cycle.protections / attempts * protect.price : 0;
    const attemptCost = costPerAttempt + guardValue;
    const revenuePerAction = perCycle * price + dropsPerAttempt;
    const itemCost = base ? fin ? Math.max(base.price, fin.itemFloor || 0) : base.price : 0;
    const costPerAction = attemptCost + perCycle * itemCost;
    const profitPerHour = share * (actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour);
    const xpPerAction = cycle.xp / attempts;
    const xpPerHour = share * actionsPerHour * xpPerAction;
    const numbers = { skill: SKILL2, target, valid, goldPerDay: profitPerHour * 24, xpPerDay: xpPerHour * 24, coinsPerXp: xpPerHour > 0 ? -profitPerHour / xpPerHour : null, attempts, protect, cycle, fin };
    if (!full) return numbers;
    const itemIn = base ? { itemHrid: action.itemHrid, count: perCycle, price: itemCost, value: perCycle * itemCost, upgrade: true, owned: base.owned } : null;
    const guardIn = protect ? { itemHrid: protect.itemHrid, count: cycle.protections / attempts, price: protect.price, value: guardValue, protection: true } : null;
    const perAttempt = guardIn ? [...inputs, guardIn] : inputs;
    const sell = fin ? { price: fin.value, source: "decompose", history: true, level: target } : sold;
    const outputs = [{ itemHrid: action.itemHrid, enhancementLevel: target, count: perCycle, kind: "product", price, sell, value: perCycle * price }, ...drops];
    return {
      ...common,
      ...numbers,
      attempts,
      protect: protect ? { ...protect, protections: cycle.protections } : null,
      itemsPerHour: actionsPerHour / attempts * share,
      // The share of the hours spent enhancing; the rest decomposes the +target (finish).
      enhanceShare: share,
      finish: fin,
      sold,
      salesCap,
      outputs,
      inputs: itemIn ? [...perAttempt, itemIn] : perAttempt,
      costPerAttempt: attemptCost,
      dropsPerAttempt,
      revenuePerAction,
      costPerAction,
      profitPerHour,
      margin: revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null,
      mainCount: perCycle,
      xpPerAction,
      xpPerHour
    };
  };
  const results = [];
  const xpPer = rates.map((r, L) => (r + FAIL_XP2 * (1 - r)) * xpAt[L]);
  const atZero = finish(action.itemHrid, 0);
  for (let target = 1; target <= MAX_TARGET; target++) {
    const attempts = cycles.attempts[target];
    if (!Number.isFinite(attempts) || attempts <= 0) break;
    const sold = resale ? resale(action.itemHrid, target) : { price: 0, source: "none", level: null };
    const decomposed = finish(action.itemHrid, target);
    const fin = decomposed && decomposed.value > sold.price ? { ...decomposed, itemFloor: Math.max(0, atZero?.value || 0) } : null;
    const ways = [{ cycle: { attempts, xp: cycles.xp[target], protections: 0 }, protect: null }];
    for (let from = MIN_PROTECT; guard && from < target; from++) {
      const cycle = protectedCycle(rates, blessed, target, from, xpPer);
      if (cycle) ways.push({ cycle, protect: { ...guard, from } });
    }
    let best2 = null;
    for (const f of fin ? [null, fin] : [null]) {
      for (const way of ways) {
        const r = build(target, sold, way.cycle, way.protect, false, f);
        if (!best2 || score(r) > score(best2) + 1e-12) best2 = r;
      }
    }
    results.push(build(target, sold, best2.cycle, best2.protect, true, best2.fin));
  }
  let best = results[0];
  for (const r of results) if (score(r) > score(best) + 1e-12) best = r;
  if (fixedTarget) best = results.find((r) => r.target === Math.min(MAX_TARGET, fixedTarget)) || best;
  best.targets = results.map((r) => ({ target: r.target, attempts: r.attempts, protect: r.protect, goldPerDay: r.goldPerDay, xpPerDay: r.xpPerDay, coinsPerXp: r.coinsPerXp, sell: r.outputs[0].sell, finish: r.finish }));
  return best;
}
function selfEnhanceCosts(itemHrid, who, data, market, starts) {
  const detail = data.itemDetailMap[itemHrid];
  const inputs = detail?.enhancementCosts?.length ? materials(detail, market) : null;
  if (!inputs) return () => null;
  const costPerAttempt = inputs.reduce((sum, i) => sum + i.value, 0);
  const guard = cheapestProtection(detail, market);
  const firsts = [...new Set(starts)].filter((s) => s >= 0 && s < MAX_TARGET);
  const best = /* @__PURE__ */ new Map();
  for (const teas of costTeaSetups(who, data, market)) {
    const { rates, blessed, cycleSeconds } = enhanceRates(who, data, teas, detail.itemLevel || 1);
    const teaPerHour = teas.reduce((sum, hrid) => sum + (market.buy(hrid) ?? 0), 0) * 12 * (who.concentration || 1);
    const perAttempt = costPerAttempt + teaPerHour * cycleSeconds / 3600;
    for (let target = 1; target <= MAX_TARGET; target++) {
      const froms = [target];
      if (guard) for (let from = MIN_PROTECT; from < target; from++) froms.push(from);
      for (const from of froms) {
        const cycles = protectedCycles(rates, blessed, target, from);
        if (!cycles) continue;
        const guarded = from < target;
        for (const start of firsts) {
          if (start >= target) continue;
          const attempts = cycles.attempts[start];
          if (!Number.isFinite(attempts)) continue;
          const protections = guarded ? cycles.protections[start] : 0;
          const cost = attempts * perAttempt + (guarded ? protections * guard.price : 0);
          const key = start * 100 + target;
          const known = best.get(key);
          if (known && known.cost <= cost) continue;
          const hours = attempts * cycleSeconds / 3600;
          best.set(key, { cost, attempts, protections, protect: guarded ? { ...guard, from } : null, teas, hours, drinks: hours * 12 * (who.concentration || 1), materials: inputs });
        }
      }
    }
  }
  return (start, target) => best.get(start * 100 + target) || null;
}
function costTeaSetups(who, data, market) {
  const drinks = who.drinks?.[TYPE2] || [];
  const candidates = usableTeas(data, TYPE2).filter(
    (hrid) => (market.buy(hrid) !== null || drinks.includes(hrid)) && (data.itemDetailMap[hrid]?.consumableDetail?.buffs || []).some((b) => COST_BUFFS.has(b.typeHrid))
  );
  return teaSetups(data, TYPE2, who.slots?.[TYPE2] ?? 1, candidates);
}
var ENHANCING, TYPE2, SKILL2, ENHANCE_FUNCTION, BASE_SECONDS2, MAX_TARGET, BASE_RATES, FAIL_XP2, OBSERVATORY, OBSERVATORY_SUCCESS, SUCCESS, ESSENCE2, MIRROR, MIN_PROTECT, SOLVE, NO_XP, COST_BUFFS;
var init_enhancing = __esm({
  "src/enhancing.js"() {
    init_skilling();
    ENHANCING = "enhancing";
    TYPE2 = "/action_types/enhancing";
    SKILL2 = "/skills/enhancing";
    ENHANCE_FUNCTION = "/action_functions/enhancing";
    BASE_SECONDS2 = 12;
    MAX_TARGET = 20;
    BASE_RATES = [0.5, 0.45, 0.45, 0.4, 0.4, 0.4, 0.35, 0.35, 0.35, 0.35, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.3];
    FAIL_XP2 = 0.1;
    OBSERVATORY = "/house_rooms/observatory";
    OBSERVATORY_SUCCESS = 5e-4;
    SUCCESS = "/buff_types/enhancing_success";
    ESSENCE2 = "/items/enhancing_essence";
    MIRROR = "/items/mirror_of_protection";
    MIN_PROTECT = 2;
    SOLVE = { a: new Float64Array(3 * (MAX_TARGET + 2)), b: new Float64Array(MAX_TARGET + 2), d: new Float64Array(MAX_TARGET + 2) };
    NO_XP = new Array(MAX_TARGET + 2).fill(0);
    COST_BUFFS = /* @__PURE__ */ new Set([SUCCESS, "/buff_types/blessed", "/buff_types/enhancing_level", "/buff_types/action_speed"]);
  }
});

// src/alchemy-chain.js
function stepsFor(itemHrid, who, data, market, teas, cache) {
  if (cache.has(itemHrid)) return cache.get(itemHrid);
  const steps = [];
  const detail = data.itemDetailMap[itemHrid];
  const a = detail?.alchemyDetail;
  if (a) {
    const kinds = [];
    if (a.isCoinifiable && detail.sellPrice > 0) kinds.push("coinify");
    if (a.decomposeItems?.length) kinds.push("decompose");
    if (a.transmuteDropTable?.length && a.transmuteSuccessRate > 0) kinds.push("transmute");
    for (const kind of kinds) {
      const action = { hrid: alchemyHrid(kind, itemHrid), kind, itemHrid, enhancementLevel: 0, levelRequirement: { level: detail.itemLevel || 1 } };
      const r = evaluateAlchemy(action, who, data, market, teas, { itemPrice: 0 });
      const net = r.inputs[0]?.count || 0;
      if (!r.successRate || !(net > 1e-9) || !(r.actionsPerHour > 0)) continue;
      const paid = r.inputs.slice(1).reduce((sum, i) => sum + i.value, 0);
      steps.push({
        kind,
        itemHrid,
        net,
        outputs: r.outputs.map((o) => ({ itemHrid: o.itemHrid, count: o.count })),
        paid,
        hours: 1 / r.actionsPerHour,
        xp: r.xpPerAction,
        catalyst: r.catalyst?.itemHrid || null,
        successRate: r.successRate
      });
    }
  }
  cache.set(itemHrid, steps);
  return steps;
}
function reachable(entry, steps) {
  const seen = /* @__PURE__ */ new Set();
  let frontier = entry.outputs.map((o) => o.itemHrid).filter((h) => h !== COIN2);
  for (let depth = 0; depth < MAX_DEPTH && frontier.length && seen.size < MAX_ITEMS; depth++) {
    const next = [];
    for (const hrid of frontier) {
      if (seen.has(hrid) || seen.size >= MAX_ITEMS) continue;
      seen.add(hrid);
      for (const step of steps(hrid)) for (const o of step.outputs) if (o.itemHrid !== COIN2 && !seen.has(o.itemHrid)) next.push(o.itemHrid);
    }
    frontier = next;
  }
  return [...seen];
}
function choose(items, sell, steps, charge, teaPerHour) {
  const worth = new Map(items.map((h) => [h, sell(h)]));
  const value = (h) => h === COIN2 ? 1 : worth.has(h) ? worth.get(h) : sell(h);
  const choice = /* @__PURE__ */ new Map();
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    let moved = 0;
    for (const h of items) {
      let best = sell(h);
      let pick = null;
      for (const step of steps(h)) {
        const v = (step.outputs.reduce((sum, o) => sum + o.count * value(o.itemHrid), 0) - step.paid - (teaPerHour + charge) * step.hours) / step.net;
        if (v > best + 1e-9) {
          best = v;
          pick = step;
        }
      }
      moved = Math.max(moved, Math.abs(best - worth.get(h)) / Math.max(1, Math.abs(best)));
      worth.set(h, best);
      choice.set(h, pick);
    }
    if (moved < 1e-9) break;
  }
  for (const v of worth.values()) if (!Number.isFinite(v) || v > 1e15) return null;
  return choice;
}
function follow(items, sell, choice) {
  const gold = /* @__PURE__ */ new Map();
  const hours = /* @__PURE__ */ new Map();
  const xp = /* @__PURE__ */ new Map();
  const val = (map, h, sold) => h === COIN2 ? map === gold ? 1 : 0 : map.has(h) ? map.get(h) : sold(h);
  for (const h of items) {
    gold.set(h, sell(h));
    hours.set(h, 0);
    xp.set(h, 0);
  }
  const none = () => 0;
  for (let sweep = 0; sweep < SWEEPS; sweep++) {
    let moved = 0;
    for (const h of items) {
      const step = choice.get(h);
      if (!step) continue;
      const g = (step.outputs.reduce((sum, o) => sum + o.count * val(gold, o.itemHrid, sell), 0) - step.paid) / step.net;
      const t = (step.hours + step.outputs.reduce((sum, o) => sum + o.count * val(hours, o.itemHrid, none), 0)) / step.net;
      const x = (step.xp + step.outputs.reduce((sum, o) => sum + o.count * val(xp, o.itemHrid, none), 0)) / step.net;
      moved = Math.max(moved, Math.abs(g - gold.get(h)) / Math.max(1, Math.abs(g)), Math.abs(t - hours.get(h)) / Math.max(1e-9, t));
      gold.set(h, g);
      hours.set(h, t);
      xp.set(h, x);
    }
    if (moved < 1e-9) break;
  }
  return { gold: (h) => val(gold, h, sell), hours: (h) => val(hours, h, none), xp: (h) => val(xp, h, none) };
}
function flows(entry, items, choice) {
  const amount = /* @__PURE__ */ new Map();
  for (const o of entry.outputs) if (o.itemHrid !== COIN2) amount.set(o.itemHrid, (amount.get(o.itemHrid) || 0) + o.count);
  const actions = /* @__PURE__ */ new Map();
  const sold = /* @__PURE__ */ new Map();
  for (let sweep = 0; sweep < SWEEPS * 4; sweep++) {
    let pushed = false;
    for (const h of [...amount.keys()]) {
      const n = amount.get(h);
      if (n < 1e-12) continue;
      amount.set(h, 0);
      const step = choice.get(h);
      if (!step) {
        sold.set(h, (sold.get(h) || 0) + n);
        continue;
      }
      pushed = true;
      const times = n / step.net;
      actions.set(h, { step, count: (actions.get(h)?.count || 0) + times });
      for (const o of step.outputs) if (o.itemHrid !== COIN2) amount.set(o.itemHrid, (amount.get(o.itemHrid) || 0) + o.count * times);
    }
    if (!pushed) break;
  }
  return { actions: [...actions.values()], sold: [...sold].map(([itemHrid, count]) => ({ itemHrid, count })) };
}
function alchemyChain(entry, who, data, market, caches = /* @__PURE__ */ new Map()) {
  if (!entry?.valid || !(entry.actionsPerHour > 0)) return null;
  const teaKey = entry.teas.join(",");
  if (!caches.has(teaKey)) caches.set(teaKey, /* @__PURE__ */ new Map());
  const cache = caches.get(teaKey);
  const steps = (h) => stepsFor(h, who, data, market, entry.teas, cache);
  const sellCache = /* @__PURE__ */ new Map();
  const sell = (h) => {
    if (h === COIN2) return 1;
    if (!sellCache.has(h)) sellCache.set(h, entry.outputs.find((o) => o.itemHrid === h)?.price ?? market.sell(h).price ?? 0);
    return sellCache.get(h);
  };
  const items = reachable(entry, steps);
  if (!items.some((h) => steps(h).length)) return null;
  const ownHours = 1 / entry.actionsPerHour;
  const ownCost = entry.costPerAction;
  let rate2 = Math.max(0, entry.profitPerHour);
  let result = null;
  let last = null;
  for (let round = 0; round < ROUNDS; round++) {
    const choice2 = choose(items, sell, steps, Math.max(0, rate2), entry.teaPerHour);
    if (!choice2) return null;
    const key = items.map((h) => choice2.get(h)?.kind || "").join("|");
    if (key === last) break;
    last = key;
    const f2 = follow(items, sell, choice2);
    const revenue2 = entry.outputs.reduce((sum, o) => sum + o.count * f2.gold(o.itemHrid), 0);
    const hours2 = ownHours + entry.outputs.reduce((sum, o) => sum + o.count * f2.hours(o.itemHrid), 0);
    const xp2 = entry.xpPerAction + entry.outputs.reduce((sum, o) => sum + o.count * f2.xp(o.itemHrid), 0);
    const profitPerHour2 = (revenue2 - ownCost) / hours2 - entry.teaPerHour;
    result = { choice: choice2, revenue: revenue2, hours: hours2, xp: xp2, profitPerHour: profitPerHour2, f: f2 };
    rate2 = profitPerHour2;
  }
  if (!result || ![...result.choice.values()].some(Boolean) || !(result.profitPerHour > entry.profitPerHour + 1e-9)) return null;
  const { revenue, hours, xp, profitPerHour, choice, f } = result;
  const flow = flows(entry, items, choice);
  const actionsPerHour = 1 / hours;
  const further = flow.actions.map(({ step, count }) => ({ itemHrid: step.itemHrid, kind: step.kind, name: `${ALCHEMY_KINDS[step.kind].name} ${data.itemDetailMap[step.itemHrid]?.name || step.itemHrid}`, count, hours: count * step.hours, catalyst: step.catalyst, successRate: step.successRate })).sort((a, b) => b.hours - a.hours);
  const outputs = entry.outputs.map((o) => choice.get(o.itemHrid) ? { ...o, chainValue: f.gold(o.itemHrid), chainHours: f.hours(o.itemHrid) } : o);
  const goldPerDay = profitPerHour * 24;
  const xpPerHour = xp * actionsPerHour;
  return {
    ...entry,
    single: entry,
    outputs,
    actionsPerHour,
    ownActionsPerHour: entry.actionsPerHour,
    revenuePerAction: revenue,
    profitPerHour,
    goldPerDay,
    margin: revenue > 0 ? (revenue - ownCost - entry.teaPerHour * hours) / revenue : null,
    xpPerAction: xp,
    xpPerHour,
    xpPerDay: xpPerHour * 24,
    coinsPerXp: xpPerHour > 0 ? -profitPerHour / xpPerHour : null,
    alchemyChain: {
      share: ownHours / hours,
      further,
      sold: flow.sold.filter((s) => s.count > 1e-9).sort((a, b) => b.count * sell(b.itemHrid) - a.count * sell(a.itemHrid)),
      singleGoldPerDay: entry.goldPerDay
    }
  };
}
var COIN2, MAX_DEPTH, MAX_ITEMS, SWEEPS, ROUNDS;
var init_alchemy_chain = __esm({
  "src/alchemy-chain.js"() {
    init_alchemy();
    COIN2 = "/items/coin";
    MAX_DEPTH = 6;
    MAX_ITEMS = 150;
    SWEEPS = 60;
    ROUNDS = 8;
  }
});

// src/skilling.js
var skilling_exports = {};
__export(skilling_exports, {
  ASK_WINDOW: () => ASK_WINDOW,
  CALM_SWING: () => CALM_SWING,
  DRINKS_PER_HOUR: () => DRINKS_PER_HOUR,
  INPUT_BOOK_HOURS: () => INPUT_BOOK_HOURS,
  LEVELING_SKILLS: () => LEVELING_SKILLS,
  LIQUIDITY: () => LIQUIDITY,
  MARKET_TAX: () => MARKET_TAX,
  NEAR_LEVELS: () => NEAR_LEVELS,
  PLAN_MODES: () => PLAN_MODES,
  REUSED_MARKET: () => REUSED_MARKET,
  RISKY_MARGIN: () => RISKY_MARGIN,
  SALES_DAYS: () => SALES_DAYS,
  SHORTLIST: () => SHORTLIST,
  SKILLING_SKILLS: () => SKILLING_SKILLS,
  WIDE_SPREAD: () => WIDE_SPREAD,
  bestTeas: () => bestTeas,
  coinsPerXp: () => coinsPerXp,
  daily: () => daily,
  decomposeCraft: () => decomposeCraft,
  decomposeFinisher: () => decomposeFinisher,
  drinkSlots: () => drinkSlots,
  enhanceBudget: () => enhanceBudget,
  evaluateAction: () => evaluateAction,
  heldStock: () => heldStock,
  heldValue: () => heldValue,
  levelProgress: () => levelProgress,
  liquidityRating: () => liquidityRating,
  marketPricer: () => marketPricer,
  rankSkilling: () => rankSkilling,
  salesLimited: () => salesLimited,
  skillType: () => skillType,
  skillingActions: () => skillingActions,
  skillingCharacter: () => skillingCharacter,
  suggestChainCount: () => suggestChainCount,
  suggestCount: () => suggestCount,
  swingShare: () => swingShare,
  teaBuffs: () => teaBuffs,
  teaPurchase: () => teaPurchase,
  teaSetups: () => teaSetups,
  thinMargin: () => thinMargin,
  totals: () => totals,
  usableTeas: () => usableTeas
});
function skillingCharacter(character, items, data) {
  const levels = {};
  const experience = {};
  for (const skill of character.characterSkills || []) {
    levels[skill.skillHrid] = skill.level;
    experience[skill.skillHrid] = skill.experience ?? null;
  }
  levels[TOTAL_LEVEL] ??= Object.values(levels).reduce((sum, level) => sum + (Number(level) || 0), 0);
  const known = BUFF_SOURCES.filter((key) => character[key]);
  let buffs = null;
  if (known.length) {
    buffs = {};
    for (const key of known) {
      for (const [type, list] of Object.entries(character[key] || {})) {
        if (Array.isArray(list)) (buffs[type] ||= []).push(...list);
      }
    }
  }
  const drinks = {};
  const slots = {};
  const pouch = [...items.values()].find((item) => item.itemLocationHrid === POUCH && item.itemHrid)?.itemHrid || null;
  const pouchSlots = drinkSlots(pouch, data);
  for (const skill of [...SKILLING_SKILLS, ...LEVELING_SKILLS]) {
    const list = character.actionTypeDrinkSlotsMap?.[skillType(skill)];
    drinks[skillType(skill)] = (list || []).map((slot2) => slot2?.itemHrid).filter(Boolean);
    slots[skillType(skill)] = Math.max(pouchSlots, drinks[skillType(skill)].length);
  }
  const sources = Object.fromEntries(known.map((key) => [key, character[key]]));
  const equipped = [...items.values()].filter((item) => item.itemHrid && item.itemLocationHrid !== INVENTORY).map((item) => ({ itemHrid: item.itemHrid, enhancementLevel: item.enhancementLevel || 0 }));
  const houseLevels = {};
  for (const [hrid, room] of Object.entries(character.characterHouseRoomMap || {})) houseLevels[hrid] = room?.level || 0;
  return { levels, experience, buffs, drinks, slots, pouch, concentration: drinkConcentration(character, items, data), sources, equipped, houseLevels };
}
function drinkSlots(pouchHrid, data) {
  return 1 + (data.itemDetailMap[pouchHrid]?.equipmentDetail?.combatStats?.drinkSlots || 0);
}
function drinkConcentration(character, items, data) {
  const given = Number(character.noncombatStats?.drinkConcentration);
  if (Number.isFinite(given)) return 1 + Math.max(0, given);
  const multipliers = data.enhancementLevelTotalBonusMultiplierTable || [];
  let total = 0;
  for (const item of items.values()) {
    if (!item.itemHrid || item.itemLocationHrid === INVENTORY) continue;
    const detail = data.itemDetailMap[item.itemHrid]?.equipmentDetail;
    const base = detail?.noncombatStats?.drinkConcentration || 0;
    const bonus = detail?.noncombatEnhancementBonuses?.drinkConcentration || 0;
    total += base + bonus * (multipliers[item.enhancementLevel || 0] || 0);
  }
  return 1 + total;
}
function skillingActions(data) {
  const types = new Set(SKILLING_SKILLS.map(skillType));
  return Object.values(data.actionDetailMap).filter((action) => types.has(action.type) && action.levelRequirement && /\/(gathering|production)$/.test(action.function)).sort((a, b) => a.levelRequirement.level - b.levelRequirement.level || a.sortIndex - b.sortIndex);
}
function processedProducts(data) {
  let map = processingCache.get(data);
  if (map) return map;
  map = /* @__PURE__ */ new Map();
  for (const action of Object.values(data.actionDetailMap)) {
    if (!/(fabric|lumber|cheese)$/.test(action.hrid)) continue;
    const input = action.inputItems?.[0];
    const output = action.outputItems?.[0];
    if (input?.count > 0 && output) map.set(input.itemHrid, { itemHrid: output.itemHrid, inputCount: input.count });
  }
  processingCache.set(data, map);
  return map;
}
function usableTeas(data, type) {
  let byType = teasByData.get(data);
  if (!byType) teasByData.set(data, byType = /* @__PURE__ */ new Map());
  if (!byType.has(type)) {
    byType.set(type, Object.values(data.itemDetailMap).filter((item) => item.consumableDetail?.usableInActionTypeMap?.[type] && item.consumableDetail.buffs?.length && !item.consumableDetail.usableInActionTypeMap["/action_types/combat"]).map((item) => item.hrid));
  }
  return byType.get(type).slice();
}
function totals(buffs) {
  const sum = /* @__PURE__ */ new Map();
  for (const buff of buffs) {
    const entry = sum.get(buff.typeHrid) || { flat: 0, ratio: 0 };
    entry.flat += Number(buff.flatBoost) || 0;
    entry.ratio += Number(buff.ratioBoost) || 0;
    sum.set(buff.typeHrid, entry);
  }
  return (type) => sum.get(type) || { flat: 0, ratio: 0 };
}
function teaBuffs(teas, concentration, data) {
  const list = [];
  for (const hrid of teas) {
    for (const buff of data.itemDetailMap[hrid]?.consumableDetail?.buffs || []) {
      list.push({ typeHrid: buff.typeHrid, flatBoost: (buff.flatBoost || 0) * concentration, ratioBoost: (buff.ratioBoost || 0) * concentration });
    }
  }
  return list;
}
function marketPricer(entryOf, data, sellAt = "ask", usualAsk = () => null, soldOf = () => null) {
  const cache = /* @__PURE__ */ new Map();
  const contents = (hrid) => (data.openableLootDropMap?.[hrid] || []).reduce((sum, drop) => sum + meanCount2(drop) * (drop.itemHrid === hrid ? 0 : this_.sell(drop.itemHrid).price), 0);
  const vendor = (hrid) => data.itemDetailMap[hrid]?.sellPrice || 0;
  const tradable = (hrid) => !!data.itemDetailMap[hrid]?.isTradable;
  const this_ = {
    buy(hrid) {
      if (hrid === "/items/coin") return 1;
      const entry = tradable(hrid) ? entryOf(hrid) : null;
      return entry?.a > 0 ? entry.a : null;
    },
    sell(hrid) {
      if (cache.has(hrid)) return cache.get(hrid);
      const entry = tradable(hrid) && entryOf(hrid) || {};
      const ask = entry.a > 0 ? entry.a : null;
      const bid = entry.b > 0 ? entry.b : null;
      const tax = hrid === "/items/bag_of_10_cowbells" ? COWBELL_BAG_TAX : MARKET_TAX;
      cache.set(hrid, { price: 0 });
      let result;
      if (hrid === "/items/coin") result = { price: 1, ask: 1, bid: 1, source: "coin" };
      else if (hrid === "/items/cowbell") result = { ...this_.sell("/items/bag_of_10_cowbells"), source: "bag" };
      else if (!ask && !bid && data.openableLootDropMap?.[hrid]) result = { price: contents(hrid), ask, bid, source: "contents" };
      else if (sellAt === "ask" && ask) {
        const usual = usualAsk(hrid);
        const ceiling = usual > 0 ? usual : bid ? WIDE_SPREAD * bid : Infinity;
        result = { price: Math.min(ask, ceiling) * (1 - tax), ask, bid, source: "ask", capped: ask > ceiling ? usual > 0 ? "usual" : "spread" : null, note: bid ? ask > WIDE_SPREAD * bid ? "spread" : null : "nobids" };
      } else if (bid) result = { price: bid * (1 - tax), ask, bid, source: "bid", note: sellAt === "ask" ? "noasks" : null };
      else if (ask) result = { price: ask * (1 - tax), ask, bid, source: "ask", note: "nobids" };
      else result = { price: vendor(hrid), ask, bid, source: "vendor", note: vendor(hrid) ? "vendor" : "unsellable" };
      if (result.source === "bag") result = { ...result, price: result.price / 10, sold: void 0, floor: void 0 };
      if (result.source === "ask" || result.source === "bid") {
        result.sold = soldOf(hrid);
        const floor = result.source === "ask" && bid ? bid * (1 - tax) : vendor(hrid);
        result.floor = Math.min(floor, result.price);
      }
      cache.set(hrid, result);
      return result;
    }
  };
  return this_;
}
function salesLimited(sell, made) {
  if (!Number.isFinite(sell.sold) || sell.sold < 0 || sell.floor === void 0 || !(made > sell.sold)) return { price: sell.price, salesCap: null };
  const share = sell.sold / made;
  return { price: share * sell.price + (1 - share) * sell.floor, salesCap: { perDay: sell.sold, made, floor: sell.floor } };
}
function evaluateAction(action, who, data, market, teas = who.drinks[action.type] || [], level = who.levels[action.levelRequirement.skillHrid] ?? 1) {
  const skill = action.levelRequirement.skillHrid;
  const buff = totals([...who.buffs?.[action.type] || [], ...teaBuffs(teas, who.concentration, data)]);
  const fraction = (type) => buff(type).flat + buff(type).ratio;
  const levelBuff = buff(`/buff_types/${skillName(skill)}_level`);
  const effectiveLevel = (1 + levelBuff.ratio) * level + levelBuff.flat;
  const requiredLevel = action.levelRequirement.level + buff(BUFF.actionLevel).flat;
  const levelEfficiency = Math.max(0, effectiveLevel - requiredLevel) / 100;
  const efficiency = buff(BUFF.efficiency).flat + levelEfficiency;
  const speed = fraction(BUFF.speed);
  const baseSeconds = action.baseTimeCost / 1e9;
  const cycleSeconds = Math.max(MIN_CYCLE_SECONDS2, baseSeconds / (1 + speed));
  const actionsPerHour = 3600 / cycleSeconds * (1 + efficiency);
  const quantity = Math.max(0, fraction(BUFF.gathering) + fraction(BUFF.gourmet));
  const processing = Math.min(1, Math.max(0, fraction(BUFF.processing)));
  const artisan = Math.min(1, Math.max(0, fraction(BUFF.artisan)));
  const products = processing > 0 ? processedProducts(data) : null;
  const outputs = [];
  const addOutput = (itemHrid, count, kind) => {
    if (count <= 0) return;
    const sell = market.sell(itemHrid);
    const { price, salesCap } = salesLimited(sell, count * actionsPerHour * HOURS_PER_DAY);
    outputs.push({ itemHrid, count, kind, price, sell, value: count * price, salesCap });
  };
  const base = action.outputItems?.length ? action.outputItems.map((o) => ({ itemHrid: o.itemHrid, count: o.count })) : (action.dropTable || []).map((d) => ({ itemHrid: d.itemHrid, count: meanCount2(d) }));
  for (const output of base) {
    const count = output.count * (1 + quantity);
    const processed = products?.get(output.itemHrid);
    addOutput(output.itemHrid, processed ? count * (1 - processing) : count, "product");
    if (processed) addOutput(processed.itemHrid, count * processing / processed.inputCount, "processed");
  }
  for (const drop of action.essenceDropTable || []) addOutput(drop.itemHrid, meanCount2(drop) * (1 + fraction(BUFF.essence)), "essence");
  for (const drop of action.rareDropTable || []) addOutput(drop.itemHrid, meanCount2(drop) * (1 + fraction(BUFF.rare)), "rare");
  const inputs = (action.inputItems || []).map((input) => ({ itemHrid: input.itemHrid, count: input.count * (1 - artisan) }));
  if (action.upgradeItemHrid) inputs.push({ itemHrid: action.upgradeItemHrid, count: 1, upgrade: true });
  const missing = [];
  for (const input of inputs) {
    input.price = market.buy(input.itemHrid);
    if (input.price === null) missing.push(input.itemHrid);
    input.value = input.count * (input.price || 0);
  }
  const drinksPerHour = DRINKS_PER_HOUR * who.concentration;
  const teaCosts = teas.map((hrid) => {
    const price = market.buy(hrid) ?? market.sell(hrid).bid ?? 0;
    return { itemHrid: hrid, price, perHour: price * drinksPerHour };
  });
  const revenuePerAction = outputs.reduce((sum, o) => sum + o.value, 0);
  const costPerAction = inputs.reduce((sum, i) => sum + i.value, 0);
  const teaPerHour = teaCosts.reduce((sum, t) => sum + t.perHour, 0);
  const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
  const margin = revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null;
  const xpPerAction = (action.experienceGain?.value || 0) * (1 + fraction(BUFF.wisdom));
  const main2 = outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0] || null;
  const warnings = [];
  if (missing.length) warnings.push({ kind: "noinput", items: missing });
  if (main2 && main2.sell.note) warnings.push({ kind: main2.sell.note, itemHrid: main2.itemHrid, ask: main2.sell.ask, bid: main2.sell.bid });
  if (costPerAction > 0 && profitPerHour > 0 && margin < RISKY_MARGIN) warnings.push({ kind: "margin", margin });
  return {
    action,
    hrid: action.hrid,
    skill,
    teas,
    level,
    requiredLevel,
    effectiveLevel,
    efficiency,
    levelEfficiency,
    speed,
    baseSeconds,
    cycleSeconds,
    actionsPerHour,
    quantity,
    artisan,
    processing,
    outputs,
    inputs,
    teaCosts,
    drinksPerHour,
    revenuePerAction,
    costPerAction,
    teaPerHour,
    profitPerHour,
    margin,
    mainCount: main2?.count || 0,
    salesCap: main2?.salesCap || null,
    xpPerAction,
    xpPerHour: actionsPerHour * xpPerAction,
    valid: missing.length === 0 && !!main2 && main2.sell.note !== "unsellable",
    warnings,
    buffsKnown: !!who.buffs
  };
}
function teaSetups(data, type, slots, candidates) {
  const unique = (hrid) => data.itemDetailMap[hrid]?.consumableDetail?.buffs?.[0]?.uniqueHrid || hrid;
  const setups = [[]];
  const grow = (start, chosen) => {
    if (chosen.length >= slots) return;
    for (let i = start; i < candidates.length; i++) {
      if (chosen.some((hrid) => unique(hrid) === unique(candidates[i]))) continue;
      const next = [...chosen, candidates[i]];
      setups.push(next);
      grow(i + 1, next);
    }
  };
  grow(0, []);
  return setups;
}
function bestTeas(action, who, data, market, evaluate, score = (r) => r.goldPerDay) {
  const type = action.type;
  const candidates = usableTeas(data, type).filter((hrid) => market.buy(hrid) !== null || (who.drinks[type] || []).includes(hrid));
  let best = null;
  for (const teas of teaSetups(data, type, who.slots[type], candidates)) {
    const result = evaluate(teas, score);
    if (!best || score(result) > score(best) + 1e-12) best = result;
  }
  const worth = best.teas.map((hrid) => {
    const without = evaluate(best.teas.filter((t) => t !== hrid), score);
    return { itemHrid: hrid, gainPerDay: best.goldPerDay - without.goldPerDay, xpPerDay: best.xpPerDay - without.xpPerDay };
  });
  return { result: best, worth };
}
function focusScore(goldWeight, refs, xpOf = XP_PER_DAY) {
  return (r) => goldWeight * r.goldPerDay / refs.gold + (1 - goldWeight) * xpOf(r) / refs.xp;
}
function levelProgress(who, data, countLevels) {
  const table = data.levelExperienceTable;
  if (!countLevels || !Array.isArray(table)) return XP_PER_DAY;
  return (r) => {
    const level = who.levels[r.skill] ?? 1;
    return levelsPerDay(table, experienceOf(table, who.experience[r.skill], level), r.xpPerDay);
  };
}
function timeMoneyScore(goldWeight, refs, xpOf = XP_PER_DAY) {
  const costScale = Math.max(1e-9, Math.abs(Number.isFinite(refs.cost) ? refs.cost : 1));
  return (r) => {
    const xp = xpOf(r);
    return xp > 0 && r.valid !== false ? -(goldWeight * -r.goldPerDay / xp / costScale + (1 - goldWeight) * refs.xp / xp) : -Infinity;
  };
}
function teaPurchase(entry, { hours, have = () => 0 }) {
  const teas = entry.best.result.teas;
  if (!teas.length || !(hours > 0)) return null;
  const perTea = Math.ceil(hours * entry.best.result.drinksPerHour);
  const items = teas.map((hrid) => ({ hrid, quantity: perTea - have(hrid), have: have(hrid) })).filter((item) => item.quantity > 0);
  return { hours, perTea, items };
}
function heldStock(character, items, itemHrid) {
  let inventory = 0;
  for (const item of items.values()) {
    if (item.itemHrid === itemHrid && item.itemLocationHrid === INVENTORY && !item.enhancementLevel) inventory += item.count || 0;
  }
  let listed = 0;
  const listings = [];
  for (const listing of character.myMarketListings || []) {
    if (listing.itemHrid !== itemHrid || !listing.isSell || listing.enhancementLevel) continue;
    const quantity = Math.max(0, (listing.orderQuantity || 0) - (listing.filledQuantity || 0));
    listed += quantity;
    listings.push({ price: Number(listing.price) || 0, quantity });
  }
  return { inventory, listed, listings };
}
function othersNearLowestAsk(book, stock) {
  if (!book?.asks.length) return { quantity: 0, lowest: null };
  const lowest = Math.min(...book.asks.map((o) => o.price));
  const top = lowest * (1 + ASK_WINDOW);
  const near = book.asks.filter((o) => o.price <= top).reduce((sum, o) => sum + o.quantity, 0);
  const mine = (stock.listings || []).filter((l) => l.price > 0 && l.price <= top).reduce((sum, l) => sum + l.quantity, 0);
  return { quantity: Math.max(0, near - mine), lowest };
}
function breakEvenPrice(entry) {
  const main2 = entry.outputs.filter((o) => o.kind === "product").sort((a, b) => b.value - a.value)[0];
  if (!main2) return null;
  const others = entry.revenuePerAction - main2.value;
  return (entry.costPerAction + entry.teaPerHour / entry.actionsPerHour - others) / main2.count / (1 - MARKET_TAX);
}
function liquidityRating(summary) {
  const l = summary?.liquidity;
  const swing = summary?.a?.swing;
  if (!l || l.hours < LIQUIDITY_HOURS || l.spread === null || swing === null) return { rating: "thin", known: false, ...l, swing: swing ?? null };
  const sales = l.sold?.enough ? l.sold.selling : null;
  const meets = (t) => l.both >= t.both && l.spread <= t.spread && swing <= t.swing && (sales !== null ? sales >= t.selling : l.activity >= t.activity);
  return { rating: meets(LIQUIDITY.stable) ? "stable" : meets(LIQUIDITY.ok) ? "ok" : "thin", known: true, ...l, swing };
}
function thinMargin(entry, swing = null) {
  if (!(entry.costPerAction > 0) || entry.margin === null || !(entry.profitPerHour > 0)) return false;
  return entry.margin < RISKY_MARGIN || swing > CALM_SWING && entry.margin < swing;
}
function unitsToMake(planned, daySales, held) {
  const room = Number.isFinite(daySales) ? daySales - held : planned - held;
  return Math.max(0, Math.min(planned, room));
}
function swingShare(price) {
  if (!price || !(price.swing > 0)) return null;
  const bySwing = Math.min(1, Math.max(MIN_SWING_SHARE, 1 - 2 * (price.swing - CALM_SWING)));
  const high = price.diff !== null && price.diff > PRICE_BAND && price.swing > CALM_SWING;
  const low = price.diff !== null && price.diff < -PRICE_BAND;
  return { swing: price.swing, diff: price.diff, bySwing, high, low, share: bySwing * (high ? HIGH_PRICE_SHARE : 1) };
}
function suggestCount(entry, { stock, book = null, hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, hideThinMargins = false, coins = Infinity, have = () => 0, heldPrice = null, sellAt = "ask", price = null, liquidity = null, inputMarket = null, now: now2 = Date.now() }) {
  if (entry.action.function !== "/action_functions/production" && entry.action.function !== ALCHEMY_FUNCTION || !entry.valid || !entry.mainCount) return null;
  const breakEven = breakEvenPrice(entry);
  const profitableBids = book ? book.bids.filter((o) => o.price >= breakEven).reduce((sum, o) => sum + o.quantity, 0) : null;
  const asks = book && sellAt === "ask" ? othersNearLowestAsk(book, stock) : null;
  const product = liquidity || { rating: "thin", known: false };
  const planned = Math.max(1, Math.floor(hours * entry.actionsPerHour));
  const plannedUnits = Math.min(planned * entry.mainCount, salesDay(product));
  const held = stock.inventory + stock.listed;
  const units = unitsToMake(planned * entry.mainCount, salesDay(product), held);
  let count = Math.max(0, Math.ceil(units / entry.mainCount - 1e-9));
  let short = units < planned * entry.mainCount ? units < plannedUnits ? "held" : "sales" : null;
  const swing = swingShare(price);
  if (swing && swing.share < 1) {
    const before = count;
    count = Math.ceil(count * swing.share);
    if (count < before) short = "swing";
  }
  const haveOf = (input) => have(input.itemHrid, input.enhancementLevel || 0);
  const toBuy = (input, n) => input.itemHrid === COIN3 ? input.count * n : Math.max(0, input.count * n - haveOf(input));
  const minMargin = hideThinMargins ? Math.max(RISKY_MARGIN, price?.swing > CALM_SWING ? price.swing : 0) : 0;
  const limitMargin = Math.max(RISKY_MARGIN, minMargin);
  for (const input of entry.inputs) {
    if (input.forSale !== false || !(input.count > 0)) continue;
    const most = Math.floor(haveOf(input) / input.count + 1e-9);
    if (most < count) {
      count = most;
      short = "owned";
    }
  }
  const bought = entry.inputs.filter((input) => input.itemHrid !== COIN3 && input.forSale !== false && input.count > 0 && input.price > 0 && toBuy(input, count) > 0);
  const profitPerAction = entry.profitPerHour / entry.actionsPerHour;
  const inputs = bought.map((input) => {
    const market = inputMarket?.(input.itemHrid, input.enhancementLevel || 0) || {};
    const fresh = market.book && now2 - market.book.at <= INPUT_BOOK_HOURS * 36e5 ? market.book : null;
    const asks2 = fresh ? [...fresh.asks].filter((o) => o.price > 0 && o.quantity > 0).sort((a, b) => a.price - b.price) : null;
    const maxPrice = asks2?.length ? Math.max(asks2[0].price, input.price + (profitPerAction - minMargin * entry.revenuePerAction) / input.count) : null;
    const limitPrice = input.price + (profitPerAction - limitMargin * entry.revenuePerAction) / input.count;
    const usable = asks2 ? asks2.filter((o) => o.price <= maxPrice + 1e-9) : null;
    const listed = usable ? usable.reduce((sum, o) => sum + o.quantity, 0) : null;
    return {
      itemHrid: input.itemHrid,
      perAction: input.count,
      price: input.price,
      liquidity: market.liquidity || null,
      nearAsks: listed,
      lowestAsk: asks2?.[0]?.price ?? null,
      maxPrice,
      limitPrice,
      asks: usable,
      bookAt: fresh?.at ?? null,
      enhancementLevel: input.enhancementLevel || 0,
      maxCount: usable ? Math.floor((haveOf(input) + listed) / input.count + 1e-9) : Infinity
    };
  });
  let limitedByListing = null;
  for (const input of inputs) {
    if (!(input.enhancementLevel > 0) || input.asks) continue;
    const most = Math.floor((haveOf({ itemHrid: input.itemHrid, enhancementLevel: input.enhancementLevel }) + 1) / input.perAction + 1e-9);
    input.oneListed = true;
    if (most < count) {
      count = most;
      limitedByListing = input.itemHrid;
      short = "onelisted";
    }
  }
  const booked = new Map(inputs.filter((i) => i.asks).map((i) => [i.itemHrid, i.asks]));
  const cost = (input, units2) => {
    const asks2 = booked.get(input.itemHrid);
    if (!asks2?.length) return units2 * (input.price || 0);
    let left = units2;
    let sum = 0;
    for (const o of asks2) {
      const take = Math.min(left, o.quantity);
      sum += take * o.price;
      left -= take;
      if (left <= 0) break;
    }
    return sum + Math.max(0, left) * asks2[asks2.length - 1].price;
  };
  const spend = (n) => entry.inputs.reduce((sum, input) => sum + (input.forSale === false ? 0 : cost(input, toBuy(input, n))), 0);
  let limitedByBook = null;
  for (const input of inputs) {
    if (input.maxCount < count) {
      count = input.maxCount;
      limitedByBook = input.itemHrid;
      short = "book";
    }
  }
  let rating = product;
  let ratedBy = null;
  for (const input of inputs) {
    if (inputMarket && RATING_ORDER[input.liquidity?.rating ?? "thin"] < RATING_ORDER[rating.rating]) {
      rating = input.liquidity || { rating: "thin", known: false };
      ratedBy = input.itemHrid;
    }
  }
  const share = coinShare[rating.rating] ?? coinShare.thin;
  const budget = coins * share;
  let limitedByCoins = false;
  if (spend(count) > budget) {
    let low = 0;
    let high = count;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (spend(mid) <= budget) low = mid;
      else high = mid - 1;
    }
    count = low;
    limitedByCoins = true;
    short = "coins";
  }
  const jobHours = count / entry.actionsPerHour;
  const aboveAsk = spend(count) - entry.inputs.reduce((sum, input) => sum + (input.forSale === false ? 0 : toBuy(input, count) * (input.price || 0)), 0);
  const fromStock = heldUse(entry, count, have, heldPrice);
  const batch = {
    materials: count * entry.costPerAction + aboveAsk - fromStock.saving,
    aboveAsk,
    heldSaving: fromStock.saving,
    heldValue: fromStock.value,
    toBuy: spend(count),
    revenue: count * entry.revenuePerAction,
    teas: entry.teaPerHour * jobHours
  };
  batch.profit = batch.revenue - batch.materials - batch.teas;
  return {
    known: true,
    breakEven,
    profitableBids,
    nearAsks: asks?.quantity ?? null,
    lowestAsk: asks?.lowest ?? null,
    bookAt: book?.at ?? null,
    stock,
    held,
    heldOff: Math.max(0, plannedUnits - units),
    plannedHours: hours,
    plannedUnits,
    short,
    cappedBySales: plannedUnits < planned * entry.mainCount,
    liquidity: rating,
    productLiquidity: product,
    ratedBy,
    inputs: inputs.map(({ asks: asks2, ...input }) => {
      const units2 = Math.max(0, Math.ceil(input.perAction * count - have(input.itemHrid, input.enhancementLevel) - 1e-9));
      return { ...input, toBuy: units2, averagePrice: units2 > 0 ? cost(input, units2) / units2 : null };
    }),
    minMargin,
    limitMargin,
    limitedByBook,
    limitedByListing,
    coinShare: share,
    budget,
    count,
    hours: jobHours,
    fill: Math.min(1, jobHours / hours),
    batch,
    swing,
    limitedByCoins
  };
}
function heldValue(market, data, hrid) {
  if (hrid === COIN3) return 1;
  const bid = market.sell(hrid).bid;
  const value = bid > 0 ? bid * (1 - MARKET_TAX) : data.itemDetailMap[hrid]?.sellPrice || 0;
  const ask = market.buy(hrid);
  return ask === null ? value : Math.min(ask, value);
}
function heldUse(entry, n, have, heldPrice) {
  let value = 0;
  let saving = 0;
  if (!heldPrice) return { value, saving };
  for (const input of entry.inputs) {
    if (input.itemHrid === COIN3 || !(input.count > 0)) continue;
    const level = input.enhancementLevel || 0;
    const used = Math.min(have(input.itemHrid, level), input.count * n);
    if (!(used > 0)) continue;
    const worth = heldPrice(input.itemHrid, level);
    value += used * worth;
    saving += used * Math.max(0, (input.price || 0) - worth);
  }
  return { value, saving };
}
function enhanceBudget(entry, { hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, coins = Infinity, inputMarket = null }) {
  if (!entry.valid || entry.action.function !== ENHANCE_FUNCTION) return null;
  const rating = inputMarket?.(entry.action.itemHrid)?.liquidity || { rating: "thin", known: false };
  const share = coinShare[rating.rating] ?? coinShare.thin;
  const budget = coins * share;
  const item = entry.base.owned ? 0 : entry.base.price;
  const perHour = (entry.costPerAttempt * entry.actionsPerHour + entry.teaPerHour) * (entry.enhanceShare ?? 1);
  const fill2 = item > budget ? 0 : perHour > 0 ? Math.min(1, (budget - item) / (perHour * hours)) : 1;
  return { rating, share, budget, item, perHour, need: item + perHour * hours, fill: fill2, hours: fill2 * hours, plannedHours: hours };
}
function suggestChainCount(entry, chain, { stock, hours = PLAN_MODES.away.hours, coinShare = PLAN_MODES.away.coinShare, coins = Infinity, price = null, liquidity = null, inputMarket = null }) {
  if (!chain || !entry.mainCount || chain.profitPerHour <= 0) return null;
  const planned = Math.max(1, Math.floor(hours / chain.hoursPerAction));
  const held = stock.inventory + stock.listed;
  const units = unitsToMake(planned * entry.mainCount, salesDay(liquidity), held);
  const heldOff = Math.max(0, Math.min(planned * entry.mainCount, salesDay(liquidity)) - units);
  let count = Math.max(0, Math.ceil(units / entry.mainCount - 1e-9));
  const swing = swingShare(price);
  if (swing && swing.share < 1) count = Math.ceil(count * swing.share);
  let rating = liquidity || { rating: "thin", known: false };
  let ratedBy = null;
  for (const hrid of inputMarket ? chain.bought : []) {
    const own = inputMarket(hrid)?.liquidity || { rating: "thin", known: false };
    if (RATING_ORDER[own.rating] < RATING_ORDER[rating.rating]) {
      rating = own;
      ratedBy = hrid;
    }
  }
  const share = coinShare[rating.rating] ?? coinShare.thin;
  const budget = coins * share;
  const limitedByCoins = chain.cashPerAction > 0 && count * chain.cashPerAction > budget;
  if (limitedByCoins) count = Math.floor(budget / chain.cashPerAction);
  return { count, hours: count * chain.hoursPerAction, cash: count * chain.cashPerAction, liquidity: rating, ratedBy, coinShare: share, budget, limitedByCoins, held, heldOff };
}
function chainBuilder(who, data, market, teaMode) {
  const sources = /* @__PURE__ */ new Map();
  for (const action of skillingActions(data)) {
    const made = action.outputItems?.length ? action.outputItems.map((o) => o.itemHrid) : (action.dropTable || []).map((d) => d.itemHrid);
    for (const hrid of made) {
      if (!sources.has(hrid)) sources.set(hrid, []);
      sources.get(hrid).push(action);
    }
  }
  const runs = /* @__PURE__ */ new Map();
  const run = (action) => {
    if (!runs.has(action.hrid)) {
      const plain = (teas) => daily(evaluateAction(action, who, data, market, teas));
      runs.set(action.hrid, teaMode === "best" ? bestTeas(action, who, data, market, plain).result : plain(who.drinks[action.type] || []));
    }
    return runs.get(action.hrid);
  };
  const units = /* @__PURE__ */ new Map();
  const selfMade = (itemHrid, seen) => {
    if (units.has(itemHrid)) return units.get(itemHrid);
    if (seen.has(itemHrid)) return null;
    let best = null;
    for (const action of sources.get(itemHrid) || []) {
      if ((who.levels[action.levelRequirement.skillHrid] ?? 1) < action.levelRequirement.level) continue;
      const r = run(action);
      const out = r.outputs.find((o) => o.itemHrid === itemHrid && o.kind === "product");
      if (!out || out.count <= 0) continue;
      const inner = materials2(r, /* @__PURE__ */ new Set([...seen, itemHrid]));
      if (!inner) continue;
      const ownHours = 1 / (r.actionsPerHour * out.count);
      const unit = {
        itemHrid,
        action,
        cost: (inner.cost + r.teaPerHour / r.actionsPerHour - (r.revenuePerAction - out.value)) / out.count,
        ownHours,
        hours: ownHours + inner.hours / out.count,
        steps: inner.steps.map((step) => ({ ...step, count: step.count / out.count }))
      };
      if (!best || unit.hours < best.hours) best = unit;
    }
    units.set(itemHrid, best);
    return best;
  };
  const materials2 = (r, seen) => {
    let cost = 0;
    let hours = 0;
    const steps = [];
    for (const input of r.inputs) {
      const made = selfMade(input.itemHrid, seen);
      if (made) {
        cost += made.cost * input.count;
        hours += made.hours * input.count;
        steps.push({ itemHrid: input.itemHrid, count: input.count, made });
      } else if (input.price === null) {
        return null;
      } else {
        cost += input.value;
        steps.push({ itemHrid: input.itemHrid, count: input.count, price: input.price });
      }
    }
    return { cost, hours, steps };
  };
  const timeShares = (steps, factor, out) => {
    for (const step of steps) {
      if (!step.made) continue;
      const share = out.get(step.itemHrid) || { itemHrid: step.itemHrid, action: step.made.action, count: 0, hours: 0 };
      share.count += step.count * factor;
      share.hours += step.made.ownHours * step.count * factor;
      out.set(step.itemHrid, share);
      timeShares(step.made.steps, step.count * factor, out);
    }
    return out;
  };
  const boughtItems = (steps, out) => {
    for (const step of steps) {
      if (step.made) boughtItems(step.made.steps, out);
      else out.add(step.itemHrid);
    }
    return out;
  };
  return (entry) => {
    if (entry.action.function !== "/action_functions/production" || !entry.valid) return null;
    const inner = materials2(entry, /* @__PURE__ */ new Set([entry.action.outputItems?.[0]?.itemHrid]));
    if (!inner || !inner.steps.some((step) => step.made)) return null;
    const craftHours = 1 / entry.actionsPerHour;
    const hours = craftHours + inner.hours;
    const profit = entry.revenuePerAction - inner.cost - entry.teaPerHour / entry.actionsPerHour;
    return {
      hoursPerAction: hours,
      craftShare: craftHours / hours,
      shares: [...timeShares(inner.steps, 1, /* @__PURE__ */ new Map()).values()].map((share) => ({ ...share, share: share.hours / hours })),
      bought: [...boughtItems(inner.steps, /* @__PURE__ */ new Set())],
      profitPerHour: profit / hours,
      goldPerDay: profit / hours * HOURS_PER_DAY,
      cashPerAction: inner.cost
    };
  };
}
function decomposeFinisher(who, data, market) {
  const cache = /* @__PURE__ */ new Map();
  const teas = who.drinks?.["/action_types/alchemy"] || [];
  return (itemHrid, level) => {
    const key = `${itemHrid}#${level}`;
    if (cache.has(key)) return cache.get(key);
    let fin = null;
    const detail = data.itemDetailMap[itemHrid];
    if (level >= 0 && decomposesEnhanced(detail) && who.levels?.["/skills/alchemy"] !== void 0) {
      const r = evaluateAlchemy(decomposeAction(detail, level), who, data, market, teas, { itemPrice: 0 });
      if (r.valid && r.actionsPerHour > 0) fin = { kind: "decompose", value: r.profitPerHour / r.actionsPerHour, hours: 1 / r.actionsPerHour, xp: r.xpPerAction, entry: r };
    }
    cache.set(key, fin);
    return fin;
  };
}
function decomposeCraft(entry, who, data, market) {
  if (entry.action.function !== "/action_functions/production" || !entry.valid || entry.decomposeCraft) return null;
  const hrid = entry.action.outputItems?.[0]?.itemHrid;
  const detail = data.itemDetailMap[hrid];
  const out = entry.outputs.find((o) => o.itemHrid === hrid && o.kind === "product");
  if (!out || !(out.count > 0) || !detail?.alchemyDetail?.decomposeItems?.length || who.levels?.["/skills/alchemy"] === void 0) return null;
  const r = evaluateAlchemy(decomposeAction(detail, 0), who, data, market, who.drinks?.["/action_types/alchemy"] || [], { itemPrice: 0 });
  if (!r.valid || !(r.actionsPerHour > 0)) return null;
  const per = out.count / r.bulk;
  const inputs = entry.inputs.map((i) => ({ ...i }));
  const reused = [];
  const sold = [];
  for (const o of r.outputs) {
    let n = o.count * per;
    const input = inputs.find((i) => i.itemHrid === o.itemHrid && i.count > 0);
    if (input) {
      const take = Math.min(n, input.count);
      input.count -= take;
      input.value = input.count * (input.price || 0);
      reused.push({ itemHrid: o.itemHrid, count: take, price: input.price || 0 });
      n -= take;
    }
    if (n > 1e-12) sold.push({ ...o, count: n, value: n * o.price, kind: o.kind === "product" ? "recovered" : o.kind });
  }
  const coins = r.coinCost * per;
  const catalyst = r.inputs.find((i) => i.catalyst);
  if (coins > 0) inputs.push({ itemHrid: COIN3, count: coins, price: 1, value: coins });
  if (catalyst) inputs.push({ ...catalyst, count: catalyst.count * per, value: catalyst.value * per });
  const craftHours = 1 / entry.actionsPerHour;
  const alchemyHours = per / r.actionsPerHour;
  const share = craftHours / (craftHours + alchemyHours);
  const back = reused.reduce((sum, x) => sum + x.count * x.price, 0) + sold.reduce((sum, x) => sum + x.value, 0) - coins - (catalyst ? catalyst.value * per : 0) - r.teaPerHour * alchemyHours;
  const valuePerItem = back / out.count;
  if (!(valuePerItem > out.price)) return null;
  const outputs = [...entry.outputs.map((o) => o === out ? { ...o, price: 0, value: 0, decomposed: true } : o), ...sold];
  const revenuePerAction = outputs.reduce((sum, o) => sum + o.value, 0);
  const costPerAction = inputs.reduce((sum, i) => sum + i.value, 0);
  const actionsPerHour = entry.actionsPerHour * share;
  const teaPerHour = entry.teaPerHour * share + r.teaPerHour * (1 - share);
  const profitPerHour = actionsPerHour * (revenuePerAction - costPerAction) - teaPerHour;
  const xpPerHour = actionsPerHour * entry.xpPerAction;
  return {
    ...entry,
    single: entry,
    outputs,
    inputs,
    actionsPerHour,
    ownActionsPerHour: entry.actionsPerHour,
    teaPerHour,
    revenuePerAction,
    costPerAction,
    profitPerHour,
    goldPerDay: profitPerHour * HOURS_PER_DAY,
    margin: revenuePerAction > 0 ? profitPerHour / (actionsPerHour * revenuePerAction) : null,
    xpPerHour,
    xpPerDay: xpPerHour * HOURS_PER_DAY,
    salesCap: null,
    decomposeCraft: { share, per, reused, sold, valuePerItem, sellPrice: out.price, decompose: r, singleGoldPerDay: entry.goldPerDay, alchemyXpPerHour: actionsPerHour * per * r.xpPerAction }
  };
}
function shortlist(candidates, keep = () => false) {
  if (candidates.length <= 3 * SHORTLIST) return candidates;
  const tried = candidates.map((c) => {
    const gold = c.evaluate([], (r) => r.goldPerDay);
    const xp = c.evaluate([], (r) => r.xpPerDay);
    const cheap = c.evaluate([], (r) => -coinsPerXp(r));
    return { c, gold: gold.valid ? gold.goldPerDay : -Infinity, xp: xp.valid ? xp.xpPerDay : -Infinity, perCoin: -coinsPerXp(cheap) };
  });
  const kept = new Set(candidates.filter(keep));
  for (const key of ["gold", "xp", "perCoin"]) [...tried].sort((a, b) => b[key] - a[key]).slice(0, SHORTLIST).forEach((t) => kept.add(t.c));
  return candidates.filter((c) => kept.has(c));
}
function rankSkilling(who, data, market, { skill = "all", teaMode = "current", plan = null, goldWeight = 1, countLevels = false, leveling: levelingOptions = {} } = {}) {
  const xpOf = levelProgress(who, data, countLevels);
  const alchemyOptions = { plusBuy: levelingOptions.plusBuy, plusHeld: levelingOptions.plusHeld };
  const finish = decomposeFinisher(who, data, market);
  const evaluator = (action, level) => {
    const target = levelingOptions.fixed?.hrid === action.hrid ? levelingOptions.fixed.target : null;
    if (action.function === ENHANCE_FUNCTION) return (teas, score2) => evaluateEnhance(action, who, data, market, teas, { ...levelingOptions, score: score2, target, finish });
    if (action.function === ALCHEMY_FUNCTION) return (teas, score2) => evaluateAlchemy(action, who, data, market, teas, { ...alchemyOptions, score: score2 });
    return (teas) => daily(evaluateAction(action, who, data, market, teas, level));
  };
  const wanted = (action) => skill === "all" || action.type === skillType(skill);
  const doable = [];
  const near = [];
  for (const action of skillingActions(data)) {
    if (!wanted(action) || who.levels[action.levelRequirement.skillHrid] === void 0) continue;
    const level = who.levels[action.levelRequirement.skillHrid];
    const required = action.levelRequirement.level;
    if (required <= level) {
      doable.push({ action, evaluate: evaluator(action, level) });
    } else if (required <= level + NEAR_LEVELS) {
      near.push(action);
    }
  }
  const levelingList = skill === ENHANCING || skill === ALCHEMY;
  const owned = (c) => (levelingOptions.owned?.(c.action.itemHrid, c.action.enhancementLevel || 0) || 0) > 0 || c.action.hrid === levelingOptions.fixed?.hrid;
  if (skill === ENHANCING) doable.push(...shortlist(enhancingActions(data, market, (hrid) => levelingOptions.owned?.(hrid, 0) || 0).map((action) => ({ action, evaluate: evaluator(action) })), owned));
  if (skill === ALCHEMY) doable.push(...shortlist(alchemyActions(data, market, levelingOptions.plusLevels).map((action) => ({ action, evaluate: evaluator(action) })), owned));
  const XP_FLOOR = countLevels ? 1e-6 : 1;
  const refs = { gold: 1, xp: XP_FLOOR };
  const skillRefs = {};
  const NO_STOCK = { inventory: 0, listed: 0, listings: [] };
  const fillOf = (r) => {
    if (!plan) return 1;
    if (r.action.function === ENHANCE_FUNCTION) return enhanceBudget(r, plan)?.fill ?? 1;
    return suggestCount(r, { ...plan, stock: NO_STOCK, book: null, price: plan.price?.(r.action) ?? null, liquidity: plan.liquidity?.(r.action) ?? null })?.fill ?? 1;
  };
  for (const { action, evaluate } of doable) {
    const own = skillRefs[action.type] ||= { gold: 1, xp: XP_FLOOR, cost: Infinity };
    const gold = bestTeas(action, who, data, market, evaluate, leveling(action) ? (r) => -coinsPer(r, xpOf) : (r) => r.goldPerDay).result;
    const xp = bestTeas(action, who, data, market, evaluate, xpOf).result;
    const goldDay = gold.valid ? gold.goldPerDay * fillOf(gold) : 0;
    const xpDay = xp.valid ? xpOf({ ...xp, xpPerDay: xp.xpPerDay * fillOf(xp) }) : 0;
    for (const r of [refs, own]) {
      r.gold = Math.max(r.gold, goldDay);
      r.xp = Math.max(r.xp, xpDay);
      if (leveling(action)) r.cost = Math.min(r.cost, coinsPer(gold, xpOf));
    }
  }
  const scoreFor = (r) => levelingList ? timeMoneyScore(goldWeight, r, xpOf) : focusScore(goldWeight, r, xpOf);
  const score = scoreFor(refs);
  const chain = chainBuilder(who, data, market, teaMode);
  const chainCaches = /* @__PURE__ */ new Map();
  const heldPrice = (hrid, level = 0) => level > 0 ? levelingOptions.plusHeld?.(hrid, level) || 0 : heldValue(market, data, hrid);
  const available = doable.map(({ action, evaluate }) => {
    const teaScore = scoreFor(skillRefs[action.type]);
    const current = evaluate(who.drinks[action.type] || [], teaScore);
    const best = bestTeas(action, who, data, market, evaluate, teaScore);
    let shown = teaMode === "best" ? best.result : current;
    if (action.function === ALCHEMY_FUNCTION) {
      const chained2 = alchemyChain(shown, who, data, market, chainCaches);
      if (chained2 && teaScore(chained2) > teaScore(shown) + 1e-12) shown = chained2;
    }
    const recycled = decomposeCraft(shown, who, data, market);
    if (recycled && teaScore(recycled) > teaScore(shown) + 1e-12) shown = recycled;
    const recycling = !!shown.decomposeCraft;
    const price = recycling ? null : plan?.price?.(shown.action) ?? null;
    const liquidity = recycling ? REUSED_MARKET : plan?.liquidity?.(shown.action) ?? null;
    const stock = action.function === ALCHEMY_FUNCTION || recycling ? NO_STOCK : plan?.stock(shown.action);
    const suggestion = plan ? suggestCount(shown, { ...plan, stock, book: recycling ? null : plan.book(shown.action), price, liquidity, heldPrice }) : null;
    const budget = plan ? enhanceBudget(shown, plan) : null;
    const fill2 = suggestion ? suggestion.fill : budget ? budget.fill : 1;
    const upTheBook = ((suggestion?.batch.aboveAsk || 0) - (suggestion?.batch.heldSaving || 0)) * 24 / (suggestion?.plannedHours || 1);
    const chained = recycling ? null : chain(shown);
    const entry = {
      ...shown,
      teaMode,
      current,
      best,
      suggestion,
      budget,
      chain: chained,
      // The share of the planned hours the job runs: what the ranking goes by.
      fill: fill2,
      // Gold a day over the planned hours: what the ranking goes by.
      plannedGoldPerDay: shown.goldPerDay * fill2 - upTheBook,
      // A train that makes the materials too, when that pays at least as well as buying them.
      chainSuggestion: plan && chained && chained.profitPerHour >= shown.profitPerHour ? suggestChainCount(shown, chained, { ...plan, stock: plan.stock(shown.action), price, liquidity }) : null,
      score: score({ skill: shown.skill, valid: shown.valid, goldPerDay: shown.goldPerDay * fill2 - upTheBook, xpPerDay: shown.xpPerDay * fill2 }),
      levelsPerDay: countLevels ? levelProgress(who, data, true)(shown) : null,
      thinMargin: !!plan?.hideThinMargins && thinMargin(shown, price?.swing ?? null),
      teaSlots: who.slots[action.type],
      pouch: who.pouch,
      betterTeas: !sameTeas(best.result.teas, current.teas) && teaScore(best.result) > teaScore(current) + 1e-9
    };
    if (plan) {
      const runs = action.function === "/action_functions/gathering" || action.function === ENHANCE_FUNCTION;
      const hours = suggestion?.count ? suggestion.count / best.result.actionsPerHour : budget ? budget.hours : runs ? plan.hours : 0;
      entry.teaPlan = teaPurchase(entry, { hours, have: plan.have });
    }
    return entry;
  });
  available.sort((a, b) => b.valid - a.valid || a.thinMargin - b.thinMargin || b.score - a.score);
  const fastestXp = {};
  for (const entry of available) fastestXp[entry.skill] = Math.max(fastestXp[entry.skill] || 0, entry.current.xpPerHour);
  const table = data.levelExperienceTable;
  const upcoming = near.map((action) => {
    const skillHrid = action.levelRequirement.skillHrid;
    const required = action.levelRequirement.level;
    const evaluate = evaluator(action, required);
    const atUnlock = teaMode === "best" ? bestTeas(action, who, data, market, evaluate).result : evaluate(who.drinks[action.type] || []);
    const have = who.experience[skillHrid];
    const needXp = Array.isArray(table) && have !== null && table[required] !== void 0 ? Math.max(0, table[required] - have) : null;
    const hours = needXp !== null && fastestXp[skillHrid] > 0 ? needXp / fastestXp[skillHrid] : null;
    return { ...atUnlock, needLevels: required - (who.levels[skillHrid] ?? 1), needXp, hoursToUnlock: hours };
  });
  upcoming.sort((a, b) => a.needLevels - b.needLevels || b.goldPerDay - a.goldPerDay);
  return { available, upcoming };
}
var SKILLING_SKILLS, LEVELING_SKILLS, BUFF_SOURCES, MARKET_TAX, COWBELL_BAG_TAX, RISKY_MARGIN, DRINKS_PER_HOUR, MIN_CYCLE_SECONDS2, NEAR_LEVELS, HOURS_PER_DAY, WIDE_SPREAD, INVENTORY, COIN3, POUCH, TOTAL_LEVEL, BUFF, skillName, skillType, processingCache, teasByData, meanCount2, daily, XP_PER_DAY, coinsPerXp, coinsPer, ASK_WINDOW, LIQUIDITY, LIQUIDITY_HOURS, RATING_ORDER, INPUT_BOOK_HOURS, PLAN_MODES, CALM_SWING, MIN_SWING_SHARE, HIGH_PRICE_SHARE, PRICE_BAND, SALES_DAYS, salesDay, REUSED_MARKET, leveling, sameTeas, SHORTLIST;
var init_skilling = __esm({
  "src/skilling.js"() {
    init_levels();
    init_alchemy();
    init_enhancing();
    init_alchemy_chain();
    SKILLING_SKILLS = ["milking", "foraging", "woodcutting", "cheesesmithing", "crafting", "tailoring", "cooking", "brewing"];
    LEVELING_SKILLS = ["alchemy", "enhancing"];
    BUFF_SOURCES = [
      "mooPassActionTypeBuffsMap",
      "communityActionTypeBuffsMap",
      "houseActionTypeBuffsMap",
      "guildActionTypeBuffsMap",
      "achievementActionTypeBuffsMap",
      "equipmentActionTypeBuffsMap",
      "personalActionTypeBuffsMap"
    ];
    MARKET_TAX = 0.04;
    COWBELL_BAG_TAX = 0.18;
    RISKY_MARGIN = 0.05;
    DRINKS_PER_HOUR = 12;
    MIN_CYCLE_SECONDS2 = 3;
    NEAR_LEVELS = 10;
    HOURS_PER_DAY = 24;
    WIDE_SPREAD = 1.5;
    INVENTORY = "/item_locations/inventory";
    COIN3 = "/items/coin";
    POUCH = "/item_locations/pouch";
    TOTAL_LEVEL = "/skills/total_level";
    BUFF = {
      efficiency: "/buff_types/efficiency",
      speed: "/buff_types/action_speed",
      actionLevel: "/buff_types/action_level",
      gathering: "/buff_types/gathering",
      gourmet: "/buff_types/gourmet",
      artisan: "/buff_types/artisan",
      processing: "/buff_types/processing",
      wisdom: "/buff_types/wisdom",
      essence: "/buff_types/essence_find",
      rare: "/buff_types/rare_find"
    };
    skillName = (skillHrid) => skillHrid.split("/").pop();
    skillType = (skill) => "/action_types/" + skill;
    processingCache = /* @__PURE__ */ new WeakMap();
    teasByData = /* @__PURE__ */ new WeakMap();
    meanCount2 = (drop) => (Number(drop.dropRate ?? 1) || 0) * ((Number(drop.minCount ?? 1) + Number(drop.maxCount ?? 1)) / 2);
    daily = (result) => ({ ...result, goldPerDay: result.profitPerHour * HOURS_PER_DAY, xpPerDay: result.xpPerHour * HOURS_PER_DAY });
    XP_PER_DAY = (r) => r.xpPerDay;
    coinsPerXp = (r) => coinsPer(r, XP_PER_DAY);
    coinsPer = (r, xpOf) => r.valid && xpOf(r) > 0 ? -r.goldPerDay / xpOf(r) : Infinity;
    ASK_WINDOW = 0.05;
    LIQUIDITY = {
      stable: { both: 0.9, spread: 0.05, swing: 0.03, selling: 0.75, activity: 0.3 },
      ok: { both: 0.75, spread: 0.15, swing: 0.08, selling: 0.3, activity: 0 }
    };
    LIQUIDITY_HOURS = 12;
    RATING_ORDER = { thin: 0, ok: 1, stable: 2 };
    INPUT_BOOK_HOURS = 12;
    PLAN_MODES = {
      away: { hours: 8, coinShare: { stable: 0.6, ok: 0.3, thin: 0.1 }, hideThinMargins: true },
      medium: { hours: 2, coinShare: { stable: 0.7, ok: 0.4, thin: 0.15 }, hideThinMargins: false },
      active: { hours: 0.5, coinShare: { stable: 0.8, ok: 0.5, thin: 0.2 }, hideThinMargins: false }
    };
    CALM_SWING = 0.05;
    MIN_SWING_SHARE = 0.4;
    HIGH_PRICE_SHARE = 0.5;
    PRICE_BAND = 0.1;
    SALES_DAYS = 1;
    salesDay = (liquidity) => liquidity?.sold?.enough ? Math.floor(SALES_DAYS * liquidity.sold.perDay) : Infinity;
    REUSED_MARKET = { rating: "stable", known: true, reused: true };
    leveling = (action) => action.function === ENHANCE_FUNCTION || action.function === ALCHEMY_FUNCTION;
    sameTeas = (a, b) => a.length === b.length && a.every((hrid) => b.includes(hrid));
    SHORTLIST = 40;
  }
});

// src/stats.js
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
var GEAR_TYPES, STYLES;
var init_profile = __esm({
  "src/profile.js"() {
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
var init_triggers = __esm({
  "src/triggers.js"() {
  }
});

// src/analysis.js
function offStyleStats(style) {
  const own = /* @__PURE__ */ new Set([...STYLE_STATS[style], ...style === "magic" ? [] : PHYSICAL_STATS]);
  return new Set([...Object.values(STYLE_STATS).flat(), ...PHYSICAL_STATS].filter((stat) => !own.has(stat)));
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
    const resale = taken.reduce((sum, gear) => sum + resaleOf(gear, data), 0);
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
var STYLE_STATS, PHYSICAL_STATS, ENEMY_RESPAWN_SECONDS, MAX_ENCOUNTERS_PER_HOUR, MAX_LEVELS, LEVEL_STEPS;
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
    STYLE_STATS = {
      melee: ["stabAccuracy", "slashAccuracy", "smashAccuracy", "stabDamage", "slashDamage", "smashDamage", "meleeExperience", "defensiveDamage"],
      ranged: ["rangedAccuracy", "rangedDamage", "rangedExperience"],
      magic: ["magicAccuracy", "magicDamage", "magicExperience"]
    };
    PHYSICAL_STATS = ["physicalAmplify", "armorPenetration"];
    ENEMY_RESPAWN_SECONDS = 3;
    MAX_ENCOUNTERS_PER_HOUR = 3600 / ENEMY_RESPAWN_SECONDS;
    MAX_LEVELS = 5;
    LEVEL_STEPS = [1, 2, 3, 5, 10, 20];
  }
});

// src/labyrinth.js
function labyrinthMonsters(data) {
  return Object.values(data.combatMonsterDetailMap || {}).filter((m) => m.isLabyrinthMonster).sort((a, b) => a.name.localeCompare(b.name)).map((m) => m.hrid);
}
function slottedCrate(character, kind) {
  const chosen = character?.characterSetting?.[`labyrinth${kind[0].toUpperCase() + kind.slice(1)}CrateHrid`];
  const slots = [{ itemHrid: chosen }, ...character?.actionTypeDrinkSlotsMap?.[LABYRINTH] || [], ...character?.actionTypeFoodSlotsMap?.[LABYRINTH] || []];
  for (const slot2 of slots) {
    const tier = CRATE_TIERS.find((t) => slot2?.itemHrid === crateHrid(t, kind));
    if (tier) return tier;
  }
  return null;
}
function chosenCrates(settings, character) {
  const pick = (kind) => {
    const value = settings[kind === "coffee" ? "labyCoffee" : "labyFood"] || "slots";
    if (value === "slots") return slottedCrate(character, kind);
    return CRATE_TIERS.includes(value) ? value : null;
  };
  return { coffee: pick("coffee"), food: pick("food") };
}
function crateBuffs(data, crates) {
  const buffs = [];
  for (const [kind, tier] of Object.entries(crates)) {
    if (!tier) continue;
    for (const buff of data.labyrinthCrateDetailMap?.[crateHrid(tier, kind)] || []) buffs.push({ ...buff, uniqueHrid: `${buff.uniqueHrid}#${kind}`, duration: 0 });
  }
  return buffs;
}
function roomFighter(profile, data, crates) {
  const fighter = cloneProfile(profile);
  fighter.food = [];
  fighter.drinks = [];
  return { player: toDTO(fighter, data), extraBuffs: [...profile.extraBuffs || [], ...crateBuffs(data, crates)] };
}
function damageTaken(data, monsterHrid, level) {
  const monster = data.combatMonsterDetailMap[monsterHrid];
  const stats = monster.combatDetails.combatStats || {};
  const scale = level / 100;
  const defense = 0.2 * (monster.combatDetails.defenseLevel || 0) * scale;
  const out = {};
  for (const type of DAMAGE_TYPES) {
    const resistance = (stats[RESISTANCE_STAT[type]] || 0) * scale + defense;
    out[type] = resistance >= 0 ? 100 / (100 + resistance) : (100 - resistance) / 100;
  }
  return out;
}
function evasionByStyle(data, monsterHrid) {
  const stats = data.combatMonsterDetailMap[monsterHrid].combatDetails.combatStats || {};
  return Object.fromEntries(ATTACK_STYLES.map((style) => [style, 1 + (stats[style + "Evasion"] || 0)]));
}
function hitScore(data, monsterHrid, style, type) {
  return damageTaken(data, monsterHrid, 100)[type] / evasionByStyle(data, monsterHrid)[style];
}
function weakTo(data, monsterHrid) {
  const pairs = [];
  for (const style of ATTACK_STYLES) for (const type of STYLE_TYPES[style]) pairs.push({ style, type, score: hitScore(data, monsterHrid, style, type) });
  const best = Math.max(...pairs.map((p) => p.score));
  const styles = [];
  for (const p of pairs.filter((p2) => p2.score >= best / 2).sort((a, b) => b.score - a.score)) {
    const known = styles.find((s) => s.style === p.style);
    if (known) known.types.push(p.type);
    else styles.push({ style: p.style, types: [p.type] });
  }
  return { styles, best, thorns: best < THORNS_BELOW };
}
function yourStyle(profile, data) {
  const weapon = weaponOf(profile);
  const first = weapon ? data.itemDetailMap[weapon.hrid]?.equipmentDetail?.combatStats?.combatStyleHrids?.[0] : null;
  return (first || "/combat_styles/smash").split("/").pop();
}
function styleWeapon(profile, data, style) {
  const fits = (item) => item?.equipmentDetail && ["main_hand", "two_hand"].includes(item.equipmentDetail.type?.split("/").pop()) && item.equipmentDetail.combatStats?.combatStyleHrids?.[0] === "/combat_styles/" + style && meetsRequirements(profile, item.equipmentDetail.levelRequirements);
  const owned = profile.inventory.filter((i) => fits(data.itemDetailMap[i.hrid])).sort((a, b) => (data.itemDetailMap[b.hrid].itemLevel || 0) - (data.itemDetailMap[a.hrid].itemLevel || 0) || b.enhancementLevel - a.enhancementLevel)[0];
  let weapon = owned ? { hrid: owned.hrid, enhancementLevel: owned.enhancementLevel, cost: 0, owned: true } : null;
  if (!weapon) {
    for (const item of Object.values(data.itemDetailMap)) {
      if (!fits(item)) continue;
      const price = askPrice(item.hrid, 0);
      if (price !== null && (!weapon || price < weapon.cost)) weapon = { hrid: item.hrid, enhancementLevel: 0, cost: price, owned: false };
    }
  }
  if (weapon) weapon.slot = data.itemDetailMap[weapon.hrid].equipmentDetail.type.split("/").pop();
  return weapon;
}
function pointsToJobs(fighter, points, rooms) {
  return points.map((p, i) => ({ ...fighter, monsterHrid: p.monster, roomLevel: p.level, attempts: rooms, seed: seedFor(p.seed ?? i) }));
}
function summarizeCurve(curve) {
  let safe = null;
  for (const p of curve) {
    if (rate(p) >= SAFE_WIN) safe = p.level;
    else break;
  }
  let half = null;
  if (curve.length && rate(curve[0]) >= RISKY_WIN) {
    half = curve[curve.length - 1].level;
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1];
      const b = curve[i];
      if (rate(b) < RISKY_WIN) {
        const ra = rate(a);
        const rb = rate(b);
        half = a.level + (ra - RISKY_WIN) / Math.max(1e-9, ra - rb) * (b.level - a.level);
        break;
      }
    }
  }
  return { safe, half };
}
function winAt(curve, level) {
  if (!curve.length) return null;
  if (level <= curve[0].level) return rate(curve[0]);
  for (let i = 1; i < curve.length; i++) {
    const a = curve[i - 1];
    const b = curve[i];
    if (level <= b.level) return rate(a) + (level - a.level) / (b.level - a.level) * (rate(b) - rate(a));
  }
  return rate(curve[curve.length - 1]);
}
function better(a, b) {
  const key = (m) => [m.half ?? -1, m.safe ?? -1, m.curve.length ? rate(m.curve[0]) : 0];
  const [x, y] = [key(a), key(b)];
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
async function simulateCurves(pool, fighter, monsters, rooms, onProgress) {
  const coarse = monsters.flatMap((monster) => COARSE_LEVELS.map((level, i) => ({ monster, level, seed: i })));
  const fine = [];
  let before = 0;
  const run = (points) => runCached(pool, pointsToJobs(fighter, points, rooms), (done) => onProgress?.(before + done, coarse.length + fine.length));
  const coarseResults = await run(coarse);
  before = coarse.length;
  const curves = new Map(monsters.map((m) => [m, []]));
  coarse.forEach((p, i) => curves.get(p.monster).push({ level: p.level, ...coarseResults[i] }));
  for (const monster of monsters) {
    const curve = curves.get(monster);
    const lastSafe = [...curve].reverse().find((p) => rate(p) >= SAFE_WIN)?.level ?? 0;
    const firstLost = curve.find((p) => p.level > lastSafe && rate(p) <= 0.1)?.level ?? MAX_LEVEL;
    const have = new Set(curve.map((p) => p.level));
    const levels = [];
    for (let level = Math.max(MIN_LEVEL, lastSafe) + FINE_STEP; level < firstLost && levels.length < MAX_FINE; level += FINE_STEP) {
      if (!have.has(level)) levels.push(level);
    }
    fine.push(...levels.map((level) => ({ monster, level, seed: 100 + level })));
  }
  const fineResults = await run(fine);
  fine.forEach((p, i) => curves.get(p.monster).push({ level: p.level, ...fineResults[i] }));
  return monsters.map((hrid) => {
    const curve = curves.get(hrid).sort((a, b) => a.level - b.level);
    return { hrid, curve, ...summarizeCurve(curve) };
  });
}
async function analyzeLabyrinth(pool, setups, data, settings, character, onProgress) {
  const accuracy = LAB_ACCURACY[settings.accuracy] || LAB_ACCURACY.normal;
  const crates = chosenCrates(settings, character);
  const monsters = labyrinthMonsters(data);
  const results = [];
  for (const [i, setup] of setups.entries()) {
    const curves = await simulateCurves(
      pool,
      roomFighter(setup.profile, data, crates),
      monsters,
      accuracy.rooms,
      (done, total) => onProgress?.(i * 1e3 + Math.round(1e3 * done / Math.max(1, total)), setups.length * 1e3)
    );
    results.push({ id: setup.id, name: setup.name, monsters: curves });
  }
  const best = monsters.map((hrid, m) => {
    let pick = null;
    for (const setup of results) if (!pick || better(setup.monsters[m], pick.monster)) pick = { setup, monster: setup.monsters[m] };
    return { ...pick.monster, setupId: pick.setup.id, setupName: pick.setup.name };
  });
  return { crates, rooms: accuracy.rooms, setups: results, monsters: best };
}
function improvementCandidates(profile, data, crates) {
  const list = [];
  for (const kind of Object.keys(CRATE_KINDS)) {
    const now2 = CRATE_TIERS.indexOf(crates[kind]);
    for (const tier of CRATE_TIERS.slice(now2 + 1)) {
      list.push({ id: `crate:${kind}:${tier}`, kind: "crate", label: `${tier[0].toUpperCase() + tier.slice(1)} ${CRATE_KINDS[kind]}`, crates: { ...crates, [kind]: tier }, profile });
    }
  }
  for (const skill of Object.keys(SKILL_LABEL)) {
    const changed = cloneProfile(profile);
    changed.levels[skill] += SKILL_STEP;
    list.push({ id: `skill:${skill}`, kind: "skill", label: `+${SKILL_STEP} ${SKILL_LABEL[skill]}`, crates, profile: changed });
  }
  profile.abilities.forEach((entry, slot2) => {
    if (!entry) return;
    const changed = cloneProfile(profile);
    changed.abilities[slot2].level += ABILITY_STEP;
    list.push({ id: `ability:${entry.hrid}`, kind: "ability", hrid: entry.hrid, label: `+${ABILITY_STEP} levels ${data.abilityDetailMap[entry.hrid]?.name || entry.hrid}`, crates, profile: changed });
  });
  profile.abilities.forEach((entry, slot2) => {
    if (!entry || slot2 === 0) return;
    const changed = cloneProfile(profile);
    changed.abilities[slot2] = null;
    list.push({ id: `drop:${entry.hrid}`, kind: "swap", hrid: null, replaces: entry.hrid, slot: slot2, label: `Without ${data.abilityDetailMap[entry.hrid]?.name || entry.hrid}`, crates, profile: changed });
  });
  const using = new Set(profile.abilities.filter(Boolean).map((a) => a.hrid));
  for (const [hrid, level] of Object.entries(profile.learnedAbilities || {})) {
    const detail = data.abilityDetailMap[hrid];
    if (!detail || detail.isSpecialAbility || using.has(hrid)) continue;
    for (let slot2 = 1; slot2 <= slotCounts(profile, data).abilities; slot2++) {
      const old = profile.abilities[slot2];
      const changed = cloneProfile(profile);
      changed.abilities[slot2] = { hrid, level };
      list.push({ id: `swap:${slot2}:${hrid}`, kind: "swap", hrid, replaces: old?.hrid || null, slot: slot2, label: `${detail.name}${old ? ` instead of ${data.abilityDetailMap[old.hrid]?.name || old.hrid}` : " in an empty slot"}`, crates, profile: changed });
      if (!old) break;
    }
  }
  return list;
}
function edgeOf(m, seed) {
  const level = Math.round(Math.min(MAX_LEVEL, Math.max(MIN_LEVEL, m.half ?? MIN_LEVEL)));
  const here = winAt(m.curve, level);
  const below = [...m.curve].reverse().find((p) => p.level <= level - 1 && rate(p) > here) || m.curve[0];
  const above = m.curve.find((p) => p.level >= level + 1 && rate(p) < here) || m.curve[m.curve.length - 1];
  const slope = above.level > below.level ? (rate(below) - rate(above)) / (above.level - below.level) : 0;
  return { hrid: m.hrid, level, slope: Math.max(0.01, slope), seed };
}
async function atEdges(pool, data, setups, rooms, seedShift, onProgress) {
  const jobs = [];
  for (const setup of setups) {
    const fighter = roomFighter(setup.profile, data, setup.crates);
    for (let k = 0; k < (setup.repeat || 1); k++) {
      for (const edge of setup.edges) jobs.push({ ...fighter, monsterHrid: edge.hrid, roomLevel: edge.level, attempts: rooms, seed: seedFor(edge.seed + seedShift + 7919 * k) });
    }
  }
  const results = await runCached(pool, jobs, onProgress);
  let next = 0;
  return setups.map((setup) => {
    const sums = setup.edges.map(() => ({ attempts: 0, wins: 0, deaths: 0, timeouts: 0 }));
    for (let k = 0; k < (setup.repeat || 1); k++) {
      sums.forEach((sum) => {
        const r = results[next++];
        for (const key of Object.keys(sum)) sum[key] += r[key];
      });
    }
    return sums;
  });
}
async function analyzeImprovements(pool, setups, data, settings, lab, onProgress) {
  const accuracy = LAB_ACCURACY[settings.accuracy] || LAB_ACCURACY.normal;
  const byId = new Map(setups.map((s) => [s.id, s]));
  const groups = /* @__PURE__ */ new Map();
  lab.monsters.forEach((m, i) => {
    const setup = byId.get(m.setupId) || setups[0];
    if (!groups.has(setup.id)) groups.set(setup.id, { setup, edges: [], candidates: improvementCandidates(setup.profile, data, lab.crates) });
    groups.get(setup.id).edges.push(edgeOf(m, 1e3 + i));
  });
  const runs = [];
  for (const group of groups.values()) {
    runs.push({ profile: group.setup.profile, crates: lab.crates, edges: group.edges, repeat: BASE_REPEAT });
    for (const c of group.candidates) runs.push({ profile: c.profile, crates: c.crates, edges: group.edges });
  }
  const results = await atEdges(pool, data, runs, accuracy.improveRooms, 0, onProgress);
  const combined = /* @__PURE__ */ new Map();
  const base = [];
  let r = 0;
  for (const group of groups.values()) {
    const own = results[r++];
    group.edges.forEach((edge, i) => base.push({ hrid: edge.hrid, level: edge.level, setupName: group.setup.name, win: rate(own[i]), deaths: own[i].deaths / own[i].attempts, timeouts: own[i].timeouts / own[i].attempts }));
    for (const c of group.candidates) {
      const theirs = results[r++];
      const id = c.kind === "swap" ? `${group.setup.id}:${c.id}` : c.id;
      const { profile: _p, crates: _c, ...rest } = c;
      if (!combined.has(id)) combined.set(id, { ...rest, setupName: group.setup.name, perMonster: [] });
      group.edges.forEach((edge, i) => {
        const gain = rate(theirs[i]) - rate(own[i]);
        combined.get(id).perMonster.push({ hrid: edge.hrid, level: edge.level, before: rate(own[i]), after: rate(theirs[i]), levels: Math.max(-50, Math.min(50, gain / edge.slope)) });
      });
    }
  }
  const candidates = [...combined.values()].map((c) => ({ ...c, levels: c.perMonster.reduce((sum, m) => sum + m.levels, 0) / lab.monsters.length }));
  return { rooms: accuracy.improveRooms, base, candidates };
}
function monstersFor(data, style) {
  return labyrinthMonsters(data).filter((hrid) => weakTo(data, hrid).styles.some((s) => s.style === style));
}
function applyCandidate(profile, c) {
  const out = cloneProfile(profile);
  const index = c.slot?.startsWith("ability") ? Number(c.slot.replace("ability", "")) : null;
  if (c.kind === "gear") equip(out, c.slot, { hrid: c.hrid, enhancementLevel: c.enhancementLevel });
  else if (c.kind === "ability" || c.kind === "abilityLevel") out.abilities[index] = { hrid: c.hrid, level: c.level };
  else if (c.kind === "drop") out.abilities[index] = null;
  else if (c.kind === "dropAll") out.abilities = out.abilities.map((entry, i) => i === 0 ? entry : null);
  else if (c.kind === "triggers") out.abilityTriggers = { ...out.abilityTriggers, ...Object.fromEntries(out.abilities.filter(Boolean).map((a) => [a.hrid, []])) };
  return out;
}
async function buildLoadout(pool, profile, data, settings, opts, onProgress) {
  const accuracy = LAB_ACCURACY[settings.accuracy] || LAB_ACCURACY.normal;
  const { style, crates } = opts;
  let budget = Math.max(0, Number(opts.budget) || 0);
  const minPerMillion = LEVELS_PER_MILLION[settings.spending] ?? LEVELS_PER_MILLION.balanced;
  const targets = monstersFor(data, style);
  if (!targets.length) throw new Error(`No Labyrinth monster is weak to ${style}.`);
  let start = cloneProfile(profile);
  let starter = null;
  if (yourStyle(profile, data) !== style) {
    starter = styleWeapon(profile, data, style);
    if (!starter) throw new Error(`No ${style} weapon you can wear is for sale.`);
    starter.replaces = weaponOf(profile);
    equip(start, starter.slot, { hrid: starter.hrid, enhancementLevel: starter.enhancementLevel });
    budget = Math.max(0, budget - starter.cost);
  }
  start.food = [];
  start.drinks = [];
  const steps = 14;
  const part = (from, size) => (done, total) => onProgress?.(Math.round((from + size * done / Math.max(1, total)) * 1e3 / steps), 1e3);
  const before = await simulateCurves(pool, roomFighter(start, data, crates), targets, accuracy.rooms, part(0, 3));
  const edges = before.map((m, i) => edgeOf(m, 2e3 + i));
  const subStyle = (c) => c.kind !== "gear" || !["main_hand", "two_hand"].includes(c.slot) || data.itemDetailMap[c.hrid]?.equipmentDetail?.combatStats?.combatStyleHrids?.[0] === "/combat_styles/" + style;
  const candidates = [
    // A loadout of its own sells nothing: what it replaces is still worn in your other loadouts.
    ...gearCandidates(start, { budget, starter, enhanceCost: opts.enhanceCost }).filter((c) => c.slot !== "pouch" && !c.extraFood && subStyle(c)).map((c) => ({ ...c, cost: c.price ?? c.cost, resale: 0, sold: [] })).filter((c) => c.cost <= budget),
    ...abilityCandidates(start, budget)
  ];
  start.abilities.forEach((entry, index) => {
    if (!entry || index === 0) return;
    const without = cloneProfile(start);
    without.abilities[index] = null;
    candidates.push({ kind: "drop", slot: "ability" + index, hrid: entry.hrid, cost: 0, owned: true, profile: without });
  });
  if (start.abilities.slice(1).filter(Boolean).length > 1) {
    const bare = cloneProfile(start);
    bare.abilities = bare.abilities.map((entry, index) => index === 0 ? entry : null);
    candidates.push({ kind: "dropAll", slot: "abilities", cost: 0, owned: true, profile: bare });
  }
  const quiet = cloneProfile(start);
  quiet.abilityTriggers = Object.fromEntries(start.abilities.filter(Boolean).map((a) => [a.hrid, []]));
  candidates.push({ kind: "triggers", slot: "triggers", cost: 0, owned: true, profile: quiet });
  const scoreAt = (edgeList) => (own, base) => edgeList.reduce((sum, edge, i) => sum + Math.max(-50, Math.min(50, (rate(own[i]) - rate(base[i])) / edge.slope)), 0) / edgeList.length;
  const screenRooms = Math.max(20, Math.round(accuracy.improveRooms * SCREEN_SHARE));
  const first = await atEdges(pool, data, [{ profile: start, crates, edges, repeat: BASE_REPEAT }, ...candidates.map((c) => ({ profile: c.profile, crates, edges }))], screenRooms, 0, part(3, 5));
  candidates.forEach((c, i) => c.levels = scoreAt(edges)(first[i + 1], first[0]));
  const bySlot = /* @__PURE__ */ new Map();
  for (const c of candidates.filter((c2) => c2.cost > 0 && c2.levels > 0).sort((a, b) => b.levels - a.levels)) {
    const list = bySlot.get(c.slot) || [];
    if (list.length < PER_SLOT) list.push(c);
    bySlot.set(c.slot, list);
  }
  const shortlist2 = [...candidates.filter((c) => c.cost === 0), ...[...bySlot.values()].flat()];
  const abilitySlots = [1, 2, 3, 4].map((i) => "ability" + i);
  const slotsOf = (c) => c.slot === "two_hand" ? ["two_hand", "main_hand", "off_hand"] : c.slot === "main_hand" || c.slot === "off_hand" ? [c.slot, "two_hand"] : c.kind === "dropAll" ? [...abilitySlots, "triggers", "abilities"] : c.slot.startsWith("ability") && c.slot !== "ability0" ? [c.slot, "abilities"] : c.slot === "triggers" ? ["triggers", "abilities"] : [c.slot];
  const taken = /* @__PURE__ */ new Set();
  const picks = [];
  let left = budget;
  let built = start;
  let now2 = before;
  let lastRound = [];
  for (let round = 0; round < ROUNDS2; round++) {
    const open2 = shortlist2.filter((c) => !picks.includes(c) && !slotsOf(c).some((x) => taken.has(x)) && c.cost <= left);
    if (!open2.length) break;
    const roundEdges = now2.map((m, i) => edgeOf(m, 3e3 + 10 * round + i));
    const from = part(8 + round, 1);
    const results = await atEdges(pool, data, [{ profile: built, crates, edges: roundEdges, repeat: BASE_REPEAT }, ...open2.map((c) => ({ profile: applyCandidate(built, c), crates, edges: roundEdges }))], ROUND_ROOMS * accuracy.improveRooms, 500 + round, from);
    open2.forEach((c, i) => c.roundLevels = scoreAt(roundEdges)(results[i + 1], results[0]));
    lastRound = open2;
    const dropOf = (c) => c.kind === "ability" && c.replaces ? open2.find((d) => d.kind === "drop" && d.hrid === c.replaces) : null;
    const beatsDrop = (c) => !dropOf(c) || c.roundLevels >= dropOf(c).roundLevels + MIN_LEVELS;
    const worth = (c) => c.roundLevels >= MIN_LEVELS && beatsDrop(c) && (c.cost === 0 || c.roundLevels / (c.cost / 1e6) >= minPerMillion);
    const good = open2.filter(worth);
    const order = [...good.filter((c) => c.cost === 0).sort((a, b) => b.roundLevels - a.roundLevels), ...good.filter((c) => c.cost > 0).sort((a, b) => b.roundLevels / b.cost - a.roundLevels / a.cost)];
    let pick = null;
    for (const [k, c] of order.slice(0, CONFIRM_TRIES).entries()) {
      const check = await atEdges(pool, data, [{ profile: built, crates, edges: roundEdges, repeat: BASE_REPEAT }, { profile: applyCandidate(built, c), crates, edges: roundEdges, repeat: ROUND_ROOMS }], accuracy.improveRooms, 900 + 10 * round + k);
      c.roundLevels = (c.roundLevels + scoreAt(roundEdges)(check[1], check[0])) / 2;
      if (worth(c)) {
        pick = c;
        break;
      }
    }
    if (!pick) break;
    pick.levels = pick.roundLevels;
    picks.push(pick);
    slotsOf(pick).forEach((x) => taken.add(x));
    left -= pick.cost;
    built = applyCandidate(built, pick);
    now2 = await simulateCurves(pool, roomFighter(built, data, crates), targets, accuracy.rooms, part(8 + round, 1));
  }
  const after = now2;
  onProgress?.(1e3, 1e3);
  const strip = ({ profile: _p, ...rest }) => rest;
  return {
    style,
    targets,
    starter,
    budget: Number(opts.budget) || 0,
    spent: (starter && !starter.owned ? starter.cost : 0) + picks.reduce((sum, p) => sum + p.cost, 0),
    before,
    after,
    picks: picks.map(strip),
    // The best of the rest, for "also tested".
    // The best of the rest in the last round, measured from (nearly) the finished list.
    nearMisses: lastRound.filter((c) => !picks.includes(c) && c.roundLevels > 0).sort((a, b) => b.roundLevels - a.roundLevels).slice(0, 6).map((c) => ({ ...strip(c), levels: c.roundLevels })),
    tested: candidates.length,
    profile: built
  };
}
var SAFE_WIN, RISKY_WIN, MIN_LEVEL, MAX_LEVEL, COARSE_LEVELS, FINE_STEP, MAX_FINE, LAB_ACCURACY, CRATE_TIERS, CRATE_KINDS, crateHrid, LABYRINTH, seedFor, DAMAGE_TYPES, RESISTANCE_STAT, ATTACK_STYLES, STYLE_TYPES, THORNS_BELOW, rate, SKILL_STEP, ABILITY_STEP, SKILL_LABEL, BASE_REPEAT, SCREEN_SHARE, PER_SLOT, ROUNDS2, MIN_LEVELS, LEVELS_PER_MILLION, ROUND_ROOMS, CONFIRM_TRIES;
var init_labyrinth = __esm({
  "src/labyrinth.js"() {
    init_analysis();
    init_game_data();
    init_profile();
    init_sim_cache();
    SAFE_WIN = 0.9;
    RISKY_WIN = 0.5;
    MIN_LEVEL = 5;
    MAX_LEVEL = 200;
    COARSE_LEVELS = [5, ...Array.from({ length: 20 }, (_, i) => 10 * (i + 1))];
    FINE_STEP = 2;
    MAX_FINE = 12;
    LAB_ACCURACY = {
      fast: { rooms: 20, improveRooms: 40 },
      normal: { rooms: 40, improveRooms: 80 },
      thorough: { rooms: 80, improveRooms: 160 }
    };
    CRATE_TIERS = ["basic", "advanced", "expert"];
    CRATE_KINDS = { coffee: "Coffee crate", food: "Food crate" };
    crateHrid = (tier, kind) => `/items/${tier}_${kind}_crate`;
    LABYRINTH = "/action_types/labyrinth";
    seedFor = (index) => Math.imul(index + 1, 2654435761) >>> 1 || 1;
    DAMAGE_TYPES = ["physical", "water", "nature", "fire"];
    RESISTANCE_STAT = { physical: "armor", water: "waterResistance", nature: "natureResistance", fire: "fireResistance" };
    ATTACK_STYLES = ["stab", "slash", "smash", "ranged", "magic"];
    STYLE_TYPES = { stab: ["physical"], slash: ["physical"], smash: ["physical"], ranged: ["physical", "water", "fire"], magic: ["water", "nature", "fire"] };
    THORNS_BELOW = 0.1;
    rate = (point) => point.attempts ? point.wins / point.attempts : 0;
    SKILL_STEP = 5;
    ABILITY_STEP = 5;
    SKILL_LABEL = { stamina: "Stamina", intelligence: "Intelligence", attack: "Attack", melee: "Melee", defense: "Defense", ranged: "Ranged", magic: "Magic" };
    BASE_REPEAT = 4;
    SCREEN_SHARE = 0.5;
    PER_SLOT = 3;
    ROUNDS2 = 6;
    MIN_LEVELS = 0.5;
    LEVELS_PER_MILLION = { frugal: 2, balanced: 0.5, all: 0 };
    ROUND_ROOMS = 2;
    CONFIRM_TRIES = 3;
  }
});

// src/labyrinth-combat.js
var labyrinth_combat_exports = {};
__export(labyrinth_combat_exports, {
  runLabyrinthCombat: () => runLabyrinthCombat
});
async function runLabyrinthCombat(pool, request2, data, { enhanceCost = null, onStage = () => {
}, onProgress = () => {
} } = {}) {
  const setups = request2.setups || [];
  if (!setups.length) throw new Error("no loadouts in the request");
  const crates = request2.crates || {};
  const settings = {
    ...request2.settings || {},
    labyCoffee: crates.coffee || "none",
    labyFood: crates.food || "none"
  };
  const out = { lab: null, improve: null, builds: [] };
  out.lab = await analyzeLabyrinth(pool, setups, data, settings, null, (done, total) => onProgress("check", done, total));
  onStage("check", out);
  out.improve = await analyzeImprovements(pool, setups, data, settings, out.lab, (done, total) => onProgress("improve", done, total));
  onStage("improve", out);
  const picked = [...new Set(out.lab.monsters.map((m) => m.setupId))].map((id) => setups.find((s) => s.id === id)).filter(Boolean);
  for (const [i, setup] of picked.entries()) {
    const style = yourStyle(setup.profile, data);
    try {
      const build = await buildLoadout(
        pool,
        setup.profile,
        data,
        settings,
        { style, budget: Number(settings.budget) || 0, enhanceCost, crates: out.lab.crates },
        (done, total) => onProgress("build", i * 1e3 + Math.round(1e3 * done / Math.max(1, total)), picked.length * 1e3)
      );
      const { profile: _built, ...kept } = build;
      out.builds.push({ setupId: setup.id, setupName: setup.name, style, build: kept });
    } catch (error) {
      out.builds.push({ setupId: setup.id, setupName: setup.name, style, error: String(error?.message || error) });
    }
    onStage("build", out);
  }
  return out;
}
var init_labyrinth_combat = __esm({
  "src/labyrinth-combat.js"() {
    init_labyrinth();
  }
});

// pi/labyrinth-combat-entry.js
import os from "node:os";
import { readFileSync as readFileSync2, renameSync, writeFileSync } from "node:fs";
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
    let average = (max + min) / 2;
    let extraTailWeight = balancedWeight * (average - balancedAverage) / (maxFloor + 1 - average);
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
  updateTimeSpentAlive(name, alive, time) {
    const i = this.timeSpentAlive.findIndex((e) => e.name === name);
    if (alive) {
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
    for (const [type, rate2] of Object.entries(experienceGainedRate)) {
      if (rate2 <= 0) continue;
      const skillExperience = rate2 * (1 + unit.combatDetails.combatStats[type + "Experience"]);
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
    let levelBonus2 = 20 * this.difficultyTier;
    let labyrinthScaleFactor = this.roomLevel / this.LabyrinthMonsterBaseRoomLevel;
    this.staminaLevel = levelMultiplier * (gameMonster.combatDetails.staminaLevel + levelBonus2) * labyrinthScaleFactor;
    this.intelligenceLevel = levelMultiplier * (gameMonster.combatDetails.intelligenceLevel + levelBonus2) * labyrinthScaleFactor;
    this.attackLevel = levelMultiplier * (gameMonster.combatDetails.attackLevel + levelBonus2) * labyrinthScaleFactor;
    this.meleeLevel = levelMultiplier * (gameMonster.combatDetails.meleeLevel + levelBonus2) * labyrinthScaleFactor;
    this.defenseLevel = defLevelMultiplier * (gameMonster.combatDetails.defenseLevel + levelBonus2) * labyrinthScaleFactor;
    this.rangedLevel = levelMultiplier * (gameMonster.combatDetails.rangedLevel + levelBonus2) * labyrinthScaleFactor;
    this.magicLevel = levelMultiplier * (gameMonster.combatDetails.magicLevel + levelBonus2) * labyrinthScaleFactor;
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

// src/sim-core.js
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

// pi/labyrinth-combat-entry.js
async function main() {
  try {
    os.setPriority(19);
  } catch {
  }
  const [charDir, dataFile, rawDir] = process.argv.slice(2);
  const started = Date.now();
  const request2 = JSON.parse(readFileSync2(path2.join(charDir, "request.json"), "utf8"));
  const { hash: hash2, data, market } = await loadAdvisor(dataFile, rawDir);
  const { marketEntry: marketEntry2 } = await Promise.resolve().then(() => (init_game_data(), game_data_exports));
  const { marketPricer: marketPricer2 } = await Promise.resolve().then(() => (init_skilling(), skilling_exports));
  const { selfEnhanceCosts: selfEnhanceCosts2 } = await Promise.resolve().then(() => (init_enhancing(), enhancing_exports));
  const { runLabyrinthCombat: runLabyrinthCombat2 } = await Promise.resolve().then(() => (init_labyrinth_combat(), labyrinth_combat_exports));
  let enhanceCost = null;
  if (request2.who) {
    const market2 = marketPricer2((hrid) => marketEntry2(hrid), data, "bid");
    enhanceCost = (hrid, starts) => selfEnhanceCosts2(hrid, request2.who, data, market2, starts);
  }
  const write = (name, value) => {
    const file = path2.join(charDir, name);
    writeFileSync(file + ".tmp", JSON.stringify(value));
    renameSync(file + ".tmp", file);
  };
  const base = { at: started, requestAt: request2.at ?? null, character: request2.character?.name || null, dataHash: hash2, pricesAt: market.timestamp ? market.timestamp * 1e3 : null, version: request2.version || null };
  let shown = 0;
  const progress = (stage, done, total) => {
    if (Date.now() - shown < 3e3 && done < total) return;
    shown = Date.now();
    write("progress.json", { stage, done, total, at: shown });
  };
  const workers = Math.max(1, Math.min(4, Number(process.env.MWIA_LAB_COMBAT_WORKERS) || 2));
  const pool = new ThreadPool(workers, dataFile, import.meta.url);
  await pool.start();
  try {
    const result = await runLabyrinthCombat2(pool, request2, data, {
      enhanceCost,
      onProgress: progress,
      onStage: (stage, partial) => write("result.json", { ...base, stage, done: false, ...partial })
    });
    write("result.json", { ...base, stage: "done", done: true, finishedAt: Date.now(), ...result });
  } finally {
    await pool.terminate();
  }
}
if (!isMainThread) serveWorker(parentPort, workerData, runLabyrinthSim);
else await main();

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

