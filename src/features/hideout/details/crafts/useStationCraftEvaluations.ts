"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { useItemPrices } from "@/features/items/useItemPrices";
import { useManualPriceOverrides } from "@/features/profit-pages/useManualPriceOverrides";
import { useProfitOptions } from "@/features/profit-pages/useProfitOptions";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { createRecipeCalculator, type RecipeEvaluation } from "@/lib/price-calculation";
import { useGameDataEnabled } from "@/lib/query/game-data";
import { pageDataFromQuery, stationRecipeQueryOptions } from "@/lib/query/page-data";
import { useUserStore } from "@/lib/stores/useUserStore";
import type { ProfitPageData } from "@/types/contracts";
import { useStationDetails } from "../StationDetailsContext";
import type { CraftRecord } from "@/types/recipes";

/** Station-scoped unpriced recipe graph; hydrated by StationCraftsStream. */
export function useStationCraftData(mode: TarkovJsonGameMode, fallbackData: ProfitPageData | null) {
	const { station } = useStationDetails();
	const enabled = useGameDataEnabled(mode);
	const query = useQuery({
		...stationRecipeQueryOptions(mode, station.id),
		enabled,
		placeholderData: fallbackData ?? undefined,
	});
	return { query, enabled, data: pageDataFromQuery(query.data, query.error, fallbackData) };
}

export type CraftProfitStatus = "loading" | "ready" | "unavailable";

/**
 * The shared calculator over the station dependency graph, with explicit price IDs,
 * saved skills and manual overrides. Null until both graphs and prices are ready.
 */
export function useStationRecipeCalculator(mode: TarkovJsonGameMode, data: ProfitPageData | null) {
	const priceIds = useMemo(() => data?.itemIds ?? [], [data]);
	const prices = useItemPrices(mode, priceIds);
	const store = useUserStore(
		useShallow((state) => ({
			gameMode: state.gameMode,
			playerLevel: state.playerLevel,
			stationLevels: state.stationLevels,
			completedQuests: state.completedQuests,
			traderLoyaltyLevels: state.questTraderLoyaltyLevels,
		})),
	);
	const { overrides } = useManualPriceOverrides(store.gameMode);
	const options = useProfitOptions(store.gameMode);
	const itemsById = useMemo(
		() =>
			Object.fromEntries(
				(data?.items ?? []).map((item) => [item.id, { ...item, marketPrice: prices.prices[item.id] ?? null }]),
			),
		[data?.items, prices.prices],
	);
	const graphsMissing = !data || !!data.errors.crafts || !!data.errors.barters;
	const status: CraftProfitStatus = graphsMissing ? "unavailable" : prices.state === "pending" ? "loading" : "ready";
	const unavailableReason = graphsMissing
		? "Profit needs both craft and barter data."
		: prices.state === "error"
			? "Some prices could not be loaded."
			: null;
	const pricingPlayerLevel = options.ignorePlayerLevel ? undefined : store.playerLevel;
	const calculator = useMemo(() => {
		if (status !== "ready" || !data) return null;
		return createRecipeCalculator({
			itemsById,
			barters: data.barters,
			crafts: data.crafts,
			overrides,
			craftingSkillLevel: options.craftingSkillLevel,
			hideoutManagementSkillLevel: options.hideoutManagementSkillLevel,
			playerLevel: pricingPlayerLevel,
			stationLevels: store.stationLevels,
			useTraderSaleForLockedOutputs: options.useTraderSaleForLockedOutputs,
			allowCrafts: options.allowCrafts,
			allowBarters: options.allowBarters,
			traderLoyaltyLevels: store.traderLoyaltyLevels,
			completedQuests: store.completedQuests,
		});
	}, [
		status,
		data,
		itemsById,
		overrides,
		options.craftingSkillLevel,
		options.hideoutManagementSkillLevel,
		options.useTraderSaleForLockedOutputs,
		options.allowCrafts,
		options.allowBarters,
		pricingPlayerLevel,
		store.stationLevels,
		store.traderLoyaltyLevels,
		store.completedQuests,
	]);
	const saleContext = useMemo(
		() => ({ playerLevel: pricingPlayerLevel, useTraderSaleForLockedOutputs: options.useTraderSaleForLockedOutputs }),
		[pricingPlayerLevel, options.useTraderSaleForLockedOutputs],
	);
	return {
		calculator,
		itemsById,
		status,
		unavailableReason,
		overrides,
		saleContext,
		hideoutManagementSkillLevel: options.hideoutManagementSkillLevel,
	};
}

/** Profit for the given crafts; profit requires both recipe graphs. */
export function useStationCraftEvaluations(
	mode: TarkovJsonGameMode,
	data: ProfitPageData | null,
	crafts: readonly CraftRecord[],
) {
	const { calculator, itemsById, status, unavailableReason } = useStationRecipeCalculator(mode, data);
	const evaluationsById = useMemo(
		(): Record<string, RecipeEvaluation> =>
			calculator
				? Object.fromEntries(calculator.evaluateCrafts(crafts).map((evaluation) => [evaluation.id, evaluation]))
				: {},
		[calculator, crafts],
	);
	return { evaluationsById, itemsById, status, unavailableReason };
}
