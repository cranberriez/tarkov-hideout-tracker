import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { RouteLoader } from "@/components/core/RouteLoader";
import { QuestsQueryPage } from "@/features/quests/QuestsQueryPage";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getQuestWorkspacePageData } from "@/server/queries/getQuestWorkspacePageData";
import { isCompleteQuestWorkspacePageData, PAGE_DATA_STALE_TIME, questWorkspacePageQueryOptions } from "@/lib/query/page-data";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export const metadata: Metadata = {
	title: "Quests",
	description: "Escape from Tarkov quest log with objectives, requirements, unlocks, and maps.",
};

/**
 * The quest workspace is this segment's page-owned data: it persists across
 * `/quests` and `/quests/[questId]` so list search, filters, and scroll survive
 * detail navigation. Parent layouts still load nothing.
 */
export default function QuestsLayout({ children }: { children: ReactNode }) {
	return (
		<Suspense fallback={<RouteLoader page="quests" title="Quests" />}>
			<QuestWorkspaceData>{children}</QuestWorkspaceData>
		</Suspense>
	);
}

async function QuestWorkspaceData({ children }: { children: ReactNode }) {
	const gameMode = await getActiveTarkovJsonGameMode();
	const options = questWorkspacePageQueryOptions(gameMode);
	const { state, fallbackData } = await prefetchPageData(options.queryKey, PAGE_DATA_STALE_TIME, async () => getQuestWorkspacePageData(gameMode, await getCurrentPageRepository(gameMode), {
		includePrices: false,
		showRemovedQuests: SHOW_REMOVED_QUESTS,
	}), isCompleteQuestWorkspacePageData);

	return (
		<HydrationBoundary state={state}>
			<QuestsQueryPage mode={gameMode} fallbackData={fallbackData}>{children}</QuestsQueryPage>
		</HydrationBoundary>
	);
}
