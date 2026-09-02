import assert from "node:assert/strict";
import test from "node:test";
import type { GameEdition, PlayerProfileState } from "@/lib/stores/useUserStore";
import {
    countCompletedHideoutUpgrades,
    countCompletedQuests,
} from "./profile-summary";

function profile(
    edition: GameEdition | null,
    stationLevels: Record<string, number>,
): PlayerProfileState {
    return {
        stationLevels,
        hiddenStations: {},
        completedRequirements: {},
        completedQuests: {},
        completedQuestObjectives: {},
        failedQuests: {},
        questsWithItems: {},
        ignoredQuests: {},
        pinnedQuests: {},
        questChangeHistory: [],
        itemCounts: {},
        playerLevel: 1,
        prestigeLevel: 0,
        questTraderLoyaltyLevels: {},
        questFenceReputation: 0,
        questFaction: "USEC",
        questShowKappa: false,
        questShowLightkeeper: false,
        gameEdition: edition,
        editionBonusesAppliedFor: edition,
        hasCompletedSetup: true,
    };
}

test("counts only completed quest entries", () => {
    const current = profile("Standard", { stash: 1 });
    current.completedQuests = { one: true, two: false, three: true };

    assert.equal(countCompletedQuests(current), 2);
});

test("excludes the base stash level and edition-granted hideout levels", () => {
    const cases: Array<[GameEdition, Record<string, number>]> = [
        ["Standard", { stash: 1 }],
        ["Left Behind", { stash: 2 }],
        ["Prepare for Escape", { stash: 3 }],
        ["Edge of Darkness", { stash: 4 }],
        ["Unheard", { stash: 4, cultist: 1 }],
    ];

    for (const [edition, stationLevels] of cases) {
        assert.equal(countCompletedHideoutUpgrades(profile(edition, stationLevels)), 0);
    }
});

test("counts station progress beyond the standard and edition baselines", () => {
    const current = profile("Unheard", {
        stash: 4,
        cultist: 1,
        security: 3,
        generator: 2,
    });

    assert.equal(countCompletedHideoutUpgrades(current), 5);
});

test("never reports a negative upgrade count for an uninitialized profile", () => {
    assert.equal(countCompletedHideoutUpgrades(profile("Edge of Darkness", {})), 0);
});
