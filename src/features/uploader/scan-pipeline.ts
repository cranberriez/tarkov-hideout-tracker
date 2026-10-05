import { detectFoundInRaid, FIR_MATCH, scoreFoundInRaid } from "./found-in-raid";
import { detectItemFootprints } from "./item-footprints";
import {
	inferLabelGrid,
	mergeLabelPasses,
	recognizeLabels,
	type buildLabelIndex,
	type ItemDetection,
	type LabelLine,
} from "./recognition-model";
import { buildLabelTasks, prepareLabelPixels } from "./label-preprocessing";
import { refineWithIcons, type IconLoader } from "./icon-matching";
import { dropContainedBoxes, seedReviewBoxes, suggestReviewGrid, type ReviewBox } from "./review-model";
import type { ItemSummary } from "../../types/items";
import { isMoney } from "./selection-model";
import { assessScan, type ScanHint } from "./scan-quality";

/** Grayscale ink on white, one byte per pixel. */
export interface GrayImage {
	data: Uint8Array;
	width: number;
	height: number;
}

/** Environment-specific OCR, so the browser worker and offline benchmarks share one pipeline. */
export interface LabelReader {
	/** Reads a whole screenshot (RGBA, already inverted to dark-on-light) as sparse text. */
	readPage(rgba: Uint8ClampedArray<ArrayBuffer>, width: number, height: number): Promise<LabelLine[]>;
	/** Reads one isolated label strip as a single line. */
	readStrip(strip: GrayImage): Promise<LabelLine[]>;
}

export function labelVocabulary(index: ReturnType<typeof buildLabelIndex>) {
	return [
		...new Set(
			[...index.values()].flatMap((items) =>
				items.flatMap((item) => (item.shortName ?? "").split(/\s+/).filter(Boolean)),
			),
		),
	];
}

function offsetLines(lines: LabelLine[], left: number, top: number): LabelLine[] {
	return lines.map((line) => ({
		words: line.words.map((word) => ({
			...word,
			bbox: { x0: word.bbox.x0 + left, x1: word.bbox.x1 + left, y0: word.bbox.y0 + top, y1: word.bbox.y1 + top },
		})),
	}));
}

export interface ScanResult {
	detections: ItemDetection[];
	boxes: ReviewBox[];
	/** Why the scan may have gone badly; a blocking hint means nothing was recognized. */
	hints: ScanHint[];
}

/**
 * Reads labels, then footprints and FIR badges, from a screenshot scaled for OCR, and seeds
 * review boxes. Catalog artwork then settles same-name and misread labels where it can.
 */
export async function scanLabels(
	rgba: Uint8ClampedArray<ArrayBuffer>,
	width: number,
	height: number,
	/** OCR canvas pixels per source pixel, so hints can describe the original screenshot. */
	scale: number,
	reader: LabelReader,
	items: readonly ItemSummary[],
	index: ReturnType<typeof buildLabelIndex>,
	loadIcon: IconLoader,
	signal: AbortSignal,
	onProgress: (label: string, progress: number) => void,
): Promise<ScanResult> {
	const originalPixels = rgba.slice();
	// Invert light stash labels into dark text on a light background for OCR.
	const masks = prepareLabelPixels(rgba);
	const lines = await reader.readPage(rgba, width, height);
	signal.throwIfAborted();
	const firstMatches = recognizeLabels(lines, index, width, height);
	let detections = firstMatches;
	const grid = inferLabelGrid(firstMatches, height);
	const assess = (boxes: ReviewBox[]) => assessScan({ width, height, scale, firstMatches, grid, boxes });
	const early = assess([]);
	if (early.some((hint) => hint.severity === "blocking")) return { detections: [], boxes: [], hints: early };
	if (grid) {
		onProgress("Refining grid labels", 0);
		// Isolate label-sized ink regions so grid borders and neighboring item art cannot
		// become prefixes on the label. A neutral-color pass also removes tinted outlines.
		const tasks = buildLabelTasks(masks, width, height, grid);
		const margin = Math.max(8, Math.round(grid.textHeight / 2));
		const refinedLines: LabelLine[] = [];
		for (const [row, task] of tasks.entries()) {
			signal.throwIfAborted();
			onProgress("Reading isolated item labels", row / (tasks.length || 1));
			const strip = { width: task.region.width + margin * 2, height: task.region.height + margin * 2 };
			const ink = new Uint8Array(strip.width * strip.height).fill(255);
			for (let y = 0; y < task.region.height; y++)
				for (let x = 0; x < task.region.width; x++)
					ink[(y + margin) * strip.width + x + margin] =
						task.mask[(y + task.region.top) * width + x + task.region.left];
			const read = await reader.readStrip({ data: ink, ...strip });
			refinedLines.push(...offsetLines(read, task.region.left - margin, task.top + task.region.top - margin));
		}
		// Keep low-confidence exact spellings visible for review, but do not count them
		// as certain identities unless another pass produces a stronger matching read.
		const refinedMatches = recognizeLabels(refinedLines, index, width, height, 0);
		detections = mergeLabelPasses(firstMatches, refinedMatches, grid, height);
	}
	detections = detectFoundInRaid(
		originalPixels,
		width,
		height,
		detectItemFootprints(originalPixels, width, height, detections),
	);
	const reviewGrid = suggestReviewGrid(detections, width, height);
	const byId = new Map(items.map((item) => [item.id, item]));
	let boxes = seedReviewBoxes(detections, reviewGrid, items);
	if (reviewGrid) {
		onProgress("Comparing item artwork", 0);
		const measured = new Set(
			detections.filter((entry) => entry.footprint && !entry.footprintTouchesFrame).map((entry) => entry.id),
		);
		boxes = await refineWithIcons(boxes, {
			shot: { data: originalPixels, width, height },
			grid: reviewGrid,
			measured,
			barterItems: items.filter((item) => item.barter),
			load: loadIcon,
			signal,
			onProgress: (progress) => onProgress("Comparing item artwork", progress),
		});
		// Artwork settles sizes and adds unlabeled items, so badges are checked again on final boxes.
		boxes = boxes.map((box) =>
			box.foundInRaid === "unknown" &&
			scoreFoundInRaid(originalPixels, width, height, box.bounds, reviewGrid.cellWidth * width) >= FIR_MATCH
				? { ...box, foundInRaid: "yes" }
				: box,
		);
	}
	// Money is entered more easily by hand than read from stack text, so it is left out.
	boxes = dropContainedBoxes(boxes).filter((box) => !isMoney(box.itemId ? byId.get(box.itemId) : undefined));
	return { detections, boxes, hints: assess(boxes) };
}
