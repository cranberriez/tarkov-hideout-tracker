# Item Checklist Page

The `/items` route combines user-specific demand from hideout upgrades, quest
hand-ins, and stash/plant objectives. Source records keep only stable item IDs;
the client joins standard item presentation through the global catalog and
derives totals from the active player profile.

## Route and files

| File | Role |
|---|---|
| `src/app/(data)/items/page.tsx` | Loads full quests and builds quest indexes, any-of groups, and availability metadata |
| `src/features/items/ItemsClientPage.tsx` | Client shell, catalog-backed search pool, and selected-item state |
| `src/features/items/components/ItemsList.tsx` | Merges hideout and quest demand |
| `src/features/items/components/ItemsStatsRow.tsx` | Visible demand summaries |
| `src/features/items/components/ItemsControls.tsx` | Source, visibility, and display controls |
| `src/features/items/components/ItemSearchModal.tsx` | Searches the standard global catalog |
| `src/features/items/item-detail/ItemDetailModal.tsx` | Standard-item details and lazy usage/history loading |
| `src/lib/utils/item-pooling.ts` | Pools ID-based hideout requirements |
| `src/lib/utils/quest-item-index.ts` | Builds standard quest-item states and any-of groups |

## Data flow

```text
(data)/layout.tsx
  -> getCachedHideoutStations(mode)
  -> getGlobalItemList(mode)
  -> DataContext { stations, items, itemById }

/items page
  -> getCachedFullQuestData(mode)
  -> orderQuestsByPrerequisites(quests)
  -> buildQuestItemIndex(quests)
  -> buildQuestAnyOfGroups(quests)
  -> build availability metadata
  -> ItemsClientPage

ItemsList
  -> pool hideout itemId requirements from player station progress
  -> derive quest itemId demand from player quest progress
  -> join each standard item through DataContext.itemById
```

`DataContext.items` is the complete compact standard-item catalog for the active
mode, not a filtered tracked-item set. Missing standard catalog references are
skipped rather than replaced with task-owned quest-item presentation.

## Hideout demand

`poolItems()` consumes station requirements shaped as
`{ id, itemId, count, isFir, isTool }` plus `stationLevels`, `hiddenStations`,
`showHidden`, `checklistViewMode`, and `completedRequirements`. Requirement IDs are
preserved because manually completed requirements refer to them in player data.

The checklist supports all remaining station levels or only the next level,
optional hidden-station demand, and exclusion of individually completed
requirements.

## Quest demand

Full quest objectives store standard items as IDs. The client derives demand with
the active profile's completed/ignored/pinned quests, level, prestige, faction,
trader loyalty, quest visibility mode, lookahead settings, FiR settings, and
Kappa/Lightkeeper filters.

Any-of and broad-any groups retain standard item IDs for preview and demand. The
client resolves those IDs through `itemById`, and grouped alternatives are
deducted from individual totals to avoid double-counting. Existing exact,
any-of, broad-any, `plantItem`, and FiR semantics are preserved.

`QuestSpecificItem` records from task pickup/find content are display-only. They
can appear in quest presentation, but they are not clickable standard items and
never contribute checklist demand, inventory counts, search, Quick Add, market
data, or the generic item modal.

## Merging and filtering

Standard items retain separate hideout and quest counts before totals are
calculated:

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

`itemSourceFilter` selects all, hideout-only, or quest-only demand. Other filters
cover FiR demand, cheap non-FiR items, pinned quests, categories, and item-card
size. Prices come from `GlobalItem.marketPrice`; no separate client price map is
needed.

## Search and item modal

Search uses `DataContext.items`, so every standard catalog item is searchable even
when it has no current hideout or quest demand. Quest-specific items are excluded.

Selecting a standard item opens `ItemDetailModal`, which resolves the canonical
record through `itemById`. Hideout and quest usage remain client-derived. The
modal's acquisition data is loaded separately:

- **Hideout** and **Quests** use the already loaded station/quest references.
- The **Quests** tab separates quests that require the selected item from quests
  that award it. Reward sources are informational and never contribute checklist
  demand or inventory counts.
- **Traders** and **Crafting** lazily request
  `/api/items/{itemId}/usage?mode=...`. Barter and craft errors render
  independently; successful results are cached in memory by mode and item ID.
- Barter and craft rows also load the selected item's recursive acquisition tree.
  They show route cost, output sale value, route profit, and craft profit per hour
  using the same optimizer and mode-scoped manual prices as the full profit pages.
  Each recipe links to its exact row on the corresponding profit page.
- Standard ingredient chips in barter and craft rows are clickable. Selecting one
  keeps the modal open on that item's details, with a back action for the previous
  item. Each priced ingredient is labeled **Buy**, **Craft**, or **Barter** from
  the optimizer's recommended practical route; quest-only ingredients remain
  informational and are not clickable.
- **History** lazily requests `/api/items/{itemId}/price-history?mode=...`.

In development, a small bug button floats just outside the modal's bottom-right
corner. It toggles the modal between its normal presentation and formatted JSON
for the selected item plus its inventory, hideout, quest, barter, and craft data.
Market pricing is intentionally omitted from this debug view.

The usage response contains ID-based barter/craft records for the selected item
only. Ingredient presentation is joined through the global catalog in the modal.

## Validation

Focused quest demand tests run with:

```bash
node --test --import jiti/register src/lib/utils/quest-item-index.test.ts
```

Run `npm run lint` and `npm run build` after behavior changes, and use
`npm run dev` for browser verification.
