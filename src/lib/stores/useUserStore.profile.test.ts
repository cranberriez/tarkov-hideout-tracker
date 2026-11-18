import assert from "node:assert/strict";
import test from "node:test";
import { useUserStore } from "./useUserStore";

test("targeted permanent inventory edits never select a profile and keep the active projection synchronized", () => {
	useUserStore.getState().resetAll();
	useUserStore.getState().setGameMode("KORD");
	useUserStore.getState().setPlayerLevel(42);
	const before = useUserStore.getState();
	before.addItemCountsForProfile("PVP", "document-a", 3, 2);
	let state = useUserStore.getState();
	assert.equal(state.gameMode, "KORD");
	assert.equal(state.selectedSeasonId, before.selectedSeasonId);
	assert.equal(state.playerLevel, 42);
	assert.deepEqual(state.itemCounts, before.itemCounts);
	assert.deepEqual(state.seasonalProfiles, before.seasonalProfiles);
	assert.deepEqual(state.profiles.PVP.itemCounts["document-a"], { have: 3, haveFir: 2 });
	assert.deepEqual(state.profiles.PVE, before.profiles.PVE);
	state.setGameMode("PVP");
	useUserStore.getState().addItemCountsForProfile("PVP", "document-a", -1, 0);
	state = useUserStore.getState();
	assert.deepEqual(state.itemCounts["document-a"], { have: 2, haveFir: 2 });
	assert.deepEqual(state.profiles.PVP.itemCounts, state.itemCounts);
	state.addItemCountsForProfile("PVE", "document-a", 7, 0);
	assert.equal(useUserStore.getState().gameMode, "PVP");
	assert.deepEqual(useUserStore.getState().itemCounts["document-a"], { have: 2, haveFir: 2 });
	assert.deepEqual(useUserStore.getState().profiles.PVE.itemCounts["document-a"], { have: 7, haveFir: 0 });
});

test("keeps character progress isolated when switching profiles", () => {
	const store = useUserStore.getState();
	store.resetAll();
	useUserStore.getState().setPlayerLevel(42);
	useUserStore.getState().addItemCounts("item-a", 3, 1);
	useUserStore.getState().toggleQuestCompletion("quest-a");
	useUserStore.getState().toggleQuestObjectiveCompletion("quest-b", "objective-b");

	useUserStore.getState().setGameMode("PVE");
	assert.equal(useUserStore.getState().playerLevel, 1);
	assert.deepEqual(useUserStore.getState().itemCounts, {});
	assert.deepEqual(useUserStore.getState().completedQuests, {});
	assert.deepEqual(useUserStore.getState().completedQuestObjectives, {});

	useUserStore.getState().setPlayerLevel(17);
	useUserStore.getState().setGameMode("KORD");
	assert.equal(useUserStore.getState().playerLevel, 1);

	useUserStore.getState().setGameMode("PVP");
	assert.equal(useUserStore.getState().playerLevel, 42);
	assert.deepEqual(useUserStore.getState().itemCounts["item-a"], { have: 3, haveFir: 1 });
	assert.equal(useUserStore.getState().completedQuests["quest-a"], true);
	assert.equal(useUserStore.getState().completedQuestObjectives["quest-b"]?.["objective-b"], true);

	useUserStore.getState().setGameMode("PVE");
	assert.equal(useUserStore.getState().playerLevel, 17);
});

test("clears visited objectives when toggling a quest complete", () => {
	useUserStore.getState().resetAll();
	useUserStore.getState().toggleQuestObjectiveCompletion("quest-a", "objective-a");
	useUserStore.getState().toggleQuestObjectiveCompletion("quest-a", "objective-b");

	useUserStore.getState().toggleQuestCompletion("quest-a");
	assert.equal(useUserStore.getState().completedQuests["quest-a"], true);
	assert.equal(useUserStore.getState().completedQuestObjectives["quest-a"], undefined);

	useUserStore.getState().toggleQuestCompletion("quest-a");
	assert.equal(useUserStore.getState().completedQuests["quest-a"], false);
	assert.equal(useUserStore.getState().completedQuestObjectives["quest-a"], undefined);
});

test("bulk completion clears only the completed quests' objective progress", () => {
	useUserStore.getState().resetAll();
	useUserStore.getState().toggleQuestObjectiveCompletion("quest-a", "objective-a");
	useUserStore.getState().toggleQuestObjectiveCompletion("quest-b", "objective-b");

	useUserStore.getState().applyQuestCompletionChange({ complete: ["quest-a"] });

	assert.equal(useUserStore.getState().completedQuestObjectives["quest-a"], undefined);
	assert.equal(useUserStore.getState().completedQuestObjectives["quest-b"]?.["objective-b"], true);
});
