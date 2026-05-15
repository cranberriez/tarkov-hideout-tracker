import type { FullQuest } from "../../types/types";
import {
    buildQuestAvailabilityMap,
    isQuestAvailableForProfile as isQuestAvailableForProfileFromHelper,
    matchesFactionVisibility,
    type QuestAvailabilityProfile,
} from "../../lib/utils/quest-availability";

export type FactionFilter = NonNullable<QuestAvailabilityProfile["faction"]>;
export type QuestSyncProfile = QuestAvailabilityProfile;
export { matchesFactionVisibility };

export interface SyncTraderProgressInput {
    quests: FullQuest[];
    traderId: string;
    selectedQuestIds: string[];
    inferOtherTraderChains?: boolean;
    profile: QuestSyncProfile;
    questsWithItems: Record<string, boolean>;
}

export interface QuestSyncResult {
    traderId: string;
    selectedQuestIds: string[];
    selectedCompletedIds: string[];
    prerequisiteCompletedIds: string[];
    inferredCompletedIds: string[];
    completedIds: string[];
    previousCompletedQuests: Record<string, boolean | undefined>;
    previousQuestsWithItems: Record<string, boolean | undefined>;
    nextCompletedQuests: Record<string, boolean>;
    nextQuestsWithItems: Record<string, boolean>;
}

export function isQuestAvailableForProfile(
    quest: FullQuest,
    profile: QuestSyncProfile,
    questsById: ReadonlyMap<string, FullQuest>,
) {
    return isQuestAvailableForProfileFromHelper(quest, profile, questsById);
}

export function getSyncCandidatesForTrader(quests: FullQuest[], traderId: string) {
    return quests.filter((quest) => quest.trader.id === traderId);
}

function getTransitivePrerequisiteIds(rootIds: string[], questsById: Map<string, FullQuest>) {
    const result = new Set<string>();
    const queue = [...rootIds];

    while (queue.length > 0) {
        const id = queue.pop()!;
        const quest = questsById.get(id);
        if (!quest) continue;

        for (const requirement of quest.taskRequirements) {
            const prerequisiteId = requirement.task.id;
            if (result.has(prerequisiteId)) continue;
            result.add(prerequisiteId);
            queue.push(prerequisiteId);
        }
    }

    return result;
}

export function syncTraderProgress({
    quests,
    traderId,
    selectedQuestIds,
    inferOtherTraderChains = true,
    profile,
    questsWithItems,
}: SyncTraderProgressInput): QuestSyncResult {
    const questAvailabilityById = buildQuestAvailabilityMap(quests);
    const nextCompletedQuests = { ...profile.completedQuests };
    const nextQuestsWithItems = { ...questsWithItems };
    const selectedQuestIdSet = new Set(selectedQuestIds);
    const activeTraderQuests = quests.filter((quest) => quest.trader.id === traderId);
    const completedAnchorIds = new Set<string>();
    const prerequisiteIds = getTransitivePrerequisiteIds(selectedQuestIds, new Map(quests.map((quest) => [quest.id, quest])));

    for (const questId of selectedQuestIdSet) {
        prerequisiteIds.delete(questId);
    }

    const selectedCompletedIds: string[] = [];
    const prerequisiteCompletedIds: string[] = [];
    const previousCompletedQuests: Record<string, boolean | undefined> = {};
    const previousQuestsWithItems: Record<string, boolean | undefined> = {};

    const recordCompletion = (questId: string, bucket: string[]) => {
        if (nextCompletedQuests[questId]) return false;

        if (!(questId in previousCompletedQuests)) {
            previousCompletedQuests[questId] = profile.completedQuests[questId];
            previousQuestsWithItems[questId] = questsWithItems[questId];
        }

        nextCompletedQuests[questId] = true;
        nextQuestsWithItems[questId] = false;
        bucket.push(questId);
        return true;
    };

    for (const prerequisiteId of prerequisiteIds) {
        completedAnchorIds.add(prerequisiteId);
        recordCompletion(prerequisiteId, prerequisiteCompletedIds);
    }

    const inferredCompletedIds: string[] = [];
    const syncProfile: QuestSyncProfile = {
        ...profile,
        completedQuests: nextCompletedQuests,
    };

    if (inferOtherTraderChains) {
        let madeProgress = true;
        while (madeProgress) {
            madeProgress = false;

            for (const quest of activeTraderQuests) {
                if (selectedQuestIdSet.has(quest.id)) continue;
                if (nextCompletedQuests[quest.id]) continue;
                if (!isQuestAvailableForProfile(quest, syncProfile, questAvailabilityById)) continue;
                if (!quest.taskRequirements.some((requirement) => completedAnchorIds.has(requirement.task.id))) continue;

                completedAnchorIds.add(quest.id);
                madeProgress = recordCompletion(quest.id, inferredCompletedIds) || madeProgress;
            }
        }
    }

    return {
        traderId,
        selectedQuestIds: [...selectedQuestIds],
        selectedCompletedIds,
        prerequisiteCompletedIds,
        inferredCompletedIds,
        completedIds: [...selectedCompletedIds, ...prerequisiteCompletedIds, ...inferredCompletedIds],
        previousCompletedQuests,
        previousQuestsWithItems,
        nextCompletedQuests,
        nextQuestsWithItems,
    };
}
