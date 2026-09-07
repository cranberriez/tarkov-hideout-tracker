import assert from "node:assert/strict";
import test from "node:test";
import { boundedReadCache, canonicalIds, ENTITY_BATCH_SIZE, mapBatches, MAX_CACHE_BYTES } from "./read-cache";

function memoryCache() {
    const entries = new Map<string, unknown>();
    const durations: Array<number | false | undefined> = [];
    const cache = ((read, keys, options) => async () => {
        const key = JSON.stringify(keys);
        durations.push(options?.revalidate);
        if (entries.has(key)) return entries.get(key);
        const value = await read();
        entries.set(key, value);
        return value;
    }) as typeof import("next/cache").unstable_cache;
    return { entries, durations, cache };
}

test("canonical batches bound concurrency and preserve result order", async () => {
    assert.deepEqual(canonicalIds(["b", "a", "b"]), ["a", "b"]);
    const ids = Array.from({ length: ENTITY_BATCH_SIZE * 5 + 1 }, (_, index) => String(index));
    let active = 0;
    let peak = 0;
    const results = await mapBatches(ids, async (batch) => {
        active++;
        peak = Math.max(peak, active);
        assert.ok(batch.length <= ENTITY_BATCH_SIZE);
        await new Promise((resolve) => setImmediate(resolve));
        active--;
        return batch;
    });
    assert.equal(peak, 3);
    assert.deepEqual(results.flat(), ids);
    assert.deepEqual(await mapBatches([], async (batch) => batch), [[]]);
    await assert.rejects(mapBatches(ids, async () => { throw new Error("database offline"); }), /database offline/);
});

test("cache keys isolate mode, release and canonical IDs and honor price lifetime", async () => {
    const { cache, entries, durations } = memoryCache();
    let reads = 0;
    const read = () => Promise.resolve(++reads);
    const key = (mode: string, release: string, ids: string[]) =>
        ["entities", mode, release, "item", "items", JSON.stringify(canonicalIds(ids))];
    assert.equal(await boundedReadCache(key("regular", "r1", ["b", "a"]), read, false, cache), 1);
    assert.equal(await boundedReadCache(key("regular", "r1", ["a", "b", "a"]), read, false, cache), 1);
    await boundedReadCache(key("pve", "r1", ["a", "b"]), read, false, cache);
    await boundedReadCache(key("regular", "r2", ["a", "b"]), read, false, cache);
    await boundedReadCache(["mutable-prices", "regular", "r1", "[]"], read, 300, cache);
    assert.equal(entries.size, 4);
    assert.equal(durations.at(-1), 300);
});

test("oversized UTF-8 results are delivered intact and never cached; failures remain retryable", async () => {
    const { cache, entries } = memoryCache();
    const value = { payload: "界".repeat(MAX_CACHE_BYTES) };
    let reads = 0;
    const read = async () => { reads++; return value; };
    assert.equal(await boundedReadCache(["large"], read, false, cache), value);
    assert.equal(await boundedReadCache(["large"], read, false, cache), value);
    assert.equal(reads, 2);
    assert.equal(entries.size, 0);
    await assert.rejects(boundedReadCache(["failed"], async () => { throw new Error("bad JSON"); }, false, cache), /bad JSON/);
    assert.equal(entries.size, 0);
    assert.deepEqual(await boundedReadCache(["empty-ready-release"], async () => ({ data: [], updatedAt: 1 }), false, cache), { data: [], updatedAt: 1 });
    assert.equal(entries.size, 1);
});
