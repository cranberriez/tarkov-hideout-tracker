import type { Metadata } from "next";
import type { ReactNode } from "react";
import { RouteGameModeSync } from "@/components/core/RouteGameModeSync";
import { DEFAULT_GAME_MODE, GAME_MODE_CONFIG, GAME_MODES } from "@/lib/game-mode";
import { readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";

/**
 * Mode-scoped data pages (`/pvp/hideout`, `/kord/quests/<id>`). The mode comes
 * from the URL only, so every mode × page is an ISR response the CDN can share.
 * Catalog content changes nightly; prices load separately on the client. Unknown
 * slugs 404 from the render instead of `dynamicParams = false`, so that setting
 * cannot reach the entity routes below, which render unlisted IDs on demand.
 */
export const revalidate = 3600;

export function generateStaticParams() {
	return GAME_MODES.map((mode) => ({ mode: GAME_MODE_CONFIG[mode].slug }));
}

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	// Only the default mode is offered to search engines (it is also the sitemap's mode).
	return gameMode === DEFAULT_GAME_MODE ? {} : { robots: { index: false, follow: true } };
}

export default async function ModeLayout({ children, params }: { children: ReactNode; params: ModeRouteParams }) {
	const { gameMode } = await readRouteGameMode(params);
	return (
		<>
			<RouteGameModeSync mode={gameMode} />
			{children}
		</>
	);
}
