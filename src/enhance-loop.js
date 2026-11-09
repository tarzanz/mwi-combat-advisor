// 🔁 Enhance ⇄ decompose loop. The game stops an enhancing job when its item
// reaches the target, so each item is a job of its own; they can be queued one
// after another from the +0 stack. The loop counts the jobs the game confirms
// for the item, and once they are all done the +target is decomposed in one go.
// Pure state: enhance-loop-ui.js shows it and feeds it the game's messages.

export const ENHANCE_ACTION = "/actions/enhancing/enhance";
export const DECOMPOSE_ACTION = "/actions/alchemy/decompose";

// "character::location::/items/x::level" -> { itemHrid, level }, or null.
export function hashItem(hash) {
    const parts = String(hash || "").split("::");
    return parts.length >= 4 && parts[2].startsWith("/items/") ? { itemHrid: parts[2], level: Number(parts[3]) || 0 } : null;
}

// A new loop for total items (the +0 you hold). protect: { itemHrid, from } or
// null; catalyst: the decompose's, or null; perItem: what one item takes
// [{ hrid, quantity }] (the item itself, its materials, protections, catalyst),
// for buying the next round; heldTarget: the +target you already hold.
export function newLoop({ itemHrid, target, protect = null, catalyst = null, total, heldTarget = 0, perItem = [] }) {
    return { itemHrid, target, protect, catalyst, total: Math.max(0, Math.floor(total) || 0), perItem, heldAtStart: heldTarget, queued: 0, ended: 0, seen: [], endedIds: [], decompose: null };
}

// The game's action updates (endCharacterActions): a new enhancing job on the
// item counts as queued, one of those that ends as ended, and a decompose of
// the +target the loop's last step. Returns whether anything changed.
export function loopActions(loop, actions) {
    let changed = false;
    for (const a of actions || []) {
        if (!a || a.id === undefined || a.id === null) continue;
        const item = hashItem(a.primaryItemHash);
        if (!item || item.itemHrid !== loop.itemHrid) continue;
        if (a.actionHrid === ENHANCE_ACTION) {
            const known = loop.seen.includes(a.id);
            if (!known && !a.isDone && loop.queued < loop.total) {
                loop.seen.push(a.id);
                loop.queued++;
                changed = true;
            } else if (known && a.isDone && !loop.endedIds.includes(a.id)) {
                loop.endedIds.push(a.id);
                loop.ended++;
                changed = true;
            }
        } else if (a.actionHrid === DECOMPOSE_ACTION && item.level === loop.target && !a.isDone && !loop.decompose) {
            loop.decompose = { id: a.id, count: Number(a.maxCount) || null };
            changed = true;
        }
    }
    return changed;
}

// Where the loop stands. inQueue: the item's enhancing jobs in the game's queue
// now (the running one too); heldZero / heldTarget: the item at +0 / at the
// target in the inventory. phase:
// - "queue": items left to queue (▶ Next, or the game's Add to queue again);
// - "short": items left to queue but no +0 of it left;
// - "running": all queued, some still in the queue;
// - "decompose": all done, the +target to decompose;
// - "empty": all done and none at the target (nothing to decompose);
// - "done": the decompose is queued.
export function loopStatus(loop, { inQueue = 0, heldZero = 0, heldTarget = 0 } = {}) {
    const left = Math.max(0, loop.total - loop.queued);
    let phase;
    if (loop.decompose) phase = "done";
    else if (left > 0) phase = heldZero > 0 ? "queue" : inQueue > 0 ? "running" : heldTarget > 0 ? "decompose" : "short";
    else if (inQueue > 0) phase = "running";
    else phase = heldTarget > 0 ? "decompose" : "empty";
    return { phase, left, queued: loop.queued, ended: loop.ended, total: loop.total, inQueue, heldZero, heldTarget };
}

// The item's enhancing jobs in the queue (characterActions).
export function enhancingInQueue(actions, itemHrid) {
    return (actions || []).filter((a) => a && !a.isDone && a.actionHrid === ENHANCE_ACTION && hashItem(a.primaryItemHash)?.itemHrid === itemHrid).length;
}

// What count more items take: perItem × count, less what you hold (have(hrid)).
export function loopCart(loop, count, have = () => 0) {
    return loop.perItem
        .map((p) => ({ hrid: p.hrid, quantity: Math.ceil(p.quantity * count - 1e-9) - have(p.hrid) }))
        .filter((p) => p.quantity > 0);
}
