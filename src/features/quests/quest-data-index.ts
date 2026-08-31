import { compareQuestTradersByOrder } from "../../lib/cfg/questTraderOrder";
import {
    buildMultipleChoiceQuestGroups,
    buildQuestFailureMap,
    type MultipleChoiceQuestGroups,
    type QuestFailureMap,
} from "../../lib/utils/quest-failures";
import {
    deriveQuestOrganization,
    QUEST_SERIES_MANIFEST,
    type QuestOrganizationResult,
    type QuestSeriesManifest,
} from "../../lib/utils/quest-organization";
import type { FullQuest } from "../../types";
import { buildQuestMapGroups, type QuestMapGroup } from "./quest-map-groups";
import { buildQuestUnlockImpactMap } from "./quest-sorting";

export interface QuestDataIndex {
    /** The original manifest array. Quest objects are never copied or hydrated. */
    quests: FullQuest[];
    questsById: Map<string, FullQuest>;
    questOrderById: Map<string, number>;
    prerequisiteIdsByQuestId: Map<string, string[]>;
    prerequisitesByQuestId: Map<string, FullQuest[]>;
    leadsToByQuestId: Map<string, string[]>;
    unlocksByQuestId: Map<string, FullQuest[]>;
    traders: FullQuest["trader"][];
    maps: QuestMapGroup[];
    organization: QuestOrganizationResult;
    unlockImpactById: Map<string, number>;
    failureMap: QuestFailureMap;
    multipleChoiceGroups: MultipleChoiceQuestGroups;
}

/**
 * Builds the stable, profile-independent quest lookups shared by quest views.
 * Every quest-valued lookup points at the canonical object from `quests`.
 */
export function buildQuestDataIndex(
    quests: FullQuest[],
    seriesManifest: QuestSeriesManifest = QUEST_SERIES_MANIFEST,
): QuestDataIndex {
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const questOrderById = new Map(quests.map((quest, index) => [quest.id, index]));
    const prerequisiteIdsByQuestId = new Map<string, string[]>();
    const prerequisitesByQuestId = new Map<string, FullQuest[]>();
    const leadsToByQuestId = new Map<string, string[]>();

    for (const quest of quests) {
        const prerequisiteIds = quest.taskRequirements.map((requirement) => requirement.task.id);
        prerequisiteIdsByQuestId.set(quest.id, prerequisiteIds);
        prerequisitesByQuestId.set(
            quest.id,
            prerequisiteIds.flatMap((questId) => questsById.get(questId) ?? []),
        );

        for (const prerequisiteId of prerequisiteIds) {
            const unlockIds = leadsToByQuestId.get(prerequisiteId) ?? [];
            if (!unlockIds.includes(quest.id)) unlockIds.push(quest.id);
            leadsToByQuestId.set(prerequisiteId, unlockIds);
        }
    }

    const unlocksByQuestId = new Map<string, FullQuest[]>();
    for (const quest of quests) {
        unlocksByQuestId.set(
            quest.id,
            (leadsToByQuestId.get(quest.id) ?? []).flatMap((questId) =>
                questsById.get(questId) ?? [],
            ),
        );
    }

    const tradersById = new Map<string, FullQuest["trader"]>();
    for (const quest of quests) {
        if (!tradersById.has(quest.trader.id)) tradersById.set(quest.trader.id, quest.trader);
    }

    return {
        quests,
        questsById,
        questOrderById,
        prerequisiteIdsByQuestId,
        prerequisitesByQuestId,
        leadsToByQuestId,
        unlocksByQuestId,
        traders: [...tradersById.values()].sort((left, right) =>
            compareQuestTradersByOrder(left.name, right.name),
        ),
        maps: buildQuestMapGroups(quests),
        organization: deriveQuestOrganization(quests, seriesManifest),
        unlockImpactById: buildQuestUnlockImpactMap(quests),
        failureMap: buildQuestFailureMap(quests),
        multipleChoiceGroups: buildMultipleChoiceQuestGroups(quests),
    };
}
