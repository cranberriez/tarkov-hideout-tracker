import assert from "node:assert/strict";
import test from "node:test";
import { Redis } from "@upstash/redis";

test("Redis failures degrade reads to misses and writes to no-ops", async (context) => {
    const failure = new Error("Redis unavailable");
    const failingClient = {
        get: async () => Promise.reject(failure),
        mget: async () => Promise.reject(failure),
        mset: async () => Promise.reject(failure),
    } as unknown as ReturnType<typeof Redis.fromEnv>;

    context.mock.method(Redis, "fromEnv", () => failingClient);
    context.mock.method(console, "warn", () => undefined);

    const { getRedisCacheStatus, redis } = await import("./redis");

    assert.equal(await redis.get("itemCatalog", "one"), null);
    assert.deepEqual(await redis.mget("itemCatalog", "one", "two"), [null, null]);
    assert.equal(await redis.mset("itemCatalog", { one: "value" }), null);
    assert.equal(getRedisCacheStatus().state, "unavailable");
});
