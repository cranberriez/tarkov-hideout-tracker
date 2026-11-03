import type { Metadata } from "next";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { TraderAlibiQueryPage } from "@/features/games/trader-alibi/TraderAlibiQueryPage";

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Trader Alibi",
		description: "Ask for quest objective, barter and trade clues, then guess which Escape from Tarkov trader they belong to.",
		alternates: modeCanonical(gameMode, "/games/trader-alibi"),
	};
}

/** Not prefetched: the clue payload loads on the client behind a Suspense fallback. */
export default async function TraderAlibiPage({ params }: { params: ModeRouteParams }) {
	return <TraderAlibiQueryPage mode={(await readRouteGameMode(params)).dataMode} />;
}
