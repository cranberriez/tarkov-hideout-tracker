# PostgreSQL production cutover

This runbook is prepared separately from implementation. No production database,
traffic, secrets, scheduled jobs, or browser player data are changed by local tests.
The target is a fresh catalog; the only imported business data is item discovery.

## Provision and rehearse

1. Provision PostgreSQL and backups. Set `DATABASE_URL` on the application and
   writers. Set `DATABASE_MIGRATION_URL` to a direct connection if the provider's
   runtime pooler cannot support migration session locks. Verify TLS certificate
   validation, connection limits, statement timeouts, network access, and restore
   procedures. `.env.local` overrides `.env`; process variables override both.
2. Run `npm ci` and `npm run db:migrate` against the target. Migrations are explicit;
   page requests and builds never create schema. Do not reuse production as
   `TEST_DATABASE_URL`; integration fixtures require a disposable database.
3. **Optional history preservation:** set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`
   locally and export just discovery from the source while it keeps serving traffic:

   ```bash
   npm run db:discovery:export -- --turso discovery.json
   ```

   This reads `item_catalog_history` and `catalog_tracking` in one read-only snapshot.
   A consistent database download also works with Node 22.13+ (24 recommended):
   `npm run db:discovery:export -- source.db discovery.json`. The `.db` extension
   needs no conversion. Direct export avoids dependence on a complete binary download.

   Keep the manifest/checksum and compare every mode's counts with the source.
   Null baseline dates and removed items must survive. Missing established
   history stops import for an explicit initialization decision. Conflicts stop
   the entire import; never overwrite first-seen facts or assign today's date to
   an unknown baseline. Identical reimports are harmless. `db:update` automatically
   imports this file in its catalog transaction; no separate import command is needed.
   For metadata-only import, `npm run db:discovery:import -- discovery.json` remains available.

   To start without historical metadata, skip this step and leave `discovery.json`
   absent. Bootstrap initializes current items with unknown dates/patches; later
   updates track new items automatically. Existing PostgreSQL discovery survives.
   Late imports cannot overwrite this baseline, so decide whether old history is
   needed before the first catalog update. Both `.db` and `.sqlite` backup names work.

4. Bootstrap current upstream data and then reference prices, trader offers, and
   flea observations:

   ```bash
   npm run db:update -- --dry-run
   npm run db:update
   npm run db:prices:refresh -- --modes regular,pve,pvp-season
   npm run db:status
   ```

   Configure known release dates in the release timeline. Catalog updates require all three
   modes. A source outage leaves the old application serving. Verify populated
   catalog, detail projections, discovery initialization, and independent price
   reference/offer freshness in all modes before enabling traffic.

5. Run the documented checks against the disposable target and rehearse PVP/PVE/
   KORD pages, search, item details, profits, loading/errors, and stable-ID player
   progress using an isolated browser profile. Never reset existing player data.

## Switch traffic

1. Pause **all** old catalog and price writers (including platform/manual jobs
   outside Git). If preserving historical discovery, capture a final consistent
   export and reconcile it into PostgreSQL. Conflicting discoveries require
   investigation before traffic. Starting with unknown dates needs no SQLite export.
2. Recheck target readiness and deploy the PostgreSQL readers, CLI, and cron
   configuration together. Keep `CRON_SECRET` and the checked-in Vercel schedules.
   Ensure no legacy and PostgreSQL writers are running simultaneously.
3. Smoke-test all modes, known missing IDs, price status, search stale-token 409,
   and trader unlock offers. Resume only the PostgreSQL writers. Monitor errors,
   database connections, request times, and price run summaries.

## Rollback and retirement

Keep the old deployment/source for an agreed rollback window. Before new target
discoveries are written, reverting the deployment is sufficient. Afterward,
export and reconcile new `(item_id, mode)` first-seen facts back into the rollback
source **before** reverting. This reconciliation requires an operator-reviewed
procedure; the SQLite exporter is not a reverse importer. Catalog and price data
can be fetched again. Never run both writer sets.

`content_version` is a cache identity, not a historical snapshot or restore point.
Retire the old source/deployment only after the rollback window and verified
backups. Legacy script source remains temporarily in this checkout to preserve
pre-existing edits; it is excluded from routine commands and must not be used
against the target.

## Deployment prerequisites to verify

- Production PostgreSQL credentials, TLS/pooling/timeouts, backups and restore.
- If preserving old discovery: a final consistent direct export or source database file,
  verified completeness and checksum.
- All external schedulers/manual writers paused before switching traffic.
- Full upstream bootstrap and successful pricing/reference-offer refresh on the
  production target, followed by route and browser checks.
- Hosting duration limits for refresh/catalog jobs and cron authentication.
- Agreed rollback window and a reviewed reverse discovery reconciliation method.

Local fixture tests do not certify any of these production conditions.

## Implementation verification

Validated on 2026-09-27 against a disposable PostgreSQL 17 database:

- Explicit migration and repeat migration; read-only SQLite discovery export and
  checked import using a synthetic source, including idempotence/conflict tests.
- Live upstream catalog bootstrap for all three modes (5,442 items and detail
  projections per mode), followed by a second update preserving current prices.
- Independent reference/offer refresh in every mode. Flea refresh accepted 11,146
  histories; 707 item/mode checks reported missing or unusable upstream histories
  and remained explicit partial failures rather than overwriting good values.
- PostgreSQL integration, architecture, theme, contracts, query, search, page-data,
  reusable-read, quest-availability and adjacent adapter/workflow tests passed.
  Production build passed; lint had zero errors and 26 existing UI warnings.
- Development browser checks covered Hideout, search, item details, current trader
  offers, quests, profits, loading/error UI and PVP/PVE/KORD switches. API checks
  returned expected 200, invalid-input 400, missing-item 404 and stale-search 409.

This rehearsal used an isolated browser origin and synthetic discovery provenance;
it neither verified genuine production discovery completeness nor changed existing
player storage. Production deployment and the prerequisites above remain unverified.
