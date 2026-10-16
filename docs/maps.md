# Maps

The shared [MapViewer](../src/features/maps/MapViewer.tsx) powers Raid Planner
and embedded quest details. [Quest domain behavior](quests.md) owns active/visited
objective selection; this document owns geometry, projection, and asset delivery.
The [Maps explorer](#maps-explorer) at `/maps` is a separate map stack ported from
tarkov-mappinator; the two do not share code yet.

## Maps explorer

`/maps` lists the explorer maps from [map-explorer config](../src/lib/cfg/map-explorer.ts),
which also feeds the Maps nav menu. Its visibility presets (Standard, Documents,
Extracts & spawns, Loot, Bosses & hazards) are links: the chosen
preset rides on each map link as `?preset=`, is applied once the map's layers are
known, and is then dropped from the URL. They are only offered on `/maps`, not on
the map itself. A preset lists the layers it shows; every other layer, including
groups that only exist in a map's data, is switched off.

`/maps/[mapKey]` renders the client-only [MapExplorer](../src/features/maps/explorer/MapExplorer.tsx)
full-screen below the site nav, without the footer. It keeps mappinator's controls:
tiered layers panel with three saved filter slots, floor picker, split floors,
vector/tile art, zoom, valuable-loot icons, hover/pinned marker cards and the map
switcher. Raid tracking (positions, follow, scrubber, group members) and dev tools
were left out. Preferences live in `tarkov-map-explorer-preferences-v1`
(see [user state](user-state.md)).

While Mappinator sync is connected, the explorer draws the synced player (position trail, newest as a heading pointer, only positions taken on the shown map) through [useSyncedPlayer](../src/features/maps/explorer/useSyncedPlayer.ts). Group members Mappinator reports on the player's raid map (`state.group`, latest position only, session-only store state) are drawn as coloured peer markers with an initial badge; colours stay stable while a member stays in the group. A crosshair button, shown only while sync is connected, follows the newest position and picks its floor; panning or choosing a floor stops following. Follow is off by default and is session state.

The map library is vendored in [tarkov-map](../src/features/maps/tarkov-map/) and
kept close to upstream so it can be re-synced (it is excluded from lint). Local changes:
SVGs and icons are served from `public/maps/`, floor data and document JSON are
static imports, the browser tarkov.dev source was removed, and document photos point
at this app's battle-pass previews instead of vendored copies. Floor data, document
links and lock flags are curated in mappinator; copy updates from there. See its
[attribution](../src/features/maps/tarkov-map/ATTRIBUTION.md) for licenses.

Marker data comes from [the explorer route](../src/app/api/maps/explorer/[mapKey]/route.ts)
(`?mode=`), served by [map-explorer-data](../src/server/services/map-explorer-data.ts).
It fetches `/<mode>/maps` and `maps_en` from json.tarkov.dev, translates, validates
(an empty or malformed set throws instead of publishing), and splits per map with only
the containers, guns and mobs that map refers to. Each instance reuses a mode's split
for six hours and keeps serving the previous good set if a refresh fails. Responses
are browser-cached for an hour and CDN-cached for six; the browser query is keyed by
mode in the game-data scope.

Loose loot spawns get handbook categories (two levels, posters split out) from the
committed [loot category table](../src/lib/data/map-loot-categories.json), refreshed with
`npm run pull-map-loot-categories`; items missing from it stay uncategorised. Item names
come from the search manifest. Prices load only while valuable-loot icons are on, as
one shared price request for that map's loose loot items.

Quest objectives are the explorer's own layer, added to the library preset in
[quest-map-markers](../src/features/maps/explorer/quests/quest-map-markers.ts), with one group
per objective type present on the map. [useMapQuests](../src/features/maps/explorer/quests/useMapQuests.ts)
derives the profile's active, non-ignored quests on the map from the shared quest index
(status is computed, never stored) and loads full details only for those. Each positioned
objective location becomes a marker (zones keep their outline); objectives marked done are
left out. The right-edge [quest drawer](../src/features/maps/explorer/quests/MapQuestDrawer.tsx)
lists those quests by trader (filterable by objective type, with a kill summary for Kill)
or shows one quest. Markers draw the objective type's icon on a disc in the quest's colour,
which the list repeats. Hovering a quest or objective there dims other quest markers,
hovering a quest marker marks and scrolls to its row, and clicking either opens its
details; the open quest's markers show even when the quest layer's filters hide them, and unpinning one returns to the list. Clicking a placed objective
pins and pans to its marker, cycling through its locations. Drawer state is session-only.

## Data and service boundary

[quest-objective-locations](../src/server/services/quest-objective-locations.ts)
normalizes optional objective geometry into [map types](../src/types/maps.ts)
and [quest objectives](../src/types/quests.ts) during release generation. Locations
may carry a map, XYZ position, outline, heights, and `zone`/`possibleLocation`
source. Omit invalid optional points; never fabricate a position from an outline.

[maps.json](../src/lib/data/maps.json) is reduced by
[map-render-definitions](../src/server/services/map-render-definitions.ts) into
one compact selected-map definition via the [render API](../src/app/api/maps/render/[mapKey]/route.ts).
The browser receives the selected definition and SVG, not the complete source
metadata or raster tile paths. This static map service is an explicit exception
to the Tarkov repository; it is not a model for general page data access.

Raid Planner selection cards use local scenic WebP thumbnails in
[public/images/maps](../public/images/maps/README.md), not the render API or full
SVGs. Thumbnails are at most 480 × 288. The Lab and The Lab (Dark) share one planner
card and Lab geometry; their quest counts, keys, and markers are combined without
changing source IDs or the quest workspace's map filters.
The asset directory records sources and attribution. The interactive map still
loads its detailed SVG only after selection.

[pull-map-overlays.mjs](../scripts/pull-map-overlays.mjs) reduces upstream regular
map data into committed [map-overlays](../src/lib/data/map-overlays/) chunks.
[map-navigation-overlays](../src/server/services/map-navigation-overlays.ts) and
the [overlay API](../src/app/api/maps/overlays/[mapKey]/route.ts) return only the
selected map's PMC extracts and transits. Boss chunks are retained for future
work but are not displayed. Refreshes are explicit maintenance operations;
see [operations](operations.md).

## Projection, floors, and markers

[map-projection](../src/features/maps/map-projection.ts) projects world X/Z as the
horizontal plane and Y as elevation: rotate by `coordinateRotation`, apply the
configured transform with inverted SVG vertical axis, then normalize to `svgBounds`
when supplied or projected gameplay bounds otherwise. This handles Factory rotation
and Reserve's artwork extent through metadata rather than ad hoc offsets.

[map-floor-resolution](../src/features/maps/map-floor-resolution.ts) checks Y
extents and optional local X/Z bounds, prefers spatially specific matches, preserves
overlap, and falls back to Ground. Only validated named SVG groups are selectable.
Ground stays present; optional layers toggle independently. Below-ground treatment
uses numeric heights, not names. [map-svg-layers](../src/server/services/map-svg-layers.ts)
controls visibility and paint order. Hover/focus can temporarily preview an objective's
floor without overwriting the manual selection; markers remain visible across layers.

[quest-detail-markers](../src/features/quests/workspace/quest-detail-markers.ts)
and [raid-planner-markers](../src/features/quests/workspace/raid-planner-markers.ts)
group positioned objectives. Coincident locations are merged with their objective
IDs and distinct outlines; possible spawns retain a shared objective/quest color.
Group colors cycle through the documented chart palette in
[globals.css](../src/app/globals.css), referenced by
[visualization colors](../src/lib/cfg/visualization-colors.ts). Extract/transit
payloads carry CSS references to the separate `map-extract` and `map-transit`
roles. The viewer resolves these roles in the application theme; upstream map
artwork keeps its original colors.
Filtering visited objectives precedes grouping so shared markers retain only the
remaining objectives. Factory and Night Factory share artwork. Objectives without
coordinates stay textual.

[map-view-transform](../src/features/maps/map-view-transform.ts) owns pan/zoom
constraints and fitting. The viewer supports cursor-anchored zoom, drag, marker
focus/popups, outlines, optional floors, and visible attribution. Planner viewport
state is remembered per map in session state, with drag updates kept local until
completion. Extract/transit zones have optional persistent labels. Clicking a quest
marker navigates to its quest; hover does not scroll the quest list.

## Assets, unsupported maps, and caching

The [SVG route](../src/app/api/maps/render/[mapKey]/svg/route.ts) derives upstream
URLs from validated configuration; it must not become an arbitrary URL proxy.
It applies [SVG layer processing](../src/server/services/map-svg-layers.ts), uses
the project user agent, and caches upstream fetches for seven days. Its browser
response uses one-day freshness and seven-day stale-while-revalidate. Render and
overlay JSON use one-hour freshness and one-day stale-while-revalidate.

[MapViewer](../src/features/maps/MapViewer.tsx) reads the compact render definition
through a map-keyed TanStack query with one-hour freshness, 24-hour inactive
retention, and no automatic retry. Raid Planner reads its committed overlay chunk
through a second map-keyed Query with the same policy. The processed SVG remains
an ordinary browser asset request; these mode-independent map queries do not enter
the game-data cache.

Unsupported or unvalidated SVG definitions return an intentional unsupported
state. Icebreaker, The Lab, and The Labyrinth currently lack validated interactive
SVG paths. Keep author attribution and the configured CC BY-NC-SA 4.0 license
visible when changing the viewer.

## Battle-pass document maps

Battle Pass document locations are a layer of the [maps explorer](#maps-explorer).
The Battle Pass overview and Season overview link to
`/maps?preset=documents`, which opens maps with only documents and extracts shown.
Location photos stay bundled under
`public/images/battle-pass/map-assets/tarkovdoc.com/assets/previews`.

## Validation

```bash
node --test --import jiti/register src/features/maps/map-projection.test.ts src/features/maps/map-floor-resolution.test.ts src/features/maps/map-view-transform.test.ts src/server/services/map-render-definitions.test.ts src/server/services/map-svg-layers.test.ts src/server/services/map-navigation-overlays.test.ts
node --test --import jiti/register src/features/quests/workspace/quest-detail-markers.test.ts src/features/quests/workspace/raid-planner-markers.test.ts
node --test scripts/pull-map-overlays.test.mjs
```

For visible changes, verify rotated maps, multi-floor maps, unsupported maps,
coincident objectives, visited-objective undo, and narrow/wide layouts as relevant.

## Seasonal document ownership

[battle-pass-seasons.ts](../src/lib/battle-pass-seasons.ts) associates each season
with its pass rewards, document IDs, location summaries, thumbnails and artwork.
Test currently uses an independent clone of the Season 1 snapshot and is labeled
as placeholder data. Replace Test's registry data when reviewed Season 2 data is
available; retain Season 1's snapshot and stable entity IDs. Map document
locations in [documents.ts](../src/features/maps/tarkov-map/documents.ts) are
season-specific and not yet keyed by season. Character inventory and
account-wide pass progress follow the season scopes documented in
[user state](user-state.md#battle-pass-progress).
