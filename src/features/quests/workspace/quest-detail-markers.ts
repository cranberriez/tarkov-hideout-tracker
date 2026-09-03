import type { MapOverlayMarker } from "@/types/maps";
import type { FullQuest, FullQuestObjective, QuestMapLocation } from "@/types/quests";
import { getQuestMapGroup, getQuestMapGroupKey, type QuestMapGroup } from "../quest-map-groups";

export interface PositionedObjectiveMap extends QuestMapGroup {
    locationCount: number;
}

export interface ObjectiveMarkerStyle {
    color: string;
}

function isLocationOnMap(location: QuestMapLocation, mapKey: string) {
    return getQuestMapGroupKey(location.map.normalizedName) === mapKey ||
        getQuestMapGroupKey(location.map.name) === mapKey;
}

function getPositionedLocations(objective: FullQuestObjective) {
    return (objective.locations ?? []).filter(
        (location): location is QuestMapLocation & { position: NonNullable<QuestMapLocation["position"]> } =>
            !!location.position,
    );
}

function getPositionKey(location: QuestMapLocation & { position: NonNullable<QuestMapLocation["position"]> }) {
    return [location.position.x, location.position.y, location.position.z]
        .map((coordinate) => coordinate.toFixed(2))
        .join(":");
}

export function getPositionedObjectiveMaps(objective: FullQuestObjective): PositionedObjectiveMap[] {
    const groups = new Map<string, {
        group: PositionedObjectiveMap;
        positionKeys: Set<string>;
    }>();
    for (const location of getPositionedLocations(objective)) {
        const mapGroup = getQuestMapGroup(location.map);
        const positionKey = getPositionKey(location);
        const existing = groups.get(mapGroup.key);
        if (existing) {
            if (!existing.group.aliases.includes(location.map.normalizedName)) {
                existing.group.aliases.push(location.map.normalizedName);
            }
            if (existing.positionKeys.has(positionKey)) continue;
            existing.positionKeys.add(positionKey);
            existing.group.locationCount += 1;
            continue;
        }
        groups.set(mapGroup.key, {
            group: {
                ...mapGroup,
                locationCount: 1,
            },
            positionKeys: new Set([positionKey]),
        });
    }
    return [...groups.values()].map(({ group }) => group)
        .sort((left, right) => left.name.localeCompare(right.name));
}

export function getQuestDetailMaps(
    quest: FullQuest,
    completedObjectiveIds: ReadonlySet<string> = new Set(),
): PositionedObjectiveMap[] {
    const groups = new Map<string, {
        group: PositionedObjectiveMap;
        positionKeys: Set<string>;
    }>();
    for (const objective of quest.objectives) {
        if (completedObjectiveIds.has(objective.id)) continue;
        for (const location of getPositionedLocations(objective)) {
            const mapGroup = getQuestMapGroup(location.map);
            const positionKey = getPositionKey(location);
            const existing = groups.get(mapGroup.key);
            if (existing) {
                if (!existing.group.aliases.includes(location.map.normalizedName)) {
                    existing.group.aliases.push(location.map.normalizedName);
                }
                if (existing.positionKeys.has(positionKey)) continue;
                existing.positionKeys.add(positionKey);
                existing.group.locationCount += 1;
            } else {
                groups.set(mapGroup.key, {
                    group: { ...mapGroup, locationCount: 1 },
                    positionKeys: new Set([positionKey]),
                });
            }
        }
    }
    return [...groups.values()].map(({ group }) => group)
        .sort((left, right) => left.name.localeCompare(right.name));
}

export function createQuestDetailObjectiveStyles(quest: FullQuest) {
    const positionedObjectives = quest.objectives.filter(
        (objective) => getPositionedLocations(objective).length > 0,
    );
    const parents = new Map(positionedObjectives.map((objective) => [objective.id, objective.id]));
    const find = (objectiveId: string): string => {
        const parent = parents.get(objectiveId) ?? objectiveId;
        if (parent === objectiveId) return parent;
        const root = find(parent);
        parents.set(objectiveId, root);
        return root;
    };
    const union = (leftId: string, rightId: string) => {
        const leftRoot = find(leftId);
        const rightRoot = find(rightId);
        if (leftRoot !== rightRoot) parents.set(rightRoot, leftRoot);
    };
    const firstObjectiveByPosition = new Map<string, string>();

    for (const objective of positionedObjectives) {
        for (const location of getPositionedLocations(objective)) {
            const mapKey = getQuestMapGroup(location.map).key;
            const locationKey = `${mapKey}:${getPositionKey(location)}`;
            const firstObjectiveId = firstObjectiveByPosition.get(locationKey);
            if (firstObjectiveId) union(firstObjectiveId, objective.id);
            else firstObjectiveByPosition.set(locationKey, objective.id);
        }
    }

    const styleByRoot = new Map<string, ObjectiveMarkerStyle>();
    const styles = new Map<string, ObjectiveMarkerStyle>();
    for (const objective of positionedObjectives) {
        const root = find(objective.id);
        let style = styleByRoot.get(root);
        if (!style) {
            const index = styleByRoot.size;
            style = {
                color: `hsl(${(78 + index * 137.508) % 360} 72% 58%)`,
            };
            styleByRoot.set(root, style);
        }
        styles.set(objective.id, style);
    }
    return styles;
}

export function buildQuestDetailMarkers(
    quest: FullQuest,
    mapKey: string,
    styles = createQuestDetailObjectiveStyles(quest),
    completedObjectiveIds: ReadonlySet<string> = new Set(),
) {
    const markerByPosition = new Map<string, MapOverlayMarker>();
    for (const objective of quest.objectives) {
        if (completedObjectiveIds.has(objective.id)) continue;
        for (const [locationIndex, location] of (objective.locations ?? []).entries()) {
            if (!location.position || !isLocationOnMap(location, mapKey)) continue;
            const positionKey = getPositionKey({ ...location, position: location.position });
            const style = styles.get(objective.id);
            if (!style) continue;
            const existing = markerByPosition.get(positionKey);
            if (existing) {
                if (!existing.descriptions.includes(objective.description)) {
                    existing.descriptions.push(objective.description);
                }
                if (!existing.objectiveIds?.includes(objective.id)) {
                    existing.objectiveIds?.push(objective.id);
                }
                if (location.outline.length > 0) {
                    const outlineKey = JSON.stringify(location.outline);
                    if (!existing.outlines?.some((outline) => JSON.stringify(outline) === outlineKey)) {
                        existing.outlines?.push(location.outline);
                    }
                }
                continue;
            }
            markerByPosition.set(positionKey, {
                id: `${quest.id}:${mapKey}:${positionKey}:${locationIndex}`,
                mapId: location.map.id,
                kind: "quest",
                position: location.position,
                outlines: location.outline.length > 0 ? [location.outline] : [],
                label: objective.type,
                title: quest.name,
                descriptions: [objective.description],
                color: style.color,
                questId: quest.id,
                objectiveIds: [objective.id],
                objectiveType: objective.type,
            });
        }
    }
    return [...markerByPosition.values()];
}
