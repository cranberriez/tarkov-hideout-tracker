"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useShallow } from "zustand/react/shallow";
import { createRecipeCalculator, type RecipeEvaluation, type RecipeCalculatorInput } from "@/lib/price-calculation";
import { toTarkovJsonGameMode } from "@/lib/game-mode";
import { isPriceItemId } from "@/lib/query/price-contract";
import { profitRecipeHref } from "@/lib/entity-routes";
import { useUIStore, type RecipeBreakdownTarget } from "@/lib/stores/useUIStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { useManualPriceOverrides } from "@/features/profit-pages/useManualPriceOverrides";
import { useProfitOptions } from "@/features/profit-pages/useProfitOptions";
import { withRequiredItemRoute } from "@/features/profit-pages/utils/recipes";
import type { ProfitStationSource, RouteContext } from "@/features/profit-pages/types";
import type { ItemSummary } from "@/types/items";
import type { Trader } from "@/types/traders";
import { useItemPrices } from "../useItemPrices";
import { itemAcquisitionQueryOptions } from "./item-detail-queries";

function evaluate(input: RecipeCalculatorInput, target: RecipeBreakdownTarget): RecipeEvaluation | undefined {
	const calculator = createRecipeCalculator(input);
	if (target.kind === "barter") {
		const barter = input.barters.find((record) => record.id === target.recipeId);
		return barter ? calculator.evaluateBarters([barter])[0] : undefined;
	}
	const craft = input.crafts.find((record) => record.id === target.recipeId);
	return craft ? calculator.evaluateCrafts([craft])[0] : undefined;
}

/**
 * One recipe's profit breakdown. Evaluates against the output item's acquisition graph (already
 * cached when the recipe produces the item being viewed) with the profit pages' options, so the
 * figures match the profit table.
 */
export function useRecipeBreakdownController(target: RecipeBreakdownTarget) {
	const user = useUserStore(
		useShallow((state) => ({
			gameMode: state.gameMode,
			playerLevel: state.playerLevel,
			stationLevels: state.stationLevels,
			completedQuests: state.completedQuests,
			traderLoyaltyLevels: state.questTraderLoyaltyLevels,
		})),
	);
	const mode = toTarkovJsonGameMode(user.gameMode);
	const { overrides, setItemOverride } = useManualPriceOverrides(user.gameMode);
	const {
		craftingSkillLevel,
		hideoutManagementSkillLevel,
		useTraderSaleForLockedOutputs,
		allowCrafts,
		allowBarters,
		ignorePlayerLevel,
	} = useProfitOptions(user.gameMode);
	const pricingPlayerLevel = ignorePlayerLevel ? undefined : user.playerLevel;
	const treeQuery = useQuery(itemAcquisitionQueryOptions(mode, target.outputItem.id, { withPrices: true }));
	const tree = treeQuery.data;
	const priceIds = useMemo(() => (tree ? tree.items.map((item) => item.id).filter(isPriceItemId) : []), [tree]);
	const prices = useItemPrices(mode, priceIds);
	const pricesReady = Boolean(tree) && Object.values(prices.states).every((state) => state === "ready");
	const itemById = useMemo(
		() =>
			Object.fromEntries(
				(tree?.items ?? []).map((item): [string, ItemSummary] => [
					item.id,
					{ ...item, marketPrice: prices.prices[item.id] ?? null },
				]),
			),
		[tree, prices.prices],
	);
	const calculatorInput = useMemo<RecipeCalculatorInput | null>(
		() =>
			tree && pricesReady
				? {
						itemsById: itemById,
						barters: tree.barters,
						crafts: tree.crafts,
						craftingSkillLevel,
						hideoutManagementSkillLevel,
						playerLevel: pricingPlayerLevel,
						stationLevels: user.stationLevels,
						useTraderSaleForLockedOutputs,
						allowCrafts,
						allowBarters,
						traderLoyaltyLevels: user.traderLoyaltyLevels,
						completedQuests: user.completedQuests,
					}
				: null,
		[
			tree,
			pricesReady,
			itemById,
			craftingSkillLevel,
			hideoutManagementSkillLevel,
			pricingPlayerLevel,
			user.stationLevels,
			useTraderSaleForLockedOutputs,
			allowCrafts,
			allowBarters,
			user.traderLoyaltyLevels,
			user.completedQuests,
		],
	);
	const baseEvaluation = useMemo(
		() => (calculatorInput ? evaluate({ ...calculatorInput, overrides }, target) : undefined),
		[calculatorInput, overrides, target],
	);
	// Without manual prices, so customized figures can show what they replaced (as on the profit pages).
	const baselineEvaluation = useMemo(
		() => (calculatorInput && Object.keys(overrides).length > 0 ? evaluate(calculatorInput, target) : undefined),
		[calculatorInput, overrides, target],
	);
	// Route choices are local to this view, like the profit table's per-row selections.
	const [routeSelections, setRouteSelections] = useState<Record<number, string>>({});
	const applyRoutes = (evaluation: RecipeEvaluation | undefined) =>
		evaluation &&
		Object.entries(routeSelections).reduce(
			(current, [index, routeKey]) => withRequiredItemRoute(current, Number(index), routeKey),
			evaluation,
		);
	const evaluation = applyRoutes(baseEvaluation);
	const originalEvaluation = applyRoutes(baselineEvaluation);

	const routeContext = useMemo<RouteContext>(
		() => ({
			itemById,
			bartersById: Object.fromEntries((tree?.barters ?? []).map((barter) => [barter.id, barter])),
			craftsById: Object.fromEntries((tree?.crafts ?? []).map((craft) => [craft.id, craft])),
			tradersById: (tree?.tradersById ?? {}) as Record<string, Trader>,
			stationsById: (tree?.stationsById ?? {}) as Record<string, ProfitStationSource>,
		}),
		[itemById, tree],
	);
	const pricingContext = useMemo(
		() => ({
			playerLevel: pricingPlayerLevel,
			useTraderSaleForLockedOutputs,
			stationLevels: user.stationLevels,
			hideoutManagementSkillLevel,
			traderLoyaltyLevels: user.traderLoyaltyLevels,
			taskUnlocksById: tree?.taskUnlocksById ?? {},
			lockChipNames: {
				station: (id: string) => tree?.stationsById?.[id]?.name,
				trader: (id: string) => tree?.tradersById?.[id]?.name,
			},
		}),
		[
			pricingPlayerLevel,
			useTraderSaleForLockedOutputs,
			user.stationLevels,
			hideoutManagementSkillLevel,
			user.traderLoyaltyLevels,
			tree,
		],
	);
	const recipe =
		target.kind === "barter" ? routeContext.bartersById[target.recipeId] : routeContext.craftsById[target.recipeId];
	const source =
		target.kind === "barter"
			? routeContext.tradersById[routeContext.bartersById[target.recipeId]?.traderId ?? ""]
			: routeContext.stationsById[routeContext.craftsById[target.recipeId]?.stationId ?? ""];

	const loading = treeQuery.isPending || (Boolean(tree) && prices.state === "pending");
	const error = treeQuery.isError
		? "Recipe data is temporarily unavailable."
		: prices.state === "error"
			? "Item prices could not be updated. Reload the page to try again."
			: tree && !recipe
				? "This recipe is no longer available."
				: null;

	return {
		loading,
		error,
		retry: () => void treeQuery.refetch(),
		warning: tree?.presentationError ?? null,
		evaluation,
		originalEvaluation,
		output: itemById[target.outputItem.id] ?? target.outputItem,
		source,
		routeContext,
		pricingContext,
		overrides,
		onPriceChange: setItemOverride,
		/** Before local route choices, so ingredient rows can mark a switched route. */
		baseEvaluation,
		onRouteChange: (index: number, routeKey: string) =>
			setRouteSelections((current) => ({ ...current, [index]: routeKey })),
		profitHref: profitRecipeHref(target.kind, target.recipeId),
		/** Nested recipes in the chain open their own breakdown, pushing dialog history. */
		goToRecipe(kind: "barter" | "craft", recipeId: string) {
			const outputItemId =
				kind === "barter"
					? routeContext.bartersById[recipeId]?.offeredItemId
					: routeContext.craftsById[recipeId]?.productItemId;
			const outputItem = outputItemId ? itemById[outputItemId] : undefined;
			if (outputItem) useUIStore.getState().openRecipeBreakdown({ kind, recipeId, outputItem });
		},
	};
}
