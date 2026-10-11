/** Keep crowded markers readable while preserving their actual spawn anchors. */
export function arrangeDocumentMarkers(
	points: readonly { id: string; x: number; y: number }[],
	spacing = 38,
	bounds?: { width: number; height: number; padding?: number },
) {
	const occupied: { x: number; y: number }[] = [];
	return points.map((point) => {
		// Panned-out anchors stay out of view instead of accumulating along its edges.
		if (bounds && (point.x < 0 || point.y < 0 || point.x > bounds.width || point.y > bounds.height)) {
			return { id: point.id, x: 0, y: 0 };
		}
		const padding = bounds?.padding ?? 24;
		const origin = bounds
			? {
					x: Math.max(padding, Math.min(bounds.width - padding, point.x)),
					y: Math.max(padding, Math.min(bounds.height - padding, point.y)),
				}
			: point;
		let offset = { x: origin.x - point.x, y: origin.y - point.y };
		search: for (let ring = 0; ring <= points.length; ring++) {
			const steps = ring === 0 ? 1 : ring * 8;
			for (let step = 0; step < steps; step++) {
				const angle = (step / steps) * Math.PI * 2;
				const candidate = { x: Math.cos(angle) * ring * spacing, y: Math.sin(angle) * ring * spacing };
				const position = { x: origin.x + candidate.x, y: origin.y + candidate.y };
				if (
					bounds &&
					(position.x < padding ||
						position.y < padding ||
						position.x > bounds.width - padding ||
						position.y > bounds.height - padding)
				)
					continue;
				if (occupied.every((other) => Math.hypot(other.x - position.x, other.y - position.y) >= spacing)) {
					offset = { x: position.x - point.x, y: position.y - point.y };
					occupied.push(position);
					break search;
				}
			}
		}
		return { id: point.id, ...offset };
	});
}
