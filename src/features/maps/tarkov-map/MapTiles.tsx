import type { CSSProperties } from "react";
import { floorById, floorsOf, UNDERGROUND_OPACITY, type FloorSelection } from "./floors";
import { useMapAssets } from "./assets";
import { tileZoom, tilesIn } from "./tiles";
import type { MapCalibration } from "./types";

export type TileView = { cx: number; cy: number; scale: number; width: number; height: number };

/**
 * Leaflet-style raster tiles for a map with a `tilePath`, drawn for the visible part of `view`
 * (plane centre, pixels per plane unit, frame size). A coarser zoom sits underneath to cover
 * tiles still loading. A floor with its own tiles is drawn over a dimmed base. With every floor (`floor` null),
 * each floor with its own tiles is drawn over the base: underground faintly first, then the upper floors in order.
 * With `shifts` (plane x per floor id) the floors are split apart instead: each with tiles is drawn at full
 * strength, moved sideways by its shift. Tile URLs come from `MapAssetsContext`.
 */
export function MapTiles({ map, floor, shifts, view, className }: {
  map: MapCalibration & { tilePath: string }; floor: FloorSelection; shifts?: Map<string, number>; view: TileView; className?: string;
}) {
  const { tile: tileUrl } = useMapAssets();
  const visible = {
    x: view.cx - view.width / 2 / view.scale, y: view.cy - view.height / 2 / view.scale,
    width: view.width / view.scale, height: view.height / view.scale,
  };
  const z = tileZoom(map, view.scale);
  const [base, ...rest] = floorsOf(map);
  // Floors with tiles of their own, drawn over the base tiles.
  const own = rest.filter((other) => other.tilePath && other.tilePath !== map.tilePath);
  const all = floor === null;
  const chosen = floorById(map, floor);
  const overlay = chosen && own.includes(chosen) ? chosen.tilePath! : null;
  const layer = (template: string, zoom: number, style?: CSSProperties, dx = 0) =>
    tilesIn(map, template, zoom, { ...visible, x: visible.x - dx }).map((tile) => {
      const left = Math.floor((tile.rect.x + dx - visible.x) * view.scale);
      const top = Math.floor((tile.rect.y - visible.y) * view.scale);
      // Round edges outward so neighbouring tiles never leave a hairline gap.
      const right = Math.ceil((tile.rect.x + dx + tile.rect.width - visible.x) * view.scale);
      const bottom = Math.ceil((tile.rect.y + tile.rect.height - visible.y) * view.scale);
      return <img key={tile.path} src={tileUrl(tile.path)} alt="" draggable={false} decoding="async"
        onError={(event) => { event.currentTarget.style.visibility = "hidden"; }}
        style={{ position: "absolute", left, top, width: right - left, height: bottom - top, ...style }} />;
    });

  if (shifts) {
    const baseShift = shifts.get(base.id) ?? 0;
    return <div className={className} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div>{z > 2 && layer(map.tilePath, z - 2, undefined, baseShift)}
        {layer(map.tilePath, z, undefined, baseShift)}</div>
      {own.map((other) => <div key={other.id}>{layer(other.tilePath!, z, undefined, shifts.get(other.id) ?? 0)}</div>)}
    </div>;
  }

  return <div className={className} style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
    <div style={{ opacity: overlay ? 0.2 : 1 }}>
      {z > 2 && layer(map.tilePath, z - 2)}
      {layer(map.tilePath, z)}
    </div>
    {all
      ? [...own.filter((other) => other.underground), ...own.filter((other) => !other.underground)].map((other) =>
        <div key={other.id} style={other.underground ? { opacity: UNDERGROUND_OPACITY } : undefined}>{layer(other.tilePath!, z)}</div>)
      : overlay && layer(overlay, z)}
  </div>;
}
