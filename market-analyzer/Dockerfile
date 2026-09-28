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
ENV NODE_ENV=production \
	MARKET_STATE_DIR=/data
WORKDIR /app
COPY --from=build /repo/market-analyzer/dist ./dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
# The loop writes a heartbeat every tick; a cold start polls every mode first.
HEALTHCHECK --interval=2m --timeout=10s --start-period=10m \
	CMD node -e "const h=require('/data/heartbeat.json');process.exit(Date.now()-h.at<10*60*1000?0:1)"
ENTRYPOINT ["node", "--enable-source-maps", "dist/worker.cjs"]
CMD ["run"]
