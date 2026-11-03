import type { Metadata } from "next";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { GamesHub } from "@/features/games/GamesHub";

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Games",
		description: "Escape from Tarkov mini-games: Higher or Lower, Do I Need It? and Trader Alibi.",
		alternates: modeCanonical(gameMode, "/games"),
	};
}

export default function GamesPage() {
	return <GamesHub />;
}
