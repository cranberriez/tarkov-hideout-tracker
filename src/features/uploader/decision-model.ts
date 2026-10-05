import type { CurrentPrice } from "../../types/prices";

export type ItemAction = "KEEP" | "SELL" | "HOLD";
export interface SurplusDecision {
	action: Exclude<ItemAction, "KEEP">;
	why: string;
	pending?: boolean;
}

const HOUR = 60 * 60 * 1000;
const fresh = (timestamp: number | null | undefined, now: number) =>
	!!timestamp && Number.isFinite(timestamp) && timestamp <= now + 5 * 60 * 1000 && now - timestamp <= 72 * HOUR;

/** Best per-unit return before flea fees: flea estimate or the highest trader offer. */
export function unitSellValue(price: CurrentPrice | undefined) {
	const values = [price?.price, ...(price?.sellFor ?? []).map((offer) => offer.priceRUB)].filter(
		(value): value is number => typeof value === "number" && Number.isFinite(value) && value > 0,
	);
	return values.length ? Math.max(...values) : undefined;
}

/** Copies nothing reserves are sold unless a reliable flea price sits below its usual range. */
export function decideSurplus(
	price: CurrentPrice | undefined,
	state: string | undefined,
	now: number,
): SurplusDecision {
	if (state === "pending") return { action: "SELL", why: "Loading prices…", pending: true };
	if (state === "error") return { action: "SELL", why: "Nothing needs these copies. Prices failed to load." };
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
	if (!reliable)
		return { action: "SELL", why: "Nothing needs these copies. No reliable price range to time the sale." };
	if (current < reference.rangeLow)
		return {
			action: "HOLD",
			why: "Nothing needs these copies, but the flea price is below its usual 7-day range. Low prices have tended to recover.",
		};
	if (current >= reference.rangeHigh)
		return { action: "SELL", why: "Nothing needs these copies, and the flea price is above its usual 7-day range." };
	return { action: "SELL", why: "Nothing needs these copies. The flea price is within its usual 7-day range." };
}
