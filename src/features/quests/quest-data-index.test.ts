import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest, QuestMap } from "@/types/quests";
import type { QuestSeriesManifest } from "@/lib/utils/quest-organization";
import { buildQuestDataIndex } from "./quest-data-index";

const customs: QuestMap = { id: "customs", name: "Customs", normalizedName: "customs" };

function makeQuest(id: string, overrides: Partial<FullQuest> = {}): FullQuest {
    return {
        id,
        name: id,
        normalizedName: id,
        experience: 1_000,
        map: null,
        trader: { id: "prapor", name: "Prapor", normalizedName: "prapor" },
        taskRequirements: [],
        failConditions: [],
        traderRequirements: [],
        otherRequirements: [],
        requiredPrestige: null,
        objectives: [],
        ...overrides,
    };
}

test("indexes canonical quests, manifest order, prerequisites, and unlocks", () => {
    const root = makeQuest("root");
    const middle = makeQuest("middle", {
        taskRequirements: [{ task: { id: root.id, name: root.name }, status: ["complete"] }],
    });
    const leaf = makeQuest("leaf", {
        taskRequirements: [
            { task: { id: middle.id, name: middle.name }, status: ["complete"] },
            { task: { id: "missing", name: "Missing" }, status: ["complete"] },
        ],
    });
    const quests = [root, middle, leaf];

    const index = buildQuestDataIndex(quests, { version: 1, series: [] });

    assert.equal(index.quests, quests);
    assert.equal(index.questsById.get("middle"), middle);
    assert.deepEqual([...index.questOrderById], [["root", 0], ["middle", 1], ["leaf", 2]]);
    assert.deepEqual(index.prerequisiteIdsByQuestId.get("leaf"), ["middle", "missing"]);
    assert.deepEqual(index.prerequisitesByQuestId.get("leaf"), [middle]);
    assert.deepEqual(index.leadsToByQuestId.get("root"), ["middle"]);
    assert.deepEqual(index.unlocksByQuestId.get("middle"), [leaf]);
    assert.equal(index.unlocksByQuestId.get("middle")?.[0], leaf);
});

test("indexes trader and map lists without replacing canonical trader references", () => {
    const therapist = { id: "therapist", name: "Therapist", normalizedName: "therapist" };
    const prapor = { id: "prapor", name: "Prapor", normalizedName: "prapor" };
    const quests = [
        makeQuest("therapist-quest", { trader: therapist, map: customs }),
        makeQuest("prapor-quest", { trader: prapor, objectives: [{
            id: "customs-objective",
            type: "visit",
            description: "Visit Customs",
            optional: false,
            maps: [customs],
        }] }),
    ];

    const index = buildQuestDataIndex(quests, { version: 1, series: [] });

    assert.deepEqual(index.traders.map((trader) => trader.id), ["prapor", "therapist"]);
    assert.equal(index.traders[0], prapor);
    assert.equal(index.traders[1], therapist);
    assert.deepEqual(index.maps.map((map) => map.key), ["customs"]);
});

test("indexes organization and transitive unlock impact", () => {
    const root = makeQuest("root");
    const middle = makeQuest("middle", {
        taskRequirements: [{ task: { id: root.id, name: root.name }, status: ["complete"] }],
    });
    const leaf = makeQuest("leaf", {
        taskRequirements: [{ task: { id: middle.id, name: middle.name }, status: ["complete"] }],
    });
    const manifest: QuestSeriesManifest = {
        version: 1,
        series: [{
            id: "test-series",
            name: "Test Series",
            traderId: "prapor",
            members: [{ questId: middle.id, order: 1 }],
        }],
    };

    const index = buildQuestDataIndex([root, middle, leaf], manifest);

    assert.equal(index.organization.byQuestId.get("middle")?.seriesId, "test-series");
    assert.equal(index.organization.byQuestId.get("middle")?.seriesOrder, 1);
    assert.deepEqual([...index.unlockImpactById], [["root", 2], ["middle", 1], ["leaf", 0]]);
});

test("indexes failure and reciprocal multiple-choice relationships", () => {
    const failWhenCompleted = (targetId: string): FullQuest["failConditions"] => [{
        id: `fail-${targetId}`,
        type: "taskStatus",
        description: `Fails when ${targetId} completes`,
        optional: false,
        status: ["complete"],
        task: { id: targetId },
    }];
    const left = makeQuest("left", { failConditions: failWhenCompleted("right") });
    const right = makeQuest("right", { failConditions: failWhenCompleted("left") });
    const oneWay = makeQuest("one-way", { failConditions: failWhenCompleted("left") });

    const index = buildQuestDataIndex([left, right, oneWay], { version: 1, series: [] });

    assert.deepEqual(index.failureMap.get("left"), ["right", "one-way"]);
    assert.deepEqual(index.failureMap.get("right"), ["left"]);
    assert.deepEqual(index.multipleChoiceGroups.get("left"), ["left", "right"]);
    assert.deepEqual(index.multipleChoiceGroups.get("right"), ["left", "right"]);
    assert.equal(index.multipleChoiceGroups.has("one-way"), false);
});
