# Turso data ingestion

This directory owns offline database generation and upload tooling. Application
runtime access lives separately under `src/server/db/`.

The pipeline is intentionally staged:

1. Generate immutable NDJSON snapshots from the application's canonical Tarkov
   data adapters and item-detail query composers.
2. Validate checksums and record counts locally.
3. Upload all rows under one release ID.
4. Mark each uploaded mode ready only after database counts match.
5. Explicitly activate the release by updating the per-mode pointers.

Price history is intentionally never generated or uploaded.

Item read models are generated in small bounded batches. Their acquisition views
store price-independent reachable recipe graphs; current prices are hydrated only
when those views are read at runtime.

Mutable endpoint prices are maintained separately. See
[price storage and delivery](../docs/data-layer.md) and
[refresh operations](../docs/operations.md).

## Configuration

Set these values in `.env.local`, `.env`, or the process environment:

```text
TURSO_DATABASE_URL=libsql://your-database.turso.io
TURSO_AUTH_TOKEN=your-token
```

The generator reads and normalizes the source datasets directly. The uploader
reads the snapshot, Turso credentials, and durable catalog history. The full-update
path reads existing database prices so it can preserve their fallback values.

For local upload testing, `TURSO_DATABASE_URL=file:db-scripts/local.db` works
without an auth token.

## Commands

One command for the complete non-price update:

```bash
npm run db:update
npm run db:update -- --modes regular,pve --patch 1.1.5.0 --release <new-release-id>
```

The default is all three modes, patch `1.1.5.0`, and a timestamp release ID. It
initializes the catalog baseline, generates, validates, writes `changes.json`,
uploads, and activates included modes that are not pinned. It preserves existing release price
payloads and timestamps, gives new items null price fallbacks, and never refreshes
mutable prices/history. It updates trader offers as catalog content. Unchanged
content is reported and still published as a complete validated snapshot.

Use `--patch` for subsequent patches; the default lives in
[catalog-history.mjs](lib/catalog-history.mjs). This means detected during that
patch, not a verified game introduction date. Errors stop the pipeline, and an
active-pointer change during generation/upload blocks automatic activation.
Interrupted uploads can be retried using `db:upload` with the same snapshot and
patch. Never use `--force` to regenerate different content under an uploaded ID.

Read-only new-item check (does not write dates or mark IDs as seen):

```bash
npm run db:items:check
npm run db:items:check -- --modes pvp-season
```

One-time initialization before deploying the database-driven runtime:

```bash
npm run db:catalog:init
```

This seeds mode-scoped history from ready release `20260904T211847Z` as
`pre-1.1.5`, with unknown dates, and fills missing active pointers. It preserves
existing pointers/history. `db:update` includes this step. Missing baseline modes
fail rather than inventing dates. The read-only check can use that baseline before
initialization. Never remove history when an item disappears from a snapshot.

The individual stages remain available:

Generate all three modes:

```bash
npm run db:generate
```

Generate selected modes or choose a release ID:

```bash
npm run db:generate -- --modes regular,pve --release <new-release-id>
```

Add `--preserve-prices` to `db:generate` to retain active-release prices, as
`db:update` does. Standalone generation otherwise captures provider reference
prices as before; neither path runs mutable-price refresh.

Generated files are written to `db-scripts/.generated/<release-id>/` and are
ignored by Git.

Validate a snapshot:

```bash
npm run db:validate -- db-scripts/.generated/<release-id>
```

Upload without activating:

```bash
npm run db:upload -- --release-dir db-scripts/.generated/<release-id> --patch 1.1.5.0
```

After inspecting the uploaded release, activate every included mode atomically:

```bash
npm run db:activate -- db-scripts/.generated/<release-id>
```

To switch or roll back without local files:

```bash
npm run db:activate -- --release <ready-release-id> --modes regular,pve,pvp-season
```

Manual activation verifies all requested modes are ready and changes their pointers
and durable pins atomically. No app source edit or deployment is needed. Automatic
`db:update` and `db:upload --activate` skip pinned modes, including pins made during
upload, and report the skipped modes. Use **Resume automatic updates** in the
development-only `/dev` panel to remove a mode's pin while keeping its current
release until the next update. The panel also offers a separate browser-local
development override; see [operations](../docs/operations.md#release-dashboard-and-development-override).

Pass `--activate` to `db:upload` only when a one-step upload and activation is
preferred.

The upload is idempotent when the release ID and snapshot checksum match. It
refuses to overwrite the same release ID with different generated content.

Inspect uploaded and active releases:

```bash
npm run db:status
```

Initialize and manually refresh mutable price storage:

```bash
npm run db:prices:init
npm run db:prices:refresh -- --modes pvp-season
npm run db:prices:refresh -- --modes regular,pve
```

## Stored read models

- `data_entities`: canonical items, prices, stations, quests, traders, skills,
  barters, and crafts addressed by mode, release, type, and stable ID.
- `item_views`: endpoint-ready relations, usage, and bounded acquisition-tree
  payloads for every standard item.
- `item_search`: compact item previews and normalized searchable names.
- `data_manifests`: compact IDs/previews for catalog-style reads.
- `data_releases`: immutable release metadata and validation counts.
- `active_data_releases`: runtime per-mode pointers maintained by `db:activate`.
- `data_release_pins`: per-mode manual selections protected from automatic activation.
- `catalog_tracking`: one-time per-mode baseline initialization.
- `item_catalog_history`: durable first-seen timestamp, tracked patch, and dataset
  release, keyed by mode/item ID. New rows and readiness commit together after
  count validation. Retries and later snapshots never overwrite first-seen data.

The schema is in [schema.sql](schema.sql). No cleanup command is provided intentionally;
older releases remain available for inspection and rollback until retention is
designed explicitly.

## Runtime release selection

The item relations, usage, acquisition-tree, search, data-status, and conversion
APIs read from Turso. [release-config.ts](../src/server/db/release-config.ts)
selects the ready release pointed to by `active_data_releases`. React render
memoization prevents mixed selections within a render; there is no 24-hour cache
or hardcoded fallback. Missing/unready pointers surface configuration errors.
Explicit multi-step reads capture their release ID. Immutable data caches keep
mode/release keys, so activation selects different entries without clearing them.
Existing HTTP/browser caches expire under the policies in
[data layer](../docs/data-layer.md).

Focused offline tests (no remote database or upstream requests):

```bash
node --test db-scripts/catalog-history.test.mjs db-scripts/snapshot.test.mjs
node --test --import jiti/register src/server/db/catalog-release.test.ts src/lib/utils/new-items.test.ts src/server/services/itemsJson.test.ts
```
