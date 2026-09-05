import type { CompletedItemsConversionData } from "@/types/contracts";

export interface CompletedItemConversion {
    itemId: string;
    itemName: string;
    total: number;
    totalFir: number;
}

export function buildCompletedItemConversions(
    stations: CompletedItemsConversionData["stations"],
    items: CompletedItemsConversionData["items"],
    stationLevels: Record<string, number>,
    completedRequirements: Record<string, boolean>,
) {
    const itemById = Object.fromEntries(items.map((item) => [item.id, item]));
    const conversions = new Map<string, CompletedItemConversion>();
    const convertedRequirementIds = new Set<string>();

    for (const station of stations) {
        const currentLevel = stationLevels[station.id] ?? 0;

        for (const level of station.levels) {
            if (currentLevel >= level.level) continue;

            for (const requirement of level.itemRequirements) {
                if (!completedRequirements[requirement.id] || requirement.count <= 0) continue;

                const existing = conversions.get(requirement.itemId) ?? {
                    itemId: requirement.itemId,
                    itemName: itemById[requirement.itemId]?.name ?? requirement.itemId,
                    total: 0,
                    totalFir: 0,
                };

                existing.total += requirement.count;
                if (requirement.isFir) existing.totalFir += requirement.count;
                conversions.set(requirement.itemId, existing);
                convertedRequirementIds.add(requirement.id);
            }
        }
    }

    return {
        conversions: Array.from(conversions.values()).sort((a, b) =>
            a.itemName.localeCompare(b.itemName),
        ),
        convertedRequirementIds,
    };
}

export function removeConvertedRequirements(
    completedRequirements: Record<string, boolean>,
    convertedRequirementIds: ReadonlySet<string>,
) {
    return Object.fromEntries(
        Object.entries(completedRequirements).filter(
            ([requirementId]) => !convertedRequirementIds.has(requirementId),
        ),
    );
}
