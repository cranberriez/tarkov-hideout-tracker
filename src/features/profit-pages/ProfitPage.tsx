import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getProfitPageData } from "@/server/queries/getProfitPageData";
import { HydrationBoundary } from "@tanstack/react-query";
import { isCompleteProfitPageData, PAGE_DATA_STALE_TIME, profitPageQueryOptions } from "@/lib/query/page-data";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";
import { ProfitQueryPage } from "./ProfitQueryPage";
import type { ProfitPageKind } from "./types";

export async function ProfitPage({
  kind,
  searchParams,
}: {
  kind: ProfitPageKind;
  searchParams: Promise<{ recipe?: string }>;
}) {
  const [{ recipe }, mode] = await Promise.all([
    searchParams,
    getActiveTarkovJsonGameMode(),
  ]);
  const options = profitPageQueryOptions(mode);
  const { state, fallbackData } = await prefetchPageData(options.queryKey, PAGE_DATA_STALE_TIME, async () => getProfitPageData(mode, await getCurrentPageRepository(mode)), isCompleteProfitPageData);
  return (
    <HydrationBoundary state={state}><ProfitQueryPage mode={mode} kind={kind} fallbackData={fallbackData} initialTargetRecipeId={recipe} /></HydrationBoundary>
  );
}
