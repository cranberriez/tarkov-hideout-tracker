# Data layer

## Source, normalization, and storage

[game-mode.ts](../src/lib/game-mode.ts) maps PVP to `regular`, PVE to `pve`, and
KORD to `pvp-season`. Pass mode explicitly through queries, repository calls,
API requests, and caches. Stable entity and requirement IDs connect server data
to saved player progress; never regenerate them for display convenience.

[generate.mjs](../db-scripts/generate.mjs) consumes the offline
[Tarkov.dev JSON client](../src/server/services/tarkovJson/client.ts) and domain
adapters: [items](../src/server/services/itemsJson.ts),
[hideout](../src/server/services/hideoutJson.ts),
[quests](../src/server/services/questsJson.ts),
[traders](../src/server/services/tradersJson.ts), and
[recipes](../src/server/services/itemAcquisitionJson.ts).
They translate and normalize raw records into [canonical domain types](../src/types/).
Recipe normalization omits passive Bitcoin Farm production and the Water
Collector's same-item bottled-water refill because neither is a repeatable craft
acquisition route. Publishing this policy requires a newly generated release.
Seasonal English translations can fall back to regular English labels while
seasonal IDs and structure remain authoritative. Malformed or empty required
datasets must fail generation rather than produce a ready release.

Hideout overrides are owned by [hideout-requirement-overrides.ts](../src/lib/utils/hideout-requirement-overrides.ts),
[hideout-data.json](../src/lib/data/hideout-data.json), its
[wiki-data wrapper](../src/lib/data/wiki-data.ts), and
[foundInRaid.ts](../src/lib/cfg/foundInRaid.ts). Reviewed quantities and FiR
fallbacks apply to regular/PVE; KORD keeps upstream seasonal quantities and FiR.
Changes to these inputs require a new generated release to reach runtime readers.

[schema.sql](../db-scripts/schema.sql) stores one current dataset per mode in
`current_records`, with canonical JSON deduplicated by hash in `data_payloads`.
`data_entities`, `data_manifests`, `item_search`, and `item_views` are compatibility
SQL views joining current records/payloads to the current mode revision.
[entity-data.ts](../src/server/db/entity-data.ts) owns targeted ID reads;
[manifests.ts](../src/server/db/manifests.ts) owns compact list reads.

[current-storage.mjs](../db-scripts/lib/current-storage.mjs) compares compact content
hashes and publishes only additions, changes, and removals in one transaction for
all selected modes. Canonical hashes exclude record timestamps. Stored item-view
freshness is null for unavailable domains and zero for available domains;
[item-views.ts](../src/server/db/item-views.ts) hydrates available timestamps from
source freshness metadata selected in the same SQL read, preserving null failures.
Prices hydrate separately from the scoped current-price result. A content no-op
keeps its revision and freshness metadata and writes no rows. Source freshness
describes the published content revision, not the latest unchanged provider check.
Removed rows and unreferenced shared payloads are deleted; historical full datasets
are not retained. [Operations](operations.md) and the [CLI guide](../db-scripts/README.md)
own conversion, validation, and publication commands.

## Repository and page read contracts

[TarkovDataRepository](../src/server/repositories/tarkov-data/types.ts) is the
provider-independent explicit-mode interface.
[query-utils.ts](../src/server/queries/query-utils.ts) lazily selects the
[Turso implementation](../src/server/repositories/tarkov-data/turso-repository.ts).
Pages call named queries; they do not import the concrete repository. Queries
must not import provider adapter services. Batch methods deduplicate IDs, return
keyed records, and omit missing IDs; query contracts report those omissions in
`unresolvedItemIds` rather than treating them as satisfied requirements.

| Consumer     | Query owner                                                                     | Required data                                                               |
| ------------ | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Hideout      | [getHideoutPageData](../src/server/queries/getHideoutPageData.ts)               | Stations and only their referenced item summaries/prices                    |
| Items        | [getItemChecklistPageData](../src/server/queries/getItemChecklistPageData.ts)   | Independently settled stations/quests, demand metadata, demand items/prices |
| Quests       | [getQuestWorkspacePageData](../src/server/queries/getQuestWorkspacePageData.ts) | Prepared full quests and their referenced standard item summaries/prices    |
| Kappa        | [getKappaChecklistPageData](../src/server/queries/getKappaChecklistPageData.ts) | One mode-specific Collector quest and its hand-in items/prices              |
| Profit pages | [getProfitPageData](../src/server/queries/getProfitPageData.ts)                 | Both recipe graphs, referenced items/prices, compact source presentation    |

[contracts.ts](../src/types/contracts.ts) owns these payloads and their freshness
and error fields. Item summaries can carry `marketPrice`; consumers may build
local indexes from the delivered arrays. Profit calculations need both recipe
graphs, so either recipe-domain failure blocks figures. Other independent domains
can remain usable with explicit errors.

Profit pages resolve recipe and direct-offer `taskUnlockId` references through a
single known-ID quest batch for names, serializing only `id`, `name`, and
`wikiLink` in `taskUnlocksById`. This does not discover requirements by scanning
quests. `unresolvedTaskUnlockIds` and the nonblocking `errors.taskUnlocks` keep
missing/failed presentation distinct from recipe and price availability.

## Lazy API reads and exceptions

Hideout, Items, Quests, and Kappa routes request their named query with
`includePrices: false`. Their core payload retains requirements and item
summaries while [DeferredPriceBoundary](../src/features/items/DeferredPriceBoundary.tsx)
loads prices separately. Query defaults still include prices for other callers.
The boundary captures mode and release, suppresses stale results after a mode
change, and presents pending/error states separately from unavailable prices.
Network failures offer a retry without refreshing or discarding checklist data.
A release mismatch returns HTTP 409 and offers a page refresh to obtain the
new release scope, instead of repeatedly retrying the old release.
[deferred-prices.ts](../src/features/items/deferred-prices.ts) sends up to three
128-ID requests concurrently and reuses complete results for 60 seconds in a
bounded, non-persisted session cache. Price-dependent filters update when prices
arrive. Profit pages still await pricing before calculating and ranking recipes.

Item routes validate standard item IDs and require a supported data `mode`.
Runtime item-view routes read precomputed [item-views.ts](../src/server/db/item-views.ts)
records; the similarly named [relations](../src/server/queries/getItemRelationsData.ts),
[usage](../src/server/queries/getItemUsageData.ts), and
[acquisition](../src/server/queries/getItemAcquisitionTreeData.ts) composers build
those views during generation. Do not replace a one-row runtime view read with
full-domain composition on every modal open.

| API / owner                                                                                                                                                      | Result and cache policy                                                                                                                              |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [prices](../src/app/api/items/prices/route.ts)                                                                                                                   | POST with explicit mode, active release ID, and at most 200 standard item IDs; `private, no-store`; underlying database reads use the caches below   |
| [relations](../src/app/api/items/[itemId]/relations/route.ts)                                                                                                    | Hideout requirements, quest demand/rewards and availability closure; complete responses use browser 300s, CDN 900s, stale-while-revalidate 300s      |
| [usage](../src/app/api/items/[itemId]/usage/route.ts)                                                                                                            | Direct trader purchases and barters offering / crafts producing one item, referenced items and source labels; same complete-response policy          |
| [acquisition-tree](../src/app/api/items/[itemId]/acquisition-tree/route.ts)                                                                                      | Cycle-safe graph bounded by depth/item count with `truncated`; same complete-response policy                                                         |
| [price-history](../src/app/api/items/[itemId]/price-history/route.ts)                                                                                            | On-demand provider history; browser 300s, CDN and upstream Next.js fetch cache 7200s                                                                 |
| [search](../src/app/api/items/search/route.ts)                                                                                                                   | `q` up to 80 characters; 10 results by default or 50 with `limit=50`; `private, no-store`                                                            |
| [status](../src/app/api/data/status/route.ts)                                                                                                                    | Mode/release identity, hideout/item/quest/craft/barter release freshness, and independent mutable-price change/check timestamps; `private, no-store` |
| [legacy-profile conversion](../src/app/api/conversion/legacy-profile/route.ts), [completed-items conversion](../src/app/api/conversion/completed-items/route.ts) | Bounded conversion support through [shared-api-data](../src/server/db/shared-api-data.ts); `private, no-store`                                       |
| [map APIs](../src/app/api/maps/)                                                                                                                                 | Committed map metadata and allow-listed SVG service; see [maps](maps.md)                                                                             |
| [price cron APIs](../src/app/api/cron/prices/)                                                                                                                   | Protected mutable-price refresh; see [operations](operations.md)                                                                                     |

Partial item-view responses use `no-store`; clients must keep them retryable.
Search validation is in [searchItems.ts](../src/server/queries/searchItems.ts),
while ranking and bounded SQL reads belong to [item-search.ts](../src/server/db/item-search.ts).
The development dashboard reads [release-management.ts](../src/server/db/release-management.ts)
directly, reading only current metadata for the selected mode. These bounded database/service paths are explicit exceptions to page
repository composition, not a reason to import provider adapters into features.

## Prices, history, and freshness

The footer status dialog includes separate quest, craft recipe, and barter recipe
update times from the selected release�s source freshness metadata. Missing domain
timestamps remain explicit without hiding other available domains. It reads mode-scoped `MAX(last_changed_at)` and
`MAX(last_checked_at)` from `item_prices` through
[shared-api-data.ts](../src/server/db/shared-api-data.ts). Changed means a new
provider payload was accepted, not necessarily a numeric price movement; checks
include unchanged responses and failed attempts. These are the latest times for
any item in the selected mode, not a guarantee that every item was refreshed.
Missing tables or rows show unavailable timestamps; operational price-status
errors remain separate from core release availability. No entity arrays are
loaded for this status read. The compact dialog shows label/value rows with relative times and local dates
on hover, and keeps its dataset and release labels aligned with the requested mode.

Runtime entity reads use [read-cache.ts](../src/server/db/read-cache.ts) and
indexed joins from `current_records` to `data_payloads`; ID-only reads omit
payloads. Entity and price-eligibility queries avoid outer joins against the
composite compatibility views, which can materialize the entire catalog. They use
Next's data cache, keyed by mode, selected release, entity type, freshness key,
and sorted/deduplicated IDs. Reads use 128-ID batches with three batches in
flight per reader. List reads first cache an ordered ID index, then restore
stored ordering after fetching entity batches; known-ID reads do not scan the
catalog. Immutable entries have no time-based expiry. Serialized values over
512 KiB bypass caching intact, keeping entries below Next's 2 MiB limit without
truncating data. Rejected reads are not cached. Explicitly injected database
clients bypass caching for tests and tooling.

Mutable current-price batches use a 300-second revalidation interval keyed by
mode, release, and IDs; Next may serve a stale value while refreshing it.
Release prices, mutable current rows, and recent observations are requested
concurrently. Missing optional tables retain release fallback, but a concurrent
operational failure still surfaces. This data cache does not cache entire
cookie-dependent page responses or change the existing mode cookie behavior.

Immutable recipe graphs and stored item views describe relationships, not selected
priced routes. Runtime readers hydrate item prices via
[price-data.ts](../src/server/db/price-data.ts). It merges release price records
(including trader valuations and reference averages) with mutable current-price
fields. A usable mutable price wins; release values remain the fallback when no
mutable value exists, including when price tables are absent. Preserve this
existing fallback when changing storage or delivery.

[refresh-prices.ts](../src/server/prices/refresh-prices.ts) fetches eligible flea
items with conditional ETags, bounded concurrency, and per-mode database locks.
[price-store.ts](../src/server/prices/price-store.ts) owns `item_prices`, the ten
newest stored points per mode/item in `item_price_points`, refresh locks, and run
records. [price-history.ts](../src/lib/utils/price-history.ts) derives a rounded
median of the five newest positive minimums, using at most ten timestamp-deduplicated
points. Snapshot depth never weights prices or accumulates confidence. The legacy
`total_offer_count` column now receives only the latest snapshot's depth (zero for
unknown); readers recompute it and do not interpret old sums as liquidity.

The newest contiguous minimum cluster (within 1.25x its running median) is compared
with the preceding five-point median. A move of at least 2x retains that prior
estimate until three depth-at-least-three observations span two hours, or five
thin observations span eight hours. A lone earlier high listing cannot hold a
cheaper market up: downward retention requires at least three prior observations.
Confirmed movement updates the estimate; persistent thin listings still cannot
earn stable status. No absolute or trader-based price cap is applied.

Stability requires at least three valid observations spanning two hours, at least
three recent depths of three or more, and latest depth of at least three. Unknown
depth, a latest zero depth, any of the last three aggregate/minimum ratios at least
2x, a recent five-minimum range at least 2x, an unconfirmed jump, or a latest point
older than 72 hours makes the flea input unreliable. These are conservative
heuristics, not a probability of sale. Zero-depth points are not priced offers.
A valid latest zero-depth snapshot reports unavailable flea pricing; an entirely
zero-depth history stores a null estimate in the existing nullable column and
does not revive release flea values.
Malformed/empty required responses fail refresh and retain previous good rows and
ETags; numeric strings are normalized, but blanks, booleans, negative/fractional
depth and missing required fields are rejected at the adapter boundary.

[current-prices.ts](../src/server/db/current-prices.ts) recomputes the same model
using one additional batch read bounded to ten points per requested ID. This
corrects previously stored weighted prices immediately, even when the next refresh
returns 304. No schema migration or player-state changes are needed. Missing price
tables, missing points, or unusable mutable records preserve release fallback;
operational database failures still surface as errors.

[CurrentPrice](../src/types/prices.ts) adds `referencePrice` (latest upstream
aggregate), `fleaStability` (`stable`, `unstable`, `unavailable`, or release
`reference`), `fleaPriceReasons`, and `fleaSampleCount`. `price` is the inspectable
minimum estimate, `avg24hPrice` remains the separate catalog average,
`lastLowPrice`/`lastOfferCount` describe the latest snapshot, and `updatedAt` is its
observation time, not the last successful HTTP check. Release fields retain their
original semantics. [market-price.ts](../src/lib/utils/market-price.ts) exposes the
estimate separately from availability: unstable estimates remain usable for
acquisition costs, flea sale values and profit calculations. Only unavailable
flea data returns null, without falling through to a catalog value or zero.
Legacy release references remain usable as flea estimates when recent mutable
history is absent; the internal source marker does not add a release-status banner.

Item lists and hideout requirements retain numeric estimates for unstable items.
The modal shows **Flea estimate**, the 24-hour low and high, known offer depth,
and freshness. Unstable flea prices use yellow text and small **value unstable**
text without a popup. Beneath them, a compact comparison shows the estimate,
latest minimum, and latest upstream aggregate (labeled **Reported price**) on a
shared zero-based bar scale, omitting invalid or missing values. Short labels
reflect the supplied stability reasons; the latest comparison is context, not a
reconstruction of the historical observations that triggered those reasons.
The recent observation count appears when known. No extra history request is made.
Stable items omit this diagnostic block. Profit output rows retain their selected
flea-sale warning icon; ingredient flea purchases use small text, excluding manual
buy overrides and non-flea routes. History charts remain filtered
aggregate references and are labeled accordingly; they do not control acquisition
pricing. The shared [profit rules](profits.md) use the same estimate consistently
in modal and full-page calculations. HTTP cache durations and mode keys remain
unchanged; existing cached item views can retain older semantics until expiry.

The item modal's History tab calls [live-price-history.ts](../src/server/prices/live-price-history.ts)
only when requested, with a two-hour Next.js fetch-cache interval. This is separate
from the repository's stored-point history. Normal page reads do not fetch full
provider datasets. Runtime provider reads are limited to current-price refreshes,
on-demand history, and the map SVG path documented in [maps](maps.md).

Runtime revision IDs come from `active_data_releases` through
[release-config.ts](../src/server/db/release-config.ts), joined to ready current
metadata. React memoization shares a selection within a render; there is no
cross-request selection TTL or hardcoded map. Publication is observed on subsequent
renders. Explicit multi-step reads capture the revision and fail if it disappears,
including empty search results, rather than silently mixing current rows with an
older selection. Existing HTTP/browser responses can retain prior data until
normal expiry. There is no Redis cache or manual revalidation endpoint.

The database keeps only current revisions. There is no manual activation,
historical rollback, pin, or development override. Obsolete preview cookies are
ignored. The development-only [dashboard](../src/app/dev/page.tsx) reads current
status, counts, and timestamps per mode; see [operations](operations.md#current-dataset-dashboard).

## Catalog discovery

[Catalog history](../db-scripts/lib/catalog-history.mjs) owns the durable
`item_catalog_history` table, keyed by mode and standard item ID independently of
current datasets. `catalog_tracking` records baseline initialization. The
one-time baseline is ready dataset `20260904T211847Z`, classified as `pre-1.1.5`
with an unknown date. This historical boundary never selects runtime releases.
Initialization refuses missing/empty baselines and preserves established history.

After validated upload, new IDs and release readiness commit atomically. Their
`firstSeenAt` is the successful publication time in UTC milliseconds,
`firstSeenPatch` is the supplied game patch (default `1.1.5.0`), and
`firstSeenReleaseId` identifies the dataset. Baseline items have a null date;
missing history stays unknown. These fields describe observation by this tracker,
not a provider-confirmed introduction date. Retried uploads, disappearance,
reappearance never reset dates. Modes are tracked independently.

[Item discovery reads](../src/server/db/item-discovery.ts) attach the metadata to
canonical item entities, bounded search previews, and items embedded in stored
views through bounded ID reads. Item entity cache keys include a discovery schema
marker; history is stable after first publication. No player-state field or store
migration is involved. [isNewItem](../src/lib/utils/new-items.ts) derives a 28-day
window independently for each item; baseline, unknown, invalid, and future dates
do not count as new. The metadata remains after the window expires.

`db:items:check` compares the full provider catalog against durable history without
writing anything. `db:update` generates and validates local snapshots, reports a
content diff, and publishes only changed content. It preserves existing catalog
price payloads/timestamps and leaves new item fallbacks null; mutable prices and
history are not refreshed. A changed current revision during the run blocks stale
publication. `--dry-run` reports planned writes without changing the database;
`db:storage` reports read-only storage metrics. The [CLI guide](../db-scripts/README.md)
owns command arguments and direct conversion of legacy storage with `db:compact`.

[price-store.ts](../src/server/prices/price-store.ts) upserts only observations whose
values changed and prunes points absent from the retained set. Unchanged points
keep their `observed_at`; exact current-row no-op guards avoid rewriting identical
price state. Check/failure timestamps still describe real refresh attempts.

## Extending data

1. Choose the owning domain type and a current consumer; define its read contract.
2. Normalize and validate source data at the adapter boundary, preserving IDs and mode scope.
3. Extend generation/schema/read models and their validation if stored data changes.
4. Add the repository method and named page query, or extend the existing bounded API owner.
5. Surface missing IDs, freshness, and independent errors in the contract and client.
6. Run adapter, query-contract, and [import-boundary tests](../src/architecture/data-import-boundaries.test.ts), then follow [publication operations](operations.md).

Update this document when contracts, source ownership, or cache behavior changes.

