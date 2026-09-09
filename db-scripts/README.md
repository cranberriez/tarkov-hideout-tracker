# Turso data ingestion

Offline tooling generates complete local NDJSON snapshots from canonical adapters
and item-detail composers, validates checksums and counts, then publishes only
changed records to the current dataset. Runtime reads live under `src/server/db/`.
Price history is never generated or uploaded by the dataset pipeline.

## Configuration

Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in `.env.local`, `.env`, or the
process environment. Local testing can use `TURSO_DATABASE_URL=file:db-scripts/local.db`
without a token. Existing environment values take precedence.

## Convert existing storage

```bash
npm run db:storage
npm run db:compact
npm run db:storage
```

[compact.mjs](compact.mjs) converts the existing development database immediately.
It requires one ready active dataset for each of the three modes and matching,
checksum-verified local snapshots under `db-scripts/.generated/<release-id>/`.
Use `--snapshot-root <directory>` to select another local snapshot root. It
initializes durable catalog history before removing the baseline copies, prepares
shared payloads, checks counts and unchanged active selections, then atomically
replaces the four legacy full-record tables with compatibility views. It retains
the three current datasets and removes historical dataset metadata and pins.
Catalog discovery and mutable price/history tables are preserved. Running it on
current storage is a no-op. Missing or mismatched snapshots fail conversion.

`db:storage` is read-only and reports database/storage metrics for comparison.
It separates `dbstat` table/index bytes from the allocated file size and reusable
free pages. Turso Cloud rejects `VACUUM`; deleting old snapshots leaves reusable
pages rather than shrinking the allocated file. See [Turso's storage accounting](https://docs.turso.tech/help/usage-and-billing).

## Commands

```bash
npm run db:update
npm run db:update -- --modes regular,pve --patch 1.1.5.0 --release <new-release-id>
npm run db:update -- --dry-run
```

The default is all three modes, patch `1.1.5.0`, and a timestamp revision ID.
The command generates and validates local snapshots, writes `changes.json`, and
publishes additions, changes, and removals atomically across the selected modes.
It compares compact stored content hashes, uploads only missing shared payloads,
and deletes removed current records and unreferenced payloads. Existing catalog
price payloads/timestamps survive; new items receive null fallback prices. Trader
offers and recipes update as content. Mutable prices and history are separate.

Unchanged content keeps the current revision and source freshness metadata,
without database writes. Freshness describes the published content revision;
timestamp-only provider checks do not change it. A changed current revision during generation or publication causes
an explicit failure; regenerate against the current dataset. `--dry-run` generates
local files and reports planned writes without changing the database.

Use `--patch` for subsequent patches; the default lives in
[catalog-history.mjs](lib/catalog-history.mjs). This records detection during a
patch, not a verified game introduction date. Publication never overwrites durable
first-seen metadata, including when an item disappears and returns.

Individual local generation and publication commands remain available:

```bash
npm run db:generate -- --modes regular,pve --release <new-release-id> --preserve-prices
npm run db:validate -- db-scripts/.generated/<new-release-id>
npm run db:upload -- --release-dir db-scripts/.generated/<new-release-id> --patch 1.1.5.0
npm run db:status
```

Generated files are ignored by Git. Standalone generation without
`--preserve-prices` captures provider reference prices. Neither generation path
refreshes mutable prices. `db:upload` publishes immediately after validation;
there is no separate activation command or historical selection. It also accepts
`--dry-run`. Uploads reject legacy full-table storage until `db:compact` succeeds.
Retry the same validated snapshot after an interrupted publication; a current
revision cannot be reused with a conflicting checksum or changed content.

Read-only new-item checks compare the upstream catalog with durable history:

```bash
npm run db:items:check
npm run db:items:check -- --modes pvp-season
```

`db:catalog:init` remains the explicit legacy baseline initializer. It seeds
`20260904T211847Z` as `pre-1.1.5` with unknown dates and preserves established
history. Compaction performs this before removing old datasets. Missing required
legacy baselines fail rather than invent dates.

```bash
npm run db:prices:init
npm run db:prices:refresh -- --modes pvp-season
npm run db:prices:refresh -- --modes regular,pve
```

See [refresh operations](../docs/operations.md) for mutable prices and schedules.

## Stored read models

[schema.sql](schema.sql) defines:

- `current_records`: one current record per mode, type, stable ID, and variant;
  compact content/payload hashes and search fields support targeted updates.
- `data_payloads`: canonical JSON deduplicated by SHA-256 across records and modes.
- `data_entities`, `item_views`, `item_search`, and `data_manifests`: compatibility
  SQL views joining current records, payloads, and the mode's current revision.
- `data_releases` and `active_data_releases`: current metadata and revision per mode.
- `catalog_tracking` and `item_catalog_history`: durable baseline and first-seen
  facts, independent of current dataset replacement.

[current-storage.mjs](lib/current-storage.mjs) canonicalizes JSON and excludes
record timestamps from content hashes. Stored item-view freshness uses null for
missing/failed domains and zero for available domains; runtime hydrates available
timestamps from current revision metadata. Prices hydrate from mutable price
reads. Freshness advances with content publication, keeping revision-keyed caches consistent.

## Runtime revision scope

[release-config.ts](../src/server/db/release-config.ts) selects the ready current
revision per mode. React memoization shares the selection within a render; explicit
multi-step reads capture the revision. Readers fail if publication removes their
selected revision. Mode/revision cache keys remain isolated; normal browser and
HTTP responses retain their documented expiry in [data layer](../docs/data-layer.md).
There is no historical rollback, pin, or local development preview. `/dev` is a
read-only current status page with mode tabs, counts, and timestamps.

Focused offline tests:

```bash
node --test db-scripts/catalog-history.test.mjs db-scripts/snapshot.test.mjs db-scripts/current-storage.test.mjs
node --test --import jiti/register src/server/db/catalog-release.test.ts src/lib/utils/new-items.test.ts src/server/services/itemsJson.test.ts
```
