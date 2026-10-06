import assert from "node:assert/strict";
import test from "node:test";
import { STORY_DECISIONS } from "../../lib/data/story";
import { THE_TICKET } from "../../lib/data/story/the-ticket";
import { TOUR } from "../../lib/data/story/tour";
import { FALLING_SKIES } from "../../lib/data/story/falling-skies";
import { buildChapterView } from "./story-model";
import { emptyStoryProgress, parseStoryProgress, serializeStoryProgress } from "./story-progress";
import {
	canUndoChapterCompletion,
	chapterCompletionState,
	completeStoryChapter,
	undoChapterCompletion,
} from "./chapter-completion";

test("completion waits for unresolved branches and inline choices", () => {
	for (const chapter of [THE_TICKET, FALLING_SKIES]) {
		const progress = emptyStoryProgress();
		assert.equal(chapterCompletionState(buildChapterView(chapter, STORY_DECISIONS, progress)).needsChoices, true);
		assert.deepEqual(completeStoryChapter(progress, chapter, STORY_DECISIONS), { progress, undo: null });
	}
});

test("complete only the resolved visible required route, preserving prior and unrelated data; undo restores it", () => {
	const progress = {
		...emptyStoryProgress(),
		targetEnding: "survivor" as const,
		decisions: { "falling-skies-armored-case": "gave-prapor", unknown: "retained" },
		completedSteps: { "the-ticket": ["intel-center-1", "unknown-step", "cash-prapor-500m"], tour: ["saved"] },
	};
	const result = completeStoryChapter(progress, THE_TICKET, STORY_DECISIONS);
	assert.ok(result.undo);
	assert.ok(result.undo.addedStepIds.includes("cash-prapor-300m"));
	assert.ok(!result.undo.addedStepIds.includes("cash-prapor-500m"));
	const view = buildChapterView(THE_TICKET, STORY_DECISIONS, result.progress);
	assert.equal(chapterCompletionState(view).complete, true);
	assert.equal(view.stats.requiredDone, view.stats.requiredTotal);
	assert.deepEqual(result.progress.decisions, progress.decisions);
	assert.deepEqual(result.progress.completedSteps.tour, progress.completedSteps.tour);
	assert.deepEqual(parseStoryProgress(serializeStoryProgress(result.progress)), result.progress);
	assert.equal(completeStoryChapter(result.progress, THE_TICKET, STORY_DECISIONS).undo, null);
	assert.deepEqual(undoChapterCompletion(result.progress, result.undo), progress);
});

test("optional steps and sub-objectives are not bulk completed", () => {
	const chapter = {
		...TOUR,
		sections: [
			{
				id: "test",
				title: "Test",
				steps: [
					{ id: "required", text: "Required", substeps: [{ id: "sub", text: "Sub-objective" }] },
					{ id: "optional", text: "Optional", optional: true },
				],
			},
		],
	};
	const result = completeStoryChapter(emptyStoryProgress(), chapter, STORY_DECISIONS);
	assert.deepEqual(result.progress.completedSteps[chapter.id], ["required"]);
	assert.ok(result.undo);
	assert.deepEqual(undoChapterCompletion(result.progress, result.undo), emptyStoryProgress());
});

test("undo preserves later choices and other chapters, and refuses stale chapter progress", () => {
	const result = completeStoryChapter(emptyStoryProgress(), TOUR, STORY_DECISIONS);
	assert.ok(result.undo);
	const updated = {
		...result.progress,
		decisions: { new: "choice" },
		completedSteps: { ...result.progress.completedSteps, other: ["step"] },
	};
	const undone = undoChapterCompletion(updated, result.undo);
	assert.deepEqual(undone.decisions, updated.decisions);
	assert.deepEqual(undone.completedSteps, { other: ["step"] });
	const edited = { ...updated, completedSteps: { ...updated.completedSteps, tour: ["different"] } };
	assert.equal(canUndoChapterCompletion(edited, result.undo), false);
	assert.equal(undoChapterCompletion(edited, result.undo), edited);
});
