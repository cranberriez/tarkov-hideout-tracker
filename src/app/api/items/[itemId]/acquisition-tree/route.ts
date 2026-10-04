import { NextRequest, NextResponse } from "next/server";
import { readItemRouteParams } from "@/app/api/_lib/item-params";
import { getItemAcquisitionView } from "@/server/db/item-views";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { CacheControl, isCompleteItemView } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
	const params = await readItemRouteParams(request, context);
	if (!params.ok) return params.response;
	const { mode, itemId } = params;

	try {
		const payload = await getItemAcquisitionView(mode, itemId, request.nextUrl.searchParams.get("prices") !== "none");
		return NextResponse.json(payload, {
			headers: { "Cache-Control": isCompleteItemView(payload) ? CacheControl.itemView : CacheControl.noStore },
		});
	} catch (error) {
		return itemDatabaseErrorResponse(error, "Acquisition routes are temporarily unavailable");
	}
}
