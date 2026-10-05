import type { ItemSummary } from "../../types/items";
import { normalizeLabel, type buildLabelIndex } from "./recognition-model";

function distance(a: string, b: string) {
	let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
	for (let i = 1; i <= a.length; i++) {
		const row = [i];
		for (let j = 1; j <= b.length; j++)
			row[j] = Math.min(row[j - 1] + 1, previous[j] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
		previous = row;
	}
	return previous[b.length];
}

/** Suggestions only: fuzzy spelling never establishes an item identity. */
export function suggestLabelCandidates(text: string, index: ReturnType<typeof buildLabelIndex>): ItemSummary[] {
	const label = normalizeLabel(text);
	if (index.has(label)) return index.get(label)!;
	if (label.length < 4) return [];
	const limit = label.length >= 5 ? 2 : 1;
	const ranked = [...index]
		.flatMap(([alias, items]) => {
			if (alias.length < 4 || Math.abs(alias.length - label.length) > limit) return [];
			const score = distance(label, alias);
			return score <= limit ? items.map((item) => ({ item, score })) : [];
		})
		.sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name));
	return [...new Map(ranked.map(({ item }) => [item.id, item])).values()].slice(0, 8);
}
