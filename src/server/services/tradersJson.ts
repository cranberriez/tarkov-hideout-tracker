import { unstable_cache } from "next/cache";
import { cacheWhenEnabled, DATA_CACHE_REVALIDATE_SECONDS } from "@/server/cache";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { redis, writeRedisAfterResponse } from "@/server/redis";
import {
    fetchTarkovJsonDataset,
    type TarkovJsonGameMode,
} from "@/server/services/tarkovJson/client";
import {
    isProgressionCacheUsable,
    markStaleFallback,
    parseNonEmptyTimedResponse,
} from "@/server/services/tarkovJson/cache";
import type { DataResult } from "@/types/common";
import type { Trader } from "@/types/traders";
import type { TradersPayload } from "@/types/contracts";

function buildRedisKeys(gameMode: TarkovJsonGameMode) {
    const bodyKey = `traders:all:v${CACHE_VERSIONS.traders}:${gameMode}`;
    return { bodyKey, metaKey: `${bodyKey}:meta` };
}

interface JsonTrader {
    id: string;
    name: string;
    normalizedName: string;
    imageLink?: string | null;
    image4xLink?: string | null;
}

export async function getJsonTraders(
    gameMode: TarkovJsonGameMode = "regular",
): Promise<DataResult<TradersPayload>> {
    const { bodyKey, metaKey } = buildRedisKeys(gameMode);
    const [cachedBody, cachedMeta] = await redis.mget<[unknown, unknown]>(
        "traders",
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
        const body: DataResult<TradersPayload> = {
            data: { traders },
            updatedAt,
            diagnostics: { provider: "json", upstreamStatus: "ok" },
        };
        await writeRedisAfterResponse(
            "traders",
            {
                [bodyKey]: JSON.stringify(body),
                [metaKey]: { updatedAt },
            },
            "traders",
        );
        return body;
    } catch (error) {
        console.error("Failed to refresh traders from Tarkov JSON", error);
        if (cached) return markStaleFallback(cached);
        throw error;
    }
}

const cachedJsonTraders = unstable_cache(getJsonTraders, ["json-traders"], {
    revalidate: DATA_CACHE_REVALIDATE_SECONDS,
    tags: ["traders"],
});

export const getCachedJsonTraders = cacheWhenEnabled(
    "traders",
    getJsonTraders,
    cachedJsonTraders,
);
