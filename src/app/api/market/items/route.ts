import { NextResponse } from "next/server";
import type { TimedResponse, MarketPrice } from "@/types";
import {
    getTarkovMarketItemByNormalizedName,
    type TarkovMarketItem,
} from "@/server/services/tarkovMarket";

const FIFTEEN_MIN_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=900",
    "CDN-Cache-Control": "public, s-maxage=900",
};

interface MarketItemsRequestBody {
    items?: string[];
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as MarketItemsRequestBody;
        const items = Array.isArray(body.items) ? body.items : [];

        if (items.length === 0) {
            return NextResponse.json<
                TimedResponse<{ [normalizedName: string]: MarketPrice | null }>
            >(
                { data: {}, updatedAt: Date.now() },
                {
                    headers: FIFTEEN_MIN_CACHE_HEADERS,
                }
            );
        }

        const uniqueNames = Array.from(
            new Set(
                items.map((name) => (typeof name === "string" ? name.trim() : "")).filter(Boolean)
            )
        );

        if (uniqueNames.length === 0) {
            return NextResponse.json<
                TimedResponse<{ [normalizedName: string]: MarketPrice | null }>
            >(
                { data: {}, updatedAt: Date.now() },
                {
                    headers: FIFTEEN_MIN_CACHE_HEADERS,
                }
            );
        }

        const results = await Promise.all(
            uniqueNames.map(async (normalizedName) => {
                try {
                    const response = await getTarkovMarketItemByNormalizedName(normalizedName);
                    return { normalizedName, response };
                } catch (error) {
                    console.error("Failed to fetch Tarkov Market item in route", {
                        normalizedName,
                        error,
                    });
                    return {
                        normalizedName,
                        response: null as TimedResponse<TarkovMarketItem | null> | null,
                    };
                }
            })
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

        const finalBody: TimedResponse<{ [normalizedName: string]: MarketPrice | null }> = {
            data: aggregated,
            updatedAt: latestUpdatedAt || Date.now(),
        };

        return NextResponse.json(finalBody, {
            headers: FIFTEEN_MIN_CACHE_HEADERS,
        });
    } catch (error) {
        console.error("/api/market/items unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
