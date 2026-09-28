import type { FleaPriceReason, FleaStability, PriceHistoryPoint } from "../../../src/types/prices";
import { deriveEffectivePrice } from "../../../src/lib/utils/price-history";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/** An observation describes the market until the next one, but never longer than this. */
export const MAX_STEP_MS = 26 * HOUR;
/** Matches the stale cutoff used by the current-price stability model. */
export const STALE_MS = 72 * HOUR;
/** A window needs this fraction of its duration observed before a statistic is reported. */
export const MIN_COVERAGE = 0.5;
/** Same contiguous-regime tolerance as deriveEffectivePrice. */
const REGIME_RATIO = 1.25;
const TREND_MIN_MOVE = 0.05;
const VOLATILE_SPREAD = 0.35;
const THIN_DEPTH = 3;
const RECENT_REGIME_HOURS = 6;

export type Trend = "rising" | "falling" | "stable" | "unknown";
export type Confidence = "high" | "medium" | "low";
export type ConfidenceReason =
	| "stale"
	| "no-offers"
	| "short-history"
	| "no-recent-listings"
	| "unknown-depth"
	| "thin-listings"
	| "volatile"
	| "unconfirmed-move"
	| "recent-regime-change";

export interface MarketMetrics {
	sourceUpdatedAt: number;
	livePrice: number;
	livePriceMin: number;
	liveOfferCount: number | null;
	/** The same robust estimate the website stores as the current flea price. */
	marketValue: number | null;
	stability: FleaStability;
	stabilityReasons: FleaPriceReason[];
	median24h: number | null;
	median7d: number | null;
	median30d: number | null;
	/** Time-weighted 10th-90th percentile of the last 7 days: the recent normal range. */
	rangeLow7d: number | null;
	rangeHigh7d: number | null;
	change6h: number | null;
	change24h: number | null;
	change7d: number | null;
	/** Share of the last 30 days the market spent below the current market value (0-1). */
	percentile30d: number | null;
	/** Relative interquartile spread of the last 7 days: (p75 - p25) / median. */
	volatility7d: number | null;
	trend: Trend;
	/** Hours the current price regime has persisted, and the observations supporting it. */
	persistenceHours: number | null;
	regimePoints: number;
	depthMedian24h: number | null;
	coverage: { day: number; week: number; month: number };
	confidence: Confidence;
	confidenceReasons: ConfidenceReason[];
}

interface WeightedValue {
	value: number;
	weight: number;
}

function usable(point: PriceHistoryPoint): boolean {
	return point.priceMin > 0 && point.offerCount !== 0;
}

/**
 * Time-weighted minimum listing prices within [start, end). Recent history is
 * sampled every ~2 hours and older history daily, so each observation weighs
 * by the time it represents rather than counting rows equally.
 */
export function timeWeightedSamples(points: readonly PriceHistoryPoint[], start: number, end: number): WeightedValue[] {
	const samples: WeightedValue[] = [];
	for (let index = 0; index < points.length; index += 1) {
		const point = points[index];
		const holdUntil = Math.min(points[index + 1]?.timestamp ?? Infinity, point.timestamp + MAX_STEP_MS, end);
		const weight = holdUntil - Math.max(point.timestamp, start);
		if (weight > 0 && usable(point)) samples.push({ value: point.priceMin, weight });
	}
	return samples;
}

export function weightedQuantile(samples: readonly WeightedValue[], fraction: number): number | null {
	const total = samples.reduce((sum, sample) => sum + sample.weight, 0);
	if (total <= 0) return null;
	const sorted = [...samples].sort((left, right) => left.value - right.value);
	let cumulative = 0;
	for (const sample of sorted) {
		cumulative += sample.weight;
		if (cumulative >= fraction * total - 1e-9) return sample.value;
	}
	return sorted[sorted.length - 1].value;
}

interface WindowView {
	samples: WeightedValue[];
	coverage: number;
}

function windowView(points: readonly PriceHistoryPoint[], end: number, length: number): WindowView {
	const samples = timeWeightedSamples(points, end - length, end);
	return { samples, coverage: samples.reduce((sum, sample) => sum + sample.weight, 0) / length };
}

function covered(view: WindowView, fraction: number): number | null {
	return view.coverage >= MIN_COVERAGE ? weightedQuantile(view.samples, fraction) : null;
}

/** Robust price level: the time-weighted median of the trailing window ending at `at`. */
function level(points: readonly PriceHistoryPoint[], at: number, length: number): number | null {
	return covered(windowView(points, at, length), 0.5);
}

function change(current: number | null, previous: number | null): number | null {
	return current !== null && previous !== null && previous > 0 ? current / previous - 1 : null;
}

function median(values: readonly number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function currentRegime(points: readonly PriceHistoryPoint[]): PriceHistoryPoint[] {
	const valid = points.filter(usable);
	if (!valid.length) return [];
	const tail = [valid[valid.length - 1]];
	for (let index = valid.length - 2; index >= 0; index -= 1) {
		const center = median(tail.map((point) => point.priceMin))!;
		const value = valid[index].priceMin;
		if (Math.max(value, center) / Math.min(value, center) > REGIME_RATIO) break;
		tail.unshift(valid[index]);
	}
	return tail;
}

function percentileOf(samples: readonly WeightedValue[], value: number): number | null {
	const total = samples.reduce((sum, sample) => sum + sample.weight, 0);
	if (total <= 0) return null;
	let below = 0;
	for (const sample of samples) {
		if (sample.value < value) below += sample.weight;
		else if (sample.value === value) below += sample.weight / 2;
	}
	return below / total;
}

/**
 * Explainable current-market measurements from a full upstream history
 * (ascending, normalized). Returns null when there is no observation at all.
 */
export function computeMarketMetrics(points: readonly PriceHistoryPoint[], now: number): MarketMetrics | null {
	const latest = points.at(-1);
	if (!latest) return null;
	const effective = deriveEffectivePrice(points, undefined, now);
	const day = windowView(points, now, DAY);
	const week = windowView(points, now, 7 * DAY);
	const month = windowView(points, now, 30 * DAY);

	const level6h = level(points, now, 6 * HOUR);
	const level24h = level(points, now, DAY);
	const median7d = covered(week, 0.5);
	const q25 = covered(week, 0.25);
	const q75 = covered(week, 0.75);
	const volatility7d = median7d && q25 !== null && q75 !== null ? (q75 - q25) / median7d : null;
	const change7d = change(level24h, level(points, now - 7 * DAY, DAY));
	const threshold = Math.max(TREND_MIN_MOVE, (volatility7d ?? 0) / 2);
	const trend: Trend =
		change7d === null ? "unknown" : change7d > threshold ? "rising" : change7d < -threshold ? "falling" : "stable";

	const regime = currentRegime(points);
	const persistenceHours = regime.length ? (regime[regime.length - 1].timestamp - regime[0].timestamp) / HOUR : null;
	// Upstream only records snapshots that found listings, so an empty day means no market, not unknown depth.
	const lastDay = points.filter((point) => point.timestamp >= now - DAY);
	const depthMedian24h = median(lastDay.filter((point) => point.offerCount !== null).map((point) => point.offerCount!));

	const reasons: ConfidenceReason[] = [];
	if (now - latest.timestamp > STALE_MS) reasons.push("stale");
	if (latest.offerCount === 0) reasons.push("no-offers");
	if (week.coverage < MIN_COVERAGE) reasons.push("short-history");
	if (!lastDay.length) reasons.push("no-recent-listings");
	else if (depthMedian24h === null) reasons.push("unknown-depth");
	else if (depthMedian24h < THIN_DEPTH) reasons.push("thin-listings");
	if (volatility7d !== null && volatility7d > VOLATILE_SPREAD) reasons.push("volatile");
	if (effective.reasons.includes("price-jump") || effective.reasons.includes("divergent-reference"))
		reasons.push("unconfirmed-move");
	if (persistenceHours !== null && persistenceHours < RECENT_REGIME_HOURS) reasons.push("recent-regime-change");
	const severe = reasons.some((reason) => reason === "stale" || reason === "no-offers" || reason === "short-history");
	const confidence: Confidence = severe || reasons.length >= 3 ? "low" : reasons.length ? "medium" : "high";

	return {
		sourceUpdatedAt: latest.timestamp,
		livePrice: latest.price,
		livePriceMin: latest.priceMin,
		liveOfferCount: latest.offerCount,
		marketValue: effective.effectivePrice,
		stability: effective.stability,
		stabilityReasons: effective.reasons,
		median24h: covered(day, 0.5),
		median7d,
		median30d: covered(month, 0.5),
		rangeLow7d: covered(week, 0.1),
		rangeHigh7d: covered(week, 0.9),
		change6h: change(level6h, level(points, now - 6 * HOUR, 6 * HOUR)),
		change24h: change(level6h, level(points, now - DAY, 6 * HOUR)),
		change7d,
		percentile30d:
			effective.effectivePrice !== null && month.coverage >= MIN_COVERAGE
				? percentileOf(month.samples, effective.effectivePrice)
				: null,
		volatility7d,
		trend,
		persistenceHours,
		regimePoints: regime.length,
		depthMedian24h,
		coverage: { day: day.coverage, week: week.coverage, month: month.coverage },
		confidence,
		confidenceReasons: reasons,
	};
}
