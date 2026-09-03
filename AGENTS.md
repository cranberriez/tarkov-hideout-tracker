# AGENTS.md

This file provides guidance to AI agents working with code in this repository.

Ensure any adjustments to local storage will not invalidate existing user data. Loss of user data stored here is not acceptable. Do not modify persistent Zustand storage keys, persisted field names, or persistence behavior without checking `docs/state-management.md` and the store implementation.

## Documentation First

Before recommending or making changes, read the relevant docs in `docs/` for the area being touched. Start with `docs/README.md` and `docs/overview.md`, then read the specific architecture or feature docs needed for the task. If docs and source code conflict, treat source code as authoritative and note the doc drift.

## Commands

```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run lint     # ESLint
```

Some focused TypeScript tests exist but are not wired to an npm script. Run targeted tests with Node's test runner and `jiti/register`, for example:

```bash
node --test --import jiti/register src/features/quests/quest-sync.test.ts
```

Verify UI behavior by running the dev server when necessary.

## Environment Variables

Copy `.sample.env` to `.env`. Required variables:

| Variable             | Purpose                   |
| -------------------- | ------------------------- |
| `TURSO_DATABASE_URL` | Turso/libSQL database URL |
| `TURSO_AUTH_TOKEN`   | Turso authentication      |

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Zustand · Radix UI · Turso · Vercel

### Data Flow

```
Tarkov.dev JSON -> offline release generation -> TursoTarkovDataRepository
                                              -> named page/API queries
                                              -> route-scoped contracts
```

The `(data)` layout does not load entity arrays. Pages request only the domains and
IDs they need through `src/server/queries/`; search and item relations are lazy API
reads. The root `/` redirects to `/hideout`.

### Runtime data (`src/server/db/`)

Runtime normalized data comes from immutable Turso releases pinned in
`src/server/db/release-config.ts`. See `docs/caching-architecture.md` and
`docs/api-routes.md` before changing release selection or server data flow. Price
history is the only live provider data request.

### Repository and queries

`src/server/repositories/tarkov-data/types.ts` defines the provider-independent
repository. Page composition belongs in `src/server/queries/`; pages must not import
the concrete repository and queries must not import adapter services.

### State Management

**`useUserStore`** is the persisted Zustand store for user progress, inventory, setup state, item preferences, quest progress, and quest/item filters. See `docs/state-management.md` and `src/lib/stores/useUserStore.ts` for the authoritative storage key, version, fields, actions, and migration behavior.

**`useUIStore`** (Zustand, in-memory only):

- `isQuickAddOpen`, `pendingQuickAddItems`.

**Route contracts** (server data, read-only on client) are owned by
`src/types/contracts.ts`. Clients may derive local ID maps from route-scoped arrays.
- `QuestsContext` (`src/features/quests/QuestsContext.tsx`) → all quest filter state, computed quest lists, sync helpers. Available only inside `<QuestsProvider>`. Includes `onItemClick: ((itemId: string) => void) | null` for triggering item modal from quest components.

### FiR (Found In Raid)

Items marked FiR have `attributes` containing `{ name: "found_in_raid", value: "true" }`. FiR truth comes from `src/lib/data/wiki-data.ts` (imports `hideout-data.json` with manual overrides) and falls back to `src/lib/cfg/foundInRaid.ts`. The data service in `hideout.ts` merges this at fetch time.

### Item Pooling

`src/lib/utils/item-pooling.ts` aggregates requirements across all visible stations into a flat item list. `src/lib/utils/item-needs.ts` computes per-item need counts. Both are called in `HideoutList.tsx` and `ItemsList.tsx`.

---

## Quest System

### Types (`src/types/quests.ts`)

| Type                 | Key fields                                                                                                                                                          |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Quest`              | `id`, `name`, `normalizedName`, `minPlayerLevel`, `trader`, `taskRequirements`, `objectives` (giveItem only), `kappaRequired`, `lightkeeperRequired`, `factionName` |
| `FullQuest`          | Everything in `Quest` + `map`, `wikiLink`, `experience`, `traderRequirements`, `requiredPrestige`, full `objectives` (all types)                                    |
| `QuestPrerequisite`  | `{ task: { id, name } }` — prerequisite quest reference                                                                                                             |
| `FullQuestObjective` | Union of `QuestObjectiveItemType` (giveItem/findItem with `items[]`), `QuestObjectiveShootType`, and others                                                         |

### Quest Utilities

| File                                  | Purpose                                                                                                                                                                                                                                                                                          |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/utils/quest-item-index.ts`   | `buildQuestItemIndex(quests)` — builds a per-item map of which quests need it; `deriveQuestItemState(entry, options)` — computes availability/pin/ignore status per item; `deriveQuestItemStates(index, options)` — full list; `hasGiveItemObjectives(quest)`, `hasFirGiveItemObjectives(quest)` |
| `src/lib/utils/quest-availability.ts` | `isQuestAvailableForProfile(quest, profile, questsById)` — checks level, faction, loyalty, prerequisites; `toQuestAvailabilityQuest(fullQuest)` — converts FullQuest to the lighter `QuestAvailabilityQuest` shape used by availability checks; `buildQuestAvailabilityMap(quests)`              |
| `src/lib/utils/quest-ordering.ts`     | `orderQuestsByPrerequisites(quests)` — topological sort                                                                                                                                                                                        |

### `DerivedQuestItemQuest` (from quest-item-index.ts)

The shape used in `ItemDetailModal` for each quest related to an item:

- `questId`, `questName`, `questNormalizedName`, `traderId`, `traderName`, `traderImageLink`, `traderImage4xLink`
- `prerequisiteDepth` — how deep in the prerequisite tree (0 = no prereqs)
- `minPlayerLevel`, `requiredCount`, `requiredFirCount`, `isFirRequired`
- `status: "available" | "future" | "completed" | "ignored"`
- `isPinned`, `isActive`

### Quest Availability Profile

`QuestAvailabilityProfile` (used by `isQuestAvailableForProfile`):

```typescript
{
    (completedQuests, playerLevel, prestigeLevel, faction, traderLoyaltyLevels);
}
```

A quest is available when: not completed, faction matches, minPlayerLevel ≤ playerLevel, prestige met, trader loyalty met, all prerequisites completed. Ignored quests are **not** filtered by availability — that's a separate UI concern.

### Quest Page Feature Files (`src/features/quests/`)

| File                                                   | Purpose                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `QuestsClientPage.tsx`                                 | Top-level client component. Manages `selectedItemId` state for item modal, derives `questItemDetails` (ItemDetails map from quest objectives), renders `ItemDetailModal`. Wraps everything in `<QuestsProvider onItemClick={setSelectedItemId}>`.                                                           |
| `QuestsContext.tsx`                                    | Provider + hook. Holds all filter state (reads from useUserStore), computes `filteredQuests`, `questsById`, `leadsToByQuestId`, `traders`, `kappaQuestIds`, `lightkeeperQuestIds`. Exposes `onItemClick` so deep children can open item modal without prop drilling.                                        |
| `QuestCard.tsx`                                        | Renders a single quest. Item thumbnails in the compact strip and in expanded `ObjectiveRow` items are clickable — calls `onItemClick(itemId)` from `useQuestsContext()` with `e.stopPropagation()`. Also has pin, ignore, complete buttons and `onQuestLinkClick` for prerequisite/unlocks chip navigation. |
| `components/QuestsList.tsx`                            | Renders `filteredQuests` from context, grouped by trader or flat. Calls `renderCard(quest)` → `<QuestCard>`.                                                                                                                                                                                                |
| `components/QuestsSidebar.tsx`                         | Filter panel — traders, maps, faction, kappa/LK, view mode.                                                                                                                                                                                                                                                 |
| `components/QuestsFilterBar.tsx`                       | Secondary filter bar — available only, hide completed, hand-in only, FiR, pinned only, search.                                                                                                                                                                                                              |
| `components/QuestsTree.tsx`                            | Tree/graph view of quest prerequisite chains.                                                                                                                                                                                                                                                               |
| `components/QuestsSyncBar.tsx` + `QuestSyncDialog.tsx` | Trader sync feature — bulk-complete quests by selecting visible ones.                                                                                                                                                                                                                                       |
| `quest-sync.ts`                                        | Pure manual sync engine: `syncTraderProgress`, `getSyncCandidatesForTrader`, and availability wrapper. Inference only scans selected-trader candidates; cross-trader prerequisite chains may be backfilled only when they are the sole blocker.                                                             |

### Quest Page Server Component (`src/app/(data)/quests/page.tsx`)

Calls `getQuestWorkspacePageData()`, which returns display quests and only their
referenced item summaries/prices. Unused modal indexes are not serialized; the
item modal loads relations lazily.

---

## Items System

### Item Types

`ItemSummary` lives in `src/types/items.ts` and may carry the active-mode
`marketPrice`. Quest-specific items remain separate display-only records.

### Items Page Feature Files (`src/features/items/`)

| File                              | Purpose                                                                                                                                                                                                                                                                                                                                                          |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ItemsClientPage.tsx`             | Top-level client component. Presents route query errors, demand, search, and selected-item state.                                                                                                                                                                         |
| `components/ItemsList.tsx`        | Main item checklist. Merges hideout items (from `poolItems()`) with quest items (from `deriveQuestItemStates()`). Builds `allItemDetails` internally — a Record of ItemDetails that includes synthesized entries for quest-only items. Has `itemSourceFilter` for hideout/quest/all.                                                                             |
| `components/ItemSearchModal.tsx`  | Search dialog backed by the bounded catalog search API (up to 50 results).                                                                                                                                                    |
| `components/ItemsControls.tsx`    | Filter bar above the list.                                                                                                                                                                                                                                                                                                                                       |
| `item-detail/ItemDetailModal.tsx` | Presentation-only item detail modal. Its model, request, and navigation controllers lazily load relations, usage, acquisition, and history. |

### Items Page Server Component (`src/app/(data)/items/page.tsx`)

Fetches quest data server-side, sorts it, builds quest item metadata, and passes it to `ItemsClientPage`. Check the page component and `docs/item-checklist-page.md` for the current data shape before changing item demand behavior.

### Item Search Scope

- `/api/items/search` searches the complete standard active-mode catalog.
- Checklist search returns up to 50 starts-with-prioritized alphabetical results.
- Quick Add uses the same endpoint with a 10-result limit.
- Quest-specific items are excluded.

---

## Key Files for Common Tasks

| Task                                     | Files                                                                                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add a new page                           | `src/app/(data)/<page>/page.tsx` + `src/components/core/Navbar.tsx`                                                                                                                          |
| Add new cached server data               | Adapter in `src/server/services/`, repository method, named query, and contract                                                                                                             |
| Add a new user preference                | `src/lib/stores/useUserStore.ts` (state + action + reset)                                                                                                                                    |
| Change FiR config                        | `src/lib/data/hideout-data.json` or `src/lib/cfg/foundInRaid.ts`                                                                                                                             |
| Change station render order              | `src/lib/cfg/stationOrder.ts`                                                                                                                                                                |
| Add a new type                           | The owning domain file in `src/types/`; cross-boundary payloads belong in `src/types/contracts.ts`                                                                                           |
| Publish refreshed normalized data        | Generate, validate, upload, and select a new immutable Turso release                                                                                                                        |
| Wire a new modal                         | Add open state to `useUIStore`, add component to `src/features/`                                                                                                                             |
| Add quest filter/toggle                  | `src/lib/stores/useUserStore.ts` + `src/features/quests/QuestsContext.tsx` + `QuestsFilterBar.tsx` or `QuestsSidebar.tsx`                                                                    |
| Change quest sort/availability logic     | `src/lib/utils/quest-availability.ts`                                                                                                                                                        |
| Change quest-item demand logic           | `src/lib/utils/quest-item-index.ts`                                                                                                                                                          |
| Open item modal from a new location      | Manage `selectedItem: ItemSummary \| null` and render `<ItemDetailModal item={...}>`; its controller loads relationships lazily                                                            |
| Change item search behavior              | `src/server/queries/searchItems.ts`, the search API route, and `useItemSearchController.ts`                                                                                                  |

## Docs

Detailed architecture docs are in `docs/`. `docs/README.md` is the index and should be checked first. Key references:

- `docs/state-management.md` — authoritative store shapes
- `docs/caching-architecture.md` — Turso release reads and HTTP/price-history caching
- `docs/data-and-price-context-architecture.md` — repository, query, route-contract, and lazy item-data delivery
- `docs/quests-page.md` — quests feature spec
- `docs/item-checklist-page.md` — current items page architecture, item demand, and source filtering behavior
- `docs/item-source-filtering.md` / `docs/quest-completion-filtering.md` — historical plans; verify against current source before using
