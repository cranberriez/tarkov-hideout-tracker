# Data and Price Context Architecture (Planned)

This document describes the **target architecture** for how hideout/items data and
market price data should be fetched and exposed to the app using **server-side
contexts** and **Next.js App Router** patterns.

It is intended as a guide for future implementation and refactors.

---

## Goals

- **Server-only data fetching** for large datasets and market prices.
- **No public API routes** for hideout/items/price data that could expose
  external API access to the public.
- **Separation of concerns**:
  - Core hideout + items data is required for almost every view.
  - Market prices are **nice-to-have** and can arrive slightly later.
- **Suspense-friendly** design so that price data can be streamed lazily
  without blocking initial render of the main UI.

---

## High-Level Design

The architecture is built around **two server-backed React contexts**:

1. **Core Data Context** (`DataContext`)
   - Holds static/semi-static data:
     - Hideout stations
     - Required items
     - Timestamps for when that data was last updated
   - Provided by `(data)/layout.tsx` as a server component.

2. **Price Data Context** (`PriceDataContext`)
   - Holds dynamic market data:
     - PVP + PVE market prices grouped by `GameMode`
     - A `loading` flag indicating whether prices have been resolved yet
   - Provided by a separate async server component (e.g. `PriceDataLayout`),
     wrapped in a **`<Suspense>` boundary** so that it can resolve and stream
     later than the core data.

Both contexts are implemented as **client components** that internally use
`createContext` / `useContext`, but are composed by **server components**.

---

## 1. Core Data Context

### Shape

```ts
// app/(data)/_dataContext.tsx
"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { Station, ItemDetails } from "@/types";

export interface DataContextValue {
  stations: Station[] | null;
  stationsUpdatedAt: number | null;
  items: ItemDetails[] | null;
  itemsUpdatedAt: number | null;
}

const DataContext = createContext<DataContextValue | null>(null);

interface DataProviderProps {
  value: DataContextValue;
  children: ReactNode;
}

export function DataProvider({ value, children }: DataProviderProps) {
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useDataContext(): DataContextValue {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useDataContext must be used within DataLayout DataContext.Provider");
  }
  return ctx;
}
```

### Data Fetching

Core data is loaded via **server services** with `unstable_cache` wrappers:

- `getCachedHideoutStations()` in `src/server/services/hideout.ts`
- `getCachedHideoutRequiredItems()` in `src/server/services/items.ts`

These functions:

- Wrap lower-level Redis/API calls.
- Use `unstable_cache` to apply ISR-like behavior (`revalidate` windows).

### Composition in `(data)/layout.tsx`

```tsx
// app/(data)/layout.tsx
import type { ReactNode } from "react";
import { getCachedHideoutStations } from "@/server/services/hideout";
import { getCachedHideoutRequiredItems } from "@/server/services/items";
import { DataProvider, type DataContextValue } from "@/app/(data)/_dataContext";
import { QuickAddModal } from "@/features/quick-add/QuickAddModal";

interface DataLayoutProps {
  children: ReactNode;
}

export default async function DataLayout({ children }: DataLayoutProps) {
  const [stationsResponse, itemsResponse] = await Promise.all([
    getCachedHideoutStations(),
    getCachedHideoutRequiredItems(),
  ]);

  const value: DataContextValue = {
    stations: stationsResponse.data.stations,
    stationsUpdatedAt: stationsResponse.updatedAt,
    items: itemsResponse.data.items,
    itemsUpdatedAt: itemsResponse.updatedAt,
  };

  return (
    <DataProvider value={value}>
      {children}
      <QuickAddModal />
    </DataProvider>
  );
}
```

All hideout/items-related client components live somewhere under this `(data)`
segment and consume via `useDataContext()`.

---

## 2. Price Data Context (Planned)

### Goals for Price Context

- Use the **same pattern** as core data:
  - Server services with `unstable_cache` for market prices.
  - A React context for consumption.
- But **do not block** the initial render of hideout/items views.
- Allow the initial shell to render and then **stream price data later**.

### Context Shape

```ts
// app/(data)/_priceDataContext.tsx
"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";
import type { MarketPrice } from "@/types";
import type { GameMode } from "@/lib/stores/useUserStore";

export interface PriceDataContextValue {
  marketPricesByMode: Record<
    GameMode,
    {
      prices: Record<string, MarketPrice | null>;
      updatedAt: number | null;
    }
  >;
  loading: boolean;
}

const PriceDataContext = createContext<PriceDataContextValue | null>(null);

interface PriceDataProviderProps {
  value: PriceDataContextValue;
  children: ReactNode;
}

export function PriceDataProvider({ value, children }: PriceDataProviderProps) {
  return <PriceDataContext.Provider value={value}>{children}</PriceDataContext.Provider>;
}

export function usePriceDataContext(): PriceDataContextValue {
  const ctx = useContext(PriceDataContext);
  if (!ctx) {
    throw new Error("usePriceDataContext must be used within PriceDataLayout PriceDataContext.Provider");
  }
  return ctx;
}
```

### Server Service for Market Prices

Market prices are fetched via a server service in
`src/server/services/marketPrices.ts`, with a concurrency limit and
`unstable_cache`:

- `getMarketPrices(normalizedNames: string[], gameMode: GameMode)`
  - Dedupes/sanitizes `normalizedNames`.
  - Fetches data from Tarkov Market with a **batch-based concurrency limit**
    (e.g. `MARKET_PRICE_BATCH_SIZE = 5`) to avoid rate limiting.
- `getCachedMarketPrices(normalizedNames, gameMode)`
  - Wraps `getMarketPrices` with `unstable_cache`.
  - Uses `revalidate: 5 * 60` (5 minutes) to control refresh cadence.

### Price Data Layout (Server Component)

A dedicated server component, e.g. `app/(data)/PriceDataLayout.tsx`, will:

1. Read the set of items (or their normalized names) to price.
2. Call `getCachedMarketPrices` for both `"PVP"` and `"PVE"`.
3. Populate `PriceDataProvider`.

```tsx
// app/(data)/PriceDataLayout.tsx
import type { ReactNode } from "react";
import { getCachedHideoutRequiredItems } from "@/server/services/items";
import { getCachedMarketPrices } from "@/server/services/marketPrices";
import { PriceDataProvider, type PriceDataContextValue } from "@/app/(data)/_priceDataContext";

interface PriceDataLayoutProps {
  children: ReactNode;
}

export default async function PriceDataLayout({ children }: PriceDataLayoutProps) {
  // Reuse cached items to derive normalized names
  const itemsResponse = await getCachedHideoutRequiredItems();
  const items = itemsResponse.data.items;

  const normalizedNames = items
    .map((item) => item.normalizedName)
    .filter((name) => typeof name === "string" && name.trim().length > 0);

  let marketPricesByMode: PriceDataContextValue["marketPricesByMode"] = {
    PVP: { prices: {}, updatedAt: null },
    PVE: { prices: {}, updatedAt: null },
  };

  let loading = true;

  if (normalizedNames.length > 0) {
    const [pvpPricesResponse, pvePricesResponse] = await Promise.all([
      getCachedMarketPrices(normalizedNames, "PVP"),
      getCachedMarketPrices(normalizedNames, "PVE"),
    ]);

    marketPricesByMode = {
      PVP: {
        prices: pvpPricesResponse.data,
        updatedAt: pvpPricesResponse.updatedAt,
      },
      PVE: {
        prices: pvePricesResponse.data,
        updatedAt: pvePricesResponse.updatedAt,
      },
    };

    loading = false;
  }

  const value: PriceDataContextValue = {
    marketPricesByMode,
    loading,
  };

  return <PriceDataProvider value={value}>{children}</PriceDataProvider>;
}
```

### Integrating PriceDataLayout with DataLayout via Suspense

The `(data)/layout.tsx` will wrap children with both contexts, using
`<Suspense>` for the price layer:

```tsx
// app/(data)/layout.tsx
import { Suspense } from "react";
import type { ReactNode } from "react";
import { getCachedHideoutStations } from "@/server/services/hideout";
import { getCachedHideoutRequiredItems } from "@/server/services/items";
import { DataProvider, type DataContextValue } from "@/app/(data)/_dataContext";
import PriceDataLayout from "@/app/(data)/PriceDataLayout";
import { QuickAddModal } from "@/features/quick-add/QuickAddModal";

interface DataLayoutProps {
  children: ReactNode;
}

export default async function DataLayout({ children }: DataLayoutProps) {
  const [stationsResponse, itemsResponse] = await Promise.all([
    getCachedHideoutStations(),
    getCachedHideoutRequiredItems(),
  ]);

  const value: DataContextValue = {
    stations: stationsResponse.data.stations,
    stationsUpdatedAt: stationsResponse.updatedAt,
    items: itemsResponse.data.items,
    itemsUpdatedAt: itemsResponse.updatedAt,
  };

  return (
    <DataProvider value={value}>
      <Suspense fallback={null /* or a prices skeleton */}>
        <PriceDataLayout>
          {children}
          <QuickAddModal />
        </PriceDataLayout>
      </Suspense>
    </DataProvider>
  );
}
```

Behavior:

- **Stations/items** are fetched and awaited first, then provided via `DataProvider`.
- Everything inside the `Suspense` boundary (i.e. `PriceDataLayout` and its
  children) will only render once price data is ready, or will initially show
  the `fallback` until prices resolve.
- You can refine this later to allow some parts of the tree to render even
  before prices are ready by using more granular Suspense boundaries.

---

## 3. Client Usage Patterns

### Reading Core Data

Client components that need stations/items:

```ts
import { useDataContext } from "@/app/(data)/_dataContext";

const { stations, items, stationsUpdatedAt, itemsUpdatedAt } = useDataContext();
```

### Reading Prices with Loading State

Client components that need prices also read from the price context and the
user's `gameMode`:

```ts
import { usePriceDataContext } from "@/app/(data)/_priceDataContext";
import { useUserStore } from "@/lib/stores/useUserStore";

const { marketPricesByMode, loading } = usePriceDataContext();
const { gameMode } = useUserStore();
const mode = gameMode === "PVE" ? "PVE" : "PVP";
const priceBucket = marketPricesByMode[mode];

const getPrice = (normalizedName: string) => priceBucket?.prices[normalizedName];

// Example usage in UI:
const marketPrice = getPrice(item.normalizedName);

if (loading && !marketPrice) {
  // show skeleton or "..."
}

if (!loading && !marketPrice) {
  // show "-" or some fallback indicating no price
}
```

This pattern should be used in components like:

- `ItemsList` (for cheap-item filtering, etc.)
- `ItemRow` (estimated cost)
- `ItemDetailModal` (detailed market info)

Each of these should:

- Remove any direct dependence on `usePriceStore` or `/api/market/...` routes.
- Rely entirely on `usePriceDataContext` + `useUserStore`.

---

## 4. What Needs to Be Updated (Checklist)

When fully adopting this architecture, the following steps should be taken:

1. **Data Services**
   - [x] Ensure `getCachedHideoutStations` and `getCachedHideoutRequiredItems` use `unstable_cache`.
   - [x] Implement `getMarketPrices` with controlled concurrency.
   - [x] Implement `getCachedMarketPrices` with `unstable_cache` and appropriate `revalidate`.

2. **Contexts**
   - [x] Implement `DataContext` as shown above.
   - [ ] Implement `PriceDataContext` with `marketPricesByMode` and `loading`.

3. **Layouts**
   - [x] Implement `(data)/layout.tsx` to provide `DataContext` for core data.
   - [ ] Implement `PriceDataLayout` to fetch prices and provide `PriceDataContext`.
   - [ ] Wrap `PriceDataLayout` in a `<Suspense>` boundary inside `(data)/layout.tsx`.

4. **Client Components**
   - [ ] Refactor `ItemsList` to:
     - Use `useDataContext` for items/stations.
     - Use `usePriceDataContext` for prices.
     - Drop any client-side fetching of prices.
   - [ ] Refactor `ItemRow` to use `usePriceDataContext` and `useUserStore` for prices.
   - [ ] Refactor `ItemDetailModal` to use `usePriceDataContext` and `useUserStore`.

5. **Legacy Cleanup**
   - [ ] Remove `usePriceStore` and any price-related API routes under `app/api/market`.
   - [ ] Verify no remaining dependencies on the old Zustand data store for
         stations/items/price data.

---

## 5. Notes and Extensions

- This design keeps all heavy data fetching on the **server**, but still allows
  the UI to be responsive via **Suspense streaming**.
- If needed, the price layer can later be split further (e.g. only fetch PVP by
  default, fetch PVE lazily upon mode switch) without changing the overall
  context pattern.
- The `loading` flag in `PriceDataContext` gives components a robust way to
  distinguish between:
  - "Still loading prices for this session" vs
  - "Loaded, but this specific item has no price data".
