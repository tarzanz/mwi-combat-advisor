# Built from the repository root (the history code is shared with the userscript):
#   docker compose -f pi/docker-compose.yml up -d --build
# Every file copied below must also be let through in /.dockerignore.
FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY src/price-history.js src/history-wire.js ./src/
COPY pi/history-store.mjs pi/order-store.mjs pi/server.mjs ./pi/
ENV MWIA_DATA=/data PORT=8787
EXPOSE 8787
HEALTHCHECK --interval=5m --timeout=10s CMD wget -qO- http://127.0.0.1:8787/status >/dev/null || exit 1
CMD ["node", "pi/server.mjs"]
