import type { FullQuest, QuestMapLocation } from "@/types/quests";
import type { MapOverlayMarker } from "@/types/maps";
import { getQuestMapGroupKey } from "../quest-map-groups";

export interface QuestMarkerStyle {
    color: string;
}

function hashQuestId(value: string) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function createQuestMarkerStyles(quests: FullQuest[]) {
    const styles = new Map<string, QuestMarkerStyle>();
    quests.forEach((quest, index) => {
        const hash = hashQuestId(quest.id);
        styles.set(quest.id, {
            color: `hsl(${(hash % 360 + index * 137.508) % 360} 72% 58%)`,
        });
    });
    return styles;
}

function isLocationOnMap(location: QuestMapLocation, mapKey: string) {
    return getQuestMapGroupKey(location.map.normalizedName) === mapKey ||
        getQuestMapGroupKey(location.map.name) === mapKey;
}

export function buildRaidPlannerMarkers(
    quests: FullQuest[],
    mapKey: string,
    styles: ReadonlyMap<string, QuestMarkerStyle>,
    completedQuestObjectives: Readonly<Record<string, Readonly<Record<string, boolean>>>> = {},
) {
    const markers: MapOverlayMarker[] = [];
    for (const quest of quests) {
        const style = styles.get(quest.id);
        if (!style) continue;
        const markerByPosition = new Map<string, MapOverlayMarker>();
        for (const objective of quest.objectives) {
            if (completedQuestObjectives[quest.id]?.[objective.id]) continue;
            (objective.locations ?? []).forEach((location, locationIndex) => {
                if (!isLocationOnMap(location, mapKey) || !location.position) return;
                const positionKey = [location.position.x, location.position.y, location.position.z]
                    .map((coordinate) => coordinate.toFixed(2))
                    .join(":");
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
                        const alreadyIncluded = existing.outlines?.some(
                            (outline) => JSON.stringify(outline) === outlineKey,
                        );
                        if (!alreadyIncluded) existing.outlines?.push(location.outline);
                    }
                    return;
                }
                const marker: MapOverlayMarker = {
                    id: `${quest.id}:${positionKey}:${locationIndex}`,
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
                };
                markerByPosition.set(positionKey, marker);
            });
        }
        markers.push(...markerByPosition.values());
    }
    return markers;
}

export function questHasRenderedLocation(quest: FullQuest, mapKey: string) {
    return quest.objectives.some((objective) =>
        (objective.locations ?? []).some((location) =>
            !!location.position && isLocationOnMap(location, mapKey),
        ),
    );
}
