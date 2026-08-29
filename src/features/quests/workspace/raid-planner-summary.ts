import type { FullQuest, QuestItem } from "@/types";
import type { QuestObjectiveCategory, QuestWorkspaceStatusInfo } from "./quest-workspace-utils";
import { getQuestMapGroupsForQuest } from "../quest-map-groups";
import { getObjectiveCategory } from "./quest-workspace-utils";

const CATEGORY_ORDER: QuestObjectiveCategory[] = [
    "location",
    "plant",
    "use",
    "eliminate",
    "extract",
    "find",
    "hand-in",
    "build",
    "other",
];

export interface RaidPlannerObjectiveGroup {
    category: QuestObjectiveCategory;
    questCount: number;
    keyedQuestCount: number;
}

export interface RaidPlannerMapSummary {
    questCount: number;
    objectiveGroups: RaidPlannerObjectiveGroup[];
    requiredKeys: QuestItem[];
}

export function getActiveRaidPlannerQuests(
    quests: FullQuest[],
    statusByQuestId: ReadonlyMap<string, QuestWorkspaceStatusInfo>,
) {
    return quests.filter((quest) => statusByQuestId.get(quest.id)?.status === "active");
}

export function buildRaidPlannerMapSummary(quests: FullQuest[], mapKey: string): RaidPlannerMapSummary {
    const mapQuests = quests.filter((quest) =>
        getQuestMapGroupsForQuest(quest).some((map) => map.key === mapKey),
    );
    const questIdsByCategory = new Map<QuestObjectiveCategory, Set<string>>();
    const keyedQuestIdsByCategory = new Map<QuestObjectiveCategory, Set<string>>();
    const requiredKeys = new Map<string, QuestItem>();

    for (const quest of mapQuests) {
        for (const objective of quest.objectives) {
            const category = getObjectiveCategory(objective.type);
            const questIds = questIdsByCategory.get(category) ?? new Set<string>();
            questIds.add(quest.id);
            questIdsByCategory.set(category, questIds);

            const objectiveKeys = (objective.requiredKeys ?? []).flat();
            if (objectiveKeys.length > 0) {
                const keyedQuestIds = keyedQuestIdsByCategory.get(category) ?? new Set<string>();
                keyedQuestIds.add(quest.id);
                keyedQuestIdsByCategory.set(category, keyedQuestIds);
            }
            for (const key of objectiveKeys) {
                if (key?.id && key.name) requiredKeys.set(key.id, key);
            }
        }
    }

    return {
        questCount: mapQuests.length,
        objectiveGroups: CATEGORY_ORDER.flatMap((category) => {
            const questCount = questIdsByCategory.get(category)?.size ?? 0;
            return questCount > 0
                ? [{
                      category,
                      questCount,
                      keyedQuestCount: keyedQuestIdsByCategory.get(category)?.size ?? 0,
                  }]
                : [];
        }),
        requiredKeys: [...requiredKeys.values()].sort((left, right) => left.name.localeCompare(right.name)),
    };
}
