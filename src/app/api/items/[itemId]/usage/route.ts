import { NextRequest, NextResponse } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getItemUsageView } from "@/server/db/item-views";
import { itemDatabaseErrorResponse } from "@/server/db/route-errors";
import { isCompleteItemUsageData } from "@/lib/utils/item-usage";

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
        const mode = requestedMode as TarkovJsonGameMode;
        const response = await getItemUsageView(mode, itemId);
        return NextResponse.json(response, {
            headers: {
                "Cache-Control": !isCompleteItemUsageData(response)
                    ? "no-store"
                    : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
            },
        });
    } catch (error) {
        return itemDatabaseErrorResponse(
            error,
            "Item usage is temporarily unavailable",
        );
    }
}
