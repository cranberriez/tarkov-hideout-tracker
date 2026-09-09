import test from "node:test";
import assert from "node:assert/strict";
import { createQueryClient } from "../../../lib/query/client";
import { HISTORY_STALE_TIME, priceHistoryQueryOptions } from "./price-history-query";

test("price history is mode-scoped and reused for two hours", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
        calls++;
        return Response.json({ data: [{ timestamp: 1, price: 2, priceMin: 1 }], fetchedAt: 1 });
    };
    const client = createQueryClient();
    const options = priceHistoryQueryOptions("item-12345678", "pve");
    try {
        const first = await client.fetchQuery(options);
        const second = await client.fetchQuery(options);
        assert.equal(first, second);
        assert.equal(calls, 1);
        assert.equal(options.staleTime, HISTORY_STALE_TIME);
        assert.notDeepEqual(options.queryKey, priceHistoryQueryOptions("item-12345678", "regular").queryKey);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});

test("aborted history requests do not enter success cache", async () => {
    const originalFetch = globalThis.fetch;
    const client = createQueryClient();
    try {
        let aborted = false;
        const pending = priceHistoryQueryOptions("item-87654321", "regular");
        globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
            init?.signal?.addEventListener("abort", () => {
                aborted = true;
                reject(init.signal?.reason);
            }, { once: true });
        });
        const request = client.fetchQuery(pending);
        await client.cancelQueries({ queryKey: pending.queryKey });
        await assert.rejects(request);
        assert.equal(aborted, true);
        assert.equal(client.getQueryData(pending.queryKey), undefined);
    } finally {
        client.clear();
        globalThis.fetch = originalFetch;
    }
});
