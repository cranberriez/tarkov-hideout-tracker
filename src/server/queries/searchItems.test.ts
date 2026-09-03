import assert from "node:assert/strict";
import test from "node:test";
import { ITEM_SEARCH_MAX_QUERY_LENGTH } from "../../types/contracts";
import { isValidItemSearchQuery } from "./searchItems";

test("item search validates normalized query text and length", () => {
    assert.equal(isValidItemSearchQuery("bolts"), true);
    assert.equal(isValidItemSearchQuery("  pack of sugar  "), true);
    assert.equal(isValidItemSearchQuery("   "), false);
    assert.equal(
        isValidItemSearchQuery("x".repeat(ITEM_SEARCH_MAX_QUERY_LENGTH + 1)),
        false,
    );
});
