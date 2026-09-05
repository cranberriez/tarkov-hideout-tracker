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
one compact selected-map definition via the [render API](<../src/app/api/maps/render/[mapKey]/route.ts>).
The browser receives the selected definition and SVG, not the complete source
metadata or raster tile paths. This static map service is an explicit exception
to the Tarkov repository; it is not a model for general page data access.

[pull-map-overlays.mjs](../scripts/pull-map-overlays.mjs) reduces upstream regular
map data into committed [map-overlays](../src/lib/data/map-overlays/) chunks.
[map-navigation-overlays](../src/server/services/map-navigation-overlays.ts) and
the [overlay API](<../src/app/api/maps/overlays/[mapKey]/route.ts>) return only the
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

The [SVG route](<../src/app/api/maps/render/[mapKey]/svg/route.ts>) derives upstream
URLs from validated configuration; it must not become an arbitrary URL proxy.
It applies [SVG layer processing](../src/server/services/map-svg-layers.ts), uses
the project user agent, and caches upstream fetches for seven days. Its browser
response uses one-day freshness and seven-day stale-while-revalidate. Render and
overlay JSON use one-hour freshness and one-day stale-while-revalidate.

Unsupported or unvalidated SVG definitions return an intentional unsupported
state. Icebreaker, The Lab, and The Labyrinth currently lack validated interactive
SVG paths. Keep author attribution and the configured CC BY-NC-SA 4.0 license
visible when changing the viewer.

## Validation

```bash
node --test --import jiti/register src/features/maps/map-projection.test.ts src/features/maps/map-floor-resolution.test.ts src/features/maps/map-view-transform.test.ts src/server/services/map-render-definitions.test.ts src/server/services/map-svg-layers.test.ts src/server/services/map-navigation-overlays.test.ts
node --test --import jiti/register src/features/quests/workspace/quest-detail-markers.test.ts src/features/quests/workspace/raid-planner-markers.test.ts
node --test scripts/pull-map-overlays.test.mjs
```

For visible changes, verify rotated maps, multi-floor maps, unsupported maps,
coincident objectives, visited-objective undo, and narrow/wide layouts as relevant.
