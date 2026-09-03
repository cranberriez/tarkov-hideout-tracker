import type { Station } from "@/types/hideout";

export interface PooledItem {
    id: string;
    count: number;
    firCount: number;
    isTool: boolean;
    isHideout: boolean;
    isQuest: boolean;
}

interface PoolingOptions {
    stations: Station[];
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
    showHidden: boolean;
    viewMode: "all" | "nextLevel";
    completedRequirements: Record<string, boolean>;
}

export function poolItems({
    stations,
    stationLevels,
    hiddenStations,
    showHidden,
    viewMode,
    completedRequirements,
}: PoolingOptions): PooledItem[] {
    const itemMap = new Map<string, PooledItem>();

    stations.forEach((station) => {
        const isHidden = !!hiddenStations[station.id] || !!hiddenStations[station.normalizedName];

        // Skip hidden stations if filter is active
        if (!showHidden && isHidden) {
            return;
        }

        const currentLevel = stationLevels[station.id] ?? 0;

        // Determine target levels based on view mode
        const targetLevels = station.levels.filter((levelData) => {
            if (viewMode === "nextLevel") {
                return levelData.level === currentLevel + 1;
            } else {
                // "all" - return all future levels
                return levelData.level > currentLevel;
            }
        });

        targetLevels.forEach((levelData) => {
            levelData.itemRequirements.forEach((req) => {
                // Skip requirements the user has manually marked as completed
                if (completedRequirements[req.id]) {
                    return;
                }
                const existing = itemMap.get(req.itemId) ?? {
                    id: req.itemId,
                    count: 0,
                    firCount: 0,
                    isTool: false,
                    isHideout: true,
                    isQuest: false,
                };

                // For now we sum everything. If it is a tool, it's still "required".
                // If it's a tool, it might not be consumed, but you still need it.
                // The aggregation logic for tools is tricky: if you need a wrench for level 1 and level 2,
                // you only need 1 wrench total, not 2.
                // BUT, implementing "max needed at once" logic for tools is complex across stations.
                // For now, we will sum them as requested, but mark them.

                itemMap.set(req.itemId, {
                    ...existing,
                    count: existing.count + req.count,
                    firCount: existing.firCount + (req.isFir ? req.count : 0),
                    isTool: existing.isTool || req.isTool,
                });
            });
        });
    });

    const result: PooledItem[] = [];
    itemMap.forEach((val) => {
        result.push(val);
    });

    return result;
}
