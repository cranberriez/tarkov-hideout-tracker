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
traders, skills, barters, and crafts. Item entities retain `buyFromTrader` direct
currency offers (trader, currency, price, loyalty level, quest unlock, restock,
and buy limit); `sellToTrader` remains part of the separately stored current-price
payload. The generator also composes compact manifests, item search rows, and
endpoint-ready item relations, usage, and acquisition views.

The adapters read the source directly during generation. They do not use or write
an application cache. Empty and malformed source responses fail generation rather
than producing a ready database release.

## Price refresh exception

Full item price history is intentionally excluded from snapshots. Protected
manual/scheduled refresh jobs conditionally fetch `/prices/{itemId}` with ETags,
retain the newest ten points, and materialize an effective current price. User
requests read Turso and never trigger the upstream provider.

See `db-scripts/README.md`, `data-and-price-context-architecture.md`, and
`caching-architecture.md` for the release and runtime read paths.
