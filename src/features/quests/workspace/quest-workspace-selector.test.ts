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

test("reuses one completion snapshot for gate reasons and active prerequisites on each selection", () => {
	const completed = makeQuest("done", "Done");
	completed.trader = { id: "prapor", name: "Prapor", normalizedName: "prapor" };
	const gated = makeQuest("gated", "Gated");
	gated.otherRequirements = [
		{ type: "globalVariable", variableId: "6a20540cf1b67a977cc5a088", compareMethod: ">=", value: 1 },
	];
	const child = makeQuest("child", "Child");
	child.taskRequirements = [{ task: { id: gated.id, name: gated.name }, status: ["active"] }];
	const nextGate = makeQuest("next", "Next");
	nextGate.otherRequirements = [{ ...gated.otherRequirements[0], value: 2 }];
	const quests = [completed, gated, child, nextGate];
	let scans = 0;
	class QuestIndex extends Map<string, FullQuest> {
		override values() {
			scans += 1;
			return super.values();
		}
	}
	const index = new QuestIndex(quests.map((quest) => [quest.id, quest]));
	const options: QuestWorkspaceSelectionOptions = {
		selectedTraderIds: new Set(),
		filterByTraderRequirements: false,
		selectedMapKeys: new Set(),
		selectedStatuses: new Set(["active", "locked"]),
		lockedFilters: { ...lockedFilters, showAll: true },
		selectedObjectiveCategories: new Set(),
		hiddenQuests: {},
		showHiddenQuests: false,
		retainedCompletedQuestIds: new Set(),
		searchQuery: "",
	};
	const result = selectWorkspaceQuests(quests, index, { ...profile, completedQuests: { done: true } }, options);
	assert.equal(scans, 1);
	assert.equal(result.statusByQuestId.get("gated")?.status, "active");
	assert.equal(result.statusByQuestId.get("child")?.status, "active");
	assert.equal(result.statusByQuestId.get("next")?.reasons[0].currentValue, 1);
	const switched = selectWorkspaceQuests(quests, index, profile, options);
	assert.equal(scans, 2);
	assert.equal(switched.statusByQuestId.get("gated")?.status, "locked");
	assert.equal(switched.statusByQuestId.get("child")?.status, "locked");
	assert.equal(switched.statusByQuestId.get("next")?.reasons[0].currentValue, 0);
});
