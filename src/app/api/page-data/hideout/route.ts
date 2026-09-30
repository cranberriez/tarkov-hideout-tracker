import { NextRequest, NextResponse } from "next/server";
import { isCompleteHideoutPageData } from "@/lib/query/page-data";
import { getHideoutPageData } from "@/server/queries/getHideoutPageData";
import { getCurrentPageRepository } from "@/app/api/_lib/page-data-params";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	const { mode } = modeParam;
	try {
		const data = await getHideoutPageData(mode, await getCurrentPageRepository(mode), { includePrices: false });
		return NextResponse.json(data, {
			headers: { "Cache-Control": isCompleteHideoutPageData(data) ? CacheControl.publicCdnHour : CacheControl.noStore },
		});
	} catch (error) {
		console.error("Hideout page data could not be loaded", error);
		return NextResponse.json(
			{ error: "Hideout page data could not be loaded" },
			{ status: 503, headers: { "Cache-Control": CacheControl.noStore } },
		);
	}
}
