import { FUEL_TANK_ITEM_IDS } from "../cfg/hideout-power";
import type { ItemSummary } from "@/types/items";
import type { AcquisitionPlan, ManualPriceOverrides } from "./types";
import { calcTax, itemBasePrice, type TaxOptions } from "./calc-tax";

/** Only reviewed containers may substitute their empty value in recipe inputs. */
export function supportsEmptyValue(itemId: string) {
	return (FUEL_TANK_ITEM_IDS as readonly string[]).includes(itemId);
}

export function getEmptyValue(itemId: string, overrides: ManualPriceOverrides = {}): number | null {
	const value = overrides[itemId]?.emptyValue;
	return supportsEmptyValue(itemId) && typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

/** The saved amount stays gross; only calculation consumers deduct the estimated flea fee. */
export function getEmptySale(
	item: ItemSummary | undefined,
	overrides: ManualPriceOverrides = {},
	options: TaxOptions = {},
) {
	if (!item) return null;
	const gross = getEmptyValue(item.id, overrides);
	if (gross === null) return null;
	const base = itemBasePrice(item.marketPrice?.sellFor, options);
	const fee = gross === 0 ? 0 : base === null ? null : calcTax(base, gross, 1, options);
	return { gross, fee, net: fee === null ? null : Math.max(0, gross - fee) };
}

export function emptyIngredientPlan(
	item: ItemSummary | undefined,
	quantity: number,
	overrides: ManualPriceOverrides = {},
	options: TaxOptions = {},
): AcquisitionPlan | null {
	if (!item) return null;
	const sale = getEmptySale(item, overrides, options);
	if (sale === null) return null;
	const totalCost = sale.net === null ? null : sale.net * Math.max(0, quantity);
	return {
		itemId: item.id,
		quantity: Math.max(0, quantity),
		method: "empty",
		batches: 1,
		totalCost,
		theoreticalCost: totalCost,
		selectedRouteTheoreticalCost: totalCost ?? undefined,
		theoreticalMethod: "empty",
		directBuyCost: null,
		directBuyMethod: null,
		durationSeconds: 0,
		children: [],
		alternatives: [],
	};
}
