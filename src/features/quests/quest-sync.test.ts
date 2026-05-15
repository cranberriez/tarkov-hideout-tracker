import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../types/types";
import {
    getVisibleSyncCandidatesForTrader,
    syncTraderProgress,
    type QuestSyncProfile,
} from "./quest-sync";

function makeQuest(overrides: Partial<FullQuest> & Pick<FullQuest, "id" | "name">): FullQuest {
    return {
        id: overrides.id,
        name: overrides.name,
        normalizedName: overrides.normalizedName ?? overrides.name.toLowerCase().replace(/\s+/g, "-"),
        experience: overrides.experience ?? 1000,
        trader: overrides.trader ?? {
            id: "prapor",
            name: "Prapor",
            normalizedName: "prapor",
            imageLink: null,
            image4xLink: null,
        },
        taskRequirements: overrides.taskRequirements ?? [],
        traderRequirements: overrides.traderRequirements ?? [],
        requiredPrestige: overrides.requiredPrestige ?? null,
        objectives: overrides.objectives ?? [],
        wikiLink: overrides.wikiLink ?? null,
        minPlayerLevel: overrides.minPlayerLevel ?? 1,
        kappaRequired: overrides.kappaRequired ?? false,
        lightkeeperRequired: overrides.lightkeeperRequired ?? false,
        factionName: overrides.factionName ?? null,
        map: overrides.map ?? null,
    };
}

function makeProfile(overrides: Partial<QuestSyncProfile> = {}): QuestSyncProfile {
    return {
        playerLevel: overrides.playerLevel ?? 30,
        prestigeLevel: overrides.prestigeLevel ?? 0,
        faction: overrides.faction ?? "USEC",
        traderLoyaltyLevels: overrides.traderLoyaltyLevels ?? { prapor: 3, therapist: 1 },
        completedQuests: overrides.completedQuests ?? {},
    };
}

test("getVisibleSyncCandidatesForTrader respects loyalty gating", () => {
    const quests = [
        makeQuest({ id: "root", name: "Debut" }),
        makeQuest({
            id: "ll2",
            name: "Checking",
            traderRequirements: [
                {
                    id: "req-prapor-2",
                    requirementType: "loyaltyLevel",
                    compareMethod: ">=",
                    value: 2,
                    trader: {
                        id: "prapor",
                        name: "Prapor",
                        normalizedName: "prapor",
                        imageLink: null,
                        image4xLink: null,
                    },
                },
            ],
        }),
    ];

    const visibleAtLl1 = getVisibleSyncCandidatesForTrader(quests, "prapor", makeProfile({
        traderLoyaltyLevels: { prapor: 1, therapist: 1 },
    }));

    assert.deepEqual(visibleAtLl1.map((quest) => quest.id), ["root"]);
});

test("getVisibleSyncCandidatesForTrader treats active prerequisite status as available-enough", () => {
    const quests = [
        makeQuest({ id: "root", name: "Debut" }),
        makeQuest({
            id: "follow-up",
            name: "Checking",
            taskRequirements: [{ task: { id: "root", name: "Debut" }, status: ["complete", "active"] }],
        }),
    ];

    const visible = getVisibleSyncCandidatesForTrader(quests, "prapor", makeProfile());

    assert.deepEqual(
        visible.map((quest) => quest.id),
        ["root", "follow-up"],
    );
});

test("syncTraderProgress completes prerequisite closure and same-trader follow-ups but not selected visible quests", () => {
    const quests = [
        makeQuest({ id: "a", name: "A" }),
        makeQuest({
            id: "b",
            name: "B",
            taskRequirements: [{ task: { id: "a", name: "A" }, status: ["Success"] }],
        }),
        makeQuest({
            id: "c",
            name: "C",
            taskRequirements: [{ task: { id: "b", name: "B" }, status: ["Success"] }],
        }),
        makeQuest({
            id: "d",
            name: "D",
            taskRequirements: [{ task: { id: "b", name: "B" }, status: ["Success"] }],
        }),
    ];

    const result = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedVisibleQuestIds: ["c"],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(result.completedIds.sort(), ["a", "b", "d"]);
    assert.deepEqual(result.prerequisiteCompletedIds.sort(), ["a", "b"]);
    assert.deepEqual(result.autoCompletedIds, ["d"]);
    assert.equal(result.selectedVisibleQuestIds.includes("c"), true);
    assert.equal(result.nextCompletedQuests["c"] ?? false, false);
});

test("syncTraderProgress keeps auto-complete scoped to the active trader", () => {
    const therapist = {
        id: "therapist",
        name: "Therapist",
        normalizedName: "therapist",
        imageLink: null,
        image4xLink: null,
    };

    const quests = [
        makeQuest({ id: "a", name: "A" }),
        makeQuest({
            id: "b",
            name: "B",
            taskRequirements: [{ task: { id: "a", name: "A" }, status: ["Success"] }],
        }),
        makeQuest({
            id: "therapist-follow-up",
            name: "Therapist Follow Up",
            trader: therapist,
            taskRequirements: [{ task: { id: "a", name: "A" }, status: ["Success"] }],
        }),
    ];

    const result = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedVisibleQuestIds: ["b"],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(result.completedIds, ["a"]);
    assert.equal(result.nextCompletedQuests["therapist-follow-up"] ?? false, false);
});
