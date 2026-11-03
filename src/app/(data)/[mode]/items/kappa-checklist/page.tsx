import type { Metadata } from "next";
import { HydrationBoundary } from "@tanstack/react-query";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { KappaQueryPage } from "@/features/items/kappa/KappaQueryPage";
import { getKappaChecklistPageData } from "@/server/queries/getKappaChecklistPageData";
import {
	isCompleteKappaChecklistPageData,
	kappaChecklistPageQueryOptions,
	PAGE_DATA_STALE_TIME,
} from "@/lib/query/page-data";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export async function generateMetadata({ params }: { params: ModeRouteParams }): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Kappa Collector Item Checklist",
		description: "Track Escape from Tarkov Collector quest items for the Kappa container, including Found in Raid items and your collection progress.",
		alternates: modeCanonical(gameMode, "/items/kappa-checklist"),
	};
}

export default async function KappaChecklistPage({ params }: { params: ModeRouteParams }) {
	const { dataMode: gameMode } = await readRouteGameMode(params);
	const options = kappaChecklistPageQueryOptions(gameMode);
	const { state, fallbackData } = await prefetchPageData(
		options.queryKey,
		PAGE_DATA_STALE_TIME,
		async () => getKappaChecklistPageData(gameMode, await getCurrentPageRepository(gameMode), { includePrices: false }),
		isCompleteKappaChecklistPageData,
	);

	return (
		<HydrationBoundary state={state}>
			<KappaQueryPage mode={gameMode} fallbackData={fallbackData} />
		</HydrationBoundary>
	);
}
