import type { FullQuest } from "../../types/types";
import {
    buildQuestAvailabilityMap,
    isQuestAvailableForProfile as isQuestAvailableForProfileFromHelper,
    matchesFactionVisibility,
    type QuestAvailabilityProfile,
} from "../../lib/utils/quest-availability";
import {
    collectTransitivePrerequisiteIds,
    getSensitiveBackfillQuest,
} from "../../lib/utils/sensitive-quest-backfill";
import {
    buildQuestFailureMap,
    getAutoFailedQuestIds,
    getMutuallyExclusiveQuestIds,
} from "../../lib/utils/quest-failures";

export type FactionFilter = NonNullable<QuestAvailabilityProfile["faction"]>;
export type QuestSyncProfile = QuestAvailabilityProfile;
export { matchesFactionVisibility };

export interface SyncTraderProgressInput {
    quests: FullQuest[];
    traderId: string;
    selectedQuestIds: string[];
    enableInference?: boolean;
    allowedSensitiveBackfillQuestIds?: string[];
    deniedSensitiveBackfillQuestIds?: string[];
    profile: QuestSyncProfile;
    questsWithItems: Record<string, boolean>;
}

export interface QuestSyncResult {
    traderId: string;
    selectedQuestIds: string[];
    selectedCompletedIds: string[];
    prerequisiteCompletedIds: string[];
    inferredCompletedIds: string[];
    skippedBranchingQuestIds: string[];
    autoFailedQuestIds: string[];
    blockedSensitiveQuestIds: string[];
    completedIds: string[];
    previousCompletedQuests: Record<string, boolean | undefined>;
    previousFailedQuests: Record<string, boolean | undefined>;
    previousQuestsWithItems: Record<string, boolean | undefined>;
    nextCompletedQuests: Record<string, boolean>;
    nextFailedQuests: Record<string, boolean>;
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



export function syncTraderProgress({
    quests,
    traderId,
    selectedQuestIds,
    enableInference = true,
    allowedSensitiveBackfillQuestIds = [],
    deniedSensitiveBackfillQuestIds = [],
    profile,
    questsWithItems,
}: SyncTraderProgressInput): QuestSyncResult {
    const questAvailabilityById = buildQuestAvailabilityMap(quests);
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const nextCompletedQuests = { ...profile.completedQuests };
    const nextFailedQuests = { ...(profile.failedQuests ?? {}) };
    const nextQuestsWithItems = { ...questsWithItems };
    const selectedQuestIdSet = new Set(selectedQuestIds);
    const activeTraderQuests = quests.filter((quest) => quest.trader.id === traderId);
    const completedAnchorIds = new Set<string>();
    const completedQuestIds = new Set(
        Object.entries(profile.completedQuests)
            .filter(([, isCompleted]) => isCompleted)
            .map(([questId]) => questId),
    );
    const traversalResult = collectTransitivePrerequisiteIds(
        selectedQuestIds,
        questsById,
        {
            allowedSensitiveQuestIds: new Set(allowedSensitiveBackfillQuestIds),
            deniedSensitiveQuestIds: new Set(deniedSensitiveBackfillQuestIds),
            completedQuestIds,
        },
    );
    const prerequisiteIds = traversalResult.prerequisiteIds;
    const allowedSensitiveQuestIds = new Set(allowedSensitiveBackfillQuestIds);
    const deniedSensitiveQuestIds = new Set(deniedSensitiveBackfillQuestIds);
    const blockedSensitiveQuestIds = new Set(traversalResult.blockedSensitiveQuestIds);

    for (const questId of selectedQuestIdSet) {
        prerequisiteIds.delete(questId);
    }

    const selectedCompletedIds: string[] = [];
    const prerequisiteCompletedIds: string[] = [];
    const previousCompletedQuests: Record<string, boolean | undefined> = {};
    const previousFailedQuests: Record<string, boolean | undefined> = {};
    const previousQuestsWithItems: Record<string, boolean | undefined> = {};

    const recordCompletion = (questId: string, bucket: string[]) => {
        if (nextCompletedQuests[questId]) return false;

        if (!(questId in previousCompletedQuests)) {
            previousCompletedQuests[questId] = profile.completedQuests[questId];
            previousFailedQuests[questId] = profile.failedQuests?.[questId];
            previousQuestsWithItems[questId] = questsWithItems[questId];
        }

        nextCompletedQuests[questId] = true;
        nextFailedQuests[questId] = false;
        nextQuestsWithItems[questId] = false;
        bucket.push(questId);
        return true;
    };

    for (const prerequisiteId of prerequisiteIds) {
        completedAnchorIds.add(prerequisiteId);
        recordCompletion(prerequisiteId, prerequisiteCompletedIds);
    }

    const inferredCompletedIds: string[] = [];
    const skippedBranchingQuestIds = new Set<string>();
    const syncProfile: QuestSyncProfile = {
        ...profile,
        completedQuests: nextCompletedQuests,
    };

    let madeProgress = enableInference;
    while (madeProgress) {
        madeProgress = false;

        for (const quest of activeTraderQuests) {
            if (selectedQuestIdSet.has(quest.id)) continue;
            if (nextCompletedQuests[quest.id]) continue;
            if (!quest.taskRequirements.some((requirement) => completedAnchorIds.has(requirement.task.id))) continue;
            if (!isQuestAvailableForProfile(quest, syncProfile, questAvailabilityById)) continue;
            if (getMutuallyExclusiveQuestIds(quest).length > 0) {
                skippedBranchingQuestIds.add(quest.id);
                continue;
            }

            if (getSensitiveBackfillQuest(quest.id) && !allowedSensitiveQuestIds.has(quest.id)) {
                if (deniedSensitiveQuestIds.has(quest.id)) {
                    recordCompletion(quest.id, inferredCompletedIds);
                    continue;
                }

                blockedSensitiveQuestIds.add(quest.id);
                continue;
            }

            completedAnchorIds.add(quest.id);
            madeProgress = recordCompletion(quest.id, inferredCompletedIds) || madeProgress;
        }
    }

    const completedIds = [...selectedCompletedIds, ...prerequisiteCompletedIds, ...inferredCompletedIds];
    const autoFailedQuestIds = getAutoFailedQuestIds(
        completedIds,
        buildQuestFailureMap(quests),
        profile.failedQuests ?? {},
    );

    for (const questId of autoFailedQuestIds) {
        if (!(questId in previousCompletedQuests)) {
            previousCompletedQuests[questId] = profile.completedQuests[questId];
            previousFailedQuests[questId] = profile.failedQuests?.[questId];
            previousQuestsWithItems[questId] = questsWithItems[questId];
        }

        nextCompletedQuests[questId] = false;
        nextFailedQuests[questId] = true;
        nextQuestsWithItems[questId] = false;
    }

    return {
        traderId,
        selectedQuestIds: [...selectedQuestIds],
        selectedCompletedIds,
        prerequisiteCompletedIds,
        inferredCompletedIds,
        skippedBranchingQuestIds: Array.from(skippedBranchingQuestIds).sort(
            (left, right) => left.localeCompare(right),
        ),
        autoFailedQuestIds,
        blockedSensitiveQuestIds: Array.from(blockedSensitiveQuestIds).sort(
            (left, right) => left.localeCompare(right),
        ),
        completedIds,
        previousCompletedQuests,
        previousFailedQuests,
        previousQuestsWithItems,
        nextCompletedQuests,
        nextFailedQuests,
        nextQuestsWithItems,
    };
}
