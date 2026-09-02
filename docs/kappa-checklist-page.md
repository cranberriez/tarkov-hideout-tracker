# Kappa Checklist Page

The `/items/kappa-checklist` route is a focused checklist of the standard items
required by the Collector quest for the active game mode.

## Data flow

The server page loads the same normalized full quest data used by `/items`, finds
the quest whose normalized name is `collector`, and collects the standard item IDs
from its `giveItem` objectives. The client joins those IDs through
`DataContext.itemById`, then sorts the resulting items alphabetically by display
name. Collector item requirements are never copied into a static application list.

The page also builds the normal quest indexes so selecting an item can open the
shared `ItemDetailModal` with its complete hideout and quest usage.

## Interaction

- **All** is the default view and shows every Collector item.
- **Need** hides items marked as collected.
- Selecting an item image opens the shared item detail modal.
- The check control beside an image toggles its collected state. Collected items
  remain visible in **All** with a muted image and active check control.
- The Collector control beside the filter links directly to the Collector quest.
- A footer reminder notes that every Collector item must be found in raid.
- Items are displayed alphabetically in a responsive icon grid.

## Persisted state

`src/lib/stores/useKappaStore.ts` is a small, independent persisted Zustand store.
It uses localStorage key `tarkov-kappa-checklist-state`, version 1, and stores:

- `completedItemsByMode`: collected item IDs separated across PVP, PVE, and KORD;
- `viewMode`: the current `all` or `need` filter.

This is user-owned progress and preference data. The Settings page includes it in
saved-data usage, item-data resets clear its completion state, and a full reset
clears the entire store. Its storage key and persisted field names must remain
stable unless a versioned migration is added.

## Validation

Run the focused tests with:

```bash
node --test --import jiti/register src/features/items/kappa/kappa-items.test.ts src/lib/stores/useKappaStore.test.ts
```

Then run `npm run lint`, `npm run build`, and verify the interactions in the local
development server.
