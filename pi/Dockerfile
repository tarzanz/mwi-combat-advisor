# Built from the repository root (the history code is shared with the userscript):
#   docker compose -f pi/docker-compose.yml up -d --build
# Every file copied below must also be let through in /.dockerignore.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src/price-history.js src/history-wire.js ./src/
# The 📈 plan's maths, the same files as the userscript's Skilling tab.
COPY src/horizon.js src/skilling.js src/skilling-upgrades.js src/levels.js src/alchemy.js src/alchemy-chain.js src/enhancing.js ./src/
COPY pi/history-store.mjs pi/order-store.mjs pi/job-store.mjs pi/labyrinth-store.mjs pi/plan-store.mjs pi/planner.mjs pi/server.mjs ./pi/
ENV MWIA_DATA=/data PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=5m --timeout=10s CMD wget -qO- http://127.0.0.1:8787/status >/dev/null || exit 1
CMD ["node", "pi/server.mjs"]
