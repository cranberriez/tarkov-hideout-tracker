import { NextRequest, NextResponse } from "next/server";
import { isTarkovJsonGameMode } from "@/lib/game-mode";
import { getDataStatusView } from "@/server/db/shared-api-data";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const requestedMode = request.nextUrl.searchParams.get("mode");
	if (!isTarkovJsonGameMode(requestedMode)) {
		return NextResponse.json({ error: "A supported game mode is required" }, { status: 400 });
	}

	try {
		const payload = await getDataStatusView(requestedMode);
		return NextResponse.json(payload, {
			headers: { "Cache-Control": CacheControl.privateNoStore },
		});
	} catch (error) {
		return itemDatabaseErrorResponse(error, "Data release status is temporarily unavailable");
	}
}
