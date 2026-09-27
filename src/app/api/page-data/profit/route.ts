import { NextRequest, NextResponse } from "next/server";
import { isCompleteProfitPageData } from "@/lib/query/page-data";
import { getProfitPageData } from "@/server/queries/getProfitPageData";
import { getCurrentPageRepository, readPageDataMode } from "@/app/api/_lib/page-data-params";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const mode = readPageDataMode(request);
	if (!mode)
		return NextResponse.json(
			{ error: "A supported game mode is required" },
			{ status: 400, headers: { "Cache-Control": CacheControl.noStore } },
		);
	try {
		const data = await getProfitPageData(mode, await getCurrentPageRepository(mode), {
			includePrices: request.nextUrl.searchParams.get("prices") !== "none",
		});
		return NextResponse.json(data, {
			headers: {
				"Cache-Control": isCompleteProfitPageData(data)
					? request.nextUrl.searchParams.get("prices") === "none"
						? CacheControl.publicCdnHour
						: CacheControl.publicCdnFiveMinutes
					: CacheControl.noStore,
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
