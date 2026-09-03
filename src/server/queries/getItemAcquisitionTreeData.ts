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
    const [bartersResult, craftsResult] = await Promise.allSettled([
        dataRepository.recipes.getBarters(mode),
        dataRepository.recipes.getCrafts(mode),
    ]);
    const barters = bartersResult.status === "fulfilled" ? bartersResult.value.data : [];
    const crafts = craftsResult.status === "fulfilled" ? craftsResult.value.data : [];
    const bartersByItemId = indexRecipesByItem<BarterRecord>(
        barters,
        (barter) => barter.offeredItemId,
    );
    const craftsByItemId = indexRecipesByItem<CraftRecord>(
        crafts,
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
    const [itemsResult, pricesResult] = await Promise.allSettled([
        dataRepository.items.getByIds(mode, itemIds),
        dataRepository.prices.getCurrent(mode, itemIds),
    ]);
    const itemRecords = itemsResult.status === "fulfilled" ? itemsResult.value.data : null;
    const priceRecords = pricesResult.status === "fulfilled" ? pricesResult.value.data : {};
    const merged = itemRecords
        ? mergePricedItems(itemIds, itemRecords, priceRecords)
        : { items: [], unresolvedItemIds: [...itemIds] };

    return {
        ...tree,
        itemIds,
        items: merged.items,
        unresolvedItemIds: merged.unresolvedItemIds,
        freshness: {
            bartersUpdatedAt:
                bartersResult.status === "fulfilled" ? bartersResult.value.updatedAt : null,
            craftsUpdatedAt:
                craftsResult.status === "fulfilled" ? craftsResult.value.updatedAt : null,
            itemsUpdatedAt:
                itemsResult.status === "fulfilled" ? itemsResult.value.updatedAt : null,
            pricesUpdatedAt:
                pricesResult.status === "fulfilled" ? pricesResult.value.updatedAt : null,
        },
        errors: {
            barters:
                bartersResult.status === "rejected"
                    ? "Barter data is temporarily unavailable"
                    : null,
            crafts:
                craftsResult.status === "rejected"
                    ? "Craft data is temporarily unavailable"
                    : null,
            items:
                itemsResult.status === "rejected"
                    ? "Recipe item data is temporarily unavailable"
                    : null,
            prices:
                pricesResult.status === "rejected"
                    ? "Recipe price data is temporarily unavailable"
                    : null,
        },
    };
}
