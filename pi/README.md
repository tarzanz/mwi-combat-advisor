# MWI Advisor price history on a Raspberry Pi

A small server (Node, no dependencies, in Docker) that fetches the game's market
file every 10 minutes around the clock, keeps every new one, and sends linked
browsers the hours they lack. Browsers still save prices themselves; the Pi's
hours replace theirs, theirs fill in where the Pi has none (while it was down).

- **Data** in `pi/data/`: `raw/<date>/<timestamp>.json.gz` – every market file
  as it came (about 0.6 MB a day, 220 MB a year; the backup, from which
  everything can be recomputed) – and `state/` – the same hourly (two weeks) and
  daily (a year) records the userscript keeps (about 7 MB + 12 MB a year).
- **Access**: `GET /history` needs the key (`Authorization: Bearer <key>`) and
  answers only the game's sites (CORS). `GET /status` says only whether it runs
  and how new its prices are. Nothing is written from outside.
- **Secrets** stay on the Pi: the key in `pi/.env` (not in git). Each browser gets
  it once from a link and keeps it in its own storage for the game's site.

## Set up

1. Clone the repository on the Pi, then in it:
   ```sh
   cd pi
   mkdir -p data
   # a new key into .env (see .env.example):
   echo "MWIA_KEY=$(openssl rand -base64 32 | tr '+/' '-_' | tr -d '=')" > .env
   # if your user is not 1000:1000 (id -u / id -g), also: echo "MWIA_UID=$(id -u)" >> .env; echo "MWIA_GID=$(id -g)" >> .env
   docker compose up -d --build
   curl -s http://127.0.0.1:8787/status
   ```
   (`MWIA_UID`/`MWIA_GID` are read by compose from `.env` in this folder.)
2. **Cloudflare Tunnel**: a public hostname (e.g. `mwi-history.example.com`) to
   `http://localhost:8787`. If `cloudflared` itself runs in Docker without host
   networking, point it at the host instead (or put both on one Docker network and
   use `http://mwia-history:8787`). Keep caching off for it (the server sends
   `Cache-Control: no-store`). Optional: a Cloudflare rate-limit rule on the hostname.
3. **Link each browser** (phone, computer): print the link and open it once in the
   browser where you play (a QR code is easiest on the phone):
   ```sh
   docker compose exec mwia-history node pi/server.mjs link https://mwi-history.example.com
   docker compose exec mwia-history node pi/server.mjs link https://mwi-history.example.com | qrencode -t ansiutf8
   ```
   The game opens, the script saves address and key and takes them out of the
   address bar. In the marketplace, the price box (*Chart and details*) then says
   *From your Pi …*, with **Read the Pi now** and **Unlink the Pi**.

## Run it

- Update: `git pull && docker compose up -d --build` (in `pi/`).
- Logs: `docker compose logs -f`. A failed market fetch also shows in the browser's box.
- New key: put a new one in `.env`, `docker compose up -d`, and open a new link on each device.
- Recompute the history from the raw files (e.g. after a change in how it is
  computed): `docker compose stop && docker compose run --rm mwia-history node pi/server.mjs rebuild && docker compose start`.
  Browsers notice and read it all again. Market files that came while it was stopped are missed.
- Backup: copy `pi/data/raw/` (and `.env`) somewhere else now and then.
