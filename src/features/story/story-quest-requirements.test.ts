import assert from "node:assert/strict";
import test from "node:test";
import { STORY_CHAPTERS, STORY_DECISIONS } from "../../lib/data/story";
import { emptyStoryProgress } from "./story-progress";
import { buildStoryQuestRequirements, questRequiresSelectedEnding } from "./story-quest-requirements";

const requirements = buildStoryQuestRequirements(STORY_CHAPTERS);
const priceIds = ["6744af0969a58fceba101fed", "6745cbee909d2013670a4a55"];

test("only reviewed requirements are indexed, with valid chapter and objective links", () => {
	assert.equal(requirements.size, 4);
	assert.equal(requirements.has("67460662d0fbbc74ca0f7229"), false); // Optional BTR choice.
	assert.equal(requirements.has("69ce1cfb298a6529b30d712b"), false); // Unlocked side quest.
	for (const entries of requirements.values()) {
		for (const entry of entries) {
			const chapter = STORY_CHAPTERS.find((chapter) => chapter.id === entry.chapterId)!;
			assert.ok(chapter.sections.some((section) => section.steps.some((step) => step.id === entry.stepId)));
			assert.equal(entry.chapterName, chapter.name);
		}
	}
});

test("both Price of Independence branches mark Savior only; no ending means no marker", () => {
	for (const id of priceIds) {
		const entries = requirements.get(id)!;
		for (const targetEnding of [null, "savior", "debtor", "survivor", "fallen"] as const) {
			assert.equal(
				questRequiresSelectedEnding(entries, { ...emptyStoryProgress(), targetEnding }, STORY_DECISIONS),
				targetEnding === "savior",
			);
		}
	}
});

test("conditional Lightkeeper requirements respect choices without changing informational mappings", () => {
	const entries = requirements.get("custom-ttl-trust-but-verify")!;
	for (const targetEnding of ["savior", "debtor", "survivor", "fallen"] as const) {
		const progress = { ...emptyStoryProgress(), targetEnding };
		assert.equal(questRequiresSelectedEnding(entries, progress, STORY_DECISIONS), true);
		assert.equal(
			questRequiresSelectedEnding(
				entries,
				{ ...progress, decisions: { "falling-skies-armored-case": "kept" } },
				STORY_DECISIONS,
			),
			false,
		);
		assert.equal(
			questRequiresSelectedEnding(
				entries,
				{ ...progress, decisions: { "falling-skies-armored-case": "gave-prapor" } },
				STORY_DECISIONS,
			),
			true,
		);
	}
	assert.equal(entries[0].endings.length, 4);
});

test("recorded choices override inferred ending choices", () => {
	assert.equal(
		questRequiresSelectedEnding(
			requirements.get(priceIds[0])!,
			{
				...emptyStoryProgress(),
				targetEnding: "savior",
				decisions: { "ticket-kerman-offer": "refuse" },
			},
			STORY_DECISIONS,
		),
		false,
	);
	const debtor = requirements.get("625d700cc48e6c62a440fab5")!;
	assert.equal(
		questRequiresSelectedEnding(debtor, { ...emptyStoryProgress(), targetEnding: "debtor" }, STORY_DECISIONS),
		true,
	);
	assert.equal(
		questRequiresSelectedEnding(debtor, { ...emptyStoryProgress(), targetEnding: "fallen" }, STORY_DECISIONS),
		false,
	);
});
