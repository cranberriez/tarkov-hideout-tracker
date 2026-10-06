import type { FullQuest } from "@/types/quests";

/** Item presentations rendered by objective rows, rewards, and planner keys. */
export function getQuestWorkspaceItemIds(quests: readonly FullQuest[]): string[] {
	const ids = new Set<string>();
	for (const quest of quests) {
		for (const reward of quest.finishItemRewards ?? []) ids.add(reward.itemId);
		for (const objective of quest.objectives) {
			for (const group of objective.requiredKeyIds ?? []) for (const id of group) ids.add(id);
			if (
				(objective.type === "giveItem" || objective.type === "findItem" || objective.type === "plantItem") &&
				"itemIds" in objective
			) {
				for (const id of objective.itemIds) ids.add(id);
			}
		}
	}
	return [...ids];
}
