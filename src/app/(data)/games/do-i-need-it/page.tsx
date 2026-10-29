import type { Metadata } from "next";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { DoINeedItQueryPage } from "@/features/games/do-i-need-it/DoINeedItQueryPage";

export const metadata: Metadata = {
	title: "Do I Need It?",
	description: "Spot the Escape from Tarkov items your quests and hideout still need among look-alike decoys.",
	alternates: { canonical: "/games/do-i-need-it" },
};

/** Requirements and the search manifest load on the client, keyed to the saved profile. */
export default async function DoINeedItPage() {
	return <DoINeedItQueryPage mode={await getActiveTarkovJsonGameMode()} />;
}
