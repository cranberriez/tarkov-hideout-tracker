import { NextRequest, NextResponse } from "next/server";
import { readItemRouteParams } from "@/app/api/_lib/item-params";
import { getItemRelationsView } from "@/server/db/item-views";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
	const params = await readItemRouteParams(request, context);
	if (!params.ok) return params.response;
	const { mode, itemId } = params;

	try {
		const payload = await getItemRelationsView(mode, itemId, request.nextUrl.searchParams.get("prices") !== "none");
		const isPartial = Object.values(payload.errors).some((error) => error !== null);
		return NextResponse.json(payload, {
			headers: {
				"Cache-Control":
					process.env.NODE_ENV === "development" || isPartial ? CacheControl.noStore : CacheControl.itemDetail,
			},
		});
	} catch (error) {
		return itemDatabaseErrorResponse(error, "Item relations are temporarily unavailable");
	}
}
