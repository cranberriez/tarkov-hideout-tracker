import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { modeHref } from "@/lib/entity-routes";
import { gameModeFromSlug, toTarkovJsonGameMode, type GameMode, type TarkovJsonGameMode } from "@/lib/game-mode";

/** Params every page below `(data)/[mode]` receives. */
export type ModeRouteParams = Promise<{ mode: string }>;

/**
 * The page's game mode from its URL segment. Mode-scoped pages never read the
 * active-mode cookie, so each mode × page renders one cacheable response.
 */
export async function readRouteGameMode(params: Promise<{ mode: string }>): Promise<{
	gameMode: GameMode;
	dataMode: TarkovJsonGameMode;
}> {
	const gameMode = gameModeFromSlug((await params).mode);
	if (!gameMode) notFound();
	return { gameMode, dataMode: toTarkovJsonGameMode(gameMode) };
}

/** Self-canonical URL for a mode-less path. Only PVP is indexed; see the `[mode]` layout. */
export function modeCanonical(gameMode: GameMode, path: string): Metadata["alternates"] {
	return { canonical: modeHref(gameMode, path) };
}
