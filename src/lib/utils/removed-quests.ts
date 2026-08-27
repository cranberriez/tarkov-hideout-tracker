import type { FullQuest } from "@/types";
import removedQuestData from "../data/removed-quests.json";

const removedQuestIds = new Set<string>(removedQuestData.questIds);

export const REMOVED_QUEST_IDS = removedQuestIds as ReadonlySet<string>;

export function isRemovedQuestId(questId: string): boolean {
    return removedQuestIds.has(questId);
}

export function excludeRemovedQuests<T extends { id: string }>(quests: T[]): T[] {
    return quests.filter((quest) => !isRemovedQuestId(quest.id));
}

export function prepareQuestsForDisplay(
    quests: FullQuest[],
    showRemovedQuests: boolean,
): FullQuest[] {
    if (!showRemovedQuests) return excludeRemovedQuests(quests);

    return quests.map((quest) =>
        isRemovedQuestId(quest.id) ? { ...quest, removed: true } : quest,
    );
}
