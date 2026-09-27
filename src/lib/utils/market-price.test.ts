import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentPrice } from "@/types/prices";
import { describeFleaPrice, formatFleaPriceState } from "./market-price";

const price = (value: Partial<CurrentPrice>) => value as CurrentPrice;

test("price states distinguish loading, failure and absent data", () => {
    assert.deepEqual(describeFleaPrice({ priceLoadState: "pending" }), { kind: "loading" });
    assert.deepEqual(describeFleaPrice({ priceLoadState: "error" }), { kind: "failed" });
    assert.deepEqual(describeFleaPrice({ priceLoadState: "ready", marketPrice: null }), { kind: "missing" });
});

test("an existing price is shown while a refresh is pending", () => {
    const state = describeFleaPrice({ priceLoadState: "pending", marketPrice: price({ price: 1200 }) });
    assert.deepEqual(state, { kind: "price", unitPrice: 1200, unstable: false });
});

test("unavailable flea and missing flea data stay explicit", () => {
    assert.equal(
        formatFleaPriceState(describeFleaPrice({ marketPrice: price({ fleaStability: "unavailable", price: 50 }) })),
        "Flea unavailable",
    );
    assert.equal(formatFleaPriceState(describeFleaPrice({ marketPrice: price({}) })), "No flea");
});

test("totals multiply the unit price and support compact formatting", () => {
    const state = describeFleaPrice({ marketPrice: price({ price: 12_500 }) });
    assert.equal(formatFleaPriceState(state, { count: 2 }), "25,000 ₽");
    assert.equal(formatFleaPriceState(state, { count: 2, compact: true }), "25.0k ₽");
});
