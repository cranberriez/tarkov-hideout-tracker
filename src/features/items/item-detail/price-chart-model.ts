import type { PriceHistoryPoint } from "@/types/prices";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export type PriceSeries = "price" | "priceMin";
export type PriceChartStyle = "lines" | "band" | "step" | "smoothed";

export const PRICE_CHART_STYLES: Array<{ value: PriceChartStyle; label: string }> = [
	{ value: "lines", label: "Lines" },
	{ value: "band", label: "Spread band" },
	{ value: "step", label: "Stepped" },
	{ value: "smoothed", label: "Smoothed" },
];

/**
 * Upstream keeps daily aggregates (00:00 UTC) for older history and a snapshot about
 * every two hours recently, and records nothing while no listings exist. A longer gap
 * than one sampling interval therefore means "no market", not a price in between.
 */
function holdAfter(point: PriceHistoryPoint) {
	return point.timestamp % DAY === 0 ? 26 * HOUR : 3 * HOUR;
}

/** Contiguous runs of observations; the chart bridges the gaps between them with a dashed line. */
export function splitAtGaps(points: readonly PriceHistoryPoint[]): PriceHistoryPoint[][] {
	const segments: PriceHistoryPoint[][] = [];
	for (const point of points) {
		const current = segments.at(-1);
		const previous = current?.at(-1);
		if (current && previous && point.timestamp - previous.timestamp <= holdAfter(previous)) current.push(point);
		else segments.push([point]);
	}
	return segments;
}

/** Median of each point and its neighbours (window 3), so single spikes and undercuts flatten. */
export function rollingMedian(points: readonly PriceHistoryPoint[], series: PriceSeries): number[] {
	return points.map((_, index) => {
		const window = points.slice(Math.max(0, index - 1), index + 2).map((point) => point[series]);
		return [...window].sort((left, right) => left - right)[Math.floor(window.length / 2)];
	});
}

export interface ChartScale {
	x: (timestamp: number) => number;
	y: (price: number) => number;
}

/** SVG path through the values; stepped holds each value until the next observation. */
export function seriesPath(
	points: readonly PriceHistoryPoint[],
	values: readonly number[],
	scale: ChartScale,
	stepped = false,
): string {
	return points
		.map((point, index) => {
			const x = scale.x(point.timestamp);
			const y = scale.y(values[index]);
			if (index === 0) return `M${x},${y}`;
			return stepped ? `H${x} V${y}` : `L${x},${y}`;
		})
		.join(" ");
}

/** Closed area between the minimum listing (bottom) and the aggregate (top). */
export function spreadBandPath(points: readonly PriceHistoryPoint[], scale: ChartScale): string {
	if (!points.length) return "";
	const top = points.map((point, index) => `${index ? "L" : "M"}${scale.x(point.timestamp)},${scale.y(point.price)}`);
	const bottom = [...points].reverse().map((point) => `L${scale.x(point.timestamp)},${scale.y(point.priceMin)}`);
	return `${top.join(" ")} ${bottom.join(" ")} Z`;
}
