import type { FoundInRaidStatus } from "./found-in-raid";
import {
	extendedCandidates,
	preferredCandidate,
	rankCandidates,
	scoreLabelCandidates,
	suggestLabelCandidates,
} from "./label-suggestions";
import type { ItemSummary } from "../../types/items";
import { buildLabelIndex, inferLabelGrid, normalizeLabel, type ItemDetection } from "./recognition-model";

export type BoxBounds = ItemDetection["bounds"];
export interface ReviewBox {
	id: string;
	bounds: BoxBounds;
	text: string;
	candidates: ItemSummary[];
	itemId: string | null;
	quantity: number;
	confirmed: boolean;
	foundInRaid: FoundInRaidStatus;
	firConfirmed: boolean;
}
export interface ReviewGrid {
	left: number;
	top: number;
	cellWidth: number;
	cellHeight: number;
}

export function clampBox(bounds: BoxBounds): BoxBounds {
	const left = Math.max(0, Math.min(0.995, bounds.left));
	const top = Math.max(0, Math.min(0.995, bounds.top));
	return {
		left,
		top,
		width: Math.max(0.005, Math.min(1 - left, bounds.width)),
		height: Math.max(0.005, Math.min(1 - top, bounds.height)),
	};
}

/** A suggested square-cell lattice, not a claim that item footprints were detected. */
export function suggestReviewGrid(
	detections: readonly ItemDetection[],
	width: number,
	height: number,
): ReviewGrid | null {
	const rows = inferLabelGrid(detections, height);
	if (!rows || width <= 0) return null;
	const cellWidth = rows.pitch / width;
	const rightEdges = detections
		.filter((d) => d.match === "exact" && d.confidence >= 70)
		.map((d) => d.bounds.left + d.bounds.width + (rows.textHeight * 0.2) / width);
	let phase = 0,
		best = 0;
	for (const right of rightEdges) {
		const candidate = right % cellWidth;
		const support = rightEdges.filter(
			(edge) => Math.abs(edge - candidate - Math.round((edge - candidate) / cellWidth) * cellWidth) < cellWidth * 0.08,
		).length;
		if (support > best) {
			phase = candidate;
			best = support;
		}
	}
	if (best < 4) return null;
	return {
		left: phase,
		top: (rows.firstTop - rows.textHeight * 0.4) / height,
		cellWidth,
		cellHeight: rows.pitch / height,
	};
}

/** A detection's footprint, or the cell(s) its label suggests when no footprint was measured. */
export function detectionBounds(detection: ItemDetection, grid: ReviewGrid | null): BoxBounds {
	const bounds = detection.bounds;
	if (detection.footprint) return detection.footprint;
	if (grid) {
		const right = grid.left + Math.round((bounds.left + bounds.width - grid.left) / grid.cellWidth) * grid.cellWidth;
		const columns = Math.max(1, Math.ceil((bounds.width - grid.cellWidth * 0.12) / grid.cellWidth));
		return clampBox({
			left: right - columns * grid.cellWidth,
			top: grid.top + Math.round((bounds.top - grid.top) / grid.cellHeight) * grid.cellHeight,
			width: columns * grid.cellWidth,
			height: grid.cellHeight,
		});
	}
	return clampBox({
		left: bounds.left - bounds.height,
		top: bounds.top - bounds.height * 0.4,
		width: Math.max(bounds.width + bounds.height, bounds.height * 5),
		height: bounds.height * 5,
	});
}

/** The only barter item among same-spelling candidates, as junk-box screenshots favor them. */
function soleBarter(candidates: readonly ItemSummary[]) {
	const barter = candidates.filter((item) => item.barter);
	return barter.length === 1 ? barter[0].id : null;
}

function initialItem(
	detection: ItemDetection,
	candidates: readonly ItemSummary[],
	index: ReturnType<typeof buildLabelIndex>,
) {
	if (detection.match === "unmatched")
		return preferredCandidate(scoreLabelCandidates(detection.text, index))?.id ?? null;
	if (candidates.length > 1) return soleBarter(candidates);
	// Low-confidence reads of an exact spelling start assigned, except two-letter
	// labels, which artwork fragments reproduce too easily.
	if (detection.match === "uncertain" && normalizeLabel(detection.text).length < 3) return null;
	return candidates[0]?.id ?? null;
}

export function seedReviewBoxes(
	detections: readonly ItemDetection[],
	grid: ReviewGrid | null,
	items: readonly ItemSummary[] = [],
): ReviewBox[] {
	const boxes: ReviewBox[] = [];
	const index = buildLabelIndex(items);
	// Real candidates take precedence over OCR fragments in the same suggested cell.
	const ordered = [...detections].sort((a, b) => Number(b.match !== "unmatched") - Number(a.match !== "unmatched"));
	for (const detection of ordered) {
		if (detection.match === "unmatched" && (detection.confidence < 35 || normalizeLabel(detection.text).length < 3))
			continue;
		const bounds = detectionBounds(detection, grid);
		const existing = boxes.find((box) => overlapFraction(box.bounds, bounds) > 0.7);
		if (existing) {
			if (detection.candidates.length) {
				const candidates = new Map([...existing.candidates, ...detection.candidates].map((item) => [item.id, item]));
				existing.candidates = rankCandidates([...candidates.values()]);
				if (candidates.size > 1) existing.itemId = soleBarter(existing.candidates);
			}
			continue;
		}
		const read = detection.candidates.length
			? rankCandidates(detection.candidates)
			: suggestLabelCandidates(detection.text, index);
		const candidates = [
			...new Map([...read, ...extendedCandidates(detection.text, index)].map((item) => [item.id, item])).values(),
		];
		boxes.push({
			id: detection.id,
			bounds,
			text: detection.text,
			candidates,
			itemId: initialItem(detection, read, index),
			quantity: 1,
			confirmed: false,
			foundInRaid: detection.foundInRaid ?? "unknown",
			firConfirmed: false,
		});
	}
	return boxes.sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);
}

export function overlapFraction(a: BoxBounds, b: BoxBounds) {
	const area =
		Math.max(0, Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left)) *
		Math.max(0, Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top));
	return area / Math.min(a.width * a.height, b.width * b.height);
}

export type ReviewEntry = Pick<ReviewBox, "itemId" | "quantity" | "foundInRaid">;

export function summarizeReview(boxes: readonly ReviewEntry[], items: readonly ItemSummary[]) {
	const catalog = new Map(items.map((item) => [item.id, item]));
	const totals = new Map<string, { item: ItemSummary; quantity: number; foundInRaid: FoundInRaidStatus }>();
	let unresolved = 0;
	for (const box of boxes) {
		const item = box.itemId ? catalog.get(box.itemId) : undefined;
		if (!item || !Number.isSafeInteger(box.quantity) || box.quantity < 1) {
			unresolved++;
			continue;
		}
		const key = `${item.id}:${box.foundInRaid}`;
		const total = totals.get(key) ?? { item, quantity: 0, foundInRaid: box.foundInRaid };
		total.quantity += box.quantity;
		if (!Number.isSafeInteger(total.quantity)) unresolved++;
		totals.set(key, total);
	}
	return { totals: [...totals.values()], unresolved };
}

/** Stable IDs and reviewed quantities for a later recommendations step; never writes inventory. */
export function finishReview(boxes: readonly ReviewEntry[], items: readonly ItemSummary[]) {
	const result = summarizeReview(boxes, items);
	if (!boxes.length || result.unresolved) return null;
	return result.totals.map(({ item, quantity, foundInRaid }) => ({ itemId: item.id, quantity, foundInRaid }));
}
