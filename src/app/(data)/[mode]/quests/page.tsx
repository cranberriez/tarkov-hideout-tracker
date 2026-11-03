import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isDev } from "@/lib/is-dev";
import { QuestSelectionPrompt } from "@/features/quests/workspace/QuestSelectionPrompt";
import { DEV_QUEST_ID, DEV_QUEST_QUERY } from "@/features/quests/dev-quest-fixture";
import { questHref } from "@/features/quests/quest-routes";
import { modeCanonical, readRouteGameMode, type ModeRouteParams } from "@/server/route-game-mode";

interface QuestsPageProps {
	params: ModeRouteParams;
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata({ params }: QuestsPageProps): Promise<Metadata> {
	const { gameMode } = await readRouteGameMode(params);
	return {
		title: "Escape from Tarkov Quests & Required Items",
		description: "Find Escape from Tarkov quests by trader or map. Track objectives, required items, prerequisites, unlocks, and quest progress.",
		alternates: modeCanonical(gameMode, "/quests"),
	};
}

function first(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

/** Legacy `?quest=` links are redirected by the proxy; production never reads the query, so this route stays static. */
export default async function QuestsPage({ params, searchParams }: QuestsPageProps) {
	if (isDev && first((await searchParams).q) === DEV_QUEST_QUERY) {
		redirect(questHref((await readRouteGameMode(params)).gameMode, DEV_QUEST_ID, DEV_QUEST_QUERY));
	}
	return <QuestSelectionPrompt />;
}
