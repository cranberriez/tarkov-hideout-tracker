import assert from "node:assert/strict";
import test from "node:test";
import { isCompleteItemUsageData } from "./item-usage";

test("only fully successful item usage responses are cacheable", () => {
    assert.equal(isCompleteItemUsageData({}), true);
    assert.equal(
        isCompleteItemUsageData({
            bartersError: "temporarily unavailable",
        }),
        false,
    );
    assert.equal(
        isCompleteItemUsageData({
            craftsError: "temporarily unavailable",
        }),
        false,
    );
    assert.equal(
        isCompleteItemUsageData({
            presentationError: "temporarily unavailable",
        }),
        false,
    );
});
