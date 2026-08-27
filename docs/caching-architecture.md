# Caching Architecture

The app uses two caching layers in combination: **Upstash Redis** for persistent cross-request storage and **Next.js `unstable_cache`** for ISR-style in-process caching.

Both Tarkov JSON and GraphQL providers use the same compact Redis payloads. JSON adapters reject empty cached/upstream datasets and never overwrite a valid stale body with missing data. See `tarkov-json-api.md`.

> **Tarkov 1.1 freeze:** Progression caches (hideout, items, quests, and traders) are currently frozen by `PROGRESSION_DATA_FROZEN` in `src/lib/cfg/cacheVersions.ts`. Existing non-empty Redis data is used regardless of age, and the corresponding Next.js caches do not revalidate automatically. Market prices continue refreshing independently. Lift the freeze only after the new upstream data and application behavior have been verified.

Cache version constants live in `src/lib/cfg/cacheVersions.ts`. To invalidate a Redis-backed data set for application code, bump the relevant version constant and deploy.

## Development Cache Toggle

Set `CACHE_ENABLED=false` in `.env` while running in development to bypass both cache layers. In this mode the server does not create a Redis client, read Redis, write Redis, or use the `unstable_cache` wrappers; progression requests go directly to the selected upstream provider. Restart the development server after changing the value.

The toggle is intentionally ignored outside development. Production and other environments always use the normal cache behavior, even if `CACHE_ENABLED=false` is present.

## Development Redis Namespace

When `NODE_ENV === "development"` and Redis caching is enabled, the shared
`src/server/redis.ts` wrapper prefixes every Redis key with `dev:`. This covers
body keys, `:meta` keys, market-price previous/legacy fallback keys, and both
reads and writes from every Redis-backed service. For example:

```text
production: quests:full:v10
development: dev:quests:full:v10
```

The production form remains byte-for-byte unchanged. The namespace is applied at
the Redis boundary, so individual service key definitions, cache version numbers,
Next.js `unstable_cache` key arrays, and localStorage persistence do not change.
`NODE_ENV` values other than exactly `development` also use the historical keys.
When `CACHE_ENABLED=false` disables the development Redis client, no Redis keys
are read or written.

---

## Redis Keys

Most Redis-backed services store a body key plus a `:meta` key containing `{ updatedAt: number }`. The service treats Redis data as fresh for 12 hours, then fetches from the upstream source and overwrites both keys. When an upstream fetch fails, services with a stale body generally return the stale body instead of failing the request.

| Key                                                  | Content                                                        | Written by                                           | Freshness  |
| ---------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------- | ---------- |
| `hideout:stations:v6` + `:meta`                      | Full station list                                              | `getHideoutStations()` on cache miss/stale data      | 12h        |
| `hideout:items:filtered:v1` + `:meta`                | Hideout-required item metadata                                 | `getHideoutRequiredItems()` on cache miss/stale data | 12h        |
| `quests:all:v5` + `:meta`                            | Quests with `giveItem` objectives only                         | `getQuestData()` on cache miss/stale data            | 12h        |
| `quests:full:v10` + `:meta`                          | Full quest list, quest splash images, all objective types, map/trader/prestige/reputation reward data | `getFullQuestData()` on cache miss/stale data        | 12h        |
| `traders:all:v1` + `:meta`                           | Full trader list                                               | `getTraders()` on cache miss/stale data              | 12h        |
| `item-market-data:filtered:v3:pvp` + `:meta`          | PVP hideout + quest flea/trader price map keyed by `normalizedName` | Cron job (`refreshTarkovDevMarketPrices("PVP")`)     | Daily cron |
| `item-market-data:filtered:v3:pve` + `:meta`          | PVE hideout + quest flea/trader price map keyed by `normalizedName` | Cron job (`refreshTarkovDevMarketPrices("PVE")`)     | Daily cron |

Older Tarkov.dev price keys and legacy Tarkov Market keys may exist in Redis from older deployments. The read service falls back to the previous Tarkov.dev key first, then the legacy Tarkov Market key, only when the current keys are missing or empty. Existing deployments keep showing flea prices until `/api/cron/price-update` has populated the new namespace with trader sell values.

---

## Next.js `unstable_cache` Wrappers

Each server service wraps its Redis read/fetch logic in `unstable_cache`, giving it ISR-like behavior inside the Next.js request pipeline.

| Service function                     | `unstable_cache` key         | `revalidate` | Effect                                                              |
| ------------------------------------ | ---------------------------- | ------------ | ------------------------------------------------------------------- |
| `getCachedHideoutStations()`         | `["hideout-stations"]`       | Frozen       | Uses the current station dataset indefinitely                       |
| `getCachedHideoutRequiredItems()`    | `["hideout-required-items"]` | Frozen       | Uses the current hideout item dataset indefinitely                  |
| `getCachedMarketPrices(names, mode)` | `["market-prices"]`, tag `market-prices` | 5 minutes    | Price subsets are re-read from Redis at most every 5 minutes, or immediately after the cron route revalidates the tag |
| `getCachedQuestData()`               | `["quests"]`                 | Frozen       | Uses the current give-item quest dataset indefinitely               |
| `getCachedFullQuestData()`           | `["quests-full"]`            | Frozen       | Uses the current full quest dataset indefinitely                    |
| `getCachedTraders()`                 | `["traders"]`                | Frozen       | Uses the current trader dataset indefinitely                        |

The `unstable_cache` layer sits above Redis. On a Next.js cache hit inside the revalidate window, the function does not reach Redis.

---

## Caching Flow Per Request

```text
Browser request
  -> (data)/layout.tsx
      -> getCachedHideoutStations()
      -> getCachedHideoutRequiredItems()
      -> PriceDataLayout
          -> getCachedAllMarketPrices("PVP")
          -> getCachedAllMarketPrices("PVE")

/items page
  -> getCachedFullQuestData()
  -> build quest item metadata for the client

/quests page
  -> getCachedFullQuestData()
  -> build quest item metadata and availability metadata for the client
```

Market prices in Redis are written only by the cron job. `getCachedAllMarketPrices` and `getCachedMarketPrices` never write price data to Redis; if the Redis key is missing, they return empty/null price data.

---

## Browser / Client

No client-side price fetching occurs. Server components fetch data and distribute it through React context or server props. Zustand (`useUserStore`) handles localStorage persistence of user progress and preferences only.

---

## Cache Invalidation

| Scenario                                              | How to invalidate                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Verified Tarkov 1.1 progression data is ready         | Set `PROGRESSION_DATA_FROZEN` to `false`, deploy, then explicitly invalidate the relevant tag or bump its cache version |
| Market prices stale                                   | Wait for the 00:00 UTC cron job or call `/api/cron/price-update` manually with `CRON_SECRET`     |
| Next.js in-process cache stale                        | Wait for the `revalidate` window or redeploy                                                     |

---

## Adding a New Cached Data Source

1. Add a service function in `src/server/services/`.
2. Wrap it with `unstable_cache` and choose a `revalidate` window appropriate to how often the data changes.
3. Pick a versioned Redis key and add the version to `src/lib/cfg/cacheVersions.ts`.
4. Store a body key and `:meta` key if the service needs timestamp-based freshness or stale fallback behavior.
5. Call the service from `(data)/layout.tsx` or a page server component.
6. Distribute data via an existing context, a new context, or server props following the patterns in `data-and-price-context-architecture.md`.
