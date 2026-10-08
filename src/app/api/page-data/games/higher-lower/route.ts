import { NextRequest, NextResponse } from "next/server";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { getHigherLowerPageData } from "@/server/db/higher-lower";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	try {
		const data = await getHigherLowerPageData(modeParam.mode);
		// Values come from the hourly analyzer, matching the hour of CDN reuse other page data gets.
		return NextResponse.json(data, {
			headers: { "Cache-Control": data.error === null ? CacheControl.publicCdnHour : CacheControl.noStore },
		});
	} catch (error) {
		console.error("Higher or Lower data could not be loaded", error);
		return NextResponse.json(
			{ error: "Game data could not be loaded" },
			{ status: 503, headers: { "Cache-Control": CacheControl.noStore } },
		);
	}
}
