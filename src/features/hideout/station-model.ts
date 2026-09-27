import { computeNeeds } from "../../lib/utils/item-needs";
import type { Station, StationLevel, StationLevelRequirement } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";

export type StationUpgradeStatus = "ready" | "missing" | "illegal";

const CURRENCY_NAMES = new Set(["roubles", "dollars", "euros"]);

export function isCurrencyItem(item: Pick<ItemSummary, "normalizedName"> | undefined) {
    return !!item && CURRENCY_NAMES.has(item.normalizedName);
}

export function findRequiredStation(stations: readonly Station[], requirement: StationLevelRequirement) {
    return stations.find((station) => station.normalizedName === requirement.station.normalizedName) ?? null;
}

/** Unknown stations do not block, matching the card's historical behavior. */
function unmetStationRequirement(
    stations: readonly Station[],
    stationLevels: Readonly<Record<string, number>>,
    requirements: readonly StationLevelRequirement[] | undefined,
) {
    return (requirements ?? []).some((requirement) => {
        const required = findRequiredStation(stations, requirement);
        return required ? (stationLevels[required.id] ?? 0) < requirement.level : false;
    });
}

/**
 * Whether the station's next level can be built from saved levels and inventory.
 * `illegal`: the current level's own prerequisites are no longer met.
 * Missing item summaries are unresolved and never satisfy a requirement.
 */
export function computeStationUpgradeStatus({
    station,
    stations,
    stationLevels,
    itemById,
    itemCounts,
    pooledFirByItem,
}: {
    station: Station;
    stations: readonly Station[];
    stationLevels: Readonly<Record<string, number>>;
    itemById: Readonly<Record<string, ItemSummary>>;
    itemCounts: Readonly<Record<string, { have: number; haveFir: number }>>;
    pooledFirByItem: Readonly<Record<string, number>>;
}): StationUpgradeStatus {
    const currentLevel = stationLevels[station.id] ?? 0;
    const currentLevelData = station.levels.find((level) => level.level === currentLevel);
    const nextLevelData = station.levels.find((level) => level.level === currentLevel + 1);

    if (currentLevelData && unmetStationRequirement(stations, stationLevels, currentLevelData.stationLevelRequirements)) {
        return "illegal";
    }
    if (!nextLevelData) return "missing";
    if (unmetStationRequirement(stations, stationLevels, nextLevelData.stationLevelRequirements)) return "missing";

    for (const requirement of nextLevelData.itemRequirements) {
        const item = itemById[requirement.itemId];
        if (!item) return "missing";
        if (isCurrencyItem(item)) continue;
        const owned = itemCounts[requirement.itemId] ?? { have: 0, haveFir: 0 };
        if (requirement.isFir) {
            if (owned.haveFir < requirement.count) return "missing";
            continue;
        }
        const firSurplus = Math.max(0, owned.haveFir - (pooledFirByItem[requirement.itemId] ?? 0));
        const needs = computeNeeds({
            totalRequired: requirement.count,
            requiredFir: 0,
            haveNonFir: owned.have + firSurplus,
            haveFir: 0,
        });
        if (needs.effectiveHave < requirement.count) return "missing";
    }
    return "ready";
}

/** Level shown first on a station page: the next upgrade, or the final level when maxed. */
export function defaultViewedLevel(station: Pick<Station, "levels">, currentLevel: number): number | null {
    const levels = station.levels.map((level) => level.level).sort((a, b) => a - b);
    if (levels.length === 0) return null;
    return levels.find((level) => level > currentLevel) ?? levels[levels.length - 1];
}

export interface StationDependent {
    station: Station;
    /** The dependent station's level that has the requirement. */
    level: number;
    /** Level of the viewed station that it requires. */
    requiresLevel: number;
}

/** Stations whose upgrades require `station`, ordered by the level they need. */
export function getStationDependents(stations: readonly Station[], station: Station): StationDependent[] {
    const dependents: StationDependent[] = [];
    for (const other of stations) {
        if (other.id === station.id) continue;
        for (const level of other.levels) {
            for (const requirement of level.stationLevelRequirements ?? []) {
                if (requirement.station.normalizedName !== station.normalizedName) continue;
                dependents.push({ station: other, level: level.level, requiresLevel: requirement.level });
            }
        }
    }
    return dependents.sort((a, b) => a.requiresLevel - b.requiresLevel || a.station.name.localeCompare(b.station.name) || a.level - b.level);
}

export function getStationLevel(station: Station, level: number | null): StationLevel | null {
    return level == null ? null : station.levels.find((entry) => entry.level === level) ?? null;
}
