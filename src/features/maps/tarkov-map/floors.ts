import type { FloorExtent, MapCalibration, MapFloor, WorldArea, WorldBounds, WorldPoint } from "./types";
import { roomAt } from "./rooms";

/** Id of a map's ground floor when its base art is not one of the floors tarkov.dev lists. */
export const GROUND = "ground";

/**
 * A floor of a map. A floor goes by one id everywhere: listed floors by their tarkov.dev name, and the map's
 * base art, when no listed floor draws it, by `GROUND`.
 */
export type Floor = {
  id: string;
  /** Display name. */
  name: string;
  /** Drawn by the map's base art; every map has exactly one, listed first. */
  base: boolean;
  underground: boolean;
  /** Id of the top-level `<g>` in the SVG, when the vector art has this floor. */
  svgLayer?: string;
  /** Tile path template, when tiles exist for this floor. */
  tilePath?: string;
  extents?: FloorExtent[];
};

/** The floors shown: one floor's id, or null for every floor. */
export type FloorSelection = string | null;

/** Opacity of underground floors drawn over the ground when every floor is shown. */
export const UNDERGROUND_OPACITY = 0.3;

/** A floor below the ground: tarkov.dev gives these an open-ended lower height bound. */
const underground = (layer: Pick<MapFloor, "extents">) => !!layer.extents?.some((extent) => extent.height[0] <= -1000);

const cache = new WeakMap<MapCalibration, Floor[]>();

/** A map's floors: the base first, then the others in tarkov.dev's order. */
export function floorsOf(map: MapCalibration): Floor[] {
  let floors = cache.get(map);
  if (floors) return floors;
  // A listed floor drawn by the base art (Icebreaker's Infirmary) is the base floor itself.
  const drawsBase = (layer: MapFloor) =>
    (!!layer.tilePath && layer.tilePath === map.tilePath) || (!!layer.svgLayer && layer.svgLayer === map.svgLayer);
  const baseLayer = map.layers.find(drawsBase);
  const listed = map.layers.map((layer): Floor => ({
    id: layer.name, name: layer.name, base: layer === baseLayer, underground: underground(layer),
    svgLayer: layer.svgLayer ?? (layer === baseLayer ? map.svgLayer : undefined),
    tilePath: layer.tilePath ?? (layer === baseLayer ? map.tilePath : undefined), extents: layer.extents,
  }));
  const base: Floor = listed.find((floor) => floor.base)
    ?? { id: GROUND, name: map.svgLayer?.replace(/_/g, " ") ?? "Ground", base: true, underground: false, svgLayer: map.svgLayer, tilePath: map.tilePath };
  floors = [base, ...listed.filter((floor) => floor !== base)];
  cache.set(map, floors);
  return floors;
}

const orders = new WeakMap<MapCalibration, Map<string, number>>();

/** Floor id → place bottom to top: underground floors, then the base, then the rest as tarkov.dev lists them. */
export function floorOrder(map: MapCalibration): Map<string, number> {
  let order = orders.get(map);
  if (order) return order;
  const floors = floorsOf(map);
  order = new Map([...floors.filter((floor) => floor.underground), ...floors.filter((floor) => floor.base && !floor.underground),
    ...floors.filter((floor) => !floor.base && !floor.underground)].map((floor, rank) => [floor.id, rank]));
  orders.set(map, order);
  return order;
}

const bound = (height: number) => Math.abs(height) >= 1000 ? null : +height.toFixed(1);

/** "Y 10 – 15", "Y > 25", "Y < -6": the heights a height range covers, for display. */
export function levelText([low, high]: [number, number]): string {
  const lo = bound(low), hi = bound(high);
  return lo === null ? hi === null ? "Y any" : `Y < ${hi}` : hi === null ? `Y > ${lo}` : `Y ${lo} – ${hi}`;
}

/**
 * The height range a floor covers, for display. On a map with rooms, the span of its rooms' heights (the base floor has
 * none: it is wherever no room is). Otherwise its listed extents, or for the base floor (which tarkov.dev does not list)
 * the gap between the floors below and above it. Null when the map gives nothing to go on.
 */
export function floorLevels(map: MapCalibration, floor: Floor): [number, number] | null {
  if (map.rooms) {
    const rooms = map.rooms.filter((room) => room.floor === floor.id);
    if (!rooms.length) return null;
    return [Math.min(...rooms.map((room) => room.height[0] ?? -10000)), Math.max(...rooms.map((room) => room.height[1] ?? 10000))];
  }
  if (floor.extents?.length) return [Math.min(...floor.extents.map((extent) => extent.height[0])), Math.max(...floor.extents.map((extent) => extent.height[1]))];
  if (!floor.base) return null;
  const others = floorsOf(map).filter((other) => other !== floor && other.extents?.length);
  const below = others.filter((other) => other.underground).flatMap((other) => other.extents!.map((extent) => extent.height[1]));
  const above = others.filter((other) => !other.underground).flatMap((other) => other.extents!.map((extent) => extent.height[0]));
  return below.length || above.length ? [below.length ? Math.max(...below) : -10000, above.length ? Math.min(...above) : 10000] : null;
}

/** The base floor of a map. */
export const baseFloor = (map: MapCalibration): Floor => floorsOf(map)[0];

/** A floor by id, or null when the map has none by that id. */
export const floorById = (map: MapCalibration, id: string | null | undefined): Floor | null =>
  id == null ? null : floorsOf(map).find((floor) => floor.id === id) ?? null;

const within = ([[x1, z1], [x2, z2]]: WorldBounds, { x, z }: WorldPoint) =>
  x >= Math.min(x1, x2) && x <= Math.max(x1, x2) && z >= Math.min(z1, z2) && z <= Math.max(z1, z2);

/** How far outside an area's edge a point still counts as in it (m): footprints are drawn tight to the walls. */
export const AREA_MARGIN = 1;

const insideArea = (area: WorldArea, { x, z }: WorldPoint) => {
  let result = false;
  for (const ring of area) for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [x1, z1] = ring[a], [x2, z2] = ring[b];
    if ((z1 > z) !== (z2 > z) && x < (x2 - x1) * (z - z1) / (z2 - z1) + x1) result = !result;
  }
  return result;
};

const boxes = new WeakMap<WorldArea, [number, number, number, number]>();
const boxOf = (area: WorldArea) => {
  let box = boxes.get(area);
  if (!box) {
    const xs = area.flat().map((point) => point[0]), zs = area.flat().map((point) => point[1]);
    boxes.set(area, box = [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)]);
  }
  return box;
};

/** Whether a point is within `margin` of an area's edge. */
const nearArea = (area: WorldArea, { x, z }: WorldPoint, margin: number) => {
  const [left, top, right, bottom] = boxOf(area);
  if (x < left - margin || x > right + margin || z < top - margin || z > bottom + margin) return false;
  return area.some((ring) => ring.some(([x1, z1], at) => {
    const [x2, z2] = ring[(at + 1) % ring.length], dx = x2 - x1, dz = z2 - z1;
    const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / (dx * dx + dz * dz || 1)));
    return Math.hypot(x - x1 - t * dx, z - z1 - t * dz) <= margin;
  }));
};

/** Whether an extent holds a point: `exact` inside its boxes or areas, or else within the margin of an area. */
const holds = (extent: FloorExtent, point: WorldPoint, exact: boolean) => {
  if (!extent.bounds && !extent.areas) return exact;
  if (exact) return !!extent.bounds?.some((bounds) => within(bounds, point)) || !!extent.areas?.some((area) => insideArea(area, point));
  return !!extent.areas?.some((area) => nearArea(area, point, AREA_MARGIN));
};

/**
 * The floor a world position is on; the base floor when no other matches or the height is unknown.
 * A map with rooms goes by them alone (`roomAt`): outside every room, or in one but outside its heights, is the base floor.
 * Otherwise, by tarkov.dev's extents: later floors win when several match, as tarkov.dev lists them bottom to top. A point inside some floor's area or box
 * goes by those; only one inside none is matched to the areas it is just outside of.
 */
export function floorAt(map: MapCalibration, point: WorldPoint): Floor {
  const floors = floorsOf(map);
  if (point.y === undefined) return floors[0];
  if (map.rooms) {
    const room = roomAt(map.rooms, point as Required<WorldPoint>);
    return (room && floorById(map, room.floor)) ?? floors[0];
  }
  const height = point.y;
  const match = (exact: boolean) => {
    let found: MapFloor | null = null;
    for (const layer of map.layers) {
      if (layer.extents?.some((extent) => height >= extent.height[0] && height < extent.height[1] && holds(extent, point, exact))) found = layer;
    }
    return found;
  };
  const layer = match(true) ?? match(false);
  return (layer && floorById(map, layer.name)) ?? floors[0];
}

/** A floor extent covering a point across the ground, for checking heights: `inside` its boxes or areas (else only near an area). */
export type ExtentHit = { floor: string; extent: FloorExtent; inside: boolean; inHeight: boolean };

/** Every floor extent whose boxes or areas hold a point across the ground (unbounded extents excluded), bottom to top. */
export function extentsAt(map: MapCalibration, point: WorldPoint): ExtentHit[] {
  const hits: ExtentHit[] = [];
  for (const layer of map.layers) for (const extent of layer.extents ?? []) {
    if (!extent.bounds && !extent.areas) continue;
    const inside = holds(extent, point, true);
    if (!inside && !holds(extent, point, false)) continue;
    const inHeight = point.y !== undefined && point.y >= extent.height[0] && point.y < extent.height[1];
    hits.push({ floor: layer.name, extent, inside, inHeight });
  }
  return hits;
}

/** The floor something placed is on: the floor set on it by hand, if the map has it, else the one at its position. */
export const floorOf = (map: MapCalibration, placed: { position: WorldPoint; floor?: string }): Floor =>
  floorById(map, placed.floor) ?? floorAt(map, placed.position);
