# Operations

## Local setup

Install dependencies with npm ci. Copy [.sample.env](../.sample.env) only when no
local environment file already exists. The runtime and routine commands use
PostgreSQL; production switching follows the separate
[cutover runbook](postgresql-cutover.md).

| Variable                       | Purpose                                                 |
| ------------------------------ | ------------------------------------------------------- |
| DATABASE_URL                   | Runtime, catalog and price PostgreSQL connection        |
| DATABASE_MIGRATION_URL         | Optional direct migration connection for pooled hosting |
| PG_POOL_MAX                    | Connection pool limit (default 10)                      |
| PG_STATEMENT_TIMEOUT_MS        | Statement timeout (default 30000 ms)                    |
| PG_QUERY_LOG                   | Opt-in SQL logging: 1 for summaries, verbose for SQL (default off) |
| TEST_DATABASE_URL              | Separate disposable PostgreSQL test database            |
| CRON_SECRET                    | Bearer secret for the scheduled catalog route     |
| TARKOV_JSON_REQUEST_TIMEOUT_MS | Existing provider per-attempt timeout override          |

Only the optional one-time `db:discovery:export -- --turso discovery.json` command
uses `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. These source credentials are not
needed by PostgreSQL runtime or updates. See the [CLI guide](../db-scripts/README.md)
for direct export and local `.db` export alternatives.

The [environment loader](../db-scripts/lib/config.mjs) preserves process values,
then reads .env.local before .env. Never commit credentials. Use your provider's
verified TLS configuration; migration/build operations do not disable certificate
validation. Apply schema explicitly with npm run db:migrate. Runtime and builds
never run migrations.

Run `npm run db:update` to bootstrap the catalog and discovery directly in PostgreSQL,
then `npm run db:prices:refresh`. No SQLite backup or discovery import is required.
If a verified `discovery.json` exists in the project root, the update imports it
atomically with catalog changes; `--discovery path.json` selects a different file.
Without a file, the first update records current items with unknown first-seen dates;
later updates timestamp genuinely new items. See the [CLI guide](../db-scripts/README.md).
Run npm run dev and open [localhost:3000](http://localhost:3000). A production
build uses npm run build followed by npm start. Database routes require initialized
catalog data and bootstrapped offers/prices for every served mode.

## Measuring database activity locally

Start a fresh server from PowerShell with logging enabled:

```powershell
$env:PG_QUERY_LOG = '1'
npm run dev
```

Browse normally and watch `[postgres]` lines next to Next.js request logs. Each
completed driver query reports its start timestamp, process ID, cumulative count,
query fingerprint, operation, table names, duration, status, and `quietMs` since
the latest observed query completion (null for the first query). Concurrent work
can produce out-of-order start timestamps; overlapping queries report zero quiet
time. Counts and gaps are per server process/pool and reset on restart. Timings
include driver execution/transport, but exclude pool acquisition and connection
setup. Table extraction is a best-effort SQL summary, not a full SQL parser.

Repeat the same navigation after warming caches, then leave the app untouched
for more than five minutes. Repeated fingerprints identify recurring SQL;
requests without SQL lines indicate no observed queries through this app's pool.
These are query logs, not exact cache-hit metrics or Neon billing measurements:
other clients, connection activity, background jobs, and separate CLI pools are
not captured. Standard pool and transaction queries are covered; streaming
Submittable queries are passed through without logging. The logger issues no SQL.

For caching closer to deployment, stop the dev server and run `npm run build`,
then `npm start` with the same environment variable. Treat build-time activity
separately. Development reloads and caching behavior can distort comparisons.
Keep the same game mode for repeated visits, then test mode switches separately.

Use `PG_QUERY_LOG=verbose` to include SQL text. Bound parameter values, result
rows, connection strings, and error messages are never printed by this logger;
verbose SQL can still contain literals embedded directly in a statement. Logs
stay in the server terminal unless you redirect them. To save a local session,
use `npm run dev 2>&1 | Tee-Object -FilePath "$env:TEMP\tarkov-postgres.log"`.
Set the variable to `0` or remove it, then restart the server to disable logging.

## Validation

Run from the repository root:

```bash
npm run docs:check
npm run test:architecture
npm run test:theme
npm run test:contracts
npm run test:query
npm run test:search
npm run test:page-data
npm run test:reusable-reads
npm run test:postgres
npm run lint
npm run build
node --test --import jiti/register src/lib/quests/quest-availability.test.ts
```

PostgreSQL tests require TEST_DATABASE_URL and use isolated disposable schemas.
Pure contract/model tests require no database. The local link check validates
repository links, not remote service availability. Use adjacent pricing, discovery,
ingestion and adapter tests when changing those owners. Validate affected routes,
loading/error states, item details/search/profits and all three mode switches in
the development UI. Preserve browser player storage. Report environmental blockers
instead of resetting data or hiding unrelated failures.

## Old-to-new player data test

Use a separate checkout of the old release, so branch changes cannot mix source,
dependencies or Next.js output. The migration-test checkout prepared for this
change is based on local `main` at `a86a28e9e1f4c69668c58f2b51e2ae6c93326af4`
(Zustand user state v15). When preparing a production cutover, select the actual
deployed commit and record it; do not assume a moving branch still matches it.
Install that checkout's dependencies with `npm ci`. For the old JSON-backed build,
run these commands in its own PowerShell terminal (no production credentials needed):

```powershell
$env:TARKOV_DATA_SOURCE = 'json'
$env:CACHE_ENABLED = 'false'
npm run dev -- --port 3000
```

1. Use a disposable browser profile, and keep it for the entire test. Open
   `http://localhost:3000`. Complete setup, set several station levels, add several
   items with both FiR and non-FiR counts, and complete a quest. Record the values.
   Save the exact `tarkov-hideout-user-state` localStorage value as a local fixture
   using browser developer tools. The old compact export alone cannot back up items.
2. Close the old app's tabs, stop its server with Ctrl+C, then run
   `npm run dev -- --port 3000` in the new checkout with its usual PostgreSQL setup.
   Open the same origin in the same browser profile. The conversion dialog should
   open automatically and explicitly say that quests will not be imported.
3. Convert to PVE (or another chosen profile). Verify station levels and each
   item's separate counts, reload, then switch through PVP/PVE/KORD. Only the
   selected profile should contain the converted progress; quests should be fresh.
   Check that the old storage value is byte-for-byte unchanged and the new
   `tarkov-hideout-profiles-state` key exists.
4. Reopen conversion from Settings and exercise the replacement warning, cancel,
   and retry. In another disposable browser profile, repeat the first-load test
   with dismissal, then reload: it should stay dismissed but remain available in
   Settings. Check conversion still works if station metadata cannot load.
5. Stop the new server, start the old one again, and verify the old progress remains
   available. Close old tabs before switching back. New profiles should retain
   their own progress and conversion status.

The storage is localStorage, not cookies: the scheme, hostname **and port** must
match throughout each trial. Cookies only help select the server-side game mode.
If 3000 is occupied, use another explicit port for **both** versions. To repeat a
first-visit test, use another disposable browser profile; do not clear real player
storage. Automated [storage regression tests](../src/lib/stores/user-state-storage.test.ts)
exercise serialized v15 hydration, stale flags, profile relocation, mixed saves,
conversion, reload, mode switching, resets and write failures. If the test runner
cannot spawn child processes, add `--experimental-test-isolation=none`.

## Catalog updates

```bash
npm run db:update -- --dry-run
npm run db:update
npm run db:status
npm run db:status -- --storage
```

Catalog ingestion fetches/normalizes all three modes, validates complete input,
composes current item details and atomically applies changed domain rows. All-mode
updates reconcile shared presentation and variant overrides. Partial-mode catalog
writes are rejected. New discoveries record their observation timestamp without stamping a patch.
Dry runs validate and report without writing. They do not consume discoveries.

The catalog advisory lock and content-version check reject competing stale writers.
Catalog writes preserve prices and existing discovery, and malformed/empty inputs
cannot publish readiness. A no-op may advance source/check freshness in the small
status row without changing content_version. There is no release directory,
activation, snapshot hash registry, manual pin or historical catalog rollback.

Optional discovery input is checksummed and conflict-checked. A present but invalid
file stops the update; it is never silently ignored. Dry runs preview discovery
without importing or initializing it. Standalone `db:discovery:import` writes only
discovery metadata; it does not require a catalog update. Later imports can enrich
wholly unknown bootstrap records, but cannot overwrite established observations or
known historical baselines. Unknown imported records cannot erase known facts.
Conflicts are checked before expensive catalog preparation and again under the
transaction lock. Console output shows counts and at most five examples; the full
prior/incoming records are written to `db-scripts/.generated/diagnostics/`.
Capture complete command output when diagnosing a run, for example in PowerShell:
`npm run db:update *> db-scripts/.generated/catalog-update.log` (create the output
directory first). Keep logs and reports local; never include environment values.

## Release timeline

Edit [game-releases.json](../src/lib/data/game-releases.json) to associate first-seen
observations with game releases. The configured dates were supplied by the project
owner: 1.0 on November 15, 2025; Seasons on August 3, 2026; Lighthouse/Lightkeeper
on September 8, 2026; and League System on September 15, 2026. November 15 is
interpreted as the 1.0/beta boundary. Times were not supplied, so these boundaries
use midnight UTC and can be refined later.

Numeric patches accept four components plus an optional fifth build number.
Keep the build numbers to distinguish the two 1.1.5 updates. Optional `name` fields
explain each entry in the config. A `"patch": "beta", "releasedAt": null` entry
covers dated observations before 1.0 without inventing a beta start date. It does
not assign a release to observations whose timestamp is unknown.

```json
{
  "releases": [
    { "patch": "1.1.5.0.47242", "name": "Lighthouse and Lightkeeper Rework", "releasedAt": "2026-09-08T00:00:00Z" }
  ]
}
```

Entries apply to all modes unless `"modes": ["regular", "pve"]` (or
`"pvp-season"` for KORD) is supplied. Order does not matter. Duplicate patches or
start times within a mode, malformed dates, and unknown modes are rejected.
An observation belongs to the most recent release starting at or before its
first-seen timestamp, until the next release. Add missing releases or correct dates
and redeploy; associations are calculated on reads, so no database backfill is
needed. Existing browser/API caches may retain old labels until refreshed/expired.

The database keeps the original observation timestamp; it is never replaced with a
release date. Unknown bootstrap timestamps remain unknown. Old stored patch labels
remain in storage for provenance. Imported labels are a fallback when no timeline
entry covers an observation; old locally stamped labels are not trusted as a fallback.
The `pre-1.1.5` historical baseline remains intact. An association describes when the
tracker first saw an item, not proof of when the game introduced it.

`CURRENT_GAME_PATCH` and the CLI `--patch` option are removed. New observations
store a timestamp with a null patch; discovery exports/imports accept those records
alongside existing historical records without changing their checksums or history.

## Current dataset dashboard

The page also contains an [ItemImage gallery](../src/app/dev/ItemImageGallery.tsx)
with all visual flag combinations, sizes, image fallbacks, and local interaction
examples. It uses a fixed sample item and remains available when dashboard data
fails. Its custom controls do not modify saved player data.

The development-only [/dev page](../src/app/dev/page.tsx) displays current status,
counts, content version and freshness by mode, plus the latest price push, market
analysis runs and biggest movers. The API keeps releaseId only as a
compatibility field containing the string content version. It is not a release
lifecycle. Search's stale-token protocol remains unchanged.

## Mutable price refresh

```bash
npm run db:prices:refresh -- --modes pvp-season
npm run db:prices:refresh -- --modes regular,pve --concurrency 12
```

[refresh-prices.ts](../src/server/prices/refresh-prices.ts) separately accepts
catalog reference values/trader offers and conditional flea history. Failed inputs
retain their own previous good values. The store uses renewable owned leases,
chunked guarded writes, current sync state and only the latest run summary.
The retained recent window has at most ten points per item/mode. The History tab
continues its independent on-demand upstream fetch.

The Dockerized [market-analyzer worker](../market-analyzer/README.md) owns scheduled
price refreshes: Seasonal near-live, regular/PVE every six hours, pushed hourly,
plus derived analytics. Manual price refreshes share its per-mode lease.

### Scheduled catalog updates

[vercel.json](../vercel.json) schedules one daily request at 00:15 UTC to
[/api/cron/catalog](../src/app/api/cron/catalog/route.ts). It requires the existing
`CRON_SECRET` bearer token and `DATABASE_URL`. No current-patch variable is needed.
The former price cron endpoints are removed; prices are handled by the worker or
`db:prices:refresh`.

The route bundles the same adapters and catalog preparation as `db:update`, fetches
all three modes, prepares item details, and uses the same validated atomic writer.
It preserves prices and existing discovery. It does not run migrations or import a
local discovery file; use the CLI for explicit discovery imports and dry runs.
Missing secrets return 503, unauthorized requests 401, and update failures 500;
success reports changed/no-op status and per-mode counts. A competing catalog write
invalidates a stale preparation baseline instead of allowing it to overwrite data.

Deploy to activate the changed schedule. The route requests a 300-second execution
budget; verify that the hosting configuration permits it and monitor the first run's
duration and catalog freshness with `db:status`. If a run times out or fails before
commit, no partial catalog is published. Vercel does not automatically retry failed
cron invocations; an authenticated retry or `db:update` can recover a failed run.

### Flea stability evidence and validation

On September 5, 2026, read-only inspection of the configured release
`20260904T211847Z` and mutable storage covered 10,750 current rows and 106,017
stored observations. No production refresh or release publication was performed.
The sampling unit is an observed listing snapshot, not a transaction.

| Data mode  | Current rows | Latest depth median / p90 | Latest aggregate/minimum p95 / p99 | Stored points with depth 1–2 |
| ---------- | -----------: | ------------------------: | ---------------------------------: | ---------------------------: |
| regular    |        3,541 |                    3 / 21 |                        1.63 / 2.52 |                        46.9% |
| pve        |        3,695 |                    6 / 40 |                        2.03 / 3.75 |                        33.5% |
| pvp-season |        3,514 |                    4 / 26 |                        1.65 / 2.69 |                        35.5% |

Reviewed sugar, bolts, Iskra and Salewa, base/default AK-74N, both M1A presets,
Red keycards, graphics cards, LEDX and T-7 goggles in every mode. Sugar's ten
minimums ranged 49–64k regular, 62–92.4k PVE and 38.9–52k KORD, with depths
23–375 across modes. Red keycards ranged roughly 780k–1.11m with depths 5–58.
T-7s legitimately remained 10–30m: PVE had depths 3–10, while KORD's six
observations repeated 18m at depth one. High absolute value is not an anomaly;
repetition of one listing is not proof of liquidity.

Stored aggregate/minimum ratios at least 2x occurred in 2.6%, 5.9% and 2.8% of
regular/PVE/KORD observations. Adjacent minimum ratios at p90 were 1.85x, 2.00x
and 1.69x. Thus 2x divergence/jump signals target substantial moves while the
median tolerates ordinary commodity variation. The 1.25x confirmation cluster,
three-observation/two-hour deep confirmation, five-observation/eight-hour thin
confirmation, and 72-hour stale cutoff are conservative policy choices aligned
with approximately two-hour provider observations and daily regular/PVE refresh.
They are not statistically calibrated transaction-confidence thresholds.

Sustained observed regimes were also reviewed: regular SMW car key settled from
about 20–23k to 10k for three observations at depth 7–8 over 3.83 hours; PVE
default Kedr moved from 14.5–20k through thin spikes to 49–49.6k at depth 3–4 over
3.83 hours. KORD's SPRM rail returned from 24–25k single offers to three 9,995
observations at depth 3–4 over 3.83 hours. These support accepting sustained
regimes while flagging transition windows; they cannot establish completed sales.
There were no zero/null-depth stored points; eight empty current rows had null
depth. Zero, null and malformed cases therefore use synthetic regression coverage.

At inspection time the conservative model classified 1,251 regular, 1,455 PVE and
1,499 KORD items as stable. This classification is advisory: thin/stale/volatile
items retain rough minimum estimates for costs and profits, with a compact warning
on selected unstable flea sales. Only unavailable inputs leave calculations unpriced. Ten points cannot preserve a historical anchor indefinitely, and stable
listings still do not prove throughput or guarantee fill quantity. Reassess using
future observed distributions rather than adding category-specific hard caps.

Additional focused coverage:

```bash
node --test --import jiti/register src/lib/utils/flea-price.test.ts src/lib/utils/price-history.test.ts src/server/services/priceHistory.test.ts src/server/db/price-data.test.ts src/features/items/item-detail/ItemDetailMarket.test.ts
```

## Diagnostics and content maintenance

Use db:status for discovery readiness, current catalog counts/freshness and price
summaries; --storage adds PostgreSQL relation sizes. Inspect
[database errors](../src/app/api/_lib/route-errors.ts),
[search](../src/server/db/search-manifest.ts), and
[price store](../src/server/prices/price-store.ts) for the corresponding failures.
Do not treat content_version as a restore point.

Map/quest-content utilities remain independent: npm run pull-map-overlays,
quest-series-candidates and quest-data-compare. See [maps](maps.md), [quests](quests.md)
and [data layer](data-layer.md) for their source policies.
