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

function collectBackfillQuestIds(
    rootQuestIds: Iterable<string>,
    questsById: ReadonlyMap<string, FullQuest>,
    {
        allowedSensitiveQuestIds,
        deniedSensitiveQuestIds,
        completedQuestIds,
    }: {
        allowedSensitiveQuestIds: ReadonlySet<string>;
        deniedSensitiveQuestIds: ReadonlySet<string>;
        completedQuestIds: ReadonlySet<string>;
    },
) {
    const questIds = new Set<string>();
    const blockedSensitiveQuestIds = new Set<string>();
    const queue = Array.from(rootQuestIds);

    while (queue.length > 0) {
        const questId = queue.pop()!;
        if (completedQuestIds.has(questId) || questIds.has(questId)) continue;

        if (getSensitiveBackfillQuest(questId) && !allowedSensitiveQuestIds.has(questId)) {
            if (deniedSensitiveQuestIds.has(questId)) {
                questIds.add(questId);
            } else {
                blockedSensitiveQuestIds.add(questId);
            }
            continue;
        }

        const quest = questsById.get(questId);
        if (!quest) continue;

        questIds.add(questId);
        for (const requirement of quest.taskRequirements) {
            queue.push(requirement.task.id);
        }
    }

    return { questIds, blockedSensitiveQuestIds };
}

function getCrossTraderBackfillIdsThatMakeQuestAvailable({
    quest,
    traderId,
    questsById,
    questAvailabilityById,
    syncProfile,
    nextCompletedQuests,
    allowedSensitiveQuestIds,
    deniedSensitiveQuestIds,
}: {
    quest: FullQuest;
    traderId: string;
    questsById: ReadonlyMap<string, FullQuest>;
    questAvailabilityById: ReadonlyMap<string, FullQuest>;
    syncProfile: QuestSyncProfile;
    nextCompletedQuests: Record<string, boolean>;
    allowedSensitiveQuestIds: ReadonlySet<string>;
    deniedSensitiveQuestIds: ReadonlySet<string>;
}) {
    const directCrossTraderPrerequisiteIds = quest.taskRequirements
        .map((requirement) => requirement.task.id)
        .filter((prerequisiteId) => {
            if (nextCompletedQuests[prerequisiteId]) return false;

            const prerequisiteQuest = questsById.get(prerequisiteId);
            return prerequisiteQuest ? prerequisiteQuest.trader.id !== traderId : false;
        });

    if (directCrossTraderPrerequisiteIds.length === 0) {
        return { questIds: null, blockedSensitiveQuestIds: new Set<string>() };
    }

    const completedQuestIds = new Set(
        Object.entries(nextCompletedQuests)
            .filter(([, isCompleted]) => isCompleted)
            .map(([questId]) => questId),
    );
    const backfillResult = collectBackfillQuestIds(directCrossTraderPrerequisiteIds, questsById, {
        allowedSensitiveQuestIds,
        deniedSensitiveQuestIds,
        completedQuestIds,
    });

    if (backfillResult.blockedSensitiveQuestIds.size > 0) {
        return {
            questIds: null,
            blockedSensitiveQuestIds: backfillResult.blockedSensitiveQuestIds,
        };
    }

    const candidateCompletedQuests = { ...nextCompletedQuests };
    for (const questId of backfillResult.questIds) {
        candidateCompletedQuests[questId] = true;
    }

    const candidateProfile: QuestSyncProfile = {
        ...syncProfile,
        completedQuests: candidateCompletedQuests,
    };

    if (!isQuestAvailableForProfile(quest, candidateProfile, questAvailabilityById)) {
        return { questIds: null, blockedSensitiveQuestIds: new Set<string>() };
    }

    return { questIds: backfillResult.questIds, blockedSensitiveQuestIds: new Set<string>() };
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
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const nextCompletedQuests = { ...profile.completedQuests };
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
                if (!quest.taskRequirements.some((requirement) => completedAnchorIds.has(requirement.task.id))) continue;

                const isAvailable = isQuestAvailableForProfile(
                    quest,
                    syncProfile,
                    questAvailabilityById,
                );
                const crossTraderBackfill = isAvailable
                    ? { questIds: null, blockedSensitiveQuestIds: new Set<string>() }
                    : getCrossTraderBackfillIdsThatMakeQuestAvailable({
                          quest,
                          traderId,
                          questsById,
                          questAvailabilityById,
                          syncProfile,
                          nextCompletedQuests,
                          allowedSensitiveQuestIds,
                          deniedSensitiveQuestIds,
                      });

                if (crossTraderBackfill.blockedSensitiveQuestIds.size > 0) {
                    for (const questId of crossTraderBackfill.blockedSensitiveQuestIds) {
                        blockedSensitiveQuestIds.add(questId);
                    }
                    continue;
                }
                if (!isAvailable && !crossTraderBackfill.questIds) continue;

                if (getSensitiveBackfillQuest(quest.id) && !allowedSensitiveQuestIds.has(quest.id)) {
                    if (deniedSensitiveQuestIds.has(quest.id)) {
                        recordCompletion(quest.id, inferredCompletedIds);
                        continue;
                    }

                    blockedSensitiveQuestIds.add(quest.id);
                    continue;
                }

                if (crossTraderBackfill.questIds) {
                    for (const questId of crossTraderBackfill.questIds) {
                        completedAnchorIds.add(questId);
                        madeProgress = recordCompletion(questId, inferredCompletedIds) || madeProgress;
                    }
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
