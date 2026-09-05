import assert from "node:assert/strict";
import test from "node:test";
import { deriveEffectivePrice } from "./price-history";
import { fleaPriceStatusLabel, getFleaPrice, getFleaPriceEstimate } from "./market-price";
import type { PriceHistoryPoint } from "@/types/prices";

const START = Date.UTC(2026, 8, 5);
function history(mins: number[], offers: number | null = 20): PriceHistoryPoint[] {
    return mins.map((priceMin, i) => ({ priceMin, price: priceMin * 1.1, offerCount: offers, timestamp: START + i * 2 * 3_600_000 }));
}

test("M1A SASS uses 120k minimums rather than the 925926 weighted aggregate", () => {
    const points = history([1_400_000, 120_000, 120_000, 120_000, 120_000], 2);
    [1_400_000, 760_000, 760_000, 973_333, 973_333].forEach((price, i) => points[i].price = price);
    points[0].offerCount = 1;
    // The five newest supplied snapshots, with their actual chronological ordering.
    const result = deriveEffectivePrice(points);
    assert.equal(result.stability, "unstable");
    assert.equal(result.effectivePrice, 120_000);
    assert.ok(result.reasons.includes("divergent-reference"));
    // The full stored window anchors the prior minimum, even with earlier spikes.
    const full = [...history([90_000, 135_000, 99_000, 95_000, 1_400_000], 2), ...points.map(p => ({ ...p, timestamp: p.timestamp + 10 * 3_600_000 }))];
    assert.equal(deriveEffectivePrice(full).effectivePrice, 120_000);
    assert.equal(deriveEffectivePrice([...points].reverse()).effectivePrice, result.effectivePrice);
});

test("supplied five M1A samples in newest-first order resolve to 120k", () => {
    const points = history([120_000, 120_000, 120_000, 120_000, 1_400_000], 2);
    [973_333, 973_333, 760_000, 760_000, 1_400_000].forEach((price, i) => points[i].price = price);
    points[4].offerCount = 1;
    assert.equal(deriveEffectivePrice(points).effectivePrice, 120_000);
    assert.equal(deriveEffectivePrice(points).totalOfferCount, 1);
});

test("M1A NY consecutive single-offer spike retains the prior minimum estimate", () => {
    const points = history([230_000, 230_000, 200_000, 200_000, 140_000, 390_000, 390_000, 88_888, 1_400_000, 1_400_000], 2);
    points[8].offerCount = points[9].offerCount = 1;
    points[7].price = 239_444;
    const result = deriveEffectivePrice(points);
    assert.equal(result.effectivePrice, 200_000);
    assert.equal(result.stability, "unstable");
    assert.ok(result.reasons.includes("price-jump"));
});

test("stable commodity and consistently expensive equipment are not price capped", () => {
    for (const values of [[50_000, 49_000, 51_000, 52_000, 50_000], [18_000_000, 18_100_000, 18_000_000, 18_000_000, 18_000_000]]) {
        const result = deriveEffectivePrice(history(values));
        assert.equal(result.effectivePrice, values[0]);
        assert.equal(result.stability, "stable");
        assert.equal(result.totalOfferCount, 20);
    }
});

test("missing, zero, null and duplicate observations never create confidence", () => {
    assert.equal(deriveEffectivePrice([]).effectivePrice, null);
    assert.equal(deriveEffectivePrice(history([100, 100, 100], 0)).stability, "unavailable");
    assert.equal(deriveEffectivePrice(history([100, 100, 100], null)).stability, "unstable");
    const one = history([100])[0];
    assert.equal(deriveEffectivePrice(Array(10).fill(one)).sampleCount, 1);
    const repeated = deriveEffectivePrice(history(Array(10).fill(18_000_000), 1));
    assert.equal(repeated.effectivePrice, 18_000_000);
    assert.equal(repeated.stability, "unstable");
    assert.equal(repeated.totalOfferCount, 1);
});

test("divergent aggregates and stale observations are explicitly unreliable", () => {
    const points = history([100, 100, 100, 100, 100]);
    points[4].price = 1000;
    assert.ok(deriveEffectivePrice(points).reasons.includes("divergent-reference"));
    assert.equal(deriveEffectivePrice(points).effectivePrice, 100);
    assert.ok(deriveEffectivePrice(history([100, 100, 100]), 5, START + 100 * 3_600_000).reasons.includes("stale"));
});

test("sustained moves are accepted after temporal confirmation; thin markets stay unstable", () => {
    for (const values of [[100, 100, 100, 400, 410, 400, 405, 400], [400, 400, 400, 100, 105, 100, 100, 100]]) {
        const result = deriveEffectivePrice(history(values));
        assert.equal(result.effectivePrice, values.at(-1));
        assert.equal(result.stability, "stable");
    }
    const thin = deriveEffectivePrice(history([100, 100, 100, 400, 400, 400, 400, 400], 1));
    assert.equal(thin.effectivePrice, 400);
    assert.equal(thin.stability, "unstable");
});

test("shared UI semantics distinguish estimate, actionable price, and release fallback", () => {
    const unstable = { price: 120_000, avg24hPrice: 925_926, fleaStability: "unstable" as const };
    assert.equal(getFleaPrice(unstable), 120_000);
    assert.equal(getFleaPriceEstimate(unstable), 120_000);
    assert.equal(fleaPriceStatusLabel(unstable), "Value unstable");
    assert.equal(getFleaPrice({ ...unstable, fleaStability: "stable" }), 120_000);
    assert.equal(fleaPriceStatusLabel({ fleaStability: "stable" }), null);
    assert.equal(getFleaPrice({ avg24hPrice: 50_000, fleaStability: "reference" }), 50_000);
    assert.equal(fleaPriceStatusLabel({ fleaStability: "reference" }), null);
    assert.equal(getFleaPrice({ ...unstable, fleaStability: "unavailable" }), null);
    assert.equal(getFleaPrice({ price: 0 }), null);
});
