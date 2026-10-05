import type { ItemSummary } from "../../types/items";
import { normalizeLabel, type buildLabelIndex } from "./recognition-model";

// Glyph pairs the stash font's small labels are commonly misread as; each costs half an edit.
const CONFUSABLE = new Set(
	["od", "og", "oa", "o0", "ec", "il", "i1", "l1", "lt", "s5", "b8", "nh", "uv", "ft", "rt", "ce"].flatMap((pair) => [
		pair,
		pair[1] + pair[0],
	]),
);

function distance(a: string, b: string) {
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++) {
			const substitution = a[i - 1] === b[j - 1] ? 0 : CONFUSABLE.has(a[i - 1] + b[j - 1]) ? 0.5 : 1;
			row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + substitution);
		}
		previous = row;
	}
	return previous[b.length];
}

/** Cost limit by read length: short reads tolerate only a single confusable glyph. */
const allowance = (length: number) =>
	length >= 7 ? 2 : length >= 5 ? 1.5 : length === 4 ? 1 : length === 3 ? 0.5 : -1;

/** Barter items (junk-box contents) outrank gear and keys that share a short name. */
export function rankCandidates(items: readonly ItemSummary[]): ItemSummary[] {
	return [...items].sort((a, b) => Number(!!b.barter) - Number(!!a.barter));
}

export interface ScoredCandidate {
	item: ItemSummary;
	/** Weighted edits from the read; 0 is an exact normalized spelling. */
	score: number;
}

export function scoreLabelCandidates(text: string, index: ReturnType<typeof buildLabelIndex>): ScoredCandidate[] {
	const label = normalizeLabel(text);
	const exact = index.get(label);
	if (exact) return rankCandidates(exact).map((item) => ({ item, score: 0 }));
	const limit = allowance(label.length);
	if (limit < 0) return [];
	const ranked = [...index].flatMap(([alias, items]) => {
		if (alias.length < 3 || Math.abs(alias.length - label.length) > Math.ceil(limit) + 3) return [];
		let score = distance(label, alias);
		// The game truncates long short names to the cell width, so a read can be a prefix.
		// Four-letter reads only match a truncation exactly; any edit there finds unrelated names.
		if (alias.length > label.length && label.length >= 4) {
			const prefix = distance(label, alias.slice(0, label.length));
			if (label.length > 4 || prefix === 0) score = Math.min(score, 0.5 + prefix);
		}
		return score <= limit ? items.map((item) => ({ item, score })) : [];
	});
	ranked.sort(
		(a, b) =>
			a.score - b.score || Number(!!b.item.barter) - Number(!!a.item.barter) || a.item.name.localeCompare(b.item.name),
	);
	return [...new Map(ranked.map((entry) => [entry.item.id, entry])).values()].slice(0, 8);
}

export function suggestLabelCandidates(text: string, index: ReturnType<typeof buildLabelIndex>): ItemSummary[] {
	return scoreLabelCandidates(text, index).map(({ item }) => item);
}

/**
 * One identity the evidence clearly favors: the only item at the best score, or the only barter
 * item there, with any other spelling at least one full edit worse.
 */
export function preferredCandidate(scored: readonly ScoredCandidate[]): ItemSummary | null {
	if (!scored.length) return null;
	const best = scored[0].score;
	const tied = scored.filter((entry) => entry.score === best);
	const barter = tied.filter((entry) => entry.item.barter);
	const choice = tied.length === 1 ? tied[0] : barter.length === 1 ? barter[0] : null;
	if (!choice) return null;
	const runnerUp = scored.find((entry) => entry.score > best);
	return !runnerUp || runnerUp.score - best >= 1 || (choice.item.barter && !runnerUp.item.barter) ? choice.item : null;
}

/**
 * Longer short names containing the read: a word OCR dropped ("CPU" of "CPU fan", "scdr" of
 * "F scdr.") or a truncated label. Artwork can choose among them; the text alone does not.
 */
export function extendedCandidates(text: string, index: ReturnType<typeof buildLabelIndex>): ItemSummary[] {
	const label = normalizeLabel(text);
	if (label.length < 3) return [];
	const matches = [...index].flatMap(([alias, items]) =>
		alias !== label && (label.length >= 4 ? alias.includes(label) : alias.startsWith(label) || alias.endsWith(label))
			? items
			: [],
	);
	return rankCandidates(matches).slice(0, 6);
}
