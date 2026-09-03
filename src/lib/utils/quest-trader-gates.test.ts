import assert from "node:assert/strict";
import test from "node:test";

import type { QuestTraderRequirement } from "@/types/quests";
import {
    deriveQuestTraderGate,
    formatQuestTraderGate,
    getQuestTraderGateType,
    getQuestIssuingTraderLoyaltyLevel,
    isQuestTraderLoyaltyRequirement,
    questMatchesTraderRequirementProfile,
    questTraderRequirementMatchesProfile,
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

test("derives the issuing trader loyalty level and defaults ungated quests to level 1", () => {
    const trader = { id: "trader", name: "Trader", normalizedName: "trader" };
    assert.equal(getQuestIssuingTraderLoyaltyLevel({ trader, traderRequirements: [] }), 1);
    assert.equal(getQuestIssuingTraderLoyaltyLevel({
        trader,
        traderRequirements: [
            makeRequirement("level", { value: 3, trader }),
            makeRequirement("level", { value: 4, trader: { ...trader, id: "other" } }),
        ],
    }), 3);
});

test("uses the reviewed trader-tab tier when Tarkov.dev has no level gate", () => {
    const prapor = { id: "prapor", name: "Prapor", normalizedName: "prapor" };

    assert.equal(getQuestIssuingTraderLoyaltyLevel({
        id: "59674eb386f774539f14813a",
        trader: prapor,
        traderRequirements: [],
    }), 2);
});

test("matches loyalty and Fence reputation requirements against the trader profile", () => {
    const trader = { id: "trader", name: "Trader", normalizedName: "trader" };
    const fence = { id: "fence", name: "Fence", normalizedName: "fence" };
    const profile = { traderLoyaltyLevels: { trader: 2 }, fenceReputation: 1.5 };

    assert.equal(questMatchesTraderRequirementProfile({ traderRequirements: [
        makeRequirement("level", { trader, value: 2 }),
        makeRequirement("reputation", { trader: fence, value: 1, compareMethod: ">=" }),
    ] }, profile), true);
    assert.equal(questMatchesTraderRequirementProfile({ traderRequirements: [
        makeRequirement("reputation", { trader: fence, value: 2, compareMethod: ">" }),
    ] }, profile), false);
});

test("matches maximum Fence reputation requirements at the exact boundary", () => {
    const fence = { id: "fence", name: "Fence", normalizedName: "fence" };
    const requirement = makeRequirement("reputation", {
        trader: fence,
        value: -1,
        compareMethod: "<=",
    });

    assert.equal(questTraderRequirementMatchesProfile(requirement, {
        traderLoyaltyLevels: {},
        fenceReputation: 0,
    }), false);
    assert.equal(questTraderRequirementMatchesProfile(requirement, {
        traderLoyaltyLevels: {},
        fenceReputation: -1,
    }), true);
    assert.equal(questTraderRequirementMatchesProfile(requirement, {
        traderLoyaltyLevels: {},
        fenceReputation: -2,
    }), true);
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
