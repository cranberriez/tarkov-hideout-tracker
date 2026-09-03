# Data and Price Delivery Architecture

Server data is delivered through explicit repositories, named queries, and
route-scoped contracts. There is no global data React context and the `(data)`
layout does not load entity arrays.

## Layers

```text
Tarkov.dev JSON -> offline adapters -> immutable Turso release
                                      -> TursoTarkovDataRepository
                                      -> page queries -> route-scoped contracts
                                      -> bounded API responses

Tarkov.dev price history -> on-demand price-history route
```

The Turso repository is selected lazily by `query-utils.ts`. Pages and features
must not import it directly. Queries must not import concrete provider services.

## Route-scoped reads

- `/hideout` requests stations, the unique item IDs referenced by them, and prices
  for those IDs.
- `/items` requests stations and quests independently, derives checklist demand,
  and requests only demand item summaries and prices. Quest rewards are not part
  of checklist demand and are not included solely for the modal.
- `/quests` requests full display quests and only the item summaries referenced by
  those delivered quests. Item-detail indexes are not serialized with the page.
- Profit pages request both recipe graphs, their referenced items/prices, and
  compact trader/station source presentation. Full station levels and requirements
  are not sent.
- Kappa requests the mode-specific Collector quest and only its hand-in item IDs.

Clients may memoize a local `itemById` record from their route's `ItemSummary[]`.
Each summary may contain its mode-specific `marketPrice`; no separate price
context or client price store exists.

## Lazy reads

Catalog-wide search uses `/api/items/search`. Quick Add requests at most 10
results. The checklist search requests at most 50 results, with starts-with
matches first and alphabetical ordering inside each priority group. Search reads
the compact, release-scoped Turso index rather than loading the item catalog.

The shared item modal receives only an item summary and open state. Its controller
loads the selected item's relations, direct usage, and bounded recursive
acquisition tree from endpoint-ready Turso records. Price history stays an
on-demand provider request. Navigation between related items stays inside that
controller. Complete responses may be cached in memory; partial responses remain
retryable.

## Partial failures and missing IDs

Repository batch methods return records keyed by ID, deduplicate requests, and
omit missing records. Query contracts report missing IDs in
`unresolvedItemIds`—consumers must not interpret absence as satisfaction.

Barter and craft sources settle independently in queries. The item modal can show
the successful domain with an explicit warning. Profit pages require both graphs
because recursive costs may cross domains, so either recipe error blocks profit
figures. Missing Kappa items remain in the checklist denominator.

## Persistence boundary

This delivery architecture does not change player-owned Zustand data. The
`useUserStore` and `useKappaStore` storage keys, versions, persisted fields, and
migration behavior remain unchanged. `useUIStore` is ephemeral and is not part of
the persisted-state freeze.
