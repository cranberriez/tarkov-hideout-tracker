# API Routes & Server Services

Page-level station, catalog, and quest data is loaded by server services and
delivered through React context or server-component props. The two item routes
below are intentionally lazy because their data is needed only by the item modal.

## HTTP routes

### `GET /api/items/{itemId}/usage?mode={mode}`

Returns the normalized barters that offer the selected standard item and crafts
that produce it. `mode` must be `regular`, `pve`, or `pvp-season`; item IDs are
validated before lookup. The small response also includes only the matched trader
and task-unlock presentation records needed to render the modal from any page.

Barter and craft services settle independently. A partial response includes the
successful domain plus `bartersError` or `craftsError` and is not cached by either
the HTTP layer or the modal's in-memory cache, so a later open can retry. Complete
responses use browser/CDN caching (`max-age=300`, `s-maxage=3600`,
`stale-while-revalidate=86400`).

Trader/task presentation is also optional. If that lookup fails, the response
uses fallback labels, includes `presentationError`, and remains uncached so a
later modal open can restore the full labels.

### `GET /api/items/{itemId}/price-history?mode={mode}`

Proxies and validates the mode-specific Tarkov.dev `/prices/{itemId}` series. It
uses a 15-minute Next.js/CDN cache and no Redis storage.

### `GET /api/revalidate?tag={tag}`

Authenticated with `CRON_SECRET`. Accepted tags are `item-data`, `hideout-data`,
and `quests`. This invalidates matching Next.js tag entries; it does not remove
versioned Redis bodies. See `caching-architecture.md` for the current mappings.

## Server services

### `getGlobalItemList(mode)`

**File:** `src/server/services/itemsJson.ts`

Loads and normalizes the complete standard-item catalog from `/items`, including
the compact current market shape. It uses the mode-specific
`items:catalog:v{itemCatalog}:{mode}` manifest plus bounded Redis chunks and is
deliberately not wrapped in `unstable_cache`.

```ts
TimedResponse<{ items: GlobalItem[] }>;
```

### `getCachedHideoutStations(mode)`

**Files:** `src/server/services/hideoutJson.ts`, `src/server/services/tarkovData.ts`

Loads JSON hideout stations and preserves item requirements as
`{ id, itemId, count, isFir, isTool }`. Standard item presentation is not embedded
in stations. The service uses Redis plus the small `hideout-data` Next wrapper.

```ts
TimedResponse<{ stations: Station[] }>;
```

### `getCachedQuestData(mode)` / `getCachedFullQuestData(mode)`

**Files:** `src/server/services/questsJson.ts`, `src/server/services/tarkovData.ts`

Load lightweight hand-in quests or full quest content from JSON tasks. Standard
items are stored as IDs; task-owned quest-specific items retain only compact
inline presentation. Both responses use Redis and the `quests` Next tag.

```ts
TimedResponse<{ quests: Quest[] }>;
TimedResponse<{ quests: FullQuest[] }>;
```

### `getBarterIndex(mode)` / `getCraftIndex(mode)` / `getItemUsage(itemId, mode)`

**File:** `src/server/services/itemAcquisitionJson.ts`

Normalize `/barters` and `/crafts` into ID-based records indexed by offered or
produced item ID. The complete indexes are Redis-only. `getItemUsage()` composes
the small per-item response while keeping domain failures independent.

### `getCachedTraders(mode)`

**Files:** `src/server/services/tradersJson.ts`, `src/server/services/tarkovData.ts`

Loads the compact JSON trader list. The quests UI generally derives its trader
presentation from full quest data, but this service remains available to server
consumers.

### `orderQuestsByPrerequisites(quests)`

**File:** `src/server/services/quests.ts`

Sorts quests by prerequisite depth, minimum level, and name.

## Runtime provider

All runtime station, item, quest, trader, barter, and craft services use the
Tarkov.dev JSON API. `tarkovData.ts` remains a stable import facade for several
services, not a provider selector. `TARKOV_DATA_SOURCE` does not select a GraphQL
runtime implementation.

## Redis client and environment

`src/server/redis.ts` owns the singleton Upstash client. Configuration uses
`UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` and
`UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN`. `CRON_SECRET` guards the manual
revalidation route.
