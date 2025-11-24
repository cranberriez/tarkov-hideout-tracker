# GraphQL Queries (Tarkov.dev)

This document outlines the Tarkov.dev GraphQL queries required for the Hideout Tracker.

Use the official API playground at <https://api.tarkov.dev/> to test and refine these queries.

> Note: Field names and structures may evolve. Always validate against the live schema.

---

## 1. Fetch Hideout Stations and Requirements

Core query to load all Hideout stations, their levels, and item requirements.

```graphql
query HideoutStations {
    hideoutStations(lang: en) {
        id
        name
        # Optional: type, normalizedName, etc.
        levels {
            id
            level
            # Build / upgrade requirements for this level
            itemRequirements {
                id
                item {
                    id
                    name
                    shortName
                    iconLink
                    gridImageLink
                    # Optional: basePrice, avg24hPrice, lastLowPrice, etc.
                }
                # Tarkov.dev historically uses both `count` and `quantity` in places;
                # check schema and prefer the correct one.
                count
                quantity
                attributes {
                    type
                    name
                    value
                }
            }
        }
    }
}
```

**Usage in app**

-   Run on app load (or lazily) to populate:
    -   Station list for the Hideout page.
    -   Level and item requirement data for both Hideout and Item Checklist pages.

---

## 2. Fetch Item Prices (for Hide Cheap)

To power the **Hide Cheap** toggle, the app needs approximate prices per item.

There are two main strategies:

-   **A. Use item data returned in `hideoutStations.levels.itemRequirements.item`**

    -   If the schema exposes price fields directly on the embedded item (e.g. `avg24hPrice`), you may not need a separate query.

-   **B. Separate `items` query keyed by item id**
    -   Fetch price data for all relevant items by their IDs.

Example of a separate items query by id list:

```graphql
query ItemPrices($ids: [ID!]!) {
    items(ids: $ids) {
        id
        name
        shortName
        iconLink
        gridImageLink
        avg24hPrice
        basePrice
        lastLowPrice
    }
}
```

**Usage in app**

-   Build a unique list of item IDs from all `itemRequirements`.
-   Call `ItemPrices` once (or in batches) to get prices.
-   Cache the result client-side and use it for:
    -   Cheap / expensive classification.
    -   Optional price display in the checklist.

---

## 3. Possible Supporting Queries

Depending on how far you take the tracker, you may also use:

### 3.1 Individual Item Lookup

If you need on-demand details for a single item (e.g., info panel):

```graphql
query ItemById($id: ID!) {
    item(id: $id) {
        id
        name
        shortName
        description
        iconLink
        gridImageLink
        avg24hPrice
        basePrice
        lastLowPrice
        # Add more fields as needed
    }
}
```

### 3.2 Language Variants

If you later support localization, you can pass a different `lang` value to `hideoutStations(lang: XX)` or to item queries where supported.

---

## 4. Integration Notes

-   **Single source of truth for structure**: `hideoutStations` provides station/level/item-req structure. This should be fetched once and stored.
-   **Client-side logic** handles:
    -   Current level per station.
    -   Lock state per station.
    -   Aggregation of requirements into the pooled checklist.
    -   Filters: view mode, Show/Hide Locked, Hide Cheap.
-   **API calls** are mainly for:
    -   Initial station/requirement data.
    -   Price data for cheap filtering and display.

See `hideoutQL.md` for a minimal example query and `hideout-page.md` / `item-checklist-page.md` for how this data is consumed in the UI.
