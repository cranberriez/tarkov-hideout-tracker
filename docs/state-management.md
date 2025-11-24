# State Management (zustand)

This document specifies the client-side state stores (using zustand) and key derived selectors/queries used by the Hideout Tracker.

Two main concerns:

-   **Data store**: server-provided, cached data (stations, prices).
-   **User store**: user progress and view preferences (levels, hidden flags, filters).

---

## Data Store (`useDataStore`)

Holds data fetched from the Next.js API routes.

### Shape

```ts
interface DataState {
    stations: Station[] | null;
    stationsUpdatedAt: number | null;

    prices: Record<string, ItemPrice> | null;
    pricesUpdatedAt: number | null;

    loadingStations: boolean;
    loadingPrices: boolean;
    errorStations: string | null;
    errorPrices: string | null;

    // Actions
    fetchStations: () => Promise<void>;
    fetchPrices: (ids?: string[]) => Promise<void>;
    setStations: (stations: Station[], updatedAt?: number) => void;
    setPrices: (prices: Record<string, ItemPrice>, updatedAt?: number) => void;
}
```

`Station`, `ItemPrice` etc. match the types in `api-routes.md`.

### Responsibilities

-   Call `/api/hideout/stations` and `/api/items/prices`.
-   Cache results in memory for the session.
-   Expose `stations` and `prices` to components and other hooks.

---

## User Store (`useUserStore`)

Tracks user-specific progress and view preferences. This store should use zustand's `persist` middleware to store data in `localStorage`.

### Shape

```ts
interface UserState {
    // Per-station progress and visibility
    stationLevels: Record<string, number>; // stationId -> current level
    hiddenStations: Record<string, boolean>; // stationId -> hidden?

    // Checklist view options
    checklistViewMode: "all" | "nextLevel";
    showHidden: boolean; // include hidden stations in pooled items
    hideCheap: boolean; // filter out cheap items
    cheapPriceThreshold: number; // e.g. in roubles

    // Actions
    setStationLevel: (stationId: string, level: number) => void;
    incrementStationLevel: (stationId: string) => void;
    toggleHiddenStation: (stationId: string) => void;

    setChecklistViewMode: (mode: "all" | "nextLevel") => void;
    setShowHidden: (value: boolean) => void;
    setHideCheap: (value: boolean) => void;
    setCheapPriceThreshold: (value: number) => void;

    // Initialization helpers
    initializeDefaults: (stations: Station[]) => void;
}
```

### Responsibilities

-   Persist user progress between sessions.
-   Control which stations are currently relevant (hidden vs visible).
-   Control checklist filters.

`initializeDefaults` can:

-   Set all station levels to `0` (unbuilt) on first visit.
-   Set stash station to a chosen starting level (1–4) if desired.

---

## Derived Selectors / Queries

Rather than pushing all logic into components, define a few reusable helpers/hooks on top of the stores.

### `useStationProgress(stationId)`

-   Returns:

```ts
{
    currentLevel: number;
    nextLevel: StationLevel | null;
    isHidden: boolean;
}
```

-   Uses `stations` from `useDataStore` and `stationLevels` / `hiddenStations` from `useUserStore`.

### `usePooledItems()`

Core selector for the Item Checklist page. Computes the pooled list of required items according to the current filters.

#### Input State

-   From `useDataStore`:
    -   `stations`
    -   `prices`
-   From `useUserStore`:
    -   `stationLevels`
    -   `hiddenStations`
    -   `checklistViewMode`
    -   `showHidden`
    -   `hideCheap`
    -   `cheapPriceThreshold`

#### Algorithm (Conceptual)

1. If `stations` is null, return empty list.
2. For each station in `stations`:
    - Let `currentLevel = stationLevels[station.id] ?? 0`.
    - If `hiddenStations[station.id] === true` and `showHidden === false`, **skip** this station.
3. Depending on `checklistViewMode`:
    - **`'all'`**:
        - Consider all levels with `level > currentLevel`.
    - **`'nextLevel'`**:
        - Consider only the level with `level === currentLevel + 1` (if it exists).
4. Collect all `itemRequirements` from the chosen levels:
    - Compute quantity per requirement from `count`/`quantity`.
    - Accumulate into a map: `itemId -> { item, totalQuantity, usedIn: [...] }`.
5. If `hideCheap` is true and prices are available:
    - For each item, look up `prices[itemId]`.
    - If `price < cheapPriceThreshold`, exclude it from the final list.
6. Return an array of pooled items sorted as desired (e.g. by name, category, or price).

#### Output Type

```ts
interface PooledItem {
    item: StationLevel["itemRequirements"][number]["item"];
    totalQuantity: number;
    price?: ItemPrice;
    usedIn: Array<{
        stationId: string;
        stationName: string;
        level: number;
        requirementId: string;
    }>;
}
```

### `useHideoutOverview()` (Optional)

-   Returns data ready for the Hideout page:

```ts
{
    stations: Array<{
        station: Station;
        currentLevel: number;
        nextLevel: StationLevel | null;
        isHidden: boolean;
    }>;
}
```

-   Allows the Hideout page to be a thin presentational layer.

---

## Persistence Details

-   Use `zustand/persist` with `localStorage` for `useUserStore`.
-   Keep `useDataStore` **non-persisted**; it’s safe to refetch on reload from `/api`.

Example persist config (conceptually):

```ts
const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            /* initial state & actions */
        }),
        {
            name: "tarkov-hideout-user-state",
            version: 1,
        }
    )
);
```

This gives you a clear separation between server-sourced data and local user decisions.
