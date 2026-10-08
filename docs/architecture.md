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
| `/story`, `/story/[chapterId]`                     | [Story index](<../src/app/(data)/story/page.tsx>) and [chapter tracker](<../src/app/(data)/story/[chapterId]/page.tsx>) from static hand-authored data (untracked chapters get a placeholder); no server reads; see [quests](quests.md#story-chapters)                                  |
| `/items/[itemId]`                                  | [Item page](<../src/app/(data)/items/[itemId]/page.tsx>): server-rendered item details; not linked yet (items open the dialog)                                                                                                                        |
| `/hideout/stations/[stationId]`                    | [Station page](<../src/app/(data)/hideout/stations/[stationId]/page.tsx>): level overview and level changes, prerequisites, dependents, remaining items, streamed crafts with profit, and Bitcoin Farm/Generator power panels                         |
| `/items/kappa-checklist`                           | [Collector checklist](<../src/app/(data)/items/kappa-checklist/page.tsx>); see [quests](quests.md)                                                                                                                                                    |
| `/items/market`                                   | [Market analysis](<../src/app/(data)/items/market/page.tsx>): whole-market flea swings for flea-sellable items from one suspended page-data read; see [data layer](data-layer.md#prices-history-and-freshness) |
| `/games/higher-lower`                             | [Higher or Lower](<../src/app/(data)/games/higher-lower/page.tsx>): item value guessing game from one suspended page-data read; `/games` redirects here; listed only in the secondary (☰) menu, without the footer; the navbar search is refused there (button and Ctrl/⌘ K shake red); see [data layer](data-layer.md#prices-history-and-freshness) |
| `/items/inventory`                                 | [Inventory](<../src/app/(data)/items/inventory/page.tsx>): owned non-FiR/FiR balances with instant edits; see below                                                                                                                                   |
| `/uploader`                                        | [Loot Scanner](<../src/app/(data)/uploader/page.tsx>) (beta): browser OCR, item-label matching, and keep/sell sorting; see below                                                                                                                      |
| `/items/barter-profits`, `/items/crafting-profits` | Shared [ProfitPage](../src/features/profit-pages/ProfitPage.tsx); see [profits](profits.md)                                                                                                                                                           |
| `/hideout/craft-planner`                           | Station craft recommendations using the shared profit query; see [profits](profits.md)                                                                                                                                                                |
| `/settings`                                        | [Player progression backups, import review, legacy tools and reset controls](<../src/app/(data)/settings/page.tsx>); see [user state](user-state.md)                                                                                                  |
| `/news`                                            | [News page](../src/app/news/page.tsx)                                                                                                                                                                                                                 |
| `/dev`                                             | [Development-only current dataset status](../src/app/dev/page.tsx): read-only mode tabs, counts, and timestamps; see [operations](operations.md)                                                                                                      |

Detail routes use bounded reads: [getItemDetailPageData](../src/server/queries/getItemDetailPageData.ts)
reads one item, [getQuestDetailPageData](../src/server/queries/getQuestDetailPageData.ts)
one quest, and station pages use mode/station-keyed metadata and recipe queries. Each sets
entity-specific titles, descriptions, and canonical URLs. Missing IDs render
not-found states; failed reads report errors instead of 404s. Pages render public
identity from server data; player progress hydrates afterwards. Titles use the root
`%s · Tarkov Hideout Tracker` template.

Unmatched URLs use the root [404 page](../src/app/not-found.tsx), below the shared
navbar. Its MIA banner and recovery controls need no entity reads; Back to Hideout
links to `/hideout`, while Go Back uses browser history with a Hideout fallback
when no previous history entry exists. The fade-in and finite decorative coin
shower respect reduced motion. Entity-specific not-found views remain local to
their routes.

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
and individually completed requirements affect demand. Station goals cap each
station's counted levels: [station-goals.ts](../src/lib/utils/station-goals.ts)
resolves a saved goal (unset means max level, 0 means ignore) and raises it to cover
unbuilt station prerequisites of other goal levels. The Hideout page's Goals toggle
swaps card bodies for the level picker (page-local state). Goals cap the Hideout
FiR pool, the Items checklist and stats (unless the Items filter Ignore Station Goals
is on), and Inventory/uploader keep-or-sell demand; item and station detail pages
are not capped. [item-needs.ts](../src/lib/utils/item-needs.ts)
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
categorization is enabled. Categories are the broad
[item groups](../src/lib/data/item-groups.ts) shared with the uploader, with
Jewelry split out of Barter as Valuables.

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
using names and icons from the search manifest. Names longer than 24 characters show
the short name. IDs missing from the manifest render as explicit unknown rows. Each
row lists the item's hideout, quest, and Kappa uses from the shared
[item demand model](../src/features/items/demand/item-demand-model.ts), with saved
counts as the pool (so any-of hand-ins appear only where copies are assigned); uses
that apply now come first, and more than three collapse to two plus "+ N more". Kappa
uses follow the uploader's Kappa toggle. The
requirement metadata comes from the same `/api/page-data/uploader` query as the
uploader; until it loads rows show no uses, and a failure shows a retry notice
rather than "not needed". Edits apply immediately
through `addItemCounts` deltas; steppers stop at zero. Rows edited to zero, and the
order of the Count sort, are page-local so rows do not vanish or move while being
edited; both reset on the next visit or mode change. The header and empty state
link to the uploader.

[Uploader](../src/features/uploader/UploaderClientPage.tsx) is the indexed Loot
Scanner page, linked with a Beta chip from the Items menu (`badge` in
[nav-config](../src/components/core/nav-config.ts)) and the Inventory page. Until
a scan first reaches the Sort step, the empty drop area shows a
[first-run tutorial](../src/features/uploader/UploaderIntro.tsx) with good/bad
example screenshots from `public/images/uploader/` and a dashed drop zone that also
opens the file picker; reaching Sort sets the global `uploaderIntroSeen`
preference, after which the plain drop prompt returns. It accepts one PNG,
JPEG, or WebP by file picker, drop, or clipboard paste (20 MB and 24 megapixel
limits). It reuses the active-mode search manifest rather than adding a catalog
API or preloading data in the shared layout. Screenshots and results remain
ephemeral; saved inventory changes only through the explicit send actions in
decision mode, and no other player data is written. Switching profiles
clears the image and results and cancels recognition.

[The controller](../src/features/uploader/useUploaderController.ts) owns image
decoding, recognition lifecycle, cancellation, retries, and timeout handling.
Completed scans are not automatically rerun on background catalog refreshes,
so those refreshes cannot discard a player's review edits.
[Image recognition](../src/features/uploader/image-recognition.ts) lazily loads
Tesseract.js and supplies a browser OCR reader and icon loader to the DOM-free
[scan pipeline](../src/features/uploader/scan-pipeline.ts), which runs English
sparse-text OCR on an upscaled, inverted screenshot framed by a small blank margin, since
OCR drops labels that touch the image edge. If enough recognized labels establish regular rows,
[label preprocessing](../src/features/uploader/label-preprocessing.ts) builds
complementary contrast and neutral-color masks, then isolates individual labels
for single-line OCR. Pixel-identical crops across masks are read once, so
complementary contrast passes do not exhaust the region budget with duplicate work. Tight crops use text-height padding to keep nearby artwork
out; complementary wider crops preserve labels offset from the fitted row. Rows above the
first fitted row are read too, so a top row cut off by the crop is not lost.
Any confident read of a real short name places rows, including names several items share
(ammo calibers, weapons and their parts), so six labels in four agreeing rows suffice.
Row spacing is fitted
across high-confidence label rows to prevent crop drift toward the bottom of a stash.
Rows are weighted by how many labels they hold and the pitch must be at least 4.5 label
heights, so a single tooltip caption between rows cannot halve the lattice.
The model combines complementary passes, deduplicates overlapping labels, and
keeps conflicting exact identifications ambiguous. The worker/core/language resources download from the
library's default CDNs on first use; screenshot pixels are never uploaded.
[Scan quality](../src/features/uploader/scan-quality.ts) explains poor scans from
signals the pipeline already has. These are first-pass label confidence, cell size in
source pixels, image extent in cells, and the unresolved share. It returns at most two
hints, which the review shows over the screenshot. When there is no grid and no
catalog match, the hint is blocking: the review does not open and the page offers to
clear the image.
[The pure matching model](../src/features/uploader/recognition-model.ts) matches
visible short names exactly after case, spacing, punctuation, accent (Pâté) and
Cyrillic look-alike (ТТ, С-1) normalization. Exact reads with moderate OCR confidence are retained;
isolated reads below 35 confidence appear as review candidates and do not count
as recognized items. Separate border
punctuation cannot expand a matched label's bounds or lower its confidence.
[The review model](../src/features/uploader/review-model.ts) turns detections into
selectable boxes. Regular label rows and aligned right edges suggest a square
cell lattice. Labels place it a few pixels high, so for a single container it then moves
onto a clear peak of the light cell-border strokes nearby; captures spanning several
containers, which do not share one lattice, keep the label estimate. [Footprint detection](../src/features/uploader/item-footprints.ts)
examines sustained, uniform-color borders in the original pixels to expand short
labels into multi-cell rectangles, including rotated items. Weak or missing border
evidence falls back to label-based estimates. At a tightly cropped image edge,
a missing outer stroke may use the frame when the top and another side are
visible; these footprints are marked as frame-inferred and are not treated as
measured sizes. Missing interior borders still cannot be invented.
Overlapping OCR fragments are deduplicated.

Reducing manual input is the priority, so boxes start assigned whenever the evidence
favors one identity. Junk-box screenshots are the main use, so barter-item
categories (the search manifest's `b` flag) rank first among same-name candidates, and
a shared short name with exactly one barter item (Skull, Strike, Fleece) assigns it.
Exact single matches start assigned, including low-confidence reads of three or more
characters. [Label suggestions](../src/features/uploader/label-suggestions.ts) score
other reads with a weighted edit distance in which common OCR glyph confusions
(o/d, e/c, i/l, …) cost half an edit, and treat a read that is a prefix of a longer
short name as an in-game truncation ("Toothpast"). A unique best spelling, or the only
barter item at the best score, starts assigned when no other spelling is within one
edit. Longer short names containing a read ("CPU" of "CPU fan") join the candidates
without changing the text identity.

[Icon matching](../src/features/uploader/icon-matching.ts) then compares catalog grid
art with the screenshot, read through a same-origin `/item-assets` rewrite of
assets.tarkov.dev (see [next.config](../next.config.ts)) because the asset host sends no
CORS headers. Each icon is placed at its own size and orientation from the box's labeled
top-right cell; label, badge, stack-count and transfer/SPEC overlays are masked, and a
small position search absorbs lattice error. The score averages RGB correlation with a
brightness-matched difference, minus a penalty when the background tint of the cell's side
bands differs from the icon's (same art on a yellow quest or blue loot background). Among a read's candidates, a clear artwork lead assigns
the item; a clear text identity is only replaced when another candidate's art is far
closer. Boxes still unresolved are compared with every loot item (barter items plus the Info
category, such as flash drives and diaries): a clear winner is assigned and otherwise the
closest items become suggestions. A complete label of three or more characters that spells
only non-loot names, and no loot name begins with, skips
this search: a weapon or part stays unassigned with its own candidates, because modded
weapons do not match catalog art and the junk-box search would otherwise invent an item. Finally, non-empty lattice
cells no box covers (labels OCR missed entirely) gain an assigned box only for a strong,
clear loot match, absorbing unresolved fragments of the same item.
[Dogtag checks](../src/features/uploader/dogtag.ts) cover labels that are player names,
which can spell an item's short name exactly. A one-cell box or cell with a bottom-left
level number, whose dogtag art is at least as close as the read item's, becomes the
generic BEAR or USEC tag. A finer grayscale comparison of the tag body picks the faction.
Prestige and event variants are left to the player. A matched icon
also sets the size of a box whose footprint was not measured. Thresholds were
calibrated on stash screenshots and are relative scores, not probabilities. The first
loot-wide comparison downloads the loot grid icons (about 3.4 MB, browser-cached).
[The uploader catalog](../src/features/uploader/uploader-catalog.ts) drops retired items that
share art and labels with a live one (Encrypted flash drive) from matching and search.
Stash items never overlap, so a smaller box mostly inside a larger identified one (such
as a long name's label read as its own item) is dropped. Money is excluded from scan
results; players enter it more easily by hand. In review, "Not an item" (Delete)
removes selected boxes, undoably.
Each box starts at quantity one, independent of visible stack text.

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
apply to the entire selection and can be undone. Each new selection focuses the match search so typing starts
immediately; Up/Down move the highlighted match, Enter uses it and advances to the next remaining unknown, and
Left/Right step through unknowns while the search is empty (with wraparound). Escape leaves the search, after which
arrows, Enter, and F (toggle FIR) work from the canvas. The bottom strip shows scan progress, then control hints with keycap badges.
During recognition, the image has a dimmed overlay and moving scan band (static for reduced motion); stage and progress appear only in the bottom strip. Undo sits with review actions;
after the scan, a compact sidebar footer keeps only zoom and New scan. Once there are any review edits, manual
additions, or sends, New scan asks for an inline confirmation and a pasted or dropped image asks before
replacing the screenshot. The bottom strip ends at the canvas edge; both areas use a matching subtle background and divider.
Quantity editing is available only for a single currency or GP coin selection.
The workspace does not expose scanned-box removal. Every step shares a bottom
navigation row above the Screenshot section: Back on the left and the primary forward
step, with arrows, on the right. Classification moves forward with Continue, or Skip
unknowns and continue while unknowns remain (they stay available for later review).
Classifying the last unknown never advances on its own; after Continue, a brief
reduced-motion-aware completion animation introduces the missing-items step, whose
navigation is Review and Sort loot. Both classification and the missing-items step
offer a Show item icons switch that draws catalog icons over identified boxes
without blocking clicks.
In that step every box is darkened and unselectable, and any selection is cleared,
so undetected items stay bright on the screenshot. Its search takes focus on entry; Up/Down
move the highlighted match and Enter adds it. A short note asks the player to look for items that
aren't darkened, even partly, since the scan likely missed them. The missing-items section supports repeated catalog
search, manual additions with quantity for any item, FIR toggles (initially off),
and removal of manual additions. Additions stay separate from screenshot boxes
and survive returning to classification. Ignore unknowns allows continuing with
identified items only; it preserves unknown boxes for later review and reports
the excluded count. A centered View item list link opens the grouped item list. Sort loot
switches the existing workspace into decision mode without replacing the screenshot
canvas, zoom, scroll position, or sidebar frame. Back to review restores the
classification controls and manual additions without a page transition.
Set found in raid opens a FIR mode from classification, the missing-items step, or the
sort step's send warning. Known items with unknown FIR stay bright with an outline;
everything else is darkened with an FIR/Not FIR tag. Clicking a known item switches it
between found in raid and not found in raid, and All FIR / All not FIR set the remaining
unknowns; changes are undoable. Done (or Escape) returns to the step that opened it,
re-snapshotting the summary when it came from sorting.
The [summary model](../src/features/uploader/summary-model.ts) feeds scanned
entries to the shared [item demand model](../src/features/items/demand/item-demand-model.ts),
which combines scanned
and manually added entries with all remaining hideout/quest demand: future station
levels and eligible future quests, excluding completed requirements/objectives and
completed, failed, ignored, or faction-ineligible quests. Saved inventory covers
demand first (spare FIR copies may cover non-FIR demand); scanned copies are kept
only up to what is still missing, and the rest are surplus. Non-FIR copies cannot
satisfy FIR demand. Copies with unconfirmed FIR cover replaceable demand first,
then any remaining FIR demand, and are flagged rather than sold. Reusable tools use
the maximum future tool quantity. Any-of hand-ins use every accepted item (the
shared quest index trims broad groups to a display preview, so the summary restores
full objective lists): saved spare copies fill them first, then the cheapest
remaining scanned copies by best sell value, narrow groups before broad ones.
Each requirement records whether it applies now (next station level or an
available quest) or later, with the quest's minimum level.
The review preloads requirement metadata through
[getUploaderSummaryData](../src/server/queries/getUploaderSummaryData.ts), with
mode-scoped caching. Both requirement sources must succeed before recommendations
appear. Recognized item IDs enter the existing mode-scoped
[batch price hook](../src/features/items/useItemPrices.ts) during review, before
opening the summary. Manual additions join the price batch when summary opens.
The [decision model](../src/features/uploader/decision-model.ts) sells surplus by
default and holds it only when a stable, non-stale flea price (no older than 72
hours) is below the market analyzer's 7-day p10 range; prices above the range are
labeled a good time to sell. Missing or unreliable prices still sell, with that
stated. Values use the better of the flea estimate (before fees) and trader offers.
[Decisions](../src/features/uploader/useUploaderDecisions.ts) hand kept units to
screenshot boxes in reading order, then to manual additions, so only the needed
number of copies is flagged Keep on the image.
The sort step reuses the review sidebar frame. A shared
[sidebar header](../src/features/uploader/UploaderSidebarHeader.tsx) shows Upload,
Classify, and Sort progress, the current goal, and one status line in every phase.
The [decision view](../src/features/uploader/UploaderDecisionView.tsx) has an
All/Keep/Sell/Hold filter with counts (keys 1–4) that darkens non-matching boxes,
Keep/Sell/Hold tiles (kept count, sell and hold value), manual additions as small
icons, and an inspector for the clicked item: Keep/Sell/Hold split, owned versus
needed, where to sell (flea market or the best trader, with the unit price before flea fees) under the Sell or Hold
quantity, a plain-language reason built from the item's needs plus a price-timing note, uses with Now/level labels (any-of uses show filled
quantity and accepted option count), and prices. Left/Right arrows step through
visible items. Boxes become borderless overlays with bookmark (Keep), coins-in-hand
(Sell), or clock (Hold) markers in success, sell-value, and info colors.
Explicit Kept only and Everything buttons add this scan's quantities on top of
saved FIR/non-FIR counts through `addItemCounts`. Sends are tracked per scan; the
summary subtracts this scan's sends from saved inventory so kept copies stay kept.
After a send, the buttons become Undo, which reverses every send from this scan
(negative `addItemCounts` deltas, and unchecks Kappa items it checked off), and
Done, which opens the Inventory page. Unknown FIR quantities block sending. No
automatic inventory write occurs.
The seen-items list groups scanned and manual items
by stable item ID and FIR status, explicitly retaining unknown detected FIR.
[Found-in-raid detection](../src/features/uploader/found-in-raid.ts) compares a small
grayscale badge reference against the bottom-right corner of measured footprints, and
again on final boxes once icon matching has settled their sizes,
across nearby positions and scales. The badge remains upright regardless of item
rotation, and one text row higher where a stack count or durability line sits under
it. The threshold is calibrated on stash screenshots: corners without a badge scored at
most 0.52, badges over plain or dark art 0.58 to 0.98; badges over bright art (soap,
bleach) can still be missed. Only strong matches produce FIR; missing geometry, low resolution, and
weak/absent matches remain unknown, never automatically non-FIR. Screenshot-corner
fixtures cover actual badges, artwork, and the separate bottom-left transfer symbol.
The player can toggle FIR/non-FIR and undo that choice; unconfirmed detections
retain unknown status. Leaving the page, changing the image, or switching game
modes discards the review; there is no automatic inventory write or persistent import.
Items with no detected label are only found when their art clearly matches a loot
item; others can still be missed. Hidden container contents are not inferred. Catalog
slot dimensions are not retained by the item adapter or search manifest; sizes come
from measured borders or matched grid-icon dimensions.

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
Relations load on open for header totals and the Hideout/Quests tabs. Traders and
Crafting enable usage and acquisition queries only while selected, reusing the
existing mode/item caches. Until then only the selected item's price is requested;
recipe ingredient prices are deferred with those graphs. Tabs start on Hideout for
each item/mode and do not automatically select an unloaded recipe tab. Unknown
recipe counts are omitted, and empty tabs show explicit empty states.
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
initial Hideout rows: [getItemDetailViews](../src/server/queries/getItemDetailViews.ts)
selects only the unpriced relations view; complete data is hydrated into the client
query key and partial data is passed as a retryable fallback. Usage and acquisition
remain deferred until their tabs are selected, matching the dialog. Only the active
panel renders. Profile-dependent status (available/locked
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
focus variants. Buttons disable Firefox's restoration of dynamic disabled state
across reloads so React can hydrate the server-rendered attributes consistently.
[Badge](../src/components/ui/badge.tsx) keeps FiR, locked, completed,
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
API. Use it for new item icons and when replacing feature-local raw images. Keep
existing links, buttons, cards, prices, and other custom UI in their
owning feature; drop a display-only `ItemImage` into those wrappers rather than
moving feature behavior into the icon. Its only required prop is `item` (a name and optional image URLs); the default
is a display-only, unframed 44px square. Optional `size`, `foundInRaid`, `tool`, `completed`,
`quantity` (number or formatted progress), `selected`, and `framed` cover standard
variants; noninteractive `children` allow caller-owned overlays. Compact Hideout
requirements overlay price and inventory/required quantity inside the square;
the feature owns their formatting and calculation and keeps 4px padding around
the artwork. Trades and Crafting recipe inputs in item details show shortnames for
recipes that produce the viewed item and omit visible names in recipes that use it,
while retaining quantities, badges, accessible names, and previews; outputs
retain their names and barter limits. `ItemReference` composes `ItemImage` for both
its chip and row layouts. The `tool` boolean shows a solid blue wrench inside the
icon's bottom-left corner with a "Reusable tool (not consumed)" tooltip. Modal and
station crafting inputs pass their tool flag directly, without an adjacent tool chip.
Recipe cost recommendations match both
the item ID and tool status, keeping consumed and reusable entries distinct.
Completed icons dim and grayscale the artwork, hide FiR, tool,
quantity, and caller-owned overlays, and show a green checkmark centered over the
image. Selection remains visible. Standard frames have square corners; feature
wrappers retain their own styling.
Quest workspace objective previews show up to 10 item icons before an expandable
more button, with quantity and FiR overlays and names available through previews.
Item-detail trader, barter, and crafting rows share the quest rows' subtle gray hover background.
Item-detail and hover demand totals use the specific-item quest index: alternative
groups remain visible as uses but neither add FiR demand to every eligible item nor
subtract from that item's independent specific requirements.
FiR, tool, and quantity overlays extend 1px past their corners to overlap the slot border;
the gallery's custom price overlay uses the same edge alignment and compact typography.
Selection is a 1px border inset by 1px; quantities use a flat, borderless bottom-right chip.
`opensModal` requires
an item ID and reuses ItemLink's dialog and hover preview (`preview={false}` disables
the latter). `onClick` adds a custom action; when combined with `opensModal`, calling
`preventDefault()` cancels opening. Use a display-only image inside existing buttons.
The shared ItemThumbnail renderer tries icon, 512px, grid, then base images, advancing
on load failure and finally showing a placeholder. Existing thumbnail consumers use
the same renderer. Retain specialized grid artwork and custom surrounding layouts
where they serve a different purpose than an item icon. The development-only
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
not already available. After sustained hover intent, they request that quest's
full details and referenced item presentations through the shared per-quest cache;
they show loading, missing-data and retry states. Quest links disable route prefetch,
so merely listing links does not preload full quest records. Items checklist rows do not open item hover cards in Icon,
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
