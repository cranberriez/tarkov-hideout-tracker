import {
    getCachedHideoutStations as getCachedGraphqlHideoutStations,
    getHideoutStations as getGraphqlHideoutStations,
} from "@/server/services/hideout";
import {
    getCachedJsonHideoutStations,
    getJsonHideoutStations,
} from "@/server/services/hideoutJson";
import {
    getCachedHideoutRequiredItems as getCachedGraphqlHideoutRequiredItems,
    getHideoutRequiredItems as getGraphqlHideoutRequiredItems,
} from "@/server/services/items";
import {
    getCachedJsonHideoutRequiredItems,
    getJsonHideoutRequiredItems,
} from "@/server/services/itemsJson";
import {
    getCachedJsonFullQuestData,
    getCachedJsonQuestData,
} from "@/server/services/questsJson";
import { getCachedTraders as getCachedGraphqlTraders } from "@/server/services/traders";
import { getCachedJsonTraders } from "@/server/services/tradersJson";
import { refreshTarkovDevMarketPrices } from "@/server/services/tarkovDevMarket";
import { refreshTarkovJsonMarketPrices } from "@/server/services/tarkovDevMarketJson";
import type { TarkovJsonGameMode } from "@/server/services/tarkovJson/client";

export type TarkovDataSource = "graphql" | "json";

export const tarkovDataSource: TarkovDataSource =
    process.env.TARKOV_DATA_SOURCE === "graphql" ? "graphql" : "json";

export async function getHideoutStations(gameMode: TarkovJsonGameMode = "regular") {
    return tarkovDataSource === "json" || gameMode !== "regular"
        ? getJsonHideoutStations(gameMode)
        : getGraphqlHideoutStations();
}

export async function getCachedHideoutStations(gameMode: TarkovJsonGameMode = "regular") {
    return tarkovDataSource === "json" || gameMode !== "regular"
        ? getCachedJsonHideoutStations(gameMode)
        : getCachedGraphqlHideoutStations();
}

export async function getHideoutRequiredItems(gameMode: TarkovJsonGameMode = "regular") {
    return tarkovDataSource === "json" || gameMode !== "regular"
        ? getJsonHideoutRequiredItems(undefined, gameMode)
        : getGraphqlHideoutRequiredItems();
}

export async function getCachedHideoutRequiredItems(gameMode: TarkovJsonGameMode = "regular") {
    return tarkovDataSource === "json" || gameMode !== "regular"
        ? getCachedJsonHideoutRequiredItems(undefined, gameMode)
        : getCachedGraphqlHideoutRequiredItems();
}

// Quest data always comes from Tarkov.dev's JSON API. GraphQL is deprecated and
// must not be re-enabled for quest consumers through TARKOV_DATA_SOURCE.
export const getCachedQuestData = getCachedJsonQuestData;
export const getCachedFullQuestData = getCachedJsonFullQuestData;

export async function getCachedTraders(gameMode: TarkovJsonGameMode = "regular") {
    return tarkovDataSource === "json" || gameMode !== "regular"
        ? getCachedJsonTraders(gameMode)
        : getCachedGraphqlTraders();
}

export function refreshMarketPrices(mode: Parameters<typeof refreshTarkovJsonMarketPrices>[0]) {
    return tarkovDataSource === "json" || mode === "KORD"
        ? refreshTarkovJsonMarketPrices(mode)
        : refreshTarkovDevMarketPrices(mode);
}
