import { NextRequest, NextResponse } from "next/server";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { readModeParam } from "./mode-params";

const ITEM_ID_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

export type ItemRouteParams =
	{ ok: true; mode: TarkovJsonGameMode; itemId: string } | { ok: false; response: NextResponse };

export async function readItemRouteParams(
	request: NextRequest,
	context: { params: Promise<{ itemId: string }> },
): Promise<ItemRouteParams> {
	const { itemId } = await context.params;
	const modeParam = readModeParam(request);
	if (!modeParam.ok) return modeParam;
	if (!ITEM_ID_PATTERN.test(itemId)) {
		return { ok: false, response: NextResponse.json({ error: "Invalid item ID" }, { status: 400 }) };
	}
	return { ok: true, mode: modeParam.mode, itemId };
}
