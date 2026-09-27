import { NextRequest, NextResponse } from "next/server";
import { readItemRouteParams } from "@/app/api/_lib/item-params";
import { getItemUsageView } from "@/server/db/item-views";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
	const params = await readItemRouteParams(request, context);
	if (!params.ok) return params.response;
	const { mode, itemId } = params;

	try {
		const response = await getItemUsageView(mode, itemId, request.nextUrl.searchParams.get("prices") !== "none");
		return NextResponse.json(response, {
			headers: {
				// Trader offers change independently of the catalog version, so this read stays fresh through to PostgreSQL.
				"Cache-Control": CacheControl.noStore,
			},
		});
	} catch (error) {
		return itemDatabaseErrorResponse(error, "Item usage is temporarily unavailable");
	}
}
