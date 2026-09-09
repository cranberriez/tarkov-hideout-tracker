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
| `/hideout/craft-planner` | Station craft recommendations using the shared profit query; see [profits](profits.md) |
| `/settings` | [Player progression backups, import review, legacy tools and reset controls](<../src/app/(data)/settings/page.tsx>); see [user state](user-state.md) |
| `/news` | [News page](../src/app/news/page.tsx) |
| `/dev` | [Development-only release dashboard](../src/app/dev/page.tsx): history, shared pin/rollback and local preview; see [operations](operations.md) |

Inventory, Keys, Station Goals, and Bitcoin Farm routes are placeholders. Check
their [route implementations](<../src/app/(data)/>) before extending them.
[Navbar](../src/components/core/Navbar.tsx) owns navigation. The
[(data) layout](<../src/app/(data)/layout.tsx>) supplies footer release metadata
and profile conversion UI, without loading entity arrays for descendants.

[RouteLoader](../src/components/core/RouteLoader.tsx) owns the shared responsive
tan route card and green indeterminate bar for all page loading boundaries.
Its flex-growing frame fills the available space below the nav and above the
footer; Quests retains its footer-free workspace and uses the same loader for
its client Suspense boundary. The `page` prop selects Hideout, Quests, or Items
map motifs; `title` names the destination. Subpages have their own loading files
so Craft Profits, Barter Profits, and other destinations retain their labels
while sharing their parent motif. Settings, News, and Dev use the Hideout motif.
Animations respect reduced motion. The temporary `/loading` preview is removed.

## Theme and color roles

[globals.css](../src/app/globals.css) owns the documented application palette and
Tailwind color utilities. Use `brand` for navigation, selection and primary actions;
use the independent `success` role for completed/satisfied requirements and positive
results. They currently share a pigment, but changing `--brand` must not recolor
success states. To try the retained Settings tan, set `--brand` to
`var(--accent-alternate)`; its hover color derives automatically.

Use the documented neutral surface/text hierarchy and `warning`, `danger`, `info`
and `special` roles instead of named Tailwind palettes or local color literals.
Opacity, `color-mix`, `transparent` and `currentColor` are supported variations.
Charts and objective groups use the documented chart palette; map navigation has
separate extract/transit aliases. The route loading illustration keeps its artwork
colors. [Profile colors](../src/lib/cfg/profile-colors.ts) separately own the three
PVE/PVP/seasonal identity pigments; UI derives their tints through a local CSS
property. External item images and map artwork retain their source pixels.

`npm run test:theme` checks application source for palette drift. New color roles
belong in globals with a purpose before use in a component.

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

[Filter bar UI kit](../src/components/ui/filter-bar.tsx) provides the shared bar,
panel trigger/panel, search input, native single-select radio groups, toggle
buttons, and panel sections. [FilterCheckbox](../src/components/ui/FilterCheckbox.tsx)
and [FilterNumberInput](../src/components/ui/FilterNumberInput.tsx) supply panel
inputs. These controlled components own presentation and accessibility; consumers
own state, labels, options, and effects. [ItemsControls](../src/features/items/components/ItemsControls.tsx)
wires them to existing preferences without changing persistence. Panel triggers
expose expanded state; radios support arrow keys, toggles expose pressed state,
and Escape from the checklist panel closes it and returns focus to its trigger.

Checklist search is a local, non-persisted input. It filters visible rows and
quest groups by standard item name, short name, or normalized name, matching all
case-insensitive whitespace-separated terms. [Checklist search](../src/features/items/checklist-search.ts)
also searches all referenced standard items in the selected All/Hideout/Quests
source, independently of progression and other filters. Matches absent from visible
rows/groups appear under **Outside current filters**, including past/future
requirements, as detail links without adding demand counts. Group alternatives
remain grouped and are not duplicated in the extra results. Missing item IDs are
reported explicitly while searching. This uses the current route's mode-specific
item index without catalog requests or shared-layout preloads.

[ItemSearchModal](../src/features/items/components/ItemSearchModal.tsx) is retained
as a catalog search palette for future site-wide placement, detached from the
checklist. Its [useItemSearchController](../src/features/items/useItemSearchController.ts)
debounces and cancels bounded catalog searches. The palette requests up to 50
results, Quick Add up to 10; prefix matches precede other alphabetical matches.
The endpoint searches all standard catalog items, including those absent from
checklist demand. Its database owner and validation are in [data layer](data-layer.md).

[QuickAddModal](../src/features/quick-add/QuickAddModal.tsx) keeps draft rows and
FiR/non-FiR additions locally, then commits inventory additions through store
actions. [useUIStore](../src/lib/stores/useUIStore.ts) coordinates its shared open
state and pending items.

[ItemDetailModal](../src/features/items/item-detail/ItemDetailModal.tsx) presents
the selected standard item. Page consumers enter through
[LazyItemDetailModal](../src/features/items/item-detail/LazyItemDetailModal.tsx),
which downloads the detail UI only when opened and shows a dismissible loading
card with the item image and an indeterminate bar while the code and initial
relations/usage requests arrive. The card has an explicit compact width, then
expands to the full dialog; request failures reveal the existing error UI and
profit requests keep their own loading states. Motion respects reduced-motion
preferences. Its [modal controller](../src/features/items/item-detail/useItemDetailModalController.ts),
[request controller](../src/features/items/item-detail/useItemDetailRequestController.ts),
and [navigation controller](../src/features/items/item-detail/useItemDetailNavigationController.ts)
own lazy relations, usage, acquisition, history, and in-dialog navigation. Related
item navigation stays in the dialog; closing it clears session history. Loading,
empty, partial, and failed domains stay distinguishable. The usage tab bar remains
fixed while its content panel scrolls independently with a 700px maximum height;
the wider desktop modal does not scroll the sidebar and tabs as one region. Only
complete responses enter the in-memory cache. Recipe calculations reuse the
[profit engine](profits.md).

For changes here, run [page query tests](../src/server/queries/page-data-queries.test.ts),
[item detail tests](../src/features/items/item-detail/), and
[quest-item demand tests](../src/lib/utils/quest-item-index.test.ts) as applicable;
[operations](operations.md) gives runnable commands. Verify changed interactions
in the browser, including a mode switch and partial/missing-data states.
