import type { Metadata } from "next";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { TraderAlibiQueryPage } from "@/features/games/trader-alibi/TraderAlibiQueryPage";

export const metadata: Metadata = {
	title: "Trader Alibi",
	description: "Ask for quest objective, barter and trade clues, then guess which Escape from Tarkov trader they belong to.",
	alternates: { canonical: "/games/trader-alibi" },
};

/** Not prefetched: the clue payload loads on the client behind a Suspense fallback. */
export default async function TraderAlibiPage() {
	return <TraderAlibiQueryPage mode={await getActiveTarkovJsonGameMode()} />;
}
