import test from "node:test";
import assert from "node:assert/strict";

import type { FullQuest } from "../../../types";
import {
    buildLinkedPrerequisiteEntries,
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

test("buildLinkedPrerequisiteEntries hides completed external prerequisites", () => {
    const quest = makeQuest("quest", "trader-a", [
        "primary-parent",
        "completed-external",
        "locked-external",
    ]);
    const parentOf = new Map<string, string | null>([["quest", "primary-parent"]]);
    const questsById = new Map([["quest", quest]]);

    const entries = buildLinkedPrerequisiteEntries({
        quest,
        parentOf,
        questsById,
        completedQuests: { "completed-external": true },
        ignoredQuests: {},
        syncProfile: {
            playerLevel: 1,
            prestigeLevel: 0,
            faction: null,
            traderLoyaltyLevels: {},
            completedQuests: { "completed-external": true },
        },
    });

    assert.deepEqual(
        entries.map((entry) => [entry.questRef.id, entry.status, entry.folded]),
        [["locked-external", "locked", false]],
    );
});

test("buildLinkedPrerequisiteEntries returns no entries when all external prerequisites are completed", () => {
    const quest = makeQuest("quest", "trader-a", ["completed-a", "completed-b"]);

    const entries = buildLinkedPrerequisiteEntries({
        quest,
        parentOf: new Map([["quest", null]]),
        questsById: new Map([["quest", quest]]),
        completedQuests: { "completed-a": true, "completed-b": true },
        ignoredQuests: {},
        syncProfile: {
            playerLevel: 1,
            prestigeLevel: 0,
            faction: null,
            traderLoyaltyLevels: {},
            completedQuests: { "completed-a": true, "completed-b": true },
        },
    });

    assert.deepEqual(entries, []);
});
