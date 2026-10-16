import type { FullQuest, FullQuestObjective, QuestMapLocation } from "@/types/quests";
import { getQuestMapGroup, type QuestMapGroup } from "../quest-map-groups";

export interface PositionedObjectiveMap extends QuestMapGroup {
	locationCount: number;
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
	const groups = new Map<
		string,
		{
			group: PositionedObjectiveMap;
			positionKeys: Set<string>;
		}
	>();
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
	return [...groups.values()].map(({ group }) => group).sort((left, right) => left.name.localeCompare(right.name));
}

export function getQuestDetailMaps(quest: FullQuest): PositionedObjectiveMap[] {
	const groups = new Map<
		string,
		{
			group: PositionedObjectiveMap;
			positionKeys: Set<string>;
		}
	>();
	for (const objective of quest.objectives) {
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
	return [...groups.values()].map(({ group }) => group).sort((left, right) => left.name.localeCompare(right.name));
}
