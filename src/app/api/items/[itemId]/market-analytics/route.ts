import { NextRequest, NextResponse } from "next/server";
import { readItemRouteParams } from "@/app/api/_lib/item-params";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { getItemMarketAnalytics } from "@/server/db/market-analytics";
import type { ItemMarketAnalyticsPayload } from "@/types/contracts";

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
	const params = await readItemRouteParams(request, context);
	if (!params.ok) return params.response;

	try {
		const data = await getItemMarketAnalytics(params.mode, params.itemId);
		// The analyzer writes at most a few rows per item per day, so an hour of CDN reuse is safe.
		if (!data) {
			return NextResponse.json(
				{ error: "No market analytics for this item" },
				{ status: 404, headers: { "Cache-Control": CacheControl.publicCdnHour } },
			);
		}
		const payload: ItemMarketAnalyticsPayload = { data };
		return NextResponse.json(payload, { headers: { "Cache-Control": CacheControl.publicCdnHour } });
	} catch {
		return NextResponse.json(
			{ error: "Market analytics are temporarily unavailable" },
			{ status: 503, headers: { "Cache-Control": CacheControl.privateNoStore } },
		);
	}
}
