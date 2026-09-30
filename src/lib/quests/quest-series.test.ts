import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "@/types/quests";
import {
	applyQuestSeriesMetadata,
	getEssentialQuestSeriesMembership,
	isEssentialQuest,
	prepareQuestSeriesForGameMode,
} from "./quest-series";

const TO_THE_LIGHT_SERIES = [
	["custom-ttl-trust-but-verify", "To the Light - Trust but Verify"],
	["custom-ttl-false-call", "To the Light - False Call"],
	["custom-ttl-someone-called", "To the Light - Someone Called?"],
	["custom-ttl-clip-their-wings", "To the Light - Clip Their Wings"],
	["custom-ttl-fallen-bird", "To the Light - Fallen Bird"],
	["custom-ttl-dangerous-ambitions", "To the Light - Dangerous Ambitions"],
	["custom-ttl-bite-the-dust", "To the Light - Bite the Dust"],
	["custom-ttl-a-time-to-throw-stones", "To the Light - A Time to Throw Stones"],
	["custom-ttl-a-time-to-gather-stones", "To the Light - A Time to Gather Stones"],
	["custom-ttl-the-other-side", "To the Light - The Other Side"],
	["625d700cc48e6c62a440fab5", "To the Light - Getting Acquainted"],
] as const;

function makeQuest(id: string, name: string, traderName = "Mechanic", lightkeeperRequired = false): FullQuest {
	return {
		id,
		name,
		normalizedName: name.toLowerCase().replaceAll(" ", "-"),
		minPlayerLevel: 1,
		experience: 0,
		trader: {
			id: traderName.toLowerCase(),
			name: traderName,
			normalizedName: traderName.toLowerCase(),
		},
		taskRequirements: [],
		traderRequirements: [],
		otherRequirements: [],
		objectives: [],
		lightkeeperRequired,
	};
}

test("defines the full To the Light access line as one ordered essential series", () => {
	assert.deepEqual(
		TO_THE_LIGHT_SERIES.map(([questId]) => {
			const membership = getEssentialQuestSeriesMembership(questId);
			return [membership?.series.id, membership?.order, isEssentialQuest(questId)];
		}),
		TO_THE_LIGHT_SERIES.map((_, index) => ["to-the-light", index + 1, true]),
	);
});

test("keeps Good Times Part 2 in its reviewed Essential display series", () => {
	const expectedMembers = [
		"666314b4d7f171c4c20226c3",
		"666314b0acf8442f8b0531a1",
		"666314b2a9290f9e0806cca3",
		"666314bafd5ca9577902e03a",
	];

	assert.deepEqual(
		expectedMembers.map((questId) => {
			const membership = getEssentialQuestSeriesMembership(questId);
			return [membership?.series.id, membership?.order];
		}),
		expectedMembers.map((_, index) => ["the-good-times", index + 1]),
	);
});

test("keeps Lightkeeper and his prerequisite series in every mode that has him", () => {
	const quests = [
		makeQuest(...TO_THE_LIGHT_SERIES[0]),
		makeQuest("lightkeeper-task", "Information Source", "Lightkeeper"),
		makeQuest("ordinary-task", "Ordinary Quest", "Mechanic"),
	];

	assert.equal(prepareQuestSeriesForGameMode(quests, "pvp-season").length, 3);
	assert.equal(prepareQuestSeriesForGameMode(quests, "regular").length, 3);
});
