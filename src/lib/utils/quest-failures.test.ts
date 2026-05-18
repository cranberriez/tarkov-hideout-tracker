import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../types/types";
import {
    buildQuestFailureMap,
    getAutoFailedQuestIds,
    getFailedQuestRequirementIds,
    hasGenericFailWarning,
    isQuestDisabledByCompletedFailedRequirement,
    questCanFail,
} from "./quest-failures";

function makeQuest(overrides: Partial<FullQuest> & Pick<FullQuest, "id" | "name">): FullQuest {
    return {
        id: overrides.id,
        name: overrides.name,
        normalizedName: overrides.normalizedName ?? overrides.name.toLowerCase().replace(/\s+/g, "-"),
        experience: overrides.experience ?? 0,
        trader: overrides.trader ?? {
            id: "skier",
            name: "Skier",
            normalizedName: "skier",
            imageLink: null,
            image4xLink: null,
        },
        taskRequirements: overrides.taskRequirements ?? [],
        failConditions: overrides.failConditions ?? [],
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

test("buildQuestFailureMap maps completed task-status conditions to failed quests", () => {
    const quests = [
        makeQuest({ id: "branch-a", name: "Branch A" }),
        makeQuest({
            id: "branch-b",
            name: "Branch B",
            failConditions: [
                {
                    id: "fail-branch-b",
                    type: "taskStatus",
                    description: "",
                    optional: false,
                    status: ["complete"],
                    task: { id: "branch-a" },
                },
            ],
        }),
    ];

    const failureMap = buildQuestFailureMap(quests);

    assert.deepEqual(failureMap.get("branch-a"), ["branch-b"]);
});

test("generic fail conditions warn but do not create automatic failures", () => {
    const quests = [
        makeQuest({
            id: "plant",
            name: "Bad Plant",
            failConditions: [{ id: "plant-wrong", type: "plantItem", description: "" }],
        }),
    ];

    assert.equal(questCanFail(quests[0]), true);
    assert.equal(hasGenericFailWarning(quests[0]), true);
    assert.equal(buildQuestFailureMap(quests).size, 0);
});

test("failed prerequisites are detected and completed targets disable the quest", () => {
    const quest = makeQuest({
        id: "trust-regain",
        name: "Trust Regain",
        taskRequirements: [
            { task: { id: "out-of-curiosity", name: "Out of Curiosity" }, status: ["failed"] },
        ],
    });

    assert.deepEqual(getFailedQuestRequirementIds(quest), ["out-of-curiosity"]);
    assert.equal(isQuestDisabledByCompletedFailedRequirement(quest, {}), false);
    assert.equal(
        isQuestDisabledByCompletedFailedRequirement(quest, { "out-of-curiosity": true }),
        true,
    );
});

test("mixed complete-or-failed requirements are not disabled by completed targets", () => {
    const quest = makeQuest({
        id: "follow-up",
        name: "Follow Up",
        taskRequirements: [
            { task: { id: "shooting-cans", name: "Shooting Cans" }, status: ["complete", "failed"] },
        ],
    });

    assert.deepEqual(getFailedQuestRequirementIds(quest), []);
    assert.equal(isQuestDisabledByCompletedFailedRequirement(quest, { "shooting-cans": true }), false);
});

test("getAutoFailedQuestIds includes completed conflicts and skips already failed quests", () => {
    const failureMap = new Map<string, string[]>([
        ["branch-a", ["branch-b", "branch-c", "branch-d"]],
    ]);

    assert.deepEqual(
        getAutoFailedQuestIds(
            ["branch-a"],
            failureMap,
            { "branch-d": true },
        ),
        ["branch-b", "branch-c"],
    );
});
