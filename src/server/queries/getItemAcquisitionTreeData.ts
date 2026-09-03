import { buildItemAcquisitionTree } from "../../lib/price-calculation/acquisition-tree";
import type { TarkovDataRepository } from "@/server/repositories/tarkov-data/types";
import type { TarkovDataMode } from "@/types/common";
import type { ItemAcquisitionTreeData } from "@/types/contracts";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import { dedupeIds, getDefaultRepository, getRecipeGraphItemIds, mergePricedItems } from "./query-utils";

function indexRecipesByItem<T>(
    records: readonly T[],
    getItemId: (record: T) => string,
): Record<string, T[]> {
    const result: Record<string, T[]> = {};
    for (const record of records) {
        (result[getItemId(record)] ??= []).push(record);
    }
    return result;
}

export async function getItemAcquisitionTreeData(
    itemId: string,
    mode: TarkovDataMode,
    repository?: TarkovDataRepository,
): Promise<ItemAcquisitionTreeData> {
    const dataRepository = repository ?? (await getDefaultRepository());
    const [bartersResult, craftsResult] = await Promise.all([
        dataRepository.recipes.getBarters(mode),
        dataRepository.recipes.getCrafts(mode),
    ]);
    const bartersByItemId = indexRecipesByItem<BarterRecord>(
        bartersResult.data,
        (barter) => barter.offeredItemId,
    );
    const craftsByItemId = indexRecipesByItem<CraftRecord>(
        craftsResult.data,
        (craft) => craft.productItemId,
    );
    const tree = buildItemAcquisitionTree(
        itemId,
        bartersByItemId,
        craftsByItemId,
    );
    const itemIds = dedupeIds([
        ...tree.itemIds,
        ...getRecipeGraphItemIds(tree.barters, tree.crafts),
    ]);
    const [itemsResult, pricesResult] = await Promise.all([
        dataRepository.items.getByIds(mode, itemIds),
        dataRepository.prices.getCurrent(mode, itemIds),
    ]);
    const merged = mergePricedItems(itemIds, itemsResult.data, pricesResult.data);

    return {
        ...tree,
        itemIds,
        items: merged.items,
        unresolvedItemIds: merged.unresolvedItemIds,
        freshness: {
            bartersUpdatedAt: bartersResult.updatedAt,
            craftsUpdatedAt: craftsResult.updatedAt,
            itemsUpdatedAt: itemsResult.updatedAt,
            pricesUpdatedAt: pricesResult.updatedAt,
        },
    };
}
