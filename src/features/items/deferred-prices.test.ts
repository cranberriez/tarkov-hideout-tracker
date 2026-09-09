import test from "node:test";
import assert from "node:assert/strict";
import { createQueryClient } from "../../lib/query/client";
import { removeGameDataScope } from "../../lib/query/scope";
import { PRICE_STALE_TIME, parsePriceRequest } from "../../lib/query/price-contract";
import { itemPriceQueryOptions as priceOptions } from "./deferred-prices";

// No browser retention timers in Node; freshness and cancellation stay unchanged.
const itemPriceQueryOptions = (...args: Parameters<typeof priceOptions>) => ({ ...priceOptions(...args), gcTime: Infinity });

const id = (n: number) => n.toString(16).padStart(24, "0");
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
function response(ids: string[], price = 42) {
    return Response.json({ itemIds: ids, prices: Object.fromEntries(ids.map((id) => [id, { price }])) });
}
function requestedIds(input: RequestInfo | URL) {
    return new URL(String(input), "https://example.test").searchParams.get("ids")?.split(",") ?? [];
}

test("overlapping consumers batch once, share each item, and only fetch missing IDs on navigation", async () => {
    const originalFetch = globalThis.fetch;
    const seen: string[][] = [];
    globalThis.fetch = async (input, init) => {
        assert.notEqual(init?.method, "POST");
        const ids = requestedIds(input);
        seen.push(ids);
        return response(ids);
    };
    const client = createQueryClient();
    const read = (n: number) => client.fetchQuery(itemPriceQueryOptions(client, "regular", id(n)));
    try {
        await Promise.all([read(1), read(2), read(2)]);
        assert.deepEqual(seen, [[id(1), id(2)]]);
        await Promise.all([read(2), read(3)]);
        assert.deepEqual(seen, [[id(1), id(2)], [id(3)]]);
        assert.equal(client.getQueryData(itemPriceQueryOptions(client, "regular", id(1)).queryKey)?.price, 42);
    } finally { client.clear(); globalThis.fetch = originalFetch; }
});

test("a 568-item checklist uses one mode-specific GET and populates reusable per-item queries", async () => {
    const originalFetch = globalThis.fetch;
    const ids = Array.from({ length: 568 }, (_, n) => id(n));
    const urls: string[] = [];
    globalThis.fetch = async (input) => { urls.push(String(input)); return response(ids); };
    const client = createQueryClient();
    try {
        await Promise.all(ids.map((itemId) => client.fetchQuery(itemPriceQueryOptions(client, "pve", itemId, "checklist"))));
        assert.deepEqual(urls, ["/api/items/prices?mode=pve&scope=checklist"]);
        await client.fetchQuery(itemPriceQueryOptions(client, "pve", ids[0]));
        assert.equal(urls.length, 1);
        assert.equal(client.getQueryCache().getAll().length, 568);
    } finally { client.clear(); globalThis.fetch = originalFetch; }
});

test("prices stay fresh past five minutes, expire after an hour, and manual invalidation revalidates HTTP caches", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    let refreshHeaders: HeadersInit | undefined;
    globalThis.fetch = async (input, init) => { calls++; refreshHeaders = init?.headers; return response(requestedIds(input), calls); };
    const client = createQueryClient();
    const options = itemPriceQueryOptions(client, "regular", id(1));
    try {
        await client.fetchQuery(options);
        client.setQueryData(options.queryKey, { price: 1 }, { updatedAt: Date.now() - 6 * 60_000 });
        await client.fetchQuery(options);
        assert.equal(calls, 1);
        client.setQueryData(options.queryKey, { price: 1 }, { updatedAt: Date.now() - PRICE_STALE_TIME - 1 });
        await client.fetchQuery(options);
        assert.equal(calls, 2);
        await client.invalidateQueries({ queryKey: options.queryKey, refetchType: "none" });
        await client.fetchQuery(options);
        assert.equal(calls, 3);
        assert.equal(new Headers(refreshHeaders).get("pragma"), "no-cache");
        assert.equal(options.refetchInterval, false);
        assert.equal(options.refetchOnReconnect, false);
        assert.equal(options.refetchOnWindowFocus, false);
    } finally { client.clear(); globalThis.fetch = originalFetch; }
});

test("failed and malformed responses remain retryable; unavailable prices cache explicit null", async () => {
    const originalFetch = globalThis.fetch;
    let calls = 0;
    globalThis.fetch = async () => {
        calls++;
        if (calls === 1) return new Response("failed", { status: 503 });
        if (calls === 2) return Response.json({ prices: {} });
        return Response.json({ itemIds: [id(1)], prices: {} });
    };
    const client = createQueryClient();
    const options = itemPriceQueryOptions(client, "regular", id(1));
    try {
        await assert.rejects(client.fetchQuery(options));
        assert.equal(client.getQueryData(options.queryKey), undefined);
        await assert.rejects(client.fetchQuery(options), /Invalid price response/);
        assert.equal(client.getQueryData(options.queryKey), undefined);
        assert.equal(await client.fetchQuery(options), null);
        await client.fetchQuery(options);
        assert.equal(calls, 3);
    } finally { client.clear(); globalThis.fetch = originalFetch; }
});

test("a failed refresh preserves the prior usable item price", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response("failed", { status: 503 });
    const client = createQueryClient();
    const options = itemPriceQueryOptions(client, "regular", id(1));
    try {
        client.setQueryData(options.queryKey, { price: 17 }, { updatedAt: 1 });
        await assert.rejects(client.fetchQuery(options));
        assert.equal(client.getQueryData(options.queryKey)?.price, 17);
    } finally { client.clear(); globalThis.fetch = originalFetch; }
});

test("mode changes cancel transport and cannot repopulate the retired mode", async () => {
    const originalFetch = globalThis.fetch;
    let aborted = false;
    globalThis.fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => { aborted = true; reject(init.signal?.reason); }, { once: true });
    });
    const client = createQueryClient();
    try {
        const promise = Promise.all([1, 2].map((n) => client.fetchQuery(itemPriceQueryOptions(client, "regular", id(n)))));
        const rejection = assert.rejects(promise);
        await tick();
        await removeGameDataScope(client, "regular");
        await rejection;
        assert.equal(aborted, true);
        assert.equal(client.getQueryCache().getAll().length, 0);
        globalThis.fetch = async (input) => response(requestedIds(input), 99);
        assert.equal((await client.fetchQuery(itemPriceQueryOptions(client, "pve", id(1))))?.price, 99);
    } finally { client.clear(); globalThis.fetch = originalFetch; }
});

test("cancelling one item keeps shared transport alive for another consumer", async () => {
    const originalFetch = globalThis.fetch;
    let finish!: (response: Response) => void;
    let signal: AbortSignal | null | undefined;
    globalThis.fetch = async (_input, init) => { signal = init?.signal; return new Promise((resolve) => { finish = resolve; }); };
    const client = createQueryClient();
    try {
        const first = itemPriceQueryOptions(client, "regular", id(1));
        const canceled = client.fetchQuery(first);
        const rejection = assert.rejects(canceled);
        const retained = client.fetchQuery(itemPriceQueryOptions(client, "regular", id(2)));
        await tick();
        await client.cancelQueries({ queryKey: first.queryKey });
        assert.equal(signal?.aborted, false);
        finish(response([id(1), id(2)]));
        await rejection;
        assert.equal((await retained)?.price, 42);
        assert.equal(client.getQueryData(first.queryKey), undefined);
    } finally { client.clear(); globalThis.fetch = originalFetch; }
});

test("GET validation isolates modes, bounds URLs and rejects empty or ambiguous scopes", () => {
    const parse = (query: string) => parsePriceRequest(new URLSearchParams(query));
    assert.deepEqual(parse(`mode=regular&ids=${id(2)},${id(1)},${id(2)}`), { mode: "regular", ids: [id(1), id(2)] });
    assert.deepEqual(parse("mode=pvp-season&scope=checklist"), { mode: "pvp-season", scope: "checklist" });
    for (const query of ["mode=PVP&scope=checklist", "mode=pve&ids=", "mode=pve&scope=all", `mode=pve&ids=${id(1)}&scope=checklist`, "mode=pve&mode=regular&scope=checklist", `mode=pve&ids=${Array(201).fill(id(1)).join(",")}`]) {
        assert.equal(parse(query), null);
    }
});
