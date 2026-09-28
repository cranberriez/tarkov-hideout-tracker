# Data layer

## Source, normalization, and storage

The runtime and routine writers use PostgreSQL domain tables through
[Drizzle schema](../src/server/postgres/schema.ts) and a shared
[connection pool](../src/server/postgres/connection.ts). The agreed
[design](postgresql-migration.md) and separate [cutover runbook](postgresql-cutover.md)
cover migration and deployment. There are no active release pointers, generic
payload tables, historical catalogs, or stored search manifests in PostgreSQL.

[game-mode.ts](../src/lib/game-mode.ts) maps PVP to regular, PVE to pve, and
KORD to pvp-season. Shared identity tables hold deterministic presentation;
mode membership rows own gameplay fields and complete presentation overrides.
Missing mode membership never inherits another mode's requirements. Entity,
recipe, station-level and requirement IDs remain the upstream stable IDs.

[db:update](../db-scripts/update.mjs) fetches all three modes through existing
[items](../src/server/services/itemsJson.ts), [hideout](../src/server/services/hideoutJson.ts),
[quests](../src/server/services/questsJson.ts), [traders](../src/server/services/tradersJson.ts),
and [recipe](../src/server/services/itemAcquisitionJson.ts) adapters. Required
empty/malformed input aborts before writes. Reviewed
[hideout overrides](../src/lib/utils/hideout-requirement-overrides.ts),
[requirements](../src/lib/data/hideout-data.json), and
[FiR fallbacks](../src/lib/cfg/foundInRaid.ts) remain authoritative; seasonal
requirements remain separate. Adapter recipe exclusions and translation fallback
rules are unchanged.

The catalog writer validates and builds item-detail projections before its short
writer transaction. It acquires the catalog advisory lock, checks the content
versions used during preparation, and upserts changed domain rows atomically.
Absent memberships are removed only after complete valid input; discovery never
cascades away. Successful checks update catalog freshness, while content versions
advance only for catalog/DTO changes. Catalog ingestion strips monetary offers
and market data and never overwrites existing price rows.

Current item_details rows store relations, usage and acquisition JSONB without
prices or embedded monetary offers. Runtime detail reads stay bounded and
hydrate current discovery and trader offers from their owning relations. Flea
hydration remains optional. Source freshness is assembled from catalog_status.
See [operations](operations.md) and the [CLI guide](../db-scripts/README.md).

## Repository and page read contracts

[TarkovDataRepository](../src/server/repositories/tarkov-data/types.ts) is the
provider-independent explicit-mode interface.
[query-utils.ts](../src/server/queries/query-utils.ts) lazily selects the
[PostgreSQL implementation](../src/server/repositories/tarkov-data/postgres-repository.ts).
Pages call named queries; they do not import the concrete repository. Queries
must not import provider adapter services. Batch methods deduplicate IDs, return
keyed records, and omit missing IDs; query contracts report those omissions in
`unresolvedItemIds` rather than treating them as satisfied requirements.

| Consumer     | Query owner                                                                     | Required data                                                                 |
| ------------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Hideout      | [getHideoutPageData](../src/server/queries/getHideoutPageData.ts)               | Stations and only their referenced item summaries/prices                      |
| Items        | [getItemChecklistPageData](../src/server/queries/getItemChecklistPageData.ts)   | Independently settled stations/quests, demand metadata, demand items/prices   |
| Quests       | [getQuestWorkspacePageData](../src/server/queries/getQuestWorkspacePageData.ts) | Prepared full quests and their referenced standard item summaries (no prices) |
| Kappa        | [getKappaChecklistPageData](../src/server/queries/getKappaChecklistPageData.ts) | One mode-specific Collector quest and its hand-in items/prices                |
| Profit pages | [getProfitPageData](../src/server/queries/getProfitPageData.ts)                 | Both recipe graphs, referenced items/prices, full trader catalog, stations    |

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

Hideout, Items, Quests, Kappa, and Profit server pages prefetch their named
payload through a request-local QueryClient and hydrate the same mode-keyed query
for the browser. The bounded `/api/page-data/*` routes capture the current database
revision internally and support whole-payload refetches. Both profit lists and
Craft Planner share one `recipes-crafts-barters` cache entry. Complete unpriced
API responses are publicly cached for 300 seconds in browsers and 3600 seconds
on the CDN, with mode isolated in the URL, except unpriced profit payloads: those
use `no-store` because their trader offers change independently of catalog content.
Compatibility profit requests that
include prices use 300 seconds for both. Partial responses and HTTP errors use
`no-store`. These API headers do not cache initial server-page HTML/RSC payloads,
which still select mode from the cookie and prefetch queries directly. Explicit unresolved
IDs stay in successful payloads and visible warnings; domain errors produce usable
partial payloads that remain retryable rather than reusable complete cache entries.

Hideout, Items, Quests, Kappa, Profit, and Craft Planner server pages request
unpriced metadata. Quests does not mount a price consumer: opening the workspace,
changing filters, or navigating quests makes no current-price requests. Opening an
item's details loads the prices needed for that item and its recipes; link previews
only read prices already in the cache.

[useItemPrices](../src/features/items/useItemPrices.ts) owns shared current-price
queries, keyed by mode and individual item ID. [The transport](../src/features/items/deferred-prices.ts)
coalesces concurrently requested missing/stale items into GETs to
[the price endpoint](../src/app/api/items/prices/route.ts). Known subsets accept
1–200 standard IDs per URL; larger arbitrary subsets split at that limit. Items
uses the named **checklist** scope for one GET covering its complete demand set,
including items needed for sorting, filtering, and totals. Profit lists and Craft
Planner use the named **recipes** scope for one GET covering both graphs. Synthetic recipe references, such as generic dog tags, remain in their graphs
but are excluded from market-price requests. Scope ID
selection shares the page's derivation, pins the current revision, and fails as a
whole when a source domain fails; it does not read item presentation records.
Hideout and Kappa request their own referenced IDs and reuse per-item cache entries
populated by other consumers. There is no request per rendered item or per scroll.

Prices stay fresh in TanStack for one hour, with 24-hour inactive retention,
no interval polling, no focus/reconnect refetch, and no automatic retry. A newly
mounted consumer fetches only missing/stale entries. Successful unavailable prices
are cached as explicit null, never zero; failures do not erase previously usable
prices. The existing scope lifecycle cancels/removes the old mode without touching
player storage. Canceling one item does not abort a shared batch still needed by
another; canceling the entire batch aborts its fetch.

Price refresh controls are not currently exposed in the UI. Reloading the page
recreates the in-memory query cache and retries failed price reads; successful
responses can still come from the browser/CDN cache. The existing 300-second
server mutable-price cache may also supply a recent snapshot.
Complete GET responses use browser 300s and CDN 3600s freshness; failed responses
are no-store. The POST endpoint remains private/no-store for already-open older
clients. The schema and limits live in [price-contract](../src/lib/query/price-contract.ts).

[DeferredPriceBoundary](../src/features/items/DeferredPriceBoundary.tsx) supplies
Hideout/Items/Kappa with per-item pending/error/ready presentation. Profit consumers wait for initial prices before ranking recipes
and preserve usable cached prices after a failed refresh. Item detail queries ask
for **prices=none** and hydrate their combined item index from the same shared cache
after the initial metadata domains settle. Their query keys distinguish unpriced
metadata from older priced payloads. Compatibility API callers can still request
the previous price-hydrated payloads.

Item routes validate standard item IDs and require a supported data `mode`.
Except for the compact search manifest protocol below, the browser never sends
or validates database revision IDs. Each API resolves the
current revision internally. Multi-step stored reads pin that revision for their
duration; if a catalog update changes it mid-read, the request fails transiently rather
than mixing datasets or reporting a missing entity.
Runtime item-view routes read precomputed [item-views.ts](../src/server/db/item-views.ts)
records; the similarly named [relations](../src/server/queries/getItemRelationsData.ts),
[usage](../src/server/queries/getItemUsageData.ts), and
[acquisition](../src/server/queries/getItemAcquisitionTreeData.ts) composers build
those views during generation. Do not replace a one-row runtime view read with
full-domain composition on every item-detail open.

Shared route helpers in [src/app/api/_lib](../src/app/api/_lib/) own mode and item-ID
parameter parsing, database error responses, and the named
[Cache-Control presets](../src/app/api/_lib/cache-control.ts) used below.

| API / owner                                                                                                                                                      | Result and cache policy                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [prices](../src/app/api/items/prices/route.ts)                                                                                                                   | GET with explicit mode and 1–200 IDs or named checklist/recipes scope; browser 300s, CDN 3600s; legacy POST remains private/no-store                               |
| [relations](../src/app/api/items/[itemId]/relations/route.ts)                                                                                                    | Hideout requirements, quest demand/rewards and availability closure; private, no-store; current offers are hydrated on every request                               |
| [usage](../src/app/api/items/[itemId]/usage/route.ts)                                                                                                            | Direct trader purchases and recipes producing one item, referenced items and source labels; private, no-store; current offers are hydrated on every request        |
| [acquisition-tree](../src/app/api/items/[itemId]/acquisition-tree/route.ts)                                                                                      | Cycle-safe graph bounded by depth/item count with `truncated`; private, no-store; current offers are hydrated on every request                                     |
| [price-history](../src/app/api/items/[itemId]/price-history/route.ts)                                                                                            | On-demand provider history; browser 300s, CDN and upstream Next.js fetch cache 7200s                                                                               |
| [search](../src/app/api/items/search/route.ts)                                                                                                                   | Required mode and `q` up to 80 characters, normalized for matching; 10 results by default or 50 with `limit=50`; `private, no-store`                               |
| [status](../src/app/api/data/status/route.ts)                                                                                                                    | Mode/release identity, hideout/item/quest/craft/barter release freshness, and independent mutable-price change/check timestamps; `private, no-store`               |
| [legacy-profile conversion](../src/app/api/conversion/legacy-profile/route.ts), [completed-items conversion](../src/app/api/conversion/completed-items/route.ts) | Bounded conversion support through [shared-api-data](../src/server/db/shared-api-data.ts); `private, no-store`                                                     |
| [page data](../src/app/api/page-data/)                                                                                                                           | Mode-specific Hideout, Items, Quests, Kappa, and shared Profit payloads; unpriced profit: `no-store`; other complete unpriced: browser 300s, CDN 3600s; partial/error: `no-store` |
| [map APIs](../src/app/api/maps/)                                                                                                                                 | Committed map metadata, navigation overlays, and allow-listed SVG service; see [maps](maps.md)                                                                     |
| [price cron APIs](../src/app/api/cron/prices/)                                                                                                                   | Protected mutable-price refresh; see [operations](operations.md)                                                                                                   |

All item-view responses use `no-store` so catalog versions cannot freeze current offers; the item-detail queries expose their
payload through a typed partial-data error rather than entering it as reusable
success data. Relations, usage, and acquisition results are fresh for 60 seconds,
retained inactive for five minutes, share a cap of 60 inactive item-detail queries,
and require explicit retries. Mutable price history uses the same retention group
with a two-hour freshness and retention period.
Search validation is in [searchItems.ts](../src/server/queries/searchItems.ts),
while ranking and bounded mode-specific SQL reads belong to
[item-search.ts](../src/server/db/item-search.ts). Current catalog clients use the compact manifest described below.

The root [QueryProvider](../src/lib/query/QueryProvider.tsx) keeps one browser
QueryClient across navigation. Its default inactive retention is 30 minutes and
its shared retry predicate allows at most two retries for transient failures. It
does not retry aborts, 4xx responses, invalid JSON or validated response shapes,
or partial payloads. Feature queries opt into strict inactive
entry caps; active and fetching entries are not evicted. Game-data keys start with
mode, and the scope lifecycle cancels and removes the old mode without touching
player storage or unrelated queries.

The mode status query is informational and runs on demand when the footer dialog
opens; it does not gate game-data queries or poll in the background. Map metadata
and navigation overlays use separate map-keyed queries with one-hour freshness,
24-hour inactive retention, and no automatic retry. The allow-listed SVG remains
an ordinary browser asset request. Conversion previews also use Query, keyed by
their explicitly requested destination mode rather than the active profile gate.

The development dashboard reads [postgres-dashboard.ts](../src/server/db/postgres-dashboard.ts)
directly, reading only current metadata for the selected mode. These bounded database/service paths are explicit exceptions to page
repository composition, not a reason to import provider adapters into features.

## Prices, history, and freshness

[price-store.ts](../src/server/prices/price-store.ts) owns PostgreSQL item_prices,
item_price_sync, and price_refresh_state. Pricing refreshes independently of catalog
content and never change catalog content_version. The workflow fetches catalog
reference prices and trader offers once per mode, then conditional flea histories
with bounded concurrency. These inputs have independent acceptance: an unchanged
or failed flea request cannot suppress updated trader offers; a bad catalog input
cannot erase previous references. Omitted/null scalar observations and omitted
offer arrays retain prior values; explicit zero prices and empty offer arrays
remain meaningful. Malformed nonempty offer arrays fail validation instead of
becoming empty offers. Older catalog observations cannot regress stored inputs,
and a timestamp alone cannot mark retained reference values freshly observed.
No pooled connection is held during HTTP work.

Per-mode expiring leases verify ownership before writes and renew during long runs.
Chunks recheck current item membership, skip disappearing items, and batch writes.
Only accepted changed values/samples or required change timestamps rewrite price
content; 304 responses and failures update the narrow sync row. Only the latest
run summary is retained. The ten newest normalized samples live in recent_points
JSONB; unchanged samples preserve observation metadata. Full history is not stored.
Accepted reference/offer changes also advance `last_changed_at`; identical,
missing-only and older catalog inputs leave it unchanged. This keeps the status
API accurate even when flea checks return 304.

[price-data.ts](../src/server/db/price-data.ts) assembles CurrentPrice from catalog
reference fields and recomputes the existing effective-price/stability model from
recent samples, including age checks. Unknown remains null; explicit zero-depth
history remains unavailable and never revives a reference estimate. Catalog
averages keep their original meanings and timestamps. Trader purchase unlock
metadata remains available with prices=none, hydrated at read time so catalog
caches cannot freeze offers. Price input errors remain explicit.

The [effective-price model](../src/lib/utils/price-history.ts) and
[profit rules](profits.md) are unchanged: conservative minimum estimates, depth,
cluster and age rules distinguish stable, unstable, unavailable and reference
inputs. Unstable estimates remain usable with their existing UI warnings. Latest
aggregate price is not labeled a 24-hour average. Price endpoint, browser and
TanStack cache lifetimes remain unchanged.

The footer status reads catalog source freshness and independent latest price
change/check timestamps. Content versions are stringified under the compatibility
releaseId field; they are cache identities, not selectable releases. The
[development dashboard](../src/app/dev/page.tsx) shows current counts and status.

The History tab still fetches [upstream history](../src/server/prices/live-price-history.ts)
on demand with its two-hour cache. Repository stored history returns only the
bounded recent window. Player storage, map services, and browser mode keys are
unchanged.

## Catalog discovery

[Discovery tooling](../db-scripts/lib/discovery.mjs) exports only first-seen fields
from a consistent read-only SQLite file or a direct Turso SQL-over-HTTP snapshot,
with a checksum and per-mode counts. The optional `--turso` export reads only the
two discovery tables and cross-checks counts before writing a manifest. It uses
source credentials only for that one-time read; runtime remains PostgreSQL-only.
Import is optional. `db:update` validates and imports a project-root `discovery.json`
when present (or an explicit `--discovery` path) in the catalog transaction. Invalid
input or conflicts abort the transaction; identical reimports do nothing. The
standalone importer can update discovery without running a catalog update. Both
commands summarize conflicts with per-mode counts and five examples, saving all
conflicting prior/incoming facts to `db-scripts/.generated/diagnostics/`.
Catalog updates preflight discovery before upstream preparation and recheck it
under the writer lock. Imported
source baselines keep null dates and removed item records survive.
Metadata additions advance the affected mode's content version when its catalog is
already ready; importing metadata alone never makes an empty catalog ready.

PostgreSQL item_discovery has no membership FK. New mode/item pairs receive their
first successful catalog-write timestamp and tracked patch after initialization.
Without imported history, the first successful update atomically initializes each
mode's current items with null first-seen date, patch and provenance. This unknown
baseline does not claim a release date or a pre-1.1.5 origin. Future new IDs receive
timestamps; returning IDs keep their original facts. A verified late import may
enrich only a wholly unknown record (all three metadata fields null). A known
historical baseline with a null date is not unknown. Different known baselines,
dates, patches or provenance, including later local observations, remain conflicts;
no earliest-date heuristic silently replaces them. Unknown incoming records leave
known target facts untouched. Records absent from the import are preserved.
The optional
firstSeenReleaseId API field retains imported provenance; new discoveries need
no release ID. These dates describe observation by this tracker, not a verified
game introduction. [isNewItem](../src/lib/utils/new-items.ts) retains its 28-day
window and baseline/unknown/future-date behavior.

## Extending data

1. Choose the owning domain type and a current consumer; define its read contract.
2. Normalize and validate source data at the adapter boundary, preserving IDs and mode scope.
3. Extend generation/schema/read models and their validation if stored data changes.
4. Add the repository method and named page query, or extend the existing bounded API owner.
5. Surface missing IDs, freshness, and independent errors in the contract and client.
6. Run adapter, query-contract, and [import-boundary tests](../src/architecture/data-import-boundaries.test.ts), then follow [publication operations](operations.md).

Update this document when contracts, source ownership, or cache behavior changes.

## Compact search manifest

[The search reader](../src/server/db/search-manifest.ts) builds the existing
[compact contract](../src/types/search.ts) directly from PostgreSQL item, quest,
and trader projections through mode membership. It reuses the
[manifest builder](../src/lib/search/build-manifest.ts), compression, and bounded
Next data cache. Cache keys include the PostgreSQL namespace, format version,
mode and catalog content_version. No database manifest table is used.

[/api/search](../src/app/api/search/route.ts) keeps identity=1 and the releaseId
request/response field. The field now carries the string content version. A
stale token returns 409. Builds verify their observed content version before
caching; failed or mixed-version reads never enter the success cache. Pricing
updates do not invalidate search. HTTP responses remain private, no-store.

[Background search](../src/lib/search/useSearchManifest.tsx) starts after window
load, browser idle scheduling, and profile hydration. Opening search earlier can
start the same query immediately. TanStack retains the decoded index in session
memory across navigation, with infinite freshness for a given revision. A separate
five-minute identity query checks on an interval while visible and on stale
focus/reconnect. A new revision loads a new manifest; the old revision is removed
after successful replacement. The existing mode lifecycle cancels/removes the
previous mode, including in-flight responses. Failures expose explicit retry;
valid same-revision data can remain usable after an identity-check failure.
No player persistence changes are involved.

The compact payload intentionally excludes prices, discovery metadata, objectives,
requirements, and recipes. Images are URLs only, requested when result rows render.
Existing `/api/items/search` remains available for compatibility; current item
search and Quick Add use the shared manifest without requests per keystroke.

Measured against the current dataset on 2026-09-09: 5,320 items per mode and
482/479/435 quests for regular/PVE/KORD, respectively. Minified JSON is about
1.09 MB raw or 220 KB gzip; actual deployment content encoding may differ.
