import assert from "node:assert/strict";
import test from "node:test";
import {
    calculatePriceHistoryInsights,
    downsamplePriceHistory,
    filterPriceHistory,
    filterPriceHistoryOutliers,
    type PriceHistoryPoint,
} from "./price-history";

const DAY = 24 * 60 * 60 * 1000;

function point(day: number, price: number): PriceHistoryPoint {
    return {
        timestamp: Date.UTC(2026, 0, 1) + day * DAY,
        price,
        priceMin: price - 100,
        offerCount: 10,
    };
}

test("filters ranges relative to the newest upstream point", () => {
    const points = Array.from({ length: 40 }, (_, index) => point(index, 1000 + index));
    assert.equal(filterPriceHistory(points, "threeDays").length, 4);
    assert.equal(filterPriceHistory(points, "week").length, 8);
    assert.equal(filterPriceHistory(points, "month").length, 31);
    assert.equal(filterPriceHistory(points, "all").length, 40);
});

test("downsamples long histories into representative bucket averages", () => {
    const points = Array.from({ length: 100 }, (_, index) => point(index, 1000 + index));
    const sampled = downsamplePriceHistory(points, 10);
    assert.equal(sampled.length, 10);
    assert.equal(sampled[0].price, 1004.5);
    assert.equal(sampled[9].price, 1094.5);
});

test("keeps ordinary price movement when filtering outliers", () => {
    const points = Array.from({ length: 100 }, (_, index) => point(index, 1000 + index));
    const filtered = filterPriceHistoryOutliers(points);

    assert.deepEqual(filtered, points);
});

test("removes isolated high spikes from chart and summary input", () => {
    const stable = Array.from({ length: 99 }, (_, index) => point(index, 1000));
    const spike = point(50.5, 10000);
    const filtered = filterPriceHistoryOutliers([
        ...stable.slice(0, 51),
        spike,
        ...stable.slice(51),
    ]);
    const insights = calculatePriceHistoryInsights(filtered);

    assert.equal(filtered.length, stable.length);
    assert.equal(insights.average, 1000);
    assert.equal(insights.high, 1000);
});

test("reports a directional trend from smoothed range edges", () => {
    const rising = Array.from({ length: 20 }, (_, index) => point(index, 1000 + index * 100));
    const insights = calculatePriceHistoryInsights(rising);
    assert.equal(insights.trend, "up");
    assert.ok((insights.changePercent ?? 0) > 100);
    assert.equal(insights.low, 1000);
    assert.equal(insights.high, 2900);
});

test("includes every price point in summaries", () => {
    const stable = Array.from({ length: 10 }, (_, index) => point(index, 1000));
    const spike = point(5.5, 5000);
    const insights = calculatePriceHistoryInsights([...stable.slice(0, 6), spike, ...stable.slice(6)]);

    assert.equal(insights.average, 15000 / 11);
    assert.equal(insights.high, 5000);
});
