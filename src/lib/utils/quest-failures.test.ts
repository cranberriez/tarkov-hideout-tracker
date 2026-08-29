import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../types/types";
import {
    buildMultipleChoiceQuestGroups,
    buildQuestFailureMap,
    getAutoFailedQuestIds,
    getFailedQuestRequirementIds,
    getQuestFailConditionText,
    getQuestFailWarningText,
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
        otherRequirements: overrides.otherRequirements ?? [],
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

test("buildQuestFailureMap maps a completed condition target to the quest it fails", () => {
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
    assert.equal(failureMap.has("branch-b"), false);
});

test("buildQuestFailureMap maps Out of Curiosity completion to its failed branches", () => {
    const quests = [
        makeQuest({ id: "597a0f5686f774273b74f676", name: "Chemical - Part 4" }),
        makeQuest({ id: "597a171586f77405ba6887d3", name: "Big Customer" }),
        makeQuest({
            id: "597a160786f77477531d39d2",
            name: "Out of Curiosity",
            failConditions: [
                {
                    id: "597a16e386f77477531d39d5",
                    type: "taskStatus",
                    description: "",
                    optional: false,
                    status: ["complete"],
                    task: { id: "597a0f5686f774273b74f676" },
                },
                {
                    id: "597a1a3186f77475b4612032",
                    type: "taskStatus",
                    description: "",
                    optional: false,
                    status: ["complete"],
                    task: { id: "597a171586f77405ba6887d3" },
                },
            ],
        }),
    ];

    const failureMap = buildQuestFailureMap(quests);

    assert.deepEqual(failureMap.get("597a0f5686f774273b74f676"), [
        "597a160786f77477531d39d2",
    ]);
    assert.deepEqual(failureMap.get("597a171586f77405ba6887d3"), [
        "597a160786f77477531d39d2",
    ]);
    assert.deepEqual(
        getAutoFailedQuestIds(["597a0f5686f774273b74f676"], failureMap, {}),
        ["597a160786f77477531d39d2"],
    );
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

test("custom fail condition text replaces opaque provider descriptions", () => {
    const hotWheelsCondition = {
        id: "673f5069fd98c4d6d89e7a4c",
        type: "plantItem",
        description: "673f5069fd98c4d6d89e7a4c",
    };
    const gettingAcquaintedCondition = {
        id: "639c6674eb92d6238e058dea",
        type: "traderStanding",
        description: "639c6674eb92d6238e058dea",
    };

    assert.equal(
        getQuestFailConditionText(hotWheelsCondition),
        "Marking an Wheels on Customs fails the quest",
    );
    assert.equal(
        getQuestFailConditionText(gettingAcquaintedCondition),
        "Killing Zryachiy will fail the quest losing access to it",
    );
});

test("provider fail condition text takes precedence over a custom fallback", () => {
    assert.equal(
        getQuestFailConditionText({
            id: "5f04539a29383318cb417b44",
            type: "shoot",
            description: "Do not eliminate Sanitar",
        }),
        "Do not eliminate Sanitar",
    );
});

test("confirmed generic conditions have human-readable fallback text", () => {
    const expectedTextByConditionId = {
        "5f04539a29383318cb417b44": "KILLING SANITAR",
        "63a6c752d4153566a073285a":
            "By killing Zryachiy you will fail and lose access to this quest.",
        "6667196a74bbc3a671ef49f8":
            'Killing Scavs, Scav Raiders, Rogues, or Bosses will fail the quest. Killing any of them after finishing the quest but before selecting "Complete" will still fail the quest.',
        "6667323ff686168c451ad02c": "Killing any boss will fail the quest.",
    };

    for (const [id, expectedText] of Object.entries(expectedTextByConditionId)) {
        assert.equal(
            getQuestFailConditionText({ id, type: "generic", description: id }),
            expectedText,
        );
    }
});

test("quest fail warnings prefer custom text over an earlier generic condition", () => {
    const quest = makeQuest({
        id: "custom-warning",
        name: "Custom Warning",
        failConditions: [
            { id: "generic", type: "visit", description: "Generic warning" },
            {
                id: "673f5069fd98c4d6d89e7a4c",
                type: "plantItem",
                description: "673f5069fd98c4d6d89e7a4c",
            },
        ],
    });

    assert.equal(
        getQuestFailWarningText(quest),
        "Marking an Wheels on Customs fails the quest",
    );
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

test("buildMultipleChoiceQuestGroups finds reciprocal all-against-all quest choices", () => {
    const choiceIds = ["chemical-4", "big-customer", "out-of-curiosity"];
    const quests = choiceIds.map((id) => makeQuest({
        id,
        name: id,
        failConditions: choiceIds.filter((otherId) => otherId !== id).map((otherId) => ({
            id: `${id}-fails-on-${otherId}`,
            type: "taskStatus",
            description: "",
            optional: false,
            status: ["complete"],
            task: { id: otherId },
        })),
    }));

    const groups = buildMultipleChoiceQuestGroups(quests);

    for (const id of choiceIds) assert.deepEqual(groups.get(id), choiceIds);
});

test("buildMultipleChoiceQuestGroups excludes one-way conflicts", () => {
    const quests = [
        makeQuest({
            id: "one-way-a",
            name: "One Way A",
            failConditions: [{
                id: "a-fails-on-b",
                type: "taskStatus",
                description: "",
                optional: false,
                status: ["complete"],
                task: { id: "one-way-b" },
            }],
        }),
        makeQuest({ id: "one-way-b", name: "One Way B" }),
    ];

    assert.equal(buildMultipleChoiceQuestGroups(quests).size, 0);
});

test("buildMultipleChoiceQuestGroups includes the custom Sanitar choice", () => {
    const quests = [
        makeQuest({ id: "5edac34d0bb72a50635c2bfa", name: "A Difficult Choice" }),
        makeQuest({ id: "5edab4b1218d181e29451435", name: "The Huntsman Path - Sadist" }),
    ];

    const groups = buildMultipleChoiceQuestGroups(quests);

    assert.deepEqual(groups.get(quests[0].id), quests.map((quest) => quest.id));
    assert.deepEqual(groups.get(quests[1].id), quests.map((quest) => quest.id));
});
