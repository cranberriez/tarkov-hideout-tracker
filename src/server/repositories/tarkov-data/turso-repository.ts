import "server-only";

import type { DataResult } from "@/types/common";
import type { ItemSummary } from "@/types/items";
import type { CurrentPrice } from "@/types/prices";
import type { FullQuest } from "@/types/quests";
import type { Trader } from "@/types/traders";
import type { Station } from "@/types/hideout";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { TarkovDataRepository } from "./types";
import { getEntitiesByIds, getEntityList } from "@/server/db/entity-data";
import { getJsonPriceHistory } from "@/server/services/priceHistory";

async function getCurrentPrices(
    mode: Parameters<TarkovDataRepository["prices"]["getCurrent"]>[0],
    itemIds: readonly string[],
): Promise<DataResult<Record<string, CurrentPrice>>> {
    const result = await getEntitiesByIds<CurrentPrice | null>(
        mode,
        "price",
        "items",
        itemIds,
    );
    return {
        data: Object.fromEntries(
            Object.entries(result.data).flatMap(([itemId, price]) =>
                price ? [[itemId, price]] : [],
            ),
        ),
        updatedAt: result.updatedAt,
    };
}

export const tursoTarkovDataRepository: TarkovDataRepository = {
    items: {
        getByIds: (mode, ids) =>
            getEntitiesByIds<ItemSummary>(mode, "item", "items", ids),
    },
    hideout: {
        getStations: (mode) =>
            getEntityList<Station>(mode, "station", "stations"),
    },
    quests: {
        getAll: (mode) => getEntityList<FullQuest>(mode, "quest", "quests"),
        getByIds: (mode, ids) =>
            getEntitiesByIds<FullQuest>(mode, "quest", "quests", ids),
    },
    traders: {
        getAll: (mode) => getEntityList<Trader>(mode, "trader", "traders"),
        getByIds: (mode, ids) =>
            getEntitiesByIds<Trader>(mode, "trader", "traders", ids),
    },
    recipes: {
        getBarters: (mode) =>
            getEntityList<BarterRecord>(mode, "barter", "barters"),
        getCrafts: (mode) =>
            getEntityList<CraftRecord>(mode, "craft", "crafts"),
    },
    prices: {
        getCurrent: getCurrentPrices,
        getHistory: getJsonPriceHistory,
    },
};
