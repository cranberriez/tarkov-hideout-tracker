import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TARKOV_JSON_GAME_MODE, isTarkovJsonGameMode, type TarkovJsonGameMode } from "@/lib/game-mode";
import { CacheControl } from "./cache-control";

export type ModeParam = { ok: true; mode: TarkovJsonGameMode } | { ok: false; response: NextResponse };

/** Reads `?mode=`. A missing mode selects the PVP dataset; an unknown one is rejected. */
export function readModeParam(request: NextRequest): ModeParam {
	const mode = request.nextUrl.searchParams.get("mode") ?? DEFAULT_TARKOV_JSON_GAME_MODE;
	if (isTarkovJsonGameMode(mode)) return { ok: true, mode };
	return {
		ok: false,
		response: NextResponse.json(
			{ error: "Unsupported game mode" },
			{ status: 400, headers: { "Cache-Control": CacheControl.noStore } },
		),
	};
}
