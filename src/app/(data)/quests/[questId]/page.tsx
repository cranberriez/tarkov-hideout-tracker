import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { decodeRouteParam } from "@/lib/utils/route-param";
import { QuestDetailRoute } from "@/features/quests/workspace/QuestDetailRoute";
import { DEV_QUEST_ID } from "@/features/quests/dev-quest-fixture";
import { SHOW_REMOVED_QUESTS } from "@/features/quests/quest-feature-flags";
import { questHref } from "@/features/quests/quest-routes";
import { getActiveTarkovJsonGameMode } from "@/server/active-game-mode";
import { getQuestDetailPageData } from "@/server/queries/getQuestDetailPageData";
import { getCurrentPageRepository } from "@/server/queries/currentPageRepository";

interface QuestPageProps {
	params: Promise<{ questId: string }>;
}

async function loadQuest(questId: string) {
	const gameMode = await getActiveTarkovJsonGameMode();
	return getQuestDetailPageData(gameMode, questId, await getCurrentPageRepository(gameMode), {
		showRemovedQuests: SHOW_REMOVED_QUESTS,
	});
}

function isDevQuest(questId: string) {
	return process.env.NODE_ENV === "development" && questId === DEV_QUEST_ID;
}

export async function generateMetadata({ params }: QuestPageProps): Promise<Metadata> {
	const questId = decodeRouteParam((await params).questId);
	if (isDevQuest(questId)) return { title: "Development quest" };
	const { quest } = await loadQuest(questId);
	if (!quest) return { title: "Quest" };
	const facts = [
		`${quest.traderName} quest`,
		quest.mapName ? `on ${quest.mapName}` : null,
		quest.minPlayerLevel ? `from level ${quest.minPlayerLevel}` : null,
	].filter(Boolean).join(" ");
	const objectives = quest.objectiveDescriptions.slice(0, 3).join(" ");
	return {
		title: `${quest.name} (${quest.traderName})`,
		description: `${quest.name}: ${facts}.${objectives ? ` ${objectives}` : ""}`.slice(0, 300),
		alternates: { canonical: questHref(quest.id) },
	};
}

export default async function QuestPage({ params }: QuestPageProps) {
	const questId = decodeRouteParam((await params).questId);
	if (!isDevQuest(questId)) {
		const { quest, error } = await loadQuest(questId);
		// A failed read falls through to the workspace, which reports its own data errors.
		if (!quest && !error) notFound();
	}
	return <QuestDetailRoute questId={questId} />;
}
