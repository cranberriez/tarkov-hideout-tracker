import { NextRequest, NextResponse } from "next/server";
import { getCompletedItemsConversionView } from "@/server/db/shared-api-data";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;

	const payload = await getCompletedItemsConversionView(modeParam.mode);
	return NextResponse.json(payload, {
		headers: { "Cache-Control": CacheControl.privateNoStore },
	});
}
