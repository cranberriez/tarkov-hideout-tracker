import assert from "node:assert/strict";
import test from "node:test";
import { isCompleteItemUsagePayload } from "./item-usage";

test("only fully successful item usage responses are cacheable", () => {
    assert.equal(isCompleteItemUsagePayload({ barters: [], crafts: [] }), true);
    assert.equal(
        isCompleteItemUsagePayload({
            barters: [],
            crafts: [],
            bartersError: "temporarily unavailable",
        }),
        false,
    );
    assert.equal(
        isCompleteItemUsagePayload({
            barters: [],
            crafts: [],
            craftsError: "temporarily unavailable",
        }),
        false,
    );
    assert.equal(
        isCompleteItemUsagePayload({
            barters: [],
            crafts: [],
            presentationError: "temporarily unavailable",
        }),
        false,
    );
});
