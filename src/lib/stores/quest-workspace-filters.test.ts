import assert from "node:assert/strict";
import test from "node:test";
import { useUserStore } from "./useUserStore";

test("keeps quest workspace filters global and trader loyalty profile-specific", () => {
    useUserStore.getState().resetAll();

    useUserStore.getState().setQuestWorkspaceSelectedTraders(["prapor"]);
    useUserStore.getState().setQuestWorkspaceFilterByTraderRequirements(false);
    useUserStore.getState().setQuestWorkspaceSelectedMaps(["customs"]);
    useUserStore.getState().setQuestWorkspaceSelectedStatuses(["active"]);
    useUserStore.getState().setQuestWorkspaceSelectedObjectiveCategories(["hand-in"]);
    useUserStore.getState().setQuestTraderLoyaltyLevel("prapor", 4);

    useUserStore.getState().setGameMode("PVE");

    const pveState = useUserStore.getState();
    assert.deepEqual(pveState.questWorkspaceSelectedTraders, ["prapor"]);
    assert.equal(pveState.questWorkspaceFilterByTraderRequirements, false);
    assert.deepEqual(pveState.questWorkspaceSelectedMaps, ["customs"]);
    assert.deepEqual(pveState.questWorkspaceSelectedStatuses, ["active"]);
    assert.deepEqual(pveState.questWorkspaceSelectedObjectiveCategories, ["hand-in"]);
    assert.deepEqual(pveState.questTraderLoyaltyLevels, {});

    useUserStore.getState().setQuestTraderLoyaltyLevel("prapor", 2);
    useUserStore.getState().setGameMode("PVP");
    assert.equal(useUserStore.getState().questTraderLoyaltyLevels.prapor, 4);
});
