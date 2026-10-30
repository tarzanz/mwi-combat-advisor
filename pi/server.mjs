// MWI Advisor's price history on a Raspberry Pi (or any always-on machine):
// fetches the game's market file every 10 minutes, keeps every new one, and
// sends the userscript the hours and days it lacks. With MWIA_ORDERS=1 it also
// keeps what your devices send about your own market orders (order-store.mjs).
// No dependencies.
//
//   node pi/server.mjs              serve (the default)
//   node pi/server.mjs rebuild      recompute the history from the raw files
//   node pi/server.mjs csv          print the history as CSV, with what sold every hour
//   node pi/server.mjs link <url>   print the link that connects a browser (url: this server's https address)
//   node pi/server.mjs key          print a new random key for MWIA_KEY
//
// Settings (environment): MWIA_KEY (required to serve, at least 24 characters),
// MWIA_DATA (default /data), PORT (default 8787), MWIA_MARKET_URL, MWIA_ORIGINS
// (the game's sites allowed to read, comma separated), MWIA_ORDERS (1: take your
// devices' order events), MWIA_LOG_REQUESTS (0: don't log each request; the key is never logged).

import http from "node:http";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { gzipSync } from "node:zlib";
import { openStore } from "./history-store.mjs";
import { MAX_EVENTS, openOrderStore } from "./order-store.mjs";

const DATA = process.env.MWIA_DATA || "/data";
const PORT = Number(process.env.PORT || 8787);
const KEY = process.env.MWIA_KEY || "";
const MARKET_URL = process.env.MWIA_MARKET_URL || "https://www.milkywayidle.com/game_data/marketplace.json";
const ORIGINS = new Set((process.env.MWIA_ORIGINS || "https://www.milkywayidle.com,https://test.milkywayidle.com,https://www.milkywayidlecn.com").split(",").map((o) => o.trim()).filter(Boolean));
const GAME_URL = "https://www.milkywayidle.com/";
const POLL_MS = 10 * 60 * 1000;
const LOG_REQUESTS = process.env.MWIA_LOG_REQUESTS !== "0";
const ORDERS = process.env.MWIA_ORDERS === "1";
// A request with order events may be at most this big.
const MAX_BODY = 1024 * 1024;

const log = (...args) => console.log(new Date().toISOString(), ...args);
const digest = (text) => createHash("sha256").update(text).digest();
// One line per request: what was asked, the answer, and who asked (never the key).
// The container's own health check (/status from inside) is left out.
const logRequest = (req, res, url, started) => {
    const local = !req.headers["cf-ray"] && ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(req.socket.remoteAddress);
    if (local && url.pathname === "/status") return;
    const history = url.pathname === "/history";
    const fields = {
        // What the browser already had: nothing (it gets everything), or its newest hour and day.
        from: history && !url.searchParams.get("epoch") ? "start" : null,
        hour: history && url.searchParams.get("hour"),
        day: history && url.searchParams.get("day"),
        events: res.mwiaEvents,
        key: req.headers.authorization ? (res.statusCode === 401 ? "wrong" : "ok") : "none",
        origin: req.headers.origin,
        country: req.headers["cf-ipcountry"],
        agent: req.headers["user-agent"] && JSON.stringify(req.headers["user-agent"].slice(0, 160)),
    };
    const details = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `${k}=${v}`).join(" ");
    log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started} ms ${details}`);
};
const authorized = (req) => {
    const header = req.headers.authorization || "";
    return header.startsWith("Bearer ") && timingSafeEqual(digest(header.slice(7)), digest(KEY));
};

const [command = "serve", arg] = process.argv.slice(2);

if (command === "key") {
    console.log(randomBytes(24).toString("base64url"));
} else if (command === "link") {
    if (!arg || !/^https:\/\//.test(arg) || !KEY) throw new Error("Usage: MWIA_KEY=… node pi/server.mjs link https://<this server's address>");
    const pairing = Buffer.from(JSON.stringify({ u: arg.replace(/\/+$/, ""), k: KEY })).toString("base64url");
    console.log(`${GAME_URL}#mwia-pi=${pairing}`);
} else if (command === "rebuild") {
    openStore(DATA).rebuild(log);
} else if (command === "csv") {
    process.stdout.write(openStore(DATA).csv());
} else if (command === "serve") {
    serve();
} else {
    throw new Error(`Unknown command ${command}`);
}

function serve() {
    if (KEY.length < 24) throw new Error("Set MWIA_KEY to a secret of at least 24 characters (node pi/server.mjs key makes one).");
    const store = openStore(DATA);
    const orders = ORDERS ? openOrderStore(DATA) : null;
    const health = { lastFetch: null, lastError: null };

    async function poll() {
        try {
            const response = await fetch(MARKET_URL, { cache: "no-store", signal: AbortSignal.timeout(60000) });
            if (!response.ok) throw new Error(`market file: HTTP ${response.status}`);
            const added = store.addFile(await response.text());
            health.lastFetch = new Date().toISOString();
            health.lastError = null;
            if (added) log("new market file", store.status());
        } catch (error) {
            health.lastError = String(error.message || error);
            log("fetch failed:", health.lastError);
        }
    }
    poll();
    setInterval(poll, POLL_MS);

    // The request's body as JSON, or null when it is too big.
    const readJson = (req) => new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        req.on("data", (chunk) => {
            size += chunk.length;
            if (size <= MAX_BODY) chunks.push(chunk);
        });
        req.on("end", () => {
            if (size > MAX_BODY) return resolve(null);
            try {
                resolve(JSON.parse(Buffer.concat(chunks).toString() || "null"));
            } catch (error) {
                reject(Object.assign(error, { status: 400 }));
            }
        });
        req.on("error", reject);
    });

    const server = http.createServer(async (req, res) => {
        const origin = req.headers.origin;
        if (origin && ORIGINS.has(origin)) {
            res.setHeader("Access-Control-Allow-Origin", origin);
            res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
            res.setHeader("Access-Control-Allow-Methods", ORDERS ? "GET, POST" : "GET");
            res.setHeader("Access-Control-Max-Age", "86400");
        }
        res.setHeader("Vary", "Origin");
        const send = (status, body) => {
            const text = JSON.stringify(body);
            res.setHeader("Content-Type", "application/json");
            res.setHeader("Cache-Control", "no-store");
            if (/\bgzip\b/.test(req.headers["accept-encoding"] || "") && text.length > 1024) {
                res.setHeader("Content-Encoding", "gzip");
                res.writeHead(status).end(gzipSync(text));
            } else res.writeHead(status).end(text);
        };
        const url = new URL(req.url, "http://localhost");
        if (LOG_REQUESTS) {
            const started = Date.now();
            res.on("finish", () => logRequest(req, res, url, started));
        }
        try {
            if (req.method === "OPTIONS") return res.writeHead(204).end();
            // Your devices' order events: the only thing written from outside, and only when switched on.
            if (req.method === "POST" && url.pathname === "/orders" && orders) {
                if (!authorized(req)) return send(401, { error: "wrong or missing key" });
                const body = await readJson(req);
                if (!body) return send(413, { error: "too big" });
                if (!Array.isArray(body.events) || body.events.length > MAX_EVENTS) return send(400, { error: `events: a list of at most ${MAX_EVENTS}` });
                const result = orders.add(body.device, body.events);
                res.mwiaEvents = `${result.accepted}+${result.duplicates}dup${result.rejected ? `+${result.rejected}bad` : ""}`;
                return send(200, result);
            }
            if (req.method !== "GET") return send(405, { error: ORDERS ? "GET, or POST to /orders" : "GET only" });
            // Says whether it runs, not what it holds.
            if (url.pathname === "/status") return send(200, { ok: true, newest: store.status().newest, lastError: health.lastError });
            if (url.pathname !== "/history") return send(404, { error: "not found" });
            if (!authorized(req)) return send(401, { error: "wrong or missing key" });
            return send(200, { ...store.since(Object.fromEntries(url.searchParams)), status: { ...store.status(), ...health, orders: orders ? orders.status() : null } });
        } catch (error) {
            if (error.status === 400) return send(400, { error: "not JSON" });
            log("request failed:", error);
            return send(500, { error: "server error" });
        }
    });
    server.listen(PORT, () => log(`listening on ${PORT}, data in ${DATA}`, store.status(), orders ? { orders: orders.status() } : "orders off"));
}
