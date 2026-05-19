# Item Checklist Page

The `/items` route shows the user's combined item demand across hideout upgrades and quest hand-ins. It merges server-fetched hideout data from `DataContext` with quest item metadata built server-side from full quest data.

---

## Route & Files

| File                                                 | Role                                                                                                                   |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `src/app/(data)/items/page.tsx`                      | Server component; fetches full quest data, sorts it, builds quest item index, any-of groups, and availability metadata |
| `src/features/items/ItemsClientPage.tsx`             | Client shell; merges searchable hideout items with quest-only item details and owns selected item modal state          |
| `src/features/items/components/ItemsList.tsx`        | Main item grid/list; merges hideout demand and derived quest demand                                                    |
| `src/features/items/components/ItemsStatsRow.tsx`    | Summary stats for visible hideout/quest demand                                                                         |
| `src/features/items/components/ItemsControls.tsx`    | View, source, quest visibility, and display controls                                                                   |
| `src/features/items/components/ItemSearchModal.tsx`  | Search modal; accepts a merged `itemPool` so quest-only items are searchable                                           |
| `src/features/items/item-detail/ItemDetailModal.tsx` | Full item detail modal with hideout requirements and quest hand-ins                                                    |
| `src/lib/utils/item-pooling.ts`                      | Pools hideout item requirements from station data                                                                      |
| `src/lib/utils/quest-item-index.ts`                  | Builds and derives quest item states and any-of groups                                                                 |
| `src/lib/utils/quest-availability.ts`                | Quest availability checks used by item quest visibility modes                                                          |

---

## Data Flow

```text
(data)/layout.tsx
  -> getCachedHideoutStations()
  -> getCachedHideoutRequiredItems()
  -> DataContext
  -> PriceDataLayout -> PriceDataContext

/items page
  -> getCachedFullQuestData()
  -> orderQuestsByPrerequisites(quests)
  -> buildQuestItemIndex(orderedQuests)
  -> buildQuestAnyOfGroups(orderedQuests)
  -> orderedQuests.map(toQuestAvailabilityQuest)
  -> <ItemsClientPage
       questItemIndex={...}
       questAnyOfGroups={...}
       questAvailabilityQuests={...}
     />
```

`DataContext.items` contains hideout-required items only. Quest-only items are synthesized from `questItemIndex` and `questAnyOfGroups` with the minimal `ItemDetails` fields available from quest objectives.

---

## Hideout Demand

`ItemsList` calls `poolItems()` with:

- `stations` from `DataContext`
- `stationLevels`
- `hiddenStations`
- `showHidden`
- `checklistViewMode`
- `completedRequirements`

Hideout demand supports:

- `checklistViewMode: "all"` - all levels above the current station level.
- `checklistViewMode: "nextLevel"` - only the next level for each station.
- `showHidden` - whether hidden stations contribute demand.
- Completed individual requirements, which are excluded from pooled demand.

---

## Quest Demand

The server passes quest item metadata to the client. The client derives active quest item demand with `deriveQuestItemStates()` and `deriveQuestAnyOfGroups()` using the user's current quest profile and filters:

- `completedQuests`
- `ignoredQuests`
- `pinnedQuests`
- `playerLevel`
- `prestigeLevel`
- `questFaction`
- `questTraderLoyaltyLevels`
- `itemQuestVisibilityMode`
- `itemQuestCustomLookahead`
- `itemQuestCustomLevelLookahead`
- `itemShowFutureFir`
- `itemShowIgnored`
- `questShowKappa`
- `questShowLightkeeper`

Supported quest visibility modes:

| Mode          | Meaning                                                                                                   |
| ------------- | --------------------------------------------------------------------------------------------------------- |
| `"available"` | Currently available quests based on level, faction, prestige, trader loyalty, and completed prerequisites |
| `"nextLayer"` | Available quests plus the next prerequisite layer                                                         |
| `"allFuture"` | All future quest hand-in demand allowed by active filters                                                 |
| `"custom"`    | Custom lookahead by prerequisite depth and player level                                                   |

Any-of quest objective groups are rendered as `ItemAnyOfGroupCard` entries and deducted from individual item totals so grouped alternatives are not double-counted.

---

## Merging & Filtering

`ItemsList` merges hideout and quest demand into one item map with separate counts:

```ts
hideoutCount: number;
hideoutFirCount: number;
questCount: number;
questFirCount: number;
count: number;
firCount: number;
isHideout: boolean;
isQuest: boolean;
```

The source filter controls which demand contributes to visible totals:

| `itemSourceFilter` | Visible demand         |
| ------------------ | ---------------------- |
| `"all"`            | Hideout + quest demand |
| `"hideout"`        | Hideout demand only    |
| `"quest"`          | Quest demand only      |

Additional filters:

- `showFirOnly` keeps items or groups with FiR demand.
- `hideCheap` removes non-FiR, non-currency items below `cheapPriceThreshold` when price data is available.
- `itemShowPinnedQuestOnly` limits quest demand to pinned quests.
- `useCategorization` groups rendered item cards by item category.
- `itemsSize` controls Icon, Compact, or Expanded item card layout.

---

## Prices

Prices come from `PriceDataContext.marketPricesByMode`. The active `gameMode` selects the PVP or PVE price bucket. Price maps are keyed by `normalizedName` and include both hideout-required and quest-required items.

No client-side price fetching occurs on the items page.

---

## Item Search & Detail Modal

`ItemsClientPage` builds `allSearchableItems` by merging:

- hideout-required items from `DataContext.items`
- quest-only items from `questItemIndex`
- items that appear only in quest any-of groups

That merged array is passed to `ItemSearchModal` as `itemPool`, so search is not limited to hideout-required items.

When an item is selected, `ItemDetailModal` receives station state, requirement state, quest item index, and quest availability metadata. It renders both hideout requirement details and quest hand-in details with pin/ignore/complete/have-items actions backed by `useUserStore`.

---

## Validation

There are focused Node tests for quest item derivation in `src/lib/utils/quest-item-index.test.ts`, but they are not wired to an npm script. Use the same pattern as other focused TypeScript tests when changing quest item demand logic:

```bash
node --test --import jiti/register src/lib/utils/quest-item-index.test.ts
```

Run `npm run lint` and `npm run build` after documentation-driven code changes. Use `npm run dev` for browser verification when UI behavior changes.
