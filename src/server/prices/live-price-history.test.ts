import assert from "node:assert/strict";
import test from "node:test";
import { PRICE_HISTORY_CUTOFF_TIMESTAMP } from "../services/priceHistory";
import { TARKOV_API_USER_AGENT } from "../services/tarkovApi";
import {
    fetchCachedJsonPriceHistory,
    PRICE_HISTORY_REVALIDATE_SECONDS,
} from "./live-price-history";

test("modal price history uses the two-hour Next.js data cache", async (context) => {
    context.mock.method(globalThis, "fetch", async (_input, init) => {
        assert.equal(new Headers(init?.headers).get("User-Agent"), TARKOV_API_USER_AGENT);
        assert.deepEqual(
            (init as RequestInit & { next?: { revalidate?: number } })?.next,
            { revalidate: PRICE_HISTORY_REVALIDATE_SECONDS },
        );
        assert.equal(init?.cache, undefined);
        return Response.json({
            data: [{
                price: 1200,
                priceMin: 1000,
                offerCount: 5,
                timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP,
            }],
        });
    });

    assert.deepEqual(await fetchCachedJsonPriceHistory("pve", "item-a"), [{
        price: 1200,
        priceMin: 1000,
        offerCount: 5,
        timestamp: PRICE_HISTORY_CUTOFF_TIMESTAMP,
    }]);
});
