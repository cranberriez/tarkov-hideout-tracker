import { HydrationBoundary } from "@tanstack/react-query";
import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { RouteLoader } from "@/components/core/RouteLoader";
import { QuestsQueryPage } from "@/features/quests/QuestsQueryPage";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getQuestWorkspaceIndex } from "@/server/queries/getQuestWorkspaceIndex";
import {
	isCompleteQuestWorkspaceIndex,
	PAGE_DATA_STALE_TIME,
	questWorkspacePageQueryOptions,
} from "@/lib/query/page-data";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

export const metadata: Metadata = {
	// A plain string title here would drop the root template for quest routes.
	title: { default: "Quests · Tarkov Hideout Tracker", template: "%s · Tarkov Hideout Tracker" },
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
	const { state, fallbackData } = await prefetchPageData(
		options.queryKey,
		PAGE_DATA_STALE_TIME,
		async () =>
			getQuestWorkspaceIndex(gameMode, await getCurrentPageRepository(gameMode), {
				showRemovedQuests: SHOW_REMOVED_QUESTS,
			}),
		isCompleteQuestWorkspaceIndex,
	);

	return (
		<HydrationBoundary state={state}>
			<QuestsQueryPage mode={gameMode} fallbackData={fallbackData}>
				{children}
			</QuestsQueryPage>
		</HydrationBoundary>
	);
}
