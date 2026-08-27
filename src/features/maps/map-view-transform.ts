export interface MapViewTransform {
    scale: number;
    x: number;
    y: number;
}

export interface MapViewPoint {
    x: number;
    y: number;
}

export function zoomViewAroundPoint(
    view: MapViewTransform,
    factor: number,
    focalPoint: MapViewPoint,
    minScale: number,
    maxScale: number,
): MapViewTransform {
    const scale = Math.min(maxScale, Math.max(minScale, view.scale * factor));
    const ratio = scale / view.scale;
    return {
        scale,
        x: focalPoint.x - (focalPoint.x - view.x) * ratio,
        y: focalPoint.y - (focalPoint.y - view.y) * ratio,
    };
}
