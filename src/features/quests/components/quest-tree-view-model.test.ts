import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../../types";
import {
    buildQuestTreeData,
    collectLinearChainIds,
    countAllDescendants,
    getTraderCompletion,
} from "./quest-tree-view-model";

function makeQuest(id: string, traderId: string, taskRequirementIds: string[] = []): FullQuest {
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
    };
}

test("buildQuestTreeData groups visible quests and omits traders without matches", () => {
    const traderAQuestA = makeQuest("trader-a-quest-a", "trader-a");
    const traderAQuestB = makeQuest("trader-a-quest-b", "trader-a", ["trader-a-quest-a"]);
    const traderBQuestA = makeQuest("trader-b-quest-a", "trader-b");
    const traders = [traderAQuestA.trader, traderBQuestA.trader];

    const data = buildQuestTreeData({
        filteredQuests: [traderAQuestA, traderAQuestB],
        quests: [traderAQuestA, traderAQuestB, traderBQuestA],
        traders,
    });

    assert.deepEqual(
        data.visibleTraders.map((trader) => trader.id),
        ["trader-a"],
    );
    assert.deepEqual(
        data.questsByTraderId.get("trader-a")?.map((quest) => quest.id),
        ["trader-a-quest-a", "trader-a-quest-b"],
    );
    assert.deepEqual(
        data.allQuestsByTraderId.get("trader-b")?.map((quest) => quest.id),
        ["trader-b-quest-a"],
    );
    assert.deepEqual(data.treeMetaByTraderId.get("trader-a")?.rootIds, ["trader-a-quest-a"]);
});

test("tree descendant helpers summarize collapsed branches and linear chains", () => {
    const childrenOf = new Map<string, string[]>([
        ["root", ["child-a"]],
        ["child-a", ["child-b"]],
        ["child-b", ["leaf-a", "leaf-b"]],
    ]);

    assert.deepEqual(collectLinearChainIds("root", childrenOf), ["child-a", "child-b"]);
    assert.equal(countAllDescendants(["child-a"], childrenOf), 4);
});

test("getTraderCompletion calculates completed totals and percentage", () => {
    const quests = [makeQuest("quest-a", "trader-a"), makeQuest("quest-b", "trader-a")];

    assert.deepEqual(getTraderCompletion(quests, { "quest-a": true }), {
        total: 2,
        completed: 1,
        pct: 50,
    });
});
