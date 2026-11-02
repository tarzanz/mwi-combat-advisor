// Price history from your own always-on server (pi/server.mjs, e.g. on a
// Raspberry Pi): it collects the market file around the clock, and every
// device linked to it fetches the hours it lacks every 15 minutes. Its hours
// replace the ones collected here; these fill in where it has none (while it
// was down, say). Linked once per device by opening the link the server
// prints (…milkywayidle.com/#mwia-pi=…); address and key stay in this
// browser's storage for the game's site, across script updates. When the Pi
// takes them (MWIA_ORDERS=1), the events of your own market orders go to it
// too (order-log.js): after each sync, and a minute after a change. So do your
// job results and purchases (job-log.js), read back by every device: after each
// sync, a minute after a change, and when the Loot & XP Log opens.

import { loadHistory, mergeFromPi, piReceived } from "./price-history.js";
import { unpackRecord } from "./history-wire.js";
import { deviceName, dropQueued, onOrderEvents, queuedOrders } from "./order-log.js";
import { jobsForPi, jobsFromPi, jobsPiSeq, jobsSentToPi, onJobsChanged, useJobSync } from "./job-log.js";

const CONFIG_KEY = "mwia-pi";
const SYNC_EVERY_MS = 15 * 60 * 1000;
const FIRST_SYNC_MS = 3000;
const ORDERS_AFTER_MS = 60 * 1000;
// Order events per request, and requests per send.
const ORDER_BATCH = 100;
const ORDER_BATCHES = 10;
// Job results and purchases per request.
const JOB_BATCH = 25;

// status: ok (null before the first try), at: the last good sync, error, newest: the Pi's newest file, piError: its own last fetch error,
// orders: null (the Pi doesn't take them) or { at: the last send, sent: in it, waiting, error }.
// jobs: null (the Pi doesn't take them) or { at: the last sync, error }.
const NO_STATUS = { ok: null, at: null, error: "", newest: null, piError: null, orders: null, jobs: null };
const p = { running: null, sending: null, jobSync: null, ordersTimer: null, jobsTimer: null, tried: 0, status: { ...NO_STATUS }, listeners: new Set() };

// A link from the server: saves its address and key, then takes them out of the address bar.
export function readPairing(win) {
    const match = /(?:^#|&)mwia-pi=([A-Za-z0-9_-]+)/.exec(win.location.hash);
    if (!match) return;
    try {
        const { u, k } = JSON.parse(atob(match[1].replace(/-/g, "+").replace(/_/g, "/")));
        if (typeof u === "string" && /^https?:\/\//.test(u) && typeof k === "string" && k) localStorage.setItem(CONFIG_KEY, JSON.stringify({ url: u.replace(/\/+$/, ""), key: k }));
    } catch (error) {
        console.warn("[MWI Advisor] Pi link", error);
    }
    const rest = win.location.hash.replace(/(^#|&)mwia-pi=[^&]*/, "$1").replace(/^#&/, "#");
    win.history.replaceState(win.history.state, "", win.location.pathname + win.location.search + (rest === "#" ? "" : rest));
}

export function piConfig() {
    try {
        return JSON.parse(localStorage.getItem(CONFIG_KEY) || "null");
    } catch {
        return null;
    }
}

export const piStatus = () => p.status;

// Called after a sync (added: whether new prices came in).
export function onPiSync(listener) {
    p.listeners.add(listener);
}

export function unlinkPi() {
    localStorage.removeItem(CONFIG_KEY);
    p.status = { ...NO_STATUS };
    notify(false);
}

export function startPiSync() {
    onOrderEvents(() => {
        clearTimeout(p.ordersTimer);
        if (p.status.orders) p.ordersTimer = setTimeout(sendOrders, ORDERS_AFTER_MS);
    });
    onJobsChanged(() => {
        clearTimeout(p.jobsTimer);
        if (p.status.jobs) p.jobsTimer = setTimeout(syncJobs, ORDERS_AFTER_MS);
    });
    // The Loot & XP Log reads the Pi first, when it takes jobs.
    useJobSync(() => (piConfig() && p.status.jobs ? syncJobs() : Promise.resolve()));
    setTimeout(syncNow, FIRST_SYNC_MS);
    setInterval(syncNow, SYNC_EVERY_MS);
    // Phones pause timers in the background: catch up on return.
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden && Date.now() - p.tried > SYNC_EVERY_MS) syncNow();
    });
}

function notify(added) {
    for (const listener of p.listeners) listener(added);
}

export function syncNow() {
    const config = piConfig();
    if (!config) return Promise.resolve();
    p.running ||= (async () => {
        p.tried = Date.now();
        let added = false;
        try {
            await loadHistory();
            const known = piReceived();
            const query = new URLSearchParams(known ? { epoch: known.epoch, items: known.items, hour: known.hour ?? "", day: known.day ?? "" } : {});
            const response = await fetch(`${config.url}/history?${query}`, { headers: { Authorization: `Bearer ${config.key}` }, cache: "no-store", signal: AbortSignal.timeout?.(120000) });
            if (response.status === 401) throw new Error("it refused the key – open a new link from it");
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const wire = await response.json();
            const result = await mergeFromPi(wire, unpackRecord);
            added = result.hours > 0 || result.days > 0;
            const takesOrders = !!wire.status?.orders;
            const takesJobs = !!wire.status?.jobs;
            p.status = { ok: true, at: Date.now(), error: "", newest: wire.status?.newest ?? null, piError: wire.status?.lastError ?? null, orders: takesOrders ? p.status.orders || { at: null, sent: 0, waiting: queuedOrders().length, error: "" } : null, jobs: takesJobs ? p.status.jobs || { at: null, error: "" } : null };
            if (takesOrders) await sendOrders();
            if (takesJobs) await syncJobs();
        } catch (error) {
            p.status = { ...p.status, ok: false, error: error.message || String(error) };
        } finally {
            p.running = null;
        }
        notify(added);
    })();
    return p.running;
}

// Sends the queued order events, a batch at a time; each batch leaves the queue once the Pi has it.
export function sendOrders() {
    const config = piConfig();
    if (!config || !p.status.orders) return Promise.resolve();
    p.sending ||= (async () => {
        let sent = 0;
        let error = "";
        try {
            for (let k = 0; k < ORDER_BATCHES; k++) {
                const events = queuedOrders().slice(0, ORDER_BATCH);
                if (!events.length) break;
                const response = await fetch(`${config.url}/orders`, {
                    method: "POST",
                    headers: { Authorization: `Bearer ${config.key}`, "Content-Type": "application/json" },
                    body: JSON.stringify({ device: deviceName(), events }),
                    cache: "no-store",
                    signal: AbortSignal.timeout?.(60000),
                });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                dropQueued(events.map((event) => event.uid));
                sent += events.length;
            }
        } catch (e) {
            error = e.message || String(e);
        } finally {
            p.sending = null;
        }
        p.status = { ...p.status, orders: { at: Date.now(), sent, waiting: queuedOrders().length, error } };
        notify(false);
    })();
    return p.sending;
}

// Job results and purchases: reads what is new on the Pi (other devices'),
// then sends what it lacks, a batch at a time.
export function syncJobs() {
    const config = piConfig();
    if (!config || !p.status.jobs) return Promise.resolve();
    p.jobSync ||= (async () => {
        let error = "";
        const headers = { Authorization: `Bearer ${config.key}` };
        try {
            const response = await fetch(`${config.url}/jobs?after=${jobsPiSeq()}`, { headers, cache: "no-store", signal: AbortSignal.timeout?.(30000) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            jobsFromPi(await response.json());
            for (let k = 0; k < ORDER_BATCHES; k++) {
                const all = jobsForPi();
                const reports = all.reports.slice(0, JOB_BATCH);
                const purchases = all.purchases.slice(0, Math.max(0, JOB_BATCH * 4 - reports.length));
                if (!reports.length && !purchases.length) break;
                const sent = await fetch(`${config.url}/jobs`, {
                    method: "POST",
                    headers: { ...headers, "Content-Type": "application/json" },
                    body: JSON.stringify({ device: deviceName(), reports, purchases }),
                    cache: "no-store",
                    signal: AbortSignal.timeout?.(30000),
                });
                if (!sent.ok) throw new Error(`HTTP ${sent.status}`);
                jobsSentToPi({ reports: reports.map((r) => r.key), purchases: purchases.map((x) => x.uid) });
            }
        } catch (e) {
            error = e.message || String(e);
        } finally {
            p.jobSync = null;
        }
        p.status = { ...p.status, jobs: { at: Date.now(), error } };
        notify(false);
    })();
    return p.jobSync;
}
