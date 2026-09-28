import type { PriceHistoryPoint, VendorPrice } from "../../../src/types/prices";
import { computeEconomics } from "./economics";
import { computeMarketMetrics, type Confidence, type Trend } from "./metrics";

/** One persisted row of item_market_observations. */
export interface MarketObservation {
	itemId: string;
	calculatedAt: number;
	sourceUpdatedAt: number;
	livePrice: number;
	livePriceMin: number;
	liveOfferCount: number | null;
	marketValue: number | null;
	stability: string;
	median24h: number | null;
	median7d: number | null;
	median30d: number | null;
	rangeLow7d: number | null;
	rangeHigh7d: number | null;
	change6h: number | null;
	change24h: number | null;
	change7d: number | null;
	percentile30d: number | null;
	volatility7d: number | null;
	trend: Trend;
	persistenceHours: number | null;
	depthMedian24h: number | null;
	confidence: Confidence;
	basePrice: number | null;
	traderValue: number | null;
	fleaNet: number | null;
	traderBreakEven: number | null;
	practicalBreakEven: number | null;
	maxNetPrice: number | null;
	/** Supporting evidence: why confidence is reduced, window coverage, trader identity. */
	confidenceReasons: string[];
	stabilityReasons: string[];
	coverage24h: number;
	coverage7d: number;
	coverage30d: number;
	regimePoints: number;
	traderId: string | null;
	fleaFee: number | null;
	maxNet: number | null;
}

function rounded(value: number | null, digits = 4): number | null {
	return value === null ? null : Number(value.toFixed(digits));
}

export function buildObservation(
	itemId: string,
	points: readonly PriceHistoryPoint[],
	sellFor: readonly VendorPrice[],
	calculatedAt: number,
): MarketObservation | null {
	const metrics = computeMarketMetrics(points, calculatedAt);
	if (!metrics) return null;
	const economics = computeEconomics(metrics.marketValue, sellFor);
	return {
		itemId,
		calculatedAt,
		sourceUpdatedAt: metrics.sourceUpdatedAt,
		livePrice: metrics.livePrice,
		livePriceMin: metrics.livePriceMin,
		liveOfferCount: metrics.liveOfferCount,
		marketValue: metrics.marketValue,
		stability: metrics.stability,
		median24h: metrics.median24h,
		median7d: metrics.median7d,
		median30d: metrics.median30d,
		rangeLow7d: metrics.rangeLow7d,
		rangeHigh7d: metrics.rangeHigh7d,
		change6h: rounded(metrics.change6h),
		change24h: rounded(metrics.change24h),
		change7d: rounded(metrics.change7d),
		percentile30d: rounded(metrics.percentile30d),
		volatility7d: rounded(metrics.volatility7d),
		trend: metrics.trend,
		persistenceHours: rounded(metrics.persistenceHours, 2),
		depthMedian24h: metrics.depthMedian24h,
		confidence: metrics.confidence,
		basePrice: economics.basePrice,
		traderValue: economics.traderValue,
		fleaNet: economics.fleaNet,
		traderBreakEven: economics.traderBreakEven,
		practicalBreakEven: economics.practicalBreakEven,
		maxNetPrice: economics.maxNetPrice,
		confidenceReasons: metrics.confidenceReasons,
		stabilityReasons: metrics.stabilityReasons,
		coverage24h: rounded(metrics.coverage.day, 3)!,
		coverage7d: rounded(metrics.coverage.week, 3)!,
		coverage30d: rounded(metrics.coverage.month, 3)!,
		regimePoints: metrics.regimePoints,
		traderId: economics.traderId,
		fleaFee: economics.fleaFee,
		maxNet: economics.maxNet,
	};
}
