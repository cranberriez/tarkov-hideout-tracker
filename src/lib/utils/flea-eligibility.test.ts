import assert from "node:assert/strict";
import test from "node:test";
import { isOnFleaMarket } from "./flea-eligibility";

test("marks noFlea items as ineligible for endpoint polling", () => {
    assert.equal(isOnFleaMarket(["barter", "noFlea"]), false);
    assert.equal(isOnFleaMarket(["barter"]), true);
});
