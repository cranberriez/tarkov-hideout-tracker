# Tarkov.dev JSON Ingestion

Tarkov.dev JSON is an offline release-generation source. Normal application page
and API requests do not load these datasets. The adapters under
`src/server/services/` are imported by `db-scripts/generate.mjs`, normalized into
canonical application types, and written into immutable Turso snapshots.

## Modes

| App profile | Source/database mode |
|---|---|
| PVP | `regular` |
| PVE | `pve` |
| KORD | `pvp-season` |

Mode is required throughout ingestion and runtime lookup so records cannot mix.
KORD translations fall back to regular English records only when the seasonal
English source omits a translation; seasonal IDs and structure remain
authoritative.

## Generated domains

The generator normalizes items and current prices, hideout stations, quests,
traders, skills, barters, and crafts. It also composes compact manifests, item
search rows, and endpoint-ready item relations, usage, and acquisition views.

The adapters read the source directly during generation. They do not use or write
an application cache. Empty and malformed source responses fail generation rather
than producing a ready database release.

## Runtime exception

Full item price history is intentionally excluded from snapshots. The
`/api/items/{itemId}/price-history` route fetches the selected series on demand and
keeps its independent 2-hour Next.js/HTTP cache.

See `db-scripts/README.md`, `data-and-price-context-architecture.md`, and
`caching-architecture.md` for the release and runtime read paths.
