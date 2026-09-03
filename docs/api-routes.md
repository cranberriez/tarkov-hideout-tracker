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
discards points older than December 1, 2025 before serializing the response. It
uses a 15-minute Next.js/CDN cache and no Redis storage.

### `GET /api/items/{itemId}/acquisition-tree?mode={mode}`

Returns the bounded barter/craft subgraph reachable from one standard item. It is
intended for recursive single-item calculations such as an item-modal cost view,
without sending the complete acquisition indexes to the browser. Traversal is
cycle-safe and capped by depth and item count; `truncated` reports whether the cap
was reached. The response uses the same browser/CDN caching policy as item usage.

### `GET /api/revalidate?tag={tag}`

Authenticated with `CRON_SECRET`. Accepted tags are `item-data`, `hideout-data`,
and `quests`. This invalidates matching Next.js tag entries; it does not remove
versioned Redis bodies. See `caching-architecture.md` for the current mappings.

## Repository and query boundaries

`src/server/repositories/tarkov-data/types.ts` defines the explicit-mode
`TarkovDataRepository`. The production implementation in `current-repository.ts`
projects cached provider datasets into keyed batch results and omits missing IDs.
Raw JSON shapes, translation, price-history fetching, normalization, and cache
mechanics remain owned by adapter services in `src/server/services/`.

Page composition lives in `src/server/queries/`. Hideout, Items, Quests, Kappa,
and Profit pages call only their named query. Queries request route-scoped IDs,
settle independently optional domains, and return contracts owned by
`src/types/contracts.ts`. Profit calculations require both barter and craft graphs;
a partial recipe failure is reported instead of producing incomplete figures.

Item relations, usage, acquisition trees, history, conversions, search, and data
status follow the same query boundary behind bounded HTTP routes. Barter and craft
acquisition domains settle independently, and partial responses are not cached.

Quest prerequisite ordering is the provider-independent utility
`src/lib/utils/quest-ordering.ts`.

## Runtime provider

All runtime station, item, quest, trader, barter, and craft adapters use the
Tarkov.dev JSON API. `TARKOV_DATA_SOURCE` does not select a GraphQL runtime
implementation.

## Redis client and environment

`src/server/redis.ts` owns the singleton Upstash client. Configuration uses
`UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` and
`UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN`. `CRON_SECRET` guards the manual
revalidation route.
