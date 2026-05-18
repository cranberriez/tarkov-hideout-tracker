import type { QuestFailCondition, QuestFailConditionTaskStatus, QuestPrerequisite } from "@/types";

export interface QuestFailureSource {
    id: string;
    name?: string;
    taskRequirements: QuestPrerequisite[];
    failConditions?: QuestFailCondition[];
}

export type QuestFailureMap = Map<string, string[]>;

function normalizeStatus(status: string) {
    return status.trim().toLowerCase();
}

function isTaskStatusFailCondition(
    condition: QuestFailCondition,
): condition is QuestFailConditionTaskStatus {
    return condition.type === "taskStatus" && "status" in condition && "task" in condition;
}

export function statusIncludesComplete(statuses: readonly string[]) {
    return statuses.some((status) => {
        const normalized = normalizeStatus(status);
        return normalized === "complete" || normalized === "completed" || normalized === "success";
    });
}

export function statusIncludesFailed(statuses: readonly string[]) {
    return statuses.some((status) => normalizeStatus(status) === "failed");
}

export function questCanFail(quest: Pick<QuestFailureSource, "failConditions">) {
    return (quest.failConditions ?? []).length > 0;
}

export function hasGenericFailWarning(quest: Pick<QuestFailureSource, "failConditions">) {
    return (quest.failConditions ?? []).some((condition) => condition.type !== "taskStatus");
}

export function getFailedQuestRequirementIds(
    quest: Pick<QuestFailureSource, "taskRequirements">,
): string[] {
    return quest.taskRequirements
        .filter(
            (requirement) =>
                statusIncludesFailed(requirement.status) &&
                !statusIncludesComplete(requirement.status),
        )
        .map((requirement) => requirement.task.id);
}

export function isQuestDisabledByCompletedFailedRequirement(
    quest: Pick<QuestFailureSource, "taskRequirements">,
    completedQuests: Record<string, boolean>,
) {
    return getFailedQuestRequirementIds(quest).some((questId) => completedQuests[questId]);
}

export function buildQuestFailureMap<T extends QuestFailureSource>(quests: readonly T[]) {
    const map: QuestFailureMap = new Map();

    for (const quest of quests) {
        for (const condition of quest.failConditions ?? []) {
            if (!isTaskStatusFailCondition(condition)) continue;
            if (condition.optional) continue;
            if (!statusIncludesComplete(condition.status)) continue;

            const failedQuestIds = map.get(quest.id) ?? [];
            failedQuestIds.push(condition.task.id);
            map.set(quest.id, failedQuestIds);
        }
    }

    return map;
}

export function getAutoFailedQuestIds(
    completedQuestIds: readonly string[],
    failureMap: ReadonlyMap<string, readonly string[]>,
    failedQuests: Record<string, boolean>,
) {
    const result = new Set<string>();

    for (const completedQuestId of completedQuestIds) {
        for (const failedQuestId of failureMap.get(completedQuestId) ?? []) {
            if (completedQuestId === failedQuestId) continue;
            if (failedQuests[failedQuestId]) continue;
            result.add(failedQuestId);
        }
    }

    return Array.from(result);
}

export function getMutuallyExclusiveQuestIds(quest: Pick<QuestFailureSource, "failConditions">) {
    return (quest.failConditions ?? [])
        .filter((condition): condition is QuestFailConditionTaskStatus => {
            return (
                isTaskStatusFailCondition(condition) &&
                !condition.optional &&
                statusIncludesComplete(condition.status)
            );
        })
        .map((condition) => condition.task.id);
}
