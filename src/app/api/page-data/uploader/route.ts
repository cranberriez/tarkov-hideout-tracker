import { NextRequest, NextResponse } from "next/server";
import { getUploaderSummaryData } from "@/server/queries/getUploaderSummaryData";
import { getCurrentPageRepository } from "@/app/api/_lib/page-data-params";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	try {
		return NextResponse.json(
			await getUploaderSummaryData(modeParam.mode, await getCurrentPageRepository(modeParam.mode)),
			{
				headers: { "Cache-Control": CacheControl.publicCdnHour },
			},
		);
	} catch (error) {
		console.error("Uploader requirements could not be loaded", error);
		return NextResponse.json(
			{ error: "Hideout and quest requirements could not be loaded." },
			{
				status: 503,
				headers: { "Cache-Control": CacheControl.noStore },
			},
		);
	}
}
