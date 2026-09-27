import assert from "node:assert/strict";
import test from "node:test";
import { hasDisplayQuestLevel } from "./quest-display";

test("quest level display hides missing and non-positive minimums", () => {
    assert.equal(hasDisplayQuestLevel(undefined), false);
    assert.equal(hasDisplayQuestLevel(null), false);
    assert.equal(hasDisplayQuestLevel(0), false);
    assert.equal(hasDisplayQuestLevel(-1), false);
});

test("quest level display keeps meaningful minimum levels", () => {
    assert.equal(hasDisplayQuestLevel(1), true);
    assert.equal(hasDisplayQuestLevel(15), true);
});
