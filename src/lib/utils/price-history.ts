import type { FleaPriceReason, FleaStability, PriceHistoryPoint } from "@/types/prices";

export const STORED_PRICE_POINT_LIMIT = 10;
export const EFFECTIVE_PRICE_POINT_LIMIT = 5;
const HOUR = 60 * 60 * 1000;

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function ratio(a: number, b: number) { return Math.max(a, b) / Math.min(a, b); }

export function deriveEffectivePrice(
    points: readonly PriceHistoryPoint[],
    limit = EFFECTIVE_PRICE_POINT_LIMIT,
    now?: number,
): {
    effectivePrice: number | null;
    sampleCount: number;
    /** Legacy storage field: latest snapshot depth, never summed across snapshots. */
    totalOfferCount: number;
    stability: FleaStability;
    reasons: FleaPriceReason[];
} {
    const observations = [...new Map(points.filter(point =>
        Number.isFinite(point.timestamp) && point.timestamp > 0 &&
        Number.isFinite(point.price) && point.price >= 0 &&
        Number.isFinite(point.priceMin) && point.priceMin >= 0 &&
        (point.offerCount === null || (Number.isInteger(point.offerCount) && point.offerCount >= 0)),
    ).map(point => [point.timestamp, point])).values()]
        .sort((a, b) => a.timestamp - b.timestamp).slice(-STORED_PRICE_POINT_LIMIT);
    const valid = observations.filter(point => point.priceMin > 0 && point.price > 0 && point.offerCount !== 0);
    const recent = valid.slice(-Math.max(1, limit));
    const latest = observations.at(-1);
    const reasons: FleaPriceReason[] = [];
    // Primary estimate: each observation contributes one minimum, never offer weight.
    let effectivePrice = recent.length ? Math.round(median(recent.map(p => p.priceMin))) : null;
    let unconfirmedJump = false;
    if (valid.length > 1) {
        // Find the contiguous newest price regime, then compare it with the prior
        // window. This retains a baseline through multiple single-listing spikes.
        const tail: PriceHistoryPoint[] = [valid[valid.length - 1]];
        for (let i = valid.length - 2; i >= 0; i--) {
            if (ratio(valid[i].priceMin, median(tail.map(p => p.priceMin))) > 1.25) break;
            tail.unshift(valid[i]);
        }
        const prior = valid.slice(0, valid.length - tail.length).slice(-limit);
        if (prior.length) {
            const baseline = median(prior.map(p => p.priceMin));
            const candidate = median(tail.map(p => p.priceMin));
            if (ratio(candidate, baseline) >= 2) {
                const deep = tail.every(p => p.offerCount !== null && p.offerCount >= 3);
                const confirmed = tail.length >= (deep ? 3 : 5) &&
                    tail[tail.length - 1].timestamp - tail[0].timestamp >= (deep ? 2 : 8) * HOUR;
                // A lone old high listing must not anchor a now-cheaper market.
                unconfirmedJump = !confirmed && (candidate > baseline || prior.length >= 3);
                if (unconfirmedJump) effectivePrice = Math.round(baseline);
                else if (confirmed) effectivePrice = Math.round(candidate);
            }
        }
    }
    if (recent.length < 3 || (recent.at(-1)!.timestamp - recent[0].timestamp < 2 * HOUR)) reasons.push("insufficient-history");
    if (latest?.offerCount === 0) reasons.push("no-offers");
    if (recent.some(p => p.offerCount === null)) reasons.push("unknown-depth");
    if (latest?.offerCount != null && latest.offerCount < 3 ||
        recent.filter(p => p.offerCount !== null && p.offerCount >= 3).length < 3) reasons.push("sparse-offers");
    if (recent.slice(-3).some(p => p.price / p.priceMin >= 2)) reasons.push("divergent-reference");
    if (unconfirmedJump) reasons.push("price-jump");
    if (recent.length && Math.max(...recent.map(p => p.priceMin)) / Math.min(...recent.map(p => p.priceMin)) >= 2) reasons.push("volatile-minimum");
    if (now !== undefined && latest && now - latest.timestamp > 72 * HOUR) reasons.push("stale");
    return {
        effectivePrice,
        sampleCount: recent.length,
        totalOfferCount: latest?.offerCount ?? 0,
        stability: effectivePrice === null || latest?.offerCount === 0 ? "unavailable" : reasons.length ? "unstable" : "stable",
        reasons,
    };
}

export type PriceHistoryRange = "day" | "threeDays" | "week" | "month" | "all";

const RANGE_MS: Record<Exclude<PriceHistoryRange, "all">, number> = {
    day: 24 * 60 * 60 * 1000,
    threeDays: 3 * 24 * 60 * 60 * 1000,
    week: 7 * 24 * 60 * 60 * 1000,
    month: 30 * 24 * 60 * 60 * 1000,
};

export function filterPriceHistory(
    points: PriceHistoryPoint[],
    range: PriceHistoryRange,
) {
    if (range === "all" || points.length === 0) return points;
    const latest = points[points.length - 1].timestamp;
    const cutoff = latest - RANGE_MS[range];
    return points.filter((point) => point.timestamp >= cutoff);
}

export function downsamplePriceHistory(points: PriceHistoryPoint[], limit = 600) {
    if (points.length <= limit) return points;
    const sampled: PriceHistoryPoint[] = [];
    const bucketSize = points.length / limit;
    for (let index = 0; index < limit; index += 1) {
        const start = Math.floor(index * bucketSize);
        const end = Math.max(start + 1, Math.floor((index + 1) * bucketSize));
        const bucket = points.slice(start, end);
        const offers = bucket
            .map((point) => point.offerCount)
            .filter((value): value is number => value !== null);
        sampled.push({
            timestamp: bucket[Math.floor(bucket.length / 2)].timestamp,
            price: bucket.reduce((total, point) => total + point.price, 0) / bucket.length,
            priceMin: Math.min(...bucket.map((point) => point.priceMin)),
            offerCount:
                offers.length > 0
                    ? offers.reduce((total, value) => total + value, 0) / offers.length
                    : null,
        });
    }
    return sampled;
}

function percentile(sortedValues: number[], fraction: number) {
    if (sortedValues.length === 1) return sortedValues[0];
    const position = (sortedValues.length - 1) * fraction;
    const lowerIndex = Math.floor(position);
    const upperIndex = Math.ceil(position);
    const weight = position - lowerIndex;
    return (
        sortedValues[lowerIndex] * (1 - weight) +
        sortedValues[upperIndex] * weight
    );
}

export function filterPriceHistoryOutliers(points: PriceHistoryPoint[]) {
    if (points.length < 4) return points;

    const sortedPrices = points
        .map((point) => point.price)
        .sort((left, right) => left - right);
    const firstQuartile = percentile(sortedPrices, 0.25);
    const thirdQuartile = percentile(sortedPrices, 0.75);
    const interquartileRange = thirdQuartile - firstQuartile;
    const upperFence =
        thirdQuartile + Math.max(interquartileRange * 3, thirdQuartile * 0.1, 1);

    return points.filter((point) => point.price <= upperFence);
}

function average(values: number[]) {
    return values.length > 0
        ? values.reduce((total, value) => total + value, 0) / values.length
        : null;
}

function percentDifference(current: number, previous: number) {
    return previous === 0 ? 0 : ((current - previous) / previous) * 100;
}

export interface PriceHistoryInsights {
    average: number | null;
    low: number | null;
    high: number | null;
    changePercent: number | null;
    trend: "up" | "down" | "flat" | "unknown";
    weekendPercent: number | null;
    weekendAverage: number | null;
    weekdayAverage: number | null;
    localNightPercent: number | null;
    localNightAverage: number | null;
    localDayAverage: number | null;
}

export function calculatePriceHistoryInsights(
    points: PriceHistoryPoint[],
): PriceHistoryInsights {
    if (points.length === 0) {
        return {
            average: null,
            low: null,
            high: null,
            changePercent: null,
            trend: "unknown",
            weekendPercent: null,
            weekendAverage: null,
            weekdayAverage: null,
            localNightPercent: null,
            localNightAverage: null,
            localDayAverage: null,
        };
    }

    const prices = points.map((point) => point.price);
    const edgeSize = Math.max(1, Math.floor(points.length * 0.1));
    const firstAverage = average(prices.slice(0, edgeSize)) ?? prices[0];
    const lastAverage = average(prices.slice(-edgeSize)) ?? prices[prices.length - 1];
    const changePercent = percentDifference(lastAverage, firstAverage);

    const latest = points[points.length - 1].timestamp;
    const patternPoints = points.filter(
        (point) => point.timestamp >= latest - 30 * 24 * 60 * 60 * 1000,
    );
    const weekend = patternPoints.filter((point) => {
        const day = new Date(point.timestamp).getDay();
        return day === 0 || day === 6;
    });
    const weekday = patternPoints.filter((point) => {
        const day = new Date(point.timestamp).getDay();
        return day !== 0 && day !== 6;
    });
    const localNight = patternPoints.filter((point) => {
        const hour = new Date(point.timestamp).getHours();
        return hour < 6;
    });
    const localDay = patternPoints.filter((point) => {
        const hour = new Date(point.timestamp).getHours();
        return hour >= 12 && hour < 18;
    });

    const weekendAverage = average(weekend.map((point) => point.price));
    const weekdayAverage = average(weekday.map((point) => point.price));
    const nightAverage = average(localNight.map((point) => point.price));
    const dayAverage = average(localDay.map((point) => point.price));

    return {
        average: average(prices),
        low: Math.min(...prices),
        high: Math.max(...prices),
        changePercent,
        trend: changePercent > 3 ? "up" : changePercent < -3 ? "down" : "flat",
        weekendPercent:
            weekend.length >= 4 &&
            weekday.length >= 4 &&
            weekendAverage !== null &&
            weekdayAverage !== null
                ? percentDifference(weekendAverage, weekdayAverage)
                : null,
        weekendAverage,
        weekdayAverage,
        localNightPercent:
            localNight.length >= 4 &&
            localDay.length >= 4 &&
            nightAverage !== null &&
            dayAverage !== null
                ? percentDifference(nightAverage, dayAverage)
                : null,
        localNightAverage: nightAverage,
        localDayAverage: dayAverage,
    };
}
