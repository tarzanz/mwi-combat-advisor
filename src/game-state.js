// Listens to the game's WebSocket and keeps a copy of the parts of the
// character that matter for combat: skills, equipment, inventory, abilities,
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
            "house_rooms_updated",
            "actions_updated",
            "achievements_updated",
            "community_buffs_updated",
            "moo_pass_buffs_updated",
            "personal_buffs_updated",
            "guild_buffs_updated",
        ].join("|") +
        ')"'
);

const listeners = new Set();

export const state = {
    character: null, // the latest init_character_data, patched by later messages
    items: new Map(), // hash/id -> character item
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
                copyFields(data, ["actionTypeFoodSlotsMap", "actionTypeDrinkSlotsMap"]);
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
                copyFields(data, ["characterHouseRoomMap"]);
                break;
            case "actions_updated":
                mergeActions(data.endCharacterActions);
                break;
            case "achievements_updated":
                copyFields(data, ["characterAchievements"]);
                break;
            case "community_buffs_updated":
                copyFields(data, ["communityActionTypeBuffsMap"]);
                break;
            case "moo_pass_buffs_updated":
                copyFields(data, ["mooPassActionTypeBuffsMap"]);
                break;
            case "personal_buffs_updated":
                copyFields(data, ["personalActionTypeBuffsMap"]);
                break;
            case "guild_buffs_updated":
                copyFields(data, ["guildActionTypeBuffsMap"]);
                break;
        }
    }
    state.updatedAt = Date.now();
    for (const listener of listeners) {
        try {
            listener(data.type, data);
        } catch (error) {
            console.error("[Combat Advisor]", error);
        }
    }
}

function onMessage(event) {
    const raw = event.data;
    if (typeof raw !== "string" || !INTERESTING.test(raw)) return;
    try {
        handle(JSON.parse(raw));
    } catch (error) {
        console.error("[Combat Advisor] Could not parse message", error);
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
