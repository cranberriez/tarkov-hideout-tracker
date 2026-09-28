import test from "node:test";
import assert from "node:assert/strict";
import type { PriceHistoryPoint } from "../../../src/types/prices";
import { computeMarketMetrics } from "./metrics";
import { detectShock } from "./shock";

const HOUR = 3_600_000;
const NOW = Date.UTC(2026, 8, 28, 15, 7);

const at = (hoursAgo: number, priceMin: number, offerCount: number): PriceHistoryPoint => ({
	timestamp: NOW - hoursAgo * HOUR,
	price: priceMin,
	priceMin,
	offerCount,
});

function steady(fromHoursAgo: number, toHoursAgo: number, priceMin: number, offerCount = 8) {
	const points: PriceHistoryPoint[] = [];
	for (let hours = fromHoursAgo; hours >= toHoursAgo; hours -= 2) points.push(at(hours, priceMin, offerCount));
	return points;
}

/** Real regular-mode VAZ car key, 2026-09-28: a week near 2,000, a spike to ~18,000, then a steady fall. */
const vaz: PriceHistoryPoint[] = [
	...steady(168, 60.5, 2_000, 7),
	at(58.5, 2_000, 7),
	at(56.5, 2_000, 7),
	at(54.5, 1_999, 8),
	at(52.5, 1_999, 7),
	at(50.7, 1_999, 6),
	at(48.5, 1_999, 5),
	at(46.5, 1_999, 3),
	at(44.5, 1_999, 1),
	at(42.7, 1_999, 1),
	at(40.5, 1_100, 2),
	at(38.5, 1_100, 2),
	at(36.5, 1_100, 2),
	at(34.5, 1_100, 2),
	at(32.5, 1_000, 3),
	at(30.5, 1_000, 3),
	at(28.5, 1, 4),
	at(24.5, 55_555, 2),
	at(22.5, 18_000, 16),
	at(20.5, 17_000, 21),
	at(18.5, 12_000, 24),
	at(16.5, 12_000, 23),
	at(14.7, 11_000, 24),
	at(12.5, 9_500, 25),
	at(10.7, 9_500, 14),
	at(8.5, 9_500, 8),
	at(6.7, 9_000, 6),
	at(4.5, 8_999, 8),
	at(2.5, 5_000, 7),
];

test("VAZ key: a spike that is giving the jump back is retracing, not rising", () => {
	const shock = detectShock(vaz, NOW)!;
	assert.equal(shock.direction, "up");
	assert.equal(shock.extreme, 18_000);
	assert.ok(shock.baseline <= 2_000, `baseline ${shock.baseline}`);
	assert.equal(shock.phase, "retracing");
	assert.ok(shock.retracement > 0.4 && shock.retracement < 0.7, `retracement ${shock.retracement}`);

	const metrics = computeMarketMetrics(vaz, NOW)!;
	assert.equal(metrics.currentLevel, 8_999);
	assert.ok(metrics.move12h! < -0.1, `move12h ${metrics.move12h}`);
	assert.ok(metrics.change24hRub! > 5_000);
});

test("a lone spike listing does not form a shock", () => {
	const points = [...steady(96, 6, 10_000), at(4, 90_000, 1), at(2, 10_000, 8), at(0.5, 10_000, 8)];
	assert.equal(detectShock(points, NOW), null);
});

test("phases: holding at the extreme, settled at a new level, reverted to the baseline", () => {
	const jump = [...steady(120, 30, 10_000)];
	const holding = detectShock([...jump, ...steady(28, 0.5, 30_000)], NOW)!;
	assert.equal(holding.phase, "holding");
	assert.equal(holding.retracement, 0);

	const settled = detectShock([...jump, ...steady(28, 14, 30_000), ...steady(12, 0.5, 22_000)], NOW)!;
	assert.equal(settled.phase, "settled");
	assert.ok(settled.retracement > 0.3 && settled.retracement < 0.5);

	const reverted = detectShock([...jump, ...steady(28, 14, 30_000), ...steady(12, 0.5, 10_500)], NOW)!;
	assert.equal(reverted.phase, "reverted");
});

test("a crash that is recovering is a downward shock retracing", () => {
	const points = [
		...steady(120, 26, 50_000),
		...steady(24, 16, 15_000),
		at(12, 18_000, 8),
		at(10, 21_000, 8),
		at(8, 24_000, 8),
		at(6, 27_000, 8),
		at(4, 30_000, 8),
		at(2, 32_000, 8),
	];
	const shock = detectShock(points, NOW)!;
	assert.equal(shock.direction, "down");
	assert.equal(shock.extreme, 15_000);
	assert.equal(shock.phase, "retracing");
});

test("steady markets have no shock", () => {
	assert.equal(detectShock(steady(120, 0.5, 25_000), NOW), null);
});
