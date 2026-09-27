import { redirect } from "next/navigation";
import { QuestSelectionPrompt } from "@/features/quests/workspace/QuestSelectionPrompt";
import { DEV_QUEST_ID, DEV_QUEST_QUERY } from "@/features/quests/dev-quest-fixture";
import { LEGACY_QUEST_QUERY_PARAM, questHref } from "@/features/quests/quest-routes";

interface QuestsPageProps {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined) {
	return Array.isArray(value) ? value[0] : value;
}

export default async function QuestsPage({ searchParams }: QuestsPageProps) {
	const params = await searchParams;
	const legacyQuestId = first(params[LEGACY_QUEST_QUERY_PARAM]);
	if (legacyQuestId) redirect(questHref(legacyQuestId));
	if (process.env.NODE_ENV === "development" && first(params.q) === DEV_QUEST_QUERY) {
		redirect(questHref(DEV_QUEST_ID, DEV_QUEST_QUERY));
	}
	return <QuestSelectionPrompt />;
}
