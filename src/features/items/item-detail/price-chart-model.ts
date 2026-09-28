import type { PriceHistoryRange } from "@/lib/utils/price-history";
import type { PriceHistoryPoint } from "@/types/prices";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type PriceSeries = "price" | "priceMin";

/**
 * Plotting resolution per range; null plots every observation. Longer ranges would
 * otherwise draw hundreds of two-hourly snapshots, and All would mix them with the
 * daily summaries Tarkov.dev keeps for older history.
 */
export const RANGE_BUCKET_MS: Record<PriceHistoryRange, number | null> = {
	day: null,
	threeDays: null,
	week: null,
	month: 12 * HOUR,
	all: DAY,
};

export interface ChartPoint extends PriceHistoryPoint {
	/** Present when the point summarises a UTC interval rather than being one observation. */
	bucket?: {
		end: number;
		count: number;
		/** Every observation is a Tarkov.dev daily summary (stamped 00:00 UTC). */
		upstreamDaily: boolean;
	};
}

/**
 * UTC-aligned buckets, summarised the way Tarkov.dev compacts older history into
 * daily aggregates (mean aggregate, lowest minimum listing, mean offer count), so
 * the recent snapshot era and the older daily era read the same. Empty buckets are
 * omitted; the chart bridges them as gaps.
 */
export function bucketPriceHistory(points: readonly PriceHistoryPoint[], bucketMs: number): ChartPoint[] {
	const buckets = new Map<number, PriceHistoryPoint[]>();
	for (const point of points) {
		const start = Math.floor(point.timestamp / bucketMs) * bucketMs;
		const bucket = buckets.get(start);
		if (bucket) bucket.push(point);
		else buckets.set(start, [point]);
	}
	return [...buckets]
		.sort(([left], [right]) => left - right)
		.map(([start, bucket]) => {
			const offers = bucket.map((point) => point.offerCount).filter((value): value is number => value !== null);
			return {
				timestamp: start,
				price: bucket.reduce((total, point) => total + point.price, 0) / bucket.length,
				priceMin: Math.min(...bucket.map((point) => point.priceMin)),
				offerCount: offers.length ? offers.reduce((total, value) => total + value, 0) / offers.length : null,
				bucket: {
					end: start + bucketMs,
					count: bucket.length,
					upstreamDaily: bucket.every((point) => point.timestamp % DAY === 0),
				},
			};
		});
}

/**
 * Upstream keeps daily aggregates (00:00 UTC) for older history and a snapshot about
 * every two hours recently. A longer gap than one sampling interval means Tarkov.dev
 * recorded nothing in between: often no listings, sometimes an upstream outage or a
 * skipped scan, so the chart never draws a price there.
 */
function holdAfter(point: PriceHistoryPoint) {
	return point.timestamp % DAY === 0 ? 26 * HOUR : 3 * HOUR;
}

/**
 * Contiguous runs of observations (or of adjacent buckets when `bucketMs` is given);
 * the chart bridges the gaps between them with a dashed line.
 */
export function splitAtGaps<Point extends PriceHistoryPoint>(
	points: readonly Point[],
	bucketMs: number | null = null,
): Point[][] {
	const segments: Point[][] = [];
	for (const point of points) {
		const current = segments.at(-1);
		const previous = current?.at(-1);
		const maxStep = bucketMs ?? (previous ? holdAfter(previous) : 0);
		if (current && previous && point.timestamp - previous.timestamp <= maxStep) current.push(point);
		else segments.push([point]);
	}
	return segments;
}

export interface ChartScale {
	x: (timestamp: number) => number;
	y: (price: number) => number;
}

/** SVG path joining the values at each observation time. */
export function seriesPath(points: readonly PriceHistoryPoint[], values: readonly number[], scale: ChartScale): string {
	return points
		.map((point, index) => `${index ? "L" : "M"}${scale.x(point.timestamp)},${scale.y(values[index])}`)
		.join(" ");
}
