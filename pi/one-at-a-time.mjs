// The Pi's heavy jobs (the 📈 plan, the Labyrinth run simulation) run one at a time: each
// is a process of its own with its own heap, and two at once have run the Pi out of memory.
let last = Promise.resolve();

// Runs job() when the jobs before it are done; resolves (or rejects) with it.
export function oneAtATime(job) {
    const mine = last.then(job, job);
    last = mine.catch(() => {});
    return mine;
}
