import { NextRequest, NextResponse } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getItemUsageData } from "@/server/queries/getItemUsageData";
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

    const mode = requestedMode as TarkovJsonGameMode;
    const response = await getItemUsageData(itemId, mode);
    return NextResponse.json(response, {
        headers: {
            "Cache-Control": !isCompleteItemUsageData(response)
                ? "no-store"
                : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        },
    });
}
