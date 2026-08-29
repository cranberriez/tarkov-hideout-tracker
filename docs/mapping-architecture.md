# Mapping Architecture

The shared mapping slice powers both the quests workspace Raid Planner and embedded
quest-detail objective maps. Map overlays such as extracts are not implemented yet.

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

Quest details render only objectives with precise positioned locations. Mapped
objectives receive a numbered, color-coded cue that matches their markers. The
detail viewer stays in a separate right-hand column, shows every positioned
objective for one map at a time, provides compact tabs when a quest spans maps,
and refits to an objective when the user chooses **Show on map**. Coincident
positions are collapsed across the whole quest, so several objectives performed
at the same spot share one marker and tooltip. A symbol belongs to the connected
objective/location group rather than to an individual point, so every possible
spawn for one objective reuses the same symbol. Objective rows label these as
**Multiple spawns** for possible-location data or **Multiple locations** for other
multi-point geometry. Factory and Night Factory share the daytime Factory group
and artwork. Objectives without coordinates remain unchanged and do not receive
fabricated markers.

## Projection

The projection follows the official tarkov.dev map implementation:

1. Treat world `x` and `z` as the horizontal map plane. World `y` is elevation.
2. Rotate `(x, z)` by `coordinateRotation`.
3. Apply `transform` as `[scaleX, offsetX, scaleY, offsetY]`, with the SVG vertical axis inverted.
4. Normalize against `svgBounds` when the artwork declares bounds that differ
   from gameplay bounds; otherwise use the projected map bounds.

Factory's 90-degree rotation is handled by this shared formula rather than a map-specific adjustment.
Reserve is the current map where dedicated SVG bounds matter. Its artwork has a
different vertical extent than its gameplay bounds, and using `svgBounds` avoids
a systematic vertical marker offset.

## SVG floors and layers

The compact render manifest retains each named SVG floor, its default visibility,
stack order, height extents, and optional local world-coordinate bounds. The
viewer resolves a marker's floor from its full XYZ position:

1. Match elevation (`y`) against each floor extent.
2. When an extent has local bounds, also require the marker's world `x/z` point
   to be inside one of those bounds.
3. Prefer spatially specific matches and preserve overlapping matches.
4. Fall back to the base layer when no configured floor matches.

The same-origin SVG route injects visibility rules for the selected named groups.
This keeps the upstream SVG as the artwork source while allowing several layers
to be composed at once. Ground is always included and is not selectable. Optional
layers use their configured default visibility and can be toggled independently.
Upper floors render above a fully opaque Ground layer. Numerically below-ground
layers render above a much more transparent Ground layer so their paths remain
legible. Hovering or focusing a mapped objective temporarily switches the optional
artwork to its resolved layer, then restores the manual selection. Markers and
outlines remain visible regardless of artwork-layer selection.

The control orders layers from highest to lowest representative Y value, with
fixed Ground between upper and below-ground groups. Below-ground classification
comes from numeric height bounds rather than names, covering labels such as
Garage, Bunkers, Tunnels, and Underground consistently.

Only layers with a validated `svgLayer` in `maps.json` are exposed. Interchange
supports Ground, 2nd Floor, and 3rd Floor; Reserve currently supports Ground and
Bunkers. Reserve's numbered upper-floor metadata does not name SVG groups, so
those floors cannot be toggled until the artwork metadata supplies group IDs.

## Rendering and support

`MapViewer` provides drag panning, cursor-anchored wheel zoom, button zoom,
fit-to-markers, objective-focused fitting, zone outlines, marker selection/focus, responsive sizing, and
visible map attribution. Its layer summary lists currently visible floors,
provides independent optional-layer toggles and per-floor marker counts, and adds the resolved
floor name to marker tooltips. Marker coordinates and size remain fixed on hover/focus.
Hovering a Raid Planner marker shows its objective tooltip without changing or
scrolling the quest list; clicking the marker selects, highlights, and scrolls to
its quest. Quest-list hover/focus can still highlight the corresponding map marker.
The Raid Planner keeps each map's pan and zoom
in session memory, so opening a marker's quest details and returning to the
planner restores the same view without adding persistent user-store fields.

The layer control is anchored at the bottom-left and expands upward with an
explicit collapse caret. Zoom is capped at 7x. Every manual, remembered, focused,
or cursor-anchored view is constrained against the scaled artwork dimensions, so
panning can reach the map edges but cannot move the artwork completely outside
the viewport. Attribution appears by itself in the Raid Planner's top-right
overlay row.
Embedded quest-detail maps use a smaller text-only attribution treatment with a
faint background so licensing remains visible without occupying meaningful map
space.

The quest-detail consumer loads `MapViewer` as a client-only dynamic chunk. Its
quest-specific marker payload is memoized, and map updates use a deferred value so
the header and textual details can switch before the SVG viewer performs its next
projection/render pass.

The Raid Planner map picker spans the available planner pane and summarizes only
profile-active quests. Each map card groups those quests by objective category,
calls out category counts that require keys, and shows the deduplicated required
keys as compact image tiles with Tarkov short names and full-name hover text.
Supported cards reuse the same proxied Tarkov.dev SVG artwork as the map
viewer; unsupported maps remain text-only. The selected-map marker set also uses
only active quests, regardless of the workspace's completed, failed, or locked
status filters.

Icebreaker, The Lab, and The Labyrinth currently return an intentional unsupported state because their configured interactive entries do not have validated SVG paths.

SVG maps are attributed to their configured authors and the `CC BY-NC-SA 4.0` license in the viewer.

## Caching

The normalized full-quest Redis cache is `quests:full:v13:{regular|pve|pvp-season}`. The version changed because objective geometry is now part of `FullQuest`.

Render manifests are deterministic server-side reductions of the committed metadata. The selected SVG proxy uses framework fetch caching and browser stale-while-revalidate headers. No Zustand persistence fields, keys, versions, or quest ID keys change.
