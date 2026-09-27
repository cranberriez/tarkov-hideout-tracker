import { NextRequest, NextResponse } from "next/server";
import { isCompleteItemChecklistPageData } from "@/lib/query/page-data";
import { getItemChecklistPageData } from "@/server/queries/getItemChecklistPageData";
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
		const data = await getItemChecklistPageData(mode, await getCurrentPageRepository(mode), { includePrices: false });
		return NextResponse.json(data, {
			headers: {
				"Cache-Control": isCompleteItemChecklistPageData(data) ? CacheControl.publicCdnHour : CacheControl.noStore,
			},
		});
	} catch (error) {
		console.error("Items page data could not be loaded", error);
		return NextResponse.json(
			{ error: "Items page data could not be loaded" },
			{ status: 503, headers: { "Cache-Control": CacheControl.noStore } },
		);
	}
}
