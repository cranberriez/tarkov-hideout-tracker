import type { ItemSummary } from "@/types/items";

export { getQuestWorkspaceItemIds } from "../../lib/quests/quest-item-ids";

/** Full item details are loaded by the existing item dialog, never by the workspace. */
export function toQuestWorkspaceItem(item: ItemSummary): ItemSummary {
	return {
		id: item.id,
		name: item.name,
		normalizedName: item.normalizedName,
		// Preserve every exceptional image URL; standard URLs are already reconstructed by image helpers.
		iconLink: item.iconLink,
		gridImageLink: item.gridImageLink,
		image512pxLink: item.image512pxLink,
		baseImageLink: item.baseImageLink,
		category: item.category,
		onFleaMarket: item.onFleaMarket,
		...(item.marketPrice ? { marketPrice: item.marketPrice } : {}),
	};
}
