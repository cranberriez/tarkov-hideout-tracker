# Maps

The shared [MapViewer](../src/features/maps/MapViewer.tsx) powers Raid Planner
and embedded quest details. [Quest domain behavior](quests.md) owns active/visited
objective selection; this document owns geometry, projection, and asset delivery.

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

The battle-pass overview opens a separate, lazily loaded
[document map view](../src/features/battle-pass/components/BattlePassMapView.tsx)
at `/battle-pass/map`, without site navigation. Browser back and forward navigate
between the overview and the map. The `map` query parameter selects a map by slug
(for example, `/battle-pass/map?map=reserve`). Each history entry retains zoom,
pan, floor filters, document filters, and the grayscale/color setting; changing maps creates an entry, while
changing the view or filters updates the current entry. Shared links select the
map with default view and filters, and unknown slugs fall back to Factory.
This view uses the document palette and artwork,
with a scenic map switcher in the top bar and each map's two document icons.
The switcher fits the viewport, wrapping on narrow screens without horizontal scrolling.
Hide collapses the selector; icon-only Close and Show maps controls then float
over the map's top-right corner. Selector document artwork is enlarged with a
dark shadow for contrast against the scenic backgrounds.
Document-type filters and source-reported per-raid counts float over the map at the bottom
center; the floating bottom-right floor checklist starts with every floor selected and
supports multiple floors. Possible location counts are separate from per-raid
document counts. Lock badges identify source records with a required key.
Hover or keyboard focus opens a large location-photo preview; clicking pins it.
The preview header groups the document icon with its type and location name.
Closing the map returns to the battle-pass overview without changing saved
progress. View state is stored in a namespaced browser-history field, preserving
Next.js history metadata; it does not write player saves or local storage.
Crowded markers use small document-colored shapes with fixed black outlines.
Separated markers retain the full document artwork. Residual displacement for
overlapping anchors uses contrasting anchor dots and leader lines, preserving
the true source positions and access to lock indicators and photo previews.
Hovering or focusing a compact marker reveals its full document artwork without
moving its anchor. The document map allows panning up to half the scaled artwork's
width or height beyond the usual edge limits; other map viewers retain their
existing pan bounds. Basemaps start in grayscale, with a color toggle beside the
zoom and reset controls. The color choice carries across map switches and is
restored with its history entry. Document colors and location photos remain in color.

Document locations use native image-pixel coordinates and their matching source
map layers. They are not world-space quest coordinates and must not be passed
through the quest map projection or plotted on a replacement basemap without a
verified transform. The shared pan/zoom utilities can still be reused.

The [background registry](../src/lib/data/battle-pass-map-backgrounds.json) records
verified Tarkov.dev raster replacements, dimensions, registrations, and landmark
evidence. Ground Zero, Icebreaker, Lighthouse, Reserve, Shoreline, Streets, and
Woods currently use same-canvas originals with their full colors and labels;
these have the same resolution as the source backgrounds. Factory uses re3mr's
6720 × 3328 full-color sheet with separate top, middle, ground, and tunnels panels.
Its source overview combines these floors, so every document has a manually
registered target position keyed by ID and its original coordinates, floor, and
layer. Wall corners, stairs, corridor bends, and reactor centers provide the
recorded artwork correspondences; this does not independently verify in-game
spawns or resolve source room/title inconsistencies. The five source-unconfirmed
Factory locations remain unconfirmed. The basement body anchor outside the
source's drawn basement inset retains its position relative to the shared ground
geometry, as recorded in its calibration note. Customs,
Interchange, The Lab, and The Labyrinth retain their source images because their
alternate artwork or floor layouts do not have verified registrations. The
[background resolver](../src/features/battle-pass/lib/battle-pass-map-background.ts)
validates registrations before projecting markers. Manual registrations require
complete unique source coverage, matching source image and dimensions, unchanged
coordinates/floors/layers, and target positions within the replacement canvas.
Incomplete or stale calibrations restore the complete original view; manual
projection requires a calibrated document ID. Image failures or unexpected
replacement dimensions restore the original image and coordinates together.
Document IDs, lock metadata, and location photos are unchanged by projection.

The committed source snapshot is refreshed explicitly from the structured public
map-page data at [TarkovDoc](https://tarkovdoc.com/maps/), with typed exports in
[battle-pass-map-data](../src/lib/battle-pass-map-data.ts). Source links and asset
attribution remain visible in the map view. Source verification status is retained;
unconfirmed locations and missing photos must remain explicit. Images are loaded
from their source URLs as needed, with loading and failure states.

Refresh with `node scripts/extract-battle-pass-map-data.mjs --download`.
The extractor validates the complete map set, document keys, unique location IDs,
layer dimensions, and coordinate bounds before replacing the generated snapshot.
Failed or incomplete pulls leave the previous snapshot intact.

## Validation

```bash
node --test scripts/extract-battle-pass-map-data.test.mjs
node --test --import jiti/register src/features/battle-pass/lib/battle-pass-map-layout.test.ts
node --test --import jiti/register src/features/battle-pass/lib/battle-pass-map-background.test.ts src/features/battle-pass/lib/battle-pass-map-controls.test.ts
node --test --import jiti/register src/features/battle-pass/lib/battle-pass-map-navigation.test.ts
node --test --import jiti/register src/features/maps/map-projection.test.ts src/features/maps/map-floor-resolution.test.ts src/features/maps/map-view-transform.test.ts src/server/services/map-render-definitions.test.ts src/server/services/map-svg-layers.test.ts src/server/services/map-navigation-overlays.test.ts
node --test --import jiti/register src/features/quests/workspace/quest-detail-markers.test.ts src/features/quests/workspace/raid-planner-markers.test.ts
node --test scripts/pull-map-overlays.test.mjs
```

For visible changes, verify rotated maps, multi-floor maps, unsupported maps,
coincident objectives, visited-objective undo, and narrow/wide layouts as relevant.
