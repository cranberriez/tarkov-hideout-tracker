# Mapping Architecture

The first mapping slice powers the quests workspace Raid Planner. Quest-detail maps and map overlays such as extracts are intentionally not implemented yet.

## Data flow

```text
json.tarkov.dev/{mode}/tasks
  -> questsJson objective adapter
  -> FullQuestObjective.locations
  -> Raid Planner marker adapter

src/lib/data/maps.json
  -> server-only compact reducer
  -> /api/maps/render/{mapKey}
  -> shared MapViewer
```

The browser receives only the selected compact render definition and selected SVG. It never receives the complete `maps.json` source or any raster tile paths. SVG assets are fetched through a same-origin, allow-listed server route using the project user agent.

## Objective locations

Each normalized objective can carry `locations`, with a hydrated map identity, optional 3D position, optional outline, optional top/bottom heights, and a source of `zone` or `possibleLocation`. Invalid optional points are omitted; positions are never fabricated from outlines.

The Raid Planner renders positioned `zone` and quest-item `possibleLocation`
records. Every possible spawn for a quest item uses the quest's shared symbol.
Locations within the same quest whose coordinates match to the nearest centimeter
are represented by one marker; their objective descriptions, objective IDs, and
distinct outlines are merged into that marker.

## Projection

The projection follows the official tarkov.dev map implementation:

1. Treat world `x` and `z` as the horizontal map plane. World `y` is elevation.
2. Rotate `(x, z)` by `coordinateRotation`.
3. Apply `transform` as `[scaleX, offsetX, scaleY, offsetY]`, with the SVG vertical axis inverted.
4. Normalize against the projected map bounds for SVG percentage placement.

Factory's 90-degree rotation is handled by this shared formula rather than a map-specific adjustment.

## Rendering and support

`MapViewer` provides drag panning, cursor-anchored wheel zoom, button zoom,
fit-to-markers, zone outlines, marker selection/focus, responsive sizing, and
visible map attribution. Marker coordinates and size remain fixed on hover/focus;
only the highlight ring and objective tooltip change. Quest hover/focus and map
marker focus remain synchronized.

Icebreaker, The Lab, and The Labyrinth currently return an intentional unsupported state because their configured interactive entries do not have validated SVG paths. Floor definitions and height extents are retained in the compact manifest for a later floor-control pass; the initial viewer displays the SVG's default layer.

SVG maps are attributed to their configured authors and the `CC BY-NC-SA 4.0` license in the viewer.

## Caching

The normalized full-quest Redis cache is `quests:full:v13:{regular|pve|pvp-season}`. The version changed because objective geometry is now part of `FullQuest`.

Render manifests are deterministic server-side reductions of the committed metadata. The selected SVG proxy uses framework fetch caching and browser stale-while-revalidate headers. No Zustand persistence fields, keys, versions, or quest ID keys change.
