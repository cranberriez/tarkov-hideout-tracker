type MarkerPoint = { id: string; x: number; y: number };
type MarkerBounds = { width: number; height: number };

export const DOCUMENT_MAP_MIN_ZOOM = 1;
export const DOCUMENT_MAP_MAX_ZOOM = 8;
export const DOCUMENT_MAP_UNGROUP_ZOOM = DOCUMENT_MAP_MIN_ZOOM + (DOCUMENT_MAP_MAX_ZOOM - DOCUMENT_MAP_MIN_ZOOM) * 0.8;

function baseMarkerScale(zoom: number) {
	return Math.min(1, Math.max(0.6, 0.6 * Math.sqrt(zoom)));
}

/** Larger at fit zoom, tapering to the same full size when zoomed in. */
export function documentMarkerScale(zoom: number) {
	return 0.75 + (baseMarkerScale(zoom) - 0.6) * 0.625;
}

/** Shared with rendering so overlap checks include artwork, gaps, padding and border. */
export function documentMarkerDimensions(count: number) {
	const columns = count >= 5 ? 3 : Math.min(2, count);
	const rows = Math.ceil(count / columns);
	return {
		columns,
		width: count === 1 ? 34 : columns * 28 + (columns - 1) * 2 + 12,
		height: count === 1 ? 34 : rows * 28 + (rows - 1) * 2 + 12,
	};
}

/** Rebuild from source anchors on every zoom; merged bubbles retain the first member's anchor. */
export function arrangeDocumentMarkers(points: readonly MarkerPoint[], zoom = 1, bounds?: MarkerBounds) {
	const scale = documentMarkerScale(zoom);
	const ungroup = zoom >= DOCUMENT_MAP_UNGROUP_ZOOM;
	const radius = zoom < 3 ? 18 * scale : 1;
	const groups: { id: string; x: number; y: number; ids: string[] }[] = [];
	for (const point of points) {
		if (bounds && (point.x < 0 || point.y < 0 || point.x > bounds.width || point.y > bounds.height)) continue;
		const group = !ungroup && groups.find((entry) => Math.hypot(entry.x - point.x, entry.y - point.y) <= radius);
		if (group) group.ids.push(point.id);
		else groups.push({ ...point, ids: [point.id] });
	}
	if (ungroup) return groups;
	// Restart after each merge: a larger grid can now overlap a previously checked bubble.
	let merged = true;
	while (merged) {
		merged = false;
		search: for (let i = 0; i < groups.length; i++) {
			const a = groups[i];
			const aSize = documentMarkerDimensions(a.ids.length);
			for (let j = i + 1; j < groups.length; j++) {
				const b = groups[j];
				const bSize = documentMarkerDimensions(b.ids.length);
				const overlapX = Math.max(
					0,
					Math.min(
						((aSize.width + bSize.width) * scale) / 2 - Math.abs(a.x - b.x),
						Math.min(aSize.width, bSize.width) * scale,
					),
				);
				const overlapY = Math.max(
					0,
					Math.min(
						((aSize.height + bSize.height) * scale) / 2 - Math.abs(a.y - b.y),
						Math.min(aSize.height, bSize.height) * scale,
					),
				);
				const smallerArea = Math.min(aSize.width * aSize.height, bSize.width * bSize.height) * scale * scale;
				// Allow light overlap, but merge when more than a quarter of either bubble is obscured.
				if (overlapX * overlapY <= smallerArea * 0.25) continue;
				a.ids.push(...b.ids);
				groups.splice(j, 1);
				merged = true;
				break search;
			}
		}
	}
	return groups;
}
