import type { ItemSummary } from "../../types/items";
import type { ReviewBox } from "./review-model";

export function nextUnknownId(
	ids: readonly string[],
	unknownIds: readonly string[],
	anchor: string | null,
	direction: 1 | -1 = 1,
) {
	const current = anchor ? ids.indexOf(anchor) : -1;
	const candidates = direction === 1 ? unknownIds : [...unknownIds].reverse();
	return (
		candidates.find((id) => (direction === 1 ? ids.indexOf(id) > current : ids.indexOf(id) < current)) ??
		candidates[0] ??
		null
	);
}

export function selectReviewBoxes(
	ids: readonly string[],
	selected: readonly string[],
	anchor: string | null,
	clicked: string,
	toggle: boolean,
	range: boolean,
	eligible: readonly string[] = ids,
) {
	if (!toggle && !range) return [clicked];
	// Known boxes remain individually editable, but never enter a bulk selection.
	const allowed = new Set(eligible);
	const current = selected.filter((id) => allowed.has(id));
	if (!allowed.has(clicked)) return current;
	if (range && anchor && ids.includes(anchor)) {
		const ends = [ids.indexOf(anchor), ids.indexOf(clicked)].sort((a, b) => a - b);
		const span = ids.slice(ends[0], ends[1] + 1).filter((id) => allowed.has(id));
		return toggle ? [...new Set([...current, ...span])] : span;
	}
	return toggle
		? current.includes(clicked)
			? current.filter((id) => id !== clicked)
			: [...current, clicked]
		: [clicked];
}

export function supportsQuantity(item: ItemSummary | undefined) {
	return !!item && ["roubles", "dollars", "euros", "gp-coin"].includes(item.normalizedName);
}

/** Combine evidence across the selection, retaining candidate rank and preferring repeated matches. */
export function selectionSuggestions(boxes: readonly ReviewBox[], items: readonly ItemSummary[]) {
	const catalog = new Map(items.map((item) => [item.id, item]));
	const scores = new Map<string, number>();
	for (const box of boxes) {
		const ids = [...new Set([...(box.itemId ? [box.itemId] : []), ...box.candidates.map((item) => item.id)])].filter(
			(id) => catalog.has(id),
		);
		ids.forEach((id, rank) => {
			if (catalog.has(id)) scores.set(id, (scores.get(id) ?? 0) + 1 / (rank + 1));
		});
	}
	return [...scores]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 5)
		.map(([id]) => catalog.get(id)!);
}
