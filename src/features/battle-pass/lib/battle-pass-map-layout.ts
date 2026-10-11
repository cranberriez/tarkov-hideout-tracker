type MarkerPoint = { id: string; x: number; y: number };
type MarkerBounds = { width: number; height: number; padding?: number };

/** Choose artwork only when its screen-space footprint fits; crowded spawns retain tiny glyphs near their anchors. */
export function arrangeDocumentMarkers(
	points: readonly MarkerPoint[],
	spacing = 38,
	bounds?: MarkerBounds,
	compactSpacing = 16,
) {
	const onscreen = (point: MarkerPoint) =>
		!bounds || (point.x >= 0 && point.y >= 0 && point.x <= bounds.width && point.y <= bounds.height);
	const compact = points.map(
		(point, index) =>
			onscreen(point) &&
			points.some(
				(other, otherIndex) =>
					otherIndex !== index && onscreen(other) && Math.hypot(other.x - point.x, other.y - point.y) < spacing,
			),
	);
	const occupied: { x: number; y: number; radius: number }[] = [];
	return points.map((point, index) => {
		// Panned-out anchors stay out of view instead of accumulating along its edges.
		if (!onscreen(point)) return { id: point.id, x: 0, y: 0, compact: false };
		const radius = (compact[index] ? compactSpacing : spacing) / 2;
		const padding = compact[index] ? radius : (bounds?.padding ?? 24);
		const padX = bounds ? Math.min(padding, bounds.width / 2) : padding;
		const padY = bounds ? Math.min(padding, bounds.height / 2) : padding;
		const origin = bounds
			? {
					x: Math.max(padX, Math.min(bounds.width - padX, point.x)),
					y: Math.max(padY, Math.min(bounds.height - padY, point.y)),
				}
			: point;
		let offset = { x: origin.x - point.x, y: origin.y - point.y };
		search: for (let ring = 0; ring <= points.length * 2; ring++) {
			const steps = ring === 0 ? 1 : ring * 8;
			for (let step = 0; step < steps; step++) {
				const angle = (step / steps) * Math.PI * 2;
				const position = {
					x: origin.x + Math.cos(angle) * ring * radius,
					y: origin.y + Math.sin(angle) * ring * radius,
				};
				if (
					bounds &&
					(position.x < padX ||
						position.y < padY ||
						position.x > bounds.width - padX ||
						position.y > bounds.height - padY)
				)
					continue;
				if (
					occupied.every(
						(other) => Math.hypot(other.x - position.x, other.y - position.y) >= radius + other.radius - 0.001,
					)
				) {
					offset = { x: position.x - point.x, y: position.y - point.y };
					occupied.push({ ...position, radius });
					break search;
				}
			}
		}
		return { id: point.id, ...offset, compact: compact[index] };
	});
}
