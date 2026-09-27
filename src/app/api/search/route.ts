import { NextRequest, NextResponse } from "next/server";
import { isTarkovJsonGameMode } from "@/lib/game-mode";
import { getCatalogVersion } from "@/server/db/postgres-read";
import { readSearchManifest } from "@/server/db/search-manifest";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { DatabaseTransientReadError } from "@/server/db/errors";

export async function GET(request: NextRequest) {
	const mode = request.nextUrl.searchParams.get("mode");
	if (!isTarkovJsonGameMode(mode))
		return NextResponse.json({ error: "A supported game mode is required" }, { status: 400 });
	const headers = { "Cache-Control": CacheControl.privateNoStore };
	try {
		const releaseId = await getCatalogVersion(mode);
		if (request.nextUrl.searchParams.get("identity") === "1")
			return NextResponse.json({ v: 1, mode, releaseId }, { headers });
		if (request.nextUrl.searchParams.get("releaseId") !== releaseId)
			return NextResponse.json({ error: "Search revision changed" }, { status: 409, headers });
		return NextResponse.json(await readSearchManifest(mode, releaseId), { headers });
	} catch (error) {
		if (error instanceof DatabaseTransientReadError)
			return NextResponse.json({ error: "Search revision changed" }, { status: 409, headers });
		return itemDatabaseErrorResponse(error, "Search is temporarily unavailable");
	}
}
