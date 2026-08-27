import assert from "node:assert/strict";
import test from "node:test";
import { namespaceRedisKey } from "./cache";

test("namespaceRedisKey isolates development Redis keys", () => {
    assert.equal(namespaceRedisKey("quests:full:v10", "development"), "dev:quests:full:v10");
});

test("namespaceRedisKey preserves production Redis key bytes", () => {
    const key = "item-market-data:filtered:v3:pve:meta";

    assert.equal(namespaceRedisKey(key, "production"), key);
    assert.equal(namespaceRedisKey(key, "test"), key);
    assert.equal(namespaceRedisKey(key, undefined), key);
});
