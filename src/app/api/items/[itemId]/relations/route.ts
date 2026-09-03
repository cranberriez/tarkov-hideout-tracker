import { NextRequest, NextResponse } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getItemRelationsView } from "@/server/db/item-views";
import { itemDatabaseErrorResponse } from "@/server/db/route-errors";

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
        const payload = await getItemRelationsView(
            requestedMode as TarkovJsonGameMode,
            itemId,
        );
        const isPartial = Object.values(payload.errors).some((error) => error !== null);
        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": isPartial
                    ? "no-store"
                    : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        return itemDatabaseErrorResponse(
            error,
            "Item relations are temporarily unavailable",
        );
    }
}
