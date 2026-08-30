# Data & Price Context Architecture

This document describes how hideout/items data and market price data are fetched and exposed to the app using server-side services, React contexts, and Next.js App Router patterns.

**Status: Fully implemented.** The pattern described here is the current production architecture.

---

## Goals

- **Server-only data fetching** — no public API routes for hideout/items/prices that would expose external API access.
- **Separation of concerns** — core station/item data vs. market prices.
- **Suspense-friendly** — price data streams in without blocking initial render of the main UI.

---

## High-Level Design

Two server-backed React contexts distribute data to client components:

1. **`DataContext`** — static/semi-static data (stations, items). Provided by `(data)/layout.tsx`, blocking.
2. **`PriceDataContext`** — dynamic market prices (PVP + PVE + KORD). Provided by `PriceDataLayout.tsx`, wrapped in `<Suspense>`.

Both contexts are client components (they use `createContext`/`useContext`), but they are composed by server components that do the actual fetching.

---

## 1. Core Data Context

**File:** `src/app/(data)/_dataContext.tsx`

```ts
interface DataContextValue {
  stations: Station[] | null;
  stationsUpdatedAt: number | null;
  stationsError: string | null;
  stationsDiagnostics: DataResponseDiagnostics | null;
  items: ItemDetails[] | null;
  itemsUpdatedAt: number | null;
  itemsError: string | null;
  itemsDiagnostics: DataResponseDiagnostics | null;
}
```

**Hook:** `useDataContext()` — throws if used outside a `DataProvider`.

**Provided by:** `src/app/(data)/layout.tsx`

```tsx
// (data)/layout.tsx (simplified)
const [stationsResponse, itemsResponse] = await Promise.all([
  getCachedHideoutStations(),
  getCachedHideoutRequiredItems(),
]);

return (
  <DataProvider value={{ stations, stationsUpdatedAt, items, itemsUpdatedAt }}>
    <Suspense fallback={null}>
      <PriceDataLayout>
        {children}
        <QuickAddModal />
      </PriceDataLayout>
    </Suspense>
  </DataProvider>
);
```

Station and item data is fetched before any child renders. All pages under `(data)/` can consume it via `useDataContext()`.

The layout settles station and item requests independently. A failed dataset is
provided as `null` with its corresponding error message instead of failing the
whole route. Feature pages render retryable data-error notices where unavailable
data would otherwise appear. The route group's `error.tsx` remains a final safety
net for page-specific server data and unexpected render failures.

Successful JSON refreshes also carry additive response diagnostics describing the
resolved locale dictionary paths and whether the regular-English fallback was
used. Older frozen cache entries remain valid and may omit these optional fields.
The footer status dialog reads these diagnostics, the active price context, and
the station/item timestamps without making additional upstream requests.

---

## 2. Price Data Context

**File:** `src/app/(data)/_priceDataContext.tsx`

```ts
interface PriceDataContextValue {
  marketPricesByMode: Record<GameMode, {
    prices: Record<string, MarketPrice | null>;  // keyed by normalizedName
    updatedAt: number | null;
  }>;
  loading: boolean;
}
```

**Hook:** `usePriceDataContext()` — throws if used outside a `PriceDataProvider`.

**Provided by:** `src/app/(data)/PriceDataLayout.tsx`

`PriceDataLayout` fetches `/api/prices/[mode]` for the active profile first, then prefetches the other two modes. It renders the results through `PriceDataProvider` without embedding the price maps in the server-component payload. Failed price requests resolve the loading state so price consumers do not remain in a permanent loading state.

---

## 3. Server Services

| Service | File | Cache |
|---|---|---|
| `getCachedHideoutStations()` | `src/server/services/hideout.ts` | Redis + Next.js 12h |
| `getCachedHideoutRequiredItems()` | `src/server/services/items.ts` | Redis + Next.js 12h |
| `getCachedAllMarketPrices(mode)` / `getCachedMarketPrices(names, mode)` | `src/server/services/marketPrices.ts` | Next.js 5min revalidate |

Market price data in Redis is written by the daily cron job (`refreshTarkovDevMarketPrices`), not by `getCachedMarketPrices`. The read service is effectively read-only with respect to Redis.

---

## 4. Client Usage

### Reading station/item data

```ts
import { useDataContext } from "@/app/(data)/_dataContext";

const { stations, items } = useDataContext();
```

### Reading market prices

```ts
import { usePriceDataContext } from "@/app/(data)/_priceDataContext";
import { useUserStore } from "@/lib/stores/useUserStore";

const { marketPricesByMode, loading } = usePriceDataContext();
const gameMode = useUserStore((s) => s.gameMode);
const prices = marketPricesByMode[gameMode].prices;

const itemPrice = prices[item.normalizedName]; // MarketPrice | null | undefined

// loading === true: prices not yet resolved (show skeleton)
// loading === false, itemPrice === null: no price data for this item (show "-")
```

Components using this pattern: `ItemsList`, `ItemRow`, `ItemDetailModal`, `StationCard`.

---

## 5. What Is NOT in This Architecture

- No Zustand store for server data (`useDataStore` from older designs no longer exists).
- No public `/api/hideout/stations` or `/api/items/prices` routes.
- No client-side fetching of prices from a public endpoint.
- No `usePriceStore` Zustand store.
