# Architecture

The app tracks Escape from Tarkov hideout upgrades, inventory, quest progress,
and item requirements across independent PVP, PVE, and KORD profiles. It uses
Next.js App Router, React, TypeScript, Tailwind, Radix UI, Zustand, and Turso;
[package.json](../package.json) owns installed versions and commands.

## Routes and composition

| Route | Entry point and responsibility |
|---|---|
| `/` | [Redirect to Hideout](../src/app/page.tsx) |
| `/hideout` | [Hideout page](<../src/app/(data)/hideout/page.tsx>): next station upgrades |
| `/items` | [Items page](<../src/app/(data)/items/page.tsx>): pooled hideout and quest demand |
| `/quests` | [Quests page](<../src/app/(data)/quests/page.tsx>): workspace, details, visualizer, Raid Planner |
| `/items/kappa-checklist` | [Collector checklist](<../src/app/(data)/items/kappa-checklist/page.tsx>); see [quests](quests.md) |
| `/items/barter-profits`, `/items/crafting-profits` | Shared [ProfitPage](../src/features/profit-pages/ProfitPage.tsx); see [profits](profits.md) |
| `/settings` | [Character settings and reset controls](<../src/app/(data)/settings/page.tsx>); see [user state](user-state.md) |
| `/news` | [News page](../src/app/news/page.tsx) |
| `/dev` | [Development-only release inspector](../src/app/dev/page.tsx); see [operations](operations.md) |

Inventory, Keys, Station Goals, and Bitcoin Farm routes are placeholders. Check
their [route implementations](<../src/app/(data)/>) before extending them.
[Navbar](../src/components/core/Navbar.tsx) owns navigation. The
[(data) layout](<../src/app/(data)/layout.tsx>) supplies footer release metadata
and profile conversion UI, without loading entity arrays for descendants.

## Dependency direction

```text
offline source adapters -> immutable Turso release
server page -> named query -> repository -> targeted Turso reads
                          -> route contract -> client feature
client controller -> bounded API -> stored item view/search or explicit service
```

[Data layer](data-layer.md) owns the read matrix and its exceptions. Canonical
domain types live in [src/types](../src/types/); payloads crossing server/client
boundaries live in [contracts.ts](../src/types/contracts.ts). Domain types must
remain independent of UI, stores, and server implementations. Server modules do
not belong in client imports.

Substantial deterministic calculations belong in pure models with focused tests.
Controllers own requests and workflow effects; views own rendering and direct
interaction. Keep temporary selection/open state local to its consumer unless
multiple consumers need it. Reuse existing feature controllers and utilities
before introducing a new abstraction. [User state](user-state.md) owns the
separate browser-persistence boundary.

## Hideout and item demand

[HideoutList](../src/features/hideout/components/HideoutList.tsx) derives the next
upgrade from the active profile's station levels. Reviewed display ordering lives
in [stationOrder.ts](../src/lib/cfg/stationOrder.ts). Edition starting levels are
applied through setup/store actions; see [user state](user-state.md).

[item-pooling.ts](../src/lib/utils/item-pooling.ts) aggregates stable requirement
IDs and item IDs across remaining levels or just the next level. Hidden stations
and individually completed requirements affect demand. [item-needs.ts](../src/lib/utils/item-needs.ts)
computes outstanding counts against inventory. Missing item presentation must
remain an explicit unresolved requirement: it cannot enable an upgrade or discard
an ID-based refund.

[ItemsList](../src/features/items/components/ItemsList.tsx) combines hideout
requirements with [quest demand](quests.md), preserving each source's total and
FiR counts before filtering. Standard items resolve through the route's local
item index. Quest-only pickup items are display-only: they do not enter inventory,
search, Quick Add, pricing, or generic item details. Quest rewards are informational
and do not become checklist demand. Any-of groups must not double-count their
alternatives as individual requirements.

## Search, Quick Add, and item details

[useItemSearchController](../src/features/items/useItemSearchController.ts)
debounces and cancels bounded catalog searches. Checklist search requests up to
50 results, Quick Add up to 10; prefix matches precede other alphabetical matches.
The endpoint searches all standard catalog items, including those absent from
current checklist demand. Its database owner and validation are in [data layer](data-layer.md).

[QuickAddModal](../src/features/quick-add/QuickAddModal.tsx) keeps draft rows and
FiR/non-FiR additions locally, then commits inventory additions through store
actions. [useUIStore](../src/lib/stores/useUIStore.ts) coordinates its shared open
state and pending items.

[ItemDetailModal](../src/features/items/item-detail/ItemDetailModal.tsx) presents
the selected standard item. Its [modal controller](../src/features/items/item-detail/useItemDetailModalController.ts),
[request controller](../src/features/items/item-detail/useItemDetailRequestController.ts),
and [navigation controller](../src/features/items/item-detail/useItemDetailNavigationController.ts)
own lazy relations, usage, acquisition, history, and in-dialog navigation. Related
item navigation stays in the dialog; closing it clears session history. Loading,
empty, partial, and failed domains stay distinguishable. Only complete responses
enter the in-memory cache. Recipe calculations reuse the [profit engine](profits.md).

For changes here, run [page query tests](../src/server/queries/page-data-queries.test.ts),
[item detail tests](../src/features/items/item-detail/), and
[quest-item demand tests](../src/lib/utils/quest-item-index.test.ts) as applicable;
[operations](operations.md) gives runnable commands. Verify changed interactions
in the browser, including a mode switch and partial/missing-data states.
