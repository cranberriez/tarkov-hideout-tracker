import type { VendorPrice } from "@/types/prices";

export interface TaxOptions {
	stationLevels?: Readonly<Record<string, number>>;
	hideoutManagementSkillLevel?: number;
	traderLoyaltyLevels?: Readonly<Record<string, number>>;
}

const multipliers: Readonly<Record<string, number>> = {
	prapor: 0.4,
	therapist: 0.51,
	fence: 0.24,
	skier: 0.39,
	peacekeeper: 0.36,
	mechanic: 0.45,
	ragman: 0.5,
	jaeger: 0.48,
};
export const INTELLIGENCE_CENTER_ID = "5d484fdf654e7600691aadf8";

/** Catalog buybacks describe full items. Never infer base value from flea/purchase prices. */
export function itemBasePrice(offers: readonly VendorPrice[] = [], options: TaxOptions = {}): number | null {
	const values = offers.flatMap((offer) => {
		const name = offer.vendor.normalizedName.toLowerCase();
		// Ref's quote requires a known loyalty tier; prefer fixed-multiplier traders.
		const level = options.traderLoyaltyLevels?.[offer.vendor.id ?? "ref"];
		const multiplier = name === "ref" ? (level === undefined ? undefined : level >= 4 ? 0.5 : level >= 2 ? 0.45 : 0.4) : multipliers[name];
		return multiplier && Number.isFinite(offer.priceRUB) && offer.priceRUB > 0
			? [{ value: offer.priceRUB / multiplier, variable: name === "ref" || name === "fence" }]
			: [];
	});
	const fixed = values.filter((value) => !value.variable);
	const sorted = (fixed.length ? fixed : values).map((value) => value.value).sort((a, b) => a - b);
	if (!sorted.length) return null;
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** RUB listings, unit asking price, whole listing quantity. Bulk has no fee discount. */
export function calcTax(basePrice: number, unitPrice: number, quantity = 1, options: TaxOptions = {}): number | null {
	if (![basePrice, unitPrice, quantity].every(Number.isFinite) || basePrice <= 0 || unitPrice < 0 || quantity < 0) return null;
	if (quantity === 0 || unitPrice === 0) return 0;
	let po = Math.log10(basePrice / unitPrice);
	let pr = Math.log10(unitPrice / basePrice);
	if (unitPrice < basePrice) po = po ** 1.08;
	if (unitPrice >= basePrice) pr = pr ** 1.08;
	const skill = Number.isFinite(options.hideoutManagementSkillLevel) ? Math.min(50, Math.max(0, options.hideoutManagementSkillLevel ?? 0)) : 0;
	const intelligenceLevel = options.stationLevels?.[INTELLIGENCE_CENTER_ID] ?? options.stationLevels?.["intelligence-center"] ?? 0;
	const reduction = intelligenceLevel >= 3 ? 0.3 + skill * 0.003 : 0;
	const fee = (basePrice * 0.05 * 4 ** po + unitPrice * 0.05 * 4 ** pr) * quantity * (1 - reduction);
	return Number.isFinite(fee) ? Math.round(fee) : null;
}

/** Lowest whole-rouble asking price meeting a net target. Fees are nonlinear. */
export function fleaTargetPrice(basePrice: number, quantity: number, targetNet: number, options: TaxOptions = {}): number | null {
	if (!(basePrice > 0) || !(quantity > 0) || !(targetNet > 0) || ![basePrice, quantity, targetNet].every(Number.isFinite)) return null;
	const net = (price: number) => {
		const fee = calcTax(basePrice, price, quantity, options);
		return fee === null ? -Infinity : price * quantity - fee;
	};
	// Net proceeds eventually fall as punitive fees dominate. Locate the peak
	// before searching the rising side; never assume unbounded monotonicity.
	let upper = Math.max(2, Math.ceil(basePrice));
	for (let i = 0; i < 80 && net(upper * 2) > net(upper); i++) upper *= 2;
	let left = 1,
		right = upper * 2;
	for (let i = 0; i < 100 && right - left > 4; i++) {
		const a = left + (right - left) / 3,
			b = right - (right - left) / 3;
		if (net(a) < net(b)) left = a;
		else right = b;
	}
	const peak = Math.round((left + right) / 2);
	if (net(peak) < targetNet) return null;
	let low = 1,
		high = peak;
	while (low < high) {
		const middle = Math.floor((low + high) / 2);
		if (net(middle) >= targetNet) high = middle;
		else low = middle + 1;
	}
	return net(low) >= targetNet ? low : null;
}
