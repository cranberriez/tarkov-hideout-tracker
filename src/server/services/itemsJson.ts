import { unstable_cache } from "next/cache";
import { cacheWhenEnabled } from "@/server/cache";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { redis } from "@/server/redis";
import { getJsonHideoutStations } from "@/server/services/hideoutJson";
import type { TarkovJsonGameMode } from "@/server/services/tarkovJson/client";
import {
    isProgressionCacheUsable,
    parseNonEmptyTimedResponse,
} from "@/server/services/tarkovJson/cache";
import type { ItemDetails, ItemsPayload, TimedResponse } from "@/types";

function buildRedisKeys(gameMode: TarkovJsonGameMode) {
    const bodyKey = `hideout:items:filtered:v${CACHE_VERSIONS.hideoutItems}:${gameMode}`;
    return { bodyKey, metaKey: `${bodyKey}:meta` };
}

export interface GetJsonHideoutRequiredItemsOptions {
    revalidateSeconds?: number;
}

export async function getJsonHideoutRequiredItems(
    options?: GetJsonHideoutRequiredItemsOptions,
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TimedResponse<ItemsPayload>> {
    void options;
    const { bodyKey, metaKey } = buildRedisKeys(gameMode);
    const [cachedBody, cachedMeta] = await redis.mget<[unknown, unknown]>(
        bodyKey,
        metaKey,
    );
    const cached = parseNonEmptyTimedResponse<ItemsPayload>(cachedBody, (payload) => payload.items);

    if (cached && isProgressionCacheUsable(cachedMeta)) {
        console.log("Using cached filtered items");
        return cached;
    }

    try {
        const stationsResponse = await getJsonHideoutStations(gameMode);
        const itemsById = new Map<string, ItemDetails>();

        for (const station of stationsResponse.data.stations) {
            for (const level of station.levels) {
                for (const requirement of level.itemRequirements) {
                    itemsById.set(requirement.item.id, {
                        id: requirement.item.id,
                        name: requirement.item.name,
                        normalizedName: requirement.item.normalizedName,
                        iconLink: requirement.item.iconLink,
                        gridImageLink: requirement.item.gridImageLink,
                    });
                }
            }
        }

        const items = [...itemsById.values()];
        if (items.length === 0) {
            throw new Error("Tarkov JSON hideout mapping produced no required items");
        }

        const updatedAt = Date.now();
        const body: TimedResponse<ItemsPayload> = { data: { items }, updatedAt };
        await redis.mset({
            [bodyKey]: JSON.stringify(body),
            [metaKey]: { updatedAt },
        });
        return body;
    } catch (error) {
        console.error("Failed to refresh required items from Tarkov JSON", error);
        if (cached) {
            console.log("Using stale cached items due to JSON upstream error");
            return cached;
        }
        throw error;
    }
}

const cachedJsonHideoutRequiredItems = unstable_cache(
    getJsonHideoutRequiredItems,
    ["json-hideout-required-items"],
    { revalidate: false, tags: ["hideout-data"] },
);

export const getCachedJsonHideoutRequiredItems = cacheWhenEnabled(
    getJsonHideoutRequiredItems,
    cachedJsonHideoutRequiredItems,
);
