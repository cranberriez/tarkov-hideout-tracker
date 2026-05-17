# Cron Jobs

## Overview

A single Vercel cron job refreshes Tarkov Market prices once per day. Market prices are too expensive to fetch on every request — the bulk cron approach fetches all prices once and stores them in Redis for the read path to consume cheaply.

---

## `GET /api/cron/bulk-update`

**File:** `src/app/api/cron/bulk-update/route.ts`
**Schedule:** `0 0 * * *` (daily at 00:00 UTC)
**Configured in:** `vercel.json`

### Authentication

Protected by a bearer token. Vercel injects it automatically; manual calls must include:

```
Authorization: Bearer <CRON_SECRET>
```

Requests without a valid token return HTTP 401.

### What It Does

1. Calls `refreshTarkovMarketPrices("PVP")` and `refreshTarkovMarketPrices("PVE")` in parallel.
2. Returns a JSON summary of the result (items written, any errors).

---

## `refreshTarkovMarketPrices(mode)`

**File:** `src/server/services/tarkovMarketBulk.ts`

### Process

1. Fetch the full item catalogue from Tarkov Market:
   - PVP: `https://api.tarkov-market.app/api/v1/items/all`
   - PVE: `https://api.tarkov-market.app/api/v1/pve/items/all`
   - Auth header: `x-api-key: <TARKOV_MARKET_KEY>`

2. Load the list of hideout-required items from Redis (`hideout:items:filtered:v1`) to get their `normalizedName`s.

3. Filter the full Tarkov Market response to only items in the required set.

4. Write a compact map `{ normalizedName: MarketPrice }` to Redis:
   - PVP: `tarkov-market:all-prices:filtered:v1:pvp`
   - PVE: `tarkov-market:all-prices:filtered:v1:pve`

### MarketPrice Shape

```ts
interface MarketPrice {
  price?: number;           // current flea price
  avg24hPrice?: number;
  avg7daysPrice?: number;
  diff24h?: number;         // % price change in 24h
  updated?: string;         // ISO timestamp from Tarkov Market
  traderName?: string;
  traderPrice?: number;
  traderPriceCur?: string;  // currency code
}
```

---

## Read Path

Client components never call Tarkov Market directly. Prices are read via `getCachedMarketPrices()` in `PriceDataLayout` (a server component):

```
Cron writes Redis → getCachedMarketPrices reads Redis → PriceDataContext → client components
```

If the cron job hasn't run yet (e.g., fresh deploy), `getCachedMarketPrices` returns an empty price map. Components gracefully handle `null`/`undefined` prices by showing `-`.

---

## Manual Trigger

To refresh prices outside the cron schedule (e.g., after a game patch), send:

```
GET /api/cron/bulk-update
Authorization: Bearer <CRON_SECRET>
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| All prices show `-` | Redis key missing or cron never ran | Trigger the cron manually |
| PVE prices missing | Tarkov Market PVE endpoint error | Check Tarkov Market API status; re-trigger cron |
| Cron returns 401 | `CRON_SECRET` env var mismatch | Verify env var in Vercel dashboard |
| Prices very stale | Cron is failing silently | Check Vercel cron logs in the dashboard |
