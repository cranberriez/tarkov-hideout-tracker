import type { FleaPriceReason, FleaStability, PriceHistoryPoint } from "../../../src/types/prices";
import { deriveEffectivePrice } from "../../../src/lib/utils/price-history";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

/**
 * How long an observation describes the market. Upstream keeps daily aggregates
 * (stamped 00:00 UTC) for older history and a snapshot roughly every two hours
 * recently, and records nothing when no listings exist. A gap between snapshots
 * therefore never means "the last price persisted"; see unrecordedGap for when it
 * counts as missing data rather than no market.
 */
export const DAILY_HOLD_MS = 26 * HOUR;
export const SNAPSHOT_HOLD_MS = 3 * HOUR;
/** A robust value older than this cannot anchor a price change. */
const CHANGE_FRESH_MS = 26 * HOUR;
/** Matches the stale cutoff used by the current-price stability model. */
export const STALE_MS = 72 * HOUR;
/** A window needs this fraction of its duration observed before a statistic is reported. */
export const MIN_COVERAGE = 0.5;
/** Longest gap that can count as unrecorded; upstream outages seen so far lasted up to ~29 h. */
const MAX_UNRECORDED_GAP_MS = 48 * HOUR;
/** Same contiguous-regime tolerance as deriveEffectivePrice. */
const REGIME_RATIO = 1.25;
const TREND_MIN_MOVE = 0.05;
const VOLATILE_SPREAD = 0.35;
const THIN_DEPTH = 3;
const RECENT_REGIME_HOURS = 6;
/** A move of at least this factor versus the 7-day median, made on thin listings, is low confidence. */
const THIN_LARGE_MOVE_FACTOR = 2;
/** Snapshots making up the current level, and how recent they must be. */
const CURRENT_LEVEL_POINTS = 3;
const CURRENT_LEVEL_WINDOW_MS = 8 * HOUR;
const MOVE_WINDOW_MS = 12 * HOUR;
const MOVE_MIN_POINTS = 4;

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
	| "above-max-net"
	| "recent-regime-change"
	| "thin-large-move";

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
	/** The same changes in roubles: market value now minus market value then. */
	change24hRub: number | null;
	change7dRub: number | null;
	/**
	 * Responsive level: median of the last three snapshots within 8 hours. The market
	 * value is deliberately conservative (it waits for confirmation) and can lag this.
	 */
	currentLevel: number | null;
	/** Robust (Theil-Sen) direction of the minimum over the last 12 hours, as a relative change per 12 hours. */
	move12h: number | null;
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

function holdFor(point: PriceHistoryPoint): number {
	return point.timestamp % DAY === 0 ? DAILY_HOLD_MS : SNAPSHOT_HOLD_MS;
}

/**
 * A gap bounded by normal depth at a similar price on both sides is missing data
 * (an upstream outage or a skipped scan), not an absent market: a liquid item does
 * not lose every listing and come back unchanged. Only the item's own data decides;
 * Tarkov.dev does not publish outages. Thin items keep "gap = no market".
 */
export function unrecordedGap(before: PriceHistoryPoint, after: PriceHistoryPoint): boolean {
	return (
		usable(before) &&
		usable(after) &&
		before.offerCount !== null &&
		after.offerCount !== null &&
		before.offerCount >= THIN_DEPTH &&
		after.offerCount >= THIN_DEPTH &&
		Math.max(before.priceMin, after.priceMin) / Math.min(before.priceMin, after.priceMin) <= REGIME_RATIO &&
		after.timestamp - before.timestamp <= MAX_UNRECORDED_GAP_MS
	);
}

/** Time within [start, end) that falls in unrecorded gaps (beyond each observation's hold). */
function unrecordedTime(points: readonly PriceHistoryPoint[], start: number, end: number): number {
	let total = 0;
	for (let index = 0; index + 1 < points.length; index += 1) {
		const [point, next] = [points[index], points[index + 1]];
		if (!unrecordedGap(point, next)) continue;
		const from = Math.max(point.timestamp + holdFor(point), start);
		const to = Math.min(next.timestamp, end);
		if (to > from) total += to - from;
	}
	return total;
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
		const holdUntil = Math.min(points[index + 1]?.timestamp ?? Infinity, point.timestamp + holdFor(point), end);
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

/**
 * Coverage is the observed share of the window's recorded time: unrecorded gaps are
 * not held against the item, but at least half the window must remain to judge, so
 * a reported statistic always rests on a quarter of its window or more.
 */
function windowView(points: readonly PriceHistoryPoint[], end: number, length: number): WindowView {
	const samples = timeWeightedSamples(points, end - length, end);
	const observed = samples.reduce((sum, sample) => sum + sample.weight, 0);
	const recorded = Math.max(length - unrecordedTime(points, end - length, end), length * MIN_COVERAGE);
	return { samples, coverage: observed / recorded };
}

function covered(view: WindowView, fraction: number): number | null {
	return view.coverage >= MIN_COVERAGE ? weightedQuantile(view.samples, fraction) : null;
}

/**
 * The site's robust market value as it stood at `at`, from history known then.
 * It already refuses unconfirmed jumps and shallow undercuts, so price changes
 * compare like with like. Null when there was no recent observation at that time.
 */
export function marketValueAsOf(points: readonly PriceHistoryPoint[], at: number): number | null {
	const known = points.filter((point) => point.timestamp <= at);
	const latest = known.at(-1);
	if (!latest || at - latest.timestamp > CHANGE_FRESH_MS) return null;
	return deriveEffectivePrice(known, undefined, at).effectivePrice;
}

function change(current: number | null, previous: number | null): number | null {
	return current !== null && previous !== null && previous > 0 ? current / previous - 1 : null;
}

function difference(current: number | null, previous: number | null): number | null {
	return current !== null && previous !== null ? current - previous : null;
}

/** Median of the last three usable snapshots within 8 hours of `at`; null without recent listings. */
export function currentLevelAt(points: readonly PriceHistoryPoint[], at: number): number | null {
	const recent = points
		.filter((point) => usable(point) && point.timestamp <= at && point.timestamp > at - CURRENT_LEVEL_WINDOW_MS)
		.slice(-CURRENT_LEVEL_POINTS);
	return median(recent.map((point) => point.priceMin));
}

/**
 * Relative change per 12 hours from the Theil-Sen slope of log minimum prices over
 * the last 12 hours: the median of all pairwise slopes, so a lone undercut or spike
 * cannot set the direction. Needs four snapshots.
 */
export function move12hAt(points: readonly PriceHistoryPoint[], at: number): number | null {
	const recent = points.filter(
		(point) => usable(point) && point.timestamp <= at && point.timestamp >= at - MOVE_WINDOW_MS,
	);
	if (recent.length < MOVE_MIN_POINTS) return null;
	const slopes: number[] = [];
	for (let left = 0; left < recent.length; left += 1)
		for (let right = left + 1; right < recent.length; right += 1)
			slopes.push(
				(Math.log(recent[right].priceMin) - Math.log(recent[left].priceMin)) /
					(recent[right].timestamp - recent[left].timestamp),
			);
	return Math.exp(median(slopes)! * MOVE_WINDOW_MS) - 1;
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

	const valueNow = marketValueAsOf(points, now);
	const value24hAgo = marketValueAsOf(points, now - DAY);
	const value7dAgo = marketValueAsOf(points, now - 7 * DAY);
	const median7d = covered(week, 0.5);
	const q25 = covered(week, 0.25);
	const q75 = covered(week, 0.75);
	const volatility7d = median7d && q25 !== null && q75 !== null ? (q75 - q25) / median7d : null;
	const change7d = change(valueNow, value7dAgo);
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
	// Offer counts are listing snapshots, not volume; a big move on one or two listings is weak evidence.
	const thinLargeMove =
		depthMedian24h !== null &&
		depthMedian24h < THIN_DEPTH &&
		effective.effectivePrice !== null &&
		median7d !== null &&
		median7d > 0 &&
		Math.max(effective.effectivePrice / median7d, median7d / effective.effectivePrice) >= THIN_LARGE_MOVE_FACTOR;
	if (thinLargeMove) reasons.push("thin-large-move");
	const severe = reasons.some(
		(reason) =>
			reason === "stale" || reason === "no-offers" || reason === "short-history" || reason === "thin-large-move",
	);
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
		change6h: change(valueNow, marketValueAsOf(points, now - 6 * HOUR)),
		change24h: change(valueNow, value24hAgo),
		change7d,
		change24hRub: difference(valueNow, value24hAgo),
		change7dRub: difference(valueNow, value7dAgo),
		currentLevel: currentLevelAt(points, now),
		move12h: move12hAt(points, now),
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
