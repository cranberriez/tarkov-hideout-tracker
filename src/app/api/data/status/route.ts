import { NextRequest, NextResponse } from "next/server";
import type { TarkovDataMode } from "@/types/common";
import { getDataStatusView } from "@/server/db/shared-api-data";
import { itemDatabaseErrorResponse } from "@/server/db/route-errors";

const MODES = new Set<TarkovDataMode>(["regular", "pve", "pvp-season"]);

export async function GET(request: NextRequest) {
	const requestedMode = request.nextUrl.searchParams.get("mode");
	if (!requestedMode || !MODES.has(requestedMode as TarkovDataMode)) {
		return NextResponse.json({ error: "A supported game mode is required" }, { status: 400 });
	}

	try {
		const payload = await getDataStatusView(requestedMode as TarkovDataMode);
		return NextResponse.json(payload, {
			headers: { "Cache-Control": "private, no-store" },
		});
	} catch (error) {
		return itemDatabaseErrorResponse(error, "Data release status is temporarily unavailable");
	}
}
