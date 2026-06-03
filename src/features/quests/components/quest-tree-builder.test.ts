import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "@/types";
import { buildTraderTree } from "./quest-tree-builder";

function makeQuest(
    id: string,
    traderId: string,
    taskRequirementIds: string[] = [],
): FullQuest {
    return {
        id,
        name: id,
        normalizedName: id,
        trader: { id: traderId, name: traderId, imageLink: null, image4xLink: null },
        taskRequirements: taskRequirementIds.map((requirementId) => ({
            task: { id: requirementId, name: requirementId },
        })),
        minPlayerLevel: 1,
        objectives: [],
        kappaRequired: false,
        lightkeeperRequired: false,
        factionName: "Any",
        map: null,
        wikiLink: null,
        experience: 0,
        traderRequirements: [],
        requiredPrestige: 0,
    } as FullQuest;
}

test("buildTraderTree bridges visible external prerequisites back to the same trader", () => {
    const traderAQuestA = makeQuest("trader-a-quest-a", "trader-a");
    const traderBQuestA = makeQuest("trader-b-quest-a", "trader-b", ["trader-a-quest-a"]);
    const traderAQuestB = makeQuest("trader-a-quest-b", "trader-a", ["trader-b-quest-a"]);
    const visibleQuests = [traderAQuestA, traderBQuestA, traderAQuestB];

    const tree = buildTraderTree([traderAQuestA, traderAQuestB], visibleQuests);

    assert.deepEqual(tree.rootIds, ["trader-a-quest-a"]);
    assert.equal(tree.parentOf.get("trader-a-quest-b"), "trader-a-quest-a");
    assert.deepEqual(tree.childrenOf.get("trader-a-quest-a"), ["trader-a-quest-b"]);
});

test("buildTraderTree does not bridge through filtered-out external prerequisites", () => {
    const traderAQuestA = makeQuest("trader-a-quest-a", "trader-a");
    const traderAQuestB = makeQuest("trader-a-quest-b", "trader-a", ["trader-b-quest-a"]);
    const visibleQuests = [traderAQuestA, traderAQuestB];

    const tree = buildTraderTree([traderAQuestA, traderAQuestB], visibleQuests);

    assert.deepEqual(tree.rootIds, ["trader-a-quest-a", "trader-a-quest-b"]);
    assert.equal(tree.parentOf.get("trader-a-quest-b"), null);
    assert.equal(tree.childrenOf.get("trader-a-quest-a"), undefined);
});

test("buildTraderTree keeps direct same-trader prerequisites ahead of bridged options", () => {
    const traderAQuestA = makeQuest("trader-a-quest-a", "trader-a");
    const traderAQuestB = makeQuest("trader-a-quest-b", "trader-a", ["trader-a-quest-a"]);
    const traderBQuestA = makeQuest("trader-b-quest-a", "trader-b", ["trader-a-quest-a"]);
    const traderAQuestC = makeQuest("trader-a-quest-c", "trader-a", [
        "trader-a-quest-b",
        "trader-b-quest-a",
    ]);
    const visibleQuests = [traderAQuestA, traderAQuestB, traderBQuestA, traderAQuestC];

    const tree = buildTraderTree([traderAQuestA, traderAQuestB, traderAQuestC], visibleQuests);

    assert.equal(tree.parentOf.get("trader-a-quest-c"), "trader-a-quest-b");
});

test("buildTraderTree does not bridge a cyclic external prerequisite back to itself", () => {
    const traderAQuestA = makeQuest("trader-a-quest-a", "trader-a", ["trader-b-quest-a"]);
    const traderBQuestA = makeQuest("trader-b-quest-a", "trader-b", ["trader-a-quest-a"]);
    const visibleQuests = [traderAQuestA, traderBQuestA];

    const tree = buildTraderTree([traderAQuestA], visibleQuests);

    assert.deepEqual(tree.rootIds, ["trader-a-quest-a"]);
    assert.equal(tree.parentOf.get("trader-a-quest-a"), null);
});
