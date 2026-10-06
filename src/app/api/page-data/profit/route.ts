import { NextRequest, NextResponse } from "next/server";
import { isCompleteProfitPageData } from "@/lib/query/page-data";
import { getProfitPageData } from "@/server/queries/getProfitPageData";
import { getCurrentPageRepository } from "@/app/api/_lib/page-data-params";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl, profitPageDataCacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	const { mode } = modeParam;
	try {
		const data = await getProfitPageData(mode, await getCurrentPageRepository(mode), {
			includePrices: request.nextUrl.searchParams.get("prices") !== "none",
		});
		const includesPrices = request.nextUrl.searchParams.get("prices") !== "none";
		return NextResponse.json(data, {
			headers: {
				"Cache-Control": profitPageDataCacheControl(isCompleteProfitPageData(data), includesPrices),
			},
		});
	} catch (error) {
		console.error("Profit page data could not be loaded", error);
		return NextResponse.json(
			{ error: "Profit page data could not be loaded" },
			{ status: 503, headers: { "Cache-Control": CacheControl.noStore } },
		);
	}
}
