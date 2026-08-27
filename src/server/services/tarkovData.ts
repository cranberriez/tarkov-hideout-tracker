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

export type TarkovDataSource = "graphql" | "json";

export const tarkovDataSource: TarkovDataSource =
    process.env.TARKOV_DATA_SOURCE === "graphql" ? "graphql" : "json";

export const getHideoutStations =
    tarkovDataSource === "json" ? getJsonHideoutStations : getGraphqlHideoutStations;
export const getCachedHideoutStations =
    tarkovDataSource === "json"
        ? getCachedJsonHideoutStations
        : getCachedGraphqlHideoutStations;

export const getHideoutRequiredItems =
    tarkovDataSource === "json"
        ? getJsonHideoutRequiredItems
        : getGraphqlHideoutRequiredItems;
export const getCachedHideoutRequiredItems =
    tarkovDataSource === "json"
        ? getCachedJsonHideoutRequiredItems
        : getCachedGraphqlHideoutRequiredItems;

// Quest data always comes from Tarkov.dev's JSON API. GraphQL is deprecated and
// must not be re-enabled for quest consumers through TARKOV_DATA_SOURCE.
export const getCachedQuestData = getCachedJsonQuestData;
export const getCachedFullQuestData = getCachedJsonFullQuestData;

export const getCachedTraders =
    tarkovDataSource === "json" ? getCachedJsonTraders : getCachedGraphqlTraders;

export const refreshMarketPrices =
    tarkovDataSource === "json"
        ? refreshTarkovJsonMarketPrices
        : refreshTarkovDevMarketPrices;
