import assert from "node:assert/strict";
import test from "node:test";
import { useUserStore } from "./useUserStore";

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
