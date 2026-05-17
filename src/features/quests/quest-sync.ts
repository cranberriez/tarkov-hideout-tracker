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

export type FactionFilter = NonNullable<QuestAvailabilityProfile["faction"]>;
export type QuestSyncProfile = QuestAvailabilityProfile;
export { matchesFactionVisibility };

export interface SyncTraderProgressInput {
    quests: FullQuest[];
    traderId: string;
    selectedQuestIds: string[];
    inferOtherTraderChains?: boolean;
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
    blockedSensitiveQuestIds: string[];
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

export function syncTraderProgress({
    quests,
    traderId,
    selectedQuestIds,
    inferOtherTraderChains = true,
    allowedSensitiveBackfillQuestIds = [],
    deniedSensitiveBackfillQuestIds = [],
    profile,
    questsWithItems,
}: SyncTraderProgressInput): QuestSyncResult {
    const questAvailabilityById = buildQuestAvailabilityMap(quests);
    const nextCompletedQuests = { ...profile.completedQuests };
    const nextQuestsWithItems = { ...questsWithItems };
    const selectedQuestIdSet = new Set(selectedQuestIds);
    const activeTraderQuests = quests.filter((quest) => quest.trader.id === traderId);
    const completedAnchorIds = new Set<string>();
    const traversalResult = collectTransitivePrerequisiteIds(
        selectedQuestIds,
        new Map(quests.map((quest) => [quest.id, quest])),
        {
            allowedSensitiveQuestIds: new Set(allowedSensitiveBackfillQuestIds),
            deniedSensitiveQuestIds: new Set(deniedSensitiveBackfillQuestIds),
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
    }

    return {
        traderId,
        selectedQuestIds: [...selectedQuestIds],
        selectedCompletedIds,
        prerequisiteCompletedIds,
        inferredCompletedIds,
        blockedSensitiveQuestIds: Array.from(blockedSensitiveQuestIds).sort(
            (left, right) => left.localeCompare(right),
        ),
        completedIds: [...selectedCompletedIds, ...prerequisiteCompletedIds, ...inferredCompletedIds],
        previousCompletedQuests,
        previousQuestsWithItems,
        nextCompletedQuests,
        nextQuestsWithItems,
    };
}
