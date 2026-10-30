import { readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";
import { getProfitPageData } from "@/server/queries/getProfitPageData";
import { HydrationBoundary } from "@tanstack/react-query";
import { isCompleteProfitPageData, PAGE_DATA_STALE_TIME, profitPageQueryOptions } from "@/lib/query/page-data";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";
import { ProfitQueryPage } from "./ProfitQueryPage";
import type { ProfitPageKind } from "./types";

/** `?recipe=` is read by the client table (rendered after prices load), so the route stays static. */
export async function ProfitPage({ kind, params }: { kind: ProfitPageKind; params: ModeRouteParams }) {
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
			<ProfitQueryPage mode={mode} kind={kind} fallbackData={fallbackData} />
		</HydrationBoundary>
	);
}
