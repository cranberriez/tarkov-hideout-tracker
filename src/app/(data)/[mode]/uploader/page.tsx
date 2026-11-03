import type { Metadata } from "next";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { UploaderClientPage } from "@/features/uploader/UploaderClientPage";

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Loot Scanner",
		description:
			"Scan an Escape from Tarkov stash or container screenshot to identify items and see what to keep for hideout and quests, and what to sell.",
		alternates: modeCanonical(gameMode, "/uploader"),
	};
}

export default function UploaderPage() {
	return <UploaderClientPage />;
}
