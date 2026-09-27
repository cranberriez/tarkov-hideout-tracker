import { NextRequest, NextResponse } from "next/server";
import { isTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";

const ITEM_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export type ItemRouteParams =
	{ ok: true; mode: TarkovJsonGameMode; itemId: string } | { ok: false; response: NextResponse };

// Item detail routes default to the PVP dataset when no mode is supplied.
export async function readItemRouteParams(
	request: NextRequest,
	context: { params: Promise<{ itemId: string }> },
): Promise<ItemRouteParams> {
	const { itemId } = await context.params;
	const mode = request.nextUrl.searchParams.get("mode") ?? "regular";
	if (!isTarkovJsonGameMode(mode)) {
		return { ok: false, response: NextResponse.json({ error: "Unsupported game mode" }, { status: 400 }) };
	}
	if (!ITEM_ID_PATTERN.test(itemId)) {
		return { ok: false, response: NextResponse.json({ error: "Invalid item ID" }, { status: 400 }) };
	}
	return { ok: true, mode, itemId };
}
