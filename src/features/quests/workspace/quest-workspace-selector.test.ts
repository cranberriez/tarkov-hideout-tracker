import assert from "node:assert/strict";
import test from "node:test";

import type { FullQuest } from "../../../types";
import type { QuestWorkspaceLockedFilterSettings } from "../../../lib/stores/useUserStore";
import { selectWorkspaceQuests, type QuestProfileSnapshot } from "./quest-workspace-selector";
import type { QuestWorkspaceSelectionOptions } from "./quest-workspace-selector";

const trader = { id: "trader", name: "Trader", normalizedName: "trader" };

function makeQuest(id: string, name: string): FullQuest {
	return {
		id,
		name,
		normalizedName: id,
		experience: 0,
		trader,
		taskRequirements: [],
		traderRequirements: [],
		otherRequirements: [],
		objectives: [],
	};
}

const profile: QuestProfileSnapshot = {
	playerLevel: 50,
	prestigeLevel: 0,
	faction: "USEC",
	traderLoyaltyLevels: {},
	fenceReputation: 0,
	completedQuests: {},
	failedQuests: {},
};

const lockedFilters: QuestWorkspaceLockedFilterSettings = {
	showAll: false,
	showPlayerLevel: false,
	playerLevelUpcomingOnly: true,
	playerLevelLookahead: 5,
	showTaskCount: true,
	taskCountUpcomingOnly: true,
	showPrerequisite: true,
	prerequisiteUpcomingOnly: true,
	prerequisiteLookahead: 1,
	showFaction: false,
};

test("pinned-only intersects existing filters and responds to profile pin changes", () => {
	const quests = [
		makeQuest("alpha", "Alpha Run"),
		makeQuest("bravo", "Bravo Run"),
		makeQuest("charlie", "Charlie Run"),
	];
	const index = new Map(quests.map((quest) => [quest.id, quest]));
	const options: QuestWorkspaceSelectionOptions = {
		selectedTraderIds: new Set(),
		filterByTraderRequirements: false,
		selectedMapKeys: new Set(),
		selectedStatuses: new Set(["active"]),
		lockedFilters,
		selectedObjectiveCategories: new Set(),
		hiddenQuests: { bravo: true },
		showHiddenQuests: false,
		retainedCompletedQuestIds: new Set(),
		searchQuery: "",
		showPinnedOnly: true,
		pinnedQuests: { alpha: true, bravo: true, charlie: false },
	};
	assert.deepEqual(selectWorkspaceQuests(quests, index, profile, options).filteredQuestIds, ["alpha"]);
	assert.deepEqual(
		selectWorkspaceQuests(quests, index, profile, { ...options, searchQuery: "charlie" }).filteredQuestIds,
		[],
	);
	assert.deepEqual(
		selectWorkspaceQuests(quests, index, profile, { ...options, pinnedQuests: {} }).filteredQuestIds,
		[],
	);
	assert.deepEqual(
		selectWorkspaceQuests(quests, index, profile, { ...options, pinnedQuests: { charlie: true } }).filteredQuestIds,
		["charlie"],
	);
	assert.deepEqual(
		selectWorkspaceQuests(quests, index, profile, { ...options, showPinnedOnly: false }).filteredQuestIds,
		["alpha", "charlie"],
	);
});

test("returns canonical quest IDs after hidden and search filters", () => {
	const quests = [makeQuest("alpha", "Alpha Run"), makeQuest("bravo", "Bravo Run")];
	const result = selectWorkspaceQuests(quests, new Map(quests.map((quest) => [quest.id, quest])), profile, {
		selectedTraderIds: new Set(),
		filterByTraderRequirements: false,
		selectedMapKeys: new Set(),
		selectedStatuses: new Set(["active"]),
		lockedFilters,
		selectedObjectiveCategories: new Set(),
		hiddenQuests: { bravo: true },
		showHiddenQuests: false,
		retainedCompletedQuestIds: new Set(),
		searchQuery: "alpha",
	});

	assert.deepEqual(result.filteredQuestIds, ["alpha"]);
	assert.equal(result.statusByQuestId.get("alpha")?.status, "active");
});

test("retains a just-completed quest in an active-only session", () => {
	const quest = makeQuest("completed", "Completed Quest");
	const result = selectWorkspaceQuests(
		[quest],
		new Map([[quest.id, quest]]),
		{ ...profile, completedQuests: { completed: true } },
		{
			selectedTraderIds: new Set(),
			filterByTraderRequirements: false,
			selectedMapKeys: new Set(),
			selectedStatuses: new Set(["active"]),
			lockedFilters,
			selectedObjectiveCategories: new Set(),
			hiddenQuests: {},
			showHiddenQuests: false,
			retainedCompletedQuestIds: new Set([quest.id]),
			searchQuery: "",
		},
	);

	assert.deepEqual(result.filteredQuestIds, [quest.id]);
});
