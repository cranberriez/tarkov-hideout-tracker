import { NextRequest, NextResponse } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import {
    fetchCachedJsonPriceHistory,
    PRICE_HISTORY_REVALIDATE_SECONDS,
} from "@/server/prices/live-price-history";

export const revalidate = 7200;

const MODES = new Set<TarkovJsonGameMode>(["regular", "pve", "pvp-season"]);

export async function GET(
    request: NextRequest,
    context: { params: Promise<{ itemId: string }> },
) {
    const { itemId } = await context.params;
    const requestedMode = request.nextUrl.searchParams.get("mode") ?? "regular";
    if (!MODES.has(requestedMode as TarkovJsonGameMode)) {
        return NextResponse.json({ error: "Unsupported game mode" }, { status: 400 });
    }
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(itemId)) {
        return NextResponse.json({ error: "Invalid item ID" }, { status: 400 });
    }

    try {
        const data = await fetchCachedJsonPriceHistory(
            requestedMode as TarkovJsonGameMode,
            itemId,
        );
        return NextResponse.json({ data, fetchedAt: Date.now() }, {
            headers: {
                "Cache-Control": `public, max-age=300, s-maxage=${PRICE_HISTORY_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
            },
        });
    } catch (error) {
        return NextResponse.json(
            { error: "Price history is temporarily unavailable" },
            {
                status:
                    error instanceof Error && /status\s+404\b/.test(error.message)
                        ? 404
                        : 502,
            },
        );
    }
}
