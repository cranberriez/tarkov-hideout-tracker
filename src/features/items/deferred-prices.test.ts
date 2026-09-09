import test from "node:test";
import assert from "node:assert/strict";
import { createQueryClient } from "../../lib/query/client";
import { deferredPricesQueryOptions } from "./deferred-prices";

function priceResponse(body: RequestInit | undefined, prices: object = {}) {
    JSON.parse(String(body?.body));
    return Response.json({ prices });
}

test("Query owns in-flight reuse and one-minute complete-result freshness", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
        calls++;
        await new Promise((resolve) => setTimeout(resolve, 1));
        return priceResponse(init, { a: { price: 42 } });
    };
    const client = createQueryClient();
    try {
        const options = deferredPricesQueryOptions("regular", ["a", "a"]);
        const [first, second] = await Promise.all([client.fetchQuery(options), client.fetchQuery(options)]);
        assert.equal(first, second);
        assert.equal(first.a.price, 42);
        assert.equal(calls, 1);
        await client.fetchQuery(options);
        assert.equal(calls, 1);
        assert.equal(options.staleTime, 60_000);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});

test("failed and malformed batches remain retryable without caching partial prices", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async (_input, init) => {
        calls++;
        if (calls === 2) return new Response("failed", { status: 503 });
        if (calls === 3) return Response.json({});
        return priceResponse(init);
    };
    const client = createQueryClient();
    try {
        const ids = Array.from({ length: 129 }, (_, index) => index === 0 ? "a" : String(index).padStart(24, "0"));
        const options = deferredPricesQueryOptions("regular", ids);
        await assert.rejects(client.fetchQuery(options));
        assert.equal(client.getQueryData(options.queryKey), undefined);
        await assert.rejects(client.fetchQuery(options), /Invalid price response/);
        assert.equal(client.getQueryData(options.queryKey), undefined);
        await client.fetchQuery(options);
        assert.ok(calls >= 5);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});

test("canonical batches contain at most 128 IDs and run at most three at once", async () => {
    const originalFetch = globalThis.fetch;
    let active = 0;
    let peak = 0;
    const seen: string[] = [];
    globalThis.fetch = async (_input, init) => {
        const body = JSON.parse(String(init?.body));
        assert.equal(body.mode, "pvp-season");
        assert.equal(body.releaseId, undefined);
        assert.ok(body.ids.length <= 128);
        seen.push(...body.ids);
        peak = Math.max(peak, ++active);
        await new Promise((resolve) => setTimeout(resolve, 1));
        active--;
        return priceResponse(init);
    };
    const client = createQueryClient();
    const ids = Array.from({ length: 800 }, (_, index) => String(index).padStart(24, "0")).reverse();
    try {
        await client.fetchQuery(deferredPricesQueryOptions("pvp-season", [...ids, ids[0]]));
        assert.deepEqual(seen, [...new Set(ids)].sort());
        assert.equal(peak, 3);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});

test("cancelling a Query aborts every deferred-price batch", async () => {
    const originalFetch = globalThis.fetch;
    let aborted = 0;
    globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
            aborted++;
            reject(init.signal?.reason);
        }, { once: true });
    });
    const client = createQueryClient();
    const options = deferredPricesQueryOptions(
        "regular",
        Array.from({ length: 300 }, (_, index) => String(index).padStart(24, "0")),
    );
    try {
        const request = client.fetchQuery(options);
        await client.cancelQueries({ queryKey: options.queryKey });
        await assert.rejects(request);
        assert.equal(aborted, 3);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});
