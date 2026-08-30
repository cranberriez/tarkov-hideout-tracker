import { NextRequest, NextResponse } from "next/server";
import { TARKOV_API_HEADERS } from "@/server/services/tarkovApi";
import { normalizePriceHistory } from "@/server/services/priceHistory";
import type { TarkovJsonGameMode } from "@/lib/game-mode";

export const revalidate = 900;

const MODES = new Set<TarkovJsonGameMode>(["regular", "pve", "pvp-season"]);

interface UpstreamPriceResponse {
    data?: unknown;
}

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

    const mode = requestedMode as TarkovJsonGameMode;
    let upstream: Response;
    try {
        upstream = await fetch(
            `https://json.tarkov.dev/${mode}/prices/${encodeURIComponent(itemId)}`,
            {
                headers: TARKOV_API_HEADERS,
                next: { revalidate },
            },
        );
    } catch {
        return NextResponse.json(
            { error: "Price history is temporarily unavailable" },
            { status: 502 },
        );
    }
    if (!upstream.ok) {
        return NextResponse.json(
            { error: "Price history is temporarily unavailable" },
            { status: upstream.status === 404 ? 404 : 502 },
        );
    }

    const body = (await upstream.json()) as UpstreamPriceResponse;
    const points = normalizePriceHistory(body.data);

    return NextResponse.json(
        { data: points, fetchedAt: Date.now() },
        {
            headers: {
                "Cache-Control": "public, max-age=300, s-maxage=900, stale-while-revalidate=3600",
            },
        },
    );
}
