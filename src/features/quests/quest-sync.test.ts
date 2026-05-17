import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../types/types";
import {
    getSyncCandidatesForTrader,
    syncTraderProgress,
    type QuestSyncProfile,
} from "./quest-sync";
import {
    NETWORK_PROVIDER_PART_1_ID,
    createEmptySensitiveBackfillDecisions,
    denySensitiveBackfillQuest,
} from "../../lib/utils/sensitive-quest-backfill";

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

test("syncTraderProgress blocks sensitive prerequisites unless explicitly allowed", () => {
    const networkProvider = makeQuest({
        id: NETWORK_PROVIDER_PART_1_ID,
        name: "Network Provider - Part 1",
        taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }],
    });
    const selected = makeQuest({
        id: "after-network-provider",
        name: "After Network Provider",
        taskRequirements: [
            {
                task: { id: NETWORK_PROVIDER_PART_1_ID, name: "Network Provider - Part 1" },
                status: ["Success"],
            },
        ],
    });
    const quests = [makeQuest({ id: "root", name: "Root" }), networkProvider, selected];

    const blockedResult = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: [selected.id],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(blockedResult.prerequisiteCompletedIds, []);
    assert.deepEqual(blockedResult.blockedSensitiveQuestIds, [NETWORK_PROVIDER_PART_1_ID]);
    assert.equal(blockedResult.nextCompletedQuests[NETWORK_PROVIDER_PART_1_ID] ?? false, false);
    assert.equal(blockedResult.nextCompletedQuests.root ?? false, false);

    const deniedResult = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: [selected.id],
        deniedSensitiveBackfillQuestIds: [NETWORK_PROVIDER_PART_1_ID],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(deniedResult.blockedSensitiveQuestIds, []);
    assert.deepEqual(deniedResult.prerequisiteCompletedIds, [NETWORK_PROVIDER_PART_1_ID]);
    assert.equal(deniedResult.nextCompletedQuests[NETWORK_PROVIDER_PART_1_ID], true);
    assert.equal(deniedResult.nextCompletedQuests.root ?? false, false);

    const allowedResult = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: [selected.id],
        allowedSensitiveBackfillQuestIds: [NETWORK_PROVIDER_PART_1_ID],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(allowedResult.blockedSensitiveQuestIds, []);
    assert.deepEqual(allowedResult.prerequisiteCompletedIds.sort(), [
        NETWORK_PROVIDER_PART_1_ID,
        "root",
    ]);
    assert.equal(allowedResult.nextCompletedQuests[NETWORK_PROVIDER_PART_1_ID], true);
    assert.equal(allowedResult.nextCompletedQuests.root, true);
});

test("syncTraderProgress keeps denied sensitive decisions valid as selected quests change", () => {
    const networkProvider = makeQuest({
        id: NETWORK_PROVIDER_PART_1_ID,
        name: "Network Provider - Part 1",
        taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }],
    });
    const selected = makeQuest({
        id: "after-network-provider",
        name: "After Network Provider",
        taskRequirements: [
            {
                task: { id: NETWORK_PROVIDER_PART_1_ID, name: "Network Provider - Part 1" },
                status: ["Success"],
            },
        ],
    });
    const otherSelected = makeQuest({
        id: "other-selected",
        name: "Other Selected",
        taskRequirements: [{ task: { id: "other-root", name: "Other Root" }, status: ["Success"] }],
    });
    const quests = [
        makeQuest({ id: "root", name: "Root" }),
        makeQuest({ id: "other-root", name: "Other Root" }),
        networkProvider,
        selected,
        otherSelected,
    ];
    const decisions = denySensitiveBackfillQuest(
        createEmptySensitiveBackfillDecisions(),
        NETWORK_PROVIDER_PART_1_ID,
    );

    const result = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: [selected.id, otherSelected.id],
        deniedSensitiveBackfillQuestIds: decisions.deniedQuestIds,
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(result.blockedSensitiveQuestIds, []);
    assert.equal(result.nextCompletedQuests[NETWORK_PROVIDER_PART_1_ID], true);
    assert.equal(result.nextCompletedQuests.root ?? false, false);
    assert.equal(result.nextCompletedQuests["other-root"], true);

    const resultAfterSync = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: [selected.id, otherSelected.id],
        profile: makeProfile({ completedQuests: result.nextCompletedQuests }),
        questsWithItems: result.nextQuestsWithItems,
    });

    assert.deepEqual(resultAfterSync.blockedSensitiveQuestIds, []);
    assert.equal(resultAfterSync.nextCompletedQuests.root ?? false, false);
});

test("syncTraderProgress blocks sensitive same-trader inferred quests unless explicitly allowed", () => {
    const quests = [
        makeQuest({ id: "root", name: "Root" }),
        makeQuest({
            id: "selected",
            name: "Selected",
            taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }],
        }),
        makeQuest({
            id: NETWORK_PROVIDER_PART_1_ID,
            name: "Network Provider - Part 1",
            taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }],
        }),
    ];

    const blockedResult = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: ["selected"],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(blockedResult.prerequisiteCompletedIds, ["root"]);
    assert.deepEqual(blockedResult.inferredCompletedIds, []);
    assert.deepEqual(blockedResult.blockedSensitiveQuestIds, [NETWORK_PROVIDER_PART_1_ID]);
    assert.equal(blockedResult.nextCompletedQuests[NETWORK_PROVIDER_PART_1_ID] ?? false, false);

    const allowedResult = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: ["selected"],
        allowedSensitiveBackfillQuestIds: [NETWORK_PROVIDER_PART_1_ID],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(allowedResult.blockedSensitiveQuestIds, []);
    assert.deepEqual(allowedResult.inferredCompletedIds, [NETWORK_PROVIDER_PART_1_ID]);
    assert.equal(allowedResult.nextCompletedQuests[NETWORK_PROVIDER_PART_1_ID], true);
});

test("syncTraderProgress denial stops at sensitive inferred quests without blocking other completions", () => {
    const quests = [
        makeQuest({ id: "root", name: "Root" }),
        makeQuest({
            id: "selected",
            name: "Selected",
            taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }],
        }),
        makeQuest({
            id: NETWORK_PROVIDER_PART_1_ID,
            name: "Network Provider - Part 1",
            taskRequirements: [{ task: { id: "root", name: "Root" }, status: ["Success"] }],
        }),
    ];

    const result = syncTraderProgress({
        quests,
        traderId: "prapor",
        selectedQuestIds: ["selected"],
        deniedSensitiveBackfillQuestIds: [NETWORK_PROVIDER_PART_1_ID],
        profile: makeProfile(),
        questsWithItems: {},
    });

    assert.deepEqual(result.blockedSensitiveQuestIds, []);
    assert.deepEqual(result.prerequisiteCompletedIds, ["root"]);
    assert.deepEqual(result.inferredCompletedIds, [NETWORK_PROVIDER_PART_1_ID]);
    assert.equal(result.nextCompletedQuests.root, true);
    assert.equal(result.nextCompletedQuests[NETWORK_PROVIDER_PART_1_ID], true);
});
