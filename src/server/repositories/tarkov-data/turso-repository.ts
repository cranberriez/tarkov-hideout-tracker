import "server-only";

import type { ItemSummary } from "@/types/items";
import type { FullQuest } from "@/types/quests";
import type { Trader } from "@/types/traders";
import type { Station } from "@/types/hideout";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { TarkovDataRepository } from "./types";
import { getEntitiesByIds, getEntityList } from "@/server/db/entity-data";
import { getCurrentPriceData, getStoredPriceHistoryData } from "@/server/db/price-data";

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
        getCurrent: getCurrentPriceData,
        getHistory: getStoredPriceHistoryData,
    },
};
