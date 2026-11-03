import type { Metadata } from "next";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { DoINeedItQueryPage } from "@/features/games/do-i-need-it/DoINeedItQueryPage";

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Do I Need It?",
		description: "Spot the Escape from Tarkov items your quests and hideout still need among look-alike decoys.",
		alternates: modeCanonical(gameMode, "/games/do-i-need-it"),
	};
}

/** Requirements and the search manifest load on the client, keyed to the saved profile. */
export default async function DoINeedItPage({ params }: { params: ModeRouteParams }) {
	return <DoINeedItQueryPage mode={(await readRouteGameMode(params)).dataMode} />;
}
