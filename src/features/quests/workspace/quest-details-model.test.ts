import assert from "node:assert/strict";
import test from "node:test";
import {
    compareRequirementValue,
    formatOtherRequirementDetails,
    isTaskRequirementSatisfied,
} from "./quest-details-model";

test("compares requirement values using supported operators and defaults to minimum", () => {
    assert.equal(compareRequirementValue(3, ">", 2), true);
    assert.equal(compareRequirementValue(3, "<=", 2), false);
    assert.equal(compareRequirementValue(3, "===", 3), true);
    assert.equal(compareRequirementValue(3, "!==", 3), false);
    assert.equal(compareRequirementValue(3, "unknown", 2), true);
});

test("evaluates success, failure, and active task requirements", () => {
    assert.equal(isTaskRequirementSatisfied(["Success"], true, false), true);
    assert.equal(isTaskRequirementSatisfied(["Failed"], false, true), true);
    assert.equal(isTaskRequirementSatisfied(["Active"], false, true), true);
    assert.equal(isTaskRequirementSatisfied(["Complete"], false, true), false);
});

test("formats unknown requirement properties without discriminator noise", () => {
    assert.equal(formatOtherRequirementDetails({
        id: "gate",
        type: "other",
        requirementType: "custom",
        compareMethod: ">=",
        nestedValue: { taskCount: 4 },
    }), "Compare Method: >= · Nested Value: Task Count 4");
});
