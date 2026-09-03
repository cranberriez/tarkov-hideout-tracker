import type { FullQuestObjective } from "@/types/quests";

export interface ObjectivePresentation {
    objective: FullQuestObjective;
    showItems: boolean;
}

function getRegularItemKey(objective: FullQuestObjective) {
    if (!("itemIds" in objective) || objective.itemIds.length === 0) return null;
    return [...objective.itemIds].sort().join(":");
}

function getQuestItemKey(objective: FullQuestObjective) {
    if ((objective.type !== "pickupQuestItem" && objective.type !== "findQuestItem") || !("questItem" in objective)) return null;
    return objective.questItem.id;
}

/**
 * Keeps acquisition objectives beside their matching hand-in/use objective while
 * avoiding duplicate item rows for the same regular or quest-specific item.
 */
export function buildObjectivePresentation(objectives: FullQuestObjective[]): ObjectivePresentation[] {
    const deferredFindByGiveIndex = new Map<number, number>();
    const deferredFindIndices = new Set<number>();

    objectives.forEach((objective, findIndex) => {
        if (objective.type !== "findItem") return;
        const itemKey = getRegularItemKey(objective);
        if (!itemKey) return;
        const giveIndex = objectives.findIndex((candidate, candidateIndex) =>
            candidateIndex > findIndex && candidate.type === "giveItem" && getRegularItemKey(candidate) === itemKey
        );
        if (giveIndex >= 0 && !deferredFindByGiveIndex.has(giveIndex)) {
            deferredFindByGiveIndex.set(giveIndex, findIndex);
            deferredFindIndices.add(findIndex);
        }
    });

    const questItemGroups = new Map<string, number[]>();
    objectives.forEach((objective, index) => {
        const itemKey = getQuestItemKey(objective);
        if (itemKey) questItemGroups.set(itemKey, [...(questItemGroups.get(itemKey) ?? []), index]);
    });
    const deferredQuestItemIndices = new Set([...questItemGroups.values()].flatMap((indices) => indices.slice(0, -1)));

    const result: ObjectivePresentation[] = [];
    objectives.forEach((objective, index) => {
        if (deferredFindIndices.has(index) || deferredQuestItemIndices.has(index)) return;

        const findIndex = deferredFindByGiveIndex.get(index);
        if (findIndex != null) result.push({ objective: objectives[findIndex], showItems: false });

        const questItemKey = getQuestItemKey(objective);
        const questItemGroup = questItemKey ? questItemGroups.get(questItemKey) ?? [] : [];
        if (questItemGroup.length > 1 && questItemGroup.at(-1) === index) {
            questItemGroup.slice(0, -1).forEach((groupIndex) => result.push({ objective: objectives[groupIndex], showItems: false }));
        }

        result.push({ objective, showItems: true });
    });
    return result;
}
