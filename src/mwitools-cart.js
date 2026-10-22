// Adds items to the shopping cart in MWITools through its public page API,
// window.MWITools.shopping (apiVersion 1). It supports enhancement levels.

const READY_TIMEOUT_MS = 5000;

function shoppingApi(win) {
    try {
        const api = win.MWITools?.shopping;
        return api && typeof api.addToCart === "function" ? api : null;
    } catch {
        return null; // e.g. the object lives in another script sandbox
    }
}

export function cartAvailable(win) {
    return !!shoppingApi(win);
}

async function whenReady(api) {
    const start = Date.now();
    while (!api.ready && Date.now() - start < READY_TIMEOUT_MS) {
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

// items: [{ hrid, quantity, enhancementLevel }]. Something already in the cart is
// topped up to the suggested amount rather than added again, so pressing a
// button twice (or a line and then "add all") does not double the purchase.
export async function addToCart(win, items) {
    const api = shoppingApi(win);
    if (!api) {
        throw new Error("MWITools' shopping cart was not found. Check that MWITools is installed, enabled and up to date, then reload the game.");
    }
    await whenReady(api);
    const outcome = { added: [], updated: [], present: [], failed: [] };
    for (const item of items) {
        const enhancementLevel = item.enhancementLevel || 0;
        const wanted = Math.max(1, Math.ceil(item.quantity));
        const label = { hrid: item.hrid, enhancementLevel };
        try {
            const have = api.getCartItem(item.hrid, enhancementLevel)?.quantity || 0;
            if (have >= wanted) {
                outcome.present.push(label);
                continue;
            }
            const result = api.addToCart([{ itemHrid: item.hrid, enhancementLevel, quantity: wanted - have, source: "manual" }]);
            if (result?.ok) (have ? outcome.updated : outcome.added).push(label);
            else outcome.failed.push(label);
        } catch {
            outcome.failed.push(label);
        }
    }
    return outcome;
}
