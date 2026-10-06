import type { FullQuest, FullQuestObjective, QuestWorkspaceQuest } from "@/types/quests";
import type { QuestObjectiveCategory, QuestWorkspaceStatusInfo } from "./quest-workspace-utils";
import { isQuestOnRaidPlannerMap } from "./raid-planner-maps";
import { getObjectiveCategory } from "./quest-workspace-utils";

const CATEGORY_ORDER: QuestObjectiveCategory[] = [
	"location",
	"plant",
	"use",
	"eliminate",
	"extract",
	"find",
	"hand-in",
	"build",
	"other",
];

export interface RaidPlannerObjectiveGroup {
	category: QuestObjectiveCategory;
	questCount: number;
	keyedQuestCount: number;
}

export interface RaidPlannerMapSummary {
	questCount: number;
	objectiveGroups: RaidPlannerObjectiveGroup[];
	requiredKeyIds: string[];
	keysDeferred: boolean;
}

export interface RaidPlannerKillObjective {
	questId: string;
	questName: string;
	objectiveId: string;
	summary: string;
	fullDescription: string;
	optional: boolean;
}

export function getActiveRaidPlannerQuests<T extends QuestWorkspaceQuest>(
	quests: T[],
	statusByQuestId: ReadonlyMap<string, QuestWorkspaceStatusInfo>,
) {
	return quests.filter((quest) => statusByQuestId.get(quest.id)?.status === "active");
}

export function buildRaidPlannerMapSummary(quests: QuestWorkspaceQuest[], mapKey: string): RaidPlannerMapSummary {
	const mapQuests = quests.filter((quest) => isQuestOnRaidPlannerMap(quest, mapKey));
	const questIdsByCategory = new Map<QuestObjectiveCategory, Set<string>>();
	const keyedQuestIdsByCategory = new Map<QuestObjectiveCategory, Set<string>>();
	const requiredKeyIds = new Set<string>();

	for (const quest of mapQuests) {
		const types = "objectives" in quest ? quest.objectives.map((objective) => objective.type) : quest.objectiveTypes;
		const keyedTypes = new Set(
			"objectives" in quest
				? quest.objectives
						.filter((objective) => objective.requiredKeyIds?.some((group) => group.length))
						.map((objective) => objective.type)
				: quest.keyedObjectiveTypes,
		);
		for (const type of types) {
			const category = getObjectiveCategory(type);
			const questIds = questIdsByCategory.get(category) ?? new Set<string>();
			questIds.add(quest.id);
			questIdsByCategory.set(category, questIds);

			if (keyedTypes.has(type)) {
				const keyedQuestIds = keyedQuestIdsByCategory.get(category) ?? new Set<string>();
				keyedQuestIds.add(quest.id);
				keyedQuestIdsByCategory.set(category, keyedQuestIds);
			}
		}
		if ("objectives" in quest)
			for (const objective of quest.objectives) {
				for (const id of (objective.requiredKeyIds ?? []).flat()) requiredKeyIds.add(id);
			}
	}

	return {
		questCount: mapQuests.length,
		keysDeferred: mapQuests.some((quest) => !("objectives" in quest)),
		objectiveGroups: CATEGORY_ORDER.flatMap((category) => {
			const questCount = questIdsByCategory.get(category)?.size ?? 0;
			return questCount > 0
				? [
						{
							category,
							questCount,
							keyedQuestCount: keyedQuestIdsByCategory.get(category)?.size ?? 0,
						},
					]
				: [];
		}),
		requiredKeyIds: [...requiredKeyIds].sort(),
	};
}

export function shortenKillObjective(objective: FullQuestObjective) {
	const description = objective.description.trim().replace(/\s+/g, " ");
	const fallbackTarget =
		("targetNames" in objective && objective.targetNames?.filter(Boolean).join(" / ")) ||
		("target" in objective ? objective.target : "targets");
	const fallback = `Kill ${objective.count || 1} ${fallbackTarget}`;
	if (!description) return fallback;

	const shortened = description
		.replace(/^eliminate\s+/i, "")
		.replace(/^kill\s+/i, "")
		.replace(/\s+on (?:the map )?/gi, " · ")
		.replace(/\s+while (?:using|wearing)\s+/gi, " · ")
		.replace(/\s+from a distance of (?:more than|at least)\s+/gi, " · ")
		.replace(/\s+with\s+/gi, " · ")
		.replace(/\s*·\s*/g, " · ");

	return shortened.length > 110 ? `${shortened.slice(0, 107).trimEnd()}…` : shortened;
}

export function buildRaidPlannerKillList(quests: FullQuest[]): RaidPlannerKillObjective[] {
	return quests.flatMap((quest) =>
		quest.objectives
			.filter((objective) => objective.type === "shoot")
			.map((objective) => ({
				questId: quest.id,
				questName: quest.name,
				objectiveId: objective.id,
				summary: shortenKillObjective(objective),
				fullDescription: objective.description,
				optional: objective.optional,
			})),
	);
}

export function buildRaidPlannerObjectiveKeyIndex(quests: FullQuest[]) {
	const result = new Map<string, string[]>();
	for (const quest of quests) {
		for (const objective of quest.objectives) {
			const keys = [...new Set((objective.requiredKeyIds ?? []).flat())];
			if (keys.length > 0) result.set(objective.id, keys);
		}
	}
	return result;
}

export function getRaidPlannerMarkerKeys(
	objectiveIds: readonly string[] | undefined,
	keyIndex: ReadonlyMap<string, string[]>,
) {
	const keys = new Set<string>();
	for (const objectiveId of objectiveIds ?? []) {
		for (const itemId of keyIndex.get(objectiveId) ?? []) keys.add(itemId);
	}
	return [...keys].sort();
}
