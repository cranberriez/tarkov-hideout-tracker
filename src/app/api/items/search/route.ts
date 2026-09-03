import { NextRequest, NextResponse } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import {
    isValidItemSearchQuery,
} from "@/server/queries/searchItems";
import { searchItemPreviews } from "@/server/db/item-search";
import { itemDatabaseErrorResponse } from "@/server/db/route-errors";
import {
    ITEM_SEARCH_PAGE_RESULT_LIMIT,
    ITEM_SEARCH_QUICK_RESULT_LIMIT,
} from "@/types/contracts";

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

    const requestedLimit = Number(request.nextUrl.searchParams.get("limit"));
    const resultLimit =
        requestedLimit === ITEM_SEARCH_PAGE_RESULT_LIMIT
            ? ITEM_SEARCH_PAGE_RESULT_LIMIT
            : ITEM_SEARCH_QUICK_RESULT_LIMIT;

    try {
        const payload = await searchItemPreviews(
            query,
            requestedMode as TarkovJsonGameMode,
            resultLimit,
        );
        return NextResponse.json(payload, {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (error) {
        return itemDatabaseErrorResponse(error, "Item search is temporarily unavailable");
    }
}
