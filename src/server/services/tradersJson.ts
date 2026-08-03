import { unstable_cache } from "next/cache";
import { CACHE_VERSIONS } from "@/lib/cfg/cacheVersions";
import { redis } from "@/server/redis";
import { fetchTarkovJsonDataset } from "@/server/services/tarkovJson/client";
import { isFreshCache, parseNonEmptyTimedResponse } from "@/server/services/tarkovJson/cache";
import type { TimedResponse, Trader, TradersPayload } from "@/types";

const REDIS_KEY = `traders:all:v${CACHE_VERSIONS.traders}`;
const REDIS_KEY_META = `${REDIS_KEY}:meta`;

interface JsonTrader extends Trader {
    name: string;
}

export async function getJsonTraders(): Promise<TimedResponse<TradersPayload>> {
    const [cachedBody, cachedMeta] = await redis.mget<[unknown, unknown]>(
        REDIS_KEY,
        REDIS_KEY_META,
    );
    const cached = parseNonEmptyTimedResponse<TradersPayload>(
        cachedBody,
        (payload) => payload.traders,
    );
    if (cached && isFreshCache(cachedMeta)) return cached;

    try {
        const dataset = await fetchTarkovJsonDataset<Record<string, JsonTrader>>("traders");
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
            [REDIS_KEY]: JSON.stringify(body),
            [REDIS_KEY_META]: { updatedAt },
        });
        return body;
    } catch (error) {
        console.error("Failed to refresh traders from Tarkov JSON", error);
        if (cached) return cached;
        throw error;
    }
}

export const getCachedJsonTraders = unstable_cache(getJsonTraders, ["json-traders"], {
    revalidate: 14 * 24 * 60 * 60,
    tags: ["traders"],
});

