import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest, QuestMap } from "@/types/quests";
import {
    buildQuestUnlockImpactMap,
    sortQuestsForMapView,
    sortQuestsForQuestView,
} from "./quest-sorting";
import type { QuestSortMode } from "@/lib/stores/useUserStore";

const customs: QuestMap = { id: "customs", name: "Customs", normalizedName: "customs" };
const shoreline: QuestMap = { id: "shoreline", name: "Shoreline", normalizedName: "shoreline" };

function makeQuest(
    id: string,
    overrides: Partial<FullQuest> & { prereqIds?: string[] } = {},
): FullQuest {
    const { prereqIds = [], ...questOverrides } = overrides;

    return {
        id,
        name: id,
        normalizedName: id,
        experience: 1000,
        minPlayerLevel: 1,
        map: null,
        trader: {
            id: "trader",
            name: "Trader",
            normalizedName: "trader",
        },
        taskRequirements: prereqIds.map((prereqId) => ({
            task: { id: prereqId, name: prereqId },
            status: ["complete"],
        })),
        traderRequirements: [],
        otherRequirements: [],
        requiredPrestige: null,
        objectives: [],
        ...questOverrides,
    };
}

function sortIds(
    quests: FullQuest[],
    sortMode: QuestSortMode,
    orderIds: string[] = quests.map((quest) => quest.id),
) {
    const questOrderById = new Map(orderIds.map((id, index) => [id, index]));
    return sortQuestsForQuestView(
        quests,
        sortMode,
        questOrderById,
        buildQuestUnlockImpactMap(quests),
    ).map((quest) => quest.id);
}

function sortMapIds(
    quests: FullQuest[],
    sortMode: QuestSortMode,
    orderIds: string[] = quests.map((quest) => quest.id),
) {
    const questOrderById = new Map(orderIds.map((id, index) => [id, index]));
    return sortQuestsForMapView(
        quests,
        sortMode,
        questOrderById,
        buildQuestUnlockImpactMap(quests),
    ).map((quest) => quest.id);
}

test("default sort preserves chain-aware order", () => {
    const root = makeQuest("root", { minPlayerLevel: 10 });
    const child = makeQuest("child", { minPlayerLevel: 1, prereqIds: ["root"] });
    const other = makeQuest("other", { minPlayerLevel: 2 });

    assert.deepEqual(sortIds([child, other, root], "default", ["root", "child", "other"]), [
        "other",
        "root",
        "child",
    ]);
});

test("unlock order sorts by player level and then trader task-count milestone", () => {
    const taskCountRequirement = (requiredCount: number) => ({
        type: "globalVariable",
        requirementType: "globalVariable",
        variableId: "6a20540cf1b67a977cc5a088",
        compareMethod: ">=",
        value: requiredCount,
    });
    const quests = [
        makeQuest("level-two", { minPlayerLevel: 2 }),
        makeQuest("five-tasks", {
            otherRequirements: [taskCountRequirement(5)],
        }),
        makeQuest("one-task", {
            otherRequirements: [taskCountRequirement(1)],
        }),
        makeQuest("no-task-gate"),
    ];

    assert.deepEqual(sortIds(quests, "unlockOrder"), [
        "no-task-gate",
        "one-task",
        "five-tasks",
        "level-two",
    ]);
});

test("unlock order keeps prerequisite chains together", () => {
    const root = makeQuest("root");
    const child = makeQuest("child", { minPlayerLevel: 20, prereqIds: ["root"] });
    const other = makeQuest("other", { minPlayerLevel: 2 });

    assert.deepEqual(sortIds([child, other, root], "unlockOrder"), [
        "root",
        "child",
        "other",
    ]);
});

test("level sort orders lower level requirements first", () => {
    const quests = [
        makeQuest("late", { minPlayerLevel: 20 }),
        makeQuest("none", { minPlayerLevel: null }),
        makeQuest("early", { minPlayerLevel: 2 }),
    ];

    assert.deepEqual(sortIds(quests, "level"), ["none", "early", "late"]);
});

test("xp sort orders highest experience first", () => {
    const quests = [
        makeQuest("low", { experience: 1000 }),
        makeQuest("high", { experience: 9000 }),
        makeQuest("mid", { experience: 4000 }),
    ];

    assert.deepEqual(sortIds(quests, "xp"), ["high", "mid", "low"]);
});

test("unlock impact counts unique transitive downstream quests", () => {
    const quests = [
        makeQuest("a"),
        makeQuest("b", { prereqIds: ["a"] }),
        makeQuest("c", { prereqIds: ["a"] }),
        makeQuest("d", { prereqIds: ["b", "c"] }),
    ];
    const impact = buildQuestUnlockImpactMap(quests);

    assert.equal(impact.get("a"), 3);
    assert.equal(impact.get("b"), 1);
    assert.equal(impact.get("c"), 1);
    assert.equal(impact.get("d"), 0);
    assert.deepEqual(sortIds(quests, "unlockImpact"), ["a", "b", "c", "d"]);
});

test("unlock impact handles cycles without double-counting the root quest", () => {
    const quests = [
        makeQuest("a", { prereqIds: ["c"] }),
        makeQuest("b", { prereqIds: ["a"] }),
        makeQuest("c", { prereqIds: ["b"] }),
    ];
    const impact = buildQuestUnlockImpactMap(quests);

    assert.equal(impact.get("a"), 2);
    assert.equal(impact.get("b"), 2);
    assert.equal(impact.get("c"), 2);
});

test("non-default sort modes use default order as stable tie-breaker", () => {
    const quests = [
        makeQuest("third", { experience: 1000, minPlayerLevel: 10 }),
        makeQuest("first", { experience: 1000, minPlayerLevel: 10 }),
        makeQuest("second", { experience: 1000, minPlayerLevel: 10 }),
    ];

    assert.deepEqual(sortIds(quests, "xp", ["first", "second", "third"]), [
        "first",
        "second",
        "third",
    ]);
});

test("map view sort demotes quests that belong to multiple map groups", () => {
    const quests = [
        makeQuest("multi-map", {
            objectives: [
                {
                    id: "obj-1",
                    type: "visit",
                    description: "Visit Customs",
                    optional: false,
                    maps: [customs, shoreline],
                },
            ],
        }),
        makeQuest("single-map", { map: customs }),
    ];

    assert.deepEqual(sortMapIds(quests, "default", ["multi-map", "single-map"]), [
        "single-map",
        "multi-map",
    ]);
});
