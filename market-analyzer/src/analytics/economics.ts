import type { TraderSellOffer } from "../../../src/types/prices";
import { calcTax, fleaMaxNetPrice, fleaTargetPrice, itemBasePrice } from "../../../src/lib/price-calculation/calc-tax";
import { practicalSavingsThreshold } from "../../../src/lib/price-calculation/prices";

/**
 * Game-mechanics price envelope for one unit, for a baseline player (no
 * Intelligence Center fee reduction). Uses the website's shared tax code.
 */
export interface MarketEconomics {
	basePrice: number | null;
	traderValue: number | null;
	traderId: string | null;
	fleaFee: number | null;
	/** Net proceeds of listing at the market value. */
	fleaNet: number | null;
	/** Lowest asking price whose net matches the best trader sale. */
	traderBreakEven: number | null;
	/** Lowest asking price whose net beats the trader by a noticeable margin. */
	practicalBreakEven: number | null;
	/** Asking price with the highest net; above it fees consume the increase. */
	maxNetPrice: number | null;
	maxNet: number | null;
}

export function computeEconomics(marketValue: number | null, sellFor: readonly TraderSellOffer[]): MarketEconomics {
	const traderOffers = sellFor.filter((offer) => Number.isFinite(offer.priceRUB) && offer.priceRUB > 0);
	const best = [...traderOffers].sort((left, right) => right.priceRUB - left.priceRUB)[0] ?? null;
	const traderValue = best?.priceRUB ?? null;
	// Unrounded, exactly as the website computes fees; rounded only for storage.
	const basePrice = itemBasePrice(traderOffers);
	const fleaFee = basePrice !== null && marketValue !== null ? calcTax(basePrice, marketValue) : null;
	const maxNetPrice = basePrice === null ? null : fleaMaxNetPrice(basePrice);
	const maxNetFee = basePrice !== null && maxNetPrice !== null ? calcTax(basePrice, maxNetPrice) : null;
	return {
		basePrice: basePrice === null ? null : Math.round(basePrice),
		traderValue,
		traderId: best?.traderId ?? null,
		fleaFee,
		fleaNet: marketValue !== null && fleaFee !== null ? marketValue - fleaFee : null,
		traderBreakEven: basePrice !== null && traderValue !== null ? fleaTargetPrice(basePrice, 1, traderValue) : null,
		practicalBreakEven:
			basePrice !== null && traderValue !== null
				? fleaTargetPrice(basePrice, 1, traderValue + practicalSavingsThreshold(traderValue))
				: null,
		maxNetPrice,
		maxNet: maxNetPrice !== null && maxNetFee !== null ? maxNetPrice - maxNetFee : null,
	};
}
