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
        requiredPrestige: overrides.requiredPrestige ?? null,
    };
}

function makeProfile(overrides: Partial<QuestAvailabilityProfile> = {}): QuestAvailabilityProfile {
    return {
        playerLevel: overrides.playerLevel ?? 30,
        prestigeLevel: overrides.prestigeLevel ?? 0,
        faction: overrides.faction ?? "USEC",
        traderLoyaltyLevels: overrides.traderLoyaltyLevels ?? { skier: 4 },
        completedQuests: overrides.completedQuests ?? {},
        failedQuests: overrides.failedQuests ?? {},
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
