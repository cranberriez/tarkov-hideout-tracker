import { stationOrder } from "../../../lib/cfg/stationOrder";
import type { ItemRelationsPayload } from "@/types/contracts";
import type { ItemSummary } from "@/types/items";
import type { StationRequirementEntry } from "./ItemDetailHideoutRequirements";

export function mergeItemDetailItems(
    ...itemGroups: Array<readonly ItemSummary[] | null | undefined>
): Record<string, ItemSummary> {
    const itemsById: Record<string, ItemSummary> = {};
    for (const items of itemGroups) {
        for (const item of items ?? []) {
            itemsById[item.id] = item;
        }
    }
    return itemsById;
}

export function buildStationRequirements(
    relations: ItemRelationsPayload | null,
    stationLevels: Readonly<Record<string, number>>,
): Array<[string, StationRequirementEntry[]]> {
    if (!relations) return [];

    const grouped = new Map<string, StationRequirementEntry[]>();
    for (const relation of relations.hideoutRequirements) {
        const currentLevel = stationLevels[relation.station.id] ?? 0;
        const requirement: StationRequirementEntry = {
            stationName: relation.station.name,
            stationNormalizedName: relation.station.normalizedName,
            stationId: relation.station.id,
            stationImageLink: relation.station.imageLink,
            stationMaxLevel: relation.stationMaxLevel,
            level: relation.level,
            count: relation.requirement.count,
            isFir: relation.requirement.isFir,
            isCompleted: currentLevel >= relation.level,
            isStationMaxed: currentLevel >= relation.stationMaxLevel,
            requirementId: relation.requirement.id,
        };
        const requirements = grouped.get(relation.station.name) ?? [];
        requirements.push(requirement);
        grouped.set(relation.station.name, requirements);
    }

    const orderByName = new Map(
        stationOrder.map((name, index) => [name, index] as const),
    );
    return [...grouped.entries()].sort(([, requirementsA], [, requirementsB]) => {
        const requirementA = requirementsA[0];
        const requirementB = requirementsB[0];
        if (requirementA.isStationMaxed !== requirementB.isStationMaxed) {
            return requirementA.isStationMaxed ? 1 : -1;
        }
        return (
            (orderByName.get(requirementA.stationNormalizedName) ?? 999) -
            (orderByName.get(requirementB.stationNormalizedName) ?? 999)
        );
    });
}

export function hasCompleteItemRelations(payload: ItemRelationsPayload): boolean {
    return Object.values(payload.errors).every((error) => error === null);
}

export function getItemRelationsError(
    payload: ItemRelationsPayload | null,
    requestError: string | null,
): string | null {
    if (requestError) return requestError;
    const errors = payload ? Object.values(payload.errors).filter(Boolean) : [];
    return errors.length > 0 ? errors.join(" ") : null;
}
