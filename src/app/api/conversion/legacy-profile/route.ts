import { NextRequest, NextResponse } from "next/server";
import { isTarkovJsonGameMode } from "@/lib/game-mode";
import { getLegacyProfileConversionView } from "@/server/db/shared-api-data";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const requestedMode = request.nextUrl.searchParams.get("mode");
	if (!isTarkovJsonGameMode(requestedMode)) {
		return NextResponse.json({ error: "A supported game mode is required" }, { status: 400 });
	}

	const payload = await getLegacyProfileConversionView(requestedMode);
	return NextResponse.json(payload, {
		headers: { "Cache-Control": CacheControl.privateNoStore },
	});
}
