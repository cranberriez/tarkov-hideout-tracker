import { NextRequest, NextResponse } from "next/server";
import { getCatalogVersion } from "@/server/db/postgres-read";
import { readSearchManifest } from "@/server/db/search-manifest";
import { itemDatabaseErrorResponse } from "@/app/api/_lib/route-errors";
import { readModeParam } from "@/app/api/_lib/mode-params";
import { CacheControl } from "@/app/api/_lib/cache-control";
import { DatabaseTransientReadError } from "@/server/db/errors";
import { QUEST_PREPARATION_REVISION } from "@/lib/quests/quest-preparation";
import { SEARCH_MANIFEST_FORMAT } from "@/lib/search/manifest";

export async function GET(request: NextRequest) {
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam.response;
	const { mode } = modeParam;
	const headers = { "Cache-Control": CacheControl.privateNoStore };
	try {
		const releaseId = await getCatalogVersion(mode);
		if (request.nextUrl.searchParams.get("identity") === "1")
			return NextResponse.json({ v: 1, mode, releaseId }, { headers: { "Cache-Control": CacheControl.shortLived } });
		const requestedRelease = request.nextUrl.searchParams.get("releaseId");
		if (requestedRelease !== null) {
			if (requestedRelease !== releaseId)
				return NextResponse.json({ error: "Search revision changed" }, { status: 409, headers });
			return NextResponse.json(await readSearchManifest(mode, releaseId), {
				headers: { "Cache-Control": CacheControl.immutable },
			});
		}

		const tag = `"search-${SEARCH_MANIFEST_FORMAT}-${QUEST_PREPARATION_REVISION}-${mode}-${releaseId}"`;
		const currentHeaders = { "Cache-Control": CacheControl.shortLived, ETag: `W/${tag}` };
		const validators = request.headers.get("if-none-match")?.split(",") ?? [];
		if (validators.some((value) => value.trim() === "*" || value.trim().replace(/^W\//, "") === tag))
			return new NextResponse(null, { status: 304, headers: currentHeaders });

		return NextResponse.json(await readSearchManifest(mode, releaseId), { headers: currentHeaders });
	} catch (error) {
		if (error instanceof DatabaseTransientReadError)
			return NextResponse.json({ error: "Search revision changed" }, { status: 409, headers });
		return itemDatabaseErrorResponse(error, "Search is temporarily unavailable");
	}
}
