import type { FullQuest, FullQuestObjective, QuestItem } from "@/types";
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

export interface RaidPlannerKillObjective {
    questId: string;
    questName: string;
    objectiveId: string;
    summary: string;
    fullDescription: string;
    optional: boolean;
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

export function shortenKillObjective(objective: FullQuestObjective) {
    const description = objective.description.trim().replace(/\s+/g, " ");
    const fallbackTarget = (
        "targetNames" in objective && objective.targetNames?.filter(Boolean).join(" / ")
    ) || ("target" in objective ? objective.target : "targets");
    const fallback = `Kill ${objective.count || 1} ${fallbackTarget}`;
    if (!description) return fallback;

    const shortened = description
        .replace(/^eliminate\s+/i, "")
        .replace(/^kill\s+/i, "")
        .replace(/\s+on (?:the map )?/gi, " · ")
        .replace(/\s+while (?:using|wearing)\s+/gi, " · ")
        .replace(/\s+from a distance of (?:more than|at least)\s+/gi, " · ")
        .replace(/\s+with\s+/gi, " · ")
        .replace(/\s*·\s*/g, " · ");

    return shortened.length > 110
        ? `${shortened.slice(0, 107).trimEnd()}…`
        : shortened;
}

export function buildRaidPlannerKillList(quests: FullQuest[]): RaidPlannerKillObjective[] {
    return quests.flatMap((quest) => quest.objectives
        .filter((objective) => objective.type === "shoot")
        .map((objective) => ({
            questId: quest.id,
            questName: quest.name,
            objectiveId: objective.id,
            summary: shortenKillObjective(objective),
            fullDescription: objective.description,
            optional: objective.optional,
        })));
}

export function buildRaidPlannerObjectiveKeyIndex(quests: FullQuest[]) {
    const result = new Map<string, QuestItem[]>();
    for (const quest of quests) {
        for (const objective of quest.objectives) {
            const keys = new Map<string, QuestItem>();
            for (const key of (objective.requiredKeys ?? []).flat()) {
                if (key?.id && key.name) keys.set(key.id, key);
            }
            if (keys.size > 0) result.set(objective.id, [...keys.values()]);
        }
    }
    return result;
}

export function getRaidPlannerMarkerKeys(
    objectiveIds: readonly string[] | undefined,
    keyIndex: ReadonlyMap<string, QuestItem[]>,
) {
    const keys = new Map<string, QuestItem>();
    for (const objectiveId of objectiveIds ?? []) {
        for (const key of keyIndex.get(objectiveId) ?? []) keys.set(key.id, key);
    }
    return [...keys.values()].sort((left, right) => left.name.localeCompare(right.name));
}
