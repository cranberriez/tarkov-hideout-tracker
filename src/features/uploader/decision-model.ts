import type { CurrentPrice } from "../../types/prices";

export type ItemAction = "KEEP" | "SELL" | "HOLD";
export interface SurplusDecision {
	action: Exclude<ItemAction, "KEEP">;
	/** Price-timing note; the reason the copies are surplus comes from the item's needs. */
	why: string;
	pending?: boolean;
}

const HOUR = 60 * 60 * 1000;
const fresh = (timestamp: number | null | undefined, now: number) =>
	!!timestamp && Number.isFinite(timestamp) && timestamp <= now + 5 * 60 * 1000 && now - timestamp <= 72 * HOUR;

const usable = (value: number | null | undefined): value is number =>
	typeof value === "number" && Number.isFinite(value) && value > 0;

/** Where one copy sells for the most before flea fees: the flea estimate or the best trader offer. */
export function bestSellOffer(
	price: CurrentPrice | undefined,
): { venue: "flea" | "trader"; traderId?: string; unit: number } | undefined {
	let best: { venue: "flea" | "trader"; traderId?: string; unit: number } | undefined = usable(price?.price)
		? { venue: "flea", unit: price.price }
		: undefined;
	for (const offer of price?.sellFor ?? [])
		if (usable(offer.priceRUB) && offer.priceRUB > (best?.unit ?? 0))
			best = { venue: "trader", traderId: offer.traderId, unit: offer.priceRUB };
	return best;
}

export const unitSellValue = (price: CurrentPrice | undefined) => bestSellOffer(price)?.unit;

/** Copies nothing reserves are sold unless a reliable flea price sits below its usual range. */
export function decideSurplus(
	price: CurrentPrice | undefined,
	state: string | undefined,
	now: number,
): SurplusDecision {
	if (state === "pending") return { action: "SELL", why: "Loading prices…", pending: true };
	if (state === "error") return { action: "SELL", why: "Prices didn't load." };
	const reference = price?.marketReference;
	const current = price?.price;
	const reliable =
		!!reference &&
		typeof current === "number" &&
		Number.isFinite(current) &&
		current > 0 &&
		price?.fleaStability === "stable" &&
		!price.fleaPriceReasons?.includes("stale") &&
		fresh(price.updatedAt, now) &&
		fresh(reference.calculatedAt, now);
	if (!reliable) return { action: "SELL", why: "Not enough price history to time the sale." };
	if (current < reference.rangeLow)
		return {
			action: "HOLD",
			why: "The flea price is lower than usual this week and usually recovers.",
		};
	if (current >= reference.rangeHigh)
		return {
			action: "SELL",
			why: "The flea price is higher than usual this week.",
		};
	return { action: "SELL", why: "The flea price is normal for this week." };
}
