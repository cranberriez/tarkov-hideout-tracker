"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { getItemSellComparison, PHYSICAL_BITCOIN_ITEM_ID } from "@/lib/price-calculation";
import { getEmptySale, getEmptyValue } from "@/lib/price-calculation/empty-value";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { FUEL_TANK_ITEM_IDS, GRAPHICS_CARD_ITEM_ID } from "@/lib/cfg/hideout-power";
import type { ProfitPageData } from "@/types/contracts";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { useStationCraftData, useStationRecipeCalculator } from "../details/crafts/useStationCraftEvaluations";
import { fuelCostPerHour, fuelMultiplier, fuelRuntimeHours, type FuelMultiplier } from "./hideout-power-model";

export interface FuelTank {
	id: string;
	item: ItemSummary | undefined;
	/** Recommended acquisition cost for one tank. */
	price: number | null;
	emptyValue: number | null;
	netPrice: number | null;
	units: number | undefined;
	runtimeHours: number | null;
	costPerHour: number | null;
}

export interface HideoutPower {
	pricing: "loading" | "ready" | "unavailable";
	unavailableReason: string | null;
	fuel: FuelMultiplier;
	tanks: FuelTank[];
	gpu: { item: ItemSummary | undefined; price: number | null };
	bitcoin: { item: ItemSummary | undefined; price: number | null; source: string | null };
	/** Referenced items absent from the recipe item list; they cannot be priced. */
	missingItemIds: string[];
	hideoutManagementSkillLevel: number;
	stationLevels: Record<string, number>;
}

/**
 * Fuel burn and Bitcoin Farm inputs for the station page: the shared recipe query and
 * calculator price GPUs and fuel tanks (recommended acquisition) and Physical Bitcoin (best sale).
 */
export function useHideoutPower(
	mode: TarkovJsonGameMode,
	fallbackData: ProfitPageData | null,
	stations: readonly Station[],
): HideoutPower {
	const { data } = useStationCraftData(mode, fallbackData);
	const recipe = useStationRecipeCalculator(mode, data);
	const stationLevels = useUserStore((state) => state.stationLevels);
	const traderLoyaltyLevels = useUserStore((state) => state.questTraderLoyaltyLevels);
	const { calculator, itemsById, overrides, saleContext, hideoutManagementSkillLevel } = recipe;

	return useMemo(() => {
		const fuel = fuelMultiplier({ stations, stationLevels, hideoutManagementSkillLevel });
		const cost = (itemId: string) =>
			calculator && itemsById[itemId] ? calculator.evaluateNode(itemId, 1).totalCost : null;
		const tanks = FUEL_TANK_ITEM_IDS.map((id): FuelTank => {
			const item = itemsById[id];
			const price = cost(id);
			const emptyValue = getEmptyValue(id, overrides);
			const emptySale = getEmptySale(item, overrides, {
				stationLevels,
				traderLoyaltyLevels,
				hideoutManagementSkillLevel,
			});
			const residual = emptyValue === null ? 0 : (emptySale?.net ?? null);
			const netPrice = price === null || residual === null ? null : Math.max(0, price - residual);
			return {
				id,
				item,
				price,
				emptyValue,
				netPrice,
				units: item?.resourceUnits,
				runtimeHours: item?.resourceUnits ? fuelRuntimeHours(item.resourceUnits, fuel.unitsPerHour) : null,
				costPerHour: fuelCostPerHour(netPrice, item?.resourceUnits, fuel.unitsPerHour),
			};
		});
		const bitcoinItem = itemsById[PHYSICAL_BITCOIN_ITEM_ID];
		const sale = calculator && bitcoinItem ? getItemSellComparison(bitcoinItem, overrides, saleContext) : null;
		return {
			pricing: recipe.status,
			unavailableReason: recipe.unavailableReason,
			fuel,
			tanks,
			gpu: { item: itemsById[GRAPHICS_CARD_ITEM_ID], price: cost(GRAPHICS_CARD_ITEM_ID) },
			bitcoin: {
				item: bitcoinItem,
				price: sale ? (sale.selectedNetPrice ?? sale.selectedPrice) : null,
				source:
					sale?.selectedSource === "trader"
						? (sale.bestTraderOffer?.vendor.name ?? "Trader")
						: sale?.selectedSource === "flea"
							? "Flea"
							: sale?.selectedSource === "manual"
								? "Manual price"
								: null,
			},
			missingItemIds: data
				? [GRAPHICS_CARD_ITEM_ID, PHYSICAL_BITCOIN_ITEM_ID, ...FUEL_TANK_ITEM_IDS].filter((id) => !itemsById[id])
				: [],
			hideoutManagementSkillLevel,
			stationLevels,
		};
	}, [
		stations,
		stationLevels,
		traderLoyaltyLevels,
		hideoutManagementSkillLevel,
		calculator,
		itemsById,
		overrides,
		saleContext,
		data,
		recipe.status,
		recipe.unavailableReason,
	]);
}
