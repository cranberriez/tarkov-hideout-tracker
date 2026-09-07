import test from "node:test";
import assert from "node:assert/strict";
import { createDeferredPriceLoader, PriceReleaseChangedError } from "./deferred-prices";

test("release conflicts request page refresh and do not poison the next release", async () => {
    const load = createDeferredPriceLoader(async (_url, init) => {
        const { releaseId } = JSON.parse(String(init?.body));
        return releaseId === "old" ? new Response(null, { status: 409 }) : Response.json({ prices: {} });
    });
    await assert.rejects(load("regular:old:a", "regular", "old", ["a"]), PriceReleaseChangedError);
    assert.equal((await load("regular:new:a", "regular", "new", ["a"])).state, "ready");
});

test("deduplicates in-flight requests and caches complete prices for one minute", async () => {
    let calls = 0;
    let now = 0;
    const load = createDeferredPriceLoader(async () => { calls++; return Response.json({ prices: { a: { price: 42 } } }); }, () => now);
    const [first, second] = await Promise.all([load("regular:release:a", "regular", "release", ["a"]), load("regular:release:a", "regular", "release", ["a"])]);
    assert.equal(first, second);
    assert.equal(calls, 1);
    await load("regular:release:a", "regular", "release", ["a"]);
    assert.equal(calls, 1);
    now = 60_001;
    await load("regular:release:a", "regular", "release", ["a"]);
    assert.equal(calls, 2);
    await load("pve:release:a", "pve", "release", ["a"]);
    await load("regular:release2:a", "regular", "release2", ["a"]);
    assert.equal(calls, 4);
});

test("failed and malformed responses remain retryable without publishing partial prices", async () => {
    let calls = 0;
    const load = createDeferredPriceLoader(async () => {
        calls++;
        if (calls === 1) return new Response("failed", { status: 503 });
        if (calls === 2) return Response.json({});
        return Response.json({ prices: {} });
    });
    await assert.rejects(load("key", "regular", "release", ["a"]));
    await assert.rejects(load("key", "regular", "release", ["a"]));
    assert.deepEqual(await load("key", "regular", "release", ["a"]), { state: "ready", prices: {} });
    assert.equal(calls, 3);
});

test("large pages request batches of at most 128 IDs with at most three concurrent requests", async () => {
    let active = 0;
    let peak = 0;
    const seen: string[] = [];
    const load = createDeferredPriceLoader(async (_url, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.mode, "pvp-season");
        assert.equal(body.releaseId, "release");
        assert.ok(body.ids.length <= 128);
        seen.push(...body.ids);
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return Response.json({ prices: {} });
    });
    const ids = Array.from({ length: 800 }, (_, index) => String(index));
    await load("key", "pvp-season", "release", ids);
    assert.deepEqual(seen, ids);
    assert.equal(peak, 3);
});
