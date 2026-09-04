import assert from "node:assert/strict";
import test from "node:test";
import {
    fetchJsonPriceHistory,
    normalizePriceHistory,
    PRICE_HISTORY_CUTOFF_TIMESTAMP,
} from "./priceHistory";
import { TARKOV_API_USER_AGENT } from "./tarkovApi";

test("normalizes price history and excludes points before December 2025", () => {
    const points = normalizePriceHistory([
        {
            price: 900,
            priceMin: 800,
            offerCount: 3,
            timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP - 1,
        },
        {
            price: "1100",
            priceMin: "1000",
            offerCount: null,
            timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP,
        },
        {
            price: 1200,
            priceMin: 1050,
            offerCount: 5,
            timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP + 1,
        },
    ]);

    assert.deepEqual(points, [
        {
            price: 1100,
            priceMin: 1000,
            offerCount: null,
            timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP,
        },
        {
            price: 1200,
            priceMin: 1050,
            offerCount: 5,
            timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP + 1,
        },
    ]);
});

test("price refresh sends the stored ETag and handles 304", async (context) => {
    context.mock.method(globalThis, "fetch", async (_input, init) => {
        const headers = new Headers(init?.headers);
        assert.equal(headers.get("If-None-Match"), 'W/"price-v1"');
        assert.equal(headers.get("User-Agent"), TARKOV_API_USER_AGENT);
        assert.equal(init?.cache, "no-store");
        return new Response(null, {
            status: 304,
            headers: { ETag: 'W/"price-v1"' },
        });
    });

    assert.deepEqual(
        await fetchJsonPriceHistory("pvp-season", "item-a", 'W/"price-v1"'),
        { status: "not-modified", etag: 'W/"price-v1"' },
    );
});

test("price refresh returns normalized points and a replacement ETag", async (context) => {
    context.mock.method(globalThis, "fetch", async () =>
        Response.json(
            {
                data: [{
                    price: 1200,
                    priceMin: 1000,
                    offerCount: 5,
                    timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP,
                }],
            },
            { headers: { ETag: '"price-v2"' } },
        ),
    );

    assert.deepEqual(await fetchJsonPriceHistory("regular", "item-a"), {
        status: "updated",
        etag: '"price-v2"',
        data: [{
            price: 1200,
            priceMin: 1000,
            offerCount: 5,
            timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP,
        }],
    });
});
