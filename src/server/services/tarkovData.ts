import {
    getCachedJsonHideoutStations,
    getJsonHideoutStations,
} from "@/server/services/hideoutJson";
import {
    getCachedJsonFullQuestData,
    getCachedJsonQuestData,
} from "@/server/services/questsJson";
import { getCachedJsonTraders } from "@/server/services/tradersJson";
import type { TarkovJsonGameMode } from "@/server/services/tarkovJson/client";

export type TarkovDataSource = "graphql" | "json";

// Retained for status-display compatibility. JSON is the only runtime provider.
export const tarkovDataSource: TarkovDataSource = "json";

export async function getHideoutStations(gameMode: TarkovJsonGameMode = "regular") {
    return getJsonHideoutStations(gameMode);
}

export async function getCachedHideoutStations(gameMode: TarkovJsonGameMode = "regular") {
    return getCachedJsonHideoutStations(gameMode);
}

// Quest data always comes from Tarkov.dev's JSON API.
export const getCachedQuestData = getCachedJsonQuestData;
export const getCachedFullQuestData = getCachedJsonFullQuestData;

export async function getCachedTraders(gameMode: TarkovJsonGameMode = "regular") {
    return getCachedJsonTraders(gameMode);
}
