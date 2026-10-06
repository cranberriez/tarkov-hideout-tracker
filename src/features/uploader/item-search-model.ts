import type { ItemSummary } from "@/types/items";
import { itemGroup, type ItemGroupKey } from "@/lib/data/item-groups";

export const ITEM_SEARCH_LIMIT = 50;

/**
 * Uploader item search: name and short-name matches followed by extra candidates (label reads),
 * narrowed to `group`. Without a query the baseline shows, or the whole group when one is set.
 */
export function searchUploaderItems({
	items,
	query,
	group,
	baseline = [],
	extra = [],
}: {
	items: readonly ItemSummary[];
	query: string;
	group: ItemGroupKey | null;
	baseline?: readonly ItemSummary[];
	extra?: readonly ItemSummary[];
}): ItemSummary[] {
	const text = query.trim().toLowerCase();
	const inGroup = (item: ItemSummary) => !group || itemGroup(item) === group;
	const candidates = text
		? [...items.filter((item) => `${item.name} ${item.shortName ?? ""}`.toLowerCase().includes(text)), ...extra]
		: group
			? [...baseline, ...items]
			: baseline;
	return [...new Map(candidates.filter(inGroup).map((item) => [item.id, item])).values()].slice(0, ITEM_SEARCH_LIMIT);
}
