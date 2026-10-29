import type { MapRoom } from "./rooms";

/** World bounds corner pair as [x, z] (tarkov.dev convention). Optional third entry is a debug label. */
export type WorldBounds = [[number, number], [number, number], ...unknown[]];

/** An area as rings of [x, z] points; a point is inside when an odd number of rings contain it. */
export type WorldArea = [number, number][][];

/**
 * Heights a floor covers, anywhere or only within `bounds` boxes (tarkov.dev) or `areas` (footprints, matched with a small
 * margin). `label` names what the areas are, for display.
 */
export type FloorExtent = { height: [number, number]; bounds?: WorldBounds[]; areas?: WorldArea[]; label?: string };

export type MapFloor = {
  name: string;
  /** Id of the top-level `<g>` in the SVG, when the vector art has this floor. */
  svgLayer?: string;
  /** Tile path template for this floor, when tiles exist for it. */
  tilePath?: string;
  show: boolean;
  extents?: FloorExtent[];
};

export type MapLabel = { position: [number, number]; text: string; rotation?: number; size?: number; top?: number; bottom?: number };

/** Per-art calibration, from tarkov.dev's interactive map definitions. Several game maps can share one. */
export type MapCalibration = {
  /**
   * Floor rooms drawn for this art (src/maps/floor-data, attached by roomData.ts). When present they alone decide floors;
   * `layers[].extents` are then only tarkov.dev's data, for reference.
   */
  rooms?: MapRoom[];
  key: string;
  /** Leaflet transformation [scaleX, offsetX, scaleY, offsetY] applied after rotation. */
  transform: [number, number, number, number];
  /** Degrees; world (x, z) is rotated by this before scaling. */
  coordinateRotation: number;
  bounds: WorldBounds;
  /** Where the SVG artwork sits, when it differs from `bounds`. */
  svgBounds?: WorldBounds;
  heightRange?: [number, number];
  /** Vector art file, when one exists. */
  svg?: string;
  /** Base floor group id in the SVG. */
  svgLayer?: string;
  /** Base tile path template `<dir>/{z}/{x}/{y}.png`, relative to the tile host, when tiles exist. */
  tilePath?: string;
  tileSize?: number;
  /** Highest zoom with native tiles; tiles exist from zoom 0. */
  maxZoom?: number;
  layers: MapFloor[];
  labels: MapLabel[];
};

/** A game map as the game and tarkov.dev identify it. */
export type GameMap = {
  /** tarkov.dev `normalizedName`, e.g. "customs". */
  key: string;
  /** English display name. */
  name: string;
  /** Location id in logs and the API, e.g. "bigmap". */
  nameId: string;
  /** Scene bundle in logs, e.g. "customs_preset". */
  scene: string;
  /** Calibration key for its art, or null when no map art exists. */
  art: string | null;
};

/** A point in world coordinates (metres): x and z across the ground, y up; y may be unknown. */
export type WorldPoint = { x: number; y?: number; z: number };
/** A world point with its height, as tarkov.dev's documents carry them. */
export type Vec3 = Required<WorldPoint>;
export type PlanePoint = { x: number; y: number };
export type PlaneRect = { x: number; y: number; width: number; height: number };
