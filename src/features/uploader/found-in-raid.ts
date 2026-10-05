import { FIR_TEMPLATE } from "./fir-template";
import type { ItemDetection } from "./recognition-model";
import { suggestReviewGrid } from "./review-model";

export type FoundInRaidStatus = "yes" | "no" | "unknown";
export const foundInRaidLabel = (status: FoundInRaidStatus) =>
	status === "yes" ? "Found in raid" : status === "no" ? "Not found in raid" : "FIR unknown";

const side = 16;
const mean = FIR_TEMPLATE.reduce((sum, value) => sum + value, 0) / FIR_TEMPLATE.length;
const reference = FIR_TEMPLATE.map((value) => value - mean);
const energy = reference.reduce((sum, value) => sum + value * value, 0);

/** Normalized correlation, not a probability. Absence of a match is never proof of non-FIR. */
export function scoreFoundInRaid(
	data: Uint8ClampedArray,
	width: number,
	height: number,
	bounds: ItemDetection["bounds"],
	cellPixels: number,
): number {
	if (cellPixels < 35 || data.length !== width * height * 4) return 0;
	const right = (bounds.left + bounds.width) * width;
	const bottom = (bounds.top + bounds.height) * height;
	if (right > width - 1 || bottom > height - 1) return 0;
	const gray = (x: number, y: number) => {
		const offset = (y * width + x) * 4;
		return data[offset] * 0.299 + data[offset + 1] * 0.587 + data[offset + 2] * 0.114;
	};
	const sample = (x: number, y: number) => {
		const ix = Math.floor(x),
			iy = Math.floor(y),
			fx = x - ix,
			fy = y - iy;
		return (
			gray(ix, iy) * (1 - fx) * (1 - fy) +
			gray(ix + 1, iy) * fx * (1 - fy) +
			gray(ix, iy + 1) * (1 - fx) * fy +
			gray(ix + 1, iy + 1) * fx * fy
		);
	};
	let best = 0;
	for (const scale of [0.21, 0.235, 0.26]) {
		const size = cellPixels * scale;
		for (let dx = -0.05; dx <= 0.05; dx += 0.025)
			// A stack count or durability line sits under the badge, lifting it about one text row.
			for (const dy of [-0.05, -0.025, 0, 0.025, 0.05, -0.2, -0.175, -0.15]) {
				const left = right - size - cellPixels * 0.015 + dx * cellPixels;
				const top = bottom - size - cellPixels * 0.015 + dy * cellPixels;
				if (left < bounds.left * width || top < bounds.top * height || left + size >= width || top + size >= height)
					continue;
				let sum = 0,
					squares = 0,
					product = 0;
				for (let y = 0; y < side; y++)
					for (let x = 0; x < side; x++) {
						const value = sample(left + ((x + 0.5) * size) / side, top + ((y + 0.5) * size) / side);
						sum += value;
						squares += value * value;
						product += value * reference[y * side + x];
					}
				const variance = squares - (sum * sum) / reference.length;
				if (variance / reference.length >= 36) best = Math.max(best, product / Math.sqrt(variance * energy));
			}
	}
	return best;
}

/**
 * Calibrated on stash screenshots: corners without a badge scored at most 0.52 (artwork,
 * transfer symbols, weapons), badges over plain or dark art 0.58-0.98.
 */
export const FIR_MATCH = 0.67;

export function detectFoundInRaid(data: Uint8ClampedArray, width: number, height: number, detections: ItemDetection[]) {
	const grid = suggestReviewGrid(detections, width, height);
	return detections.map((detection) => ({
		...detection,
		foundInRaid:
			grid &&
			detection.footprint &&
			scoreFoundInRaid(data, width, height, detection.footprint, grid.cellWidth * width) >= FIR_MATCH
				? ("yes" as const)
				: ("unknown" as const),
	}));
}
