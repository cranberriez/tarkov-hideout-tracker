import assert from "node:assert/strict";
import test from "node:test";
import { isEvidenceFound, majorEvidenceFound, STORY_EVIDENCE } from "./story-evidence";
import { emptyStoryProgress } from "./story-progress";

test("evidence totals use acquisition steps across chapters, excluding minor and unmatched items", () => {
	const progress = emptyStoryProgress();
	for (const entry of STORY_EVIDENCE) {
		if (!entry.item.chapterId || !entry.stepId) continue;
		(progress.completedSteps[entry.item.chapterId] ??= []).push(entry.stepId);
	}
	assert.equal(majorEvidenceFound(progress), 8);
	assert.equal(majorEvidenceFound(emptyStoryProgress()), 0);
	assert.equal(majorEvidenceFound(null), 0);
	for (const entry of STORY_EVIDENCE.filter((entry) => !entry.stepId)) {
		assert.equal(isEvidenceFound(entry, progress), false);
	}
	const first = STORY_EVIDENCE[0];
	const wrongChapter = { ...emptyStoryProgress(), completedSteps: { "the-ticket": [first.stepId!] } };
	assert.equal(isEvidenceFound(first, wrongChapter), false);
});
