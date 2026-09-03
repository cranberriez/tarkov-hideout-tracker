# Hideout Page

The Hideout page shows all stations and the items required to upgrade each station by one level, similar to the in-game Hideout UI.

## Purpose

-   **Visualize stations** and their current level.
-   **Show next-level requirements** for each station.
-   **Allow hiding/showing stations** so that their requirements can be excluded from the pooled checklist.
-   **Respect a manual ordering** of stations defined by the app.

## Data Needed

From the route-scoped `getHideoutPageData` query:

-   **Stations** from the active-mode Tarkov.dev JSON dataset
    -   `id`
    -   `name`
    -   `levels[]`
        -   `level` (numeric level index)
        -   `itemRequirements[]`
            -   `id`
            -   `itemId`
            -   `count`
            -   `isFir`
            -   `isTool`
-   **Item summaries and prices** only for unique IDs referenced by the stations

Local / client state:

-   **Current station level** for each station (based on user progress).
-   **Hidden flag** per station.
-   **Manual sort order** for stations.

## Behavior

-   **Initial State**

    -   All stations start at level 0 (unbuilt), except stash which starts at user-selected level (1–4).
    -   All stations default to **visible**.

-   **Displaying Stations**

    -   Render stations in a fixed, manually defined order.
    -   For each station:
        -   Show current level.
        -   Compute the **next level** (current + 1) if it exists.
        -   Show the item requirements for the next level.

-   **Upgrading a Station**

    -   User clicks an "Upgrade" or similar action when they want to mark a level as completed.
    -   App updates the station's current level in state.
    -   Next-level requirements update automatically.
    -   Pooled item counts on the Item Checklist page should recompute based on the new progress.
    -   If a required item ID is missing from the delivered catalog projection, the
        affected upgrade is disabled and a visible warning is shown. Missing
        presentation must never be interpreted as a satisfied requirement.
    -   Level-down refunds operate by stable item ID, so a temporary presentation
        miss does not silently discard the refund.

-   **Hiding / Showing a Station**
    -   Each station row has a control to toggle **hidden**.
    -   Hidden stations:
        -   Are visually marked as hidden.
        -   Are excluded from pooled item calculations when **Hide Hidden** is active on the Item Checklist page.
    -   The hidden state is persisted in app state (and optionally local storage).

## Integration with Item Checklist

The Hideout page is the source of truth for:

-   Current level of each station.
-   Which stations are hidden.

The Item Checklist page uses this information combined with station level data to compute the global list of required items.
