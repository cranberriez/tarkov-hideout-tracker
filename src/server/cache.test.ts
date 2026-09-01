import assert from "node:assert/strict";
import test from "node:test";
import { getCachePolicy, namespaceRedisKey } from "./cache";

test("namespaceRedisKey isolates development Redis keys", () => {
    assert.equal(namespaceRedisKey("quests:full:v10", "development"), "dev:quests:full:v10");
});

test("namespaceRedisKey preserves production Redis key bytes", () => {
    const key = "item-market-data:filtered:v3:pve:meta";

    assert.equal(namespaceRedisKey(key, "production"), key);
    assert.equal(namespaceRedisKey(key, "test"), key);
    assert.equal(namespaceRedisKey(key, undefined), key);
});

test("global cache operation flags override dataset flags", () => {
    const previousGlobal = process.env.CACHE_REDIS_WRITE_ENABLED;
    const previousQuest = process.env.CACHE_QUESTS_FULL_REDIS_WRITE_ENABLED;
    try {
        process.env.CACHE_REDIS_WRITE_ENABLED = "false";
        process.env.CACHE_QUESTS_FULL_REDIS_WRITE_ENABLED = "true";
        assert.equal(getCachePolicy("questsFull").redisWrite, false);

        delete process.env.CACHE_REDIS_WRITE_ENABLED;
        assert.equal(getCachePolicy("questsFull").redisWrite, true);
    } finally {
        if (previousGlobal === undefined) delete process.env.CACHE_REDIS_WRITE_ENABLED;
        else process.env.CACHE_REDIS_WRITE_ENABLED = previousGlobal;
        if (previousQuest === undefined) {
            delete process.env.CACHE_QUESTS_FULL_REDIS_WRITE_ENABLED;
        } else {
            process.env.CACHE_QUESTS_FULL_REDIS_WRITE_ENABLED = previousQuest;
        }
    }
});
