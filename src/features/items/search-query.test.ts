import assert from "node:assert/strict";
import test from "node:test";
import { QueryClient } from "@tanstack/react-query";
import { RequestError } from "../../lib/query/request";
import {
    canonicalItemSearchQuery,
    itemSearchQueryOptions,
} from "./search-query";

function createQueryClient() {
    return new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
}

test("item search canonicalizes its key and request and reuses one in-flight read", async (context) => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    let requestedUrl = "";
    try {
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            calls += 1;
            requestedUrl = String(input);
            await Promise.resolve();
            return new Response(JSON.stringify({
                items: [{ id: "item-a", name: "Pack of Sugar", normalizedName: "pack-of-sugar" }],
            }), { status: 200, headers: { "Content-Type": "application/json" } });
        }) as typeof fetch;
        const client = createQueryClient();
        context.after(() => client.clear());
        const options = itemSearchQueryOptions("regular", "  Pack   of Sugar ", 10);
        assert.deepEqual(options.queryKey, [
            "game-data",
            "regular",
            "item-search",
            10,
            "pack-of-sugar",
        ]);
        const [first, second] = await Promise.all([
            client.fetchQuery(options),
            client.fetchQuery(options),
        ]);

        assert.equal(canonicalItemSearchQuery("  Pack   of Sugar "), "pack-of-sugar");
        assert.equal(calls, 1);
        assert.equal(first, second);
        assert.doesNotMatch(requestedUrl, /releaseId=/);
        assert.match(requestedUrl, /q=pack-of-sugar/);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("item search does not retry or cache a validation error", async (context) => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    try {
        globalThis.fetch = (async () => {
            calls += 1;
            return new Response(JSON.stringify({ error: "invalid search" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }) as typeof fetch;
        const client = createQueryClient();
        context.after(() => client.clear());
        const options = itemSearchQueryOptions("pve", "bolts", 10);

        await assert.rejects(client.fetchQuery(options), (error: unknown) =>
            error instanceof RequestError && error.status === 400,
        );
        assert.equal(calls, 1);
        assert.equal(client.getQueryData(options.queryKey), undefined);
    } finally {
        globalThis.fetch = originalFetch;
    }
});

test("item search cancellation aborts the transport and malformed success is not cached", async (context) => {
    const originalFetch = globalThis.fetch;
    try {
        let observedSignal: AbortSignal | null = null;
        globalThis.fetch = ((_: RequestInfo | URL, init?: RequestInit) => {
            observedSignal = init?.signal as AbortSignal;
            return new Promise<Response>((_, reject) => {
                observedSignal?.addEventListener("abort", () => reject(observedSignal?.reason), { once: true });
            });
        }) as typeof fetch;
        const client = createQueryClient();
        context.after(() => client.clear());
        const options = itemSearchQueryOptions("pvp-season", "wire", 50);
        const pending = client.fetchQuery(options);
        await client.cancelQueries({ queryKey: options.queryKey });
        await assert.rejects(pending);
        assert.equal(observedSignal?.aborted, true);

        globalThis.fetch = (async () => new Response(JSON.stringify({
            items: [{ id: 123, name: "bad", normalizedName: "bad" }],
        }), { status: 200, headers: { "Content-Type": "application/json" } })) as typeof fetch;
        await assert.rejects(client.fetchQuery(options), /invalid item search response/);
        assert.equal(client.getQueryData(options.queryKey), undefined);
    } finally {
        globalThis.fetch = originalFetch;
    }
});
