import type { FullQuest, QuestSummary } from "@/types/quests";

export function toQuestSummary(quest: FullQuest): QuestSummary {
	const maps = new Map(
		quest.objectives.flatMap((objective) => (objective.maps ?? []).map((map) => [JSON.stringify(map), map] as const)),
	);
	return {
		id: quest.id,
		name: quest.name,
		normalizedName: quest.normalizedName,
		removed: quest.removed,
		taskImageLink: quest.taskImageLink,
		minPlayerLevel: quest.minPlayerLevel,
		kappaRequired: quest.kappaRequired,
		lightkeeperRequired: quest.lightkeeperRequired,
		factionName: quest.factionName,
		experience: quest.experience,
		map: quest.map,
		trader: quest.trader,
		taskRequirements: quest.taskRequirements,
		failConditions: quest.failConditions,
		traderRequirements: quest.traderRequirements,
		otherRequirements: quest.otherRequirements,
		requiredPrestige: quest.requiredPrestige,
		objectiveTypes: [...new Set(quest.objectives.map((objective) => objective.type))],
		objectiveCount: quest.objectives.length,
		objectiveSearchText: quest.objectives.map((objective) => objective.description).join(" "),
		objectiveMaps: [...maps.values()],
		hasRequiredKeys: quest.objectives.some((objective) => !!objective.requiredKeyIds?.length),
		keyedObjectiveTypes: [
			...new Set(
				quest.objectives
					.filter((objective) => objective.requiredKeyIds?.some((group) => group.length))
					.map((objective) => objective.type),
			),
		],
	};
}
