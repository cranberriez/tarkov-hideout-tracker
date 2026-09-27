# PostgreSQL conversion

Status: agreed architecture, implemented in this checkout. Runtime and routine
writers target PostgreSQL domain tables. Game data is rebuilt from Tarkov.dev;
pricing is separate and only durable item first-seen metadata is imported.
Production cutover remains separate: follow the [cutover runbook](postgresql-cutover.md).

## Implementation handoff

Implement this design in the existing repository, following AGENTS.md and the
owning documentation. The architecture decisions below are settled; proceed with
schema, queries, scripts, tests, and documentation rather than restarting planning.
Resolve routine column names, module organization, and compatible package versions
from source and engineering judgment. Surface a material behavior/design conflict
if implementation evidence requires changing an agreed decision.

Complete and validate the code conversion against a disposable PostgreSQL target.
Keep existing local changes accounted for. Do not overwrite player data, change
stable IDs, migrate unrelated SQLite data, or introduce permanent dual storage.
Production provisioning/cutover and destructive source retirement remain separate
deployment steps; prepare a concrete runbook before those actions. Missing target
credentials should not prevent independent implementation and fixture-based work;
report any live integration or deployment steps that remain unverified.

The handoff is complete when the PostgreSQL schema and named DTO queries are
implemented; both update workflows and the first-seen import work; existing API
contracts and mode isolation are validated; search uses PostgreSQL plus Next cache;
and runtime/routine tooling no longer depends on SQLite/Turso. Report checks,
remaining deployment prerequisites, and any deviations from this document.

## Target design

Use ordinary named tables: items, stations, traders, quests, skills, crafts,
barters, and item prices. Remove the generic entities/current-records/shared-payload
model, release publication system, stored historical catalogs, and historical
price-point tables. JSONB belongs on the domain row that owns the document.

Use Drizzle with `pg` for typed tables, queries, and reviewed SQL migrations.
There is no existing ORM to reconfigure; `@libsql/client` is the current driver.
Keep the domain repository boundary and expose named query functions that return
existing DTOs. Routes should not know how PostgreSQL stores a quest or station.
The [Drizzle PostgreSQL integration](https://orm.drizzle.team/docs/get-started-postgresql)
and [migration workflow](https://orm.drizzle.team/docs/migrations) support this
approach. Select compatible stable package versions during implementation.

### Shared identities and mode-specific rows

An item/station/trader/quest with the same upstream ID has one shared identity
row. A corresponding `*_modes` row says that it exists in that mode and holds its
mode-specific attributes. Missing mode row means unavailable in that mode. Mode
values remain `regular`, `pve`, and `pvp-season` (PVP, PVE, KORD).

This is preferable to three presence booleans: requirements, eligibility, rewards,
and prices already need a place keyed by both identity and mode. Membership rows
provide that key directly and permit foreign keys to the correct variant. Do not
add both membership rows and boolean flags as competing sources of truth.

For example, one `stations` row represents the Workbench. Its `station_modes`
rows declare presence, and `station_levels` holds separate regular/PVE/seasonal
level requirements. A quest existing only in seasonal has one `quests` row and
one `quest_modes` row. An item shared by all modes has one `items` row, three
`item_modes` rows, and up to three independently refreshed `item_prices` rows.

The adapters fetch each mode independently. Shared existence does **not** prove
identical attributes: flea restrictions, trader offers, quest rewards, and even
presentation can differ. Import compares modes rather than assuming equality.
Shared presentation uses a deterministic regular, then PVE, then seasonal source.
Each mode table permits a nullable `display_override jsonb`: when necessary, this
is a complete replacement presentation object (names/images/links), not an
arbitrary recursive patch. Normally it is null. Mode-specific gameplay fields
are always explicit and complete; never inherit regular requirements into PVE
or seasonal because a row is missing.

Catalog ingest should fetch all three modes by default. An initial implementation
can require all three for catalog updates, simplifying shared-field reconciliation.
Do not offer partial-mode catalog writes until shared-field changes can also
revalidate the other modes' display overrides, cached DTOs, and content versions.
The separate pricing command can continue accepting selected modes.

## Proposed tables

These are proposed physical tables and principal columns, not applied migrations.
Stable source IDs remain text. Domain FK columns use the same type. Every mode
column has the three-value check and every variant PK includes mode. A table is
introduced for a distinct domain/query need, not for every nested upstream object.

| Table                       | Key and contents                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `items`                     | `id` PK; shared name, normalized_name, short_name, icon/grid/512px/base image URLs, link, wiki_link. No market price or embedded price DTO.                                                                                                                                                                                                                                                                     |
| `item_modes`                | `(item_id, mode)` PK, FK to items; on_flea_market, min_level_for_flea, category JSONB, display_override, source_updated_at. Future dynamic item properties belong in a domain-specific JSONB column.                                                                                                                                                                                                            |
| `traders`                   | `id` PK; name, normalized_name, image URLs.                                                                                                                                                                                                                                                                                                                                                                     |
| `trader_modes`              | `(trader_id, mode)` PK/FK; optional display_override. Small membership rows even when every trader exists in every mode.                                                                                                                                                                                                                                                                                        |
| `stations`                  | `id` PK; name, normalized_name, image URL.                                                                                                                                                                                                                                                                                                                                                                      |
| `station_modes`             | `(station_id, mode)` PK/FK; optional display_override, source_updated_at.                                                                                                                                                                                                                                                                                                                                       |
| `station_levels`            | `(station_id, mode, level)` PK; FK to station_modes; original upstream level_id, construction_time; station_requirements, skill_requirements, trader_requirements JSONB. Preserve names/normalized-name references used by current adapters.                                                                                                                                                                    |
| `station_item_requirements` | `(station_id, mode, level, requirement_id)` PK; FK to station_levels; original item_id, quantity, found_in_raid, is_tool. This ordinary indexed relation supports item demand and item-to-hideout usage.                                                                                                                                                                                                        |
| `skills`                    | `id` PK; shared name and image URL.                                                                                                                                                                                                                                                                                                                                                                             |
| `skill_modes`               | `(skill_id, mode)` PK/FK; optional display_override. Keep source names in requirements because current skill references are name-based.                                                                                                                                                                                                                                                                         |
| `quests`                    | `id` PK; shared name, normalized_name, wiki_link, image URL.                                                                                                                                                                                                                                                                                                                                                    |
| `quest_modes`               | `(quest_id, mode)` PK/FK; trader_id, min_player_level, experience, faction_name, kappa_required, lightkeeper_required, removed, map JSONB, display_override, source_updated_at. Separate JSONB columns for objectives, task_requirements, fail_conditions, trader_requirements, other_requirements, required_prestige, and reward groups.                                                                       |
| `crafts`                    | `(id, mode)` PK; product_item_id, product_count, station_id, level, duration, task_unlock_id; required_items, required_quest_items, game_editions JSONB. Preserve existing recipe IDs.                                                                                                                                                                                                                          |
| `barters`                   | `(id, mode)` PK; offered_item_id, offered_count, trader_id, min_trader_level, task_unlock_id, buy_limit; required_items JSONB.                                                                                                                                                                                                                                                                                  |
| `item_prices`               | `(item_id, mode)` PK/FK to item_modes; current effective/minimum/reference price, latest_offer_count, latest_point_at, catalog average/high/low/reference fields and their source timestamp, last_changed_at; trader_purchase_offers and trader_sell_offers JSONB; recent_points JSONB limited to ten normalized points. Prices are a separately updated child relation of the item, not an item catalog field. |
| `item_price_sync`           | `(item_id, mode)` PK/FK to item_modes; etag, last_checked_at, consecutive_failures, last_error. Allows failed initial checks without an available market price and avoids rewriting price values on 304 checks.                                                                                                                                                                                                 |
| `item_discovery`            | `(item_id, mode)` PK; first_seen_at, first_seen_patch, nullable legacy_first_seen_release_id. Durable even when the item disappears. No FK requiring a currently available item. This is the only business data imported from SQLite.                                                                                                                                                                           |
| `item_details`              | `(item_id, mode)` PK/FK to item_modes; relations, usage, acquisition JSONB. Rebuildable current DTO projections, without prices. Reuse existing generation-time graph composers so a detail request remains a bounded read. No generic view types, payload hashes, or historical copies.                                                                                                                        |
| `catalog_status`            | `mode` PK; content_version, checked_at, updated_at, source_freshness JSONB, discovery_initialized. One current row per mode; used for freshness and cache identity only. No release records or selectable historical versions.                                                                                                                                                                                  |
| `price_refresh_state`       | `mode` PK; lease owner and expiry, last_started_at, last_completed_at, last_summary JSONB. Only current job coordination/status; structured logs supply operational audit if needed. No append-only run-history table is required.                                                                                                                                                                              |

Use normal scalar columns for keys, prices, flags, sortable names, timestamps,
and fields queried by SQL. JSONB is appropriate for polymorphic quest objectives,
rewards, nested prerequisite groups, recipe ingredients, and compact recent price
inputs. No shared `data_payloads` table or generic `entities` table remains.

Quest-specific pickups remain within quest data; they are not standard items.
Recipe synthetic references (for example generic dog tags) and unresolved IDs
must not be converted to fake catalog items. Keep original reference text and
explicit unresolved results. Add strict variant FKs for guaranteed relationships
such as mode membership, station levels, and prices; validate producer/source
references during ingestion before imposing their FKs. Optional unresolved quest
unlocks and nested references remain source IDs, not broken mandatory FKs.

`station_item_requirements.item_id` preserves the original requirement reference;
resolve it against item_modes in queries and report missing IDs. Requirements
must not disappear merely to satisfy an FK. Requirement IDs themselves must remain
unchanged because saved progress uses them.

Use `bigint` milliseconds for existing timestamps with safe-number conversion at
the DTO boundary. Flea prices use nonnegative integer RUB values following existing
rounding; nullable means unavailable. Recipe quantities can be fractional and
need an appropriate numeric representation, not an integer-only constraint.
Preserve decimal trader/currency prices in their normalized offer objects.

### Relationships and indexes

- Each `*_modes` relation references its shared identity. Levels reference the
  station variant; requirements reference a level. Current prices/sync/details
  reference the item variant. Deleting a mode's current item can remove these
  rebuildable children, but never discovery. Removing PVE cannot remove regular.
- Variant PKs start with identity then mode for item/quest detail reads. Add
  `(mode, identity_id)` indexes for mode lists where measured plans require them.
  Add `(mode, item_id)` on station item requirements for reverse usage.
- Index crafts on `(mode, product_item_id)` and `(mode, station_id, level)`;
  barters on `(mode, offered_item_id)` and `(mode, trader_id)`. Index quest variants
  on `(mode, trader_id)` when used by database queries.
- Search queries use normalized name/short-name columns and the existing ranking.
  Measure substring scans before adding `pg_trgm`; a B-tree alone does not optimize
  `%substring%`. Current catalogs are small enough to measure first.
- Do not index every JSONB document. Introduce an objective-item reference index
  only when a real SQL query needs it; existing item_details already covers the
  expensive reverse quest/recipe graph reads.

## Queries and API compatibility

Keep the shape and purpose of existing [contracts](../src/types/contracts.ts),
[domain types](../src/types/), and [repository interface](../src/server/repositories/tarkov-data/types.ts).
Use named table query modules plus DTO assemblers, not generic entity-type SQL.
All joins include mode. ORM rows are not API responses.

| Query family          | Tables and DTO responsibility                                                                                                                             |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Items                 | Join items/item_modes and discovery, optionally item_prices. Return ItemSummary keyed by requested IDs; prices=none omits market hydration.               |
| Stations              | Join stations/station_modes/levels/requirements; return the existing nested Station[] with mode-correct quantities and original IDs.                      |
| Quests                | Join quests/quest_modes/traders; assemble FullQuest, including mode-specific requirements/rewards and explicit unresolved references.                     |
| Traders and skills    | Read shared identities through requested mode membership and apply any complete presentation override.                                                    |
| Recipes               | Query crafts/barters by mode and return existing CraftRecord/BarterRecord DTOs. Both graphs remain necessary for profit calculations.                     |
| Prices                | Read item_prices and sync, reuse deriveEffectivePrice over recent_points, and assemble CurrentPrice with the existing null/stability/freshness semantics. |
| Item details          | Read one current item_details row, hydrate discovery and optional prices, and return the existing relations/usage/acquisition DTOs.                       |
| Search                | Read compact item/quest/trader projections through mode membership and build/cache the existing search manifest DTO. No stored generic manifest table.    |
| Status and conversion | Read catalog_status/price status and bounded station/item queries; preserve DataStatusPayload and conversion support DTOs.                                |

Most API route URLs, validation, response shapes, and cache headers stay the same:
items/prices GET and legacy POST, item search/detail APIs, page-data APIs, status,
and conversion routes. Preserve missing IDs, partial-domain errors, and the
distinction between unknown prices and zero. Maps and browser persistence are
outside this database conversion.

Two existing compatibility details need explicit handling:

1. `/api/search` and its browser cache use `releaseId`. Keep that field temporarily
   as the string representation of catalog_status.content_version, including the
   existing stale-token 409 response. DataStatusPayload can expose the same token
   under its old field name. It is only cache identity; no release lifecycle,
   snapshot storage, historical lookup, activation, or rollback endpoint exists.
2. ItemSummary.firstSeenReleaseId can map the imported legacy provenance string
   when present. New discoveries need no release ID. Retain the old information
   as optional provenance rather than maintaining releases to support a field.

Replace release-scoped repository construction with a request-scoped PostgreSQL
read context. Multi-query DTO assembly needs either a short read-only REPEATABLE
READ transaction on one connection or before/after content-version checks that
retry on change. Cache only results belonging to the observed content version.
Use an internal PostgreSQL cache namespace; keep existing HTTP/TanStack lifetimes
and all browser player keys unchanged.

### Search manifest caching

Generate the compact manifest directly from PostgreSQL item, quest, and trader
projections and cache it in Next's server data cache. Reuse the existing manifest
builder, compression, and bounded-cache helper. Key entries by manifest format
version, mode, and catalog_status.content_version; do not store manifests in a
database table. Read the current content version before choosing a cache entry.

On a cache miss, build from a consistent database snapshot and verify that the
snapshot's content version matches the requested cache key. A concurrent catalog
update must cause a retry/stale-token response rather than caching newer content
under an older version. Failed or partial builds must not enter the success cache.
Catalog content and its version change atomically, so subsequent requests select
the new cache entry. Pricing updates do not change that version or invalidate the
search manifest. Preserve the existing browser manifest DTO/cache protocol.

## Two routine update workflows

### Catalog: fetch Tarkov.dev and update domain tables

Keep `npm run db:update` as the catalog command. Fold the current generate,
validate, and upload steps into that command:

1. Fetch all requested domain datasets for all three modes using the existing
   [adapters](../src/server/services/) and reviewed hideout rules. Normalize and
   validate before writes. Empty/malformed required data must fail the update.
2. Compare mode identities/presentation, build mode-specific domain rows and
   current item-details DTOs. Strip market prices and trader monetary offers from
   catalog-owned records; those are written by the pricing workflow.
3. Acquire a short catalog writer lock, verify the state used to prepare the
   update, and apply all domain changes in one transaction. Upsert only changed
   content and remove absent mode memberships only after complete valid input.
   Reconcile shared identities only when unused by every mode.
4. Insert first-seen metadata only for new `(item_id, mode)` pairs. Never replace
   imported metadata or rediscover a returning item. Update source freshness and
   increment content_version only for actual catalog/DTO changes. A successful
   unchanged check may update the small catalog_status row only.
5. Commit atomically. No release directory, active pointer, activation step,
   snapshot checksum registry, or historical catalog copy is needed.

`--dry-run` still fetches/validates and reports counts without writes. Optional
local fixture/export files are debugging inputs, not a publication protocol.
Retain `--patch` for discovery provenance. Existing source IDs and seasonal override
policies remain authoritative. This writer never overwrites existing prices.

### Prices: update the item price relation separately

Keep `npm run db:prices:refresh`, selected-mode options, and the authenticated cron
routes. Reuse current normalization, conditional requests, concurrency/chunking,
and effective-price calculations behind the PostgreSQL PriceRefreshStore.

The existing job only refreshes flea observations; other reference values used to
come from release data. With releases removed, the pricing command must also
fetch the mode's catalog price/offer data through the existing item adapter, once
per mode, to populate averages/highs/lows and trader purchase/sale offers. Preserve
those source semantics and timestamps; do not label the latest aggregate as a
24-hour average. Failed catalog-price and flea-history inputs must independently
preserve their previous good values. Use separate acceptance/freshness handling
for these inputs so a 304 flea response does not hide updated trader offers.

Trader purchase offers currently include unlock conditions and contribute to
item-detail/acquisition DTOs even when market prices are deferred. Queries must
continue returning that metadata in buyFromTrader; joining the price relation
for offers does not force flea hydration. At cutover, bootstrap pricing before
serving these DTOs. Cached offer-bearing DTOs must use a price/offer freshness key
or hydrate offers at read time; item_details must not retain stale embedded offers.

Keep only **up to ten recent normalized observations** in item_prices.recent_points
as a bounded working input, not a historical dataset. The current stability
algorithm needs this window, including age checks on reads and 304 refreshes.
Removing all samples would change pricing behavior. Validate sorted unique
positive timestamps, nonnegative values and nullable/zero depth in the adapter;
use a JSONB array/length check in PostgreSQL. Preserve point observation metadata
when samples are unchanged. Do not save full upstream history responses.

Batch writes once per workflow chunk; update price data only when accepted values,
samples, or required change timestamps differ. 304/failure responses update the
narrow item_price_sync row. Failed, empty, malformed, or older history never
replaces good observations. Explicit zero offers remain unavailable, not a reason
to fall back to a reference estimate. Last changed/check timestamps retain their
existing meaning, including accepted provider changes with identical numbers.

Use a per-mode expiring lease with ownership verification before writes and
renewal for long jobs; never hold a pooled connection through HTTP work. Record
only the latest run summary in price_refresh_state. A disappearing item should be
rechecked inside the write transaction and skipped explicitly, not recreated by
the price writer or allowed to abort unrelated items in the chunk.

The History tab continues its on-demand upstream history fetch and two-hour cache.
The repository's stored-history method can return the bounded recent_points array.
Future price-analysis results can get a dedicated table when a consumer exists;
no speculative history warehouse or analysis calculations are part of this work.

## Optional SQLite import and PostgreSQL discovery

The source [item_catalog_history](../db-scripts/schema.sql) contains item_id, mode,
first_seen_at, first_seen_patch, and first_seen_release_id. Export those fields
read-only from a local SQLite file or directly through Turso SQL-over-HTTP, with
a checksummed manifest and per-mode counts. Direct export reads both discovery tables
in one transaction and verifies counts, without downloading unrelated data or changing
the source. Source credentials are export-only. Preserve null timestamps
for the pre-1.1.5 baseline and preserve entries for removed items. Do not collapse
mode-specific dates into one global earliest date.

Import is optional. `db:update` automatically validates a project-root `discovery.json`
when it exists, or an explicit `--discovery` path, and reconciles it within the
catalog transaction. Source catalog_tracking is a completeness check; its release
machinery is not imported. A present malformed/conflicting file aborts the update.
Identical reimports are no-ops; conflicting known values require a report, never an overwrite.
Only wholly unknown target records (null date, patch and provenance together) may
be enriched by verified imports. Historical `pre-1.1.5` baseline null dates are
known facts, not unknown bootstrap metadata. Unknown incoming rows preserve known
target facts. Conflict reports contain per-mode counts and all prior/incoming
records, with only a bounded sample printed to the console.

Without an import, the first successful catalog update initializes each mode with
null first-seen dates, patches and provenance for its current items. Set
discovery_initialized in that same transaction. This is an unknown-date baseline,
not an assertion that all items are new or pre-1.1.5. Subsequent updates automatically
timestamp new `(item_id, mode)` pairs and preserve removed/returning records.
The standalone importer writes discovery directly to PostgreSQL without requiring
`db:update`. Late imports can enrich unknown bootstrap metadata; they cannot
overwrite recorded observations or known historical facts. Reconciliation is
preflighted before upstream preparation and rechecked within the transaction.
Dry runs never import
or initialize discovery.

Do not import SQLite game entities, payload hashes, releases, manifests, item
views, prices, observation history, ETags, locks, or run history. Rebuild the game
catalog from current upstream data, then populate prices with the separate script.
An upstream outage during initial population keeps the old application serving
until the target is ready. This is fresh catalog population, so compare DTO
semantics and identities rather than requiring old and new game content hashes
to match across different upstream fetch times.

## Existing implementation to replace or simplify

| Current area                                                                                                                                                                                                           | Work                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [schema.sql](../db-scripts/schema.sql)                                                                                                                                                                                 | Replace all physical tables/views with domain schema above. Only item_catalog_history contributes imported business data.                                                                      |
| [DB readers](../src/server/db/), [repository](../src/server/repositories/tarkov-data/postgres-repository.ts), [query-utils](../src/server/queries/query-utils.ts), [searchItems](../src/server/queries/searchItems.ts) | Replace libSQL SQL/client types with named PostgreSQL queries and DTO assembly. Remove generic entity dispatch, string-only JSON parsing, active-release selection, and SQLite error matching. |
| [currentPageRepository](../src/server/queries/currentPageRepository.ts)                                                                                                                                                | Replace release scope with consistent current reads.                                                                                                                                           |
| [price-store](../src/server/prices/price-store.ts), [cron](../src/server/prices/cron.ts), [refresh CLI](../db-scripts/refresh-prices.mjs)                                                                              | PostgreSQL current-price/sync/state operations; reuse workflow/normalization and add catalog reference-price/offer refresh.                                                                    |
| [generate](../db-scripts/generate.mjs), [validate](../db-scripts/validate.mjs), [upload](../db-scripts/upload.mjs), [update](../db-scripts/update.mjs)                                                                 | Consolidate catalog fetch/normalize/validate/upsert into db:update. Remove the separate release-file lifecycle and in-memory SQLite validation.                                                |
| [current-storage](../db-scripts/lib/current-storage.mjs), [release-diff](../db-scripts/lib/release-diff.mjs), [release-prices](../db-scripts/lib/release-prices.mjs), [snapshot](../db-scripts/lib/snapshot.mjs)       | Retire release/storage machinery. Reuse pure comparisons/validation where helpful without preserving their record model. No copying old release prices.                                        |
| [catalog-history](../db-scripts/lib/catalog-history.mjs), [init-catalog](../db-scripts/init-catalog.mjs), [check-new-items](../db-scripts/check-new-items.mjs)                                                         | Keep discovery semantics in a small importer/query module. New-item checking becomes db:update --dry-run output.                                                                               |
| [compact](../db-scripts/compact.mjs), [init-price-storage](../db-scripts/init-price-storage.mjs), [turso helper](../db-scripts/lib/turso.mjs)                                                                          | Retire. PostgreSQL schema migrations replace ad hoc initialization and SQLite compaction.                                                                                                      |
| [status](../db-scripts/status.mjs), [storage-stats](../db-scripts/storage-stats.mjs)                                                                                                                                   | Keep one small db:status command for catalog/price readiness and timestamps. Storage-size diagnostics can be an option using PostgreSQL relation sizes.                                        |
| [config](../db-scripts/lib/config.mjs), [.sample.env](../.sample.env), package/lockfile, root README, operational docs                                                                                                 | PostgreSQL credentials and shared connection factory; remove Turso packages/configuration at cutover. Preserve environment-file precedence.                                                    |
| [API routes](../src/app/api/), [error helper](../src/app/api/_lib/route-errors.ts), [status dialog](../src/components/core/DataStatusDialog.tsx), `/dev`                                                               | Preserve routes/DTOs, update storage errors and labels, replace release management/status with current data status.                                                                            |
| [DB tests](../src/server/db/), [script tests](../db-scripts/), [price tests](../src/server/prices/), [architecture tests](../src/architecture/data-import-boundaries.test.ts)                                          | Real disposable PostgreSQL integration fixtures; preserve pure query/model tests and revise storage assertions. No SQLite test dependency in the final architecture.                           |

Routine commands become db:migrate (schema changes), db:update (catalog),
db:prices:refresh (prices), and db:status. The seen-at exporter/importer is a
one-time migration tool. Keep the existing Vercel cron schedules/authentication
unless a separate operational change is requested. No `.github` workflows exist
in this checkout; verify platform/manual jobs outside the repository at cutover.
Map/quest-content utilities without SQL remain independent.

## Implementation, validation, and deployment

1. Define the Drizzle domain schema, migrations, connection pool, scalar/JSONB
   mapping, and named DTO queries. Use a shared non-Next-specific database module
   for scripts and runtime, with a server-only runtime wrapper. Do not emulate
   libSQL's Client API or retain its SQL dialect.
2. Implement the small discovery exporter/importer and validate its exact values,
   per-mode coverage, conflict handling, baseline nulls, and removed-item records.
3. Implement consolidated catalog ingestion and separate pricing ingestion.
   Reuse adapters and domain calculations. Test complete input validation, atomic
   writes, competing writers, FK/reference handling, and no-op write behavior.
4. Rebuild an isolated PostgreSQL target from upstream, with and without discovery import.
   Wire repository/query implementations and route compatibility. Test the same
   normalized fixtures against old DTO expectations, including every mode and
   deliberate differences in station/quest requirements.
5. Run contract, architecture, pricing, discovery, ingestion, lint/build, and
   PostgreSQL integration tests. Verify actual UI loading/errors, mode switches,
   item details/search/profits, and existing player progress against stable IDs.
   Check offer freshness independently of catalog content and flea freshness.
6. Pause legacy catalog/price writers and, when preserving historical discovery,
   capture the final discovery export and reconcile it into the prepared target.
   Apply target migrations before import or bootstrap;
   finish catalog/price bootstrap before enabling traffic. Deploy all readers,
   CLI, and cron configuration together. Verify readiness before resuming writers.
7. After the agreed rollback window, remove `@libsql/client`, old schemas/scripts,
   Turso configuration, and SQLite fixtures. The application and routine operations
   must run with only PostgreSQL. No ongoing synchronization with SQLite.

Use DATABASE_URL for runtime and a direct migration connection when the hosting
provider requires it. Validate pool/timeouts/TLS settings; keep CRON_SECRET and
upstream timeout settings. Do not run schema migrations implicitly during page
requests or builds. Use a distinct disposable database for integration tests.

Retain the old deployment/source temporarily for rollback, not as a permanent
second database. Before PostgreSQL receives new discovery writes, rollback can
restore the previous deployment directly. Afterwards, export/reconcile newly
recorded first-seen facts before reverting so they are not lost; catalog/prices
can be fetched again. Never run both writer sets. PostgreSQL backups cover its
current data; content_version is not a historical restore point. No source deletion
or production cutover is part of the planning change.

## Scope of the preparation already made

The earlier preparatory change extracted
[canonical record encoding](../db-scripts/lib/record-encoding.mjs) from the current
SQLite publisher and added tests. It leaves today's system working while the new
one is built; it does not require PostgreSQL to use hashed payload storage. Retire
that release-record encoder with the old publisher if no remaining consumer needs
it. Current behavior documentation still describes Turso until implementation.

This document remains the architecture reference for the conversion. Validation
uses a disposable PostgreSQL target. Legacy source with pre-existing changes is
preserved outside runtime and routine commands. Production provisioning, final
source export, traffic switch and source retirement remain separate steps.
