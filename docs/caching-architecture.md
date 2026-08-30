# Caching Architecture

The app uses Next.js `unstable_cache` as its primary request/render cache and
best-effort Upstash Redis storage as a cross-deployment fallback. Redis read
failures are treated as cache misses, and Redis write failures never fail a
request. Cache versions live in
`src/lib/cfg/cacheVersions.ts`; bump the relevant version instead of deleting
Redis keys manually.

When `NODE_ENV=development` and `CACHE_ENABLED=false`, both layers are bypassed.
When development caching is enabled, Redis keys receive a `dev:` prefix.

## Shared freshness

Shared station, quest, trader, and tracked-item responses use a 24-hour
production freshness window. Development caching uses five minutes when it is
enabled. `PROGRESSION_DATA_FROZEN` is retained as an emergency switch but is
normally disabled. Individual item price history remains independently cached
for 15 minutes and does not use Redis.

## Redis keys

| Key | Content | Freshness |
|---|---|---|
| `hideout:stations:v6:{regular|pve|pvp-season}` | Mode-specific station list | 24 hours |
| `hideout:items:filtered:v4:{regular|pve|pvp-season}` | Compact hideout + quest item records, including embedded pricing, trader offers, and crafts | 24 hours |
| `quests:all:v5:{regular|pve|pvp-season}` | Quests with give-item objectives | 24 hours |
| `quests:full:v13:{regular|pve|pvp-season}` | Full quest list | 24 hours |
| `traders:all:v1:{regular|pve|pvp-season}` | Trader list | 24 hours |

Older standalone market-price keys may remain in Redis but are no longer read or
written by application code.

## Next.js cache wrappers

| Service | Cache key/tag | Revalidation |
|---|---|---|
| `getCachedHideoutStations()` | `hideout-stations` / `hideout-data` | 24 hours |
| `getCachedHideoutRequiredItems()` | `json-hideout-required-items` / `item-data`, `hideout-data` | 24 hours |
| `getCachedQuestData()` | `json-quests` / `quests` | 24 hours |
| `getCachedFullQuestData()` | `json-quests-full` / `quests` | 24 hours |
| `getCachedTraders()` | provider-specific / trader tag | 24 hours |

On a validated upstream refresh, the server returns the normalized response to
Next.js and schedules the Redis body/meta write with Next.js `after()`. This uses
the same lifecycle in local Next.js development and Vercel's serverless runtime.
Only validated, non-empty upstream responses reach either cache.

## Request flow

```text
(data)/layout.tsx
  -> cached stations
  -> cached tracked ItemDetails[] from Tarkov.dev JSON /items
       -> flea/trader values remain on each item.marketPrice
  -> DataContext

/items and /quests
  -> cached full quest progression
  -> derive quest indexes
  -> resolve item details from DataContext by item ID
```

Only tracked items are serialized into the client payload. The full Tarkov.dev
catalog is used server-side to select those records.

## Invalidation

The authenticated `/api/revalidate` maintenance route accepts:

- `item-data` for current item metadata and market values
- `hideout-data` for stations and tracked items
- `quests` for quest data

Successful upstream refreshes write both the response body and a `:meta` record
containing `updatedAt`. Invalid or empty upstream responses do not replace a
valid stale body.
