import { useCallback, useMemo, useState } from "react";
import type { FloorSlot } from "./MapArt";
import { floorLevels, floorsOf, GROUND, levelText, type Floor } from "./floors";
import { columnShifts } from "./split";
import { columnWidthOf, splitLayoutFor } from "./splitLayouts";
import type { MapCalibration, PlanePoint, PlaneRect } from "./types";

/** A split-floor marker follows the building piece nearest it within this fraction of the art's width. */
const SLOT_REACH = 0.03;

const levelsOf = (map: MapCalibration, floor: Floor) => { const range = floorLevels(map, floor); return range ? levelText(range) : undefined; };

export type ArtStyle = "svg" | "tiles";
/** Where a floor's column name hangs (plane units), when tiled floors are split into columns. */
export type SplitLabel = { floor: string; name: string; levels?: string; x: number; y: number; width: number };

/**
 * Where everything goes when floors are split apart. Vector art moves each building's floors beside it (measured by
 * `MapArt`, which reports through `onSplit`); tiles move whole floors into columns. Either way `shift` says how far
 * (plane x) a point on a floor moves, and `focus` where to look to see a floor.
 */
export function useSplitLayout(map: MapCalibration | null, style: ArtStyle | null, split: boolean, art: PlaneRect | null) {
  const [slots, setSlots] = useState<FloorSlot[] | null>(null);
  const onSplit = useCallback((next: FloorSlot[] | null) =>
    setSlots((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next), []);
  const layout = useMemo(() => splitLayoutFor(map?.key ?? ""), [map]);
  const widthOf = useMemo(() => art ? columnWidthOf(layout, art.width) : null, [layout, art]);
  const columns = useMemo(() => split && style === "tiles" && map && widthOf && art
    ? columnShifts(map, widthOf, art.width * layout.columnGap) : undefined, [split, style, map, widthOf, art, layout]);
  const svgSlots = split && style === "svg" ? slots : null;

  /** Plane x shift of a point on a floor: its column's, or that of the nearest piece of the floor, if one is close. */
  const shift = useMemo(() => {
    if (columns) return (floor: string) => columns.get(floor) ?? 0;
    if (!svgSlots?.length || !art) return undefined;
    return (floor: string, x: number, y: number) => {
      const u = (x - art.x) / art.width, v = (y - art.y) / art.height;
      let best: FloorSlot | null = null, nearest = SLOT_REACH;
      for (const slot of svgSlots) {
        if (slot.floor !== floor) continue;
        const gap = Math.hypot(Math.max(slot.x - u, 0, u - slot.x - slot.width), Math.max(slot.y - v, 0, v - slot.y - slot.height));
        if (gap < nearest) { nearest = gap; best = slot; }
      }
      return best ? best.dx * art.width : 0;
    };
  }, [columns, svgSlots, art]);

  const labels = useMemo((): SplitLabel[] => {
    if (!columns || !map || !art || !widthOf) return [];
    const anchor = { x: layout.label?.x ?? art.x + art.width / 2, y: layout.label?.y ?? art.y };
    // The ground column goes unnamed.
    return floorsOf(map).filter((floor) => floor.id !== GROUND && columns.has(floor.id)).map((floor) =>
      ({ floor: floor.id, name: floor.name, levels: levelsOf(map, floor), x: anchor.x + columns.get(floor.id)!, y: anchor.y, width: widthOf(floor) }));
  }, [columns, map, art, widthOf, layout]);

  /** Plane point to centre on to see a floor (null: every floor) while split. */
  const focus = useCallback((floor: string | null): PlanePoint | null => {
    if (!art) return null;
    const centre = { x: art.x + art.width / 2, y: art.y + art.height / 2 };
    if (columns) return { x: (layout.label?.x ?? centre.x) + (floor === null ? 0 : columns.get(floor) ?? 0), y: centre.y };
    const slot = svgSlots?.filter((other) => other.floor === floor).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    return slot ? { x: art.x + (slot.x + slot.dx + slot.width / 2) * art.width, y: art.y + (slot.y + slot.height / 2) * art.height } : centre;
  }, [art, columns, svgSlots, layout]);

  return { onSplit, shift, columns, labels, focus, slots: svgSlots };
}
