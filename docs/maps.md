# Maps

The [maps explorer](#maps-explorer) at `/maps` and the condensed
[quest objective map](#quest-objective-map) share one map stack, ported from
tarkov-mappinator. [Quest domain behavior](quests.md) owns active/visited
objective selection; this document owns geometry, projection, and asset delivery.

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

## Quest objective map

The quest details pane shows [QuestObjectivesMap](../src/features/maps/explorer/quests/QuestObjectivesMap.tsx)
beside (wide screens) or over (compact) the quest. It is the explorer's map reduced to
one quest's objective markers: the same `TarkovMap`, quest marker builder
([buildQuestMarkers](../src/features/maps/explorer/quests/quest-map-markers.ts)), glyphs
and marker card, with only a floor picker and zoom buttons. There is no legend, map
switcher, nav or full-screen toggle, layers panel or quest drawer, and no saved map
preferences. It fetches no map or quest data: markers derive from the quest already in
the details pane (objectives marked done are left out) and only the art and tiles load.
Quests on several maps switch between them in the pane header; the map remounts per quest
and map. Hovering an objective in the list fades the other objectives' markers; "Show on
map" pins the objective's marker, switching to its floor and centring on it, and again moves to
its next location. Objectives without coordinates stay textual.

## Data and service boundary

[quest-objective-locations](../src/server/services/quest-objective-locations.ts)
normalizes optional objective geometry into [map types](../src/types/maps.ts)
and [quest objectives](../src/types/quests.ts) during release generation. Locations
may carry a map, XYZ position, outline, heights, and `zone`/`possibleLocation`
source. Omit invalid optional points; never fabricate a position from an outline.

Maps index cards use local scenic WebP thumbnails in
[public/images/maps](../public/images/maps/README.md), at most 480 × 288. The asset
directory records sources and attribution.

[pull-map-overlays.mjs](../scripts/pull-map-overlays.mjs) reduces upstream regular
map data into committed [map-overlays](../src/lib/data/map-overlays/) chunks. Only the
manifest is read at runtime (by [sync-model](../src/features/sync/sync-model.ts), to match
raid maps). Refreshes are explicit maintenance operations; see [operations](operations.md).

## Projection, floors, and markers

The `tarkov-map` library owns projection and floors: world X/Z are the horizontal
plane and Y is elevation, calibrated per map (rotation, transform, art bounds), and
[floors](../src/features/maps/tarkov-map/floors.ts) are resolved from Y extents and
optional local bounds, falling back to the base floor. A pinned marker shows its own floor
until unpinned. Quest marker colours are mid-bright per quest
([QuestMarkerGlyph](../src/features/maps/explorer/quests/QuestMarkerGlyph.tsx)); the
objective type's icon sits on the disc. Factory and Night Factory share artwork.
Objectives without coordinates stay textual.

## Assets

Vector art and icons are served from `public/maps/`; tiles come from the configured tile
host. A map without art draws a plain metric grid. Keep author attribution and licenses
visible (see the library's [attribution](../src/features/maps/tarkov-map/ATTRIBUTION.md)).

## Battle-pass document maps

Battle Pass document locations are a layer of the [maps explorer](#maps-explorer).
The Battle Pass overview and Season overview link to
`/maps?preset=documents`, which opens maps with only documents and extracts shown.
Location photos stay bundled under
`public/images/battle-pass/map-assets/tarkovdoc.com/assets/previews`.

## Validation

```bash
node --test --import jiti/register src/features/quests/workspace/quest-detail-markers.test.ts
node --test scripts/pull-map-overlays.test.mjs
```

For visible changes, verify rotated maps, multi-floor maps, unsupported maps,
visited-objective undo, and narrow/wide layouts as relevant.

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
