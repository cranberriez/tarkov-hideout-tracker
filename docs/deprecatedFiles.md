# Deprecated Files and Paths

The following files are candidates for removal once all usages are fully migrated.
They are kept for now for reference and to avoid breaking changes.

- **Zustand data store for large SSR data**
  - `src/lib/stores/useDataStore.ts`
  - Originally used to hold hideout stations, items, and related large data on the client.
  - Replaced by server-fetched data via `DataLayout` and `DataContext`.

- **Bootstrap for legacy data store**
  - `src/components/core/AppBootstrap.tsx`
  - Responsible for hydrating `useDataStore` from server props.
  - No longer needed now that stations/items are provided via React context.

- **Market price Zustand store and API-based fetching**
  - `src/lib/stores/usePriceStore.ts`
  - Previously fetched prices via the `/api/market/items` route and cached them client-side.
  - Superseded by server-side fetching via `getCachedMarketPrices` and `DataContext.marketPricesByMode`.

- **Market price API routes (to be removed after full migration)**
  - Any routes under `src/app/api/market/` such as:
    - `src/app/api/market/items/route.ts`
  - These routes expose your Tarkov Market access over HTTP. Once all consumers
    read from `DataContext` instead of hitting these routes, they can be safely deleted.

- **Other legacy data paths**
  - Any components or utilities that depended on `useDataStore` for stations/items
    and have since been refactored to use `DataContext` only.
  - When you identify them as unused, add them here before deleting for easier tracking.
