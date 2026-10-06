import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { HydrationBoundary } from "@tanstack/react-query";
import { decodeRouteParam } from "@/lib/utils/route-param";
import { isDev } from "@/lib/is-dev";
import { QuestDetailRoute } from "@/features/quests/workspace/QuestDetailRoute";
import { DEV_QUEST_FIXTURES, DEV_QUEST_QUERY } from "@/features/quests/dev-quest-fixture";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { questHref } from "@/features/quests/quest-routes";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getQuestDetailsData } from "@/server/queries/getQuestDetailsData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";
import { prefetchPageData } from "@/server/queries/prefetchPageData";
import { questDetailQueryOptions, selectQuestDetailData } from "@/lib/query/quest-details";

interface QuestPageProps {
	params: Promise<{ questId: string }>;
	searchParams: Promise<{ q?: string }>;
}

const loadQuest = cache(async (questId: string, devQuery: string | null) => {
	const mode = await getActiveTarkovJsonGameMode();
	const batch = await getQuestDetailsData(mode, [questId], await getCurrentPageRepository(mode), {
		showRemovedQuests: SHOW_REMOVED_QUESTS,
		displayQuestAdditions: devQuery ? DEV_QUEST_FIXTURES : [],
	});
	return { mode, data: selectQuestDetailData(batch, questId) };
});

async function readRoute({ params, searchParams }: QuestPageProps) {
	return {
		questId: decodeRouteParam((await params).questId),
		devQuery: isDev && (await searchParams).q === DEV_QUEST_QUERY ? DEV_QUEST_QUERY : null,
	};
}

export async function generateMetadata(props: QuestPageProps): Promise<Metadata> {
	const { questId, devQuery } = await readRoute(props);
	const {
		data: { quest },
	} = await loadQuest(questId, devQuery);
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
		alternates: { canonical: questHref(quest.id) },
	};
}

export default async function QuestPage(props: QuestPageProps) {
	const { questId, devQuery } = await readRoute(props);
	const { mode, data } = await loadQuest(questId, devQuery);
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
