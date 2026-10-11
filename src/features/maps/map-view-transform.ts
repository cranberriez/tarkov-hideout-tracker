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

const MAP_EDGE_PAN_ALLOWANCE = 0.05;

/** edgePanAllowance is a fraction of each scaled artwork dimension; existing viewers keep five percent. */
export function constrainMapView(
	view: MapViewTransform,
	stage: MapViewSize,
	viewport: MapViewSize,
	edgePanAllowance = MAP_EDGE_PAN_ALLOWANCE,
): MapViewTransform {
	const scaledWidth = stage.width * view.scale;
	const scaledHeight = stage.height * view.scale;
	const maxX = Math.max(0, (scaledWidth - viewport.width) / 2) + scaledWidth * edgePanAllowance;
	const maxY = Math.max(0, (scaledHeight - viewport.height) / 2) + scaledHeight * edgePanAllowance;
	return {
		...view,
		x: Math.min(maxX, Math.max(-maxX, view.x)),
		y: Math.min(maxY, Math.max(-maxY, view.y)),
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
