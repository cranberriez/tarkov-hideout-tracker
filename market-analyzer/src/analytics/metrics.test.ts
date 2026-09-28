import test from "node:test";
import assert from "node:assert/strict";
import type { PriceHistoryPoint } from "../../../src/types/prices";
import { computeMarketMetrics, timeWeightedSamples, weightedQuantile } from "./metrics";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 8, 28, 12);

function series(from: number, to: number, step: number, value: (at: number) => number, depth = 20) {
	const points: PriceHistoryPoint[] = [];
	for (let at = from; at <= to; at += step) {
		const price = value(at);
		points.push({ timestamp: at, price: Math.round(price * 1.05), priceMin: price, offerCount: depth });
	}
	return points;
}

/** Upstream shape: daily aggregates (00:00 UTC) for older history, two-hourly snapshots for the last week. */
function upstream(older: (at: number) => number, recent: (at: number) => number, depth = 20) {
	const firstSnapshot = NOW - 7 * DAY;
	const lastDaily = Math.floor(firstSnapshot / DAY) * DAY;
	return [
		...series(lastDaily - 33 * DAY, lastDaily, DAY, older, depth),
		...series(firstSnapshot, NOW, 2 * HOUR, recent, depth),
	];
}

test("windows weigh observations by the time they represent, not by row count", () => {
	const points = upstream(
		() => 100,
		() => 200,
	);
	// 23 daily rows at 100 vs 85 two-hourly rows at 200: time says 100 dominates 30 days.
	const metrics = computeMarketMetrics(points, NOW)!;
	assert.equal(metrics.median30d, 100);
	assert.equal(metrics.median7d, 200);
	assert.equal(metrics.median24h, 200);
});

test("snapshots hold ~one sampling interval, daily aggregates a day", () => {
	const midnight = Math.floor(NOW / DAY) * DAY - 10 * DAY;
	const points: PriceHistoryPoint[] = [
		{ timestamp: midnight, price: 10, priceMin: 10, offerCount: 5 },
		{ timestamp: NOW - 5 * DAY, price: 30, priceMin: 30, offerCount: 5 },
		{ timestamp: NOW - HOUR, price: 20, priceMin: 20, offerCount: 5 },
	];
	const samples = timeWeightedSamples(points, midnight, NOW);
	// Daily aggregate: 26h. Snapshot followed by days without listings: 3h, not the whole gap.
	assert.deepEqual(
		samples.map((sample) => sample.weight / HOUR),
		[26, 3, 1],
	);
	assert.equal(weightedQuantile(samples, 0.5), 10);
});

test("a cheap listing before a gap without listings does not anchor the 24h change", () => {
	// Real regular-mode beanie: 2,000 single listings, 18h with no listings, then ~30k.
	const at = (hoursAgo: number, priceMin: number, offerCount: number): PriceHistoryPoint => ({
		timestamp: NOW - hoursAgo * HOUR,
		price: priceMin,
		priceMin,
		offerCount,
	});
	const points = [
		...[78, 76, 74, 72, 70].map((hours) => at(hours, 14_500, 3)),
		at(60, 11_000, 2),
		...[58, 56, 54, 52].map((hours) => at(hours, 9_000, 3)),
		at(50, 15_999, 1),
		at(44, 2_000, 1),
		at(42, 2_000, 2),
		at(24, 42_069, 1),
		at(22, 42_069, 1),
		at(20, 33_999, 3),
		at(18, 28_000, 5),
		at(16, 23_232, 8),
		at(14, 27_888, 9),
		at(12, 27_888, 8),
		at(10, 28_000, 5),
		at(8, 30_000, 3),
		at(6, 30_000, 2),
		at(4, 33_999, 1),
	];
	const metrics = computeMarketMetrics(points, NOW)!;
	assert.ok(metrics.change24h !== null && Math.abs(metrics.change24h) < 3, `change24h ${metrics.change24h}`);
	assert.ok(metrics.change6h !== null && Math.abs(metrics.change6h) < 0.5, `change6h ${metrics.change6h}`);
});

test("a shallow undercut inside a steady regime is not a 24h move", () => {
	// Real regular-mode Soyuz-TM buffer tube: 180k at depth 3 with brief single undercuts.
	const at = (hoursAgo: number, priceMin: number, offerCount: number): PriceHistoryPoint => ({
		timestamp: NOW - hoursAgo * HOUR,
		price: priceMin,
		priceMin,
		offerCount,
	});
	const points = [
		...[49, 47, 45, 43, 41, 39].map((hours) => at(hours, 180_000, 3)),
		at(37.2, 180_000, 3),
		at(35.2, 180_000, 1),
		at(31.2, 20_000, 1),
		at(25.2, 49_999, 1),
		at(21.4, 180_000, 3),
		at(19.2, 150_000, 4),
		at(17.2, 180_000, 3),
		at(3.4, 180_000, 3),
		at(1.4, 180_000, 3),
	];
	const metrics = computeMarketMetrics(points, NOW)!;
	assert.equal(metrics.marketValue, 180_000);
	assert.ok(metrics.change24h !== null && Math.abs(metrics.change24h) < 0.25, `change24h ${metrics.change24h}`);
});

test("flat deep market is stable, high confidence and mid-percentile", () => {
	const metrics = computeMarketMetrics(
		upstream(
			() => 50_000,
			() => 50_000,
		),
		NOW,
	)!;
	assert.equal(metrics.marketValue, 50_000);
	assert.equal(metrics.trend, "stable");
	assert.equal(metrics.volatility7d, 0);
	assert.equal(metrics.change24h, 0);
	assert.equal(metrics.percentile30d, 0.5);
	assert.equal(metrics.confidence, "high");
	assert.deepEqual(metrics.confidenceReasons, []);
	assert.ok(metrics.persistenceHours! > 24 * 30);
});

test("sustained rise is a rising trend with a high percentile", () => {
	const ramp = (at: number) => Math.round(100_000 * (1 + Math.max(0, at - (NOW - 7 * DAY)) / (7 * DAY)));
	const metrics = computeMarketMetrics(
		upstream(() => 100_000, ramp),
		NOW,
	)!;
	assert.equal(metrics.trend, "rising");
	assert.ok(metrics.change7d! > 0.7, `change7d ${metrics.change7d}`);
	assert.ok(metrics.change24h! > 0.05);
	assert.ok(metrics.percentile30d! > 0.9);
	assert.ok(metrics.rangeHigh7d! > metrics.rangeLow7d!);
});

test("seasonal decline is falling", () => {
	const decline = (at: number) => Math.round(80_000 - (40_000 * (at - (NOW - 40 * DAY))) / (40 * DAY));
	const metrics = computeMarketMetrics(upstream(decline, decline), NOW)!;
	assert.equal(metrics.trend, "falling");
	assert.ok(metrics.change7d! < -0.05);
	assert.ok(metrics.percentile30d! < 0.2);
});

test("stale and thin histories lower confidence with explicit reasons", () => {
	const stale = computeMarketMetrics(
		series(NOW - 20 * DAY, NOW - 4 * DAY, 2 * HOUR, () => 1_000),
		NOW,
	)!;
	assert.equal(stale.confidence, "low");
	assert.ok(stale.confidenceReasons.includes("stale"));
	assert.ok(stale.confidenceReasons.includes("no-recent-listings"));
	assert.ok(!stale.confidenceReasons.includes("unknown-depth"));
	assert.equal(stale.median24h, null);
	assert.equal(stale.change6h, null);

	const thin = computeMarketMetrics(
		upstream(
			() => 1_000,
			() => 1_000,
			1,
		),
		NOW,
	)!;
	assert.ok(thin.confidenceReasons.includes("thin-listings"));
	assert.equal(thin.depthMedian24h, 1);
	assert.notEqual(thin.confidence, "high");
});

test("short history reports no long-window statistics", () => {
	const metrics = computeMarketMetrics(
		series(NOW - 2 * DAY, NOW, 2 * HOUR, () => 5_000),
		NOW,
	)!;
	assert.equal(metrics.median7d, null);
	assert.equal(metrics.median30d, null);
	assert.equal(metrics.trend, "unknown");
	assert.ok(metrics.confidenceReasons.includes("short-history"));
	assert.equal(computeMarketMetrics([], NOW), null);
});

test("empty-market observations do not contribute prices", () => {
	const points = upstream(
		() => 3_000,
		() => 3_000,
	);
	points.push({ timestamp: NOW, price: 0, priceMin: 0, offerCount: 0 });
	const metrics = computeMarketMetrics(points, NOW + HOUR)!;
	assert.equal(metrics.liveOfferCount, 0);
	assert.ok(metrics.confidenceReasons.includes("no-offers"));
	assert.equal(metrics.median7d, 3_000);
});

test("a large move made on one or two listings is low confidence", () => {
	const points = upstream(
		() => 4_000,
		(at) => (at > NOW - DAY ? 12_000 : 4_000),
		1,
	);
	const metrics = computeMarketMetrics(points, NOW)!;
	assert.ok(metrics.confidenceReasons.includes("thin-large-move"), metrics.confidenceReasons.join());
	assert.equal(metrics.confidence, "low");
});
