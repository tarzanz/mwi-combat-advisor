// A small pool of web workers that each hold the engine and the game data.

export class SimPool {
    constructor(workerSource, tables, size) {
        this.url = URL.createObjectURL(new Blob([workerSource], { type: "text/javascript" }));
        this.tables = tables;
        this.size = size;
        this.workers = [];
        this.queue = [];
        this.pending = new Map();
        this.nextId = 1;
        this.cancelled = false;
    }

    async start() {
        const ready = [];
        for (let i = 0; i < this.size; i++) {
            const worker = new Worker(this.url);
            const entry = { worker, busy: true };
            ready.push(
                new Promise((resolve, reject) => {
                    worker.onmessage = (event) => {
                        if (event.data.type === "ready") {
                            worker.onmessage = (e) => this.onResult(entry, e.data);
                            entry.busy = false;
                            resolve();
                        }
                    };
                    worker.onerror = (event) => reject(new Error(event.message || "Simulation worker error"));
                })
            );
            worker.postMessage({ type: "init", data: this.tables });
            this.workers.push(entry);
        }
        await Promise.all(ready);
    }

    run(job) {
        return new Promise((resolve, reject) => {
            this.queue.push({ id: this.nextId++, job, resolve, reject });
            this.pump();
        });
    }

    // Runs all jobs; onProgress(done, total) is called as they finish.
    async runAll(jobs, onProgress) {
        this.cancelled = false;
        let done = 0;
        return Promise.all(
            jobs.map((job) =>
                this.run(job).then((result) => {
                    done++;
                    onProgress?.(done, jobs.length);
                    return result;
                })
            )
        );
    }

    cancel() {
        this.cancelled = true;
        const error = new Error("Cancelled");
        for (const task of this.queue) task.reject(error);
        this.queue = [];
    }

    pump() {
        for (const entry of this.workers) {
            if (entry.busy || this.queue.length === 0) continue;
            const task = this.queue.shift();
            entry.busy = true;
            this.pending.set(task.id, task);
            entry.worker.postMessage({ type: "sim", id: task.id, job: task.job });
        }
    }

    onResult(entry, message) {
        entry.busy = false;
        const task = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (task) {
            if (message.type === "result") task.resolve(message.result);
            else task.reject(new Error(message.error));
        }
        this.pump();
    }

    terminate() {
        for (const entry of this.workers) entry.worker.terminate();
        this.workers = [];
        URL.revokeObjectURL(this.url);
    }
}
