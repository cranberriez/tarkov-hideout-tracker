import type { QuestFailCondition, QuestFailConditionTaskStatus, QuestPrerequisite } from "@/types";

export interface QuestFailureSource {
    id: string;
    name?: string;
    taskRequirements: QuestPrerequisite[];
    failConditions?: QuestFailCondition[];
}

export type QuestFailureMap = Map<string, string[]>;
export type MultipleChoiceQuestGroups = Map<string, string[]>;

const customFailConditionText: Readonly<Record<string, string>> = {
    "673f5069fd98c4d6d89e7a4c": "Marking an Wheels on Customs fails the quest",
    "639c6674eb92d6238e058dea":
        "Killing Zryachiy will fail the quest losing access to it",
    "5f04539a29383318cb417b44": "KILLING SANITAR",
    "63a6c752d4153566a073285a":
        "By killing Zryachiy you will fail and lose access to this quest.",
    "6667196a74bbc3a671ef49f8":
        'Killing Scavs, Scav Raiders, Rogues, or Bosses will fail the quest. Killing any of them after finishing the quest but before selecting "Complete" will still fail the quest.',
    "6667323ff686168c451ad02c": "Killing any boss will fail the quest.",
};

const customMultipleChoiceQuestGroups: readonly (readonly string[])[] = [
    ["5edac34d0bb72a50635c2bfa", "5edab4b1218d181e29451435"],
];

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

export function statusIncludesActive(statuses: readonly string[]) {
    return statuses.some((status) => normalizeStatus(status) === "active");
}

export function statusRequiresCompletion(statuses: readonly string[]) {
    return (
        statusIncludesComplete(statuses) &&
        !statusIncludesActive(statuses) &&
        !statusIncludesFailed(statuses)
    );
}

export function questCanFail(quest: Pick<QuestFailureSource, "failConditions">) {
    return (quest.failConditions ?? []).length > 0;
}

export function hasGenericFailWarning(quest: Pick<QuestFailureSource, "failConditions">) {
    return (quest.failConditions ?? []).some((condition) => condition.type !== "taskStatus");
}

export function getQuestFailConditionText(condition: QuestFailCondition) {
    const providerDescription = condition.description.trim();

    if (providerDescription && providerDescription !== condition.id) return providerDescription;
    return customFailConditionText[condition.id] ?? (providerDescription || condition.type);
}

export function getQuestFailWarningText(
    quest: Pick<QuestFailureSource, "failConditions">,
) {
    const conditions = quest.failConditions ?? [];
    const customCondition = conditions.find(
        (condition) =>
            customFailConditionText[condition.id] &&
            condition.description.trim() === condition.id,
    );
    const condition = customCondition ?? conditions[0];

    return condition ? getQuestFailConditionText(condition) : null;
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

            const failedQuestIds = map.get(condition.task.id) ?? [];
            if (!failedQuestIds.includes(quest.id)) failedQuestIds.push(quest.id);
            map.set(condition.task.id, failedQuestIds);
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

/**
 * Finds data-driven quest choice groups, then adds explicitly known semantic choices that
 * the provider conditions cannot describe reciprocally. A derived group is only returned
 * when every quest has a
 * non-optional completion fail condition for every other quest in the group. One-way
 * failure conditions are deliberately excluded because they do not guarantee that only
 * one quest can be completed.
 */
export function buildMultipleChoiceQuestGroups<T extends QuestFailureSource>(
    quests: readonly T[],
): MultipleChoiceQuestGroups {
    const questIds = new Set(quests.map((quest) => quest.id));
    const failureTargetsByQuestId = new Map(
        quests.map((quest) => [
            quest.id,
            new Set(getMutuallyExclusiveQuestIds(quest).filter((id) => questIds.has(id))),
        ]),
    );
    const mutualNeighborsByQuestId = new Map<string, Set<string>>(
        quests.map((quest) => [quest.id, new Set<string>()]),
    );

    for (const quest of quests) {
        for (const targetId of failureTargetsByQuestId.get(quest.id) ?? []) {
            if (!failureTargetsByQuestId.get(targetId)?.has(quest.id)) continue;
            mutualNeighborsByQuestId.get(quest.id)?.add(targetId);
            mutualNeighborsByQuestId.get(targetId)?.add(quest.id);
        }
    }

    const groups: MultipleChoiceQuestGroups = new Map();
    const visited = new Set<string>();

    for (const quest of quests) {
        if (visited.has(quest.id)) continue;

        const component: string[] = [];
        const pending = [quest.id];
        visited.add(quest.id);

        while (pending.length > 0) {
            const currentId = pending.pop()!;
            component.push(currentId);
            for (const neighborId of mutualNeighborsByQuestId.get(currentId) ?? []) {
                if (visited.has(neighborId)) continue;
                visited.add(neighborId);
                pending.push(neighborId);
            }
        }

        if (component.length < 2) continue;
        const isCompleteChoiceGroup = component.every((questId) =>
            component.every(
                (otherId) =>
                    questId === otherId || mutualNeighborsByQuestId.get(questId)?.has(otherId),
            ),
        );
        if (!isCompleteChoiceGroup) continue;

        const groupIds = quests
            .map((candidate) => candidate.id)
            .filter((id) => component.includes(id));
        for (const questId of groupIds) groups.set(questId, groupIds);
    }

    for (const customGroup of customMultipleChoiceQuestGroups) {
        const groupIds = customGroup.filter((id) => questIds.has(id));
        if (groupIds.length !== customGroup.length) continue;
        for (const questId of groupIds) groups.set(questId, [...groupIds]);
    }

    return groups;
}
