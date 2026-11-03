import type { Metadata } from "next";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { HigherLowerQueryPage } from "@/features/games/higher-lower/HigherLowerQueryPage";

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Higher or Lower",
		description: "Guess whether the next Escape from Tarkov item is worth more or less, and see how long a streak you can build.",
		alternates: modeCanonical(gameMode, "/games/higher-lower"),
	};
}

/** Not prefetched: the item value payload loads on the client behind a Suspense fallback. */
export default async function HigherLowerPage({ params }: { params: ModeRouteParams }) {
	return <HigherLowerQueryPage mode={(await readRouteGameMode(params)).dataMode} />;
}
