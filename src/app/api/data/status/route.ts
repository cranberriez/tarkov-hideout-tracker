import { NextRequest, NextResponse } from "next/server";
import { getDataStatusView } from "@/server/db/shared-api-data";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	const requestedMode = modeParam.mode;

	try {
		const payload = await getDataStatusView(requestedMode);
		return NextResponse.json(payload, {
			headers: { "Cache-Control": CacheControl.shortLived },
		});
	} catch (error) {
		return itemDatabaseErrorResponse(error, "PostgreSQL data status is temporarily unavailable");
	}
}
