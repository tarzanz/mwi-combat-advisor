# MWI Advisor price history on a Raspberry Pi

A small server (Node, no dependencies, in Docker) that fetches the game's market
file every 10 minutes around the clock, keeps every new one, and sends linked
browsers the hours they lack. Browsers still save prices themselves; the Pi's
hours replace theirs, theirs fill in where the Pi has none (while it was down).
Switched on, it also keeps what your devices see of your own market orders, to
judge the listing prices by later (see *Your orders*).

- **Data** in `pi/data/`: `raw/<date>/<timestamp>.json.gz` – every market file
  as it came (about 0.6 MB a day, 220 MB a year; the backup, from which
  everything can be recomputed) – and `state/` – the same hourly (two weeks) and
  daily (a year) records the userscript keeps (about 7 MB + 12 MB a year) – and,
  with orders on, `orders/<month>.jsonl`.
- **Access**: `GET /history` needs the key (`Authorization: Bearer <key>`) and
  answers only the game's sites (CORS). `GET /status` says only whether it runs
  and how new its prices are. Nothing is written from outside – except, when you
  switch it on, `POST /orders` (the same key, the same sites; only order events,
  at most 500 a request, kept apart from the prices).
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
   browser where you play:
   ```sh
   docker compose exec mwia-history node pi/server.mjs link https://mwi-history.example.com
   ```
   It must open in *that* browser, with the userscript manager: tapping it in a chat
   app may open Safari or an in-app browser instead, so copy it and paste it into the
   address bar. The game opens, the script saves address and key and takes them out
   of the address bar. The link carries the key: wherever it is pasted keeps it too. In the marketplace, the price box (*Chart and details*) then says
   *From your Pi …*, with **Read the Pi now** and **Unlink the Pi**.

## Run it

- Update: `git pull && docker compose up -d --build` (in `pi/`).
- Logs: `docker compose logs -f`. A failed market fetch also shows in the browser's box.
- New key: put a new one in `.env`, `docker compose up -d`, and open a new link on each device.
- Recompute the history from the raw files (e.g. after a change in how it is
  computed): `docker compose stop && docker compose run --rm mwia-history node pi/server.mjs rebuild && docker compose start`.
  Browsers notice and read it all again. Market files that came while it was stopped are missed.
- Backup: copy `pi/data/raw/`, `pi/data/orders/` (and `.env`) somewhere else now and then.
- The history as CSV, with what sold in every hour (the browser's export gives it per day):
  `docker compose exec mwia-history node pi/server.mjs csv > history.csv`.

## Your orders

Off by default. With `MWIA_ORDERS=1` in `.env` (then `docker compose up -d`) every
linked device sends what it sees of your market orders: after each read of the Pi,
and a minute after a change. Each line in `data/orders/<month>.jsonl` is one event:

- `kind`: `seen` – an order first seen or changed (filled more, done) – or `gone` –
  missing from the game's full list while it was open (how it ended isn't known).
- `order`: `id`, `item`, `level`, `side`, `price`, `quantity`, `filled`, `status`, `done`;
  `raw`: the game's own fields as they came (plain values only).
- `at`: when the device saw it (its clock, ms), `received`: when it came (the Pi's),
  `device`: a random id and the kind of device. Each device sends its own events, so
  an order shows up from each device that saw it – the earliest `at` is the closest.
- `prediction`, on the first event of an order placed within 15 minutes of a listing
  window for the same item, side and +level: what that window said – `quantity`,
  `best`, `othersBest`, `takenPerHour`, `usual`, every button (`match`, `wall`, and
  `h` 1/8/24 with `price`, `under` (one step past it), `chance`, `windows`, `need`,
  or `why` there was none) and `clicked`, the button used if any.

The devices only see your orders while the game is open: an order that fills while
every device is closed shows up filled at the next look. Between two looks the
market file (`raw/`, or the CSV above) tells when the lowest ask passed its price.
To judge the <1h/<8h/<24h prices, compare an order's `prediction` with the time
from its first event to the one where `filled` reached 70% of `quantity`.
