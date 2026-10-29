import "server-only";

import type { TarkovDataMode } from "@/types/common";
import type { ItemUsageData } from "@/types/contracts";
import type { PostgresDatabase } from "@/server/postgres/connection";
import { getCatalogItemsByIds, getRecipes } from "./domain-data";
import { DatabaseRecordNotFoundError } from "./errors";

/** Only recipes producing or referencing the selected item cross the database boundary. */
export async function readItemRecipeUsage(
	mode: TarkovDataMode,
	itemId: string,
	db: PostgresDatabase,
	version: string,
): Promise<ItemUsageData> {
	const recipes = await getRecipes(mode, db, version, itemId);
	const crafts = recipes.crafts.data;
	const barters = recipes.barters.data;
	const itemIds = [
		...new Set([
			itemId,
			...crafts.flatMap((r) => [
				r.productItemId,
				...r.requiredItems.map((i) => i.itemId),
				...r.requiredQuestItems.map((i) => i.itemId),
			]),
			...barters.flatMap((r) => [r.offeredItemId, ...r.requiredItems.map((i) => i.itemId)]),
		]),
	];
	const items = await getCatalogItemsByIds(mode, itemIds, db, version);
	if (!items.data[itemId]) throw new DatabaseRecordNotFoundError(`No item exists for ${mode}/${itemId}`);
	return {
		crafts: crafts.filter((r) => r.productItemId === itemId),
		barters: barters.filter((r) => r.offeredItemId === itemId),
		usedInCrafts: crafts.filter((r) => [...r.requiredItems, ...r.requiredQuestItems].some((i) => i.itemId === itemId)),
		usedInBarters: barters.filter((r) => r.requiredItems.some((i) => i.itemId === itemId)),
		items: itemIds.flatMap((id) => (items.data[id] ? [items.data[id]] : [])),
		itemIds,
		unresolvedItemIds: itemIds.filter((id) => !items.data[id]),
		tradersById: {},
		stationsById: {},
		taskUnlocksById: {},
		freshness: {
			craftsUpdatedAt: recipes.crafts.updatedAt,
			bartersUpdatedAt: recipes.barters.updatedAt,
			itemsUpdatedAt: items.updatedAt,
			pricesUpdatedAt: null,
			tradersUpdatedAt: null,
			stationsUpdatedAt: null,
			taskUnlocksUpdatedAt: null,
		},
	};
}
