import { Station, ItemDetails } from "@/app/types";

export interface PooledItem {
    id: string;
    count: number;
    firCount: number; // Found In Raid count
    isTool: boolean; // If it's a tool (not consumed)
}

interface PoolingOptions {
    stations: Station[];
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
    showHidden: boolean;
    viewMode: "all" | "nextLevel";
}

export function poolItems({
    stations,
    stationLevels,
    hiddenStations,
    showHidden,
    viewMode,
}: PoolingOptions): PooledItem[] {
    const itemMap = new Map<string, PooledItem>();

    stations.forEach((station) => {
        // Skip hidden stations if filter is active
        if (!showHidden && hiddenStations[station.id]) {
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
                const quantity = req.count ?? req.quantity ?? 0;
                const existing = itemMap.get(req.item.id) ?? {
                    id: req.item.id,
                    count: 0,
                    firCount: 0,
                    isTool: false,
                };

                // Check attributes for special properties
                // NOTE: Tarkov.dev API attributes usage for FiR or Tool is verified here
                // Usually tools have type: "tool".
                // FiR might be an attribute or just implied by context (rare in hideout).
                // We'll check for an attribute named "is_found_in_raid" or similar if it appears,
                // but primarily we sum quantities.

                // Check for tool attribute
                const isTool = req.attributes.some((attr) => attr.type === "tool");

                // Check for Found in Raid attribute
                const isFir = req.attributes.some(
                    (attr) => attr.name === "found_in_raid" && attr.value === "true"
                );

                // For now we sum everything. If it is a tool, it's still "required".
                // If it's a tool, it might not be consumed, but you still need it.
                // The aggregation logic for tools is tricky: if you need a wrench for level 1 and level 2,
                // you only need 1 wrench total, not 2.
                // BUT, implementing "max needed at once" logic for tools is complex across stations.
                // For now, we will sum them as requested, but mark them.

                itemMap.set(req.item.id, {
                    ...existing,
                    count: existing.count + quantity,
                    firCount: existing.firCount + (isFir ? quantity : 0),
                    isTool: existing.isTool || isTool,
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
