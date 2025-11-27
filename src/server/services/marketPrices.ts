import type { TimedResponse, MarketPrice } from "@/types";
import {
    getTarkovMarketItemByNormalizedName,
    type TarkovMarketItem,
} from "@/server/services/tarkovMarket";

export type GameMode = "PVP" | "PVE";

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

    const results = await Promise.all(
        uniqueNames.map(async (normalizedName) => {
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
