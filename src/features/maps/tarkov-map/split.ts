import { floorsOf, GROUND, type Floor } from "./floors";
import type { MapCalibration } from "./types";

export type Box = { x1: number; y1: number; x2: number; y2: number };
/** A drawn part of one floor, in the art's own units. */
export type Piece = Box & { layer: string };
/** One floor of one building and how far it moves sideways. */
export type Slot = Box & { layer: string; dx: number };

const overlap = (a: Box, b: Box, margin: number) =>
  a.x1 <= b.x2 + margin && b.x1 <= a.x2 + margin && a.y1 <= b.y2 + margin && b.y1 <= a.y2 + margin;

const union = (boxes: Box[]): Box => ({
  x1: Math.min(...boxes.map((box) => box.x1)), y1: Math.min(...boxes.map((box) => box.y1)),
  x2: Math.max(...boxes.map((box) => box.x2)), y2: Math.max(...boxes.map((box) => box.y2)),
});

/**
 * Pulls the upper and underground floors of every building out beside the ground, to the map edge nearest it.
 * Pieces that touch (within `join`) are one building. A building's floors become a row of columns at its own
 * height, ordered so that reading left to right goes from low to high; the columns start `gap` past the edge,
 * and a row waits for the rows already placed there that share its height.
 * `order` lists the floors from lowest to highest.
 */
export function splitFloors(ground: Box, pieces: Piece[], order: string[], { gap, join }: { gap: number; join: number }): Slot[] {
  const sorted = [...pieces].sort((a, b) => a.x1 - b.x1);
  const parent = sorted.map((_, index) => index);
  const find = (index: number): number => parent[index] === index ? index : (parent[index] = find(parent[index]));
  for (let i = 0; i < sorted.length; i++)
    for (let j = i + 1; j < sorted.length && sorted[j].x1 <= sorted[i].x2 + join; j++)
      if (overlap(sorted[i], sorted[j], join)) parent[find(j)] = find(i);

  const buildings = new Map<number, Piece[]>();
  sorted.forEach((piece, index) => buildings.set(find(index), [...buildings.get(find(index)) ?? [], piece]));

  const middle = (ground.x1 + ground.x2) / 2;
  const rows = [...buildings.values()].map((parts) => {
    const box = union(parts);
    const right = (box.x1 + box.x2) / 2 >= middle;
    const floors = order.filter((layer) => parts.some((part) => part.layer === layer))
      .map((layer) => ({ layer, ...union(parts.filter((part) => part.layer === layer)) }));
    // Nearest the map first; the highest floor is outermost on the right and innermost on the left.
    return { box, right, floors: right ? floors : floors.reverse(), reach: right ? ground.x2 - box.x2 : box.x1 - ground.x1 };
  }).sort((a, b) => a.reach - b.reach);

  const placed: { right: Box[]; left: Box[] } = { right: [], left: [] };
  const slots: Slot[] = [];
  for (const row of rows) {
    const side = row.right ? placed.right : placed.left;
    const blocking = side.filter((other) => other.y1 < row.box.y2 + gap / 2 && row.box.y1 < other.y2 + gap / 2);
    if (row.right) {
      let cursor = Math.max(ground.x2 + gap, ...blocking.map((other) => other.x2 + gap));
      for (const floor of row.floors) {
        const width = floor.x2 - floor.x1;
        slots.push({ ...floor, dx: cursor - floor.x1 });
        side.push({ x1: cursor, x2: cursor + width, y1: floor.y1, y2: floor.y2 });
        cursor += width + gap;
      }
    } else {
      let cursor = Math.min(ground.x1 - gap, ...blocking.map((other) => other.x1 - gap));
      for (const floor of row.floors) {
        const width = floor.x2 - floor.x1;
        slots.push({ ...floor, dx: cursor - width - floor.x1 });
        side.push({ x1: cursor - width, x2: cursor, y1: floor.y1, y2: floor.y2 });
        cursor -= width + gap;
      }
    }
  }
  return slots;
}

const lowest = (floor: Floor) => Math.min(...(floor.extents?.map((extent) => extent.height[0]) ?? [0]));

/**
 * Sideways shift of each tiled floor (by id) that puts every floor in a column of its own, `gap` apart,
 * each as wide as `widthOf` says (columns are centred on the floor's own art),
 * low to high from left to right. A listed floor drawn by the map's base tiles stays put, and the rest line up
 * around it; otherwise the ground (`GROUND`) stays put with underground floors to its left and upper floors to its right.
 */
export function columnShifts(map: MapCalibration, widthOf: (floor: Floor) => number, gap: number): Map<string, number> {
  const [base, ...rest] = floorsOf(map);
  const shifts = new Map<string, number>();
  // Columns left to right as centres, counted from the first column's left edge.
  const centres = new Map<string, number>();
  let edge = 0;
  const lay = (row: Floor[]) => { for (const floor of row) { const width = widthOf(floor); centres.set(floor.id, edge + width / 2); edge += width + gap; } };
  if (base.id !== GROUND) {
    lay([base, ...rest].filter((floor) => floor.tilePath).sort((a, b) => lowest(a) - lowest(b)));
  } else {
    // The ground is a column too: its width is a full map, so the others sit past its edges.
    const tiled = rest.filter((floor) => floor.tilePath).sort((a, b) => lowest(a) - lowest(b));
    lay(tiled.filter((floor) => floor.underground));
    lay([base]);
    lay(tiled.filter((floor) => !floor.underground));
  }
  const origin = centres.get(base.id) ?? 0;
  for (const [id, centre] of centres) shifts.set(id, centre - origin);
  return shifts;
}
