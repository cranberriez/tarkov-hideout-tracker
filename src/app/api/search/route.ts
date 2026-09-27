import { NextRequest, NextResponse } from "next/server";
import { isTarkovJsonGameMode } from "@/lib/game-mode";
import { getActiveDataReleaseId } from "@/server/db/release-config";
import { readSearchManifest } from "@/server/db/search-manifest";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { CacheControl } from "@/app/api/_lib/cache-control";

export async function GET(request: NextRequest) {
	const mode = request.nextUrl.searchParams.get("mode");
	if (!isTarkovJsonGameMode(mode))
		return NextResponse.json({ error: "A supported game mode is required" }, { status: 400 });
	const headers = { "Cache-Control": CacheControl.privateNoStore };
	try {
		const releaseId = await getActiveDataReleaseId(mode);
		if (request.nextUrl.searchParams.get("identity") === "1")
			return NextResponse.json({ v: 1, mode, releaseId }, { headers });
		if (request.nextUrl.searchParams.get("releaseId") !== releaseId)
			return NextResponse.json({ error: "Search revision changed" }, { status: 409, headers });
		return NextResponse.json(await readSearchManifest(mode, releaseId), { headers });
	} catch (error) {
		return itemDatabaseErrorResponse(error, "Search is temporarily unavailable");
	}
}
