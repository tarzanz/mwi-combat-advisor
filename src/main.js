import WORKER_SOURCE from "virtual:worker-source";
import { installSocketHook } from "./game-state.js";
import { mountUI } from "./ui.js";
import { mountPlanTrain } from "./train-ui.js";
import { startPriceHistory } from "./price-history-ui.js";
import { startListingPrices } from "./listing-price-ui.js";
import { readPairing } from "./pi-sync.js";
import { startVersionTag } from "./version-tag.js";

const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

installSocketHook(win);
// A link from the Pi (…#mwia-pi=…) links this browser to it.
readPairing(win);

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => mount());
} else {
    mount();
}

function mount() {
    mountUI(win, WORKER_SOURCE);
    mountPlanTrain(win);
    startPriceHistory(win);
    startListingPrices(win);
    startVersionTag();
}
