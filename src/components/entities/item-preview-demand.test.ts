import test from "node:test";
import assert from "node:assert/strict";
import type { ItemRelationsPayload } from "@/types/contracts";
import type { FullQuest } from "@/types/quests";
import { toQuestAvailabilityQuest } from "../../lib/quests/quest-availability";
import { buildQuestAnyOfGroups, buildQuestItemIndex, type QuestItemDeriveOptions } from "../../lib/quests/quest-item-index";
import { deriveItemPreviewDemand } from "./item-preview-demand";

const options: Omit<QuestItemDeriveOptions, "quests"> = {
	completedQuests: {},
	ignoredQuests: {},
	pinnedQuests: {},
	playerLevel: 20,
	prestigeLevel: 0,
	faction: "USEC",
	traderLoyaltyLevels: {},
	fenceReputation: 0,
	visibilityMode: "allFuture",
};
const profile = { stationLevels: {}, completedRequirements: {}, itemCounts: { item: { have: 10, haveFir: 1 } } };
function relations(): ItemRelationsPayload {
	return {
		item: { id: "item", name: "Item", normalizedName: "item" },
		relatedItems: [],
		unresolvedItemIds: [],
		hideoutRequirements: [
			{
				station: { id: "station", name: "Station", normalizedName: "station" },
				stationMaxLevel: 3,
				level: 2,
				requirement: { id: "requirement", itemId: "item", count: 4, isFir: true, isTool: false },
			},
		],
		questItemIndex: [],
		questRewardIndex: [],
		questAnyOfGroups: [],
		questAvailabilityQuests: [],
		freshness: { itemsUpdatedAt: null, pricesUpdatedAt: null, stationsUpdatedAt: null, questsUpdatedAt: null },
		errors: { items: null, prices: null, stations: null, quests: null },
	};
}
function addQuest(data: ItemRelationsPayload, itemIds: string[]) {
	const quest: FullQuest = {
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
				id: "objective",
				type: "giveItem",
				description: "Hand in items",
				optional: false,
				count: 3,
				foundInRaid: true,
				itemIds,
			},
		],
	};
	data.questItemIndex = buildQuestItemIndex([quest]);
	data.questAnyOfGroups = buildQuestAnyOfGroups([quest]);
	data.questAvailabilityQuests = [toQuestAvailabilityQuest(quest)];
}

test("non-FiR stock cannot cover a FiR shortfall in combined quest/hideout demand", () => {
	const data = relations();
	addQuest(data, ["item"]);
	const needs = deriveItemPreviewDemand("item", data, profile, options)!;
	assert.equal(needs.totalRequiredCount, 7);
	assert.equal(needs.neededFir, 6);
	assert.equal(needs.neededTotal, 6);
});
test("built stations, completed requirements, and completed quests remove demand", () => {
	const data = relations();
	addQuest(data, ["item"]);
	const completedOptions = { ...options, completedQuests: { quest: true } };
	assert.equal(
		deriveItemPreviewDemand("item", data, { ...profile, stationLevels: { station: 2 } }, completedOptions)!
			.totalRequiredCount,
		0,
	);
	assert.equal(
		deriveItemPreviewDemand(
			"item",
			data,
			{ ...profile, completedRequirements: { requirement: true } },
			completedOptions,
		)!.totalRequiredCount,
		0,
	);
});
test("alternative objectives are flagged without reserving every alternative", () => {
	const data = relations();
	data.hideoutRequirements = [];
	addQuest(data, ["item", "alternative"]);
	const needs = deriveItemPreviewDemand("item", data, profile, options)!;
	assert.equal(needs.totalRequiredCount, 0);
	assert.equal(needs.hasAlternatives, true);
});
test("partial or missing relations cannot claim zero demand or coverage", () => {
	const data = relations();
	data.errors.quests = "Quest data unavailable";
	assert.equal(deriveItemPreviewDemand("item", data, profile, options), null);
	data.errors.quests = null;
	data.item = null;
	assert.equal(deriveItemPreviewDemand("item", data, profile, options), null);
});
