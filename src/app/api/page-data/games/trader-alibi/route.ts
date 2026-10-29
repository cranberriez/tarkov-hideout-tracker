import { NextRequest, NextResponse } from "next/server";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { getTraderAlibiPageData } from "@/server/db/trader-alibi";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	try {
		const data = await getTraderAlibiPageData(modeParam.mode);
		return NextResponse.json(data, { headers: { "Cache-Control": CacheControl.publicCdnHour } });
	} catch (error) {
		console.error("Trader Alibi data could not be loaded", error);
		return NextResponse.json(
			{ error: "Game data could not be loaded" },
			{ status: 503, headers: { "Cache-Control": CacheControl.noStore } },
		);
	}
}
