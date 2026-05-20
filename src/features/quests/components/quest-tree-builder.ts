import type { FullQuest } from "@/types";

export interface TraderTreeMeta {
    rootIds: string[];
    childrenOf: Map<string, string[]>;
    parentOf: Map<string, string | null>;
}

function chooseLatestQuestId(questIds: string[], indexById: Map<string, number>): string {
    return questIds.reduce((best, id) =>
        (indexById.get(id) ?? 0) > (indexById.get(best) ?? 0) ? id : best,
    );
}

function collectBridgedSameTraderPrereqIds({
    quest,
    traderQuestIds,
    visibleQuestsById,
    visiting,
}: {
    quest: FullQuest;
    traderQuestIds: Set<string>;
    visibleQuestsById: Map<string, FullQuest>;
    visiting: Set<string>;
}): string[] {
    if (visiting.has(quest.id)) return [];

    const nextVisiting = new Set(visiting);
    nextVisiting.add(quest.id);
    const result: string[] = [];

    for (const requirement of quest.taskRequirements) {
        const prerequisiteId = requirement.task.id;
        if (traderQuestIds.has(prerequisiteId)) {
            result.push(prerequisiteId);
            continue;
        }

        const prerequisiteQuest = visibleQuestsById.get(prerequisiteId);
        if (!prerequisiteQuest) continue;

        result.push(
            ...collectBridgedSameTraderPrereqIds({
                quest: prerequisiteQuest,
                traderQuestIds,
                visibleQuestsById,
                visiting: nextVisiting,
            }),
        );
    }

    return result;
}

export function buildTraderTree(
    traderQuests: FullQuest[],
    visibleQuests: FullQuest[] = traderQuests,
): TraderTreeMeta {
    const indexById = new Map(visibleQuests.map((q, i) => [q.id, i]));
    const traderQuestIds = new Set(traderQuests.map((q) => q.id));
    const visibleQuestsById = new Map(visibleQuests.map((q) => [q.id, q]));
    const parentOf = new Map<string, string | null>();

    for (const quest of traderQuests) {
        const sameTraderPrereqIds = quest.taskRequirements
            .map((requirement) => requirement.task.id)
            .filter((id) => id !== quest.id && traderQuestIds.has(id));

        if (sameTraderPrereqIds.length > 0) {
            parentOf.set(quest.id, chooseLatestQuestId(sameTraderPrereqIds, indexById));
            continue;
        }

        const bridgedPrereqIds = collectBridgedSameTraderPrereqIds({
            quest,
            traderQuestIds,
            visibleQuestsById,
            visiting: new Set(),
        }).filter((id) => id !== quest.id);

        parentOf.set(
            quest.id,
            bridgedPrereqIds.length > 0
                ? chooseLatestQuestId([...new Set(bridgedPrereqIds)], indexById)
                : null,
        );
    }

    const childrenOf = new Map<string, string[]>();
    const rootIds: string[] = [];

    for (const [questId, parentId] of parentOf) {
        if (parentId === null) {
            rootIds.push(questId);
        } else {
            const arr = childrenOf.get(parentId) ?? [];
            arr.push(questId);
            childrenOf.set(parentId, arr);
        }
    }

    return { rootIds, childrenOf, parentOf };
}
