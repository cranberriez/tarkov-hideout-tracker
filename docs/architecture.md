# Architecture

The app tracks Escape from Tarkov hideout upgrades, inventory, quest progress,
and item requirements across independent PVP, PVE, and KORD profiles. It uses
Next.js App Router, React, TypeScript, Tailwind, Radix UI, Zustand, and PostgreSQL;
[package.json](../package.json) owns installed versions and commands.

## Routes and composition

| Route                                              | Entry point and responsibility                                                                                                                                                                                                                        |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`                                                | [Redirect to Hideout](../src/app/page.tsx)                                                                                                                                                                                                            |
| `/hideout`                                         | [Hideout page](<../src/app/(data)/hideout/page.tsx>): next station upgrades                                                                                                                                                                           |
| `/items`                                           | [Items page](<../src/app/(data)/items/page.tsx>): pooled hideout and quest demand                                                                                                                                                                     |
| `/quests`, `/quests/[questId]`                     | [Quests layout](<../src/app/(data)/quests/layout.tsx>) owns the persistent workspace; the [index](<../src/app/(data)/quests/page.tsx>) and [quest route](<../src/app/(data)/quests/[questId]/page.tsx>) fill its detail pane; see [quests](quests.md) |
| `/items/[itemId]`                                  | [Item page](<../src/app/(data)/items/[itemId]/page.tsx>): server-rendered item details; not linked yet (items open the dialog)                                                                                                                        |
| `/hideout/stations/[stationId]`                    | [Station page](<../src/app/(data)/hideout/stations/[stationId]/page.tsx>): all levels, dependencies, and on-demand crafts from the Hideout query                                                                                                      |
| `/items/kappa-checklist`                           | [Collector checklist](<../src/app/(data)/items/kappa-checklist/page.tsx>); see [quests](quests.md)                                                                                                                                                    |
| `/items/barter-profits`, `/items/crafting-profits` | Shared [ProfitPage](../src/features/profit-pages/ProfitPage.tsx); see [profits](profits.md)                                                                                                                                                           |
| `/hideout/craft-planner`                           | Station craft recommendations using the shared profit query; see [profits](profits.md)                                                                                                                                                                |
| `/settings`                                        | [Player progression backups, import review, legacy tools and reset controls](<../src/app/(data)/settings/page.tsx>); see [user state](user-state.md)                                                                                                  |
| `/news`                                            | [News page](../src/app/news/page.tsx)                                                                                                                                                                                                                 |
| `/dev`                                             | [Development-only current dataset status](../src/app/dev/page.tsx): read-only mode tabs, counts, and timestamps; see [operations](operations.md)                                                                                                      |

Detail routes use bounded reads: [getItemDetailPageData](../src/server/queries/getItemDetailPageData.ts)
reads one item, [getQuestDetailPageData](../src/server/queries/getQuestDetailPageData.ts)
one quest, and station pages reuse the mode-keyed Hideout page query. Each sets
entity-specific titles, descriptions, and canonical URLs. Missing IDs render
not-found states; failed reads report errors instead of 404s. Pages render public
identity from server data; player progress hydrates afterwards. Titles use the root
`%s · Tarkov Hideout Tracker` template.

Inventory, Keys, Station Goals, and Bitcoin Farm routes are placeholders. Check
their [route implementations](<../src/app/(data)/>) before extending them.
[Navbar](../src/components/core/Navbar.tsx) owns navigation. The
[(data) layout](<../src/app/(data)/layout.tsx>) supplies the footer and profile
conversion UI without loading metadata or entity arrays for descendants.

The root layout also supplies one browser [QueryProvider](../src/lib/query/QueryProvider.tsx)
across route navigation. TanStack Query owns reusable server-data requests,
including page payloads. Server pages prefetch the same mode-keyed query in a
request-local client and hydrate it for the browser. Partial payloads remain usable
fallbacks and retry instead of entering the reusable success cache. The provider
waits for persisted profile hydration and removes the prior mode's game-data scope
after a mode change. Player progress and preferences remain in their Zustand
stores, while modal selections and drafts remain local to their features.

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
offline source adapters -> current PostgreSQL domain tables
server page -> named query -> repository -> targeted PostgreSQL reads
            -> request-local Query prefetch -> hydrated client feature
client Query/controller -> bounded API -> named query, stored item view/search, or explicit service
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

[station-model](../src/features/hideout/station-model.ts) owns the pure upgrade
status (`ready`/`missing`/`illegal`), default viewed level, and reverse dependencies
shared by [StationCard](../src/features/hideout/components/StationCard.tsx) and the
[station page](../src/features/hideout/StationDetailsPage.tsx). The page's viewed
level is local state: browsing a level never changes the saved station level. Its
crafts load only on request through the shared unpriced profit query.

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

The [SearchPalette](../src/features/search/SearchPalette.tsx) opens from the
rightmost nav search button on desktop and mobile, or Ctrl/Cmd+K. It searches
items and quests in the shared [compact manifest](data-layer.md#compact-search-manifest)
without network requests while typing or expanding results. The
[pure search model](../src/features/search/search-model.ts) matches all normalized
terms and ranks exact name/short-name matches before prefixes and other matches,
with deterministic alphabetical ties. A leading `i:` or `q:` (case-insensitive) becomes a removable Item or Quest chip;
only that entity kind is searched. An empty scoped query browses that kind.
Only one chip can exist: subsequent prefixes remain literal search text.
Backspace with a collapsed caret at the start removes the chip while preserving
the query; its remove button also supports touch. The footer explains the prefixes.
It shows 10 results initially, expandable
to 50, labels entity kinds, and shows quest trader names/portraits.

The dialog traps focus, supports arrow navigation and Enter selection, closes on
Escape, and restores focus to the opener on dismissal. Empty, loading, error/retry,
and no-match states are explicit. Selecting an item opens the item-detail dialog;
quest selection navigates to `/quests/[questId]` and opens the workspace detail
pane, including on mobile or when already on the quest page.
Nav-owned search/selection state resets on mode changes and is never persisted.
On narrow phones Setup remains available in the menu, leaving room for the always
visible search button. The existing explicit quest fullscreen nav toggle remains
unchanged.

Quick Add uses [useItemSearchController](../src/features/items/useItemSearchController.ts)
against the same manifest with a 10-item limit.
[QuickAddModal](../src/features/quick-add/QuickAddModal.tsx) keeps draft rows and
FiR/non-FiR additions locally, then commits inventory additions through store
actions. [useUIStore](../src/lib/stores/useUIStore.ts) coordinates its shared open
state and pending items.

The item-detail dialog is the default destination for every item click.
[GlobalItemDetailModal](../src/features/items/item-detail/GlobalItemDetailModal.tsx)
is mounted once in the root layout; `ItemLink`, recipe items, and search results open
it through `openItemDetail` in [useUIStore](../src/lib/stores/useUIStore.ts). Opening
another item while it is open pushes the dialog's Back history
([navigation controller](../src/features/items/item-detail/useItemDetailNavigationController.ts));
closing clears it. [LazyItemDetailModal](../src/features/items/item-detail/LazyItemDetailModal.tsx)
downloads the detail UI only when opened and shows the compact loading card first.
The [details controller](../src/features/items/item-detail/useItemDetailsController.ts)
derives inventory, demand, market, usage, and recipe values for both the dialog and
the [item page](../src/features/items/item-detail/ItemDetailsPage.tsx); the
[request controller](../src/features/items/item-detail/useItemDetailRequestController.ts)
owns mode-aware relations, usage, and acquisition queries with partial-error handling.
In the dialog the usage tab panel scrolls within a 700px maximum height.

`/items/[itemId]` still exists but nothing links to it yet. It server-renders its
rows: [getItemDetailViews](../src/server/queries/getItemDetailViews.ts) reads the
same unpriced stored views the item API routes serve; complete views are hydrated
into the client query keys and partial views are passed as retryable fallbacks. Every
data tab renders (inactive ones `hidden`), so hideout, quest, trade, and craft rows are
in the server HTML. Rows are always shown; profile-dependent status (available/locked
badges, lock reasons, availability ordering, current station level, quest status) is
rendered client-side only after the saved profile loads. Until then the controller
derives from the store's initial state so server HTML and the hydration render agree.
Quest rows still follow the player's item-quest visibility filters, so that list
itself is profile-dependent.

Current prices use one shared mode/item TanStack cache across lists, profit pages,
and item details; Quests does not preload prices. See
[data layer](data-layer.md) for GET batching, one-hour freshness.
Relations, usage, acquisition, and price history use feature-owned TanStack query
options. Only complete detail responses enter reusable success cache state;
partial payloads remain available to the dialog or page with their explicit errors and stay
retryable. Recipe calculations reuse the
[profit engine](profits.md).

## Shared UI vocabulary and entity links

Small primitives in [components/ui](../src/components/ui/) own presentation and
accessibility; features own state and meaning. [Button](../src/components/ui/button.tsx)
(`buttonClassName` for links) provides size, tone, soft/solid/ghost, selected, and
focus variants; [Badge](../src/components/ui/badge.tsx) keeps FiR, locked, completed,
active, and milestone meanings on their palette roles;
[RequirementRow/RequirementChip](../src/components/ui/requirement.tsx) render a
satisfied/unmet/untracked state that domain code decides;
[DetailSection/SectionLabel](../src/components/ui/detail-section.tsx) offer bordered
and open layouts; [DataNotice](../src/components/ui/data-notice.tsx) is the compact
partial/empty notice beside `DataLoadError`. The [filter kit](../src/components/ui/filter-bar.tsx)
also supplies list-style `FilterOptionRow`, `FilterSwitchRow`, and `FilterGroupTitle`
used by quest filters and Hideout controls. [describeFleaPrice](../src/lib/utils/market-price.ts)
shares loading/failed/unavailable/estimate price states without merging purchase
cost, gross sale, net sale, and profit.

[Entity components](../src/components/entities/) share identity presentation
(`ItemThumbnail`, `ItemQuantityBadge`, `ItemReference`, `StationImage`) and links:
[QuestLink](../src/components/entities/quest-link.tsx) and
[StationLink](../src/components/entities/station-link.tsx) are real links to
[canonical routes](../src/lib/entity-routes.ts), so click, middle-click, and new tabs
behave normally; [ItemLink](../src/components/entities/item-link.tsx) is a button that
opens the item dialog. [EntityPreview](../src/components/entities/entity-preview.tsx)
uses the shared [HoverPreviewProvider](../src/components/ui/hover-preview-provider.tsx)
mounted in the root layout. It places one card beside the pointer or focused
trigger, moves with the pointer, lets the pointer enter the card, and closes on
Escape, scroll, or click. Hover preparation starts after 50 ms; the card appears
after at least 200 ms and waits for its image or other preview data to settle.
Touch taps activate the link or button without opening a preview. Cards use
supplied data, saved progress, and already-cached prices, workspace quests, or
Hideout stations; they never start detail requests. Quest previews use the
mode-scoped compact search manifest for a trader portrait when the full quest is
not already available. The expanded Items checklist cards show their item details
in place, so they do not open another item hover card. Item previews prefer the
square 512px image over the labeled grid image.
Hideout station names show a small outbound arrow. Station previews show only
the saved level; item previews omit short names. Entity previews have no
instruction footer. Quest previews show the issuing trader loyalty tier and
required objective items or keys when their names are available in the cached
workspace payload, falling back to objective descriptions when item data is
missing.
Profit recipe items use the same provider and positioning with their
recipe-specific card (route, cost, savings); their icons open the item dialog and
keyboard focus anchors the card. Short text `Tooltip` uses
[floating-preview.tsx](../src/components/ui/floating-preview.tsx) separately.
Quest-only pickups stay display-only (`linked={false}`).

For changes here, run [page query tests](../src/server/queries/page-data-queries.test.ts),
[item detail tests](../src/features/items/item-detail/), and
[quest-item demand tests](../src/lib/quests/quest-item-index.test.ts) as applicable;
[operations](operations.md) gives runnable commands. Verify changed interactions
in the browser, including a mode switch and partial/missing-data states.
