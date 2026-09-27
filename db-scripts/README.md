# Database tooling

Runtime and routine commands use PostgreSQL domain tables. Read
[operations](../docs/operations.md), the [agreed design](../docs/postgresql-migration.md),
and the separate [production cutover runbook](../docs/postgresql-cutover.md).

## Commands

| Command                                                     | Responsibility                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------- |
| npm run db:migrate                                          | Apply checked-in SQL migrations explicitly                                      |
| npm run db:update                                           | Fetch all modes, normalize/validate, compose details, atomically upsert catalog |
| npm run db:update -- --dry-run                              | Validate upstream input and report without writes                               |
| npm run db:update -- --patch 1.1.5.0                        | Record patch provenance for genuinely new discoveries                           |
| npm run db:prices:refresh -- --modes regular,pve,pvp-season | Independently refresh reference prices/offers and flea observations             |
| npm run db:prices:refresh -- --concurrency 12               | Limit HTTP concurrency (1–32)                                                   |
| npm run db:status                                           | Read catalog/discovery/price readiness and latest timestamps                    |
| npm run db:status -- --storage                              | Also report PostgreSQL relation sizes                                           |

DATABASE_URL is required. DATABASE_MIGRATION_URL optionally selects a direct
migration connection. Process environment wins over .env.local, which wins over
.env. Migrations are never implicit in runtime or build. Partial-mode catalog
updates are refused; prices may select modes independently.

For repeatable local diagnosis, `db:update -- --dry-run --export-fixture fixture.json`
exports normalized inputs and detail projections without publishing. Replay with
`db:update -- --fixture fixture.json` against a disposable target; normal validation,
discovery gating and transaction/version guards still apply. Fixtures are debugging
artifacts, not a production migration source or durable catalog history.

## Optional discovery import

`npm run db:update` works without SQLite or an import. It automatically uses a
verified `discovery.json` in the project root when present; choose another file
with `npm run db:update -- --discovery path/to/discovery.json`. The import and catalog
write share one transaction. Invalid files or conflicting records abort that update;
an explicitly requested missing file is an error. Dry runs preview without writing.

Without an import, each uninitialized mode records its current items with unknown
first-seen date and patch (`null`), then marks discovery initialized. Later updates
record the observation date and tracked patch for new IDs. Returning IDs retain
their original metadata, and existing discovery is never reset. The initial catalog
is not labeled as newly released or assumed to predate a particular patch.

To preserve old history without downloading the database, set the old source's
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` in your local environment and run:

```bash
npm run db:discovery:export -- --turso discovery.json
npm run db:update
```

This one-time exporter uses [Turso's SQL-over-HTTP API](https://docs.turso.tech/sdk/http/reference)
to read only `item_catalog_history` and `catalog_tracking` in one read-only snapshot.
It uses a deferred `BEGIN`, fixed `SELECT` statements, and `ROLLBACK`; it does not
send `PRAGMA query_only`, which the hosted Turso API rejects.
It verifies per-mode row counts and the existing manifest rules. It does not modify
Turso, import game data, or add a Turso dependency to the application. Credentials
are only needed for this export and are never written into the manifest.

Alternatively, use a consistent local SQLite database download. Turso's `.db`
download is the right file type; no separate backup format or rename is needed.
With Node 22.13+ (24 recommended):

```bash
npm run db:discovery:export -- source.db discovery.json
npm run db:update
```

The exporter opens local files read-only and refuses an existing output file in
either mode. If SQLite reports a malformed database, use the direct Turso export;
changing the file extension cannot repair missing or inconsistent database pages.
It exports only item_id, mode, first_seen_at, first_seen_patch and legacy release
provenance, with SHA-256 and completeness metadata. It does not import game
entities, release lifecycle, prices, ETags, history, or locks. The target importer
validates the checksum/counts, atomically reports conflicts without overwriting,
and makes identical reimports no-ops. Baseline null dates and removed IDs survive.
Missing established discovery stops for an explicit initialization decision.

For a standalone metadata-only import, run `npm run db:discovery:import -- discovery.json`;
it updates PostgreSQL without running the catalog workflow. Identical reimports are
safe. Late imports can enrich bootstrap records only when date, patch and provenance
are all null. Known historical baselines and later discoveries remain protected:
different known facts abort the whole transaction, and unknown imported facts do
not clear known target values. Removed IDs and records outside the file survive.
`db:update` checks these conflicts before fetching/preparing the catalog, then
rechecks under the transaction lock. Errors print counts and at most five examples;
the full report is saved under `db-scripts/.generated/diagnostics/`.

Run db:update and db:prices:refresh before serving traffic. The price bootstrap supplies trader
purchase/unlock metadata even for unpriced item-detail requests.

## Implementation owners

- [Schema](../src/server/postgres/schema.ts), [SQL migrations](migrations/), and
  [shared connection](../src/server/postgres/connection.ts).
- [Catalog command](update.mjs) and [atomic writer](lib/postgres-catalog.mjs).
- [Discovery validation/import](lib/discovery.mjs).
- [Price workflow](../src/server/prices/refresh-prices.ts) and
  [PostgreSQL store](../src/server/prices/price-store.ts).

Integration tests use TEST_DATABASE_URL with disposable schema fixtures. Preserve
stable source IDs and all existing player data. Never use source compaction/reset
as a workaround for validation errors.

## Retained legacy source

The old generator/publisher/compactor and their helper/test sources remain
temporarily to preserve pre-existing local changes and aid rollback review. Their
npm commands are removed, and runtime/routine PostgreSQL tooling does not import
them. They are not supported target operations. Remove them only after the agreed
rollback window; production source retirement is a separate action. The earlier
[record-encoding extraction](lib/record-encoding.mjs) is preserved with those edits.
