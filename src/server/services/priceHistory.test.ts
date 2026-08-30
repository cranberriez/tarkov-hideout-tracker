import assert from "node:assert/strict";
import test from "node:test";
import {
    normalizePriceHistory,
    PRICE_HISTORY_CUTOFF_TIMESTAMP,
} from "./priceHistory";

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
