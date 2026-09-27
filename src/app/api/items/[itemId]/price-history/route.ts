import { NextRequest, NextResponse } from "next/server";
import { readItemRouteParams } from "@/app/api/_lib/item-params";
import { fetchCachedJsonPriceHistory, PRICE_HISTORY_REVALIDATE_SECONDS } from "@/server/prices/live-price-history";

export const revalidate = 7200;

export async function GET(request: NextRequest, context: { params: Promise<{ itemId: string }> }) {
	const params = await readItemRouteParams(request, context);
	if (!params.ok) return params.response;
	const { mode, itemId } = params;

	try {
		const data = await fetchCachedJsonPriceHistory(mode, itemId);
		return NextResponse.json(
			{ data, fetchedAt: Date.now() },
			{
				headers: {
					"Cache-Control": `public, max-age=300, s-maxage=${PRICE_HISTORY_REVALIDATE_SECONDS}, stale-while-revalidate=300`,
				},
			},
		);
	} catch (error) {
		return NextResponse.json(
			{ error: "Price history is temporarily unavailable" },
			{
				status: error instanceof Error && /status\s+404\b/.test(error.message) ? 404 : 502,
			},
		);
	}
}
