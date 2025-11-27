import { NextResponse } from "next/server";
import type { TimedResponse, MarketPrice } from "@/types";
import { getMarketPrices, type GameMode } from "@/server/services/marketPrices";

const FIFTEEN_MIN_CACHE_HEADERS = {
    "Cache-Control": "public, max-age=900",
    "CDN-Cache-Control": "public, s-maxage=900",
};

interface MarketItemsRequestBody {
    items?: string[];
    gameMode?: GameMode;
}

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as MarketItemsRequestBody;
        const items = Array.isArray(body.items) ? body.items : [];
        const requestedMode = body.gameMode;
        const gameMode: GameMode = requestedMode === "PVE" ? "PVE" : "PVP";

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

        const result = await getMarketPrices(items, gameMode);

        return NextResponse.json(result, {
            headers: FIFTEEN_MIN_CACHE_HEADERS,
        });
    } catch (error) {
        console.error("/api/market/items unexpected error", error);
        return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }
}
