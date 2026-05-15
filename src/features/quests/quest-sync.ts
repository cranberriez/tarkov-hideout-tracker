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
    selectedVisibleQuestIds: string[];
    profile: QuestSyncProfile;
    questsWithItems: Record<string, boolean>;
}

export interface QuestSyncResult {
    traderId: string;
    selectedVisibleQuestIds: string[];
    prerequisiteCompletedIds: string[];
    autoCompletedIds: string[];
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

export function getVisibleSyncCandidatesForTrader(
    quests: FullQuest[],
    traderId: string,
    profile: QuestSyncProfile,
) {
    const questsById = buildQuestAvailabilityMap(quests);
    return quests.filter(
        (quest) => quest.trader.id === traderId && isQuestAvailableForProfile(quest, profile, questsById),
    );
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
    selectedVisibleQuestIds,
    profile,
    questsWithItems,
}: SyncTraderProgressInput): QuestSyncResult {
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const questAvailabilityById = buildQuestAvailabilityMap(quests);
    const nextCompletedQuests = { ...profile.completedQuests };
    const nextQuestsWithItems = { ...questsWithItems };
    const selectedVisibleSet = new Set(selectedVisibleQuestIds);
    const prerequisiteIds = getTransitivePrerequisiteIds(selectedVisibleQuestIds, questsById);

    for (const questId of selectedVisibleSet) {
        prerequisiteIds.delete(questId);
    }

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
        recordCompletion(prerequisiteId, prerequisiteCompletedIds);
    }

    const autoCompletedIds: string[] = [];
    const syncProfile: QuestSyncProfile = {
        ...profile,
        completedQuests: nextCompletedQuests,
    };

    let madeProgress = true;
    while (madeProgress) {
        madeProgress = false;

        for (const quest of quests) {
            if (quest.trader.id !== traderId) continue;
            if (selectedVisibleSet.has(quest.id)) continue;
            if (!isQuestAvailableForProfile(quest, syncProfile, questAvailabilityById)) continue;

            madeProgress = recordCompletion(quest.id, autoCompletedIds) || madeProgress;
        }
    }

    return {
        traderId,
        selectedVisibleQuestIds: [...selectedVisibleQuestIds],
        prerequisiteCompletedIds,
        autoCompletedIds,
        completedIds: [...prerequisiteCompletedIds, ...autoCompletedIds],
        previousCompletedQuests,
        previousQuestsWithItems,
        nextCompletedQuests,
        nextQuestsWithItems,
    };
}
