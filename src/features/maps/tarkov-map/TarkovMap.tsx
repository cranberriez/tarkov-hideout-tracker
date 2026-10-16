import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type Ref } from "react";
import { floorAt, floorById, floorLevels, floorOf, floorOrder, floorsOf, levelText, type FloorSelection } from "./floors";
import { nearestRoom, roomRings, type MapRoom } from "./rooms";
import { MapArt } from "./MapArt";
import { MapOverlay, type OverlayArea } from "./MapOverlay";
import { MapTiles } from "./MapTiles";
import type { MarkerPreset } from "./markerPreset";
import type { Filters, MapMarker } from "./markers";
import { freshness, type PlayerPosition, type PlayerTrack } from "./players";
import { artRect, metricProjection, projectionFor } from "./projection";
import { tileBounds } from "./tiles";
import type { MapCalibration, PlaneRect, WorldPoint } from "./types";
import { initialView, useMapViewport } from "./useMapViewport";
import { useSplitLayout, type ArtStyle } from "./useSplitLayout";

export type { ArtStyle };

/** Extract names are drawn from this zoom in (screen px per metre); below it they are hover-only. */
const LABEL_PX_PER_M = 1.2;
/** Split-floor column names show once a column is at least this wide on screen. */
const SPLIT_LABEL_MIN_PX = 36;
/** Overlay markers are culled and thinned for zoom steps of this many per doubling, so zooming only redraws them on a step. */
const OVERLAY_ZOOM_STEPS = 4;
/** Auto zoom fits a room no closer than this (screen px per metre), with this share of the frame around the player to fit it in. */
const ROOM_MAX_PX_PER_M = 6, ROOM_FILL = 0.85;

/**
 * The art a map is drawn with: the preferred style when it has it, else the other, else none (a plain grid).
 * A shown floor with vector art but no tiles (Interchange's upper floors) is drawn with the vector art even when tiles are preferred.
 */
export function artStyleOf(map: MapCalibration | null, preferred: ArtStyle = "svg", floor: FloorSelection = null): ArtStyle | null {
  if (!map) return null;
  const shown = floorById(map, floor);
  if (preferred === "tiles" && map.svg && shown && !shown.base && shown.svgLayer && !shown.tilePath) return "svg";
  if (map.svg && (preferred === "svg" || !map.tilePath)) return "svg";
  return map.tilePath ? "tiles" : map.svg ? "svg" : null;
}

/** Smallest "nice" world step (1/2/5 × 10ⁿ metres) that is at least `minPx` on screen. */
function gridStep(scale: number, minPx: number) {
  const raw = minPx / scale;
  const power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * power).find((step) => step >= raw) ?? power * 10;
}

export type TarkovMapHandle = {
  panTo(x: number, y: number): void;
  /** Pans to a world point, on its floor's column while floors are split. */
  panToWorld(point: WorldPoint): void;
  zoomBy(factor: number): void;
  /** Pans to a floor's column while floors are split (null: the whole map). */
  focusFloor(floor: string | null): void;
};

/** Conversions for content drawn over the map in screen space (`draw`); floors split apart are not accounted for. */
export type MapDrawView = {
  /** Frame-relative screen position of a world point. */
  toScreen(point: { x: number; z: number }): { left: number; top: number };
  /** World x/z at a frame-relative screen position. */
  toWorld(left: number, top: number): { x: number; z: number };
  pxPerMetre: number;
};

export type TarkovMapProps = {
  /** The map's calibration (`resolveMap`); null draws a plain metric grid. */
  map: MapCalibration | null;
  /** Preferred art; falls back to what the map has (see `artStyleOf`). */
  art?: ArtStyle;
  /** Floor shown (an id from `floorsOf`), or null for every floor. */
  floor: FloorSelection;
  /** Draws every floor side by side instead of stacked. */
  split?: boolean;
  /** Dev: writes height ranges (Y) on floors and draws the room boxes that limit them. */
  levels?: boolean;
  /** While following, zooms in to fit the room the followed player is in (any floor's, nearest their height); leaving it zooms back. */
  autoZoom?: boolean;
  /** Players to draw: older positions faded, the newest as a pointer. */
  players?: PlayerTrack[];
  /** Id of a track to keep centred on its newest position; dragging calls `onUserPan`, which should turn it off. */
  follow?: string | null;
  /** A point to centre on once, again whenever `key` changes; for jumping to something without following it. */
  centre?: { key: string; point: PlayerPosition } | null;
  onUserPan?: () => void;
  /** Overlay markers already filtered for display, with the filters they were filtered by (they pick icons). */
  markers?: MapMarker[];
  filters?: Filters;
  preset?: MarkerPreset;
  /** Item id to draw in place of a loose loot dot, by marker id. Keep referentially stable. */
  lootIcons?: Map<string, string>;
  /** Marker drawn as selected. */
  selected?: string | null;
  /** Marker ids drawn faded, zones included. Keep referentially stable. */
  dimmed?: ReadonlySet<string>;
  /** Drawn in place of a marker's icon image when it returns something. Keep referentially stable. */
  markerGlyph?: (marker: MapMarker) => ReactNode;
  onMarkerHover?: (id: string | null) => void;
  onMarkerTap?: (id: string) => void;
  /** A tap off the markers, at its world x/z. Floors split apart are not accounted for. */
  onMapTap?: (point: WorldPoint) => void;
  className?: string;
  /** Drawn over the map, inside its frame. */
  children?: ReactNode;
  /** Drawn over the map in screen space, redrawn as the view moves. Stop pointerdown propagation to keep a drag from panning. */
  draw?: (view: MapDrawView) => ReactNode;
  ref?: Ref<TarkovMapHandle>;
};

type LevelBox = { key: string; kind: "piece" | "room"; text: string; named?: boolean; x: number; y: number; width: number; height: number };
/** A floor's areas in one building, as a plane-space path, labelled at the top of its bounding box (`row`: its floor's place). */
type LevelArea = { key: string; d: string; text: string; x: number; y: number; width: number; row: number };

const noMarkers: MapMarker[] = [];
const noFilters: Filters = {};

/**
 * A pannable, zoomable Tarkov map: vector art or tiles by floor, data markers, and player positions.
 * Positions are world coordinates in the map's own space, so only pass players who are on this map.
 */
export function TarkovMap({ map, art: preferred = "svg", floor, split = false, levels = false, autoZoom = false, players = [], follow = null, centre = null, onUserPan,
  markers = noMarkers, filters = noFilters, preset, lootIcons, selected, dimmed, markerGlyph, onMarkerHover, onMarkerTap, onMapTap, className, children, draw, ref }: TarkovMapProps) {
  const projection = useMemo(() => map ? projectionFor(map) : metricProjection, [map]);
  const style = artStyleOf(map, preferred, floor);
  const art = useMemo((): PlaneRect | null => style === "svg" ? artRect(map!, projection) : style === "tiles" ? tileBounds(map!) : null, [map, style, projection]);
  const splitOn = split && style !== null;
  const layout = useSplitLayout(map, style, splitOn, art);
  const { shift } = layout;

  const markerFloors = useMemo(() => new Map(map ? markers.map((marker) => [marker.id, floorOf(map, marker).id]) : []), [markers, map]);
  const toPlane = (point: WorldPoint) => {
    const plane = projection.toPlane(point);
    return { x: plane.x + (map && shift ? shift(floorAt(map, point).id, plane.x, plane.y) : 0), y: plane.y };
  };

  // Auto zoom: the room fitted and the zoom from before it, to return to on leaving. Zooming by hand keeps the zoom it picks until the next room.
  const roomFit = useRef<{ key: string; base: number | null } | null>(null);
  const onUserZoom = () => { if (roomFit.current) roomFit.current.base = null; };

  const markerAt = (target: Element) => target.closest<HTMLElement>("[data-marker]")?.dataset.marker ?? null;
  const viewport = useMapViewport({
    unitsPerMetre: projection.unitsPerMetre, zoomAroundCentre: !!follow, onPan: onUserPan, onZoom: onUserZoom,
    onTap: (target, at) => { const id = markerAt(target); if (id) onMarkerTap?.(id); else onMapTap?.(projection.toWorld(at)); },
  });
  const { view, size, toScreen, panTo, zoomAt } = viewport;

  const followed = players.find((track) => track.id === follow);
  const newest = followed?.positions.at(-1);
  const anyNewest = newest ?? players.find((track) => track.positions.length)?.positions.at(-1);

  // A different map means a different plane; start over once the frame has a size.
  const mapKey = map?.key ?? null;
  const shownMapKey = useRef<string | null | undefined>(undefined);
  useLayoutEffect(() => {
    if (!size.width || shownMapKey.current === mapKey) return;
    shownMapKey.current = mapKey;
    roomFit.current = null;
    viewport.reset(initialView(projection, art, anyNewest ? toPlane(anyNewest) : null, size));
  }, [mapKey, size.width > 0]);

  useEffect(() => {
    if (!newest) { roomFit.current = null; return; }
    const { x, y } = toPlane(newest);
    const room = autoZoom && map?.rooms && size.width ? nearestRoom(map.rooms, newest) : null;
    const key = room && `${room.floor}|${room.zone}`;
    const fit = roomFit.current;
    if (room && key !== fit?.key) {
      // Moving straight into another room keeps the zoom from before the first.
      const base = fit?.base ?? view.scale;
      roomFit.current = { key: key!, base };
      panTo(x, y, 650, Math.max(base, roomScale(map!.rooms!.filter((other) => other.floor === room.floor && other.zone === room.zone), x, y)));
    } else if (!room && fit) {
      roomFit.current = null;
      panTo(x, y, 650, fit.base ?? undefined);
    } else panTo(x, y);
  }, [newest?.key, follow, panTo, projection, shift, autoZoom]);

  /** The zoom that shows all of a room's pieces (one floor, one zone) with the frame centred on plane point x/y. */
  function roomScale(rooms: MapRoom[], x: number, y: number) {
    const corners = rooms.flatMap(roomRings).flat().map(([wx, wz]) => projection.toPlane({ x: wx, z: wz }));
    // Split floors move a room with its column; the shift is the same for all of it.
    const dx = shift ? shift(rooms[0].floor, corners[0].x, corners[0].y) : 0;
    const reachX = Math.max(...corners.map((corner) => Math.abs(corner.x + dx - x))), reachY = Math.max(...corners.map((corner) => Math.abs(corner.y - y)));
    const fits = Math.min(size.width / 2 / reachX, size.height / 2 / reachY) * ROOM_FILL;
    return Math.min(fits, ROOM_MAX_PX_PER_M / projection.unitsPerMetre);
  }

  // After the reset above when the map changes, so a jump to another map lands on the point.
  useEffect(() => {
    if (!centre || !size.width) return;
    const { x, y } = toPlane(centre.point);
    panTo(x, y);
  }, [centre?.key, mapKey, size.width > 0]);

  useImperativeHandle(ref, () => ({
    panTo: (x, y) => panTo(x, y),
    panToWorld: (point) => { const plane = toPlane(point); panTo(plane.x, plane.y); },
    zoomBy: (factor) => { onUserZoom(); zoomAt(factor); },
    focusFloor: (id) => { const point = layout.focus(id); if (point) panTo(point.x, point.y); },
  }), [panTo, zoomAt, layout.focus, projection, shift, map]);

  // Overlay markers are drawn a frame either side of the centre snapped to half frames, thinned for the zoom step;
  // panning or zooming only re-renders them when the snapped centre or the step changes.
  const zoomStep = Math.round(Math.log2(view.scale) * OVERLAY_ZOOM_STEPS);
  const stepScale = 2 ** (zoomStep / OVERLAY_ZOOM_STEPS);
  const reachX = size.width / stepScale, reachY = size.height / stepScale;
  const snapX = reachX ? Math.round(view.cx / (reachX / 2)) : 0, snapY = reachY ? Math.round(view.cy / (reachY / 2)) : 0;
  const overlayArea = useMemo((): OverlayArea | null => reachX && reachY
    ? { x: snapX * reachX / 2 - reachX, y: snapY * reachY / 2 - reachY, width: reachX * 2, height: reachY * 2, scale: stepScale }
    : null, [snapX, snapY, reachX, reachY, stepScale]);

  const pxPerMetre = view.scale * projection.unitsPerMetre;
  const minor = gridStep(pxPerMetre, 14) * pxPerMetre;
  const worldOrigin = projection.toPlane({ x: 0, z: 0 });
  const origin = toScreen(worldOrigin.x, worldOrigin.y);
  const gridStyle = {
    "--minor": `${minor}px`, "--major": `${minor * 5}px`,
    "--ox": `${origin.left}px`, "--oy": `${origin.top}px`,
  } as CSSProperties;

  // Dev: a box per floor piece (vector art, split), and with its height range, the outline of each room drawn for the map
  // (src/maps/floor-data), or on maps without rooms each room box tarkov.dev limits a floor to and each floor area.
  const { levelBoxes, levelAreas } = useMemo((): { levelBoxes: LevelBox[]; levelAreas: LevelArea[] } => {
    if (!levels || !map || !art) return { levelBoxes: [], levelAreas: [] };
    const boxes: LevelBox[] = [], areas: LevelArea[] = [];
    const named = new Map(floorsOf(map).map((other) => [other.id, other]));
    const text = (id: string) => { const found = named.get(id), range = found && floorLevels(map, found); return `${found?.name ?? id}${range ? ` · ${levelText(range)}` : ""}`; };
    layout.slots?.forEach((slot, index) => boxes.push({ key: `slot:${index}`, kind: "piece", text: text(slot.floor),
      x: art.x + (slot.x + slot.dx) * art.width, y: art.y + slot.y * art.height, width: slot.width * art.width, height: slot.height * art.height }));
    if (map.rooms) {
      const order = floorsOf(map).map((other) => other.id);
      map.rooms.forEach((room, index) => {
        if (!splitOn && floor !== null && floor !== room.floor) return;
        const rings = roomRings(room).map((ring) => ring.map(([x, z]) => projection.toPlane({ x, z })));
        const xs = rings.flat().map((point) => point.x), ys = rings.flat().map((point) => point.y);
        const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
        const dx = shift ? shift(room.floor, (left + right) / 2, (top + bottom) / 2) : 0;
        const d = rings.map((ring) => `M${ring.map((point) => `${+(point.x + dx).toFixed(2)} ${+point.y.toFixed(2)}`).join("L")}Z`).join("");
        const height = levelText([room.height[0] ?? -10000, room.height[1] ?? 10000]);
        areas.push({ key: `room:${index}`, d, text: `${room.zone ? `${room.zone} · ` : ""}${named.get(room.floor)?.name ?? room.floor} · ${height}`,
          x: left + dx, y: top, width: right - left, row: Math.max(0, order.indexOf(room.floor)) });
      });
      return { levelBoxes: boxes, levelAreas: areas };
    }
    map.layers.forEach((layer, row) => {
      if (!splitOn && floor !== null && floor !== layer.name) return;
      layer.extents?.forEach((extent, index) => {
        if (!extent.areas?.length) return;
        const rings = extent.areas.flat().map((ring) => ring.map(([x, z]) => projection.toPlane({ x, z })));
        const xs = rings.flat().map((point) => point.x), ys = rings.flat().map((point) => point.y);
        const left = Math.min(...xs), right = Math.max(...xs), top = Math.min(...ys), bottom = Math.max(...ys);
        const dx = shift ? shift(layer.name, (left + right) / 2, (top + bottom) / 2) : 0;
        const d = rings.map((ring) => `M${ring.map((point) => `${+(point.x + dx).toFixed(2)} ${+point.y.toFixed(2)}`).join("L")}Z`).join("");
        areas.push({ key: `area:${layer.name}:${index}`, d, text: `${extent.label ? `${extent.label} · ` : ""}${layer.name} · ${levelText(extent.height)}`,
          x: left + dx, y: top, width: right - left, row });
      });
      layer.extents?.forEach((extent, index) => extent.bounds?.forEach((bounds, at) => {
        const [[x1, z1], [x2, z2]] = bounds;
        const corners = [projection.toPlane({ x: x1, z: z1 }), projection.toPlane({ x: x2, z: z2 })];
        const x = Math.min(corners[0].x, corners[1].x), y = Math.min(corners[0].y, corners[1].y);
        const width = Math.abs(corners[0].x - corners[1].x), height = Math.abs(corners[0].y - corners[1].y);
        const dx = shift ? shift(layer.name, x + width / 2, y + height / 2) : 0;
        const label = typeof bounds[2] === "string" ? `${bounds[2]} · ` : "";
        boxes.push({ key: `room:${layer.name}:${index}:${at}`, kind: "room", text: `${label}${layer.name} · ${levelText(extent.height)}`, x: x + dx, y, width, height });
      }));
    });
    // A room drawn as several boxes is named once, on its largest.
    const largest = new Map<string, LevelBox>();
    for (const box of boxes) if (box.kind === "room" && box.width * box.height > (largest.get(box.text)?.width ?? 0) * (largest.get(box.text)?.height ?? 0)) largest.set(box.text, box);
    for (const box of boxes) if (box.kind === "room") box.named = largest.get(box.text) === box;
    return { levelBoxes: boxes, levelAreas: areas };
  }, [levels, map, art, layout.slots, splitOn, floor, projection, shift]);

  const onPointerOver = (event: React.PointerEvent) => { if (!viewport.dragging()) onMarkerHover?.(markerAt(event.target as Element)); };
  const onPointerOut = (event: React.PointerEvent) => { if (!viewport.dragging() && markerAt(event.target as Element)) onMarkerHover?.(null); };

  return <div ref={viewport.frame} className={`map-canvas ${map ? "calibrated" : ""} ${className ?? ""}`} style={gridStyle}
    {...viewport.handlers} onPointerOver={onPointerOver} onPointerOut={onPointerOut}>
    {style === "svg" && art ? (() => {
      const corner = toScreen(art.x, art.y);
      return <MapArt map={map as MapCalibration & { svg: string }} floor={splitOn ? null : floor} split={splitOn} onSplit={layout.onSplit} className="map-art"
        style={{ transform: `translate(${corner.left}px, ${corner.top}px)`, width: art.width * view.scale, height: art.height * view.scale }} />;
    })() : style === "tiles" ? <MapTiles map={map as MapCalibration & { tilePath: string }} floor={splitOn ? null : floor}
      shifts={splitOn ? layout.columns : undefined} view={{ ...view, width: size.width, height: size.height }} /> : <>
      <div className="map-axis x" style={{ top: origin.top }} />
      <div className="map-axis y" style={{ left: origin.left }} />
    </>}
    <div className="overlay-layer" style={{
      transform: `translate(${size.width / 2 - view.cx * view.scale}px, ${size.height / 2 - view.cy * view.scale}px)`,
      "--s": view.scale,
    } as CSSProperties}>
      <MapOverlay markers={markers} filters={filters} preset={preset} projection={projection}
        floors={markerFloors} floor={splitOn ? null : floor} order={map ? floorOrder(map) : undefined} shift={shift} labelled={pxPerMetre >= LABEL_PX_PER_M} area={overlayArea}
        selected={selected} dimmed={dimmed} markerGlyph={markerGlyph} lootIcons={lootIcons} />
      {layout.labels.length > 0 && <div className="split-labels">
        {layout.labels.map((label) => label.width * view.scale >= SPLIT_LABEL_MIN_PX && <span key={label.floor} className="split-label"
          style={{ left: `calc(${label.x}px * var(--s))`, top: `calc(${label.y}px * var(--s))`, maxWidth: label.width * view.scale }}>
          {label.name}{levels && label.levels ? ` · ${label.levels}` : ""}</span>)}
      </div>}
      {levels && map && art && <div className="level-boxes">
        {levelBoxes.map((box) => <div key={box.key} className={`level-box ${box.kind}`}
          style={{ left: `calc(${box.x}px * var(--s))`, top: `calc(${box.y}px * var(--s))`, width: `calc(${box.width}px * var(--s))`, height: `calc(${box.height}px * var(--s))` }}>
          {box.width * view.scale >= SPLIT_LABEL_MIN_PX && box.named !== false && <span>{box.text}</span>}</div>)}
        {/* Plane units: the 1-unit box is --s pixels wide. */}
        <svg className="level-areas" viewBox="0 0 1 1" style={{ width: "calc(1px * var(--s))", height: "calc(1px * var(--s))" }}>
          {levelAreas.map((area) => <path key={area.key} d={area.d} />)}
        </svg>
        {levelAreas.map((area) => area.width * view.scale >= SPLIT_LABEL_MIN_PX && <span key={area.key} className="level-area-label"
          style={{ left: `calc(${area.x}px * var(--s))`, top: `calc(${area.y}px * var(--s))`, transform: `translateY(${area.row * 100}%)` }}>{area.text}</span>)}
      </div>}
    </div>
    <PlayerMarkers players={players} at={(position) => { const { x, y } = toPlane(position); return toScreen(x, y); }} heading={projection.heading} />
    {draw?.({
      toScreen: (point) => { const { x, y } = projection.toPlane(point); return toScreen(x, y); },
      toWorld: (left, top) => projection.toWorld({ x: view.cx + (left - size.width / 2) / view.scale, y: view.cy + (top - size.height / 2) / view.scale }),
      pxPerMetre,
    })}
    {children}
  </div>;
}

/** Older positions fade by age in their track; the newest is a pointer, glowing while its track is live. */
function PlayerMarkers({ players, at, heading }: {
  players: PlayerTrack[]; at: (position: PlayerPosition) => { left: number; top: number }; heading: (degrees: number) => number;
}) {
  const live = players.some((track) => track.live);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [live]);
  const title = (position: PlayerPosition) => position.at ? new Date(position.at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : undefined;
  const rotation = (position: PlayerPosition) => position.heading == null ? null : heading(position.heading);
  return <>{players.map((track) => {
    const newest = track.positions.at(-1);
    const older = track.positions.slice(0, -1);
    const colour = track.color ? { "--player": track.color } : {};
    return <div key={track.id} className={`player-track ${track.className ?? ""}`} style={colour as CSSProperties}>
      {older.map((position, index) => <Marker key={position.key} at={at(position)} heading={rotation(position)}
        className="marker old" style={{ opacity: 0.18 + (index + 1) / (older.length + 1) * 0.4 } as CSSProperties} title={title(position)} />)}
      {newest && <Marker at={at(newest)} heading={rotation(newest)} className="marker newest" badge={track.badge}
        style={{ "--fresh": track.live && newest.at ? freshness(newest.at, now) : 0 } as CSSProperties}
        title={[track.label, title(newest)].filter(Boolean).join(" · ") || undefined} />}
    </div>;
  })}</>;
}

function Marker({ at, heading, className, style, title, badge }: {
  at: { left: number; top: number }; heading: number | null; className: string; style?: CSSProperties; title?: string; badge?: string;
}) {
  // The sharp corner sits top-left; +45° turns it to "up", then heading rotates clockwise from screen up.
  const pointer = heading !== null;
  return <div className={`${className} ${pointer ? "pointer" : ""}`} title={title}
    style={{ ...style, left: at.left, top: at.top, "--rot": `${(heading ?? 0) + 45}deg` } as CSSProperties}>
    {badge && <span className="marker-badge">{badge}</span>}
  </div>;
}
