import type { QuestMapLocation, QuestWorkspaceQuest } from "@/types/quests";
import { getQuestMapGroupKey, getQuestMapGroupsForQuest, type QuestMapGroup } from "../quest-map-groups";

export function getRaidPlannerMapKey(key: string) {
	const normalized = getQuestMapGroupKey(key);
	return normalized === "the-lab-dark" || normalized === "the-lab-(dark)" ? "the-lab" : normalized;
}

export function buildRaidPlannerMapGroups(maps: readonly QuestMapGroup[]) {
	const groups = new Map<string, QuestMapGroup>();
	for (const map of maps) {
		const key = getRaidPlannerMapKey(map.key);
		const existing = groups.get(key);
		groups.set(key, {
			key,
			name: key === "the-lab" ? "The Lab" : map.name,
			aliases: [...new Set([...(existing?.aliases ?? []), ...map.aliases])],
		});
	}
	return [...groups.values()];
}

export function isQuestOnRaidPlannerMap(quest: QuestWorkspaceQuest, mapKey: string) {
	return getQuestMapGroupsForQuest(quest).some((map) => getRaidPlannerMapKey(map.key) === getRaidPlannerMapKey(mapKey));
}

export function isLocationOnRaidPlannerMap(location: QuestMapLocation, mapKey: string) {
	return [location.map.normalizedName, location.map.name].some(
		(value) => getRaidPlannerMapKey(value) === getRaidPlannerMapKey(mapKey),
	);
}
