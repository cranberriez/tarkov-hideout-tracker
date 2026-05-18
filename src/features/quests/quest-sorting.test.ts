import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "@/types";
import {
    buildQuestUnlockImpactMap,
    sortQuestsForQuestView,
    type QuestSortMode,
} from "./quest-sorting";

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
