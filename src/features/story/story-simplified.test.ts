import assert from "node:assert/strict";
import test from "node:test";
import { STORY_CHAPTERS, MAJOR_EVIDENCE, MINOR_EVIDENCE } from "../../lib/data/story";
import type { StoryStep } from "../../types/story";
import { chapterEvidence } from "./story-model";

test("every tracked chapter has explicit simplified copy without hiding choices, warnings or evidence", () => {
	for (const chapter of STORY_CHAPTERS) {
		const evidence = chapterEvidence(chapter, MAJOR_EVIDENCE, MINOR_EVIDENCE).byStep;
		function check(steps: StoryStep[], parentHidden = false) {
			for (const step of steps) {
				const label = `${chapter.id}/${step.id}`;
				assert.ok(step.simplified === false || (typeof step.simplified === "string" && step.simplified.trim()), label);
				const hidden = parentHidden || step.simplified === false;
				if (hidden) {
					assert.ok(!step.decision && !step.warning && !step.when && !evidence.has(step.id), label);
				}
				check(step.substeps ?? [], hidden);
			}
		}
		chapter.sections.forEach((section) => check(section.steps));
	}
});
