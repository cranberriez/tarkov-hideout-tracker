import type { FullQuest, QuestSummary, QuestTraderRequirement } from "./quests";
import type { ItemSummary } from "./items";

/** Wire form of a quest summary: traders are IDs, expanded with `expandQuestSummaries`. */
export type QuestSummaryPayload = Omit<QuestSummary, "trader" | "traderRequirements"> & {
	traderId: string;
	traderRequirements: (Omit<QuestTraderRequirement, "trader"> & { traderId: string })[];
};

export interface QuestWorkspaceIndexData {
	quests: QuestSummaryPayload[] | null;
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
