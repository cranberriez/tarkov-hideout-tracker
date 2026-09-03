type QuestLike = {
    id: string;
    name: string;
    minPlayerLevel?: number | null;
    taskRequirements: { task: { id: string } }[];
};

/** Orders quests after prerequisites, then by player level and name. */
export function orderQuestsByPrerequisites<T extends QuestLike>(quests: T[]): T[] {
    const questMap = new Map(quests.map((quest) => [quest.id, quest]));
    const depthCache = new Map<string, number>();

    function getDepth(id: string, visiting: Set<string>): number {
        const cachedDepth = depthCache.get(id);
        if (cachedDepth !== undefined) return cachedDepth;
        if (visiting.has(id)) return 0;

        const quest = questMap.get(id);
        if (!quest || quest.taskRequirements.length === 0) {
            depthCache.set(id, 0);
            return 0;
        }

        visiting.add(id);
        let maxPrerequisiteDepth = -1;
        for (const requirement of quest.taskRequirements) {
            maxPrerequisiteDepth = Math.max(
                maxPrerequisiteDepth,
                getDepth(requirement.task.id, visiting),
            );
        }
        visiting.delete(id);

        const depth = maxPrerequisiteDepth + 1;
        depthCache.set(id, depth);
        return depth;
    }

    return [...quests].sort((left, right) => {
        const depthDifference =
            getDepth(left.id, new Set()) - getDepth(right.id, new Set());
        if (depthDifference !== 0) return depthDifference;

        const levelDifference =
            (left.minPlayerLevel ?? 0) - (right.minPlayerLevel ?? 0);
        return levelDifference !== 0
            ? levelDifference
            : left.name.localeCompare(right.name);
    });
}
