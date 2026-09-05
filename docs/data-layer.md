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
Seasonal English translations can fall back to regular English labels while
seasonal IDs and structure remain authoritative. Malformed or empty required
datasets must fail generation rather than produce a ready release.

Hideout overrides are owned by [hideout-requirement-overrides.ts](../src/lib/utils/hideout-requirement-overrides.ts),
[hideout-data.json](../src/lib/data/hideout-data.json), its
[wiki-data wrapper](../src/lib/data/wiki-data.ts), and
[foundInRaid.ts](../src/lib/cfg/foundInRaid.ts). Reviewed quantities and FiR
fallbacks apply to regular/PVE; KORD keeps upstream seasonal quantities and FiR.
Changes to these inputs require a new generated release to reach runtime readers.

[schema.sql](../db-scripts/schema.sql) defines immutable release metadata,
`data_entities`, compact `data_manifests`, `item_search`, and endpoint-ready
`item_views`. [entity-data.ts](../src/server/db/entity-data.ts) performs targeted
ID reads; [manifests.ts](../src/server/db/manifests.ts) owns compact list reads.
All are scoped to mode and release. Publication and readiness validation are
described in [operations](operations.md) and the [ingestion CLI guide](../db-scripts/README.md).

## Repository and page read contracts

[TarkovDataRepository](../src/server/repositories/tarkov-data/types.ts) is the
provider-independent explicit-mode interface.
[query-utils.ts](../src/server/queries/query-utils.ts) lazily selects the
[Turso implementation](../src/server/repositories/tarkov-data/turso-repository.ts).
Pages call named queries; they do not import the concrete repository. Queries
must not import provider adapter services. Batch methods deduplicate IDs, return
keyed records, and omit missing IDs; query contracts report those omissions in
`unresolvedItemIds` rather than treating them as satisfied requirements.

| Consumer | Query owner | Required data |
|---|---|---|
| Hideout | [getHideoutPageData](../src/server/queries/getHideoutPageData.ts) | Stations and only their referenced item summaries/prices |
| Items | [getItemChecklistPageData](../src/server/queries/getItemChecklistPageData.ts) | Independently settled stations/quests, demand metadata, demand items/prices |
| Quests | [getQuestWorkspacePageData](../src/server/queries/getQuestWorkspacePageData.ts) | Prepared full quests and their referenced standard item summaries/prices |
| Kappa | [getKappaChecklistPageData](../src/server/queries/getKappaChecklistPageData.ts) | One mode-specific Collector quest and its hand-in items/prices |
| Profit pages | [getProfitPageData](../src/server/queries/getProfitPageData.ts) | Both recipe graphs, referenced items/prices, compact source presentation |

[contracts.ts](../src/types/contracts.ts) owns these payloads and their freshness
and error fields. Item summaries can carry `marketPrice`; consumers may build
local indexes from the delivered arrays. Profit calculations need both recipe
graphs, so either recipe-domain failure blocks figures. Other independent domains
can remain usable with explicit errors.

## Lazy API reads and exceptions

Item routes validate standard item IDs and require a supported data `mode`.
Runtime item-view routes read precomputed [item-views.ts](../src/server/db/item-views.ts)
records; the similarly named [relations](../src/server/queries/getItemRelationsData.ts),
[usage](../src/server/queries/getItemUsageData.ts), and
[acquisition](../src/server/queries/getItemAcquisitionTreeData.ts) composers build
those views during generation. Do not replace a one-row runtime view read with
full-domain composition on every modal open.

| API / owner | Result and cache policy |
|---|---|
| [relations](<../src/app/api/items/[itemId]/relations/route.ts>) | Hideout requirements, quest demand/rewards and availability closure; complete responses use browser 300s, CDN 900s, stale-while-revalidate 300s |
| [usage](<../src/app/api/items/[itemId]/usage/route.ts>) | Barters offering / crafts producing one item, referenced items and source labels; same complete-response policy |
| [acquisition-tree](<../src/app/api/items/[itemId]/acquisition-tree/route.ts>) | Cycle-safe graph bounded by depth/item count with `truncated`; same complete-response policy |
| [price-history](<../src/app/api/items/[itemId]/price-history/route.ts>) | On-demand provider history; browser 300s, CDN and upstream Next.js fetch cache 7200s |
| [search](../src/app/api/items/search/route.ts) | `q` up to 80 characters; 10 results by default or 50 with `limit=50`; `private, no-store` |
| [status](../src/app/api/data/status/route.ts) | Release freshness; `private, no-store` |
| [legacy-profile conversion](../src/app/api/conversion/legacy-profile/route.ts), [completed-items conversion](../src/app/api/conversion/completed-items/route.ts) | Bounded conversion support through [shared-api-data](../src/server/db/shared-api-data.ts); `private, no-store` |
| [map APIs](../src/app/api/maps/) | Committed map metadata and allow-listed SVG service; see [maps](maps.md) |
| [price cron APIs](../src/app/api/cron/prices/) | Protected mutable-price refresh; see [operations](operations.md) |

Partial item-view responses use `no-store`; clients must keep them retryable.
Search validation is in [searchItems.ts](../src/server/queries/searchItems.ts),
while ranking and bounded SQL reads belong to [item-search.ts](../src/server/db/item-search.ts).
The development inspector reads [release-info.ts](../src/server/db/release-info.ts)
directly. These bounded database/service paths are explicit exceptions to page
repository composition, not a reason to import provider adapters into features.

## Prices, history, and freshness

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
The modal shows **Flea estimate**, latest minimum, latest aggregate, catalog
24h average, known offer depth and freshness. Unknown depth is omitted from the
headline. Unstable flea prices use yellow text with a small warning icon whose
hover/focus overlay says **Value unstable**. Profit rows apply this only to the
output item's selected flea sale estimate, without row-wide warnings. History
charts remain filtered aggregate references and are labeled accordingly; they do
not control acquisition pricing. The shared [profit rules](profits.md) use the
same estimate consistently in modal and full-page calculations. HTTP cache
durations and mode keys remain unchanged; existing cached item views can retain
older semantics until expiry.

The item modal's History tab calls [live-price-history.ts](../src/server/prices/live-price-history.ts)
only when requested, with a two-hour Next.js fetch-cache interval. This is separate
from the repository's stored-point history. Normal page reads do not fetch full
provider datasets. Runtime provider reads are limited to current-price refreshes,
on-demand history, and the map SVG path documented in [maps](maps.md).

Runtime release IDs come from [release-config.ts](../src/server/db/release-config.ts).
Database activation alone does not switch this mapping. API URLs do not expose a
release ID, so publishing a release does not by itself promise immediate eviction
of existing HTTP responses; respect the route policies above. There is no Redis
cache or manual revalidation endpoint.

## Extending data

1. Choose the owning domain type and a current consumer; define its read contract.
2. Normalize and validate source data at the adapter boundary, preserving IDs and mode scope.
3. Extend generation/schema/read models and their validation if stored data changes.
4. Add the repository method and named page query, or extend the existing bounded API owner.
5. Surface missing IDs, freshness, and independent errors in the contract and client.
6. Run adapter, query-contract, and [import-boundary tests](../src/architecture/data-import-boundaries.test.ts), then follow [publication operations](operations.md).

Update this document when contracts, source ownership, or cache behavior changes.
