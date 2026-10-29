import assert from "node:assert/strict";
import test from "node:test";
import { useUserStore } from "../../lib/stores/useUserStore";
import { createItemFilterControls } from "./useActiveItemFilters";

const neutral = () => ({
	...useUserStore.getState(),
	showHidden: true,
	itemIgnoreStationGoals: true,
	itemQuestVisibilityMode: "allFuture" as const,
	itemShowFutureFir: true,
	itemShowIgnored: true,
});

test("item active filters exclude layout, sort and inactive numeric values", () => {
	const state = {
		...neutral(),
		itemsSize: "Icon" as const,
		useCategorization: true,
		cheapPriceThreshold: 9000,
		itemQuestCustomLookahead: 8,
	};
	assert.deepEqual(createItemFilterControls(state, state, "   ", () => {}).filters, []);
});

test("item counts include restrictive default visibility and only enabled threshold", () => {
	const state = {
		...neutral(),
		itemQuestVisibilityMode: "custom" as const,
		itemQuestCustomLookahead: 2,
		itemQuestCustomLevelLookahead: 4,
		showFirOnly: true,
		hideCheap: true,
	};
	const filters = createItemFilterControls(state, state, " motor ", () => {}).filters;
	assert.deepEqual(
		filters.map((filter) => filter.id),
		["search", "fir", "cheap", "quests"],
	);
	assert.equal(filters.at(-1)?.label, "Quest lookahead: 2, levels: 4");
});

test("quest-only results exclude hideout constraints and removal touches one action", () => {
	let removed = false;
	const state = {
		...neutral(),
		itemSourceFilter: "quest" as const,
		checklistViewMode: "nextLevel" as const,
		showHidden: false,
		hiddenStations: { stash: true },
		itemIgnoreStationGoals: false,
		stationGoals: { stash: 2 },
	};
	const filters = createItemFilterControls(
		state,
		{
			...state,
			setItemSourceFilter: (value) => {
				assert.equal(value, "all");
				removed = true;
			},
		},
		"",
		() => {},
	).filters;
	assert.deepEqual(
		filters.map((filter) => filter.id),
		["source"],
	);
	filters[0].onRemove();
	assert.equal(removed, true);
});

test("clear search and item filters preserves saved entities, progress and display preferences", () => {
	const state = {
		...neutral(),
		showHidden: false,
		hiddenStations: { stash: true },
		ignoredQuests: { quest: true },
		pinnedQuests: { quest: true },
		stationGoals: { stash: 2 },
		itemCounts: { item: { have: 5, haveFir: 2 } },
		hideCheap: true,
		cheapPriceThreshold: 12345,
		showFirOnly: true,
		itemSourceFilter: "quest" as const,
		itemQuestVisibilityMode: "custom" as const,
		itemShowFutureFir: false,
		itemShowIgnored: false,
		itemShowPinnedQuestOnly: true,
		itemIgnoreStationGoals: false,
	};
	const before = JSON.stringify(state);
	const calls: Record<string, unknown> = {};
	const actions = { ...state };
	for (const key of [
		"setItemSourceFilter",
		"setShowFirOnly",
		"setHideCheap",
		"setChecklistViewMode",
		"setShowHidden",
		"setItemIgnoreStationGoals",
		"setItemShowPinnedQuestOnly",
		"setItemQuestVisibilityMode",
		"setItemShowFutureFir",
		"setItemShowIgnored",
	] as const) {
		Object.assign(actions, {
			[key]: (value: unknown) => {
				calls[key] = value;
			},
		});
	}
	createItemFilterControls(state, actions, "motor", (value) => {
		calls.search = value;
	}).clearSearchAndFilters();
	assert.equal(JSON.stringify(state), before);
	assert.deepEqual(calls, {
		search: "",
		setItemSourceFilter: "all",
		setShowFirOnly: false,
		setHideCheap: false,
		setChecklistViewMode: "all",
		setShowHidden: true,
		setItemIgnoreStationGoals: true,
		setItemShowPinnedQuestOnly: false,
		setItemQuestVisibilityMode: "allFuture",
		setItemShowFutureFir: true,
		setItemShowIgnored: true,
	});
});
