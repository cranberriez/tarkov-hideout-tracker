import { NextRequest, NextResponse } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { getItemAcquisitionTreeData } from "@/server/queries/getItemAcquisitionTreeData";

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
        const payload = await getItemAcquisitionTreeData(
            itemId,
            requestedMode as TarkovJsonGameMode,
        );
        return NextResponse.json(payload, {
            headers: {
                "Cache-Control": Object.values(payload.errors).some(Boolean)
                    ? "private, no-store"
                    : "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
            },
        });
    } catch {
        return NextResponse.json(
            { error: "Acquisition routes are temporarily unavailable" },
            { status: 502 },
        );
    }
}
