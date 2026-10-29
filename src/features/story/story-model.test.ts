import assert from "node:assert/strict";
import test from "node:test";
import { endingBlockers } from "./story-model";
import { MAJOR_EVIDENCE, MINOR_EVIDENCE, STORY_CHAPTERS, STORY_DECISIONS, STORY_ENDINGS } from "../../lib/data/story";
import { THE_TICKET } from "../../lib/data/story/the-ticket";
import {
	buildChapterView,
	chapterDecisionTargets,
	chapterEvidence,
	chapterStepGroups,
	endingRouteStats,
	reachableEndings,
	resolveDecisions,
} from "./story-model";
import {
	emptyStoryProgress,
	parseStoryProgress,
	serializeStoryProgress,
	setStoryStepDone,
	toggleStoryDecision,
} from "./story-progress";

test("ending summaries link remaining Lightkeeper requirements to route choices", () => {
	const progress = emptyStoryProgress();
	const pending = endingRouteStats(THE_TICKET, STORY_DECISIONS, progress, "savior");
	assert.equal(pending.lightkeeperRemaining, 0);
	assert.ok(pending.lightkeeperPending > 0);
	assert.deepEqual(pending.lightkeeperDecisionIds, ["falling-skies-armored-case"]);

	progress.decisions["falling-skies-armored-case"] = "kept";
	const savior = endingRouteStats(THE_TICKET, STORY_DECISIONS, progress, "savior");
	assert.equal(savior.lightkeeperRemaining, 0);
	assert.equal(savior.lightkeeperPending, 0);
	assert.deepEqual(savior.lightkeeperDecisionIds, []);
	const debtor = endingRouteStats(THE_TICKET, STORY_DECISIONS, progress, "debtor");
	assert.ok(debtor.lightkeeperRemaining > 0);
	assert.deepEqual(debtor.lightkeeperDecisionIds, ["ticket-major-evidence"]);

	progress.completedSteps[THE_TICKET.id] = THE_TICKET.sections.flatMap((section) =>
		section.steps.map((step) => step.id),
	);
	const complete = endingRouteStats(THE_TICKET, STORY_DECISIONS, progress, "debtor");
	assert.equal(complete.lightkeeperRemaining, 0);
	assert.equal(complete.lightkeeperPending, 0);
	assert.deepEqual(complete.lightkeeperDecisionIds, []);
});

test("ending blockers explain faded coins and ignore unknown or inapplicable choices", () => {
	const endings = STORY_ENDINGS.map((ending) => ending.id);
	assert.deepEqual(endingBlockers(STORY_DECISIONS, {}, endings), []);
	assert.deepEqual(endingBlockers(STORY_DECISIONS, { "ticket-kerman-offer": "unknown" }, endings), []);
	const accepted = endingBlockers(STORY_DECISIONS, { "ticket-kerman-offer": "accept" }, endings);
	assert.deepEqual(
		accepted.map(({ decision, option, endings }) => [decision.id, option.label, endings]),
		[["ticket-kerman-offer", "Accept", ["survivor"]]],
	);
	const choices = {
		"ticket-kerman-offer": "refuse",
		"ticket-kerman-evidence": "agree",
		"ticket-major-evidence": "deliver-all",
	};
	const blockers = endingBlockers(STORY_DECISIONS, choices, endings);
	assert.deepEqual(
		blockers.map(({ decision }) => decision.id),
		["ticket-kerman-offer"],
	);
	const ruledOut = new Set(blockers.flatMap((blocker) => blocker.endings));
	assert.deepEqual(
		endings.filter((ending) => !ruledOut.has(ending)),
		[...reachableEndings(STORY_DECISIONS, choices, endings)],
	);
});

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

test("Ticket case selector stays at the recovery position when its branch disappears", () => {
	for (const targetEnding of [null, ...STORY_ENDINGS.map((ending) => ending.id)]) {
		for (const option of [undefined, "kept", "gave-prapor"]) {
			const view = buildChapterView(THE_TICKET, STORY_DECISIONS, {
				...emptyStoryProgress(),
				targetEnding,
				decisions: option ? { "falling-skies-armored-case": option } : {},
			});
			const groups = chapterStepGroups(THE_TICKET, view);
			const selectors = groups.filter((group) => group.bars.includes("falling-skies-armored-case"));
			assert.equal(selectors.length, 1);
			assert.equal(selectors[0].sectionId, "recover-case");
			assert.equal(Boolean(selectors[0].view), option !== "kept");
		}
	}
});

test("decision jumps target visible inline choices and retained banners, excluding hidden objectives", () => {
	const view = buildChapterView(THE_TICKET, STORY_DECISIONS, {
		...emptyStoryProgress(),
		targetEnding: "survivor",
		decisions: { "falling-skies-armored-case": "kept" },
	});
	const targets = chapterDecisionTargets(chapterStepGroups(THE_TICKET, view));
	assert.equal(targets.get("ticket-kerman-offer"), "unlock-case");
	assert.equal(targets.get("falling-skies-armored-case"), null);
	assert.equal(targets.has("ticket-kerman-evidence"), false);
	assert.equal(targets.has("ticket-major-evidence"), false);
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

test("evidence placed in a tracked chapter matches one of its steps", () => {
	for (const chapter of STORY_CHAPTERS) {
		const { entries } = chapterEvidence(chapter, MAJOR_EVIDENCE, MINOR_EVIDENCE);
		const unmatched = entries.filter((entry) => entry.stepId === null).map((entry) => entry.item.name);
		assert.deepEqual(unmatched, [], chapter.id);
	}
	const unheard = chapterEvidence(
		STORY_CHAPTERS.find((chapter) => chapter.id === "the-unheard")!,
		MAJOR_EVIDENCE,
		MINOR_EVIDENCE,
	);
	assert.equal(unheard.byStep.get("catalyst-test-report"), "major");
	assert.equal(unheard.byStep.get("learn-fuel"), "minor");
});
