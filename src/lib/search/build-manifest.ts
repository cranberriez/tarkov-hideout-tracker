import type { TarkovJsonGameMode } from "../game-mode";
import type { ItemSummary } from "../../types/items";
import type { FullQuest } from "../../types/quests";
import type { Trader } from "../../types/traders";
import { prepareQuestDataForMode } from "../quests/quest-preparation";
import { excludeRemovedQuests } from "../quests/removed-quests";
import { validateSearchManifest } from "./manifest";
import { standardItemImageUrl } from "../utils/item-images";
import { isBarterCategory } from "../data/barter-categories";

/**
 * Quest-chain notes, tapes, documents and similar: flea-banned items the provider gives no other type. A
 * heuristic (it also matches secure and loot containers); tarkov.dev's true quest items are not catalog items.
 */
export function isQuestOnlyItem(item: Pick<ItemSummary, "itemTypes">): boolean {
	return item.itemTypes?.length === 1 && item.itemTypes[0] === "noFlea";
}

export function buildSearchManifest(
	mode: TarkovJsonGameMode,
	items: ItemSummary[],
	quests: FullQuest[],
	traders: Trader[],
) {
	const categories = [...new Set(items.flatMap((item) => (item.category?.id ? [item.category.id] : [])))].sort();
	const categoryIndex = new Map(categories.map((id, index) => [id, index]));
	return validateSearchManifest(
		{
			v: 1,
			mode,
			items: items.map((item) => ({
				id: item.id,
				nn: item.normalizedName,
				n: item.name,
				...(item.shortName ? { sn: item.shortName } : {}),
				// Standard icon URLs are derived from the ID on the client.
				...(item.iconLink && item.iconLink !== standardItemImageUrl(item.id, "icon") ? { ic: item.iconLink } : {}),
				...(isBarterCategory(item.category?.id) ? { b: 1 as const } : {}),
				...(item.category?.id ? { c: categoryIndex.get(item.category.id) } : {}),
				...(isQuestOnlyItem(item) ? { q: 1 as const } : {}),
			})),
			categories,
			quests: excludeRemovedQuests(prepareQuestDataForMode(quests, mode)).map((quest) => ({
				id: quest.id,
				nn: quest.normalizedName,
				n: quest.name,
				ti: quest.trader.id,
			})),
			traders: Object.fromEntries(
				traders.map((trader) => [trader.id, { n: trader.name, ...(trader.imageLink ? { ic: trader.imageLink } : {}) }]),
			),
		},
		mode,
	);
}
