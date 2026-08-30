# Item Checklist Page

The `/items` route shows the user's combined item demand across hideout upgrades, quest hand-ins, and quest stash/plant item objectives. It merges server-fetched hideout data from `DataContext` with quest item metadata built server-side from full quest data.

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
| `src/features/items/item-detail/ItemDetailModal.tsx` | Full item detail modal with hideout requirements, exact quest item demand, and item-group quest references             |
| `src/lib/utils/item-pooling.ts`                      | Pools hideout item requirements from station data                                                                      |
| `src/lib/utils/quest-item-index.ts`                  | Builds and derives quest item states and any-of groups                                                                 |
| `src/lib/utils/quest-availability.ts`                | Quest availability checks used by item quest visibility modes                                                          |

---

## Data Flow

```text
(data)/layout.tsx
  -> getCachedHideoutStations()
  -> getCachedHideoutRequiredItems()
  -> DataContext (tracked items include `marketPrice`)

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

`DataContext.items` contains the compact set of hideout- and quest-tracked items. Quest objective data remains the fallback when an upstream item does not exist in the standard item catalog.

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

Any-of quest objective groups carry only preview item IDs. `ItemsList` resolves those IDs through the shared tracked-item catalog before rendering or opening an item modal, and grouped alternatives are deducted from individual item totals so they are not double-counted.

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

Prices come from `ItemDetails.marketPrice`, normalized from the same mode-specific Tarkov.dev `/items` record as the item metadata. No client-side price fetch or separate price map is used.

The Market header shows `minLevelForFlea` whenever the item provides it, with a green check or red X based on the stored player level. Items with trader valuations but neither flea-market values nor a minimum flea level instead show a subdued `NO FLEA` badge. Eligibility does not hide or otherwise alter any values.

---

## Item Search & Detail Modal

`ItemsClientPage` builds `allSearchableItems` by merging:

- full tracked items from `DataContext.items` (hideout and quest objectives, including any-of groups)
- quest-only items from `questItemIndex`

That merged array is passed to `ItemSearchModal` as `itemPool`, so search is not limited to hideout-required items.

When an item is selected, `ItemDetailModal` resolves its ID against the shared tracked-item catalog before composing the modal, then receives station state, requirement state, quest item index, and quest availability metadata. This keeps group-item clicks attached to the full compact `ItemDetails` record (including market and category data) instead of a quest-objective fallback. Its compact header combines need counts with hideout/quest usage totals, while the connected inventory/market column is composed from optional item data.

The modal exposes contextual tabs when data exists:

- **Hideout** condenses station levels and counts into grid rows.
- **Quests** keeps completed hand-ins visible after incomplete ones and exposes direct quest and wiki links.
- **Traders** shows cash purchases and barters, including loyalty and quest gates. Locked offers remain visible and are evaluated against the active profile.
- **Crafting** shows recipe inputs, tools, quest items, duration, station level, edition, and quest gates. Availability uses the active profile's station, edition, and completed-quest state.
- **History** lazy-loads the mode-specific Tarkov.dev `/prices/{itemId}` dataset. The browser keeps an in-memory copy while the internal route uses a light 15-minute server cache and HTTP browser caching; Redis is not used. Day, 3-day, week, month, and all-time range controls and trend summaries are calculated client-side. The graph and summaries use every upstream price point in the selected range.

Tabs without relevant data are omitted. Trader offers and crafts are joined from Tarkov.dev `/barters` and `/crafts` while the compact tracked-item payload is built, so the full catalog is not serialized to the browser.

---

## Validation

There are focused Node tests for quest item derivation in `src/lib/utils/quest-item-index.test.ts`, but they are not wired to an npm script. Use the same pattern as other focused TypeScript tests when changing quest item demand logic:

```bash
node --test --import jiti/register src/lib/utils/quest-item-index.test.ts
```

Run `npm run lint` and `npm run build` after documentation-driven code changes. Use `npm run dev` for browser verification when UI behavior changes.
