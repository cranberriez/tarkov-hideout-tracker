import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../types/types";
import {
    getSyncCandidatesForTrader,
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

test("getSyncCandidatesForTrader returns all quests for the active trader", () => {
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
        makeQuest({
            id: "therapist-root",
            name: "Shortage",
            trader: {
                id: "therapist",
                name: "Therapist",
                normalizedName: "therapist",
                imageLink: null,
                image4xLink: null,
            },
        }),
    ];

    const candidates = getSyncCandidatesForTrader(quests, "prapor");

    assert.deepEqual(candidates.map((quest) => quest.id), ["root", "ll2"]);
});

test("syncTraderProgress completes prerequisites across traders without completing selected quests", () => {
    const therapist = {
        id: "therapist",
        name: "Therapist",
        normalizedName: "therapist",
        imageLink: null,
        image4xLink: null,
    };

    const quests = [
        makeQuest({
            id: "therapist-root",
            name: "Therapist Root",
            trader: therapist,
        }),
        makeQuest({
            id: "bridge",
            name: "Bridge",
            taskRequirements: [{ task: { id: "therapist-root", name: "Therapist Root" }, status: ["Success"] }],
        }),
        makeQuest({
            id: "selected",
            name: "Selected",
            taskRequirements: [{ task: { id: "bridge", name: "Bridge" }, status: ["Success"] }],
        }),
    ];

    const result = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: ["selected"],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(result.selectedCompletedIds, []);
    assert.deepEqual(result.prerequisiteCompletedIds.sort(), ["bridge", "therapist-root"]);
    assert.equal(result.nextCompletedQuests.selected ?? false, false);
});

test("syncTraderProgress completes same-trader dangling branches but not selected or future quests", () => {
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
        makeQuest({
            id: "future",
            name: "Future",
            taskRequirements: [{ task: { id: "c", name: "C" }, status: ["Success"] }],
        }),
    ];

    const result = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: ["c"],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(result.completedIds.sort(), ["a", "b", "d"]);
    assert.deepEqual(result.prerequisiteCompletedIds.sort(), ["a", "b"]);
    assert.deepEqual(result.inferredCompletedIds, ["d"]);
    assert.equal(result.selectedQuestIds.includes("c"), true);
    assert.equal(result.nextCompletedQuests["c"] ?? false, false);
    assert.equal(result.nextCompletedQuests["d"] ?? false, true);
    assert.equal(result.nextCompletedQuests.future ?? false, false);
});

test("syncTraderProgress does not infer unrelated cross-trader quests", () => {
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
            id: "selected",
            name: "Selected",
            taskRequirements: [{ task: { id: "b", name: "B" }, status: ["Success"] }],
        }),
        makeQuest({
            id: "therapist-bridge",
            name: "Therapist Bridge",
            trader: therapist,
            taskRequirements: [{ task: { id: "a", name: "A" }, status: ["Success"] }],
        }),
        makeQuest({
            id: "future",
            name: "Future",
            trader: therapist,
            taskRequirements: [{ task: { id: "selected", name: "Selected" }, status: ["Success"] }],
        }),
    ];

    const result = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: ["selected"],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(result.prerequisiteCompletedIds.sort(), ["a", "b"]);
    assert.deepEqual(result.inferredCompletedIds, []);
    assert.equal(result.nextCompletedQuests.future ?? false, false);
});

test("syncTraderProgress with a no-prerequisite selected quest does not complete unrelated available quests", () => {
    const therapist = {
        id: "therapist",
        name: "Therapist",
        normalizedName: "therapist",
        imageLink: null,
        image4xLink: null,
    };

    const quests = [
        makeQuest({
            id: "selected",
            name: "Selected",
            trader: {
                id: "fence",
                name: "Fence",
                normalizedName: "fence",
                imageLink: null,
                image4xLink: null,
            },
            minPlayerLevel: 25,
        }),
        makeQuest({
            id: "available-other",
            name: "Available Other",
        }),
        makeQuest({
            id: "lightkeeper-other",
            name: "Lightkeeper Other",
            trader: therapist,
            lightkeeperRequired: true,
        }),
    ];

    const result = syncTraderProgress({
        quests,
        traderId: "fence",
        selectedQuestIds: ["selected"],
        profile: makeProfile({
            playerLevel: 30,
            traderLoyaltyLevels: { prapor: 3, therapist: 3, fence: 3 },
        }),
        questsWithItems: {},
    });

    assert.deepEqual(result.completedIds, []);
    assert.deepEqual(result.prerequisiteCompletedIds, []);
    assert.deepEqual(result.inferredCompletedIds, []);
    assert.equal(result.nextCompletedQuests.selected ?? false, false);
    assert.equal(result.nextCompletedQuests["available-other"] ?? false, false);
    assert.equal(result.nextCompletedQuests["lightkeeper-other"] ?? false, false);
});

test("syncTraderProgress can skip same-trader inferred chains when disabled", () => {
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
        selectedQuestIds: ["c"],
        inferOtherTraderChains: false,
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(result.prerequisiteCompletedIds.sort(), ["a", "b"]);
    assert.deepEqual(result.inferredCompletedIds, []);
    assert.equal(result.nextCompletedQuests["d"] ?? false, false);
});
