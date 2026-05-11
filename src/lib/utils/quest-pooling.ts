import type { Quest } from "@/types";

export interface QuestPoolItem {
    id: string;
    name: string;
    normalizedName: string;
    iconLink?: string;
    gridImageLink?: string;
    count: number;
    firCount: number;
}

export interface PerQuestPool {
    questId: string;
    items: QuestPoolItem[];
}

export function poolQuestItemsPerQuest(quests: Quest[]): PerQuestPool[] {
    return quests.map((quest) => {
        const map = new Map<string, QuestPoolItem>();
        for (const objective of quest.objectives) {
            for (const item of objective.items) {
                const existing = map.get(item.id);
                if (existing) {
                    existing.count += objective.count;
                    if (objective.foundInRaid) existing.firCount += objective.count;
                } else {
                    map.set(item.id, {
                        id: item.id,
                        name: item.name,
                        normalizedName: item.normalizedName,
                        iconLink: item.iconLink,
                        gridImageLink: item.gridImageLink,
                        count: objective.count,
                        firCount: objective.foundInRaid ? objective.count : 0,
                    });
                }
            }
        }
        return { questId: quest.id, items: Array.from(map.values()) };
    });
}

export function mergePerQuestPools(
    perQuestPools: PerQuestPool[],
    completedQuests: Record<string, boolean>,
): QuestPoolItem[] {
    const map = new Map<string, QuestPoolItem>();
    for (const { questId, items } of perQuestPools) {
        if (completedQuests[questId]) continue;
        for (const item of items) {
            const existing = map.get(item.id);
            if (existing) {
                existing.count += item.count;
                existing.firCount += item.firCount;
            } else {
                map.set(item.id, { ...item });
            }
        }
    }
    return Array.from(map.values());
}

export function poolQuestItems(quests: Quest[]): QuestPoolItem[] {
    return mergePerQuestPools(poolQuestItemsPerQuest(quests), {});
}
