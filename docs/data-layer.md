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
records. The effective price uses the five newest valid points weighted by offer
count, or the newest point when no positive offer count exists. Failures retain
previous good values; an invalid response must not replace good price data.

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
