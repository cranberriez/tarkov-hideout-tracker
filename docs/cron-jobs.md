# Cron Jobs

## Overview

A single Vercel cron job refreshes Tarkov.dev flea market prices once per day. Market prices are dynamic enough that the app keeps them separate from base item metadata, but the refresh only fetches hideout-required and quest-required items rather than the full item catalogue.

---

## `GET /api/cron/price-update`

**File:** `src/app/api/cron/price-update/route.ts`
**Schedule:** `0 0 * * *` (daily at 00:00 UTC)
**Configured in:** `vercel.json`

### Authentication

Protected by a bearer token. Vercel injects it automatically; manual calls must include:

```text
Authorization: Bearer <CRON_SECRET>
```

Requests without a valid token return HTTP 401.

### What It Does

1. Calls `refreshTarkovDevMarketPrices("PVP")` and `refreshTarkovDevMarketPrices("PVE")` in parallel.
2. Returns a JSON summary of the result.

---

## `refreshTarkovDevMarketPrices(mode)`

**File:** `src/server/services/tarkovDevMarket.ts`

### Process

1. Load hideout-required items from `getHideoutRequiredItems()` and quest-required items from `getCachedFullQuestData()`.
2. Fetch volatile flea market fields from Tarkov.dev GraphQL:
   - PVP: `gameMode: regular`
   - PVE: `gameMode: pve`
3. Write a compact map `{ normalizedName: MarketPrice | null }` to Redis:
   - PVP: `item-market-data:filtered:v2:pvp`
   - PVE: `item-market-data:filtered:v2:pve`

### MarketPrice Shape

```ts
interface MarketPrice {
  price?: number | null;                  // compatibility alias from lastLowPrice
  avg24hPrice?: number | null;
  high24hPrice?: number | null;
  low24hPrice?: number | null;
  lastLowPrice?: number | null;
  lastOfferCount?: number | null;
  changeLast48hPercent?: number | null;
  diff24h?: number | null;                // compatibility alias from changeLast48hPercent
}
```

If flea fields are `null`, the item is not available on the flea market for that game mode. The current UI renders those values as `-`.

---

## Read Path

Client components never fetch prices directly. Prices are read via `getCachedMarketPrices()` in `PriceDataLayout` (a server component):

```text
Cron writes Redis -> getCachedMarketPrices reads Redis -> PriceDataContext -> client components
```

If the cron job has not run yet, `getCachedMarketPrices` returns an empty price map. Components gracefully handle `null`/`undefined` prices by showing `-`.
During migration from the old Tarkov Market integration, the read service falls back to the previous Redis price keys if the new `item-market-data:*` keys are missing or empty.

---

## Manual Trigger

To refresh prices outside the cron schedule, send:

```text
GET /api/cron/price-update
Authorization: Bearer <CRON_SECRET>
```

For local development, run the same service directly:

```bash
npm run pull-prices
```

---

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| All prices show `-` | Redis key missing or cron never ran | Trigger the cron manually |
| PVE prices missing | Tarkov.dev PVE query error | Check server logs and re-trigger cron |
| Cron returns 401 | `CRON_SECRET` env var mismatch | Verify env var in Vercel dashboard |
| Prices very stale | Cron is failing silently | Check Vercel cron logs in the dashboard |
