import { GROUND, type Floor } from "./floors";

/**
 * Hand-tuned split-floor layouts, by calibration key. Anything not listed uses the defaults.
 * Tile maps split into columns: `columnWidth` is how wide the art really is, `floorWidths` overrides that per
 * floor, and `columnGap` is the space between columns, all as fractions of the map's bounds width
 * (tiles are drawn square, mostly empty around the art).
 */
export type SplitLayout = {
  columnWidth: number; columnGap: number; /** By floor id. */ floorWidths: Record<string, number>;
  /** Plane point the floor names hang from (art centre x, art top y), when the art is not centred in the map bounds. */
  label?: { x: number; y: number };
};

export const DEFAULT_SPLIT_LAYOUT: SplitLayout = { columnWidth: 1, columnGap: 0.08, floorWidths: {} };

export const splitLayouts: Record<string, Partial<SplitLayout>> = {
  // Each deck's art, measured from its tiles (width in 256px of the zoom 0 tile, plus a little).
  icebreaker: {
    columnWidth: 0.2, columnGap: 0.02,
    label: { x: 127.5, y: 0 },
    floorWidths: {
      "Infirmary": 0.21, "Helipad": 0.21, "Gym/Canteen": 0.19, "Accommodation (lower)": 0.16, "Accommodation (mid)": 0.16,
      "Accommodation (upper)": 0.16, "Officers' Deck": 0.16, "Stairs (blocked)": 0.18, "Bridge": 0.22, "Bridge Roof": 0.21,
      "Control Room": 0.08, "Engine Room": 0.12, "Engine Room (upper)": 0.15, "Fuel Pumps (lower)": 0.2, "Fuel Pumps": 0.15,
      "Storage/Security": 0.21,
    },
  },
};

export const splitLayoutFor = (key: string): SplitLayout => ({ ...DEFAULT_SPLIT_LAYOUT, ...splitLayouts[key] });

/** Plane width of a floor's column in a map whose art is `art` wide; the ground is a full map wide. */
export const columnWidthOf = (layout: SplitLayout, art: number) => (floor: Floor) =>
  art * (layout.floorWidths[floor.id] ?? (floor.id === GROUND ? 1 : layout.columnWidth));
