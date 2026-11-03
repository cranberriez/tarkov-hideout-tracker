import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { HideoutQueryPage } from "@/features/hideout/HideoutQueryPage";
import { hideoutPageQueryOptions, isCompleteHideoutPageData, PAGE_DATA_STALE_TIME } from "@/lib/query/page-data";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { getHideoutPageData } from "@/server/queries/getHideoutPageData";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Escape from Tarkov Hideout Upgrades & Requirements",
		description: "Track Escape from Tarkov hideout upgrades, required items, station levels, and prerequisites. Plan your next upgrades for PVP, PVE, and KORD.",
		alternates: modeCanonical(gameMode, "/hideout"),
	};
}

export default async function HideoutPage({ params }: { params: ModeRouteParams }) {
	const { dataMode: gameMode } = await readRouteGameMode(params);
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
