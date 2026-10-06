import { NextRequest, NextResponse } from "next/server";
import { isValidItemSearchQuery, searchItems } from "@/server/queries/searchItems";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { ITEM_SEARCH_PAGE_RESULT_LIMIT, ITEM_SEARCH_QUICK_RESULT_LIMIT } from "@/types/contracts";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	const requestedMode = modeParam.mode;

	const query = request.nextUrl.searchParams.get("q") ?? "";
	if (!isValidItemSearchQuery(query)) {
		return NextResponse.json({ error: "Search query must be between 1 and 80 characters" }, { status: 400 });
	}

	const requestedLimit = Number(request.nextUrl.searchParams.get("limit"));
	const resultLimit =
		requestedLimit === ITEM_SEARCH_PAGE_RESULT_LIMIT ? ITEM_SEARCH_PAGE_RESULT_LIMIT : ITEM_SEARCH_QUICK_RESULT_LIMIT;

	try {
		const payload = await searchItems(query, requestedMode, resultLimit);
		return NextResponse.json(payload, {
			headers: { "Cache-Control": CacheControl.privateNoStore },
		});
	} catch (error) {
		return itemDatabaseErrorResponse(error, "Item search is temporarily unavailable");
	}
}
