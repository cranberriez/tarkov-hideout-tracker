import { readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { getProfitPageData } from "@/server/queries/getProfitPageData";
import { HydrationBoundary } from "@tanstack/react-query";
import { CraftPlannerQueryPage } from "@/features/profit-pages/ProfitQueryPage";
import { isCompleteProfitPageData, PAGE_DATA_STALE_TIME, profitPageQueryOptions } from "@/lib/query/page-data";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export default async function CraftPlannerPage({ params }: { params: ModeRouteParams }) {
	const { dataMode: mode } = await readRouteGameMode(params);
	const options = profitPageQueryOptions(mode);
	const { state, fallbackData } = await prefetchPageData(
		options.queryKey,
		PAGE_DATA_STALE_TIME,
		async () => getProfitPageData(mode, await getCurrentPageRepository(mode), { includePrices: false }),
		isCompleteProfitPageData,
	);
	return (
		<HydrationBoundary state={state}>
			<CraftPlannerQueryPage mode={mode} fallbackData={fallbackData} />
		</HydrationBoundary>
	);
}
