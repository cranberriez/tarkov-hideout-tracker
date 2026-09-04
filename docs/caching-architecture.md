# Runtime Data and Caching

Normalized Tarkov data is generated offline and uploaded to Turso as immutable,
mode-specific releases. Runtime server code reads the release pinned in
`src/server/db/release-config.ts`; it does not fetch or cache the complete source
datasets from Tarkov.dev.

## Request flow

```text
server page
  -> named page query
  -> TursoTarkovDataRepository
  -> targeted entity rows or compact manifests from the pinned release
  -> route contract from src/types/contracts.ts

item modal opens
  -> precomputed Turso item_views rows for relations, usage, and acquisition
  -> live price-history request only when the history tab is opened

item search opens
  -> bounded Turso item_search query (10 Quick Add, 50 checklist)
```

`data_manifests` holds compact catalog-style payloads such as the all-item preview
list. Entity queries use `data_entities` and can request only specific IDs. The
item detail endpoints read one `item_views` row for the requested item and view.

## Cache policy

Turso is the persistent normalized data store. There is no Redis layer.

- Immutable release IDs make database records safe to cache by URL and mode.
- API routes set HTTP cache headers appropriate to their payloads.
- Next.js and the deployment CDN may cache rendered pages and route responses.
- Price history retains its separate 2-hour Next.js/HTTP cache because it is
  the sole live Tarkov.dev data read.

Updating data is an explicit release operation: generate, validate, upload,
inspect, then change the static release mapping. No runtime cache invalidation or
Redis version bump is required.

## Development inspection

The development-only `/dev` page displays the configured Turso releases, their
timestamps, readiness, source freshness, and stored record counts. It does not
contact Tarkov.dev or Redis.
