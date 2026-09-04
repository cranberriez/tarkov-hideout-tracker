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
`s-maxage=900`, `stale-while-revalidate=300`).

Trader/task presentation is also optional. If that lookup fails, the response
uses fallback labels, includes `presentationError`, and remains uncached so a
later modal open can restore the full labels.

### `GET /api/items/{itemId}/price-history?mode={mode}`

Lazily requests the mode-specific Tarkov.dev `/prices/{itemId}` series when the
modal's History tab is selected. The upstream fetch uses the Next.js data cache
with a two-hour revalidation interval; the route does not read the stored Turso
price points used to derive current prices. Its CDN response is cached for two
hours, with a five-minute browser policy.

### Price refresh routes

- `GET /api/cron/prices/seasonal` refreshes `pvp-season`.
- `GET /api/cron/prices/daily` refreshes `regular` and `pve`.

Both require the Vercel `CRON_SECRET` bearer token. They use per-mode database
locks, ETags, bounded concurrency, and retain previous good values on failures.

### `GET /api/items/{itemId}/acquisition-tree?mode={mode}`

Returns the bounded barter/craft subgraph reachable from one standard item. It is
intended for recursive single-item calculations such as an item-modal cost view,
without sending the complete acquisition indexes to the browser. Traversal is
cycle-safe and capped by depth and item count; `truncated` reports whether the cap
was reached. The response uses the same browser/CDN caching policy as item usage.

### Other Turso-backed routes

- `GET /api/items/search` searches the release's compact `item_search` table and
  returns at most 10 or 50 item previews.
- `GET /api/data/status` reads release freshness metadata.
- `GET /api/conversion/legacy-profile` reads the compact station manifest.
- `GET /api/conversion/completed-items` reads station entities and only the item
  identities referenced by their requirements.

## Repository, query, and database boundaries

`src/server/repositories/tarkov-data/types.ts` defines the explicit-mode
`TarkovDataRepository`. The production implementation in `turso-repository.ts`
reads compact manifests and release-scoped entity rows, returns keyed ID batches,
and omits missing IDs. Raw JSON translation and normalization remain offline
generation concerns. Runtime provider access is isolated to protected price-refresh
jobs and the lazily loaded, two-hour-cached item history endpoint.

Page composition lives in `src/server/queries/`. Hideout, Items, Quests, Kappa,
and Profit pages call only their named query. Queries request route-scoped IDs,
settle independently optional domains, and return contracts owned by
`src/types/contracts.ts`. Profit calculations require both barter and craft graphs;
a partial recipe failure is reported instead of producing incomplete figures.

Server-component page composition and bounded item relations, usage, acquisition,
search, conversion, and status APIs all read release-scoped Turso records through
`src/server/db/`. Current prices and their bounded point history live in mutable
Turso tables outside immutable releases.

Quest prerequisite ordering is the provider-independent utility
`src/lib/utils/quest-ordering.ts`.

## Runtime provider

Page queries use Turso. Tarkov.dev JSON adapters are offline ingestion inputs and
are not imported by normal runtime data paths. Runtime data-provider reads are
limited to protected manual/scheduled current-price refreshes and the item modal's
two-hour-cached, on-demand price history.

## Runtime environment

Runtime Turso reads use `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`; immutable
release IDs are pinned in `src/server/db/release-config.ts`. Redis and manual
cache-revalidation configuration are no longer used.
