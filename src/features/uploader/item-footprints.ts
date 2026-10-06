import type { ItemDetection } from "./recognition-model";
import { clampBox, type ReviewGrid } from "./review-model";

/**
 * Mean luminance a lattice line must stand above its surroundings to count as cell borders.
 * Single-container screenshots peaked at 18-41; a multi-panel capture without one shared
 * lattice stayed below 7 inside the search window.
 */
const BORDER_CONTRAST = 12;

/**
 * Labels only estimate where cells start (they read 1-3 px high). Cell borders are thin light
 * strokes repeating at the pitch, so the lattice moves onto a clear peak of such strokes near
 * its estimate. A best value at the edge of the search is a slope, not a peak, and is ignored.
 */
export function alignGridToBorders(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	grid: ReviewGrid,
): ReviewGrid {
	const pitch = grid.cellWidth * width;
	const rows = new Float64Array(height),
		columns = new Float64Array(width);
	for (let y = 0; y < height; y++)
		for (let x = 0; x < width; x++) {
			const offset = (y * width + x) * 4;
			const value = (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
			rows[y] += value / width;
			columns[x] += value / height;
		}
	// Within a few percent of a cell: the label's own text sits just below and left of a border.
	const reach = Math.max(2, Math.round(pitch * 0.08));
	const side = Math.max(2, Math.round(pitch * 0.02));
	const align = (profile: Float64Array, estimate: number) => {
		const contrasts: number[] = [];
		for (let delta = -reach; delta <= reach; delta++) {
			let contrast = 0,
				lines = 0;
			for (let line = (((estimate + delta) % pitch) + pitch) % pitch; line < profile.length; line += pitch) {
				const at = Math.round(line);
				if (at - side < 0 || at + side >= profile.length) continue;
				contrast += profile[at] - (profile[at - side] + profile[at + side]) / 2;
				lines++;
			}
			contrasts.push(lines >= 2 ? contrast / lines : -Infinity);
		}
		const peaks = contrasts
			.map((contrast, index) => ({ index, contrast }))
			.filter(
				({ index, contrast }) =>
					index > 0 &&
					index < contrasts.length - 1 &&
					contrast >= contrasts[index - 1] &&
					contrast >= contrasts[index + 1],
			)
			.sort((a, b) => b.contrast - a.contrast);
		// Containers with different lattices in one capture leave rival peaks; keep the labels' estimate.
		const [best, rival] = peaks;
		if (!best || best.contrast < BORDER_CONTRAST || (rival && rival.contrast > best.contrast * 0.6)) return estimate;
		return estimate + best.index - reach;
	};
	return { ...grid, left: align(columns, grid.left * width) / width, top: align(rows, grid.top * height) / height };
}

/** Look for sustained cell-border edges, rather than using label length as item width. */
export function detectItemFootprints(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	detections: ItemDetection[],
	grid: ReviewGrid | null,
) {
	if (!grid) return detections;
	const pitch = grid.cellWidth * width;
	// A tightly cropped stash can omit the outer stroke. Only lattice boundaries
	// near the image frame qualify; interior missing borders are never invented.
	const atFrame = (coordinate: number, limit: number) =>
		(coordinate >= -pitch * 0.08 && coordinate <= pitch * 0.3) ||
		(coordinate >= limit - pitch * 0.3 && coordinate <= limit + pitch * 0.08);
	const luminance = (x: number, y: number) => {
		const offset =
			(Math.max(0, Math.min(height - 1, Math.round(y))) * width + Math.max(0, Math.min(width - 1, Math.round(x)))) * 4;
		return (data[offset] + data[offset + 1] + data[offset + 2]) / 3;
	};
	const edge = (vertical: boolean, coordinate: number, start: number, length: number) => {
		let best = 0;
		const margin = Math.max(2, Math.round(pitch * 0.08));
		for (let delta = -margin; delta <= margin; delta++) {
			let hits = 0,
				samples = 0;
			const tones: number[] = [];
			for (let along = start + length * 0.04; along < start + length * 0.96; along += Math.max(1, pitch / 40)) {
				const at = coordinate + delta;
				const values = [-2, 0, 2].map((d) => (vertical ? luminance(at + d, along) : luminance(along, at + d)));
				tones.push(values[1]);
				if (Math.max(...values) - Math.min(...values) >= 7) hits++;
				samples++;
			}
			tones.sort((a, b) => a - b);
			if (tones[Math.floor(tones.length * 0.85)] - tones[Math.floor(tones.length * 0.15)] < 22)
				best = Math.max(best, hits / samples);
		}
		return best >= 0.88;
	};
	return detections.map((detection) => {
		const b = detection.bounds;
		const right = (grid.left + Math.round((b.left + b.width - grid.left) / grid.cellWidth) * grid.cellWidth) * width;
		const top = (grid.top + Math.round((b.top - grid.top) / grid.cellHeight) * grid.cellHeight) * height;
		let columns = 1,
			rows = 1;
		while (
			columns < 6 &&
			right - (columns + 1) * pitch >= -pitch * 0.08 &&
			!atFrame(right - columns * pitch, width) &&
			!edge(true, right - columns * pitch, top, pitch)
		)
			columns++;
		const left = right - columns * pitch;
		while (
			rows < 6 &&
			top + (rows + 1) * pitch <= height + pitch * 0.08 &&
			!atFrame(top + rows * pitch, height) &&
			!edge(false, top + rows * pitch, left, columns * pitch)
		)
			rows++;
		// A footprint must not swallow another item's label on a different cell.
		const containsOther = detections.some(
			(other) =>
				other.id !== detection.id &&
				other.match === "exact" &&
				other.confidence >= 70 &&
				other.candidates.length > 0 &&
				// Labels are right-aligned, so one in a lower row of the same column ends at this right edge.
				other.bounds.left * width > left - pitch * 0.1 &&
				(other.bounds.left + other.bounds.width) * width < right + pitch * 0.1 &&
				other.bounds.top * height >= top &&
				other.bounds.top * height < top + rows * pitch - pitch * 0.1 &&
				(Math.abs(other.bounds.top - b.top) * height > pitch * 0.4 ||
					Math.abs(other.bounds.left + other.bounds.width - b.left - b.width) * width > pitch * 0.4),
		);
		if (containsOther) return detection;
		const borders = [
			{ visible: edge(true, left, top, rows * pitch), frame: atFrame(left, width) },
			{ visible: edge(true, right, top, rows * pitch), frame: atFrame(right, width) },
			{ visible: edge(false, top + rows * pitch, left, columns * pitch), frame: atFrame(top + rows * pitch, height) },
		];
		if (borders.some((border) => !border.visible && !border.frame)) return detection;
		const touchesFrame = borders.some((border) => !border.visible);
		// Borrowing the image boundary requires a visible top and at least one
		// other measured side. A flat crop must not turn into one huge item.
		if (touchesFrame && (!edge(false, top, left, columns * pitch) || !borders.some((border) => border.visible)))
			return detection;
		return {
			...detection,
			footprintTouchesFrame: touchesFrame,
			footprint: clampBox({
				left: left / width,
				top: top / height,
				width: (columns * pitch) / width,
				height: (rows * pitch) / height,
			}),
		};
	});
}
