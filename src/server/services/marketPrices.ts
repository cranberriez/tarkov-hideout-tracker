import type { TimedResponse, MarketPrice } from "@/types";
import { redis } from "@/server/redis";
import { unstable_cache } from "next/cache";

export type GameMode = "PVP" | "PVE";

const FILTERED_PRICES_KEY_PREFIX = "tarkov-market:all-prices:filtered:v1";

interface RedisMeta {
    updatedAt: number;
}

function buildFilteredKeys(mode: GameMode) {
    const modeKey = mode.toLowerCase();
    const baseKey = `${FILTERED_PRICES_KEY_PREFIX}:${modeKey}`;
    return {
        bodyKey: baseKey,
        metaKey: `${baseKey}:meta`,
    };
}

async function loadFilteredPrices(
    mode: GameMode
): Promise<TimedResponse<{ [normalizedName: string]: MarketPrice | null }>> {
    const { bodyKey, metaKey } = buildFilteredKeys(mode);
    const [cachedBody, cachedMeta] = await redis.mget<[string, RedisMeta]>(bodyKey, metaKey);

    if (!cachedBody || !cachedMeta || typeof cachedMeta !== "object") {
        return {
            data: {},
            updatedAt: 0,
        };
    }

    const data =
        typeof cachedBody === "object"
            ? (cachedBody as unknown as { [normalizedName: string]: MarketPrice | null })
            : (JSON.parse(cachedBody) as { [normalizedName: string]: MarketPrice | null });

    return {
        data,
        updatedAt: cachedMeta.updatedAt ?? 0,
    };
}

export async function getMarketPrices(
    normalizedNames: string[],
    gameMode: GameMode
): Promise<TimedResponse<{ [normalizedName: string]: MarketPrice | null }>> {
    const uniqueNames = Array.from(
        new Set(
            normalizedNames
                .map((name) => (typeof name === "string" ? name.trim() : ""))
                .filter((name) => name.length > 0)
        )
    );

    if (uniqueNames.length === 0) {
        return {
            data: {},
            updatedAt: Date.now(),
        };
    }

    const { data: allPrices, updatedAt } = await loadFilteredPrices(gameMode);

    const aggregated: { [normalizedName: string]: MarketPrice | null } = {};

    for (const name of uniqueNames) {
        aggregated[name] = Object.prototype.hasOwnProperty.call(allPrices, name)
            ? allPrices[name]
            : null;
    }

    return {
        data: aggregated,
        updatedAt: updatedAt || Date.now(),
    };
}

export const getCachedMarketPrices = unstable_cache(
    async (normalizedNames: string[], gameMode: GameMode) => {
        return getMarketPrices(normalizedNames, gameMode);
    },
    ["market-prices"],
    { revalidate: 5 * 60 }
);
