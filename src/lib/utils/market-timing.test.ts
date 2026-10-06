import assert from "node:assert/strict";
import test from "node:test";
import type { CurrentPrice } from "../../types/prices";
import { describeMarketTiming } from "./market-timing";

const HOUR = 60 * 60 * 1000;
const reference = { typical: 19_000, rangeLow: 11_100, rangeHigh: 25_000, calculatedAt: 100 * HOUR };
const priced = (price: number, extra: Partial<CurrentPrice> = {}): CurrentPrice => ({
	price,
	fleaStability: "stable",
	updatedAt: 116 * HOUR,
	marketReference: reference,
	...extra,
});

test("flags prices beyond both the recent range and the typical-level margin", () => {
	assert.equal(describeMarketTiming(priced(27_500))?.kind, "high");
	assert.equal(describeMarketTiming(priced(11_000))?.kind, "low");
	// Above the 7-day range but within 15% of typical, and inside the range: no flag.
	assert.equal(describeMarketTiming(priced(21_000, { marketReference: { ...reference, rangeHigh: 20_000 } })), null);
	assert.equal(describeMarketTiming(priced(19_500)), null);
});

test("does not compare missing, stale, or unusable evidence", () => {
	assert.equal(describeMarketTiming(priced(27_500, { marketReference: undefined })), null);
	assert.equal(describeMarketTiming(priced(27_500, { updatedAt: 140 * HOUR })), null);
	assert.equal(describeMarketTiming(priced(27_500, { fleaPriceReasons: ["stale"], fleaStability: "unstable" })), null);
	assert.equal(describeMarketTiming(priced(27_500, { fleaStability: "reference" })), null);
	assert.equal(describeMarketTiming(null), null);
});
