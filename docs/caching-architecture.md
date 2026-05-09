# Caching Architecture

The app uses two caching layers in combination: **Upstash Redis** for persistent cross-request storage and **Next.js `unstable_cache`** for ISR-style in-process caching.

---

## Redis Keys

| Key | Content | Written by | TTL |
|---|---|---|---|
| `hideout:stations:v6` | Full station list (JSON) | `getHideoutStations()` on cache miss | None (overwritten on refresh) |
| `hideout:items:filtered:v1` | Filtered item list (JSON) | `getHideoutRequiredItems()` on cache miss | None |
| `tarkov-market:all-prices:filtered:v1:pvp` | PVP price map `normalizedName → MarketPrice` | Cron job (`refreshTarkovMarketPrices("PVP")`) | None (overwritten daily) |
| `tarkov-market:all-prices:filtered:v1:pve` | PVE price map `normalizedName → MarketPrice` | Cron job (`refreshTarkovMarketPrices("PVE")`) | None |

Legacy per-item keys (`tarkov-market:item:v3:<normalizedName>`) may exist from the old per-item fetch path. They are no longer written by the main flow.

---

## Next.js `unstable_cache` Wrappers

Each server service wraps its Redis read/fetch logic in `unstable_cache`, giving it ISR-like behavior inside the Next.js request pipeline.

| Service function | `revalidate` | Effect |
|---|---|---|
| `getCachedHideoutStations()` | 12 hours | Station data is stale-while-revalidate at 12h |
| `getCachedHideoutRequiredItems()` | 12 hours | Same for item list |
| `getCachedMarketPrices(names, mode)` | 5 minutes | Prices re-read from Redis at most every 5 minutes |

The `unstable_cache` layer sits **above** Redis. On a cache hit within the revalidate window, the function doesn't even reach Redis.

---

## Caching Flow per Request

```
Browser request
  → (data)/layout.tsx  (server component)
      → getCachedHideoutStations()
          → [Next.js cache hit?] → return cached stations
          → [cache miss] → read Redis → [Redis hit?] → return & populate Next.js cache
                                     → [Redis miss] → call Tarkov.dev GraphQL → write Redis → return
      → getCachedHideoutRequiredItems()
          → same pattern as above
      → PriceDataLayout.tsx (wrapped in <Suspense>)
          → getCachedMarketPrices("PVP") + getCachedMarketPrices("PVE")
              → [Next.js cache hit?] → return cached prices
              → [cache miss] → read Redis price map → return subset → populate Next.js cache
```

Market prices in Redis are written **only** by the cron job. `getCachedMarketPrices` never writes to Redis — if the Redis key is missing, it returns empty data (not an error).

---

## Browser / Client

No client-side price fetching occurs. All data arrives via server components as React context values. Zustand (`useUserStore`) handles localStorage persistence of user progress and preferences only.

---

## Cache Invalidation

| Scenario | How to invalidate |
|---|---|
| Station data changed on Tarkov.dev | Change the Redis key suffix (e.g., `v6` → `v7`) or wait 12h |
| Market prices stale | Cron runs at midnight UTC; can also call `/api/cron/bulk-update` manually with the `CRON_SECRET` |
| Per-request Next.js cache | Automatic after `revalidate` window; or redeploy to Vercel |

---

## Adding a New Cached Data Source

1. Add a service function in `src/server/services/`.
2. Wrap with `unstable_cache` and choose a `revalidate` window appropriate to how often the data changes.
3. Pick a versioned Redis key (e.g., `my-data:v1`) so you can bust it independently.
4. Call the service from `(data)/layout.tsx` or a page server component.
5. Distribute data via an existing context or a new one following the pattern in `data-and-price-context-architecture.md`.
