import { unstable_cache } from "next/cache";
import { cacheWhenEnabled } from "@/server/cache";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { redis } from "@/server/redis";
import {
    fetchTarkovJsonDataset,
    type TarkovJsonGameMode,
} from "@/server/services/tarkovJson/client";
import {
    isProgressionCacheUsable,
    parseNonEmptyTimedResponse,
} from "@/server/services/tarkovJson/cache";
import type { TimedResponse, Trader, TradersPayload } from "@/types";

function buildRedisKeys(gameMode: TarkovJsonGameMode) {
    const bodyKey = `traders:all:v${CACHE_VERSIONS.traders}:${gameMode}`;
    return { bodyKey, metaKey: `${bodyKey}:meta` };
}

interface JsonTrader extends Trader {
    name: string;
}

export async function getJsonTraders(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<TimedResponse<TradersPayload>> {
    const { bodyKey, metaKey } = buildRedisKeys(gameMode);
    const [cachedBody, cachedMeta] = await redis.mget<[unknown, unknown]>(
        bodyKey,
        metaKey,
    );
    const cached = parseNonEmptyTimedResponse<TradersPayload>(
        cachedBody,
        (payload) => payload.traders,
    );
    if (cached && isProgressionCacheUsable(cachedMeta)) return cached;

    try {
        const dataset = await fetchTarkovJsonDataset<Record<string, JsonTrader>>(
            "traders",
            gameMode,
        );
        const traders: Trader[] = Object.values(dataset.data).map((trader) => ({
            id: trader.id,
            name: dataset.translate(trader.name),
            normalizedName: trader.normalizedName,
            imageLink: trader.imageLink,
            image4xLink: trader.image4xLink,
        }));
        if (traders.length === 0) throw new Error("Tarkov JSON response contained no traders");

        const updatedAt = Date.now();
        const body: TimedResponse<TradersPayload> = { data: { traders }, updatedAt };
        await redis.mset({
            [bodyKey]: JSON.stringify(body),
            [metaKey]: { updatedAt },
        });
        return body;
    } catch (error) {
        console.error("Failed to refresh traders from Tarkov JSON", error);
        if (cached) return cached;
        throw error;
    }
}

const cachedJsonTraders = unstable_cache(getJsonTraders, ["json-traders"], {
    revalidate: false,
    tags: ["traders"],
});

export const getCachedJsonTraders = cacheWhenEnabled(getJsonTraders, cachedJsonTraders);
