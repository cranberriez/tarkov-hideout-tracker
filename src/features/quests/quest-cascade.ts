import type { FullQuest } from "../../types/types";
import { getSensitiveBackfillQuest } from "../../lib/utils/sensitive-quest-backfill";

export interface QuestCascadeCompleteResult {
    toComplete: string[];
    crossTraderQuestIds: string[];
    sensitiveQuestIds: string[];
}

export interface CollectCompleteCascadeContext {
    questsById: ReadonlyMap<string, FullQuest>;
    completedQuests: Record<string, boolean>;
}

export function collectCompleteCascade(
    rootQuestId: string,
    ctx: CollectCompleteCascadeContext,
): QuestCascadeCompleteResult {
    const { questsById, completedQuests } = ctx;
    const rootQuest = questsById.get(rootQuestId);
    if (!rootQuest) {
        return { toComplete: [], crossTraderQuestIds: [], sensitiveQuestIds: [] };
    }

    const toComplete = new Set<string>();
    const visited = new Set<string>();
    const queue: string[] = [rootQuestId];

    while (queue.length > 0) {
        const questId = queue.pop()!;
        if (visited.has(questId)) continue;
        visited.add(questId);

        if (completedQuests[questId]) continue;

        const quest = questsById.get(questId);
        if (!quest) continue;

        toComplete.add(questId);
        for (const requirement of quest.taskRequirements) {
            queue.push(requirement.task.id);
        }
    }

    const rootTraderId = rootQuest.trader.id;
    const crossTraderQuestIds: string[] = [];
    const sensitiveQuestIds: string[] = [];

    for (const questId of toComplete) {
        const quest = questsById.get(questId);
        if (quest && quest.trader.id !== rootTraderId) {
            crossTraderQuestIds.push(questId);
        }
        if (getSensitiveBackfillQuest(questId)) {
            sensitiveQuestIds.push(questId);
        }
    }

    return {
        toComplete: Array.from(toComplete),
        crossTraderQuestIds,
        sensitiveQuestIds,
    };
}
