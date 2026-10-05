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
| `/hideout/stations/[stationId]`                    | [Station page](<../src/app/(data)/hideout/stations/[stationId]/page.tsx>): level overview and level changes, prerequisites, dependents, remaining items, streamed crafts with profit, and Bitcoin Farm/Generator power panels                         |
| `/items/kappa-checklist`                           | [Collector checklist](<../src/app/(data)/items/kappa-checklist/page.tsx>); see [quests](quests.md)                                                                                                                                                    |
| `/items/inventory`                                 | [Inventory](<../src/app/(data)/items/inventory/page.tsx>): owned non-FiR/FiR balances with instant edits; see below                                                                                                                                   |
| `/uploader`                                        | [Screenshot testing page](<../src/app/(data)/uploader/page.tsx>): browser OCR, item-label matching, and relative-position overlays; see below                                                                                                         |
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

Search metadata uses `https://tarkovhideout.com` as the canonical origin.
The root marks all other hosts (including dev and previews) `noindex`; settings
are always `noindex`. Robots allows page crawling so engines can read that directive.
Only production hosts advertise the sitemap. The sitemap query lists public overview
pages plus prepared quests and stations from the default PVP dataset, matching
cookie-free visits; read failures propagate rather than publishing a partial sitemap.
Individual items remain outside the sitemap. No artificial modification dates are emitted.

Keys and Station Goals routes are placeholders; Bitcoin Farm
calculations live on its station page (see [profits](profits.md)). Check
their [route implementations](<../src/app/(data)/>) before extending them.
[Navbar](../src/components/core/Navbar.tsx) owns navigation. The desktop Hideout
dropdown lists every station from the static
[station list](../src/lib/data/static-stations.ts) in [stationOrder](../src/lib/cfg/stationOrder.ts),
with bundled portraits and the saved level (a crown when maxed), so the shared
layout still fetches no station data. The
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
Found-in-raid requirements, counts and markers use the dedicated `fir` orange, not
`warning`.
Opacity, `color-mix`, `transparent` and `currentColor` are supported variations.
Charts and objective groups use the documented chart palette; map navigation has
separate extract/transit aliases. The route loading illustration keeps its artwork
colors. [Profile colors](../src/lib/cfg/profile-colors.ts) separately own the three
PVE/PVP/seasonal identity pigments; UI derives their tints through a local CSS
property. External item images and map artwork retain their source pixels.

Appearance themes (Default, Dim, Light, High contrast) are `[data-theme]` blocks in
the same file that override base roles only (surfaces, text, `highlight`, `shadow`,
brand and status/acquisition pigments); derived roles follow on `<html>`. Light flips
`highlight` to black and makes `shadow` a light grey, so write overlays and recessed
wells with those roles rather than assuming a dark canvas. The theme list lives in
[app-preferences.ts](../src/lib/cfg/app-preferences.ts), whose boot script sets
`data-theme` before first paint; [AppThemeSync](../src/components/core/AppThemeSync.tsx)
applies later changes. Nested theme previews must reset through
`data-theme="default"` and use base roles, because derived roles resolve at `<html>`.

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
in [stationOrder.ts](../src/lib/cfg/stationOrder.ts). Rules code references stations
through `STATION_IDS` in [static-stations.ts](../src/lib/data/static-stations.ts)
rather than inlining IDs or matching slugs. Edition starting levels are applied
through setup/store actions; see [user state](user-state.md).
Required-station chips on Hideout cards smoothly scroll to the corresponding visible
card and briefly pulse its border green without opening station details. Reduced-motion
preferences use an instant scroll and a temporary solid green border instead.

[station-model](../src/features/hideout/station-model.ts) owns the pure upgrade
status (`ready`/`missing`/`illegal`), default viewed level, and reverse dependencies
shared by [StationCard](../src/features/hideout/components/StationCard.tsx) and the
[station page](../src/features/hideout/details/StationDetailsPage.tsx). Both change
saved levels through [useStationLevelChange](../src/features/hideout/useStationLevelChange.ts);
its `adjustItems` flag (default on) moves the level's item requirements out of or back
into inventory. The station page exposes that flag as a page-local toggle. Its viewed
level is local state: browsing a level never changes the saved station level.
[station-details-model](../src/features/hideout/details/station-details-model.ts)
derives per-level state and remaining cost (missing units × cheaper of flea and trader,
roubles at face value) and the station's remaining items. Crafts are prefetched on the
server alongside the Hideout read and streamed through a Suspense slot that hydrates
the shared unpriced profit query; profit uses the profit pages' calculator and price scope.

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

The Sort button beside Filters opens a list of sort options, with a direction
arrow only on the selected option. It uses the shared filter dropdown shell and dropdown menu rows, including
outside-click dismissal, Escape, and keyboard navigation. Filter menus share the Filters panel surface (16px padding, 12px medium-weight body text, muted background, border, and small shadow). Dropdowns default to the same 340px desktop width and 12px gap below the toolbar, accounting for wrapped toolbar rows. Simple sort lists use a compact 260px panel with 14px labels, roomier rows, and the direction arrow beside the selected label. Checklist sorting is local to the page and defaults to descending Individual Value.
Individual Value is the higher of the usable flea price and the best trader sell
value in roubles. Flea-banned items use trader value. Either source can stand
alone; items with neither sort last in both directions.
Selecting another sort uses descending order for Individual Value, Total Value,
and Quantity Needed, or A-Z for Alphabetic; selecting the active sort reverses it.
Quantity uses outstanding demand after inventory, with outstanding FiR demand as
a secondary key in the same direction. Total Value multiplies individual value
by all outstanding units (including FiR); the row's purchasable non-FiR cost
estimate remains separate. Numeric ties fall back to A-Z.
The optional Default sort restores the legacy order: quest groups in their derived
order first, then items prioritized by pinned quests, available quests, earlier
prerequisite depth, more related quests, and stable item ID. Non-quest items follow
alphabetically. Selecting Default again reverses it; initial page sorting remains
descending individual value.
Any-of quest groups sort by required quantity/FiR quantity or quest name, with no
invented value for alternatives. Sorting applies within categories when
categorization is enabled.

## Search, Quick Add, and item details

[Filter bar UI kit](../src/components/ui/filter-bar.tsx) provides the shared bar,
panel trigger/panel, search input, native single-select radio groups, toggle
buttons, and panel sections. [FilterCheckbox](../src/components/ui/FilterCheckbox.tsx)
and [FilterNumberInput](../src/components/ui/FilterNumberInput.tsx) supply panel
inputs. These controlled components own presentation and accessibility; consumers
own state, labels, options, and effects. [ItemsControls](../src/features/items/components/ItemsControls.tsx)
wires them to existing preferences without changing persistence. Panel triggers
expose expanded state; panels fade and expand into place, then close when the
user clicks anywhere outside them; `FilterDrawer` tucks a collapsible strip under a
bar stacked above it, leaving only a small eye tab when hidden; `FilterMultiSelect` dropdowns
open on mouse press but wait for a touch or pen tap to complete, so scrolls starting on them are ignored;
radios support arrow keys; and toggles expose pressed state. Escape from the checklist panel closes it and returns focus to its
trigger.

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
items and quests in the shared [compact manifest](data-layer.md#compact-search-manifest),
plus hideout stations from the bundled static station list, without network requests while typing or expanding results. The
[pure search model](../src/features/search/search-model.ts) matches all normalized
terms and ranks exact name/short-name matches before prefixes and other matches,
with deterministic alphabetical ties. A leading `i:`, `q:` or `h:` (case-insensitive) becomes a removable Item, Quest or Hideout chip;
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

[Inventory](../src/features/items/inventory/InventoryClientPage.tsx) is client-only:
it lists every nonzero `itemCounts` balance (negative balances included and marked)
using names and icons from the search manifest, so it adds no server query. IDs
missing from the manifest render as explicit unknown rows. Edits apply immediately
through `addItemCounts` deltas; steppers stop at zero. Rows edited to zero, and the
order of the Count sort, are page-local so rows do not vanish or move while being
edited; both reset on the next visit or mode change.

[Uploader](../src/features/uploader/UploaderClientPage.tsx) is a standalone,
noindex testing page, reachable directly at `/uploader`. It accepts one PNG,
JPEG, or WebP by file picker, drop, or clipboard paste (20 MB and 24 megapixel
limits). It reuses the active-mode search manifest rather than adding a catalog
API or preloading data in the shared layout. Screenshots and results remain
ephemeral; it never changes inventory or saved player data. Switching profiles
clears the image and results and cancels recognition.

[The controller](../src/features/uploader/useUploaderController.ts) owns image
decoding, recognition lifecycle, cancellation, retries, and timeout handling.
Completed scans are not automatically rerun on background catalog refreshes,
so those refreshes cannot discard a player's review edits.
[Image recognition](../src/features/uploader/image-recognition.ts) lazily loads
Tesseract.js and runs English sparse-text OCR in a browser worker on an upscaled,
inverted screenshot. If enough recognized labels establish regular rows,
[label preprocessing](../src/features/uploader/label-preprocessing.ts) builds
complementary contrast and neutral-color masks, then isolates individual labels
for single-line OCR. Pixel-identical crops across masks are read once, so
complementary contrast passes do not exhaust the region budget with duplicate work. Tight crops use text-height padding to keep nearby artwork
out; complementary wider crops preserve labels offset from the fitted row.
Row spacing is fitted
across high-confidence label rows to prevent crop drift toward the bottom of a stash.
The model combines complementary passes, deduplicates overlapping labels, and
keeps conflicting exact identifications ambiguous. This infers label-row spacing,
not complete grid geometry. The worker/core/language resources download from the
library's default CDNs on first use; screenshot pixels are never uploaded.
[The pure matching model](../src/features/uploader/recognition-model.ts) matches
visible short names exactly after case/spacing/punctuation normalization; full
names and fuzzy spelling corrections are not automatic recognition aliases. Shared short
names remain ambiguous. Exact reads with moderate OCR confidence are retained;
isolated reads below 35 confidence appear as review candidates and do not count
as recognized items. Two-character labels such as EC require 85 confidence for
automatic assignment; reads from 35 to 84 remain reviewable candidates instead
of disappearing. A stronger matching pass can resolve them. Separate border
punctuation cannot expand a matched label's bounds or lower its confidence.
[The review model](../src/features/uploader/review-model.ts) turns detections into
selectable boxes. Regular label rows and aligned right edges suggest a square
cell lattice. [Footprint detection](../src/features/uploader/item-footprints.ts)
examines sustained, uniform-color borders in the original pixels to expand short
labels into multi-cell rectangles, including rotated items. Weak or missing border
evidence falls back to label-based estimates. At a tightly cropped image edge,
a missing outer stroke may use the frame when the top and another side are
visible; these footprints are marked as frame-inferred, so future size filtering
must not treat them as fully measured. Missing interior borders still cannot be
invented. Candidate-free text becomes an
unknown box, with overlapping OCR fragments deduplicated. Exact matches start
assigned; uncertain and ambiguous matches require a player choice.
[Label suggestions](../src/features/uploader/label-suggestions.ts) rank nearby
short-name spellings for unknown reads and typed review searches. Suggestions
never assign an identity automatically. Each box starts at quantity one,
independent of visible stack text.

[The review workspace](../src/features/uploader/UploaderReview.tsx) fills the viewport
below the navbar, without the global footer. A flat right panel holds the current goal,
selection details, five ranked matches, catalog search, and compact zoom controls.
Click selects one box; Ctrl/Command-click toggles individual boxes; Shift-click
selects unknown boxes within the inclusive numbered range from the anchor. Known
boxes are excluded from Ctrl/Command and Shift selections but remain individually
selectable. A staggered first-reveal flash fades known boxes to a dark overlay;
unknown boxes retain their warning fill. Reduced-motion users skip the animation.
The default Fit zoom contains the entire image within the available canvas.
Assignment and FIR changes
apply to the entire selection and can be undone. Left arrow selects the previous unknown (with wraparound); Right arrow selects the next
unknown, Enter uses the suggested item and advances to the next remaining unknown, and F toggles FIR; typing fields retain
normal keyboard behavior. The bottom strip shows scan progress, then control hints with keycap badges.
During recognition, the image has a dimmed overlay and moving scan band (static for reduced motion); stage and progress appear only in the bottom strip. Undo sits with review actions;
zoom and image replacement/clear controls share a Screenshot section at the foot of the full-height sidebar. The bottom strip ends at the canvas edge; both areas use a matching subtle background and divider.
Quantity editing is available only for a single currency or GP coin selection.
The workspace does not expose scanned-box removal. Once every detected box is
classified, a brief reduced-motion-aware completion animation introduces Show
summary and Keep reviewing. The missing-items section supports repeated catalog
search, manual additions with quantity for any item, FIR toggles (initially off),
and removal of manual additions. Additions stay separate from screenshot boxes
and survive returning to classification. Ignore unknowns allows continuing with
identified items only; it preserves unknown boxes for later review and reports
the excluded count. Missing-item entry precedes the next-step buttons, with a centered View item list link below Keep reviewing. This link opens the grouped item list. Show summary
expands the right panel across the workspace into the requirement summary;
its top-left Back button restores the review and manual additions.
The [summary model](../src/features/uploader/summary-model.ts) combines scanned
and manually added entries, attaches all remaining hideout/quest reasons, and
splits quantities into FIR reserves, replaceable needs, review decisions, and
pricing candidates. It considers all future station levels and eligible future
quests, excluding completed requirements/objectives and completed, failed,
ignored, or faction-ineligible quests. Non-FIR copies cannot satisfy FIR demand;
unknown FIR and quest alternatives remain explicit review decisions. Reusable
tools use the maximum future tool quantity, separately from consumed items.
Broad quest alternatives carry an incomplete-coverage warning. Saved inventory
is neither subtracted (it may overlap the screenshot) nor modified.
The summary loads requirement metadata on demand through
[getUploaderSummaryData](../src/server/queries/getUploaderSummaryData.ts), with
mode-scoped caching. Both requirement sources must succeed before recommendations
appear. Only pricing-candidate IDs are sent to the existing mode-scoped
[batch price hook](../src/features/items/useItemPrices.ts). Their rows show flea
unit prices before fees, best trader offers in rouble equivalents, stack values,
48-hour percentage changes when available, freshness, and unstable/stale labels.
Loading, missing-price, and retryable error states are explicit. Full histories
are not loaded, and price data is not a sell-and-rebuy recommendation.
Categories stack inside a centered, 56rem maximum-width summary with compact rows.
Action labels appear once in section headings; subgroups separate different uses
and FIR statuses. Rows show the item image, name, quantity, and expansion control,
with a compact price-data line for pricing candidates.
Review decisions are split into Confirm found-in-raid status and Optional
quest hand-ins, with empty review sections omitted. Each row expands
to show only its hideout and quest uses, with required quantities and FIR requirements;
the same single-column layout adapts to narrow screens.
The seen-items list groups scanned and manual items
by stable item ID and FIR status, explicitly retaining unknown detected FIR.
[Found-in-raid detection](../src/features/uploader/found-in-raid.ts) compares a small
grayscale badge reference against the bottom-right corner of measured footprints,
across nearby positions and scales. The badge remains upright regardless of item
rotation. Only strong matches produce FIR; missing geometry, low resolution, and
weak/absent matches remain unknown, never automatically non-FIR. Screenshot-corner
fixtures cover actual badges, artwork, and the separate bottom-left transfer symbol.
The player can toggle FIR/non-FIR and undo that choice; unconfirmed detections
retain unknown status. The pure review model retains grouping and finalization
helpers for a later recommendations step. A read-only seen-items list is currently
exposed. Leaving the page, changing the image, or switching game modes discards
the review; there is no inventory write or persistent import.
Items with no detected label can still be missed; a clearer screenshot may be needed.
Hidden container contents are not inferred. Catalog slot dimensions are not currently
retained by the item adapter, storage, or search manifest; footprint detection still
uses screenshot evidence rather than hardcoded sizes.

The item-detail dialog is the default destination for every item click.
[GlobalItemDetailModal](../src/features/items/item-detail/GlobalItemDetailModal.tsx)
is mounted once in the root layout; `ItemLink`, recipe items, and search results open
it through `openItemDetail` in [useUIStore](../src/lib/stores/useUIStore.ts).
The global [navigation controller](../src/features/items/item-detail/useItemDetailNavigationController.ts)
owns same-URL browser history before the lazy detail UI loads. Opening an item
pushes one entry; native Back and the dialog Back action visit earlier items,
then close at the original page. Close, Escape and overlay dismissal unwind all
entries in the current item sequence. Browser Forward can restore that sequence
within the current page session; selecting another item after Back replaces the
forward branch. No separate Forward button is rendered.
Route links dismiss the dialog without cancelling navigation, and browser Back
can restore the prior item on its original route. Mode changes close the dialog
and invalidate its saved in-memory summaries. Browser history stores only a
session token and position, preserves the framework's state, and never stores
player progress or item payloads. Reloaded/stale tokens do not reopen items.
[The navigation model](../src/features/items/item-detail/item-detail-navigation.ts)
tests traversal, close/reopen races, route changes, mode changes and forward branches.
Recipe rows in the dialog's Traders and Crafting tabs, and station craft rows, open a
profit breakdown with `openRecipeBreakdown`. The breakdown is its own history entry that swaps the dialog's
content (dialogs are never stacked), so Back returns to the item; nested recipes in
its chain push further entries. [The breakdown](../src/features/items/item-detail/RecipeBreakdownModal.tsx)
evaluates the recipe against its output item's acquisition graph with the profit
pages' options and building blocks, and links to the profit page row.
[LazyItemDetailModal](../src/features/items/item-detail/LazyItemDetailModal.tsx)
downloads the item or breakdown UI only when opened and shows a loading view first.
The [details controller](../src/features/items/item-detail/useItemDetailsController.ts)
derives inventory, demand, market, usage, and recipe values for both the dialog and
the [item page](../src/features/items/item-detail/ItemDetailsPage.tsx); the
[request controller](../src/features/items/item-detail/useItemDetailRequestController.ts)
owns mode-aware relations, usage, and acquisition queries with partial-error handling.
Below `lg`, the item dialog fills the full dynamic viewport even with short or
loading content. The dialog itself is the vertical scroll surface: Back, the
header, inventory, market and the active usage tab all scroll together. Back occupies
a full-width 3rem row at the top when a previous item is available. The grid and
tab contents keep their natural height, without a nested vertical tab scroller.
This full-screen presentation is specific to the item dialog, not shared dialogs.
At `lg` and above, the usage tab panel scrolls within a 700px maximum height.
The shared item header presents requirement totals as a compact two-column
text grid below `lg`, retaining the bordered summary on desktop.

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

[ItemImage](../src/components/entities/item-image.tsx) is the shared square item image
API. Its only required prop is `item` (a name and optional image URLs); the default
is a display-only, unframed 44px square. Optional `size`, `foundInRaid`, `completed`,
`quantity` (number or formatted progress), `selected`, and `framed` cover standard
variants; noninteractive `children` allow price/tool overlays. Completion replaces
the top-right FiR marker with the hideout requirement grid's green circular check
badge, offset 4px outside the corner, without dimming or desaturating the image.
FiR and quantity overlays extend 1px past their corners to overlap the slot border;
the gallery's price/tool chips use the same edge alignment and compact typography.
Selection is a 1px border inset by 1px; quantities use a flat, borderless bottom-right chip.
`opensModal` requires
an item ID and reuses ItemLink's dialog and hover preview (`preview={false}` disables
the latter). `onClick` adds a custom action; when combined with `opensModal`, calling
`preventDefault()` cancels opening. Use a display-only image inside existing buttons.
The shared ItemThumbnail renderer tries icon, 512px, grid, then base images, advancing
on load failure and finally showing a placeholder. Existing thumbnail consumers use
the same renderer; feature-local images can migrate separately. The development-only
[/dev gallery](../src/app/dev/ItemImageGallery.tsx) shows minimal usage, all 32 visual
boolean combinations, sizes, interactions, and fallback cases without saving progress.

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
Touch taps activate the link or button without opening a preview: the provider
ignores every show request (including emulated mouse events from profit recipe
rows) while the latest pointer input is touch, and closes any open card on a
tap. Mouse movement or a key press re-enables previews. Cards use
supplied data, saved progress, and already-cached prices, workspace quests, or
Hideout stations. Visible item previews additionally load the item's unpriced
relations through the mode-scoped dialog relations cache, without loading recipes
or price history. They show loading/unavailable demand explicitly, and reuse the
dialog's quest visibility, FiR, completion, and alternative-item demand rules for
separate Keep for Quests and Keep for Hideout rows, including each source's FiR
quantity. These show outstanding requirement totals, without subtracting inventory;
there is no duplicate Still needed row. Inventory totals include both non-FiR and FiR balances.
The flea estimate includes a compact colored 48-hour trend when available and labels
unstable values. A one-line [market timing banner](../src/components/entities/market-timing-banner.tsx)
follows it when the cached price is unusually high or low (see [data layer](data-layer.md));
the item dialog's Market section shows the same flag with the typical price and 7-day range,
and its Analytics tab lists the latest stored market observation. Entity cards are 280px wide with tighter spacing and a slightly
translucent, blurred background. Facts use brighter labels and left-aligned values;
the hover trend has no chip background. Zero inventory, requirement,
and flea-value rows are omitted. Explicitly flea-banned items show the highest
positive trader sell value with its portrait/name, loading that item's scoped
prices when needed. Missing offers, stale prices, and player-level flea locks
do not trigger a trader fallback. Quest previews use the
mode-scoped compact search manifest for a trader portrait when the full quest is
not already available. Items checklist rows do not open item hover cards in Icon,
Compact, or Expanded sizes. Alternatives inside an expanded any-of group likewise
omit hover cards in Icon and Compact sizes; the Expanded layout retains them. Item
previews prefer the square 512px image over the labeled grid image.
Hideout station names show a small outbound arrow. Station previews show the
saved level and missing requirements for the immediate next upgrade, using
supplied/cached Hideout data and the search manifest. They reuse the station
detail shortage calculation with FiR reserved only within that next upgrade,
so later levels, other stations, and checklist filters cannot inflate shortages.
Negative saved inventory balances count as zero owned for this preview and never
increase the upgrade's required quantity. They omit covered or
manually completed items and met station/trader gates, and show at most five
requirements plus an overflow count. Currency and character skills are explicitly
untracked; missing records remain unresolved. Maxed stations show Fully upgraded.
Item previews omit short names. Entity previews have no
instruction footer. Quest previews show the issuing trader loyalty tier and
required objective items or keys when their names are available in the cached
workspace payload, falling back to objective descriptions when item data is
missing.
The development page includes item trend/error examples plus live quest and
station hover examples for the active profile's mode. Sample prices are labeled;
the gallery never writes player progress.
Profit recipe items use the same provider and positioning with their
recipe-specific card (route, cost, savings); their icons open the item dialog and
keyboard focus anchors the card. Short text `Tooltip` uses
[floating-preview.tsx](../src/components/ui/floating-preview.tsx) separately.
The global **Hover cards** preference suppresses every provider card and stops
floating previews from opening on hover or focus; explicit clicks (such as profit
recipe requirements) still open their popover.
Quest-only pickups stay display-only (`linked={false}`).

For changes here, run [page query tests](../src/server/queries/page-data-queries.test.ts),
[item detail tests](../src/features/items/item-detail/), and
[quest-item demand tests](../src/lib/quests/quest-item-index.test.ts) as applicable;
[operations](operations.md) gives runnable commands. Verify changed interactions
in the browser, including a mode switch and partial/missing-data states.
