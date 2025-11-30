import type { TimedResponse, MarketPrice } from "@/types";
import {
    getTarkovMarketItemByNormalizedName,
    type TarkovMarketItem,
} from "@/server/services/tarkovMarket";
import { unstable_cache } from "next/cache";

export type GameMode = "PVP" | "PVE";

// Keep concurrency modest to avoid hammering the Tarkov Market API.
// This is in addition to the lower-level rate limiting and backoff logic
// inside getTarkovMarketItemByNormalizedName.
const MARKET_PRICE_BATCH_SIZE = 5;

export async function getMarketPrices(
    normalizedNames: string[],
    gameMode: GameMode,
): Promise<TimedResponse<{ [normalizedName: string]: MarketPrice | null }>> {
    const uniqueNames = Array.from(
        new Set(
            normalizedNames
                .map((name) => (typeof name === "string" ? name.trim() : ""))
                .filter((name) => name.length > 0),
        ),
    );

    if (uniqueNames.length === 0) {
        return {
            data: {},
            updatedAt: Date.now(),
        };
    }

    const results: { normalizedName: string; response: TimedResponse<TarkovMarketItem | null> | null }[] = [];

    for (let i = 0; i < uniqueNames.length; i += MARKET_PRICE_BATCH_SIZE) {
        const batch = uniqueNames.slice(i, i + MARKET_PRICE_BATCH_SIZE);
        // Process each batch with limited parallelism, then move to the next.
        // Combined with the underlying rate-limit handling, this should greatly
        // reduce the likelihood of hitting 429s while still being reasonably fast.
        const batchResults = await Promise.all(
            batch.map(async (normalizedName) => {
                try {
                    const response = await getTarkovMarketItemByNormalizedName(normalizedName, gameMode);
                    return { normalizedName, response };
                } catch (error) {
                    console.error("Failed to fetch Tarkov Market item in service", {
                        normalizedName,
                        error,
                    });
                    return {
                        normalizedName,
                        response: null as TimedResponse<TarkovMarketItem | null> | null,
                    };
                }
            }),
        );

        results.push(...batchResults);
    }

    const aggregated: { [normalizedName: string]: MarketPrice | null } = {};
    let latestUpdatedAt = 0;

    for (const { normalizedName, response } of results) {
        if (response && response.data) {
            const src = response.data as TarkovMarketItem;
            aggregated[normalizedName] = {
                price: src.price,
                avg24hPrice: src.avg24hPrice,
                avg7daysPrice: src.avg7daysPrice,
                updated: src.updated,
                link: src.link,
                diff24h: src.diff24h,
                traderName: src.traderName,
                traderPrice: src.traderPrice,
                traderPriceCur: src.traderPriceCur,
            };
            if (response.updatedAt > latestUpdatedAt) {
                latestUpdatedAt = response.updatedAt;
            }
        } else {
            aggregated[normalizedName] = null;
        }
    }

    return {
        data: aggregated,
        updatedAt: latestUpdatedAt || Date.now(),
    };
}

export const getCachedMarketPrices = unstable_cache(
    async (normalizedNames: string[], gameMode: GameMode) => {
        return getMarketPrices(normalizedNames, gameMode);
    },
    ["market-prices"],
    { revalidate: 5 * 60 },
);
