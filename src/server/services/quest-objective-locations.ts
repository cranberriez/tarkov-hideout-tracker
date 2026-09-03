import type { MapPoint3D } from "@/types/maps";
import type { QuestMap, QuestMapLocation } from "@/types/quests";

export interface RawQuestZoneLocation {
    map?: string;
    position?: unknown;
    outline?: unknown;
    top?: unknown;
    bottom?: unknown;
}

export interface RawQuestPossibleLocation {
    map?: string;
    positions?: unknown;
}

export interface RawQuestObjectiveGeometry {
    zones?: RawQuestZoneLocation[];
    possibleLocations?: RawQuestPossibleLocation[];
}

function toFiniteNumber(value: unknown) {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function toMapPoint3D(value: unknown): MapPoint3D | null {
    if (!value || typeof value !== "object") return null;
    const point = value as Record<string, unknown>;
    const x = toFiniteNumber(point.x);
    const y = toFiniteNumber(point.y);
    const z = toFiniteNumber(point.z);
    return x == null || y == null || z == null ? null : { x, y, z };
}

function toOptionalNumber(value: unknown) {
    return toFiniteNumber(value) ?? undefined;
}

/**
 * Keeps upstream geometry attached to its objective. Invalid points are omitted,
 * and no center/position is synthesized from an outline.
 */
export function normalizeQuestObjectiveLocations(
    objective: RawQuestObjectiveGeometry,
    resolveMap: (mapId: string | undefined) => QuestMap | null,
): QuestMapLocation[] {
    const locations: QuestMapLocation[] = [];

    for (const zone of objective.zones ?? []) {
        const map = resolveMap(zone.map);
        if (!map) continue;
        const position = toMapPoint3D(zone.position) ?? undefined;
        const outline = Array.isArray(zone.outline)
            ? zone.outline.map(toMapPoint3D).filter((point): point is MapPoint3D => point !== null)
            : [];
        locations.push({
            map,
            position,
            outline,
            top: toOptionalNumber(zone.top),
            bottom: toOptionalNumber(zone.bottom),
            source: "zone",
        });
    }

    for (const possibleLocation of objective.possibleLocations ?? []) {
        const map = resolveMap(possibleLocation.map);
        if (!map || !Array.isArray(possibleLocation.positions)) continue;
        for (const rawPosition of possibleLocation.positions) {
            const position = toMapPoint3D(rawPosition);
            if (!position) continue;
            locations.push({ map, position, outline: [], source: "possibleLocation" });
        }
    }

    return locations;
}
