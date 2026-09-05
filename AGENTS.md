# AGENTS.md

Read [docs/README.md](docs/README.md) and [architecture](docs/architecture.md),
then the owning document below before recommending or changing behavior. Source
is authoritative; fix doc drift in the same change.

The `plans/` directory contains unstable, disposable Codex plans, not project
references. Do not link to its contents from documentation or depend on them in
validation. Ignore `plans/future/` and `plans/notes/` in routine work: they are
personal reference material, often discarded after implementation. Keep the
entire directory ignored by Git.

## Invariants

- Preserve player data. Before touching persistent keys, fields, versions, actions,
  migrations, profile scope, or reset behavior, read [user state](docs/user-state.md)
  and the owning store/hook. Documentation and server-data refactors must leave
  this boundary unchanged; never clear saved data as a workaround.
- Preserve stable Tarkov entity and requirement IDs. Keep PVP, PVE, and KORD data
  and caches isolated using the existing mode mapping.
- Validate/normalize raw provider records at the adapter boundary. Invalid or empty
  required input must not publish a ready release or replace good current prices.
- Shared layouts do not preload entity arrays. Pages call named queries and prefer
  known-ID/batch reads; queries do not import provider services. Client modules
  must not import server code. See [data layer](docs/data-layer.md) for bounded
  item-view/search APIs, map services, price refresh/history, and dev exceptions.
- Report missing IDs and partial errors explicitly. Missing data cannot satisfy a
  requirement; profit figures require both recipe graphs.

## Task routing

| Task | Read | Start in source |
|---|---|---|
| Add a page or navigation | [Architecture](docs/architecture.md) | [App routes](<src/app/(data)/>), [Navbar](src/components/core/Navbar.tsx), [queries](src/server/queries/), [contracts](src/types/contracts.ts) |
| Add/change provider data or API payload | [Data layer](docs/data-layer.md) | [Adapters](src/server/services/), [repository interface](src/server/repositories/tarkov-data/types.ts), [queries](src/server/queries/), [DB reads](src/server/db/), [generator](db-scripts/generate.mjs) |
| Change a domain type | [Data layer](docs/data-layer.md) | Owning [src/types module](src/types/); [contracts](src/types/contracts.ts) for read payloads |
| Change progress, preferences, setup, or reset | [User state](docs/user-state.md) | [useUserStore](src/lib/stores/useUserStore.ts), [useKappaStore](src/lib/stores/useKappaStore.ts), [setup](src/features/setup/), [StorageResetCard](src/features/settings/StorageResetCard.tsx) |
| Change hideout requirements or station order | [Architecture](docs/architecture.md), [data layer](docs/data-layer.md) | [HideoutList](src/features/hideout/components/HideoutList.tsx), [override policy](src/lib/utils/hideout-requirement-overrides.ts), [reviewed requirements](src/lib/data/hideout-data.json), [FiR fallback](src/lib/cfg/foundInRaid.ts), [stationOrder](src/lib/cfg/stationOrder.ts) |
| Change item totals/filtering | [Architecture](docs/architecture.md), [quests](docs/quests.md) | [ItemsList](src/features/items/components/ItemsList.tsx), [item-pooling](src/lib/utils/item-pooling.ts), [item-needs](src/lib/utils/item-needs.ts), [quest-item-index](src/lib/utils/quest-item-index.ts) |
| Change catalog search or Quick Add | [Architecture](docs/architecture.md), [data layer](docs/data-layer.md) | [Search API](src/app/api/items/search/route.ts), [SQL search](src/server/db/item-search.ts), [search controller](src/features/items/useItemSearchController.ts), [QuickAddModal](src/features/quick-add/QuickAddModal.tsx) |
| Open or change item details | [Architecture](docs/architecture.md) | [ItemDetailModal](src/features/items/item-detail/ItemDetailModal.tsx), [modal controller](src/features/items/item-detail/useItemDetailModalController.ts), [request controller](src/features/items/item-detail/useItemDetailRequestController.ts) |
| Change quest filters, details, or planning | [Quests](docs/quests.md) | [QuestWorkspaceContext](src/features/quests/workspace/QuestWorkspaceContext.tsx), [workspace selector](src/features/quests/workspace/quest-workspace-selector.ts), [workspace components/models](src/features/quests/workspace/) |
| Change quest availability, sync, or import | [Quests](docs/quests.md) | [quest-availability](src/lib/utils/quest-availability.ts), [quest-sync](src/features/quests/quest-sync.ts), [import controller](src/features/quests/components/useQuestLogImportController.ts) |
| Change Collector/Kappa | [Quests](docs/quests.md), [user state](docs/user-state.md) | [One-quest query](src/server/queries/getKappaChecklistPageData.ts), [Kappa store](src/lib/stores/useKappaStore.ts) |
| Change maps or objective markers | [Maps](docs/maps.md) | [MapViewer](src/features/maps/MapViewer.tsx), [projection](src/features/maps/map-projection.ts), [marker models](src/features/quests/workspace/raid-planner-markers.ts) |
| Change recipe costs or profits | [Profits](docs/profits.md) | [Optimizer](src/lib/price-calculation/optimizer.ts), [recipe calculator](src/features/profit-pages/utils/recipes.ts), [ProfitPageClient](src/features/profit-pages/ProfitPageClient.tsx) |
| Refresh releases/prices or diagnose data | [Operations](docs/operations.md), [data layer](docs/data-layer.md) | [Ingestion CLI](db-scripts/README.md), [release selection](src/server/db/release-config.ts), [price refresh](src/server/prices/refresh-prices.ts) |

## Implementation and validation

Keep substantial deterministic derivation in pure tested models, workflow/network
effects in controllers, and views focused on rendering and direct interaction.
Reuse existing utilities and store actions. Keep local modal state local unless
it needs a shared owner; do not introduce a generic abstraction without a consumer.
Update the owning doc when a contract, persistence rule, or data flow changes.

```bash
npm run docs:check
npm run test:architecture
npm run test:contracts
npm run lint
npm run build
node --test --import jiti/register src/features/quests/quest-sync.test.ts
```

Run focused adjacent tests for changed behavior; [operations](docs/operations.md)
and feature docs explain coverage. Docs-only edits need the link check. Use
`npm run dev` to verify changed UI, including relevant loading/error states and
mode switches. Report validation failures without resetting data or changing
unrelated code to hide them.

## Cost-aware delegation

Use a `cheap_explorer` Luna agent for bounded, low-risk work that benefits from
multiple searches, repetitive reads, or mechanical processing. Do not delegate
cheap or obvious targeted file reads.
