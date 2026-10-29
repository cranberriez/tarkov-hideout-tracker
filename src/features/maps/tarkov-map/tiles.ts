import { planeRect, projectionFor } from "./projection";
import type { MapCalibration, MapFloor, PlaneRect } from "./types";

export type Tile = { z: number; x: number; y: number; path: string; rect: PlaneRect };

export const tilePathAt = (template: string, z: number, x: number, y: number) =>
  template.replace("{z}", String(z)).replace("{x}", String(x)).replace("{y}", String(y));

/** Plane rectangle tiles are limited to (Leaflet's `bounds` option). */
export const tileBounds = (map: MapCalibration) => planeRect(projectionFor(map), map.bounds);

/** Native zoom for a view scale (screen px per plane unit), clamped to available tiles. */
export function tileZoom(map: MapCalibration, scale: number): number {
  const max = map.maxZoom ?? 0;
  return Math.min(max, Math.max(0, Math.round(Math.log2(scale))));
}

/** Tile index range at zoom `z` covering `rect`, intersected with the map's tile bounds. */
export function tileRange(map: MapCalibration, z: number, rect: PlaneRect = tileBounds(map)) {
  const bounds = tileBounds(map);
  const size = (map.tileSize ?? 256) / 2 ** z;
  const left = Math.max(rect.x, bounds.x), top = Math.max(rect.y, bounds.y);
  const right = Math.min(rect.x + rect.width, bounds.x + bounds.width);
  const bottom = Math.min(rect.y + rect.height, bounds.y + bounds.height);
  if (right < left || bottom < top) return null;
  // Half-open: an edge exactly on a tile boundary does not pull in the next tile.
  const last = (edge: number, first: number) => Math.max(first, Math.ceil(edge / size - 1e-9) - 1);
  const x0 = Math.floor(left / size), y0 = Math.floor(top / size);
  return { x0, x1: last(right, x0), y0, y1: last(bottom, y0), size };
}

/** Tiles of one tile set at zoom `z` within `rect`, each with its plane rectangle. */
export function tilesIn(map: MapCalibration, template: string, z: number, rect?: PlaneRect): Tile[] {
  const range = tileRange(map, z, rect);
  if (!range) return [];
  const tiles: Tile[] = [];
  for (let y = range.y0; y <= range.y1; y++) {
    for (let x = range.x0; x <= range.x1; x++) {
      tiles.push({ z, x, y, path: tilePathAt(template, z, x, y), rect: { x: x * range.size, y: y * range.size, width: range.size, height: range.size } });
    }
  }
  return tiles;
}

/** Distinct tile set templates of a map: the base first, then floors. */
export function tileSets(map: MapCalibration): string[] {
  return [...new Set([map.tilePath, ...map.layers.map((floor: MapFloor) => floor.tilePath)].filter((path): path is string => !!path))];
}

/** Number of tiles a full download of a map takes (every tile set, zoom 0 to max). */
export function tileCount(map: MapCalibration): number {
  let count = 0;
  for (let z = 0; z <= (map.maxZoom ?? -1); z++) {
    const range = tileRange(map, z);
    if (range) count += (range.x1 - range.x0 + 1) * (range.y1 - range.y0 + 1);
  }
  return count * tileSets(map).length;
}
