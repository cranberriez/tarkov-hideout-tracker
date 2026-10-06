import type { StoryChapter, StoryCondition, StoryDecision, StoryEndingId, StoryStep } from "@/types/story";
import type { StoryProgress } from "./story-progress";
import { evaluateCondition, resolveDecisions } from "./story-model";

export interface StoryQuestRequirement {
	questId: string;
	chapterId: string;
	chapterName: string;
	stepId: string;
	endings: StoryEndingId[];
	conditions: StoryCondition[];
	note?: string;
}

/** Only explicitly reviewed requirements qualify, never incidental story quest links. */
export function buildStoryQuestRequirements(chapters: readonly StoryChapter[]) {
	return buildStoryQuestRelations(chapters, "requiredForEndings");
}

/** Failure notices are informational even when the player has selected another ending. */
export function buildStoryQuestFailures(chapters: readonly StoryChapter[]) {
	return buildStoryQuestRelations(chapters, "failsEndings");
}

function buildStoryQuestRelations(chapters: readonly StoryChapter[], field: "requiredForEndings" | "failsEndings") {
	const byQuest = new Map<string, StoryQuestRequirement[]>();
	for (const chapter of chapters) {
		const visit = (step: StoryStep, conditions: StoryCondition[]) => {
			const nextConditions = step.when ? [...conditions, step.when] : conditions;
			for (const quest of [...(step.quests ?? []), ...(step.warningQuest ? [step.warningQuest] : [])]) {
				const endings = quest[field];
				if (!endings?.length) continue;
				const entries = byQuest.get(quest.id) ?? [];
				entries.push({
					questId: quest.id,
					chapterId: chapter.id,
					chapterName: chapter.name,
					stepId: step.id,
					endings,
					conditions: nextConditions,
					note: quest.requirementNote,
				});
				byQuest.set(quest.id, entries);
			}
			for (const child of step.substeps ?? []) visit(child, nextConditions);
		};
		for (const section of chapter.sections) {
			for (const step of section.steps) visit(step, section.when ? [section.when] : []);
		}
	}
	return byQuest;
}

/** Unknown choices retain a conditional marker; a known inapplicable route removes it. */
export function questRequiresSelectedEnding(
	requirements: readonly StoryQuestRequirement[],
	progress: StoryProgress,
	decisions: readonly StoryDecision[],
) {
	if (!progress.targetEnding) return false;
	const resolved = resolveDecisions(decisions, progress.decisions, progress.targetEnding);
	return requirements.some(
		(requirement) =>
			requirement.endings.includes(progress.targetEnding!) &&
			requirement.conditions.every((condition) => evaluateCondition(condition, resolved) !== false),
	);
}
