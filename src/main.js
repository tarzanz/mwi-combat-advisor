import WORKER_SOURCE from "virtual:worker-source";
import { installSocketHook } from "./game-state.js";
import { mountUI } from "./ui.js";
import { mountPlanTrain } from "./train-ui.js";
import { mountEnhanceLoop } from "./enhance-loop-ui.js";
import { startPriceHistory } from "./price-history-ui.js";
import { startListingPrices } from "./listing-price-ui.js";
import { readPairing } from "./pi-sync.js";
import { startOrderLog } from "./order-log.js";
import { startVersionTag } from "./version-tag.js";
import { startExportButton } from "./export.js";
import { usePageWindow } from "./game-nav.js";

const win = typeof unsafeWindow !== "undefined" ? unsafeWindow : window;

installSocketHook(win);
// The game's React is seen from the page's side, also from a sandbox.
usePageWindow(win);
// Your market orders, for the Pi: listening from the start, so the first full list isn't missed.
startOrderLog();
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
    mountEnhanceLoop(win);
    startPriceHistory(win);
    startListingPrices(win);
    startVersionTag();
    startExportButton(win);
}
