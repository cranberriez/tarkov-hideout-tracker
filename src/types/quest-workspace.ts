import type { FullQuest, QuestSummary } from "./quests";
import type { ItemSummary } from "./items";

export interface QuestWorkspaceIndexData {
	quests: QuestSummary[] | null;
	updatedAt: number | null;
	error: string | null;
}

export interface QuestDetailsData {
	quests: FullQuest[] | null;
	items: ItemSummary[] | null;
	requestedQuestIds: string[];
	unresolvedQuestIds: string[];
	unresolvedItemIds: string[];
	errors: { quests: string | null; items: string | null };
	freshness: { questsUpdatedAt: number | null; itemsUpdatedAt: number | null };
}
