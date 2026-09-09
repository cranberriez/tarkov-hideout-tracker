import { HydrationBoundary } from "@tanstack/react-query";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { KappaQueryPage } from "@/features/items/kappa/KappaQueryPage";
import { getKappaChecklistPageData } from "@/server/queries/getKappaChecklistPageData";
import { isCompleteKappaChecklistPageData, kappaChecklistPageQueryOptions, PAGE_DATA_STALE_TIME } from "@/lib/query/page-data";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export default async function KappaChecklistPage() {
	const gameMode = await getActiveTarkovJsonGameMode();
	const options = kappaChecklistPageQueryOptions(gameMode);
	const { state, fallbackData } = await prefetchPageData(options.queryKey, PAGE_DATA_STALE_TIME, async () => getKappaChecklistPageData(gameMode, await getCurrentPageRepository(gameMode), { includePrices: false }), isCompleteKappaChecklistPageData);

	return (
		<HydrationBoundary state={state}><KappaQueryPage mode={gameMode} fallbackData={fallbackData} /></HydrationBoundary>
	);
}
