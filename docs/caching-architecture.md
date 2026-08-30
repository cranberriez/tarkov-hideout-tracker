# Caching Architecture

The app uses Upstash Redis for cross-deployment caching and Next.js
`unstable_cache` for request/render caching. Cache versions live in
`src/lib/cfg/cacheVersions.ts`; bump the relevant version instead of deleting
Redis keys manually.

When `NODE_ENV=development` and `CACHE_ENABLED=false`, both layers are bypassed.
When development caching is enabled, Redis keys receive a `dev:` prefix.

## Progression freeze

`PROGRESSION_DATA_FROZEN` currently pins station, quest, and trader progression
records to the last non-empty versioned cache. Item records are excluded from
that freeze because they carry volatile market values.

## Redis keys

| Key | Content | Freshness |
|---|---|---|
| `hideout:stations:v6:{regular|pve|pvp-season}` | Mode-specific station list | Frozen |
| `hideout:items:filtered:v4:{regular|pve|pvp-season}` | Compact hideout + quest item records, including embedded pricing, trader offers, and crafts | 1 hour |
| `quests:all:v5:{regular|pve|pvp-season}` | Quests with give-item objectives | Frozen |
| `quests:full:v13:{regular|pve|pvp-season}` | Full quest list | Frozen |
| `traders:all:v1:{regular|pve|pvp-season}` | Trader list | Frozen |

Older standalone market-price keys may remain in Redis but are no longer read or
written by application code.

## Next.js cache wrappers

| Service | Cache key/tag | Revalidation |
|---|---|---|
| `getCachedHideoutStations()` | `hideout-stations` / `hideout-data` | Frozen |
| `getCachedHideoutRequiredItems()` | `json-hideout-required-items` / `item-data`, `hideout-data` | 1 hour |
| `getCachedQuestData()` | `json-quests` / `quests` | Frozen |
| `getCachedFullQuestData()` | `json-quests-full` / `quests` | Frozen |
| `getCachedTraders()` | provider-specific / trader tag | Frozen |

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
