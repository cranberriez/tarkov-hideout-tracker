import assert from "node:assert/strict";
import test from "node:test";
import { STORY_CHAPTERS, STORY_DECISIONS, STORY_ENDINGS } from "../../lib/data/story";
import { buildStoryFailureConditions, groupStoryFailureConditions } from "./story-failure-conditions";
import { emptyStoryProgress } from "./story-progress";

const risks = (ending: Parameters<typeof buildStoryFailureConditions>[2]) =>
	buildStoryFailureConditions(STORY_CHAPTERS, STORY_DECISIONS, ending);

test("recorded safe choices pass risks; ending implications do not; wrong choices stay failed even when completed", () => {
	const progress = emptyStoryProgress();
	progress.targetEnding = "savior";
	const get = () =>
		buildStoryFailureConditions(STORY_CHAPTERS, STORY_DECISIONS, "savior", progress).find(
			(entry) => entry.id === "choice:ticket-kerman-offer:refuse",
		)!;
	assert.equal(get().status, "active");
	progress.decisions["ticket-kerman-offer"] = "accept";
	assert.equal(get().status, "passed");
	progress.completedSteps["the-ticket"] = ["contact-kerman"];
	progress.decisions["ticket-kerman-offer"] = "refuse";
	assert.equal(get().status, "failed");
});

test("completed parents settle nested risks, bypassed branches settle, and other profiles remain active", () => {
	const progress = emptyStoryProgress();
	progress.completedSteps["the-ticket"] = ["escape-tarkov"];
	progress.decisions["falling-skies-armored-case"] = "kept";
	const entries = buildStoryFailureConditions(STORY_CHAPTERS, STORY_DECISIONS, "savior", progress);
	assert.equal(entries.find((entry) => entry.href.endsWith("#step-terminal-evacuation"))?.status, "completed");
	assert.equal(entries.find((entry) => entry.href.endsWith("#step-lightkeeper-good-terms"))?.status, "inapplicable");
	assert.equal(risks("savior").find((entry) => entry.href.endsWith("#step-terminal-evacuation"))?.status, "active");
});

test("either required quest branch passes its risk, but completing the forbidden quest remains a failure", () => {
	const progress = emptyStoryProgress();
	const completed = { "6745cbee909d2013670a4a55": true };
	const get = (quests: Record<string, boolean>) =>
		buildStoryFailureConditions(STORY_CHAPTERS, STORY_DECISIONS, "savior", progress, quests);
	assert.equal(get(completed).find((entry) => entry.id === "objective:the-ticket:btr-standing")?.status, "passed");
	progress.completedSteps["the-ticket"] = ["btr-standing"];
	assert.equal(
		get({ ...completed, "67460662d0fbbc74ca0f7229": true }).find(
			(entry) => entry.id === "objective:the-ticket:btr-standing",
		)?.status,
		"failed",
	);
});

test("route failures precede objectives; completed cards and whole completed chapters move to the final group", () => {
	const progress = emptyStoryProgress();
	progress.completedSteps.tour = ["use-intercom"];
	progress.completedSteps["the-ticket"] = ["keep-fence-rep"];
	const groups = groupStoryFailureConditions(
		buildStoryFailureConditions(STORY_CHAPTERS, STORY_DECISIONS, "savior", progress),
	);
	assert.deepEqual(
		groups.map((group) => group.kind),
		["route", "objective", "resolved"],
	);
	assert.ok(groups[0].chapters.every((chapter) => chapter.entries.every((entry) => entry.kind === "route")));
	assert.ok(groups.slice(0, 2).every((group) => group.chapters.every((chapter) => chapter.chapterId !== "tour")));
	assert.ok(groups[2].chapters.some((chapter) => chapter.chapterId === "tour"));
	assert.ok(
		groups[2].chapters
			.find((chapter) => chapter.chapterId === "the-ticket")
			?.entries.some((entry) => entry.href.endsWith("#step-keep-fence-rep")),
	);
});

test("Savior includes cross-chapter choices, explicit quest failures and nested Terminal objectives", () => {
	const entries = risks("savior");
	assert.ok(entries.some((entry) => entry.id === "choice:boreas-btr-quests:choose-your-friends"));
	assert.ok(
		entries.some(
			(entry) => entry.kind === "route" && entry.quests.some((quest) => quest.name === "Choose Your Friends Wisely"),
		),
	);
	assert.ok(entries.some((entry) => entry.href.endsWith("#step-bring-alpha-1")));
	assert.ok(entries.some((entry) => entry.href.endsWith("#step-keep-fence-rep")));
	assert.ok(!entries.some((entry) => entry.href.endsWith("#step-prapor-pmc-kills")));
});

test("Survivor excludes inapplicable Kerman follow-up choices and retains conditional recovery/deadline risks", () => {
	const entries = risks("survivor");
	assert.ok(entries.some((entry) => entry.id === "choice:ticket-kerman-offer:accept"));
	assert.ok(!entries.some((entry) => entry.id.startsWith("choice:ticket-major-evidence:")));
	assert.ok(!entries.some((entry) => entry.id.startsWith("choice:ticket-kerman-evidence:")));
	assert.ok(!entries.some((entry) => entry.href.endsWith("#step-bring-alpha-1")));
	const deadline = entries.find((entry) => entry.href.endsWith("#step-prapor-pmc-kills"));
	assert.equal(deadline?.kind, "setback");
	assert.ok(deadline?.conditions.some((condition) => condition.includes("Kept it")));
	assert.ok(entries.some((entry) => entry.conditions.some((condition) => condition.includes("Gave it to Prapor"))));
});

test("Debtor and Fallen show their own wrong choices and omit Savior-only quest failures", () => {
	assert.ok(risks("debtor").some((entry) => entry.id === "choice:ticket-major-evidence:deliver-all"));
	assert.ok(risks("fallen").some((entry) => entry.id === "choice:ticket-kerman-evidence:agree"));
	for (const ending of ["debtor", "fallen"] as const) {
		assert.ok(
			!risks(ending).some((entry) => entry.quests.some((quest) => quest.name === "Choose Your Friends Wisely")),
		);
	}
});

test("every ending has unique risks with valid chapter and objective destinations", () => {
	for (const ending of STORY_ENDINGS) {
		const entries = risks(ending.id);
		assert.equal(new Set(entries.map((entry) => entry.id)).size, entries.length);
		for (const entry of entries) {
			const chapter = STORY_CHAPTERS.find((candidate) => candidate.id === entry.chapterId);
			assert.ok(chapter);
			if (entry.href.includes("#step-")) {
				const stepId = entry.href.split("#step-")[1];
				assert.ok(JSON.stringify(chapter.sections).includes(`"id":"${stepId}"`), entry.href);
			}
		}
	}
});
