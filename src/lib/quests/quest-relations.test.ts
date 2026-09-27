import assert from "node:assert/strict";
import test from "node:test";
import { formatQuestUnlockTiming, formatTaskRequirementStatus, getQuestRelationTiming } from "./quest-relations";

test("maps task requirement statuses to quest relationship timing", () => {
    assert.equal(getQuestRelationTiming(["complete"]), "complete");
    assert.equal(getQuestRelationTiming(["Active"]), "active");
    assert.equal(getQuestRelationTiming(["active", "complete"]), "active");
    assert.equal(getQuestRelationTiming(["failed"]), "failed");
    assert.equal(getQuestRelationTiming(["complete", "failed"]), "resolved");
});

test("formats unlock timing for display", () => {
    assert.equal(formatQuestUnlockTiming(["complete"]), "On complete");
    assert.equal(formatQuestUnlockTiming(["active"]), "On accept");
    assert.equal(formatQuestUnlockTiming(["failed"]), "On fail");
    assert.equal(formatQuestUnlockTiming(["complete", "failed"]), "On complete or fail");
});

test("formats active task requirements as quest active", () => {
    assert.equal(formatTaskRequirementStatus(["Active"]), "Quest active");
    assert.equal(formatTaskRequirementStatus(["complete"]), "Task completed");
    assert.equal(formatTaskRequirementStatus(["complete", "failed"]), "Task completed or failed");
});
