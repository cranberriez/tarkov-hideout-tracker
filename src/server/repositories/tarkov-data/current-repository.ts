import "server-only";

import { getCachedJsonHideoutStations } from "@/server/services/hideoutJson";
import { getBarterIndex, getCraftIndex } from "@/server/services/itemAcquisitionJson";
import { getGlobalItemList } from "@/server/services/itemsJson";
import { getJsonPriceHistory } from "@/server/services/priceHistory";
import { getCachedJsonFullQuestData } from "@/server/services/questsJson";
import { getCachedJsonTraders } from "@/server/services/tradersJson";
import type { DataResult } from "@/types/common";
import type { ItemSummary } from "@/types/items";
import type { TarkovDataRepository } from "./types";
import { recordsByRequestedIds } from "./projection";

function resultWithData<TSource, TResult>(
    result: DataResult<TSource>,
    data: TResult,
): DataResult<TResult> {
    return {
        data,
        updatedAt: result.updatedAt,
        ...(result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    };
}

async function getCatalogByIds(
    mode: Parameters<TarkovDataRepository["items"]["getByIds"]>[0],
    ids: readonly string[],
) {
    const result = await getGlobalItemList(mode);
    return resultWithData(result, recordsByRequestedIds(result.data.items, ids));
}

async function getFullQuestsByIds(
    mode: Parameters<TarkovDataRepository["quests"]["getByIds"]>[0],
    ids: readonly string[],
) {
    // The current cache is a validated full-quest blob. Keeping this projection
    // private lets a future indexed repository replace it without changing callers.
    const result = await getCachedJsonFullQuestData(mode);
    return resultWithData(result, recordsByRequestedIds(result.data.quests, ids));
}

async function getTradersByIds(
    mode: Parameters<TarkovDataRepository["traders"]["getByIds"]>[0],
    ids: readonly string[],
) {
    const result = await getCachedJsonTraders(mode);
    return resultWithData(result, recordsByRequestedIds(result.data.traders, ids));
}

export const currentTarkovDataRepository: TarkovDataRepository = {
    items: {
        async getCatalog(mode) {
            const result = await getGlobalItemList(mode);
            return resultWithData(result, result.data.items);
        },
        getByIds: getCatalogByIds,
    },
    hideout: {
        async getStations(mode) {
            const result = await getCachedJsonHideoutStations(mode);
            return resultWithData(result, result.data.stations);
        },
    },
    quests: {
        async getAll(mode) {
            const result = await getCachedJsonFullQuestData(mode);
            return resultWithData(result, result.data.quests);
        },
        getByIds: getFullQuestsByIds,
    },
    traders: {
        async getAll(mode) {
            const result = await getCachedJsonTraders(mode);
            return resultWithData(result, result.data.traders);
        },
        getByIds: getTradersByIds,
    },
    recipes: {
        async getBarters(mode) {
            const result = await getBarterIndex(mode);
            return resultWithData(
                result,
                Object.values(result.data.bartersByItemId).flat(),
            );
        },
        async getCrafts(mode) {
            const result = await getCraftIndex(mode);
            return resultWithData(
                result,
                Object.values(result.data.craftsByItemId).flat(),
            );
        },
    },
    prices: {
        async getCurrent(mode, itemIds) {
            const result = await getGlobalItemList(mode);
            const itemsById = recordsByRequestedIds(result.data.items, itemIds);
            const prices = Object.fromEntries(
                Object.entries(itemsById).flatMap(([itemId, item]: [string, ItemSummary]) =>
                    item.marketPrice ? [[itemId, item.marketPrice]] : [],
                ),
            );
            return resultWithData(result, prices);
        },
        getHistory: getJsonPriceHistory,
    },
};
