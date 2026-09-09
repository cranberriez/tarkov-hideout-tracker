import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";
import { RouteLoader } from "@/components/core/RouteLoader";
import { QuestsQueryPage } from "@/features/quests/QuestsQueryPage";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { getQuestWorkspacePageData } from "@/server/queries/getQuestWorkspacePageData";
import { DEV_QUEST_FIXTURES, DEV_QUEST_ID, DEV_QUEST_QUERY } from "@/features/quests/dev-quest-fixture";
import { isCompleteQuestWorkspacePageData, PAGE_DATA_STALE_TIME, questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

interface QuestsPageProps {
	searchParams: Promise<{ q?: string | string[] }>;
}

export default async function QuestsPage({ searchParams }: QuestsPageProps) {
	const queryValue = (await searchParams).q;
	const query = Array.isArray(queryValue) ? queryValue[0] : queryValue;
	const showDevQuest = process.env.NODE_ENV === "development" && query === DEV_QUEST_QUERY;
	const gameMode = await getActiveTarkovJsonGameMode();
	const options = questWorkspacePageQueryOptions(gameMode, showDevQuest ? DEV_QUEST_QUERY : null);
	const { state, fallbackData } = await prefetchPageData(options.queryKey, PAGE_DATA_STALE_TIME, async () => getQuestWorkspacePageData(gameMode, await getCurrentPageRepository(gameMode), {
		includePrices: false,
		showRemovedQuests: SHOW_REMOVED_QUESTS,
		displayQuestAdditions: showDevQuest ? DEV_QUEST_FIXTURES : [],
	}), isCompleteQuestWorkspacePageData);

	return (
		<Suspense fallback={<RouteLoader page="quests" />}>
			<HydrationBoundary state={state}><QuestsQueryPage mode={gameMode} devQuery={showDevQuest ? DEV_QUEST_QUERY : null} initialQuestId={showDevQuest ? DEV_QUEST_ID : null} fallbackData={fallbackData} /></HydrationBoundary>
		</Suspense>
	);
}
