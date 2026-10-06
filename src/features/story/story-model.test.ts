import assert from "node:assert/strict";
import test from "node:test";
import { STORY_DECISIONS, STORY_ENDINGS } from "../../lib/data/story";
import { THE_TICKET } from "../../lib/data/story/the-ticket";
import { buildChapterView, reachableEndings, resolveDecisions } from "./story-model";
import {
	emptyStoryProgress,
	parseStoryProgress,
	serializeStoryProgress,
	setStoryStepDone,
	toggleStoryDecision,
} from "./story-progress";

test("stored progress keeps valid fields and unknown IDs, dropping only malformed values", () => {
	const progress = parseStoryProgress(
		JSON.stringify({
			version: 1,
			targetEnding: "nope",
			lightkeeperAccess: false,
			decisions: { "ticket-kerman-offer": "accept", broken: 3 },
			completedSteps: { "the-ticket": ["intel-center-1", "intel-center-1", 7, "removed-step"], other: "x" },
		}),
	);
	assert.deepEqual(progress, {
		targetEnding: null,
		lightkeeperAccess: false,
		decisions: { "ticket-kerman-offer": "accept" },
		completedSteps: { "the-ticket": ["intel-center-1", "removed-step"] },
	});
	assert.deepEqual(parseStoryProgress("{not json"), emptyStoryProgress());
	assert.deepEqual(parseStoryProgress(serializeStoryProgress(progress)), progress);
});

test("a target ending implies its decisions; choices outrank it and rule endings out", () => {
	const implied = resolveDecisions(STORY_DECISIONS, {}, "debtor");
	assert.equal(implied["ticket-kerman-offer"]?.optionId, "accept");
	assert.equal(implied["ticket-major-evidence"]?.optionId, "stop-after-two");
	assert.equal(implied["falling-skies-armored-case"], undefined);

	const chosen = toggleStoryDecision(emptyStoryProgress(), "ticket-kerman-offer", "refuse").decisions;
	const resolved = resolveDecisions(STORY_DECISIONS, chosen, "savior");
	assert.deepEqual(resolved["ticket-kerman-offer"], { optionId: "refuse", source: "chosen" });
	assert.deepEqual(resolved["ticket-kerman-evidence"], { optionId: null, source: "inapplicable" });
	assert.deepEqual(
		[
			...reachableEndings(
				STORY_DECISIONS,
				chosen,
				STORY_ENDINGS.map((ending) => ending.id),
			),
		],
		["survivor"],
	);
});

test("unresolved branches stay pending and out of the remaining count", () => {
	const view = buildChapterView(THE_TICKET, STORY_DECISIONS, emptyStoryProgress());
	const states = Object.fromEntries(view.sections.map((section) => [section.section.id, section.state]));
	assert.equal(states.opening, "active");
	assert.equal(states["recover-case"], "pending");
	assert.equal(states["savior-fence"], "pending");
	assert.ok(view.stats.pendingRequired > 0);

	const survivor = buildChapterView(THE_TICKET, STORY_DECISIONS, {
		...emptyStoryProgress(),
		targetEnding: "survivor",
		decisions: { "falling-skies-armored-case": "gave-prapor" },
	});
	const ids = survivor.sections.map((section) => section.section.id);
	assert.deepEqual(ids, ["opening", "recover-case", "unlock-case", "survivor-prapor", "terminal"]);
	assert.equal(survivor.stats.pendingRequired, 0);
	const survivorSteps = survivor.sections.find((section) => section.section.id === "survivor-prapor")!.steps;
	assert.ok(survivorSteps.some((view) => view.step.id === "cash-prapor-300m"));
	assert.ok(!survivorSteps.some((view) => view.step.id === "cash-prapor-500m"));
});

test("completing a step completes earlier required steps; clearing one clears later steps", () => {
	const order = [
		{ id: "a", autoComplete: true },
		{ id: "optional", autoComplete: false },
		{ id: "b", autoComplete: true },
		{ id: "c", autoComplete: true },
	];
	const done = setStoryStepDone(emptyStoryProgress(), "ch", order, "c", true);
	assert.deepEqual(new Set(done.completedSteps.ch), new Set(["a", "b", "c"]));

	const cleared = setStoryStepDone(done, "ch", order, "b", false);
	assert.deepEqual(cleared.completedSteps.ch, ["a"]);
	assert.deepEqual(setStoryStepDone(cleared, "ch", order, "a", false).completedSteps, {});

	const substep = setStoryStepDone(cleared, "ch", order, "sub", true);
	assert.deepEqual(new Set(substep.completedSteps.ch), new Set(["a", "sub"]));
});
