import type { FullQuest } from "@/types";

type CollectorQuestSource = Pick<FullQuest, "name" | "normalizedName" | "objectives">;

export function findCollectorQuest<T extends CollectorQuestSource>(quests: T[]): T | null {
    return (
        quests.find(
            (quest) =>
                quest.normalizedName.toLowerCase() === "collector" ||
                quest.name.toLowerCase() === "collector",
        ) ?? null
    );
}

export function getCollectorRequiredItemIds(quests: CollectorQuestSource[]): string[] {
    const collector = findCollectorQuest(quests);
    if (!collector) return [];

    const itemIds = new Set<string>();
    for (const objective of collector.objectives) {
        if (objective.type !== "giveItem" || !("itemIds" in objective)) continue;
        for (const itemId of objective.itemIds) {
            itemIds.add(itemId);
        }
    }

    return [...itemIds];
}
