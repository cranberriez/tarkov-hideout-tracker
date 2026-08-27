import { NextResponse } from "next/server";
import { getCachedAllMarketPrices } from "@/server/services/marketPrices";
import { parseGameMode } from "@/lib/game-mode";

// Statically cached (ISR) route handler. The response is served from the
// CDN / ISR cache instead of being embedded in every page's RSC payload.
// The "market-prices" tag from getCachedAllMarketPrices attaches to this
// route's cache entry, so the daily price cron's revalidateTag purges it.
// The time-based revalidate is only a safety net.
export const revalidate = 86400; // 24h
export const dynamicParams = false;

export function generateStaticParams() {
    return [{ mode: "pvp" }, { mode: "pve" }, { mode: "kord" }];
}

export async function GET(_req: Request, { params }: { params: Promise<{ mode: string }> }) {
    const { mode } = await params;
    const gameMode = parseGameMode(mode);

    const prices = await getCachedAllMarketPrices(gameMode);

    return NextResponse.json(prices);
}
