# State Management

Client-side state lives in two Zustand stores. Server-fetched data (stations, items, market prices) is **not** stored in Zustand — it is passed down via React context from server components in the `(data)` route group. See `data-and-price-context-architecture.md`.

---

## `useUserStore` — User Progress & Preferences

**File:** `src/lib/stores/useUserStore.ts`
**Persisted:** Yes — localStorage key `tarkov-hideout-user-state`, version 2 (with migration from v1).

### State Shape

```ts
// Progress
stationLevels: Record<string, number>;          // stationId → current level (0 = unbuilt)
hiddenStations: Record<string, boolean>;         // stationId → excluded from pooled counts
completedRequirements: Record<string, boolean>;  // requirementId → manually ticked off

// Inventory
itemCounts: Record<string, { have: number; haveFir: number }>; // itemId → owned counts

// Checklist view options
checklistViewMode: "all" | "nextLevel";  // all future levels vs only next level per station
showHidden: boolean;                     // include hidden stations in pooled items
hideCheap: boolean;                      // filter items below cheapPriceThreshold
hideMoney: boolean;                      // filter currency items
showFirOnly: boolean;                    // show only FiR-required items
hideRequirements: boolean;               // collapse requirements section
cheapPriceThreshold: number;             // roubles (default 5000)
sellToPreference: "best" | "flea" | "trader";
useCategorization: boolean;

// View options
hideoutCompactMode: boolean;
itemsSize: "Icon" | "Compact" | "Expanded";

// Onboarding / feature flags
hasSeenItemConversionModal: boolean;
hasSeenHideoutLevelWarning: boolean;

// Game settings
gameEdition: GameEdition | null;   // null until setup is completed
gameMode: "PVP" | "PVE";           // controls which market price bucket is used
hasCompletedSetup: boolean;
isSetupOpen: boolean;
editionBonusesAppliedFor: GameEdition | null; // tracks which edition bonuses have been applied
```

### Key Types

```ts
type GameEdition =
    | "Standard"
    | "Left Behind"
    | "Prepare for Escape"
    | "Edge of Darkness"
    | "Unheard";

type GameMode = "PVP" | "PVE";
type ItemSize = "Icon" | "Compact" | "Expanded";
```

### Key Actions

| Action | Effect |
|---|---|
| `setStationLevel(id, level)` | Set a station to a specific level |
| `incrementStationLevel(id)` | Advance a station by one level |
| `toggleHiddenStation(id)` | Toggle hidden flag for a station |
| `toggleRequirement(reqId)` | Manually tick/untick a single requirement |
| `addItemCounts(itemId, haveDelta, haveFirDelta)` | Add to owned inventory counts |
| `applyEditionBonuses(stations)` | Set starting Stash/Cultist levels based on `gameEdition`; no-ops if already applied for this edition |
| `initializeDefaults(stations)` | Seed `stationLevels` to 0 for new stations; enforce minimum stash/cultist levels for the edition |
| `importStationLevels(levels)` | Bulk-overwrite station levels (used by import feature) |
| `resetAll()` | Reset all state to defaults (clears progress, settings, setup) |

### Edition Bonus Logic (`applyEditionBonuses`)

| Edition | Stash level | Cultist Circle level |
|---|---|---|
| Standard | 1 | 0 |
| Left Behind | 2 | 0 |
| Prepare for Escape | 3 | 0 |
| Edge of Darkness | 4 | 0 |
| Unheard | 4 | 1 (min) |

---

## `useUIStore` — Ephemeral UI State

**File:** `src/lib/stores/useUIStore.ts`
**Persisted:** No — resets on every page load.

### State Shape

```ts
isQuickAddOpen: boolean;
pendingQuickAddItems: PendingItem[];

interface PendingItem {
    tempId: string;
    item: ItemDetails;
    nonFir: number;
    fir: number;
}
```

### Actions

| Action | Effect |
|---|---|
| `setQuickAddOpen(bool)` | Open/close the Quick Add modal |
| `setPendingQuickAddItems(items)` | Set the list of items staged in the modal |
| `clearPendingQuickAddItems()` | Empty the staged list (called on commit or cancel) |

---

## React Contexts — Server-Fetched Data

Data from external APIs is **not** in Zustand. It is fetched server-side and distributed via two contexts:

### `DataContext` (`src/app/(data)/_dataContext.tsx`)

Provided by `(data)/layout.tsx`. Contains:

```ts
stations: Station[] | null;
stationsUpdatedAt: number | null;
items: ItemDetails[] | null;
itemsUpdatedAt: number | null;
```

Usage: `const { stations, items } = useDataContext();`

### `PriceDataContext` (`src/app/(data)/_priceDataContext.tsx`)

Provided by `PriceDataLayout.tsx` (wrapped in `<Suspense>`). Contains:

```ts
marketPricesByMode: Record<GameMode, {
    prices: Record<string, MarketPrice | null>;
    updatedAt: number | null;
}>;
loading: boolean;
```

Usage:
```ts
const { marketPricesByMode, loading } = usePriceDataContext();
const { gameMode } = useUserStore();
const prices = marketPricesByMode[gameMode].prices;
const itemPrice = prices[item.normalizedName];
```

---

## Separation of Concerns

| Concern | Where it lives |
|---|---|
| Station/level/requirement progress | `useUserStore` (localStorage) |
| Inventory item counts | `useUserStore` (localStorage) |
| View filters and preferences | `useUserStore` (localStorage) |
| Game edition / mode setup | `useUserStore` (localStorage) |
| Quick Add modal + staged items | `useUIStore` (in-memory) |
| Hideout stations + required items | `DataContext` (server → context) |
| Market prices (PVP + PVE) | `PriceDataContext` (server → context) |
| Quest data + trader list | Server props to `QuestsClientPage` — no context or Zustand |
