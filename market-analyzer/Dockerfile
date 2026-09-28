# Build context is the repository root: the worker bundles shared src/ pricing code.
#   docker build -f market-analyzer/Dockerfile -t tarkov-market-analyzer .
FROM node:24-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY market-analyzer/package.json market-analyzer/package-lock.json market-analyzer/
RUN cd market-analyzer && npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY market-analyzer ./market-analyzer
RUN cd market-analyzer && node build.mjs

FROM node:24-alpine
# Source maps also for commands run with `docker compose exec`.
ENV NODE_ENV=production \
	NODE_OPTIONS=--enable-source-maps \
	MARKET_STATE_DIR=/data
WORKDIR /app
COPY --from=build /repo/market-analyzer/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
# Unhealthy when the heartbeat is stale or every mode has failed for 15 minutes.
HEALTHCHECK --interval=2m --timeout=10s --start-period=10m \
	CMD ["node", "dist/worker.cjs", "health"]
ENTRYPOINT ["node", "--enable-source-maps", "dist/worker.cjs"]
CMD ["run"]
