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
reads only the generated snapshot and Turso credentials.

For local upload testing, `TURSO_DATABASE_URL=file:db-scripts/local.db` works
without an auth token.

## Commands

Generate all three modes:

```bash
npm run db:generate
```

Generate selected modes or choose a release ID:

```bash
npm run db:generate -- --modes regular,pve --release 2026-09-03
```

Generated files are written to `db-scripts/.generated/<release-id>/` and are
ignored by Git.

Validate a snapshot:

```bash
npm run db:validate -- db-scripts/.generated/<release-id>
```

Upload without activating:

```bash
npm run db:upload -- --release-dir db-scripts/.generated/<release-id>
```

After inspecting the uploaded release, activate every included mode atomically:

```bash
npm run db:activate -- db-scripts/.generated/<release-id>
```

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
- `active_data_releases`: an operational pointer maintained by `db:activate`.

The schema is in [schema.sql](schema.sql). No cleanup command is provided intentionally;
older releases remain available for inspection and rollback until retention is
designed explicitly.

## Runtime release selection

The item relations, usage, acquisition-tree, search, data-status, and conversion
APIs read from Turso. They select immutable releases through
[release-config.ts](../src/server/db/release-config.ts); update that mode-to-release map after uploading
and validating a replacement release. The runtime does not currently consult
`active_data_releases`, so `db:activate` does not change what the application
serves until the static config is updated.
