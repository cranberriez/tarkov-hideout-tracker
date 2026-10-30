import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { questPath } from "@/lib/entity-routes";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { decodeRouteParam } from "@/lib/utils/route-param";
import { isDev } from "@/lib/is-dev";
import { QuestDetailRoute } from "@/features/quests/workspace/QuestDetailRoute";
import { DEV_QUEST_FIXTURES, DEV_QUEST_QUERY } from "@/features/quests/dev-quest-fixture";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { modeCanonical, readRouteGameMode } from "@/server/route-game-mode";
import { getQuestDetailsData } from "@/server/queries/getQuestDetailsData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { questDetailQueryOptions, selectQuestDetailData } from "@/lib/query/quest-details";

interface QuestPageProps {
	params: Promise<{ mode: string; questId: string }>;
	searchParams: Promise<{ q?: string }>;
}

/** Rendered on first visit, then cached per mode until revalidation (ISR). */
export function generateStaticParams() {
	return [];
}

const loadQuest = cache(async (mode: TarkovJsonGameMode, questId: string, devQuery: string | null) => {
	const batch = await getQuestDetailsData(mode, [questId], await getCurrentPageRepository(mode), {
		showRemovedQuests: SHOW_REMOVED_QUESTS,
		displayQuestAdditions: devQuery ? DEV_QUEST_FIXTURES : [],
	});
	return { mode, data: selectQuestDetailData(batch, questId) };
});

async function readRoute({ params, searchParams }: QuestPageProps) {
	const { gameMode, dataMode } = await readRouteGameMode(params);
	return {
		gameMode,
		dataMode,
		questId: decodeRouteParam((await params).questId),
		// Development only: production never reads the query, so quest pages stay static.
		devQuery: isDev && (await searchParams).q === DEV_QUEST_QUERY ? DEV_QUEST_QUERY : null,
	};
}

export async function generateMetadata(props: QuestPageProps): Promise<Metadata> {
	const { gameMode, dataMode, questId, devQuery } = await readRoute(props);
	const {
		data: { quest },
	} = await loadQuest(dataMode, questId, devQuery);
	if (!quest) return { title: "Quest unavailable", robots: { index: false, follow: true } };
	const facts = [
		`${quest.trader.name} quest`,
		quest.map?.name ? `on ${quest.map.name}` : null,
		quest.minPlayerLevel ? `from level ${quest.minPlayerLevel}` : null,
	]
		.filter(Boolean)
		.join(" ");
	const objectives = quest.objectives
		.map((objective) => objective.description)
		.filter(Boolean)
		.slice(0, 3)
		.join(" ");
	return {
		title: `${quest.name} – ${quest.trader.name} Quest`,
		description: `Escape from Tarkov ${quest.name}: ${facts}.${objectives ? ` ${objectives}` : ""}`.slice(0, 300),
		alternates: modeCanonical(gameMode, questPath(quest.id)),
	};
}

export default async function QuestPage(props: QuestPageProps) {
	const { dataMode: mode, questId, devQuery } = await readRoute(props);
	const { data } = await loadQuest(mode, questId, devQuery);
	if (!data.quest && !data.error) notFound();
	const options = questDetailQueryOptions(mode, questId, devQuery);
	const { state, fallbackData } = await prefetchPageData(
		options.queryKey,
		5 * 60 * 1000,
		async () => data,
		(entry) => !entry.error && !entry.itemsError,
	);
	return (
		<HydrationBoundary state={state}>
			<QuestDetailRoute questId={questId} fallbackData={fallbackData} fallbackMode={mode} />
		</HydrationBoundary>
	);
}
