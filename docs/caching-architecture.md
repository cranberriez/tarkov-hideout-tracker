# Caching Architecture

The app uses versioned Upstash Redis entries as the cross-deployment cache for
normalized Tarkov.dev JSON datasets. Small progression responses may also use
Next.js `unstable_cache`; the global item catalog and the barter/craft indexes are
deliberately Redis-only because their serialized payloads can exceed Next.js's
data-cache limit.

Redis read failures are cache misses, Redis write failures do not fail requests,
and validated writes are scheduled after the response. Cache versions live in
`src/lib/cfg/cacheVersions.ts`; change the relevant version when a cached shape
changes and allow old keys to expire naturally.

When `NODE_ENV=development` and `CACHE_ENABLED=false`, application cache helpers
are bypassed. Development Redis keys use a `dev:` prefix when caching is enabled.

## Freshness and failure behavior

Normalized source datasets use a 24-hour production freshness window and five
minutes in development. `PROGRESSION_DATA_FROZEN` can pin progression datasets in
an emergency but is normally disabled.

Every source service validates cached and upstream data:

- malformed or empty cached bodies are ignored;
- empty or invalid upstream results are never written;
- a valid stale body is returned when refresh fails;
- cache metadata records `updatedAt` separately under a `:meta` key;
- all keys include `regular`, `pve`, or `pvp-season` to prevent mode mixing.

## Redis keys

| Key | Content | Version field |
|---|---|---|
| `items:catalog:v3:{mode}` | Validated manifest for the chunked global standard-item catalog | `itemCatalog` |
| `items:catalog:v3:{mode}:slot:{0|1}:chunk:{n}` | Generation-tagged catalog chunks capped at 750 KiB | `itemCatalog` |
| `items:barters:v1:{mode}` | Barters indexed by offered item ID | `itemBarters` |
| `items:crafts:v1:{mode}` | Crafts indexed by product item ID | `itemCrafts` |
| `hideout:stations:v7:{mode}` | Stations with ID-based item requirements | `hideoutStations` |
| `quests:all:v6:{mode}` | Lightweight give-item quests with standard item IDs | `quests` |
| `quests:full:v14:{mode}` | Full quest content with ID-based standard-item references | `questsFull` |
| `traders:all:v1:{mode}` | Compact trader list | `traders` |

There is no tracked-item cache. The old `hideout:items:filtered:*` namespace is
not read and should not be manually deleted.

## Next.js cache wrappers

| Service | Next key / tag | Revalidation |
|---|---|---|
| `getCachedHideoutStations()` | `json-hideout-stations` / `hideout-data` | 24 hours |
| `getCachedQuestData()` | `json-quests` / `quests` | 24 hours |
| `getCachedFullQuestData()` | `json-quests-full` / `quests` | 24 hours |
| `getCachedTraders()` | `json-traders` / `traders` | 24 hours |

`getGlobalItemList()`, `getBarterIndex()`, and `getCraftIndex()` are not wrapped
in `unstable_cache`. The per-item usage route returns only matching barter/craft
records and applies HTTP caching. Price history has a separate 15-minute Next/HTTP
cache and no Redis entry.

The catalog is larger than Upstash's single-request limit in some modes, so it is
written as alternating generation-tagged chunk sets. The small manifest and meta
keys are published only after every chunk succeeds. Reads reject incomplete or
mixed generations and retain the last complete generation as stale fallback.

## Request flow

```text
(data)/layout.tsx
  -> cached stations (Redis + Next)
  -> global item catalog (Redis only)
  -> DataContext(items)
       -> client builds itemById

/items and /quests
  -> cached full quests (Redis + Next)
  -> client joins standard item IDs through itemById

item modal opens
  -> /api/items/{itemId}/usage?mode=...
       -> barter index (Redis only)
       -> craft index (Redis only)
       -> matching records only
```

## Tags and invalidation

The authenticated `/api/revalidate` route accepts `hideout-data`, `quests`, and
`item-data`. Tags invalidate Next.js cache entries only; they do not delete or
rewrite Redis source caches. `hideout-data` and `quests` currently correspond to
active Next wrappers. `item-data` remains an accepted maintenance tag, but the
large catalog has no Next wrapper, so catalog refresh is controlled by Redis
freshness or an `itemCatalog` version bump. Barter and craft shape changes require
their own version bumps for the same reason.
