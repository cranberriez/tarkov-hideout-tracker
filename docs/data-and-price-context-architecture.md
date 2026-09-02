# Data & Item Pricing Architecture

The shared data layout loads hideout stations and the complete compact standard
item catalog for the active game mode. Both arrays are exposed through
`DataContext`; the browser derives the item lookup locally so no `Map` or repeated
item records are serialized by the server.

## Data flow

```text
Tarkov.dev JSON /{mode}/items + /{mode}/items_en
  -> getGlobalItemList(mode)
  -> compact GlobalItem[]
  -> (data)/layout.tsx
  -> DataContext
       items: GlobalItem[]
       itemById: Record<itemId, GlobalItem> (memoized on the client)

Tarkov.dev JSON /{mode}/hideout
  -> stations with { itemId, count, isFir, isTool } requirements
  -> components join itemById only when rendering
```

The active profile selects `regular`, `pve`, or `pvp-season`. Changing profiles
updates the mode cookie and refreshes server-rendered data. Catalog, stations,
quests, barters, and crafts are mode-isolated.

## Global catalog

`getGlobalItemList()` is the only owner of standard `/items` records. It maps each
record once into the allowlisted `GlobalItem` shape and does not import quest,
hideout, barter, or craft data. The catalog therefore includes standard items
whether or not they are currently required.

Quest-specific pickup/find records from `tasks.questItems` are not catalog items.
They remain compact inline `QuestSpecificItem` presentation and never enter item
search, inventory counts, Quick Add, market data, acquisition lookups, or the
generic item modal.

## Item pricing

Current flea and trader-sale values come from the same mode-specific `/items`
record as item metadata. `GlobalItem.marketPrice` retains only fields used by the
UI:

```ts
{
  avg24hPrice?: number | null;
  high24hPrice?: number | null;
  low24hPrice?: number | null;
  lastLowPrice?: number | null;
  lastOfferCount?: number | null;
  changeLast48hPercent?: number | null;
  updatedAt?: number | null;
  sellFor?: Array<{
    vendor: VendorSummary;
    price?: number;
    currency?: string;
    priceRUB: number;
  }>;
}
```

Trader offers retain both their original amount/currency and their rouble-converted
value. Profit calculations compare offers in roubles while the UI can display the
currency the trader actually pays.

Consumers read `item.marketPrice` directly. There is no separate price context,
daily price cron, or market-price Redis namespace. Historical prices are fetched
only when the modal's History tab needs `/api/items/{itemId}/price-history`.

## Acquisition data

Barters and crafts are not embedded in catalog items. Their normalized, ID-based
indexes are cached independently in Redis. Opening a standard item's modal lazily
requests `/api/items/{itemId}/usage?mode=...`; the response contains only barters
offering that item, crafts producing it, and their matched trader/task-unlock
presentation. Ingredient presentation is joined through `itemById` in the browser.

Barter and craft failures are independent and optional. A failure in either
domain does not prevent the catalog, station data, quest data, inventory, prices,
or the other acquisition domain from rendering.

## DataContext contract

`src/app/(data)/_dataContext.tsx` exposes:

```ts
interface DataContextValue {
  stations: Station[] | null;
  stationsUpdatedAt: number | null;
  stationsError: string | null;
  stationsDiagnostics: DataResponseDiagnostics | null;
  items: GlobalItem[] | null;
  itemById: Readonly<Record<string, GlobalItem>>;
  itemsUpdatedAt: number | null;
  itemsError: string | null;
  itemsDiagnostics: DataResponseDiagnostics | null;
}
```

`items` is serialized from the server; `itemById` is memoized by `DataProvider`.
Station and quest structures store standard-item IDs rather than item copies.
