import type { CurrentPrice } from "@/types/prices";

/**
 * Backtested on PVP flea history (Jun–Sep 2026, every item, levels computed 18 h earlier):
 * after a "high" flag the price was a median 7% lower 72 h later (lower 58%, higher 17%);
 * after a "low" flag a median 12% higher (higher 63%, lower 11%).
 */
const HIGH_FACTOR = 1.15;
const LOW_FACTOR = 0.87;
/** The analyzer runs daily; older levels are not compared with the current price. */
const MAX_REFERENCE_LAG_MS = 36 * 60 * 60 * 1000;

export interface MarketTiming {
	kind: "high" | "low";
	price: number;
	typical: number;
	rangeLow: number;
	rangeHigh: number;
}

/**
 * Flags a current flea price that sits outside the item's recent normal range and well away
 * from its typical (7-day median) level. Null whenever the evidence is missing or stale.
 */
export function describeMarketTiming(marketPrice: CurrentPrice | null | undefined): MarketTiming | null {
	const reference = marketPrice?.marketReference;
	const price = marketPrice?.price;
	if (!marketPrice || !reference || typeof price !== "number" || !Number.isFinite(price) || price <= 0) return null;
	if (marketPrice.fleaStability !== "stable" && marketPrice.fleaStability !== "unstable") return null;
	if (marketPrice.fleaPriceReasons?.includes("stale")) return null;
	const observedAt = marketPrice.updatedAt;
	if (typeof observedAt !== "number" || Math.abs(observedAt - reference.calculatedAt) > MAX_REFERENCE_LAG_MS)
		return null;
	const { typical, rangeLow, rangeHigh } = reference;
	if (price >= Math.max(rangeHigh, typical * HIGH_FACTOR)) return { kind: "high", price, typical, rangeLow, rangeHigh };
	if (price <= Math.min(rangeLow, typical * LOW_FACTOR)) return { kind: "low", price, typical, rangeLow, rangeHigh };
	return null;
}
