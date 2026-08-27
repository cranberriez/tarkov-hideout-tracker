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

test("copies deprecated data to the selected profile without removing the snapshot", () => {
    useUserStore.getState().resetAll();
    const legacyState = {
        stationLevels: { workbench: 3 },
        hiddenStations: { gym: true },
        completedRequirements: { requirement: true },
        completedQuests: { quest: true },
        failedQuests: {},
        questsWithItems: { quest: true },
        ignoredQuests: {},
        pinnedQuests: { quest: true },
        questChangeHistory: [],
        itemCounts: { item: { have: 4, haveFir: 2 } },
        playerLevel: 42,
        prestigeLevel: 1,
        questTraderLoyaltyLevels: { prapor: 4 },
        questFenceReputation: 2.5,
        questFaction: "BEAR",
        questShowKappa: true,
        questShowLightkeeper: false,
        gameEdition: "Unheard",
        editionBonusesAppliedFor: "Unheard",
        hasCompletedSetup: true,
    };
    useUserStore.setState({
        deprecatedLegacyState: legacyState,
        hasConvertedDeprecatedLegacyState: false,
    });

    useUserStore.getState().convertDeprecatedLegacyState("KORD");

    const converted = useUserStore.getState();
    assert.equal(converted.gameMode, "KORD");
    assert.equal(converted.playerLevel, 42);
    assert.equal(converted.questFaction, "BEAR");
    assert.equal(converted.profiles.KORD.questTraderLoyaltyLevels.prapor, 4);
    assert.deepEqual(converted.profiles.KORD.itemCounts.item, { have: 4, haveFir: 2 });
    assert.deepEqual(converted.profiles.PVP.itemCounts, {});
    assert.equal(converted.hasConvertedDeprecatedLegacyState, true);
    assert.equal(converted.deprecatedLegacyState, legacyState);

    useUserStore.getState().addItemCounts("item", 1, 0);
    assert.deepEqual(
        (legacyState.itemCounts as Record<string, { have: number; haveFir: number }>).item,
        { have: 4, haveFir: 2 },
    );
});

test("dismisses automatic legacy restoration without marking it converted", () => {
    useUserStore.getState().resetAll();
    const legacyState = { playerLevel: 25 };
    useUserStore.setState({ deprecatedLegacyState: legacyState });

    useUserStore.getState().dismissDeprecatedLegacyState();

    const state = useUserStore.getState();
    assert.equal(state.hasDismissedDeprecatedLegacyState, true);
    assert.equal(state.hasConvertedDeprecatedLegacyState, false);
    assert.equal(state.deprecatedLegacyState, legacyState);
});
