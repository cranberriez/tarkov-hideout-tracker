import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url, { alias: { "@": path.join(process.cwd(), "src") } });
const { prefetchPageData } = await jiti.import<typeof import("./prefetchPageData")>("./prefetchPageData.ts");

test("server prefetch dehydrates complete data without duplicating fallback props", async () => {
    const result = await prefetchPageData(["game-data", "regular", "test"], 60_000, async () => ({ complete: true }), (data) => data.complete);
    assert.equal(result.fallbackData, null);
    assert.equal(result.state.queries.length, 1);
    assert.deepEqual(result.state.queries[0].state.data, { complete: true });
});

test("server prefetch keeps partial data only as a refetchable fallback", async () => {
    const partial = { complete: false, errors: ["missing"] };
    const result = await prefetchPageData(["game-data", "pve", "test"], 60_000, async () => partial, (data) => data.complete);
    assert.equal(result.state.queries.length, 0);
    assert.equal(result.fallbackData, partial);
});

test("server prefetch leaves no fallback when the loader fails", async () => {
    const result = await prefetchPageData(["game-data", "regular", "failed"], 60_000, async () => {
        throw new Error("offline");
    }, () => true);
    assert.equal(result.state.queries.length, 0);
    assert.equal(result.fallbackData, null);
});
