import type { StoryChapter, StoryDecision } from "@/types/story";
import { buildChapterView, type ChapterView, type StepView } from "./story-model";
import type { StoryProgress } from "./story-progress";

export function chapterCompletionState(view: ChapterView) {
	const relevant = new Set(view.sections.flatMap((section) => section.decisionIds));
	const collect = (step: StepView) => {
		if (step.step.decision) relevant.add(step.step.decision);
		step.substeps.forEach(collect);
	};
	view.sections.forEach((section) => section.steps.forEach(collect));
	const needsChoices = [...relevant].some((id) => !view.resolved[id]) || view.stats.pendingRequired > 0;
	const stepIds = view.sections.flatMap((section) =>
		section.steps.filter((step) => step.state === "active" && !step.step.optional).map((step) => step.step.id),
	);
	const complete = !needsChoices && stepIds.length > 0 && view.stats.requiredDone === stepIds.length;
	return { needsChoices, stepIds, complete, canComplete: !needsChoices && stepIds.length > 0 && !complete };
}

export interface ChapterCompletionUndo {
	chapterId: string;
	addedStepIds: string[];
	/** Prevent undo from overwriting subsequent edits to this chapter's steps. */
	completedAfter: string[];
}

export function completeStoryChapter(
	progress: StoryProgress,
	chapter: StoryChapter,
	decisions: readonly StoryDecision[],
): { progress: StoryProgress; undo: ChapterCompletionUndo | null } {
	const state = chapterCompletionState(buildChapterView(chapter, decisions, progress));
	if (!state.canComplete) return { progress, undo: null };
	const existing = progress.completedSteps[chapter.id] ?? [];
	const completed = new Set(existing);
	const addedStepIds = state.stepIds.filter((id) => !completed.has(id));
	const completedAfter = [...existing, ...addedStepIds];
	return {
		progress: { ...progress, completedSteps: { ...progress.completedSteps, [chapter.id]: completedAfter } },
		undo: { chapterId: chapter.id, addedStepIds, completedAfter },
	};
}

export function canUndoChapterCompletion(progress: StoryProgress, undo: ChapterCompletionUndo) {
	const current = progress.completedSteps[undo.chapterId] ?? [];
	return current.length === undo.completedAfter.length && undo.completedAfter.every((id) => current.includes(id));
}

export function undoChapterCompletion(progress: StoryProgress, undo: ChapterCompletionUndo): StoryProgress {
	if (!canUndoChapterCompletion(progress, undo)) return progress;
	const added = new Set(undo.addedStepIds);
	const remaining = (progress.completedSteps[undo.chapterId] ?? []).filter((id) => !added.has(id));
	const completedSteps = { ...progress.completedSteps };
	if (remaining.length) completedSteps[undo.chapterId] = remaining;
	else delete completedSteps[undo.chapterId];
	return { ...progress, completedSteps };
}
