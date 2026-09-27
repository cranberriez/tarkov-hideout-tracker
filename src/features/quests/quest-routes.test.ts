import assert from "node:assert/strict";
import test from "node:test";
import { getLegacyQuestHashId, questHref } from "./quest-routes";

test("quest hrefs encode IDs and keep the development fixture query", () => {
    assert.equal(questHref("5936d90786f7742b1420ba5b"), "/quests/5936d90786f7742b1420ba5b");
    assert.equal(questHref("a/b"), "/quests/a%2Fb");
    assert.equal(questHref("dev-test-quest", "dev-test"), "/quests/dev-test-quest?q=dev-test");
});

test("legacy quest fragments resolve to their quest ID", () => {
    assert.equal(getLegacyQuestHashId("#quest-abc"), "abc");
    assert.equal(getLegacyQuestHashId("#objectives"), null);
    assert.equal(getLegacyQuestHashId(""), null);
});
