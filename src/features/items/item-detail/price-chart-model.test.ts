import test from "node:test";
import assert from "node:assert/strict";
import type { PriceHistoryPoint } from "@/types/prices";
import { rollingMedian, seriesPath, splitAtGaps, spreadBandPath } from "./price-chart-model";

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

test("rolling median flattens a lone spike", () => {
	const points = [10, 10, 90, 10, 12].map((price, index) => point(midnight + index * 2 * HOUR, price));
	assert.deepEqual(rollingMedian(points, "price"), [10, 10, 10, 12, 12]);
});

test("paths: linear, stepped and the spread band", () => {
	const points = [point(midnight, 10, 8), point(midnight + 2 * HOUR, 20, 15)];
	assert.equal(seriesPath(points, [10, 20], scale), "M0,10 L2,20");
	assert.equal(seriesPath(points, [10, 20], scale, true), "M0,10 H2 V20");
	assert.equal(spreadBandPath(points, scale), "M0,10 L2,20 L2,15 L0,8 Z");
});
