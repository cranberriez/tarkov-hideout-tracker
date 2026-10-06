import { NextRequest, NextResponse } from "next/server";
import { isCompleteKappaChecklistPageData } from "@/lib/query/page-data";
import { getKappaChecklistPageData } from "@/server/queries/getKappaChecklistPageData";
import { getCurrentPageRepository } from "@/app/api/_lib/page-data-params";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	const { mode } = modeParam;
	try {
		const data = await getKappaChecklistPageData(mode, await getCurrentPageRepository(mode), { includePrices: false });
		return NextResponse.json(data, {
			headers: {
				"Cache-Control": isCompleteKappaChecklistPageData(data) ? CacheControl.publicCdnHour : CacheControl.noStore,
			},
		});
	} catch (error) {
		console.error("Kappa page data could not be loaded", error);
		return NextResponse.json(
			{ error: "Kappa page data could not be loaded" },
			{ status: 503, headers: { "Cache-Control": CacheControl.noStore } },
		);
	}
}
