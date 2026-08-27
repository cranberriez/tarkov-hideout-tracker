import assert from "node:assert/strict";
import test from "node:test";

import type { QuestAvailabilityQuest } from "./quest-availability";
import {
    compareTraderTierCompletionCount,
    countCompletedTraderTierQuests,
    getTraderTierCompletionGate,
} from "./quest-trader-completion-gates";

function makeQuest(
    id: string,
    traderName = "Prapor",
    loyaltyLevel = 1,
): QuestAvailabilityQuest {
    const normalizedName = traderName.toLowerCase();
    return {
        id,
        factionName: "Any",
        minPlayerLevel: 1,
        taskRequirements: [],
        trader: { id: normalizedName, name: traderName, normalizedName },
        traderRequirements: loyaltyLevel === 1 ? [] : [{
            id: `${id}-ll`,
            trader: { id: normalizedName, name: traderName, normalizedName },
            requirementType: "level",
            compareMethod: ">=",
            value: loyaltyLevel,
        }],
        otherRequirements: [],
    };
}

test("recognizes a mapped global variable as a trader-tier completion gate", () => {
    assert.deepEqual(getTraderTierCompletionGate({
        type: "globalVariable",
        variableId: "6a20540cf1b67a977cc5a088",
        compareMethod: ">=",
        value: 3,
    }), {
        variableId: "6a20540cf1b67a977cc5a088",
        trader: "Prapor",
        tier: 1,
        compareMethod: ">=",
        requiredCount: 3,
    });
});

test("counts only completed quests from the counter's trader and tier", () => {
    const gate = getTraderTierCompletionGate({
        type: "globalVariable",
        variableId: "6a20540cf1b67a977cc5a088",
        compareMethod: ">=",
        value: 3,
    });
    assert.ok(gate);

    const completedCount = countCompletedTraderTierQuests([
        makeQuest("p1"),
        makeQuest("p2"),
        makeQuest("p-ll2", "Prapor", 2),
        makeQuest("s1", "Skier"),
        makeQuest("p-incomplete"),
    ], {
        p1: true,
        p2: true,
        "p-ll2": true,
        s1: true,
    }, gate);

    assert.equal(completedCount, 2);
    assert.equal(compareTraderTierCompletionCount(completedCount, gate), false);
    assert.equal(compareTraderTierCompletionCount(3, gate), true);
});

test("leaves unknown global variables unclassified", () => {
    assert.equal(getTraderTierCompletionGate({
        type: "globalVariable",
        variableId: "unknown",
        compareMethod: ">=",
        value: 3,
    }), null);
});
