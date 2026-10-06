import { NextRequest, NextResponse } from "next/server";
import { getCatalogVersion } from "@/server/db/postgres-read";
import { readSearchManifest } from "@/server/db/search-manifest";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { DatabaseTransientReadError } from "@/server/db/errors";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	const { mode } = modeParam;
	const headers = { "Cache-Control": CacheControl.privateNoStore };
	try {
		const releaseId = await getCatalogVersion(mode);
		if (request.nextUrl.searchParams.get("identity") === "1")
			return NextResponse.json({ v: 1, mode, releaseId }, { headers: { "Cache-Control": CacheControl.shortLived } });
		if (request.nextUrl.searchParams.get("releaseId") !== releaseId)
			return NextResponse.json({ error: "Search revision changed" }, { status: 409, headers });
		// The URL names its release and a mismatch is rejected above, so this body can never change.
		return NextResponse.json(await readSearchManifest(mode, releaseId), {
			headers: { "Cache-Control": CacheControl.immutable },
		});
	} catch (error) {
		if (error instanceof DatabaseTransientReadError)
			return NextResponse.json({ error: "Search revision changed" }, { status: 409, headers });
		return itemDatabaseErrorResponse(error, "Search is temporarily unavailable");
	}
}
