import type { FullQuest } from "../../types/types";

export interface SensitiveBackfillQuest {
    id: string;
    name: string;
    warning: string;
}

export interface PrerequisiteTraversalResult {
    prerequisiteIds: Set<string>;
    resolvedPrerequisiteIds: Set<string>;
    blockedSensitiveQuestIds: Set<string>;
}

export interface SensitiveBackfillDecisions {
    allowedQuestIds: string[];
    deniedQuestIds: string[];
}

export const NETWORK_PROVIDER_PART_1_ID = "625d6ff5ddc94657c21a1625";

export const SENSITIVE_BACKFILL_QUESTS: SensitiveBackfillQuest[] = [
    {
        id: NETWORK_PROVIDER_PART_1_ID,
        name: "Network Provider - Part 1",
        warning:
            "If you jumped to this quest from the story, deny auto-completion to prevent quests from completing you haven't finished. If you acquired it normally, hit allow.",
    },
];

const SENSITIVE_BACKFILL_QUESTS_BY_ID = new Map(
    SENSITIVE_BACKFILL_QUESTS.map((quest) => [quest.id, quest]),
);

export function getSensitiveBackfillQuest(questId: string) {
    return SENSITIVE_BACKFILL_QUESTS_BY_ID.get(questId) ?? null;
}

export function getSensitiveBackfillQuestName(
    questId: string,
    questsById?: ReadonlyMap<string, FullQuest>,
) {
    return questsById?.get(questId)?.name ?? getSensitiveBackfillQuest(questId)?.name ?? questId;
}

export function createEmptySensitiveBackfillDecisions(): SensitiveBackfillDecisions {
    return { allowedQuestIds: [], deniedQuestIds: [] };
}

export function allowSensitiveBackfillQuest(
    decisions: SensitiveBackfillDecisions,
    questId: string,
): SensitiveBackfillDecisions {
    return {
        allowedQuestIds: Array.from(new Set([...decisions.allowedQuestIds, questId])),
        deniedQuestIds: decisions.deniedQuestIds.filter((deniedQuestId) => deniedQuestId !== questId),
    };
}

export function denySensitiveBackfillQuest(
    decisions: SensitiveBackfillDecisions,
    questId: string,
): SensitiveBackfillDecisions {
    return {
        allowedQuestIds: decisions.allowedQuestIds.filter((allowedQuestId) => allowedQuestId !== questId),
        deniedQuestIds: Array.from(new Set([...decisions.deniedQuestIds, questId])),
    };
}

export function collectTransitivePrerequisiteIds(
    rootQuestIds: Iterable<string>,
    questsById: ReadonlyMap<string, FullQuest>,
    options: {
        allowedSensitiveQuestIds?: ReadonlySet<string>;
        deniedSensitiveQuestIds?: ReadonlySet<string>;
        completedQuestIds?: ReadonlySet<string>;
        resolvedQuestIds?: ReadonlySet<string>;
    } = {},
): PrerequisiteTraversalResult {
    const prerequisiteIds = new Set<string>();
    const resolvedPrerequisiteIds = new Set<string>();
    const blockedSensitiveQuestIds = new Set<string>();
    const queue = Array.from(rootQuestIds);

    while (queue.length > 0) {
        const currentQuestId = queue.pop()!;
        const quest = questsById.get(currentQuestId);
        if (!quest) {
            continue;
        }

        for (const requirement of quest.taskRequirements) {
            const prerequisiteId = requirement.task.id;
            if (
                options.resolvedQuestIds?.has(prerequisiteId) ||
                options.completedQuestIds?.has(prerequisiteId)
            ) {
                resolvedPrerequisiteIds.add(prerequisiteId);
                continue;
            }

            if (prerequisiteIds.has(prerequisiteId)) {
                continue;
            }

            if (
                getSensitiveBackfillQuest(prerequisiteId) &&
                !options.allowedSensitiveQuestIds?.has(prerequisiteId)
            ) {
                if (options.deniedSensitiveQuestIds?.has(prerequisiteId)) {
                    prerequisiteIds.add(prerequisiteId);
                    continue;
                }

                blockedSensitiveQuestIds.add(prerequisiteId);
                continue;
            }

            prerequisiteIds.add(prerequisiteId);
            queue.push(prerequisiteId);
        }
    }

    return { prerequisiteIds, resolvedPrerequisiteIds, blockedSensitiveQuestIds };
}
