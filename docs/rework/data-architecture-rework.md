# Data architecture rework notes

- Baseline: persisted `src/lib/stores/useUserStore.ts` and `src/lib/stores/useKappaStore.ts` are frozen and must remain unchanged. The non-persisted `useUIStore.ts` is explicitly exempt because its values reset on reload and are not user data.
- Baseline: `(data)/layout.tsx` owns global station/catalog loading through `_dataContext.tsx`.
- Baseline: normal page reads still enter through `src/server/services/tarkovData.ts`; map, development, and revalidation routes are explicit exceptions.
- Baseline validation: lint passes with 39 existing warnings. The source checkout build is blocked by its active `.next/trace`; the isolated worktree needs local dependencies before build validation.
- Types: canonical owners now live in `src/types/common.ts`, `items.ts`, `prices.ts`, `traders.ts`, `hideout.ts`, `recipes.ts`, `quests.ts`, `maps.ts`, and `contracts.ts`.
- Types: `src/types/types.ts` and the unused `src/lib/utils/quest-pooling.ts` were removed; shared map contracts moved out of `src/features/maps/map-types.ts`.
- Types: item, price, and recipe duplicates were consolidated; item-detail-only presentation types now live in `src/features/items/item-detail/item-detail-types.ts`.
- Types validation: TypeScript and lint pass; lint retains the same 39 baseline warnings.
- Repository: `src/server/repositories/tarkov-data/` now owns the explicit-mode `TarkovDataRepository` contract and current cached-service implementation.
- Repository: ID batches return keyed records, omit missing IDs, and keep full-cache projection private to the current implementation.
- Repository: current price reads project from the catalog; price history keeps its 15-minute, no-Redis policy.
- Kappa: `src/server/queries/getKappaChecklistPageData.ts` uses the mode-keyed Collector ID and requests only that quest, its give-item IDs, and current prices.
- Kappa: the route no longer loads or prepares the full quest list. Fake-repository coverage verifies the narrow calls for regular, PVE, and KORD modes.
- Kappa: quest/item/price failures are explicit; the checklist still renders matched items when current prices are unavailable.
- Queries: `src/server/queries/` now owns Hideout, Items, Quests, Kappa, and Profit page composition with explicit partial-domain errors and freshness.
- Quests: reviewed faction/series preparation is shared in `src/lib/utils/quest-preparation.ts`; prerequisite ordering moved to `src/lib/utils/quest-ordering.ts`.
- Queries: `src/server/services/quests.ts` and `src/server/services/profitPages.ts` were removed after their consumers moved.
- Query validation: five fake-repository query cases pass, including route-scoped IDs and partial recipe failures.
- Revalidation: `src/app/api/revalidate/route.ts` now maps the public `quests` tag to both internal quest and trader tags; `item-data` explicitly maps to no Next.js tags because the catalog is Redis-only.
- Route delivery: `src/app/(data)/hideout/page.tsx` and `items/page.tsx` now call only their named queries and pass route contracts into client features.
- Route delivery: Hideout and Items components now receive stations and item summaries explicitly; `DataLastUpdated.tsx` receives timestamps as props.
- Route delivery: the unused item-map effect was removed from `src/features/items/ItemsClientPage.tsx`.
- Route delivery: `src/app/(data)/quests/page.tsx` and profit pages now call only their named queries; quest item presentation flows through `QuestsProvider` and profit calculations use their route contract.
- Route validation: TypeScript passes; 27 Hideout/Items cases, 116 quest cases, and 21 query/profit cases pass.
- Item detail backend: repository-backed item relations, usage, acquisition-tree, and price-history query owners now back the item API routes.
- Item detail backend: `/api/items/[itemId]/relations` returns only that item's hideout/quest relations; recipe responses include priced summaries for referenced items.
- Item detail backend: barter and craft failures remain independent, and price history keeps its existing HTTP/15-minute policy.
- Item detail client: `ItemDetailModal.tsx` now loads mode-keyed item relations, usage, acquisition data, and history when opened; callers pass only the selected item and open state.
- Shared delivery: `src/app/(data)/layout.tsx` no longer loads entity arrays; `DataStatusDialog.tsx` fetches compact status metadata only when opened.
- Conversion: `LegacyProfileConversionDialog.tsx` and `CompletedItemsConversionModal.tsx` use lazy repository-backed API reads; `_dataContext.tsx` and `src/server/services/tarkovData.ts` were removed.
- Item search: `ItemSearchModal.tsx` and `QuickAddModal.tsx` use the bounded `/api/items/search` endpoint through `useItemSearchController.ts`.
- Boundaries: `eslint.config.mjs` and `src/architecture/data-import-boundaries.test.ts` enforce the repository, client/server, canonical-type, and deletion rules.

## Post-review completion

- Missing hideout catalog references now remain visible, warn the user, and disable
  affected upgrades. Level-down refunds continue by stable item ID.
- Items shows quest-domain failures while retaining usable hideout demand.
- Profit pages require both recipe graphs before evaluating recursive costs.
- Quest workspace contracts no longer serialize four unused derived indexes;
  Items no longer fetch reward-only summaries; profit station sources are compact.
- Checklist search restores 50 results with starts-with priority and alphabetical
  ordering, while Quick Add remains capped at 10.
- Acquisition-tree recipe domains settle independently and partial responses stay
  uncached. Kappa partial item misses remain in the denominator and are visible.
- Normal layouts no longer inspect Redis. Boundary tests cover page-to-query,
  query-to-repository, and layout-to-cache rules.
- Raw trader and price-history provider shapes are owned by adapter services.
- `ItemDetailModal.tsx` is presentation-only; request, navigation, and model
  responsibilities live in dedicated controllers.
- Repository batch projection has direct duplicate, missing, and unrequested-ID
  tests. Kappa's cross-boundary contract is owned by `src/types/contracts.ts`.

## Payload audit

Payload checks are defined structurally because production entity counts change
with Tarkov.dev data. The enforced before/after reductions are:

| Route | Removed from the serialized route payload |
|---|---|
| `/quests` | `questItemIndex`, `questRewardIndex`, `questAnyOfGroups`, `questAvailabilityQuests` |
| `/items` | `questRewardIndex` and reward-only item summaries/prices |
| profit routes | station levels, requirements, skills, and trader requirements; only compact source identity remains |
| shared layout | all station/catalog entity arrays and direct Redis status inspection |

`page-data-queries.test.ts` verifies route-scoped requested IDs and compact source
records. These shape assertions are stable across upstream catalog growth, unlike a
single byte count; capture compressed RSC transfer sizes in deployment telemetry
when comparing releases.

## Turso ingestion staging

- Turso was selected for the next repository implementation.
- Offline generation and upload tooling lives in the root `db-scripts/` directory;
  runtime database access will be added separately under `src/server/db/`.
- Generated releases store canonical entities, compact manifests/search records,
  and endpoint-ready per-item relations, usage, and acquisition payloads.
- Uploads are immutable and mode-scoped. A release becomes eligible for reads only
  after its counts validate and it is marked ready; runtime selection is currently
  the explicit mode map in `src/server/db/release-config.ts`.
- Item price history remains an on-demand provider request and is not stored in Turso.
- Runtime Turso readers now live in `src/server/db/` and pin each game mode to an
  immutable release through `release-config.ts`.
- Item relations, usage, acquisition-tree, and bounded search API routes now read
  their endpoint-ready payloads from Turso without loading the source catalogs or
  recipe graphs. Existing response contracts and HTTP cache policies are preserved.
- Data-status and profile-conversion API routes use release metadata, compact
  manifests, or narrowly projected station/item entity reads from Turso.
- Price history and server-component page queries remain on their existing data
  paths for the next migration stage.
