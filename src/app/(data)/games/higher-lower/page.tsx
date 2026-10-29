import type { Metadata } from "next";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { HigherLowerQueryPage } from "@/features/games/higher-lower/HigherLowerQueryPage";

export const metadata: Metadata = {
	title: "Higher or Lower",
	description: "Guess whether the next Escape from Tarkov item is worth more or less, and see how long a streak you can build.",
	alternates: { canonical: "/games/higher-lower" },
};

/** Not prefetched: the item value payload loads on the client behind a Suspense fallback. */
export default async function HigherLowerPage() {
	return <HigherLowerQueryPage mode={await getActiveTarkovJsonGameMode()} />;
}
