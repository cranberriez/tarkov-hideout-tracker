import { NextRequest, NextResponse } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import {
    isValidItemSearchQuery,
    searchItems,
} from "@/server/queries/searchItems";

const MODES = new Set<TarkovJsonGameMode>(["regular", "pve", "pvp-season"]);

export async function GET(request: NextRequest) {
    const requestedMode = request.nextUrl.searchParams.get("mode");
    if (!requestedMode || !MODES.has(requestedMode as TarkovJsonGameMode)) {
        return NextResponse.json(
            { error: "A supported game mode is required" },
            { status: 400 },
        );
    }

    const query = request.nextUrl.searchParams.get("q") ?? "";
    if (!isValidItemSearchQuery(query)) {
        return NextResponse.json(
            { error: "Search query must be between 1 and 80 characters" },
            { status: 400 },
        );
    }

    const payload = await searchItems(query, requestedMode as TarkovJsonGameMode);
    return NextResponse.json(payload, {
        headers: { "Cache-Control": "private, no-store" },
    });
}
