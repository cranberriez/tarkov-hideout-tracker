// Tarkov map library: game map identities, vendored SVG artwork, tarkov.dev calibration and tile paths,
// world → map projection, floors, overlay markers from tarkov.dev data, player positions, and the `<TarkovMap>`
// component that draws them. Self-contained: imports nothing from the rest of the app. See README.md.
// Refresh the vendored data with `node scripts/vendor-maps.mjs`.
export type * from "./types";
export type * from "./data";
export { ASSET_HOST, DATA_HOST, TILE_HOST } from "./hosts";
export { games, mapName, maps, mapSources, normalizeMapName, resolveGame, resolveMap } from "./catalog";
export { setRooms } from "./roomData";
export { heightMiss, inRoom, nearestRoom, roomAt, roomBox, roomCorners, roomRings, tenth, toRoom, type MapRoom, type RoomRect, type RoomShape } from "./rooms";
export { artRect, metricProjection, planeRect, projectionFor, type MapProjection } from "./projection";
export { baseFloor, extentsAt, floorAt, floorById, floorLevels, floorOf, floorOrder, floorsOf, GROUND, levelText, UNDERGROUND_OPACITY, type ExtentHit, type Floor, type FloorSelection } from "./floors";
export { tileBounds, tileCount, tilePathAt, tileRange, tileSets, tileZoom, tilesIn, type Tile } from "./tiles";
export { iconUrl, MapAssetsContext, useMapAssets, webAssets, type MapAssets } from "./assets";
export { containerIcon, mapIcons } from "./icons";
export { documentLocations, documentPhoto, documentSource, type DocumentLocation } from "./documents";
export { tarkovPreset, type CategoryDef, type DocumentType, type DynamicLayer, type GroupDef, type LayerDef, type MarkerPreset } from "./markerPreset";
export {
  allFloorsOn, buildMarkers, countMarkers, defaultFilters, groupOn, isVisible, layerState, layersFor, markerIcon, markerTint, roleOf, sameFilters,
  toggleLayer, withDefaults, type BossInfo, type Detail, type Filters, type LayerFilter, type Lookups, type MapMarker, type Role,
} from "./markers";
export { freshness, usePlayerTracks, withPosition, type PlayerPosition, type PlayerTrack, type TrackInfo } from "./players";
export { translate } from "./translate";
export { initialView, useMapViewport, type MapViewport, type View } from "./useMapViewport";
export { MapArt, loadMapSvg, type FloorSlot } from "./MapArt";
export { MapTiles, type TileView } from "./MapTiles";
export { MapOverlay, type OverlayArea } from "./MapOverlay";
export { artStyleOf, TarkovMap, type ArtStyle, type MapDrawView, type TarkovMapHandle, type TarkovMapProps } from "./TarkovMap";
