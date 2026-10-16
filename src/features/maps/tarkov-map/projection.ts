import type { MapCalibration, PlanePoint, PlaneRect, WorldBounds, WorldPoint } from "./types";

/**
 * World → map plane. The plane is screen-oriented (x right, y down) in the map's own units,
 * matching tarkov.dev's Leaflet CRS at zoom 0, so the SVG artwork and markers share one space.
 */
export type MapProjection = {
  toPlane(point: WorldPoint): PlanePoint;
  /** Map plane → world x/z (no height). */
  toWorld(point: PlanePoint): WorldPoint;
  /** Heading in degrees clockwise from world +Z → degrees clockwise from plane "up". */
  heading(degrees: number): number;
  /** Plane units per world metre. */
  unitsPerMetre: number;
};

const radians = (degrees: number) => (degrees * Math.PI) / 180;

/** Plain metric plane with world +Z up; for maps without calibration. */
export const metricProjection: MapProjection = {
  toPlane: ({ x, z }) => ({ x, y: -z }),
  toWorld: ({ x, y }) => ({ x, z: -y }),
  heading: (degrees) => degrees,
  unitsPerMetre: 1,
};

export function projectionFor(map: Pick<MapCalibration, "transform" | "coordinateRotation">): MapProjection {
  const [scaleX, offsetX, scaleY, offsetY] = map.transform;
  const cos = Math.cos(radians(map.coordinateRotation)), sin = Math.sin(radians(map.coordinateRotation));
  // Linear part only (no offsets), used for directions.
  const linear = (x: number, z: number) => ({ x: scaleX * (x * cos - z * sin), y: -scaleY * (x * sin + z * cos) });
  return {
    toPlane: ({ x, z }) => {
      const point = linear(x, z);
      return { x: point.x + offsetX, y: point.y + offsetY };
    },
    toWorld: ({ x, y }) => {
      const u = (x - offsetX) / scaleX, v = -(y - offsetY) / scaleY;
      return { x: u * cos + v * sin, z: v * cos - u * sin };
    },
    heading: (degrees) => {
      const forward = linear(Math.sin(radians(degrees)), Math.cos(radians(degrees)));
      const angle = (Math.atan2(forward.x, -forward.y) * 180) / Math.PI;
      return (angle + 360) % 360;
    },
    unitsPerMetre: Math.abs(scaleX),
  };
}

/** Axis-aligned plane rectangle covering a world bounds pair. */
export function planeRect(projection: MapProjection, bounds: WorldBounds): PlaneRect {
  const [[x1, z1], [x2, z2]] = bounds;
  const corners = [[x1, z1], [x1, z2], [x2, z1], [x2, z2]].map(([x, z]) => projection.toPlane({ x, z }));
  const xs = corners.map((point) => point.x), ys = corners.map((point) => point.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Plane rectangle the SVG artwork is stretched over. */
export const artRect = (map: MapCalibration, projection = projectionFor(map)) =>
  planeRect(projection, map.svgBounds ?? map.bounds);
