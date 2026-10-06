import test from "node:test";
import assert from "node:assert/strict";
import type { PriceHistoryPoint } from "@/types/prices";
import { bucketPriceHistory, seriesPath, splitAtGaps } from "./price-chart-model";

const HOUR = 3_600_000;
const midnight = Date.UTC(2026, 8, 1);
const point = (timestamp: number, price: number, priceMin = price): PriceHistoryPoint => ({
	timestamp,
	price,
	priceMin,
	offerCount: 5,
});
const scale = { x: (timestamp: number) => (timestamp - midnight) / HOUR, y: (price: number) => price };

test("snapshots split where no listings were recorded; daily aggregates stay joined", () => {
	const segments = splitAtGaps([
		point(midnight - 48 * HOUR, 1),
		point(midnight - 24 * HOUR, 1),
		point(midnight + 3 * HOUR, 2),
		point(midnight + 5 * HOUR, 3),
		point(midnight + 15 * HOUR, 4),
		point(midnight + 17 * HOUR, 5),
	]);
	assert.deepEqual(
		segments.map((segment) => segment.map((entry) => entry.price)),
		[
			[1, 1],
			[2, 3],
			[4, 5],
		],
	);
});

test("series path joins each observation", () => {
	const points = [point(midnight, 10, 8), point(midnight + 2 * HOUR, 20, 15)];
	assert.equal(seriesPath(points, [10, 20], scale), "M0,10 L2,20");
});

test("buckets summarise like upstream daily aggregates: mean aggregate, lowest minimum, mean offers", () => {
	const buckets = bucketPriceHistory(
		[
			{ timestamp: midnight + 1 * HOUR, price: 100, priceMin: 80, offerCount: 4 },
			{ timestamp: midnight + 3 * HOUR, price: 120, priceMin: 70, offerCount: null },
			{ timestamp: midnight + 5 * HOUR, price: 110, priceMin: 90, offerCount: 8 },
			{ timestamp: midnight + 13 * HOUR, price: 200, priceMin: 150, offerCount: 3 },
		],
		12 * HOUR,
	);
	assert.deepEqual(buckets, [
		{
			timestamp: midnight,
			price: 110,
			priceMin: 70,
			offerCount: 6,
			bucket: { end: midnight + 12 * HOUR, count: 3, upstreamDaily: false },
		},
		{
			timestamp: midnight + 12 * HOUR,
			price: 200,
			priceMin: 150,
			offerCount: 3,
			bucket: { end: midnight + 24 * HOUR, count: 1, upstreamDaily: false },
		},
	]);
});

test("an upstream daily summary keeps its values in a daily bucket and is marked as such", () => {
	const [bucket] = bucketPriceHistory([point(midnight, 50, 40)], 24 * HOUR);
	assert.equal(bucket.price, 50);
	assert.equal(bucket.priceMin, 40);
	assert.equal(bucket.bucket?.upstreamDaily, true);
});

test("bucketed series split only where a whole bucket has no observations", () => {
	const buckets = bucketPriceHistory(
		[0, 2, 13, 40, 49].map((hours) => point(midnight + hours * HOUR, hours)),
		12 * HOUR,
	);
	assert.deepEqual(
		splitAtGaps(buckets, 12 * HOUR).map((segment) => segment.map((entry) => entry.timestamp - midnight)),
		[
			[0, 12 * HOUR],
			[36 * HOUR, 48 * HOUR],
		],
	);
});
