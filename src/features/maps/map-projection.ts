import type { MapPoint3D } from "@/types";
import type { MapRenderDefinition, ProjectedMapPoint } from "./map-types";

function rotateHorizontalPoint(x: number, z: number, degrees: number) {
    const radians = degrees * Math.PI / 180;
    const cosine = Math.cos(radians);
    const sine = Math.sin(radians);
    return {
        x: x * cosine - z * sine,
        y: x * sine + z * cosine,
    };
}

function projectHorizontalPoint(
    x: number,
    z: number,
    definition: Pick<MapRenderDefinition, "coordinateRotation" | "transform">,
) {
    const rotated = rotateHorizontalPoint(x, z, definition.coordinateRotation);
    return {
        x: rotated.x * definition.transform[0] + definition.transform[1],
        y: rotated.y * definition.transform[2] * -1 + definition.transform[3],
    };
}

/**
 * Tarkov.dev treats world x/z as Leaflet longitude/latitude, rotates that
 * horizontal plane, then applies [scaleX, offsetX, scaleY, offsetY]. World y
 * is elevation and is intentionally not part of the 2D projection.
 */
export function worldToMapPoint(
    position: MapPoint3D,
    definition: Pick<MapRenderDefinition, "bounds" | "coordinateRotation" | "transform">,
): ProjectedMapPoint {
    const projected = projectHorizontalPoint(position.x, position.z, definition);
    const xs = definition.bounds.flatMap(([x]) =>
        definition.bounds.map(([, z]) => projectHorizontalPoint(x, z, definition).x),
    );
    const ys = definition.bounds.flatMap(([, z]) =>
        definition.bounds.map(([x]) => projectHorizontalPoint(x, z, definition).y),
    );
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        ...projected,
        percentX: (projected.x - minX) / (maxX - minX) * 100,
        percentY: (projected.y - minY) / (maxY - minY) * 100,
    };
}

export function getProjectedMapAspectRatio(
    definition: Pick<MapRenderDefinition, "bounds" | "coordinateRotation" | "transform">,
) {
    const points = definition.bounds.flatMap(([x]) =>
        definition.bounds.map(([, z]) => projectHorizontalPoint(x, z, definition)),
    );
    const width = Math.max(...points.map((point) => point.x)) - Math.min(...points.map((point) => point.x));
    const height = Math.max(...points.map((point) => point.y)) - Math.min(...points.map((point) => point.y));
    return width / height;
}
