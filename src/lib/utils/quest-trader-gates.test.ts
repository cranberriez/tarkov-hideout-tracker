import assert from "node:assert/strict";
import test from "node:test";

import type { QuestTraderRequirement } from "../../types/types";
import {
    deriveQuestTraderGate,
    formatQuestTraderGate,
    getQuestTraderGateType,
    isQuestTraderLoyaltyRequirement,
} from "./quest-trader-gates";

function makeRequirement(
    requirementType: string,
    overrides: Partial<QuestTraderRequirement> = {},
): QuestTraderRequirement {
    return {
        id: overrides.id ?? `requirement-${requirementType}`,
        trader: overrides.trader ?? {
            id: "trader",
            name: "Trader",
            normalizedName: "trader",
            imageLink: null,
            image4xLink: null,
        },
        requirementType,
        compareMethod: overrides.compareMethod ?? ">=",
        value: overrides.value ?? 2,
    };
}

test("classifies JSON and legacy loyalty gate names as level", () => {
    const jsonGate = makeRequirement("level");
    const legacyGate = makeRequirement("loyaltyLevel");

    assert.equal(getQuestTraderGateType(jsonGate), "level");
    assert.equal(getQuestTraderGateType(legacyGate), "level");
    assert.equal(isQuestTraderLoyaltyRequirement(jsonGate), true);
    assert.equal(isQuestTraderLoyaltyRequirement(legacyGate), true);
});

test("keeps reputation and unknown gate kinds distinct", () => {
    assert.equal(getQuestTraderGateType(makeRequirement("reputation")), "reputation");
    assert.equal(getQuestTraderGateType(makeRequirement("globalVariable")), "unknown");
    assert.equal(
        deriveQuestTraderGate(makeRequirement("globalVariable")).type,
        "unknown",
    );
});

test("formats level and reputation gates without mislabeling unknown kinds", () => {
    assert.equal(formatQuestTraderGate(makeRequirement("level")), "Trader LL2");
    assert.equal(formatQuestTraderGate(makeRequirement("reputation")), "Trader Rep >= 2");
    assert.equal(
        formatQuestTraderGate(makeRequirement("globalVariable")),
        "Trader globalVariable >= 2",
    );
});
