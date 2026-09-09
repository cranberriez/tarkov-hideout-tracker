import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getProfitPageData } from "@/server/queries/getProfitPageData";
import { HydrationBoundary } from "@tanstack/react-query";
import { CraftPlannerQueryPage } from "@/features/profit-pages/ProfitQueryPage";
import { isCompleteProfitPageData, PAGE_DATA_STALE_TIME, profitPageQueryOptions } from "@/lib/query/page-data";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export default async function CraftPlannerPage() {
  const mode = await getActiveTarkovJsonGameMode();
  const options = profitPageQueryOptions(mode);
  const { state, fallbackData } = await prefetchPageData(options.queryKey, PAGE_DATA_STALE_TIME, async () => getProfitPageData(mode, await getCurrentPageRepository(mode)), isCompleteProfitPageData);
  return <HydrationBoundary state={state}><CraftPlannerQueryPage mode={mode} fallbackData={fallbackData} /></HydrationBoundary>;
}
