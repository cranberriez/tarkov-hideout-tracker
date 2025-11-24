# Item Checklist Page

The Item Checklist page shows a pooled list of all items required to build/upgrade the Hideout according to the current user plan.

## Purpose

-   **Aggregate all item requirements** across stations and levels into a single checklist.
-   Enable multiple **views** (all future needs vs. next levels only).
-   Respect station **hidden** state and a **Hide Cheap** toggle.

## Data Needed

From Tarkov.dev:

-   `hideoutStations` with `levels.itemRequirements` (same fields as the Hideout page).
-   Optional item pricing information for cheap-item filtering, e.g. via `items` query:
    -   `id`
    -   `avg24hPrice` or other price field

From app state:

-   Current level per station.
-   Hidden/visible flag per station.
-   User checklist options:
    -   View mode: **All Items** vs **Next Level Only**.
    -   **Show Hidden** vs **Hide Hidden**.
    -   **Hide Cheap** toggle and cheap price threshold.

## Views

### Show All Items Needed

-   For each station:
    -   If station is **hidden** and **Hide Hidden** is active, skip it.
    -   Consider all levels **above the current level** up to the max level.
    -   Collect all `itemRequirements` for those levels.
-   Group by item id and sum quantities to get a global "needed" count per item.

### Show Items Needed for Only the Next Level of Stations

-   For each station:
    -   If station is **hidden** and **Hide Hidden** is active, skip it.
    -   Determine the **next level** (current + 1) only.
    -   Collect `itemRequirements` for that single level.
-   Group by item id and sum quantities across stations.

## Cheap Item Handling

-   Define a **cheap price threshold** in the app (e.g., based on `avg24hPrice`).
-   When **Hide Cheap** is active:
    -   For each item in the pooled list:
        -   If its price is below the threshold, hide it from the checklist.
-   When **Hide Cheap** is off:
    -   Show all items regardless of price.

## Checklist Item Fields

Each row in the checklist can display:

-   Item icon (`iconLink` or `gridImageLink`).
-   Item name.
-   Total quantity needed (after pooling across stations/levels).
-   Optional price data (for context and cheap filtering).
-   Optional breakdown (e.g., hover or expand to see which stations/levels need this item).

## Interaction with Hideout Page

-   Any change in station level or hidden state on the Hideout page must trigger a recomputation of the pooled item list.
-   Checklist filters (view mode, Show/Hide Hidden, Hide Cheap) only affect the **display** of items, not the underlying progress data.
