import test from "node:test";
import assert from "node:assert/strict";

import { summarizeItemDetailDemand } from "./item-detail-summary";
import { buildQuestAnyOfGroups, buildQuestItemIndex, deriveQuestItemState } from "../../../lib/quests/quest-item-index";
import { toQuestAvailabilityQuest } from "../../../lib/quests/quest-availability";
import type { FullQuest } from "@/types/quests";

test("summarizes incomplete hideout and quest quantities including FiR demand", () => {
	const summary = summarizeItemDetailDemand({
		stationRequirements: [
			[
				"Workbench",
				[
					{
						count: 2,
						isFir: false,
						isCompleted: false,
						requirementId: "remaining",
					},
					{
						count: 3,
						isFir: true,
						isCompleted: true,
						requirementId: "station-complete",
					},
					{
						count: 4,
						isFir: true,
						isCompleted: false,
						requirementId: "manually-complete",
					},
				],
			],
		],
		completedRequirements: { "manually-complete": true },
		questItemState: { requiredCount: 5, requiredFirCount: 5 },
	});

	assert.deepEqual(summary, {
		hideoutRequiredCount: 2,
		hideoutRequiredFirCount: 0,
		questRequiredCount: 5,
		questRequiredFirCount: 5,
		totalRequiredCount: 7,
		totalRequiredFirCount: 5,
	});
});

function questWithObjectives(includeSpecific: boolean): FullQuest {
	return {
		id: "quest",
		name: "Quest",
		normalizedName: "quest",
		experience: 100,
		trader: { id: "trader", name: "Trader", normalizedName: "trader" },
		taskRequirements: [],
		traderRequirements: [],
		otherRequirements: [],
		objectives: [
			{
				id: "group",
				type: "giveItem",
				description: "Hand in any alternative",
				optional: false,
				count: 10,
				foundInRaid: true,
				itemIds: ["item", "alternative"],
			},
			...(includeSpecific
				? [
						{
							id: "specific",
							type: "giveItem" as const,
							description: "Hand in this exact item",
							optional: false,
							count: 3,
							foundInRaid: true,
							itemIds: ["item"],
						},
					]
				: []),
		],
	};
}

for (const includeSpecific of [false, true])
	test(
		includeSpecific
			? "retains specific FiR demand when the same quest also accepts an alternative group"
			: "does not assign alternative group FiR demand to each eligible item",
		() => {
			const quest = questWithObjectives(includeSpecific);
			const entry = buildQuestItemIndex([quest]).find((entry) => entry.itemId === "item");
			assert.equal(buildQuestAnyOfGroups([quest]).length, 1);
			const summary = summarizeItemDetailDemand({
				stationRequirements: [],
				completedRequirements: {},
				questItemState: entry
					? deriveQuestItemState(entry, {
							completedQuests: {},
							ignoredQuests: {},
							pinnedQuests: {},
							playerLevel: 20,
							prestigeLevel: 0,
							faction: "USEC",
							traderLoyaltyLevels: {},
							fenceReputation: 0,
							visibilityMode: "allFuture",
							quests: [toQuestAvailabilityQuest(quest)],
						})
					: null,
			});

			assert.equal(summary.questRequiredCount, includeSpecific ? 3 : 0);
			assert.equal(summary.questRequiredFirCount, includeSpecific ? 3 : 0);
			assert.equal(summary.totalRequiredFirCount, includeSpecific ? 3 : 0);
		},
	);
