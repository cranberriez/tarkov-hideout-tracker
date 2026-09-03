# API Routes & Server Services

Page-level station, catalog, and quest data is loaded by named server queries and
delivered through server-component props. Item-detail and search routes are
intentionally lazy because their data is needed only by the item modal or search UI.
Those bounded routes read immutable, endpoint-ready Turso records selected by
`src/server/db/release-config.ts`.

## HTTP routes

### `GET /api/items/{itemId}/usage?mode={mode}`

Returns the normalized barters that offer the selected standard item and crafts
that produce it. `mode` must be `regular`, `pve`, or `pvp-season`; item IDs are
validated before lookup. The small response also includes only the matched trader
and task-unlock presentation records needed to render the modal from any page.

The stored payload retains independent barter/craft errors from generation. A
partial response is not cached by either the HTTP layer or the modal's in-memory
cache. Complete responses use browser/CDN caching (`max-age=300`,
`s-maxage=3600`, `stale-while-revalidate=86400`).

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

### Other Turso-backed routes

- `GET /api/items/search` searches the release's compact `item_search` table and
  returns at most 10 or 50 item previews.
- `GET /api/data/status` reads release freshness metadata.
- `GET /api/conversion/legacy-profile` reads the compact station manifest.
- `GET /api/conversion/completed-items` reads station entities and only the item
  identities referenced by their requirements.

## Repository, query, and database boundaries

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

Server-component page composition continues through repository-backed named
queries. The bounded item relations, usage, acquisition, search, conversion, and
status APIs instead read release-scoped Turso records through `src/server/db/`.
Price history remains repository/provider-backed and is never stored in Turso.

Quest prerequisite ordering is the provider-independent utility
`src/lib/utils/quest-ordering.ts`.

## Runtime provider

Page queries still use the Tarkov.dev JSON adapters. The Turso-backed API routes
serve records produced from those normalized adapters by the offline ingestion
pipeline. `TARKOV_DATA_SOURCE` does not select a GraphQL runtime implementation.

## Redis client and environment

`src/server/redis.ts` owns the singleton Upstash client. Configuration uses
`UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` and
`UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN`. `CRON_SECRET` guards the manual
revalidation route. Runtime Turso reads use `TURSO_DATABASE_URL` and
`TURSO_AUTH_TOKEN`; their immutable release IDs are pinned in
`src/server/db/release-config.ts`.
