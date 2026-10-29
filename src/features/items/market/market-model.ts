import type { MarketOverviewItem } from "@/types/contracts";

export type MarketWindow = "24h" | "7d";
export type MoveUnit = "percent" | "rub";

export interface MarketFilters {
	includeLowConfidence: boolean;
	category: string | null;
}

/** Ordered change bands for the breadth chart; `direction` drives its diverging color. */
export const MOVE_BANDS = [
	{ id: "down-50", label: "≤ −50%", short: "≤−50", min: -Infinity, max: -0.5, direction: -3 },
	{ id: "down-25", label: "−50 to −25%", short: "−25", min: -0.5, max: -0.25, direction: -2 },
	{ id: "down-10", label: "−25 to −10%", short: "−10", min: -0.25, max: -0.1, direction: -1 },
	{ id: "down-2", label: "−10 to −2%", short: "−2", min: -0.1, max: -0.02, direction: -1 },
	{ id: "flat", label: "±2%", short: "±2", min: -0.02, max: 0.02, direction: 0 },
	{ id: "up-2", label: "+2 to +10%", short: "+2", min: 0.02, max: 0.1, direction: 1 },
	{ id: "up-10", label: "+10 to +25%", short: "+10", min: 0.1, max: 0.25, direction: 1 },
	{ id: "up-25", label: "+25 to +50%", short: "+25", min: 0.25, max: 0.5, direction: 2 },
	{ id: "up-50", label: "≥ +50%", short: "≥+50", min: 0.5, max: Infinity, direction: 3 },
] as const;

export type MoveBand = (typeof MOVE_BANDS)[number];
export type MoveBandId = MoveBand["id"];

export function changeOf(item: MarketOverviewItem, window: MarketWindow): number | null {
	return window === "24h" ? item.change24h : item.change7d;
}

export function changeRubOf(item: MarketOverviewItem, window: MarketWindow): number | null {
	return window === "24h" ? item.change24hRub : item.change7dRub;
}

/** The analyzer's robust current level, falling back to the market value. */
export function currentPrice(item: MarketOverviewItem): number | null {
	return item.currentLevel ?? item.marketValue;
}

export function bandOf(change: number): MoveBand {
	// Bands are symmetric by magnitude: each lower edge is inclusive, so exactly ±50% is "≥ 50%".
	const magnitude = Math.abs(change);
	if (magnitude <= 0.02) return MOVE_BANDS[4];
	const step = magnitude >= 0.5 ? 4 : magnitude >= 0.25 ? 3 : magnitude >= 0.1 ? 2 : 1;
	return MOVE_BANDS[change > 0 ? 4 + step : 4 - step];
}

/** Position of the current price inside the 7-day low–high range (0–1), or null without a range. */
export function rangePosition(item: MarketOverviewItem): number | null {
	const price = currentPrice(item);
	const { rangeLow7d: low, rangeHigh7d: high } = item;
	if (price === null || low === null || high === null || high <= low) return null;
	return Math.min(1, Math.max(0, (price - low) / (high - low)));
}

/**
 * A move with real evidence, matching the development dashboard: not low confidence, at least
 * three listings, and larger than the flea fee a seller would pay.
 */
export function isEvidencedMove(item: MarketOverviewItem, window: MarketWindow): boolean {
	const rub = changeRubOf(item, window);
	if (rub === null || changeOf(item, window) === null) return false;
	if (item.confidence === "low" || (item.depthMedian24h ?? 0) < 3) return false;
	return item.fleaFee === null || Math.abs(rub) > item.fleaFee;
}

export function filterMarketItems(items: readonly MarketOverviewItem[], filters: MarketFilters): MarketOverviewItem[] {
	return items.filter(
		(item) =>
			(filters.includeLowConfidence || item.confidence !== "low") &&
			(filters.category === null || item.category === filters.category),
	);
}

export function categoriesOf(items: readonly MarketOverviewItem[]): string[] {
	return [
		...new Set(items.map((item) => item.category).filter((category): category is string => category !== null)),
	].sort((a, b) => a.localeCompare(b));
}

function median(values: number[]): number | null {
	if (!values.length) return null;
	const sorted = [...values].sort((a, b) => a - b);
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

export interface MarketSummary {
	total: number;
	trend: Record<MarketOverviewItem["trend"], number>;
	medianChange: number | null;
	activeShocks: number;
	belowRange: number;
	aboveRange: number;
}

export function summarizeMarket(items: readonly MarketOverviewItem[], window: MarketWindow): MarketSummary {
	const trend = { rising: 0, falling: 0, stable: 0, unknown: 0 };
	const changes: number[] = [];
	let activeShocks = 0;
	let belowRange = 0;
	let aboveRange = 0;
	for (const item of items) {
		trend[item.trend] += 1;
		const change = changeOf(item, window);
		if (change !== null) changes.push(change);
		if (item.shock && (item.shock.phase === "holding" || item.shock.phase === "retracing")) activeShocks += 1;
		const position = rangePosition(item);
		if (position === 0) belowRange += 1;
		if (position === 1) aboveRange += 1;
	}
	return { total: items.length, trend, medianChange: median(changes), activeShocks, belowRange, aboveRange };
}

export function moveBandCounts(items: readonly MarketOverviewItem[], window: MarketWindow) {
	const counts = new Map<MoveBandId, number>(MOVE_BANDS.map((band) => [band.id, 0]));
	for (const item of items) {
		const change = changeOf(item, window);
		if (change === null) continue;
		const id = bandOf(change).id;
		counts.set(id, (counts.get(id) ?? 0) + 1);
	}
	return MOVE_BANDS.map((band) => ({ band, count: counts.get(band.id) ?? 0 }));
}

export function topMovers(
	items: readonly MarketOverviewItem[],
	window: MarketWindow,
	unit: MoveUnit,
	direction: "up" | "down",
	limit = 8,
): MarketOverviewItem[] {
	const value = (item: MarketOverviewItem) =>
		(unit === "rub" ? changeRubOf(item, window) : changeOf(item, window)) ?? 0;
	const sign = direction === "up" ? 1 : -1;
	return items
		.filter((item) => isEvidencedMove(item, window) && value(item) * sign > 0)
		.sort((a, b) => (value(b) - value(a)) * sign)
		.slice(0, limit);
}

/** Holding or retracing shocks, largest spike relative to its baseline first. */
export function activeShocks(items: readonly MarketOverviewItem[], limit = 8): MarketOverviewItem[] {
	const size = (item: MarketOverviewItem) => {
		const { baseline, extreme } = item.shock ?? {};
		return baseline && extreme ? Math.abs(extreme - baseline) / baseline : 0;
	};
	return items
		.filter(
			(item) => item.confidence !== "low" && (item.shock?.phase === "holding" || item.shock?.phase === "retracing"),
		)
		.sort((a, b) => size(b) - size(a))
		.slice(0, limit);
}

export function mostVolatile(items: readonly MarketOverviewItem[], limit = 8): MarketOverviewItem[] {
	return items
		.filter((item) => item.volatility7d !== null && item.confidence !== "low" && (item.depthMedian24h ?? 0) >= 3)
		.sort((a, b) => (b.volatility7d ?? 0) - (a.volatility7d ?? 0))
		.slice(0, limit);
}

/** Items priced at the bottom (or top) of their 30-day history. */
export function monthExtremes(
	items: readonly MarketOverviewItem[],
	side: "low" | "high",
	limit = 8,
): MarketOverviewItem[] {
	const value = (item: MarketOverviewItem) => item.percentile30d ?? 0.5;
	return items
		.filter(
			(item) =>
				item.percentile30d !== null &&
				item.confidence !== "low" &&
				(side === "low" ? item.percentile30d <= 0.1 : item.percentile30d >= 0.9),
		)
		.sort(
			(a, b) =>
				(side === "low" ? value(a) - value(b) : value(b) - value(a)) || (b.marketValue ?? 0) - (a.marketValue ?? 0),
		)
		.slice(0, limit);
}

export type ExplorerSortKey =
	"name" | "price" | "change" | "changeRub" | "range" | "percentile" | "volatility" | "offers";

export function sortValue(
	item: MarketOverviewItem,
	key: ExplorerSortKey,
	window: MarketWindow,
): number | string | null {
	switch (key) {
		case "name":
			return item.name;
		case "price":
			return currentPrice(item);
		case "change":
			return changeOf(item, window);
		case "changeRub":
			return changeRubOf(item, window);
		case "range":
			return rangePosition(item);
		case "percentile":
			return item.percentile30d;
		case "volatility":
			return item.volatility7d;
		case "offers":
			return item.liveOfferCount;
	}
}

/** Sorts by one column; missing values always sink to the bottom. */
export function sortMarketItems(
	items: readonly MarketOverviewItem[],
	key: ExplorerSortKey,
	descending: boolean,
	window: MarketWindow,
): MarketOverviewItem[] {
	const direction = descending ? -1 : 1;
	return [...items].sort((a, b) => {
		const left = sortValue(a, key, window);
		const right = sortValue(b, key, window);
		if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
		if (typeof left === "string" || typeof right === "string")
			return String(left).localeCompare(String(right)) * direction;
		return (left - right) * direction;
	});
}
