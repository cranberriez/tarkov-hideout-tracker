import type { inferLabelGrid, ItemDetection } from "./recognition-model";
import type { ReviewBox } from "./review-model";

export interface ScanHint {
	id: "nothing-found" | "no-grid" | "too-small" | "too-wide" | "blurry" | "hard-to-read";
	severity: "blocking" | "warning" | "info";
	title: string;
	detail: string;
}

// Thresholds come from a handful of benchmark screenshots: sharp crops read exact labels at a
// mean first-pass confidence of 86–91 with 63–84 px cells, while compressed, resized, or
// stream captures fall to 74–80.
const SMALL_CELL_PX = 50;
const BLURRY_CONFIDENCE = 83;
// One stash or container is about ten cells wide; full-screen captures span roughly 30.
const WIDE_CELLS = 18;
const TALL_CELLS = 20;
const HARD_TO_READ_SHARE = 0.1;

/** Whether a screenshot of this many cells can be one stash or container, with one shared lattice. */
export function fitsOneContainer(width: number, height: number, pitch: number) {
	return width / pitch <= WIDE_CELLS && height / pitch <= TALL_CELLS;
}

/**
 * Explains a poor scan from signals the pipeline already has. Only the first page read is
 * used for confidence, since isolated strips are cleaner than the screenshot as a whole.
 * Returns at most two hints, the most severe first.
 */
export function assessScan({
	width,
	height,
	scale,
	firstMatches,
	grid,
	boxes,
}: {
	/** OCR canvas size, after scaling. */
	width: number;
	height: number;
	/** OCR canvas pixels per source pixel. */
	scale: number;
	firstMatches: readonly ItemDetection[];
	grid: ReturnType<typeof inferLabelGrid>;
	boxes: readonly ReviewBox[];
}): ScanHint[] {
	if (!grid && !firstMatches.some((entry) => entry.match !== "unmatched"))
		return [
			{
				id: "nothing-found",
				severity: "blocking",
				title: "No items recognized",
				detail: "Use a sharp, full-resolution screenshot of your stash or one container, with English item names.",
			},
		];
	const hints: ScanHint[] = [];
	if (!grid)
		hints.push({
			id: "no-grid",
			severity: "warning",
			title: "Couldn't line up the item grid",
			detail:
				"Item sizes may be off and unlabeled items missed. Show at least four rows of items in a sharp screenshot.",
		});
	else {
		const cellPx = grid.pitch / scale;
		if (cellPx < SMALL_CELL_PX)
			hints.push({
				id: "too-small",
				severity: "warning",
				title: "Screenshot is too small",
				detail: `Cells are about ${Math.round(cellPx)} px. Use a full-resolution screenshot without resizing it.`,
			});
		if (!fitsOneContainer(width, height, grid.pitch))
			hints.push({
				id: "too-wide",
				severity: "warning",
				title: "Screenshot shows more than one container",
				detail: "Crop to a single container for faster, cleaner results. Menu text can be misread as items.",
			});
	}
	const exact = firstMatches.filter((entry) => entry.match === "exact").map((entry) => entry.confidence);
	if (exact.length >= 5 && exact.reduce((sum, value) => sum + value, 0) / exact.length < BLURRY_CONFIDENCE)
		hints.push({
			id: "blurry",
			severity: "warning",
			title: "Screenshot looks blurry or compressed",
			detail: "Use an uncompressed PNG screenshot. Stream captures and resized images read poorly.",
		});
	const unresolved = boxes.filter((box) => !box.itemId).length;
	if (!hints.length && boxes.length >= 10 && unresolved / boxes.length > HARD_TO_READ_SHARE)
		hints.push({
			id: "hard-to-read",
			severity: "info",
			title: "This screenshot was hard to read",
			detail: `${unresolved} of ${boxes.length} items couldn't be identified. A sharp crop of one container reads best.`,
		});
	return hints.slice(0, 2);
}
