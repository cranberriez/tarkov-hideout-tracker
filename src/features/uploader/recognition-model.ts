import type { FoundInRaidStatus } from "./found-in-raid";
import type { ItemSummary } from "../../types/items";

export interface LabelWord {
	text: string;
	confidence: number;
	bbox: { x0: number; y0: number; x1: number; y1: number };
}

export interface LabelLine {
	words: LabelWord[];
}

export interface ItemDetection {
	/** Missing outer stroke inferred from the image frame; not reliable for strict size filtering. */
	footprintTouchesFrame?: boolean;
	foundInRaid?: FoundInRaidStatus;
	footprint?: { left: number; top: number; width: number; height: number };
	id: string;
	text: string;
	confidence: number;
	match: "exact" | "uncertain" | "ambiguous" | "unmatched";
	candidates: ItemSummary[];
	/** Relative bounds of the visible label, not the item's footprint. */
	bounds: { left: number; top: number; width: number; height: number };
}

export function normalizeLabel(text: string): string {
	return text.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function buildLabelIndex(items: readonly ItemSummary[]) {
	const aliases = new Map<string, ItemSummary[]>();
	for (const item of items) {
		for (const value of [item.shortName]) {
			const alias = normalizeLabel(value ?? "");
			if (alias.length < 2 || !/[a-z]/.test(alias)) continue;
			const entries = aliases.get(alias) ?? [];
			if (!entries.some((entry) => entry.id === item.id)) entries.push(item);
			aliases.set(alias, entries);
		}
	}
	return aliases;
}

function validWord(word: LabelWord, width: number, height: number, minimumConfidence: number): boolean {
	const { x0, y0, x1, y1 } = word.bbox;
	return (
		!!word.text.trim() &&
		[x0, y0, x1, y1, word.confidence].every(Number.isFinite) &&
		word.confidence >= minimumConfidence &&
		x1 > x0 &&
		y1 > y0 &&
		x1 > 0 &&
		y1 > 0 &&
		x0 < width &&
		y0 < height
	);
}

export function recognizeLabels(
	lines: readonly LabelLine[],
	index: ReturnType<typeof buildLabelIndex>,
	width: number,
	height: number,
	minimumConfidence = 35,
): ItemDetection[] {
	if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return [];
	const detections: ItemDetection[] = [];
	for (const [lineIndex, line] of lines.entries()) {
		// Do not bridge words rejected for poor OCR confidence.
		const consumed = new Set<number>();
		const spans: { start: number; length: number; words: LabelWord[]; text: string; confidence: number }[] = [];
		for (let start = 0; start < line.words.length; start++) {
			const words: LabelWord[] = [];
			for (let length = 1; length <= 5 && start + length <= line.words.length; length++) {
				const word = line.words[start + length - 1];
				if (!validWord(word, width, height, minimumConfidence)) break;
				const previous = words.at(-1);
				if (
					previous &&
					word.bbox.x0 - previous.bbox.x1 >
						Math.max(word.bbox.y1 - word.bbox.y0, previous.bbox.y1 - previous.bbox.y0) * 1.5
				)
					break;
				words.push(word);
				spans.push({
					start,
					length,
					words: [...words],
					text: words.map((entry) => entry.text).join(" "),
					confidence: Math.min(...words.map((entry) => entry.confidence)),
				});
			}
		}
		const add = (span: (typeof spans)[number], candidates: ItemSummary[], match: ItemDetection["match"]) => {
			const x0 = Math.max(0, Math.min(...span.words.map((word) => word.bbox.x0)));
			const y0 = Math.max(0, Math.min(...span.words.map((word) => word.bbox.y0)));
			const x1 = Math.min(width, Math.max(...span.words.map((word) => word.bbox.x1)));
			const y1 = Math.min(height, Math.max(...span.words.map((word) => word.bbox.y1)));
			detections.push({
				id: `${lineIndex}:${span.start}`,
				text: span.text,
				confidence: span.confidence,
				match,
				candidates,
				bounds: { left: x0 / width, top: y0 / height, width: (x1 - x0) / width, height: (y1 - y0) / height },
			});
			for (let offset = 0; offset < span.length; offset++) consumed.add(span.start + offset);
		};
		// Longest exact short name wins before individual words. Never guess a different name.
		spans.sort((a, b) => b.length - a.length || a.start - b.start);
		for (const span of spans) {
			if (span.words.some((_, offset) => consumed.has(span.start + offset))) continue;
			// Borders often become separate punctuation tokens. They are not part of
			// the name and must not expand its bounds or lower its text confidence.
			if (!normalizeLabel(span.words[0].text) || !normalizeLabel(span.words.at(-1)!.text)) continue;
			const label = normalizeLabel(span.text);
			if (label.length === 2 && span.confidence < 35) continue;
			const candidates = index.get(label);
			if (candidates)
				add(
					span,
					candidates,
					candidates.length > 1
						? "ambiguous"
						: span.confidence < (label.length === 2 ? 85 : 35)
							? "uncertain"
							: "exact",
				);
		}
		for (const span of spans) {
			if (span.length !== 1 || consumed.has(span.start) || !/[a-z]/.test(normalizeLabel(span.text))) continue;
			add(span, [], "unmatched");
		}
	}
	return detections.sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);
}

export function summarizeDetections(detections: readonly ItemDetection[]) {
	const groups = new Map<string, { item: ItemSummary; occurrences: number; detectionIds: string[] }>();
	for (const detection of detections) {
		if (detection.match !== "exact") continue;
		const item = detection.candidates[0];
		if (!item) continue;
		const group = groups.get(item.id) ?? { item, occurrences: 0, detectionIds: [] };
		group.occurrences++;
		group.detectionIds.push(detection.id);
		groups.set(item.id, group);
	}
	return [...groups.values()];
}

/** Infer repeated label rows only when enough independent rows agree. */
export function inferLabelGrid(detections: readonly ItemDetection[], height: number) {
	const exact = detections.filter((entry) => entry.match === "exact" && entry.confidence >= 70);
	if (exact.length < 8 || !Number.isFinite(height) || height <= 0) return null;
	const heights = exact.map((entry) => entry.bounds.height * height).sort((a, b) => a - b);
	const textHeight = heights[Math.floor(heights.length / 2)];
	if (textHeight <= 0) return null;
	const tolerance = Math.max(2, textHeight * 0.45);
	const rows: number[] = [];
	for (const top of exact.map((entry) => entry.bounds.top * height).sort((a, b) => a - b)) {
		if (!rows.some((row) => Math.abs(row - top) <= tolerance)) rows.push(top);
	}
	if (rows.length < 4) return null;
	let best: { pitch: number; firstTop: number; rows: number[]; error: number } | null = null;
	for (let i = 0; i < rows.length; i++) {
		for (let j = i + 1; j < rows.length; j++) {
			for (let divisor = 1; divisor <= 6; divisor++) {
				const pitch = (rows[j] - rows[i]) / divisor;
				if (pitch < textHeight * 3 || pitch > Math.min(textHeight * 12, height / 3)) continue;
				const aligned = rows.filter(
					(row) => Math.abs(row - rows[i] - Math.round((row - rows[i]) / pitch) * pitch) <= tolerance,
				);
				if (aligned.length < 4 || aligned.length / rows.length < 0.75) continue;
				const adjacentPairs = aligned
					.slice(1)
					.filter((row, offset) => Math.abs(row - aligned[offset] - pitch) <= tolerance * 2).length;
				if (adjacentPairs < 2) continue;
				// Fit all supported rows instead of selecting the largest near-fit pitch, which drifts
				// far enough down a dense stash to cut labels in half or read artwork below them.
				const positions = aligned.map((row) => Math.round((row - rows[i]) / pitch));
				const meanPosition = positions.reduce((sum, value) => sum + value, 0) / positions.length;
				const meanTop = aligned.reduce((sum, value) => sum + value, 0) / aligned.length;
				const variance = positions.reduce((sum, value) => sum + (value - meanPosition) ** 2, 0);
				const fittedPitch =
					aligned.reduce((sum, row, offset) => sum + (positions[offset] - meanPosition) * (row - meanTop), 0) /
					variance;
				const origin = meanTop - fittedPitch * meanPosition;
				const error =
					aligned.reduce((sum, row, offset) => sum + Math.abs(row - (origin + positions[offset] * fittedPitch)), 0) /
					aligned.length;
				if (
					!best ||
					aligned.length > best.rows.length ||
					(aligned.length === best.rows.length &&
						(error < best.error - 0.01 || (Math.abs(error - best.error) <= 0.01 && fittedPitch > best.pitch)))
				)
					best = { pitch: fittedPitch, firstTop: origin + Math.min(...positions) * fittedPitch, rows: aligned, error };
			}
		}
	}
	return best ? { pitch: best.pitch, firstTop: best.firstTop, textHeight, tolerance } : null;
}

/** Combine complementary OCR passes without counting the same label twice. */
export function mergeLabelPasses(
	original: readonly ItemDetection[],
	refined: readonly ItemDetection[],
	grid: NonNullable<ReturnType<typeof inferLabelGrid>>,
	height: number,
): ItemDetection[] {
	const rank = { exact: 3, ambiguous: 2, uncertain: 1, unmatched: 0 };
	const result: ItemDetection[] = [];
	for (const [pass, detections] of [
		["original", original],
		["refined", refined],
	] as const) {
		for (const detection of detections) {
			const top = detection.bounds.top * height;
			const row = Math.round((top - grid.firstTop) / grid.pitch);
			if (
				row < 0 ||
				Math.abs(top - grid.firstTop - row * grid.pitch) > grid.tolerance * 1.5 ||
				detection.bounds.height * height > grid.textHeight * 1.8
			)
				continue;
			const bounds = detection.bounds;
			const duplicate = result.findIndex((entry) => {
				const other = entry.bounds;
				const intersection =
					Math.max(
						0,
						Math.min(bounds.left + bounds.width, other.left + other.width) - Math.max(bounds.left, other.left),
					) *
					Math.max(0, Math.min(bounds.top + bounds.height, other.top + other.height) - Math.max(bounds.top, other.top));
				return intersection / Math.min(bounds.width * bounds.height, other.width * other.height) > 0.5;
			});
			const candidate = { ...detection, id: `${pass}:${detection.id}` };
			if (duplicate === -1) {
				result.push(candidate);
				continue;
			}
			const previous = result[duplicate];
			const candidates = new Map([...previous.candidates, ...candidate.candidates].map((item) => [item.id, item]));
			if (previous.match !== "unmatched" && candidate.match !== "unmatched" && candidates.size > 1) {
				result[duplicate] = {
					...candidate,
					match: "ambiguous",
					candidates: [...candidates.values()],
				};
			} else if (
				rank[candidate.match] > rank[previous.match] ||
				(rank[candidate.match] === rank[previous.match] && candidate.confidence > previous.confidence)
			)
				result[duplicate] = candidate;
		}
	}
	return result.sort((a, b) => a.bounds.top - b.bounds.top || a.bounds.left - b.bounds.left);
}
