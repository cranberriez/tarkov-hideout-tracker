import type { FullQuest, QuestMapLocation } from "@/types";
import type { MapOverlayMarker } from "@/features/maps/map-types";
import { getQuestMapGroupKey } from "../quest-map-groups";

export interface QuestMarkerStyle {
    color: string;
    label: string;
}

function getMarkerLabel(index: number) {
    if (index < 26) return String.fromCharCode(97 + index);
    if (index < 52) return String.fromCharCode(65 + index - 26);
    return `${String.fromCharCode(97 + ((index - 52) % 26))}${Math.floor((index - 52) / 26) + 1}`;
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
            label: getMarkerLabel(index),
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
    options: { includePossibleLocations?: boolean } = {},
) {
    const markers: MapOverlayMarker[] = [];
    for (const quest of quests) {
        const style = styles.get(quest.id);
        if (!style) continue;
        for (const objective of quest.objectives) {
            (objective.locations ?? []).forEach((location, locationIndex) => {
                if (!isLocationOnMap(location, mapKey) || !location.position) return;
                if (location.source === "possibleLocation" && !options.includePossibleLocations) return;
                markers.push({
                    id: `${quest.id}:${objective.id}:${location.source}:${locationIndex}`,
                    mapId: location.map.id,
                    kind: "quest",
                    position: location.position,
                    outline: location.outline,
                    label: style.label,
                    description: `${quest.name}: ${objective.description}`,
                    color: style.color,
                    questId: quest.id,
                    objectiveId: objective.id,
                });
            });
        }
    }
    return markers;
}

export function questHasRenderedLocation(quest: FullQuest, mapKey: string) {
    return quest.objectives.some((objective) =>
        (objective.locations ?? []).some((location) =>
            location.source === "zone" && !!location.position && isLocationOnMap(location, mapKey),
        ),
    );
}
