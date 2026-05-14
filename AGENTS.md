# AGENTS.md

This file provides guidance to AI agents working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (Next.js)
npm run build    # Production build
npm run lint     # ESLint
```

There are no automated tests. Verify behavior by running the dev server if necessary.

## Environment Variables

Copy `.sample.env` to `.env`. Required variables:

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL` / `KV_REST_API_URL` | Upstash Redis endpoint |
| `UPSTASH_REDIS_REST_TOKEN` / `KV_REST_API_TOKEN` | Upstash Redis auth token |
| `TARKOV_MARKET_KEY` | Tarkov Market API key (server-only, never exposed to client) |
| `CRON_SECRET` | Bearer token required by the cron endpoint |

## Architecture

**Stack:** Next.js 16 (App Router) · React 19 · TypeScript 5 · Tailwind CSS 4 · Zustand · Radix UI · Upstash Redis · Vercel

### Data Flow

```
Tarkov.dev GraphQL ──► server/services/ ──► Redis (12h TTL) ──► (data)/layout.tsx
                                                                  ├── DataContext  (stations + items)
                                                                  └── PriceDataLayout
                                                                        └── PriceDataContext (PVP + PVE prices)

Tarkov Market REST ──► /api/cron/bulk-update ──► Redis (daily)
                                  ▲
                          Vercel cron at 00:00 UTC
```

All pages under `src/app/(data)/` are inside this route group and receive station/item/price data automatically through server-side context. The root `/` redirects to `/hideout`.

Quest data is **not** in the shared layout — each page that needs it fetches it independently server-side (see Quest Services below).

### Server Services (`src/server/services/`)

Each service wraps a two-layer cache: **Redis** (survives deploy) + **Next.js `unstable_cache`** (in-process, short TTL).

| Service | Redis Key Pattern | TTL |
|---|---|---|
| `hideout.ts` | `hideout:stations:v{N}` | 12h |
| `items.ts` | `hideout:items:filtered:v{N}` | 12h |
| `marketPrices.ts` | `tarkov-market:all-prices:filtered:v{N}:{pvp\|pve}` | reads daily-written key |
| `tarkovMarketBulk.ts` | same as above | written by cron |
| `quests.ts` | `quests:full:v{N}` | 12h |

Cache version constants live in `src/lib/cfg/cacheVersions.ts`. **Bump the relevant version number to bust a Redis key** — do not manually delete keys.

#### Quest Services (`src/server/services/quests.ts`)

Two exported functions with different data shapes — use the right one:

| Function | Returns | Use when |
|---|---|---|
| `getCachedQuestData()` | `Quest[]` — only `giveItem` objectives | building quest item index on items page |
| `getCachedFullQuestData()` | `FullQuest[]` — all objective types, maps, trader requirements, prestige | quests page, anywhere needing full detail |

Both return `TimedResponse<{ quests: T[] }>`. Both call `orderQuestsByPrerequisites()` after fetching to sort by dependency depth. The items page (`src/app/(data)/items/page.tsx`) uses `getCachedQuestData`; the quests page (`src/app/(data)/quests/page.tsx`) uses `getCachedFullQuestData`.

### State Management

**`useUserStore`** (Zustand, persisted to `localStorage` key `tarkov-hideout-user-state` v2):

- Station levels, hidden stations, completed requirements, item counts (`have` / `haveFir`).
- Filter/view preferences: `checklistViewMode`, `hideCheap`, `hideMoney`, `showFirOnly`, `hideRequirements`, `hideoutCompactMode`, `itemsSize`, `sellToPreference`, `useCategorization`.
- Onboarding state: `gameEdition`, `gameMode`, `hasCompletedSetup`, `isSetupOpen`, `editionBonusesAppliedFor`.
- **Quest state:** `completedQuests`, `ignoredQuests`, `pinnedQuests`, `questsWithItems` (all `Record<string, boolean>` keyed by quest ID).
- **Quest toggles:** `toggleQuestCompletion(id)`, `toggleIgnoredQuest(id)`, `togglePinnedQuest(id)`, `toggleQuestHaveItems(id)`.
- **Quest profile/filters** (persisted, used for availability checks and quests page filters): `playerLevel`, `prestigeLevel`, `questFaction`, `questTraderLoyaltyLevels`, `questViewMode`, `questSelectedTraders`, `questSelectedMaps`, `questHideCompleted`, `questShowAvailableOnly`, `questShowHandInOnly`, `questShowFirHandInOnly`, `questShowPinnedOnly`, `questShowIgnored`, `questShowDebug`, `questShowPrereqs`, `questShowKappa`, `questShowLightkeeper`.

**`useUIStore`** (Zustand, in-memory only):
- `isQuickAddOpen`, `pendingQuickAddItems`.

**React Contexts** (server data, read-only on client):
- `DataContext` (`src/app/(data)/_dataContext.tsx`) → `stations`, `items`, timestamps. Shape: `{ stations: Station[] | null, stationsUpdatedAt, items: ItemDetails[] | null, itemsUpdatedAt }`. `items` here is **hideout-required items only** — not all tarkov items.
- `PriceDataContext` (`src/app/(data)/_priceDataContext.tsx`) → `pvpPrices`, `pvePrices` (maps keyed by `normalizedName`).
- `QuestsContext` (`src/features/quests/QuestsContext.tsx`) → all quest filter state, computed quest lists, sync helpers. Available only inside `<QuestsProvider>`. Includes `onItemClick: ((itemId: string) => void) | null` for triggering item modal from quest components.

### FiR (Found In Raid)

Items marked FiR have `attributes` containing `{ name: "found_in_raid", value: "true" }`. FiR truth comes from `src/lib/data/wiki-data.ts` (imports `hideout-data.json` with manual overrides) and falls back to `src/lib/cfg/foundInRaid.ts`. The data service in `hideout.ts` merges this at fetch time.

### Item Pooling

`src/lib/utils/item-pooling.ts` aggregates requirements across all visible stations into a flat item list. `src/lib/utils/item-needs.ts` computes per-item need counts. Both are called in `HideoutList.tsx` and `ItemsList.tsx`.

---

## Quest System

### Types (`src/types/types.ts`)

| Type | Key fields |
|---|---|
| `Quest` | `id`, `name`, `normalizedName`, `minPlayerLevel`, `trader`, `taskRequirements`, `objectives` (giveItem only), `kappaRequired`, `lightkeeperRequired`, `factionName` |
| `FullQuest` | Everything in `Quest` + `map`, `wikiLink`, `experience`, `traderRequirements`, `requiredPrestige`, full `objectives` (all types) |
| `QuestPrerequisite` | `{ task: { id, name } }` — prerequisite quest reference |
| `FullQuestObjective` | Union of `QuestObjectiveItemType` (giveItem/findItem with `items[]`), `QuestObjectiveShootType`, and others |

### Quest Utilities

| File | Purpose |
|---|---|
| `src/lib/utils/quest-item-index.ts` | `buildQuestItemIndex(quests)` — builds a per-item map of which quests need it; `deriveQuestItemState(entry, options)` — computes availability/pin/ignore status per item; `deriveQuestItemStates(index, options)` — full list; `hasGiveItemObjectives(quest)`, `hasFirGiveItemObjectives(quest)` |
| `src/lib/utils/quest-availability.ts` | `isQuestAvailableForProfile(quest, profile, questsById)` — checks level, faction, loyalty, prerequisites; `toQuestAvailabilityQuest(fullQuest)` — converts FullQuest to the lighter `QuestAvailabilityQuest` shape used by availability checks; `buildQuestAvailabilityMap(quests)` |
| `src/server/services/quests.ts` | `orderQuestsByPrerequisites(quests)` — topological sort; `getCachedQuestData()`, `getCachedFullQuestData()` |

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
{ completedQuests, playerLevel, prestigeLevel, faction, traderLoyaltyLevels }
```
A quest is available when: not completed, faction matches, minPlayerLevel ≤ playerLevel, prestige met, trader loyalty met, all prerequisites completed. Ignored quests are **not** filtered by availability — that's a separate UI concern.

### Quest Page Feature Files (`src/features/quests/`)

| File | Purpose |
|---|---|
| `QuestsClientPage.tsx` | Top-level client component. Manages `selectedItemId` state for item modal, derives `questItemDetails` (ItemDetails map from quest objectives), renders `ItemDetailModal`. Wraps everything in `<QuestsProvider onItemClick={setSelectedItemId}>`. |
| `QuestsContext.tsx` | Provider + hook. Holds all filter state (reads from useUserStore), computes `filteredQuests`, `questsById`, `leadsToByQuestId`, `traders`, `kappaQuestIds`, `lightkeeperQuestIds`. Exposes `onItemClick` so deep children can open item modal without prop drilling. |
| `QuestCard.tsx` | Renders a single quest. Item thumbnails in the compact strip and in expanded `ObjectiveRow` items are clickable — calls `onItemClick(itemId)` from `useQuestsContext()` with `e.stopPropagation()`. Also has pin, ignore, complete buttons and `onQuestLinkClick` for prerequisite/unlocks chip navigation. |
| `components/QuestsList.tsx` | Renders `filteredQuests` from context, grouped by trader or flat. Calls `renderCard(quest)` → `<QuestCard>`. |
| `components/QuestsSidebar.tsx` | Filter panel — traders, maps, faction, kappa/LK, view mode. |
| `components/QuestsFilterBar.tsx` | Secondary filter bar — available only, hide completed, hand-in only, FiR, pinned only, search. |
| `components/QuestsTree.tsx` | Tree/graph view of quest prerequisite chains. |
| `components/QuestsSyncBar.tsx` + `QuestSyncDialog.tsx` | Trader sync feature — bulk-complete quests by selecting visible ones. |
| `quest-sync.ts` | `isQuestAvailableForProfile`, `syncTraderProgress`, `getVisibleSyncCandidatesForTrader`. Re-exports from quest-availability with sync-specific logic. |

### Quest Page Server Component (`src/app/(data)/quests/page.tsx`)

Calls `getCachedFullQuestData()`, sorts with `orderQuestsByPrerequisites()`, then builds and passes to `QuestsClientPage`:
- `quests: FullQuest[]`
- `questItemIndex: QuestItemIndexEntry[]` (built via `buildQuestItemIndex`)
- `questAvailabilityQuests: QuestAvailabilityQuest[]` (built via `quests.map(toQuestAvailabilityQuest)`)

---

## Items System

### Item Types

`ItemDetails` (`src/types/types.ts`): `{ id, name, normalizedName, iconLink?, gridImageLink?, link?, wikiLink?, category? }` — this is the minimal shape. Items from DataContext have all fields; items synthesized from quest objectives only have id/name/normalizedName/iconLink/gridImageLink.

### Items Page Feature Files (`src/features/items/`)

| File | Purpose |
|---|---|
| `ItemsClientPage.tsx` | Top-level client component. Builds `allSearchableItems` (merged pool of DataContext hideout items + quest-only items from questItemIndex) and passes as `itemPool` to `ItemSearchModal`. |
| `components/ItemsList.tsx` | Main item checklist. Merges hideout items (from `poolItems()`) with quest items (from `deriveQuestItemStates()`). Builds `allItemDetails` internally — a Record of ItemDetails that includes synthesized entries for quest-only items. Has `itemSourceFilter` for hideout/quest/all. |
| `components/ItemSearchModal.tsx` | Search dialog. Accepts optional `itemPool?: ItemDetails[]` prop — if provided, uses it instead of DataContext items. Without `itemPool` it only searches hideout items; with it, searches anything passed in. |
| `components/ItemsControls.tsx` | Filter bar above the list. |
| `item-detail/ItemDetailModal.tsx` | Full item detail modal. Props: `item`, `isOpen`, `onClose`, `stations`, `stationLevels`, `hiddenStations`, `completedRequirements`, `questItemIndex?`, `questAvailabilityQuests?`. Quest Hand-Ins section shows `relatedQuests` from `deriveQuestItemState` with pin/ignore/complete buttons (`useUserStore` toggles) and a `Link` to `/quests#quest-{questId}`. |

### Items Page Server Component (`src/app/(data)/items/page.tsx`)

Calls `getCachedQuestData()` (lightweight — giveItem objectives only), sorts, builds `questItemIndex` and `questAvailabilityQuests`, passes to `ItemsClientPage`.

### Item Search Scope

- DataContext `items` = hideout-required items only (from `getCachedHideoutRequiredItems()`)
- `ItemSearchModal` with `itemPool` from `ItemsClientPage` = hideout items + quest-only items (merged, deduped)
- Quest items synthesized from `questItemIndex` have only: id, name, normalizedName, iconLink, gridImageLink

---

## Key Files for Common Tasks

| Task | Files |
|---|---|
| Add a new page | `src/app/(data)/<page>/page.tsx` + `src/components/core/Navbar.tsx` |
| Add new cached server data | New file in `src/server/services/`, call from `src/app/(data)/layout.tsx` |
| Add a new user preference | `src/lib/stores/useUserStore.ts` (state + action + reset) |
| Change FiR config | `src/lib/data/hideout-data.json` or `src/lib/cfg/foundInRaid.ts` |
| Change station render order | `src/lib/cfg/stationOrder.ts` |
| Add a new type | `src/types/types.ts` |
| Bust a Redis cache | Bump the version in `src/lib/cfg/cacheVersions.ts` |
| Wire a new modal | Add open state to `useUIStore`, add component to `src/features/` |
| Add quest filter/toggle | `src/lib/stores/useUserStore.ts` + `src/features/quests/QuestsContext.tsx` + `QuestsFilterBar.tsx` or `QuestsSidebar.tsx` |
| Change quest sort/availability logic | `src/lib/utils/quest-availability.ts` |
| Change quest-item demand logic | `src/lib/utils/quest-item-index.ts` |
| Open item modal from a new location | Manage `selectedItem: ItemDetails \| null` state in caller, render `<ItemDetailModal>` with stations from DataContext + stationLevels/hiddenStations/completedRequirements from useUserStore |
| Broaden item search to non-hideout items | Pass `itemPool` prop to `ItemSearchModal` with a merged array |

## Docs

Detailed architecture docs are in `docs/`. Key references:

- `docs/state-management.md` — authoritative store shapes
- `docs/caching-architecture.md` — Redis key naming, invalidation
- `docs/data-and-price-context-architecture.md` — DataContext + PriceDataContext pattern
- `docs/quests-page.md` — quests feature spec
- `docs/cron-jobs.md` — cron setup and manual trigger instructions
- `docs/item-checklist-page.md` — items page architecture
- `docs/item-source-filtering.md` — hideout vs quest item source filter logic
- `docs/quest-completion-filtering.md` — how completed/ignored quests affect item demand
