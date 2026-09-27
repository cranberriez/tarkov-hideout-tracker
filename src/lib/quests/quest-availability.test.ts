import test from "node:test";
import assert from "node:assert/strict";

import type { QuestAvailabilityQuest, QuestAvailabilityProfile } from "./quest-availability";
import { buildQuestAvailabilityMap, isQuestAvailableForProfile } from "./quest-availability";

function makeQuest(overrides: Partial<QuestAvailabilityQuest> & Pick<QuestAvailabilityQuest, "id">): QuestAvailabilityQuest {
    return {
        id: overrides.id,
        factionName: overrides.factionName ?? "Any",
        minPlayerLevel: overrides.minPlayerLevel ?? 1,
        kappaRequired: overrides.kappaRequired ?? false,
        lightkeeperRequired: overrides.lightkeeperRequired ?? false,
        hasItemHandIn: overrides.hasItemHandIn ?? false,
        taskRequirements: overrides.taskRequirements ?? [],
        failConditions: overrides.failConditions ?? [],
        trader: overrides.trader ?? {
            id: "skier",
            name: "Skier",
            normalizedName: "skier",
            imageLink: null,
            image4xLink: null,
        },
        traderRequirements: overrides.traderRequirements ?? [],
        otherRequirements: overrides.otherRequirements ?? [],
        requiredPrestige: overrides.requiredPrestige ?? null,
    };
}

function makeProfile(overrides: Partial<QuestAvailabilityProfile> = {}): QuestAvailabilityProfile {
    return {
        playerLevel: overrides.playerLevel ?? 30,
        prestigeLevel: overrides.prestigeLevel ?? 0,
        faction: overrides.faction ?? "USEC",
        traderLoyaltyLevels: overrides.traderLoyaltyLevels ?? { skier: 4 },
        fenceReputation: overrides.fenceReputation ?? 0,
        completedQuests: overrides.completedQuests ?? {},
        failedQuests: overrides.failedQuests ?? {},
    };
}

function makeTraderRequirement(
    traderId: string,
    requirementType: string,
    value: number,
): QuestAvailabilityQuest["traderRequirements"][number] {
    return {
        id: `${traderId}-${requirementType}-${value}`,
        requirementType,
        compareMethod: ">=",
        value,
        trader: {
            id: traderId,
            name: traderId,
            normalizedName: traderId,
            imageLink: null,
            image4xLink: null,
        },
    };
}

test("failed task requirements are satisfied by failedQuests", () => {
    const quests = [
        makeQuest({ id: "branch" }),
        makeQuest({
            id: "repair",
            taskRequirements: [{ task: { id: "branch", name: "Branch" }, status: ["failed"] }],
        }),
    ];
    const questsById = buildQuestAvailabilityMap(quests);

    assert.equal(isQuestAvailableForProfile(quests[1], makeProfile(), questsById), false);
    assert.equal(
        isQuestAvailableForProfile(
            quests[1],
            makeProfile({ failedQuests: { branch: true } }),
            questsById,
        ),
        true,
    );
});

test("completed failed-prerequisite target disables the dependent quest", () => {
    const quests = [
        makeQuest({ id: "branch" }),
        makeQuest({
            id: "repair",
            taskRequirements: [{ task: { id: "branch", name: "Branch" }, status: ["failed"] }],
        }),
    ];
    const questsById = buildQuestAvailabilityMap(quests);

    assert.equal(
        isQuestAvailableForProfile(
            quests[1],
            makeProfile({ completedQuests: { branch: true } }),
            questsById,
        ),
        false,
    );
});

test("mixed complete-or-failed task requirements accept either terminal state", () => {
    const quests = [
        makeQuest({ id: "branch" }),
        makeQuest({
            id: "follow-up",
            taskRequirements: [
                { task: { id: "branch", name: "Branch" }, status: ["complete", "failed"] },
            ],
        }),
    ];
    const questsById = buildQuestAvailabilityMap(quests);

    assert.equal(
        isQuestAvailableForProfile(
            quests[1],
            makeProfile({ completedQuests: { branch: true } }),
            questsById,
        ),
        true,
    );
    assert.equal(
        isQuestAvailableForProfile(
            quests[1],
            makeProfile({ failedQuests: { branch: true } }),
            questsById,
        ),
        true,
    );
});

test("complete task requirements accept failed prerequisites as resolved", () => {
    const quests = [
        makeQuest({ id: "branch" }),
        makeQuest({
            id: "follow-up",
            taskRequirements: [
                { task: { id: "branch", name: "Branch" }, status: ["complete"] },
            ],
        }),
    ];
    const questsById = buildQuestAvailabilityMap(quests);

    assert.equal(
        isQuestAvailableForProfile(
            quests[1],
            makeProfile({ failedQuests: { branch: true } }),
            questsById,
        ),
        true,
    );
});

test("active task requirements accept completed prerequisites", () => {
    const quests = [
        makeQuest({ id: "intro" }),
        makeQuest({
            id: "follow-up",
            taskRequirements: [{ task: { id: "intro", name: "Introduction" }, status: ["active"] }],
        }),
    ];
    const questsById = buildQuestAvailabilityMap(quests);

    assert.equal(
        isQuestAvailableForProfile(
            quests[1],
            makeProfile({ completedQuests: { intro: true } }),
            questsById,
        ),
        true,
    );
});

test("active task requirements accept failed prerequisites", () => {
    const quests = [
        makeQuest({ id: "intro" }),
        makeQuest({
            id: "follow-up",
            taskRequirements: [{ task: { id: "intro", name: "Introduction" }, status: ["active"] }],
        }),
    ];
    const questsById = buildQuestAvailabilityMap(quests);

    assert.equal(
        isQuestAvailableForProfile(
            quests[1],
            makeProfile({ failedQuests: { intro: true } }),
            questsById,
        ),
        true,
    );
});

test("own-trader level gates use the profile loyalty level", () => {
    const quest = makeQuest({
        id: "ll2",
        traderRequirements: [makeTraderRequirement("skier", "level", 2)],
    });
    const questsById = buildQuestAvailabilityMap([quest]);

    assert.equal(
        isQuestAvailableForProfile(
            quest,
            makeProfile({ traderLoyaltyLevels: { skier: 1 } }),
            questsById,
        ),
        false,
    );
    assert.equal(
        isQuestAvailableForProfile(
            quest,
            makeProfile({ traderLoyaltyLevels: { skier: 2 } }),
            questsById,
        ),
        true,
    );
});

test("cross-trader level gates use the required trader's profile level", () => {
    const quest = makeQuest({
        id: "cross-trader-level",
        traderRequirements: [makeTraderRequirement("therapist", "level", 2)],
    });
    const questsById = buildQuestAvailabilityMap([quest]);

    assert.equal(
        isQuestAvailableForProfile(
            quest,
            makeProfile({ traderLoyaltyLevels: { skier: 4, therapist: 1 } }),
            questsById,
        ),
        false,
    );
    assert.equal(
        isQuestAvailableForProfile(
            quest,
            makeProfile({ traderLoyaltyLevels: { skier: 4, therapist: 2 } }),
            questsById,
        ),
        true,
    );
});

test("reputation gates do not act as loyalty-level gates", () => {
    const quest = makeQuest({
        id: "reputation-gate",
        traderRequirements: [makeTraderRequirement("skier", "reputation", 4)],
    });
    const questsById = buildQuestAvailabilityMap([quest]);

    assert.equal(
        isQuestAvailableForProfile(
            quest,
            makeProfile({ traderLoyaltyLevels: { skier: 1 } }),
            questsById,
        ),
        true,
    );
});

test("Fence reputation gates use the profile's exact standing", () => {
    const quest = makeQuest({
        id: "fence-reputation-gate",
        traderRequirements: [{
            ...makeTraderRequirement("fence", "reputation", -1),
            compareMethod: "<=",
            trader: {
                id: "fence",
                name: "Fence",
                normalizedName: "fence",
                imageLink: null,
                image4xLink: null,
            },
        }],
    });
    const questsById = buildQuestAvailabilityMap([quest]);

    assert.equal(
        isQuestAvailableForProfile(quest, makeProfile({ fenceReputation: 0 }), questsById),
        false,
    );
    assert.equal(
        isQuestAvailableForProfile(quest, makeProfile({ fenceReputation: -1 }), questsById),
        true,
    );
});

test("mixed trader gates enforce every level gate while ignoring reputation", () => {
    const quest = makeQuest({
        id: "mixed-gates",
        traderRequirements: [
            makeTraderRequirement("skier", "level", 2),
            makeTraderRequirement("therapist", "loyaltyLevel", 3),
            makeTraderRequirement("skier", "reputation", 5),
        ],
    });
    const questsById = buildQuestAvailabilityMap([quest]);

    assert.equal(
        isQuestAvailableForProfile(
            quest,
            makeProfile({ traderLoyaltyLevels: { skier: 2, therapist: 2 } }),
            questsById,
        ),
        false,
    );
    assert.equal(
        isQuestAvailableForProfile(
            quest,
            makeProfile({ traderLoyaltyLevels: { skier: 2, therapist: 3 } }),
            questsById,
        ),
        true,
    );
});

test("known trader-tier completion counters lock until enough matching quests are completed", () => {
    const prapor = {
        id: "prapor",
        name: "Prapor",
        normalizedName: "prapor",
        imageLink: null,
        image4xLink: null,
    };
    const tierOneQuests = ["p1", "p2", "p3"].map((id) => makeQuest({
        id,
        trader: prapor,
    }));
    const tierTwoQuest = makeQuest({
        id: "p-ll2",
        trader: prapor,
        traderRequirements: [makeTraderRequirement("prapor", "level", 2)],
    });
    const gatedQuest = makeQuest({
        id: "gated",
        trader: prapor,
        otherRequirements: [{
            id: "gate-id",
            type: "globalVariable",
            variableId: "6a20540cf1b67a977cc5a088",
            compareMethod: ">=",
            value: 3,
        }],
    });
    const questsById = buildQuestAvailabilityMap([
        ...tierOneQuests,
        tierTwoQuest,
        gatedQuest,
    ]);

    assert.equal(
        isQuestAvailableForProfile(
            gatedQuest,
            makeProfile({ completedQuests: { p1: true, p2: true, "p-ll2": true } }),
            questsById,
        ),
        false,
    );
    assert.equal(
        isQuestAvailableForProfile(
            gatedQuest,
            makeProfile({ completedQuests: { p1: true, p2: true, p3: true } }),
            questsById,
        ),
        true,
    );
});

test("unknown global variables remain non-blocking", () => {
    const quest = makeQuest({
        id: "unknown-gate",
        otherRequirements: [{
            type: "globalVariable",
            variableId: "unknown-variable",
            compareMethod: ">=",
            value: 99,
        }],
    });

    assert.equal(
        isQuestAvailableForProfile(quest, makeProfile(), buildQuestAvailabilityMap([quest])),
        true,
    );
});
