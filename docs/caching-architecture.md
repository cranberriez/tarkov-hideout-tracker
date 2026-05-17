# Caching Architecture

The app uses two caching layers in combination: **Upstash Redis** for persistent cross-request storage and **Next.js `unstable_cache`** for ISR-style in-process caching.

Cache version constants live in `src/lib/cfg/cacheVersions.ts`. To invalidate a Redis-backed data set for application code, bump the relevant version constant and deploy.

---

## Redis Keys

Most Redis-backed services store a body key plus a `:meta` key containing `{ updatedAt: number }`. The service treats Redis data as fresh for 12 hours, then fetches from the upstream source and overwrites both keys. When an upstream fetch fails, services with a stale body generally return the stale body instead of failing the request.

| Key                                                  | Content                                                        | Written by                                           | Freshness  |
| ---------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| `hideout:stations:v6` + `:meta`                      | Full station list                                              | `getHideoutStations()` on cache miss/stale data      | 12h        |
| `hideout:items:filtered:v1` + `:meta`                | Hideout-required item metadata                                 | `getHideoutRequiredItems()` on cache miss/stale data | 12h        |
| `quests:all:v3` + `:meta`                            | Quests with `giveItem` objectives only                         | `getQuestData()` on cache miss/stale data            | 12h        |
| `quests:full:v3` + `:meta`                           | Full quest list, all objective types, map/trader/prestige data | `getFullQuestData()` on cache miss/stale data        | 12h        |
| `traders:all:v1` + `:meta`                           | Full trader list                                               | `getTraders()` on cache miss/stale data              | 12h        |
| `tarkov-market:all-prices:filtered:v1:pvp` + `:meta` | PVP price map keyed by `normalizedName`                        | Cron job (`refreshTarkovMarketPrices("PVP")`)        | Daily cron |
| `tarkov-market:all-prices:filtered:v1:pve` + `:meta` | PVE price map keyed by `normalizedName`                        | Cron job (`refreshTarkovMarketPrices("PVE")`)        | Daily cron |

Legacy per-item keys use `tarkov-market:item:v4:{mode}:{normalizedName}` plus `:meta`. They are only used by the legacy per-item service in `src/server/services/tarkovMarket.ts`, not by the main page data flow.

---

## Next.js `unstable_cache` Wrappers

Each server service wraps its Redis read/fetch logic in `unstable_cache`, giving it ISR-like behavior inside the Next.js request pipeline.

| Service function                     | `unstable_cache` key         | `revalidate` | Effect                                                              |
| ------------------------------------ | ---------------------------- | ------------ | ------------------------------------------------------------------- |
| `getCachedHideoutStations()`         | `["hideout-stations"]`       | 12 hours     | Station data is re-read from the service at most every 12h          |
| `getCachedHideoutRequiredItems()`    | `["hideout-required-items"]` | 12 hours     | Hideout item metadata is re-read from the service at most every 12h |
| `getCachedMarketPrices(names, mode)` | `["market-prices"]`          | 5 minutes    | Price subsets are re-read from Redis at most every 5 minutes        |
| `getCachedQuestData()`               | `["quests"]`                 | 12 hours     | Give-item quest data is re-read from the service at most every 12h  |
| `getCachedFullQuestData()`           | `["quests-full"]`            | 12 hours     | Full quest data is re-read from the service at most every 12h       |
| `getCachedTraders()`                 | `["traders"]`                | 12 hours     | Trader list is re-read from the service at most every 12h           |

The `unstable_cache` layer sits above Redis. On a Next.js cache hit inside the revalidate window, the function does not reach Redis.

---

## Caching Flow Per Request

```text
Browser request
  -> (data)/layout.tsx
      -> getCachedHideoutStations()
      -> getCachedHideoutRequiredItems()
      -> PriceDataLayout
          -> getCachedMarketPrices(required item names, "PVP")
          -> getCachedMarketPrices(required item names, "PVE")

/items page
  -> getCachedFullQuestData()
  -> build quest item metadata for the client

/quests page
  -> getCachedFullQuestData()
  -> build quest item metadata and availability metadata for the client
```

Market prices in Redis are written only by the cron job. `getCachedMarketPrices` never writes price data to Redis; if the Redis key is missing, it returns empty/null price data.

---

## Browser / Client

No client-side price fetching occurs. Server components fetch data and distribute it through React context or server props. Zustand (`useUserStore`) handles localStorage persistence of user progress and preferences only.

---

## Cache Invalidation

| Scenario                                              | How to invalidate                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Station, item, quest, or trader data changed upstream | Bump the relevant version in `src/lib/cfg/cacheVersions.ts` or wait for the 12h freshness window |
| Market prices stale                                   | Wait for the 00:00 UTC cron job or call `/api/cron/bulk-update` manually with `CRON_SECRET`      |
| Next.js in-process cache stale                        | Wait for the `revalidate` window or redeploy                                                     |

---

## Adding a New Cached Data Source

1. Add a service function in `src/server/services/`.
2. Wrap it with `unstable_cache` and choose a `revalidate` window appropriate to how often the data changes.
3. Pick a versioned Redis key and add the version to `src/lib/cfg/cacheVersions.ts`.
4. Store a body key and `:meta` key if the service needs timestamp-based freshness or stale fallback behavior.
5. Call the service from `(data)/layout.tsx` or a page server component.
6. Distribute data via an existing context, a new context, or server props following the patterns in `data-and-price-context-architecture.md`.
