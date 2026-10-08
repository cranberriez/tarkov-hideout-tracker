import { NextRequest, NextResponse } from "next/server";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { isCompleteMarketPageData } from "@/lib/query/page-data";
import { getMarketPageData } from "@/server/db/market-page";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	try {
		const data = await getMarketPageData(modeParam.mode);
		// The analyzer runs hourly, matching the hour of CDN reuse other page data gets.
		return NextResponse.json(data, {
			headers: {
				"Cache-Control": isCompleteMarketPageData(data) ? CacheControl.publicCdnHour : CacheControl.noStore,
			},
		});
	} catch (error) {
		console.error("Market page data could not be loaded", error);
		return NextResponse.json(
			{ error: "Market data could not be loaded" },
			{ status: 503, headers: { "Cache-Control": CacheControl.noStore } },
		);
	}
}
