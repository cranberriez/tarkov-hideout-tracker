import { NextRequest, NextResponse } from "next/server";
import { isTarkovJsonGameMode } from "@/lib/game-mode";
import {
    isValidItemSearchQuery,
    searchItems,
} from "@/server/queries/searchItems";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import {
    ITEM_SEARCH_PAGE_RESULT_LIMIT,
    ITEM_SEARCH_QUICK_RESULT_LIMIT,
} from "@/types/contracts";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
    const requestedMode = request.nextUrl.searchParams.get("mode");
    if (!isTarkovJsonGameMode(requestedMode)) {
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
        const payload = await searchItems(
            query,
            requestedMode,
            resultLimit,
        );
        return NextResponse.json(payload, {
            headers: { "Cache-Control": CacheControl.privateNoStore },
        });
    } catch (error) {
        return itemDatabaseErrorResponse(error, "Item search is temporarily unavailable");
    }
}
