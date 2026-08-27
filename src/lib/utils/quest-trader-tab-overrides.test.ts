import assert from "node:assert/strict";
import test from "node:test";

import {
    getQuestLoyaltyLevelOverride,
    getQuestTraderTabOverride,
    isEssentialQuestOverride,
} from "./quest-trader-tab-overrides";

test("looks up reviewed trader tabs exclusively by quest ID", () => {
    assert.equal(getQuestTraderTabOverride("59674eb386f774539f14813a"), 2);
    assert.equal(getQuestLoyaltyLevelOverride("59674eb386f774539f14813a"), 2);
    assert.equal(getQuestTraderTabOverride("597a171586f77405ba6887d3"), "essential");
    assert.equal(getQuestLoyaltyLevelOverride("597a171586f77405ba6887d3"), null);
    assert.equal(isEssentialQuestOverride("597a171586f77405ba6887d3"), true);
    assert.equal(getQuestTraderTabOverride("unknown-quest-id"), null);
});
