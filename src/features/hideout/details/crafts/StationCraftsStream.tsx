import { HydrationBoundary } from "@tanstack/react-query";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { isCompleteProfitPageData, PAGE_DATA_STALE_TIME, stationRecipeQueryOptions } from "@/lib/query/page-data";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";
import { getStationRecipePageData } from "@/server/queries/getStationRecipePageData";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { StationRecipeSections } from "./StationRecipeSections";

/** Start early (before other awaits) so the recipe read overlaps the Hideout read. Never rejects. */
export function prefetchStationCrafts(mode: TarkovJsonGameMode, stationId: string) {
	const options = stationRecipeQueryOptions(mode, stationId);
	return prefetchPageData(
		options.queryKey,
		PAGE_DATA_STALE_TIME,
		async () => getStationRecipePageData(mode, stationId, await getCurrentPageRepository(mode)),
		isCompleteProfitPageData,
	);
}

export async function StationCraftsStream({
	mode,
	prefetch,
}: {
	mode: TarkovJsonGameMode;
	prefetch: ReturnType<typeof prefetchStationCrafts>;
}) {
	const { state, fallbackData } = await prefetch;
	return (
		<HydrationBoundary state={state}>
			<StationRecipeSections mode={mode} fallbackData={fallbackData} />
		</HydrationBoundary>
	);
}
