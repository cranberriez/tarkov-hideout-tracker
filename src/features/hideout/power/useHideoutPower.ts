"use client";

import { useMemo } from "react";
import { useUserStore } from "@/lib/stores/useUserStore";
import { PHYSICAL_BITCOIN_ITEM_ID } from "@/lib/price-calculation";
import { getBestTraderOffer } from "@/lib/price-calculation/prices";
import { getEmptySale, getEmptyValue } from "@/lib/price-calculation/empty-value";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { FUEL_TANK_ITEM_IDS, GRAPHICS_CARD_ITEM_ID } from "@/lib/cfg/hideout-power";
import type { AcquisitionAlternative, AcquisitionPlan, LockReason } from "@/lib/price-calculation";
import type { ProfitPageData } from "@/types/contracts";
import { acquisitionRouteKey, getAcquisitionRoutes, selectAcquisitionRoute } from "../../profit-pages/utils/recipes";
import type { Station } from "@/types/hideout";
import type { ItemSummary } from "@/types/items";
import { useStationCraftData, useStationRecipeCalculator } from "../details/crafts/useStationCraftEvaluations";
import { useFuelRouteChoices } from "./useFuelRouteChoices";
import { fuelCostPerHour, fuelMultiplier, fuelRuntimeHours, type FuelMultiplier } from "./hideout-power-model";

export interface FuelRoute {
	key: string;
	method: AcquisitionAlternative["method"];
	sourceId?: string;
	traderOffer?: AcquisitionAlternative["traderOffer"];
	/** Locked routes show an estimate (or null) and stay selectable so the tank can still be priced. */
	totalCost: number | null;
	lockReasons?: LockReason[];
}

/** Every priced source for one tank: accessible routes first, then locked ones; one row per route key. */
function fuelRoutes(plan: AcquisitionPlan): FuelRoute[] {
	const routes = getAcquisitionRoutes(plan).map((route): FuelRoute => ({ ...route, key: acquisitionRouteKey(route) }));
	const add = (route: FuelRoute) => {
		if (!routes.some((existing) => existing.key === route.key)) routes.push(route);
	};
	for (const route of plan.lockedAlternatives ?? [])
		add({
			key: acquisitionRouteKey(route),
			method: route.method,
			sourceId: route.sourceId,
			traderOffer: route.traderOffer,
			totalCost: route.estimatedUnitPrice ?? null,
			lockReasons: route.lockReasons,
		});
	// The plan's own reasons are aggregated over its whole recipe tree, so they only fill in a missing row.
	if (plan.method !== "unavailable" && (plan.lockReasons?.length ?? 0) > 0)
		add({ ...plan, method: plan.method, key: acquisitionRouteKey(plan), lockReasons: plan.lockReasons });
	return routes;
}

export interface FuelTank {
	id: string;
	item: ItemSummary | undefined;
	/** Acquisition cost for one tank via the saved route, else the recommended one. Null for a stale saved route. */
	price: number | null;
	/** Unlocked routes cheapest first, then locked ones. */
	routes: FuelRoute[];
	recommendedRouteKey: string | null;
	selectedRouteKey: string | null;
	/** The saved route is no longer available; the user must pick another. */
	routeMissing: boolean;
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
	/** Display names for labelling acquisition routes. */
	routeSources: {
		traders: Record<string, string>;
		stations: Record<string, string>;
		barterTraderIds: Record<string, string>;
		craftStationIds: Record<string, string>;
	};
	hideoutManagementSkillLevel: number;
	stationLevels: Record<string, number>;
}

/**
 * Fuel burn and Bitcoin Farm inputs for the station page: the shared recipe query and
 * calculator price GPUs and fuel tanks (recommended acquisition) and Physical Bitcoin (best trader buyback).
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
	const gameMode = useUserStore((state) => state.gameMode);
	const [routeChoices] = useFuelRouteChoices(gameMode);
	const { calculator, itemsById, overrides, hideoutManagementSkillLevel } = recipe;

	return useMemo(() => {
		const fuel = fuelMultiplier({ stations, stationLevels, hideoutManagementSkillLevel });
		const evaluate = (itemId: string) => (calculator && itemsById[itemId] ? calculator.evaluateNode(itemId, 1) : null);
		const cost = (itemId: string) => evaluate(itemId)?.totalCost ?? null;
		const tanks = FUEL_TANK_ITEM_IDS.map((id): FuelTank => {
			const item = itemsById[id];
			const recommended = evaluate(id);
			const routes = recommended ? fuelRoutes(recommended) : [];
			const recommendedRouteKey = recommended && routes.length ? acquisitionRouteKey(recommended) : null;
			const saved = routeChoices[id];
			// A saved route that is no longer available never silently falls back to another source.
			const routeMissing = saved !== undefined && !routes.some((route) => route.key === saved);
			const plan =
				recommended && saved !== undefined && !routeMissing ? selectAcquisitionRoute(recommended, saved) : recommended;
			const price = routeMissing ? null : (plan?.totalCost ?? null);
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
				routes,
				recommendedRouteKey,
				selectedRouteKey: !routeMissing && plan && routes.length ? acquisitionRouteKey(plan) : null,
				routeMissing,
				emptyValue,
				netPrice,
				units: item?.resourceUnits,
				runtimeHours: item?.resourceUnits ? fuelRuntimeHours(item.resourceUnits, fuel.unitsPerHour) : null,
				costPerHour: fuelCostPerHour(netPrice, item?.resourceUnits, fuel.unitsPerHour),
			};
		});
		const bitcoinItem = itemsById[PHYSICAL_BITCOIN_ITEM_ID];
		const sale = calculator ? getBestTraderOffer(bitcoinItem) : null;
		return {
			pricing: recipe.status,
			unavailableReason: recipe.unavailableReason,
			fuel,
			tanks,
			gpu: { item: itemsById[GRAPHICS_CARD_ITEM_ID], price: cost(GRAPHICS_CARD_ITEM_ID) },
			bitcoin: {
				item: bitcoinItem,
				price: sale?.priceRUB ?? null,
				source: sale?.vendor.name ?? null,
			},
			missingItemIds: data
				? [GRAPHICS_CARD_ITEM_ID, PHYSICAL_BITCOIN_ITEM_ID, ...FUEL_TANK_ITEM_IDS].filter((id) => !itemsById[id])
				: [],
			routeSources: {
				traders: Object.fromEntries((data?.traders ?? []).map((trader) => [trader.id, trader.name])),
				stations: Object.fromEntries((data?.stations ?? []).map((station) => [station.id, station.name])),
				barterTraderIds: Object.fromEntries((data?.barters ?? []).map((barter) => [barter.id, barter.traderId])),
				craftStationIds: Object.fromEntries((data?.crafts ?? []).map((craft) => [craft.id, craft.stationId])),
			},
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
		routeChoices,
		data,
		recipe.status,
		recipe.unavailableReason,
	]);
}
