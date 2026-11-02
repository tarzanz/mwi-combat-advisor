// What a material may cost for a skilling job to keep its margin, for the
// Buy Listing window's "Profit" button. The Skilling list sets the jobs each
// time it is worked out; the job whose 🛒 Materials was tapped last comes first.

const OLD_MS = 12 * 3600 * 1000;
const s = { jobs: [], at: 0, preferred: null };

// jobs: [{ hrid, name, inputs: [{ itemHrid, limitPrice, margin }] }], in the list's order.
export function setBuyLimits(jobs, now = Date.now()) {
    s.jobs = jobs;
    s.at = now;
}

// The job the player is buying for (its 🛒 Materials was tapped).
export function preferBuyLimits(actionHrid) {
    s.preferred = actionHrid || null;
}

// The limit for an item: { price, margin, job } from the preferred job if it
// uses the item, else the highest-ranked one that does; null if none (or too old).
export function buyLimit(itemHrid, now = Date.now()) {
    if (!s.jobs.length || now - s.at > OLD_MS) return null;
    const using = s.jobs.filter((job) => job.inputs.some((i) => i.itemHrid === itemHrid));
    const job = using.find((j) => j.hrid === s.preferred) || using[0];
    if (!job) return null;
    const input = job.inputs.find((i) => i.itemHrid === itemHrid);
    return Number.isFinite(input.limitPrice) ? { price: input.limitPrice, margin: input.margin, job: job.name, at: s.at } : null;
}
