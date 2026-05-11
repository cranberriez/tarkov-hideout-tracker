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

export function poolQuestItems(quests: Quest[]): QuestPoolItem[] {
    const map = new Map<string, QuestPoolItem>();

    for (const quest of quests) {
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
    }

    return Array.from(map.values());
}
