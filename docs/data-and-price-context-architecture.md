# Data & Item Pricing Architecture

Station and tracked-item data is fetched server-side and exposed through `DataContext`.
There is no separate client price request or price context.

## Data flow

```text
Tarkov.dev JSON /{mode}/items + /{mode}/items_en
  -> getJsonHideoutRequiredItems(mode)
  -> compact tracked ItemDetails[] (hideout + quest items)
  -> (data)/layout.tsx
       -> enriches station requirement items by item ID
       -> DataContext
            -> hideout, items, and quest item modals
```

The active profile selects `regular`, `pve`, or `pvp-season`. Changing profiles
updates the mode cookie and refreshes the server-rendered data.

## Item pricing

Flea and trader values come from the same Tarkov.dev JSON item record as the
item metadata. The normalized `ItemDetails` shape contains an optional
`marketPrice` object with:

```ts
{
  price?: number | null; // lastLowPrice compatibility alias
  avg24hPrice?: number | null;
  high24hPrice?: number | null;
  low24hPrice?: number | null;
  lastLowPrice?: number | null;
  lastOfferCount?: number | null;
  changeLast48h?: number | null;
  changeLast48hPercent?: number | null;
  diff24h?: number | null; // compatibility alias
  updatedAt?: number | null; // parsed from lastScan
  sellFor?: VendorPrice[]; // hydrated from sellToTrader
}
```

Consumers read `item.marketPrice` directly. The application does not maintain a
daily price cron, a price Redis namespace, `/api/prices/*`, or `PriceDataContext`.

Tracked items also carry compact `traderOffers` and `crafts` arrays joined from
the mode-specific Tarkov.dev `/barters` and `/crafts` datasets. Only offers and
recipes producing a tracked item are sent to the client. Flea price history is
separate: the item modal lazy-loads `/api/items/{itemId}/price-history`, which
proxies Tarkov.dev `/prices/{itemId}` with a 15-minute Next.js/HTTP cache and no
Redis storage.

## Caching

Tracked item records use the primary Next.js cache plus best-effort Redis with a
24-hour production freshness window and the `item-data` tag. Redis writes are
scheduled after the response. The raw
catalog remains server-side; only items referenced by active hideout or quest
data are sent to the browser.

## DataContext

`src/app/(data)/_dataContext.tsx` exposes:

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

`items` is the compact set of currently tracked hideout and quest items. Station
requirements are enriched from this set so item clicks from every page receive
the same metadata and price shape.
