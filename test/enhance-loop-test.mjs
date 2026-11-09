// 🔁 Enhance ⇄ decompose loop: the jobs the game confirms, the phases, and the
// next round's shopping.

import { enhancingInQueue, hashItem, loopActions, loopCart, loopStatus, newLoop } from "../src/enhance-loop.js";

let failures = 0;
const check = (name, ok, detail = "") => {
    if (!ok) failures++;
    console.log(`${ok ? "PASS" : "FAIL"} ${name}${!ok && detail ? " — " + detail : ""}`);
};

const TOME = "/items/tome_of_healing";
const hash = (item, level) => `1::/item_locations/inventory::${item}::${level}`;
const enhance = (id, extra = {}) => ({ id, actionHrid: "/actions/enhancing/enhance", primaryItemHash: hash(TOME, 0), isDone: false, ...extra });

check("an item hash is read", JSON.stringify(hashItem(hash(TOME, 6))) === JSON.stringify({ itemHrid: TOME, level: 6 }) && hashItem("") === null && hashItem("1::x") === null);

const loop = newLoop({ itemHrid: TOME, target: 6, total: 3, heldTarget: 1, perItem: [{ hrid: TOME, quantity: 1 }, { hrid: "/items/holy_milk", quantity: 238 * 2.5 }] });
let st = loopStatus(loop, { heldZero: 3, heldTarget: 1 });
check("a new loop: items to queue", st.phase === "queue" && st.left === 3 && st.queued === 0, JSON.stringify(st));

// Two jobs confirmed, one of another item and one of another kind ignored.
const changed = loopActions(loop, [enhance(10), enhance(11), enhance(12, { primaryItemHash: hash("/items/cheese_sword", 0) }), { id: 13, actionHrid: "/actions/alchemy/coinify", primaryItemHash: hash(TOME, 0) }]);
check("the item's new enhancing jobs count as queued", changed && loop.queued === 2 && loop.seen.join() === "10,11", JSON.stringify(loop));
check("the same job seen again counts once", !loopActions(loop, [enhance(10)]) && loop.queued === 2);
st = loopStatus(loop, { inQueue: 2, heldZero: 3, heldTarget: 1 });
check("one left to queue", st.phase === "queue" && st.left === 1);
// The game may say more jobs than the loop holds (one queued by hand): never past the total.
loopActions(loop, [enhance(14), enhance(15)]);
check("never more queued than the loop's items", loop.queued === 3 && loop.seen.length === 3);
st = loopStatus(loop, { inQueue: 3, heldZero: 2, heldTarget: 1 });
check("all queued, still running", st.phase === "running" && st.left === 0);
// A job that ends counts once; a job the loop didn't queue doesn't.
loopActions(loop, [enhance(10, { isDone: true }), enhance(10, { isDone: true }), enhance(15, { isDone: true })]);
check("an ended job counts once", loop.ended === 1 && loop.endedIds.join() === "10");
st = loopStatus(loop, { inQueue: 0, heldZero: 0, heldTarget: 4 });
check("all done: decompose the +target", st.phase === "decompose");
check("…none at the target: nothing to decompose", loopStatus(loop, { inQueue: 0, heldZero: 0, heldTarget: 0 }).phase === "empty");
// A decompose of another level isn't the loop's; of the +target it is.
loopActions(loop, [{ id: 20, actionHrid: "/actions/alchemy/decompose", primaryItemHash: hash(TOME, 3), maxCount: 1 }]);
check("a decompose of another +level isn't the loop's", !loop.decompose);
loopActions(loop, [{ id: 21, actionHrid: "/actions/alchemy/decompose", primaryItemHash: hash(TOME, 6), maxCount: 4 }]);
check("the decompose of the +target ends the loop", loop.decompose?.count === 4 && loopStatus(loop, { heldTarget: 4 }).phase === "done");

// Out of items with some left to queue.
const short = newLoop({ itemHrid: TOME, target: 6, total: 5 });
loopActions(short, [enhance(1)]);
check("items left but no +0: running while one is queued", loopStatus(short, { inQueue: 1, heldZero: 0 }).phase === "running");
check("…then decompose what was made", loopStatus(short, { inQueue: 0, heldZero: 0, heldTarget: 1 }).phase === "decompose");
check("…or short with nothing made", loopStatus(short, { inQueue: 0, heldZero: 0, heldTarget: 0 }).phase === "short");

check("the item's enhancing jobs in the queue", enhancingInQueue([enhance(1), enhance(2, { primaryItemHash: hash(TOME, 4) }), enhance(3, { primaryItemHash: hash("/items/cheese_sword", 0) }), { id: 4, actionHrid: "/actions/alchemy/decompose", primaryItemHash: hash(TOME, 6) }], TOME) === 2);
const cart = loopCart(loop, 3, (hrid) => (hrid === TOME ? 1 : 0));
check("the next round: per item × count, less what you hold", JSON.stringify(cart) === JSON.stringify([{ hrid: TOME, quantity: 2 }, { hrid: "/items/holy_milk", quantity: 1785 }]), JSON.stringify(cart));

console.log(failures ? `${failures} check(s) failed` : "All checks passed");
process.exit(failures ? 1 : 0);
