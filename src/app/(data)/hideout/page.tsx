import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { HideoutQueryPage } from "@/features/hideout/HideoutQueryPage";
import { hideoutPageQueryOptions, isCompleteHideoutPageData, PAGE_DATA_STALE_TIME } from "@/lib/query/page-data";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getHideoutPageData } from "@/server/queries/getHideoutPageData";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export const metadata: Metadata = {
	title: "Escape from Tarkov Hideout Upgrades & Requirements",
	description: "Track Escape from Tarkov hideout upgrades, required items, station levels, and prerequisites. Plan your next upgrades for PVP, PVE, and KORD.",
	alternates: { canonical: "/hideout" },
};

export default async function HideoutPage() {
	const gameMode = await getActiveTarkovJsonGameMode();
	const options = hideoutPageQueryOptions(gameMode);
	const { state, fallbackData } = await prefetchPageData(
		options.queryKey,
		PAGE_DATA_STALE_TIME,
		async () => getHideoutPageData(gameMode, await getCurrentPageRepository(gameMode), { includePrices: false }),
		isCompleteHideoutPageData,
	);

	return (
		<HydrationBoundary state={state}>
			<HideoutQueryPage mode={gameMode} fallbackData={fallbackData} />
		</HydrationBoundary>
	);
}
