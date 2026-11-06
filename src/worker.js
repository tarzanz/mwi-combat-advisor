import { fill } from "./data-shim.js";
import { runLabyrinthSim, runSim } from "./sim-core.js";

self.onmessage = async (event) => {
    const message = event.data;
    if (message.type === "init") {
        fill(message.data);
        self.postMessage({ type: "ready" });
        return;
    }
    if (message.type === "sim") {
        try {
            const result = message.job.monsterHrid ? await runLabyrinthSim(message.job) : await runSim(message.job);
            self.postMessage({ type: "result", id: message.id, result });
        } catch (error) {
            self.postMessage({ type: "error", id: message.id, error: String(error?.stack || error) });
        }
    }
};
