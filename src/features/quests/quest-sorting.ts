import type { FullQuest } from "@/types";

export type QuestSortMode = "default" | "level" | "xp" | "unlockImpact";

function compareByDefaultOrder(
    a: FullQuest,
    b: FullQuest,
    questOrderById: Map<string, number>,
) {
    return (
        (questOrderById.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (questOrderById.get(b.id) ?? Number.MAX_SAFE_INTEGER)
    );
}

function compareQuestsByRootOrder(
    a: FullQuest,
    b: FullQuest,
    questOrderById: Map<string, number>,
) {
    const levelDiff = (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0);
    if (levelDiff !== 0) return levelDiff;

    return compareByDefaultOrder(a, b, questOrderById);
}

function sortQuestsByChains(
    quests: FullQuest[],
    questOrderById: Map<string, number>,
) {
    const questsById = new Map(quests.map((quest) => [quest.id, quest]));
    const groupQuestIds = new Set(quests.map((quest) => quest.id));
    const childrenByQuestId = new Map<string, FullQuest[]>();
    const roots: FullQuest[] = [];

    for (const quest of quests) {
        const sameGroupPrereqs = quest.taskRequirements.filter((requirement) =>
            groupQuestIds.has(requirement.task.id),
        );

        if (sameGroupPrereqs.length === 0) {
            roots.push(quest);
            continue;
        }

        const primaryPrereq = sameGroupPrereqs.reduce((best, requirement) =>
            (questOrderById.get(requirement.task.id) ?? 0) >
            (questOrderById.get(best.task.id) ?? 0)
                ? requirement
                : best,
        );
        const parentQuest = questsById.get(primaryPrereq.task.id);

        if (!parentQuest) {
            roots.push(quest);
            continue;
        }

        const children = childrenByQuestId.get(parentQuest.id) ?? [];
        children.push(quest);
        childrenByQuestId.set(parentQuest.id, children);
    }

    for (const children of childrenByQuestId.values()) {
        children.sort((a, b) => compareQuestsByRootOrder(a, b, questOrderById));
    }

    roots.sort((a, b) => compareQuestsByRootOrder(a, b, questOrderById));

    const sorted: FullQuest[] = [];
    const visitedQuestIds = new Set<string>();

    const appendQuestAndChildren = (quest: FullQuest) => {
        if (visitedQuestIds.has(quest.id)) return;

        visitedQuestIds.add(quest.id);
        sorted.push(quest);

        for (const child of childrenByQuestId.get(quest.id) ?? []) {
            appendQuestAndChildren(child);
        }
    };

    for (const root of roots) {
        appendQuestAndChildren(root);
    }

    for (const quest of [...quests].sort((a, b) => compareQuestsByRootOrder(a, b, questOrderById))) {
        appendQuestAndChildren(quest);
    }

    return sorted;
}

export function buildQuestUnlockImpactMap(quests: FullQuest[]) {
    const childrenByQuestId = new Map<string, string[]>();

    for (const quest of quests) {
        for (const requirement of quest.taskRequirements) {
            const children = childrenByQuestId.get(requirement.task.id) ?? [];
            children.push(quest.id);
            childrenByQuestId.set(requirement.task.id, children);
        }
    }

    const impactByQuestId = new Map<string, number>();

    const collectDownstream = (questId: string) => {
        const downstream = new Set<string>();
        const stack = [...(childrenByQuestId.get(questId) ?? [])];

        while (stack.length > 0) {
            const childId = stack.pop();
            if (!childId || childId === questId || downstream.has(childId)) continue;

            downstream.add(childId);

            for (const grandchildId of childrenByQuestId.get(childId) ?? []) {
                if (grandchildId !== questId && !downstream.has(grandchildId)) {
                    stack.push(grandchildId);
                }
            }
        }

        return downstream.size;
    };

    for (const quest of quests) {
        impactByQuestId.set(quest.id, collectDownstream(quest.id));
    }

    return impactByQuestId;
}

export function sortQuestsForQuestView(
    quests: FullQuest[],
    sortMode: QuestSortMode,
    questOrderById: Map<string, number>,
    unlockImpactById: Map<string, number>,
) {
    if (sortMode === "default") {
        return sortQuestsByChains(quests, questOrderById);
    }

    return [...quests].sort((a, b) => {
        if (sortMode === "level") {
            const levelDiff = (a.minPlayerLevel ?? 0) - (b.minPlayerLevel ?? 0);
            if (levelDiff !== 0) return levelDiff;
        }

        if (sortMode === "xp") {
            const xpDiff = b.experience - a.experience;
            if (xpDiff !== 0) return xpDiff;
        }

        if (sortMode === "unlockImpact") {
            const impactDiff =
                (unlockImpactById.get(b.id) ?? 0) - (unlockImpactById.get(a.id) ?? 0);
            if (impactDiff !== 0) return impactDiff;
        }

        return compareByDefaultOrder(a, b, questOrderById);
    });
}
