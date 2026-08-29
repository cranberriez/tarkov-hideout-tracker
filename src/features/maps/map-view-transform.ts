export interface MapViewTransform {
    scale: number;
    x: number;
    y: number;
}

export interface MapViewPoint {
    x: number;
    y: number;
}

export interface MapViewSize {
    width: number;
    height: number;
}

export function constrainMapView(
    view: MapViewTransform,
    stage: MapViewSize,
    viewport: MapViewSize,
): MapViewTransform {
    const maxX = Math.max(0, (stage.width * view.scale - viewport.width) / 2);
    const maxY = Math.max(0, (stage.height * view.scale - viewport.height) / 2);
    return {
        ...view,
        x: maxX === 0 ? 0 : Math.min(maxX, Math.max(-maxX, view.x)),
        y: maxY === 0 ? 0 : Math.min(maxY, Math.max(-maxY, view.y)),
    };
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
