import type { WorldArea, WorldPoint } from "./types";

/**
 * Floor rooms: where a floor is across the ground, and the heights (Y) it covers. A map with rooms (src/maps/floor-data)
 * takes its floors from them alone; see `roomAt`.
 */

/** A box across the ground: centre, size along world X (`width`) and Z (`depth`), turned `angle` degrees about Y. */
export type RoomRect = { x: number; z: number; width: number; depth: number; angle: number };

/** Where a room is across the ground: a box, or rings of [x, z] points (inside: an odd number of rings hold it). */
export type RoomShape = { rect?: RoomRect; area?: WorldArea };

/** A room of one floor: its floor id (`floorsOf`), a name for the building or room, and its heights, open-ended where null. */
export type MapRoom = RoomShape & { floor: string; zone: string; height: [number | null, number | null] };

const radians = (degrees: number) => degrees * Math.PI / 180;

/** World [x, z] of a room's corners, in order around it. */
export function roomCorners({ x, z, width, depth, angle }: RoomRect): [number, number][] {
  const cos = Math.cos(radians(angle)), sin = Math.sin(radians(angle));
  return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]): [number, number] => {
    const lx = u * width / 2, lz = v * depth / 2;
    return [x + lx * cos - lz * sin, z + lx * sin + lz * cos];
  });
}

/** A world point in a room's own axes, from its centre. */
export function toRoom({ x, z, angle }: RoomRect, point: { x: number; z: number }) {
  const cos = Math.cos(radians(angle)), sin = Math.sin(radians(angle)), dx = point.x - x, dz = point.z - z;
  return { u: dx * cos + dz * sin, v: -dx * sin + dz * cos };
}

/** A room's outline as rings of world [x, z] points. */
export const roomRings = (room: RoomShape): [number, number][][] => room.rect ? [roomCorners(room.rect)] : room.area ?? [];

export function inRoom(room: RoomShape, point: { x: number; z: number }) {
  if (room.rect) {
    const { u, v } = toRoom(room.rect, point);
    return Math.abs(u) <= room.rect.width / 2 && Math.abs(v) <= room.rect.depth / 2;
  }
  let inside = false;
  for (const ring of room.area ?? []) for (let a = 0, b = ring.length - 1; a < ring.length; b = a++) {
    const [x1, z1] = ring[a], [x2, z2] = ring[b];
    if ((z1 > point.z) !== (z2 > point.z) && point.x < (x2 - x1) * (point.z - z1) / (z2 - z1) + x1) inside = !inside;
  }
  return inside;
}

/** The axis-aligned box around a room. */
export function roomBox(room: RoomShape): RoomRect {
  if (room.rect && !room.rect.angle) return room.rect;
  const points = roomRings(room).flat(), xs = points.map((point) => point[0]), zs = points.map((point) => point[1]);
  const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...zs), bottom = Math.max(...zs);
  return { x: (left + right) / 2, z: (top + bottom) / 2, width: right - left, depth: bottom - top, angle: 0 };
}

/** Heights (Y) are compared to the nearest tenth: no level needs finer than that. */
export const tenth = (y: number) => Math.round(y * 10) / 10;
const low = (room: MapRoom) => room.height[0] === null ? -Infinity : tenth(room.height[0]);
const high = (room: MapRoom) => room.height[1] === null ? Infinity : tenth(room.height[1]);

/** How far a height is outside a room's range, both ends included (0 inside it). */
export const heightMiss = (room: MapRoom, y: number) => {
  const at = tenth(y);
  return at < low(room) ? tenth(low(room) - at) : at > high(room) ? tenth(at - high(room)) : 0;
};

/**
 * The room that puts a point on its floor: of the rooms whose outline and height range (both ends included, to the tenth)
 * hold it, the highest-starting one. Null anywhere else, which is the ground (base floor). Where one floor's range ends at
 * the next one's start, a point at exactly that height goes to the upper floor.
 */
export function roomAt<Room extends MapRoom>(rooms: Room[], point: Required<WorldPoint>): Room | null {
  const holding = rooms.filter((room) => !heightMiss(room, point.y) && inRoom(room, point));
  return holding.length ? holding.reduce((best, other) => low(other) > low(best) ? other : best) : null;
}

/**
 * The room a point is in across the ground, whatever its height: of the rooms whose outline holds it, the one nearest its height
 * (any, without a height). Unlike `roomAt`, the ground floor under a building with only an upper floor drawn still gets that room.
 */
export function nearestRoom<Room extends MapRoom>(rooms: Room[], point: WorldPoint): Room | null {
  const holding = rooms.filter((room) => inRoom(room, point));
  if (!holding.length) return null;
  return point.y === undefined ? holding[0] : holding.reduce((best, other) => heightMiss(other, point.y!) < heightMiss(best, point.y!) ? other : best);
}
