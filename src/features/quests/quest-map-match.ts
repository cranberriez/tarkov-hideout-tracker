import type { QuestMapLocation, QuestWorkspaceQuest } from "@/types/quests";
import { getQuestMapGroupKey, getQuestMapGroupsForQuest } from "./quest-map-groups";

/** A map's key with The Lab (Dark) folded into The Lab, which share one map. */
export function getCombinedMapKey(key: string) {
	const normalized = getQuestMapGroupKey(key);
	return normalized === "the-lab-dark" || normalized === "the-lab-(dark)" ? "the-lab" : normalized;
}

export function isQuestOnMap(quest: QuestWorkspaceQuest, mapKey: string) {
	return getQuestMapGroupsForQuest(quest).some((map) => getCombinedMapKey(map.key) === getCombinedMapKey(mapKey));
}

export function isObjectiveLocationOnMap(location: QuestMapLocation, mapKey: string) {
	return [location.map.normalizedName, location.map.name].some(
		(value) => getCombinedMapKey(value) === getCombinedMapKey(mapKey),
	);
}
