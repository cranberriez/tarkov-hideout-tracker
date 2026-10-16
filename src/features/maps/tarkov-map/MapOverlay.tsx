import { memo, useMemo, type CSSProperties, type ReactNode } from "react";
import { useMapAssets } from "./assets";
import type { FloorSelection } from "./floors";
import { mapIcons } from "./icons";
import { tarkovPreset, type MarkerPreset } from "./markerPreset";
import { allFloorsOn, markerIcon, markerTint, type Filters, type MapMarker } from "./markers";
import type { MapProjection } from "./projection";

/** Layers thick enough to crowd the map; their markers give way to anything else that would overlap them. */
const DENSE = new Set(["containers", "loose"]);
/** Screen size (pixels) of the cell a dense marker needs to itself. */
const CELL_PX = 12;

/** Part of the plane to draw markers in, and the zoom (pixels per plane unit) to thin them for. */
export type OverlayArea = { x: number; y: number; width: number; height: number; scale: number };

/**
 * Data markers placed in plane units, relative to the plane origin. The caller translates this layer
 * for panning and sets `--s` (pixels per plane unit) on it for zooming, so neither re-renders the markers;
 * only filtering, a floor change or crossing the label zoom does.
 * With one floor shown, markers and zones on other floors are hidden unless their layer is kept on all floors
 * (`allFloors`); then markers are drawn smaller with a caret pointing to the floor's side, and zones faded.
 * Zones draw their outline underneath their icon. Extract names show when `labelled`; hovering any marker
 * shows its name and what it is.
 * With `area`, only markers inside it are drawn, and a dense marker is left out where something drawn before it
 * already holds its cell: others first, then containers before loose loot.
 * Cells are fixed to the plane, so panning never changes which marker wins one.
 */
export const MapOverlay = memo(function MapOverlay({ markers, filters, preset = tarkovPreset, projection, floors, floor, order, shift, labelled, area, selected, dimmed, markerGlyph, lootIcons }: {
  markers: MapMarker[]; filters: Filters; preset?: MarkerPreset; projection: MapProjection;
  /** Floor id per marker id, and the floor shown (null for every floor). */
  floors: Map<string, string>; floor: FloorSelection;
  /** Floor id → place bottom to top (`floorOrder`), for the caret on markers from other floors. */
  order?: Map<string, number>;
  /** How far a thing on a floor moves sideways (plane units) when floors are split apart; it moves with its building's floor. */
  shift?: (floor: string, x: number, y: number) => number;
  labelled: boolean; area: OverlayArea | null;
  /** Id of the pinned marker, ringed. Markers carry `data-marker` so the parent can handle pointer events by delegation. */
  selected?: string | null;
  /** Marker ids drawn faded, zones included. */
  dimmed?: ReadonlySet<string>;
  /** Drawn in place of a marker's icon image when it returns something. */
  markerGlyph?: (marker: MapMarker) => ReactNode;
  /** Item id to show in place of the loose loot dot, by marker id. Keep referentially stable. */
  lootIcons?: Map<string, string>;
}) {
  const { icon } = useMapAssets();
  const shiftOf = (marker: MapMarker) => {
    const floorId = floors.get(marker.id);
    if (!shift || floorId === undefined) return 0;
    const { x, y } = projection.toPlane(marker.position);
    return shift(floorId, x, y);
  };
  const at = (point: { x: number; z: number }, dx = 0) => { const plane = projection.toPlane(point); return { x: plane.x + dx, y: plane.y }; };
  const otherFloor = (marker: MapMarker) => floor !== null && floors.get(marker.id) !== floor;
  const hidden = (marker: MapMarker) => otherFloor(marker) && !allFloorsOn(filters[marker.layer], marker.layer, preset);
  const zones = markers.filter((marker) => marker.outline?.length && !hidden(marker));
  const placed = useMemo(() => {
    const all = markers.filter((marker) => !hidden(marker)).map((marker) => ({ marker, ...at(marker.position, shiftOf(marker)) }));
    if (!area) return all;
    const inside = all.filter(({ x, y }) => x >= area.x && x <= area.x + area.width && y >= area.y && y <= area.y + area.height);
    const cell = CELL_PX / area.scale;
    const rank = ({ marker }: typeof inside[number]) => !DENSE.has(marker.layer) ? 0 : (marker.layer === "loose" ? 2 : 1);
    const taken = new Set<string>(), kept = new Set<typeof inside[number]>();
    for (const entry of [...inside].sort((a, b) => rank(a) - rank(b))) {
      const key = `${Math.floor(entry.x / cell)}|${Math.floor(entry.y / cell)}`;
      if (DENSE.has(entry.marker.layer) && taken.has(key)) continue;
      taken.add(key);
      kept.add(entry);
    }
    // Drawn in their original order, so what sits on top stays the same.
    return inside.filter((entry) => kept.has(entry));
  }, [markers, filters, preset, projection, floors, floor, order, shift, area]);

  return <>
    {zones.length > 0 && <svg className="overlay-zones" width="1" height="1"><g className="overlay-zones-scale">
      {zones.map((marker) => <polygon key={marker.id}
        className={`zone ${marker.layer} ${marker.groups[0]} ${otherFloor(marker) ? "other-floor" : ""} ${dimmed?.has(marker.id) ? "dimmed" : ""}`}
        points={marker.outline!.map((point) => { const { x, y } = at(point, shiftOf(marker)); return `${x},${y}`; }).join(" ")} />)}
    </g></svg>}
    {placed.map(({ marker, x, y }) => {
      const tint = markerTint(marker, filters, preset);
      const hover = [marker.label, ...marker.tags].filter(Boolean).join(" · ");
      // Only extracts keep their name on the map; everything else names itself on hover.
      const named = labelled && marker.layer === "extracts" && !!marker.label;
      const lootItem = lootIcons?.get(marker.id);
      const rank = order?.get(floors.get(marker.id) ?? ""), shown = order?.get(floor ?? "");
      const side = otherFloor(marker) && rank !== undefined && shown !== undefined ? rank > shown ? "above" : "below" : undefined;
      return <div key={marker.id} className={`overlay-marker ${marker.layer} ${lootItem ? "valuable" : ""} ${otherFloor(marker) ? "other-floor" : ""} ${side ?? ""} ${marker.id === selected ? "selected" : ""} ${dimmed?.has(marker.id) ? "dimmed" : ""}`}
        data-marker={marker.id} style={{ left: `round(calc(${x}px * var(--s)), 1px)`, top: `round(calc(${y}px * var(--s)), 1px)`,
          ...marker.slot ? { "--slot": marker.slot.index - (marker.slot.of - 1) / 2 } : {} } as CSSProperties}>
        {markerGlyph?.(marker) ?? (art => marker.layer === "documents" && tint
          ? <span className={`document-icon ${marker.document?.locked ? "locked" : ""}`} data-type={marker.groups[0]} style={{ "--tint": tint } as CSSProperties}>{art}</span> : art)(
          <img src={icon(lootItem ? `item:${lootItem}` : markerIcon(marker, filters, preset)) ?? mapIcons.container_crate} alt="" draggable={false}
            className={tint && marker.layer !== "documents" ? "tinted" : undefined} style={tint && marker.layer !== "documents" ? { "--tint": tint } as CSSProperties : undefined} />)}
        {side && <span className="floor-caret" aria-hidden="true" />}
        {named && <span className="overlay-label">{marker.label}</span>}
        {hover && <span className={`overlay-label overlay-hover ${named ? "replaces" : ""}`}>{hover}</span>}
      </div>;
    })}
  </>;
});
