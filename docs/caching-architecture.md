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

Cache policy is resolved per dataset for three independent operations: Next.js
cache, Redis reads, and Redis writes. Development Redis keys use a `dev:` prefix.
Full and lightweight quest Redis writes default to disabled in development so a
stored snapshot can be monitored without being replaced by ordinary page loads.

Global environment flags override every dataset-specific flag:

- `CACHE_NEXT_ENABLED`
- `CACHE_REDIS_READ_ENABLED`
- `CACHE_REDIS_WRITE_ENABLED`

Dataset flags use `CACHE_{DATASET}_{OPERATION}_ENABLED`. Dataset names are
`HIDEOUT_STATIONS`, `ITEM_CATALOG`, `ITEM_BARTERS`, `ITEM_CRAFTS`, `QUESTS`,
`QUESTS_FULL`, and `TRADERS`; operation names are `NEXT`, `REDIS_READ`, and
`REDIS_WRITE`. The item catalog, barter index, and craft index remain Redis-only,
so their Next.js setting has no runtime consumer. The legacy development-only
`CACHE_ENABLED=false` setting remains a master disable for backward compatibility.

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
| `items:catalog:v4:{mode}` | Validated manifest for the chunked global standard-item catalog | `itemCatalog` |
| `items:catalog:v4:{mode}:slot:{0|1}:chunk:{n}` | Generation-tagged catalog chunks capped at 750 KiB | `itemCatalog` |
| `items:barters:v2:{mode}` | Barters indexed by offered item ID | `itemBarters` |
| `items:crafts:v2:{mode}` | Crafts indexed by product item ID | `itemCrafts` |
| `hideout:stations:v9:{mode}` | Stations with ID-based item requirements | `hideoutStations` |
| `quests:all:v7:{mode}` | Lightweight give-item quests with standard item IDs | `quests` |
| `quests:full:v16:{mode}` | Full quest content with ID-based standard-item and reward references | `questsFull` |
| `traders:all:v2:{mode}` | Compact trader list | `traders` |

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

The barter and crafting profit routes load the existing complete barter and craft
indexes only when those routes are visited. Recursive costs and profits are derived
in the browser from those raw indexes, the catalog's `avg24hPrice`, and mode-scoped
manual overrides. Computed profits are not written to Redis because they can differ
for each player.

The catalog is larger than Upstash's single-request limit in some modes, so it is
written as alternating generation-tagged chunk sets. The small manifest and meta
keys are published only after every chunk succeeds. Reads reject incomplete or
mixed generations and retain the last complete generation as stale fallback.

## Development comparison

The development-only `/dev` route shows the effective policy and compares the
stored full-quest Redis snapshot with a freshly normalized Tarkov.dev response.
The fresh path uses upstream `no-store` requests and never reads or writes the
application cache. The diagnostic snapshot read bypasses normal Redis-read policy
but retains development key namespacing. The route returns 404 outside development.

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
