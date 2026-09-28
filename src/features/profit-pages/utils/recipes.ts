import type {
	LockReason,
	AcquisitionAlternative,
	AcquisitionPlan,
	LockedAcquisitionAlternative,
	ManualPriceOverrides,
	RecipeEvaluation,
} from "@/lib/price-calculation";
import { craftRequiredItems } from "../../../lib/price-calculation/craft-rules";
import { getItemBuyPrice, practicalSavingsThreshold } from "../../../lib/price-calculation/prices";
import type { ItemSummary } from "@/types/items";
import type { ItemAmountRef } from "@/types/recipes";
import type { ProfitLockFilters, RecipePreviewData, RouteContext, SortDirection, SortKey } from "../types";
import { formatDuration } from "./formatters";
import { unpricedIngredientIds } from "./lock-summary";

export function getRecipeSourceId(evaluation: RecipeEvaluation) {
	return evaluation.barter?.traderId ?? evaluation.craft?.stationId ?? "";
}

/**
 * Collapsed row height for the window virtualizer. Compact cards (below 1024px)
 * pin every block to a fixed height in ProfitTable.module.css, RecipeItem,
 * RecipeRequirements and MetricList, so this matches the rendered card exactly;
 * keep them in sync or scrolling jumps as rows are measured.
 */
export function estimateProfitRowHeight(evaluation?: RecipeEvaluation, compact = false) {
	if (!compact) {
		if (!evaluation) return 88;
		return Math.max(88, evaluation.requiredItems.length * 40 + 8) + 1;
	}
	// Row gap 12 + card border 2 + recipe (8 + output 52 + 4 + requirements 36 + 6).
	const recipe = 12 + 2 + 106;
	// Top border 1 + vertical padding 16 + 48 per ingredient line.
	const ingredients = 17 + (evaluation?.requiredItems.length ?? 0) * 48;
	const values = evaluation
		? [evaluation.cost, evaluation.sellValue, evaluation.profit, evaluation.profitPerHour].filter(
				(value) => value !== null,
			).length
		: 4;
	const warning = evaluation && unpricedIngredientIds(evaluation).length > 0 ? 1 : 0;
	const children = values + warning;
	// Top border 1 + padding 4, warning 24, rows 32 (last 40), 1px dividers between children.
	const metrics = 5 + warning * 24 + (values ? (values - 1) * 32 + 40 : 0) + Math.max(0, children - 1);
	return recipe + ingredients + metrics;
}

export function isRecipeAvailable(
	evaluation: RecipeEvaluation,
	stationLevels: Record<string, number>,
	traderLevels: Record<string, number>,
	completedQuests: Record<string, boolean>,
) {
	if (evaluation.barter) {
		return (
			(traderLevels[evaluation.barter.traderId] ?? 1) >= evaluation.barter.minTraderLevel &&
			(!evaluation.barter.taskUnlockId || completedQuests[evaluation.barter.taskUnlockId] === true)
		);
	}
	if (evaluation.craft) {
		return (
			(stationLevels[evaluation.craft.stationId] ?? 0) >= evaluation.craft.level &&
			(!evaluation.craft.taskUnlockId || completedQuests[evaluation.craft.taskUnlockId] === true)
		);
	}
	return false;
}

export function passesLockFilters(evaluation: RecipeEvaluation, availableOnly: boolean, filters: ProfitLockFilters) {
	const inputReasons = (plan: AcquisitionPlan): LockReason[] => [
		...(plan.method === "unavailable"
			? plan.lockReasons?.length
				? plan.lockReasons
				: [{ kind: "unavailable" as const, message: "No acquisition route available" }]
			: []),
		...plan.children.flatMap(inputReasons),
	];
	const reasons = [...(evaluation.lockReasons ?? []), ...(evaluation.outputLockReasons ?? [])];
	const ingredientReasons = evaluation.requiredItems.flatMap(inputReasons);
	if (availableOnly) return reasons.length === 0 && ingredientReasons.length === 0;
	return (
		!reasons.some((reason) => reason.kind !== "unavailable" && filters[reason.kind]) &&
		!ingredientReasons.some((reason) => reason.kind !== "unavailable" && reason.kind !== "flea" && filters[reason.kind])
	);
}

export function compareEvaluations(
	left: RecipeEvaluation,
	right: RecipeEvaluation,
	sortKey: SortKey,
	sortDirection: SortDirection,
	itemsById: Readonly<Record<string, ItemSummary>>,
) {
	const leftValue =
		sortKey === "cost"
			? left.cost
			: sortKey === "sellValue"
				? left.sellValue
				: sortKey === "profitPerHour"
					? left.profitPerHour
					: left.profit;
	const rightValue =
		sortKey === "cost"
			? right.cost
			: sortKey === "sellValue"
				? right.sellValue
				: sortKey === "profitPerHour"
					? right.profitPerHour
					: right.profit;
	if (leftValue === null && rightValue !== null) return 1;
	if (leftValue !== null && rightValue === null) return -1;
	if (leftValue !== null && rightValue !== null && leftValue !== rightValue) {
		return sortDirection === "ascending" ? leftValue - rightValue : rightValue - leftValue;
	}
	const nameComparison = (itemsById[left.outputItemId]?.name ?? left.outputItemId).localeCompare(
		itemsById[right.outputItemId]?.name ?? right.outputItemId,
	);
	return nameComparison || left.id.localeCompare(right.id);
}

export function compareEvaluationsByBaseline(
	left: RecipeEvaluation,
	right: RecipeEvaluation,
	sortKey: SortKey,
	sortDirection: SortDirection,
	itemsById: Readonly<Record<string, ItemSummary>>,
	baselineById: Readonly<Record<string, RecipeEvaluation>>,
) {
	return compareEvaluations(
		baselineById[left.id] ?? left,
		baselineById[right.id] ?? right,
		sortKey,
		sortDirection,
		itemsById,
	);
}

export function hasRecipeRoute(plan: AcquisitionPlan): boolean {
	return plan.method === "barter" || plan.method === "craft" || plan.children.some(hasRecipeRoute);
}

function planCandidate(plan: AcquisitionPlan): AcquisitionAlternative | null {
	if (plan.method === "unavailable" || plan.totalCost === null || (plan.lockReasons?.length ?? 0) > 0) return null;
	return {
		method: plan.method,
		sourceId: plan.sourceId,
		traderOffer: plan.traderOffer,
		batches: plan.batches,
		totalCost: plan.totalCost,
		theoreticalCost: plan.selectedRouteTheoreticalCost ?? plan.totalCost,
		durationSeconds: plan.durationSeconds,
		children: plan.children,
	};
}

export function acquisitionRouteKey(route: { method: string; sourceId?: string }) {
	return `${route.method}:${route.sourceId ?? "direct"}`;
}

export function getAcquisitionRoutes(plan: AcquisitionPlan) {
	const current = planCandidate(plan);
	return [...(current ? [current] : []), ...plan.alternatives].sort((left, right) => left.totalCost - right.totalCost);
}

/** Only flag a fallback when a priced locked source would beat this route. */
export function hasCheaperLockedRoute(plan: AcquisitionPlan): boolean {
	if (plan.method === "unavailable" || plan.totalCost === null || plan.quantity <= 0) return false;
	const currentCost = plan.totalCost;
	const direct = plan.method === "flea" || plan.method === "trader";
	return (plan.lockedAlternatives ?? []).some((route) => {
		const estimate = route.estimatedUnitPrice;
		if (estimate === undefined || !Number.isFinite(estimate) || estimate < 0) return false;
		const threshold =
			direct && (route.method === "craft" || route.method === "barter") ? practicalSavingsThreshold(currentCost) : 0;
		return currentCost - estimate * plan.quantity > threshold;
	});
}

export function selectAcquisitionRoute(plan: AcquisitionPlan, routeKey: string): AcquisitionPlan {
	const candidates = getAcquisitionRoutes(plan);
	const selected = candidates.find((candidate) => acquisitionRouteKey(candidate) === routeKey);
	const selectedLocked = (plan.lockedAlternatives ?? []).find(
		(candidate) => acquisitionRouteKey(candidate) === routeKey,
	);
	if ((!selected && !selectedLocked) || acquisitionRouteKey(plan) === routeKey) return plan;
	if (selectedLocked) return selectLockedAcquisitionRoute(plan, selectedLocked, candidates);
	if (!selected) return plan;
	const direct = candidates
		.filter((candidate) => candidate.method === "flea" || candidate.method === "trader")
		.sort((left, right) => left.totalCost - right.totalCost)[0];
	return {
		...plan,
		lockReasons: undefined,
		method: selected.method,
		sourceId: selected.sourceId,
		traderOffer: selected.traderOffer,
		batches: selected.batches,
		totalCost: selected.totalCost,
		selectedRouteTheoreticalCost: selected.theoreticalCost,
		durationSeconds: selected.durationSeconds,
		children: selected.children,
		directBuyCost: direct?.totalCost ?? null,
		directBuyMethod: direct?.method === "flea" || direct?.method === "trader" ? direct.method : null,
		alternatives: candidates.filter((candidate) => acquisitionRouteKey(candidate) !== routeKey),
	};
}

function selectLockedAcquisitionRoute(
	plan: AcquisitionPlan,
	selected: LockedAcquisitionAlternative,
	accessibleRoutes: AcquisitionAlternative[],
): AcquisitionPlan {
	const totalCost = selected.estimatedUnitPrice === undefined ? null : selected.estimatedUnitPrice * plan.quantity;
	return {
		...plan,
		method: selected.method,
		sourceId: selected.sourceId,
		traderOffer: selected.traderOffer,
		lockReasons: selected.lockReasons,
		batches: selected.batches ?? (selected.method === "craft" || selected.method === "barter" ? 0 : 1),
		totalCost,
		selectedRouteTheoreticalCost: totalCost ?? undefined,
		durationSeconds: selected.durationSeconds ?? 0,
		children: selected.children ?? [],
		alternatives: accessibleRoutes,
	};
}

export function withRequiredItemRoute(
	evaluation: RecipeEvaluation,
	requirementIndex: number,
	routeKey: string,
): RecipeEvaluation {
	const requiredItems = evaluation.requiredItems.map((plan, index) =>
		index === requirementIndex ? selectAcquisitionRoute(plan, routeKey) : plan,
	);
	let cost = 0;
	for (const plan of requiredItems) {
		if (plan.isTool) continue;
		if (plan.totalCost === null) {
			cost = Number.NaN;
			break;
		}
		cost += plan.totalCost;
	}
	const resolvedCost = Number.isNaN(cost) ? null : cost;
	const profit = resolvedCost === null || evaluation.sellValue === null ? null : evaluation.sellValue - resolvedCost;
	const durationSeconds =
		(evaluation.kind === "craft" ? (evaluation.craft?.duration ?? 0) : 0) +
		requiredItems.reduce((total, plan) => total + (plan.isTool ? 0 : plan.durationSeconds), 0);
	const profitPerHour = profit === null || durationSeconds <= 0 ? null : profit / (durationSeconds / 3_600);
	const savings =
		evaluation.directBuyCost === null || resolvedCost === null ? null : evaluation.directBuyCost - resolvedCost;
	return {
		...evaluation,
		requiredItems,
		cost: resolvedCost,
		profit,
		durationSeconds,
		profitPerHour,
		isPracticallyWorthwhile:
			savings === null || evaluation.directBuyCost === null
				? null
				: savings > practicalSavingsThreshold(evaluation.directBuyCost),
	};
}

export interface RecipePreviewEstimateOptions {
	overrides?: ManualPriceOverrides;
	hideoutManagementSkillLevel?: number;
}

/**
 * Ingredient rows priced as if every direct purchase were available. Locked
 * recipes rejected before pricing (nested locks, unobtainable ingredients or
 * tools) carry no children, but the preview should still show what they need.
 */
function estimatedRecipeRequirements(
	requirements: readonly ItemAmountRef[],
	batches: number,
	context: RouteContext,
	overrides: ManualPriceOverrides = {},
): AcquisitionPlan[] {
	return requirements.map((requirement) => {
		const quantity = requirement.count * batches;
		const unitPrice = getItemBuyPrice(context.itemById[requirement.itemId], overrides);
		const totalCost = unitPrice === null ? null : unitPrice * quantity;
		const method = unitPrice === null ? "unavailable" : "flea";
		return {
			itemId: requirement.itemId,
			quantity,
			...(requirement.isTool ? { isTool: true } : {}),
			method,
			batches: 1,
			totalCost,
			theoreticalCost: totalCost,
			theoreticalMethod: method,
			directBuyCost: totalCost,
			directBuyMethod: unitPrice === null ? null : "flea",
			durationSeconds: 0,
			children: [],
			alternatives: [],
		};
	});
}

export function getPlanRecipePreview(
	plan: AcquisitionPlan | undefined,
	context: RouteContext,
	estimate: RecipePreviewEstimateOptions = {},
): RecipePreviewData | undefined {
	if (!plan?.sourceId || (plan.method !== "barter" && plan.method !== "craft")) return undefined;
	const batchesFor = (outputCount: number) =>
		plan.batches > 0 ? plan.batches : Math.max(1, Math.ceil(plan.quantity / Math.max(1, outputCount)));
	if (plan.method === "barter") {
		const barter = context.bartersById[plan.sourceId];
		if (!barter) return undefined;
		const batches = batchesFor(barter.offeredCount);
		return {
			kind: "barter",
			sourceId: barter.id,
			outputItemId: barter.offeredItemId,
			outputCount: barter.offeredCount,
			batches,
			requiredItems: plan.children.length
				? plan.children
				: estimatedRecipeRequirements(barter.requiredItems, batches, context, estimate.overrides),
			durationSeconds: plan.durationSeconds,
		};
	}
	const craft = context.craftsById[plan.sourceId];
	if (!craft) return undefined;
	const batches = batchesFor(craft.productCount);
	return {
		kind: "craft",
		sourceId: craft.id,
		outputItemId: craft.productItemId,
		outputCount: craft.productCount,
		batches,
		requiredItems: plan.children.length
			? plan.children
			: estimatedRecipeRequirements(
					craftRequiredItems(craft, estimate.hideoutManagementSkillLevel),
					batches,
					context,
					estimate.overrides,
				),
		durationSeconds: craft.duration,
	};
}

export function describeRoute(plan: AcquisitionPlan, context: RouteContext) {
	if (plan.isTool)
		return `Reusable tool acquired via ${plan.method}; its value is not included in recurring craft cost.`;
	if (plan.method === "flea")
		return "Buy from the flea market using a minimum estimate, catalog estimate, or manual buy price.";
	if (plan.method === "sell")
		return "Use the item's sale value as its opportunity cost because no priced acquisition route is available.";
	if (plan.method === "trader" && plan.traderOffer) {
		const offer = plan.traderOffer;
		const trader = context.tradersById[offer.traderId];
		const nativePrice = `${offer.price.toLocaleString()} ${offer.currency}`;
		return `Buy from ${trader?.name ?? "unknown trader"} at LL${offer.minTraderLevel} · ${nativePrice} (${Math.round(offer.priceRUB).toLocaleString()} ₽)${offer.taskUnlockId ? " · quest unlock required" : ""}${offer.buyLimit != null ? ` · limit ${offer.buyLimit}` : ""}.`;
	}
	if (plan.method === "barter" && plan.sourceId) {
		const barter = context.bartersById[plan.sourceId];
		const trader = barter ? context.tradersById[barter.traderId] : undefined;
		if (barter)
			return `Barter with ${trader?.name ?? "unknown trader"} at LL${barter.minTraderLevel} · ${plan.batches} batch${plan.batches === 1 ? "" : "es"}${barter.buyLimit ? ` · limit ${barter.buyLimit}` : ""}.`;
	}
	if (plan.method === "craft" && plan.sourceId) {
		const craft = context.craftsById[plan.sourceId];
		const station = craft ? context.stationsById[craft.stationId] : undefined;
		if (craft) {
			const allocatedCraftTime = craft.duration * (plan.quantity / craft.productCount);
			return `Craft at ${station?.name ?? "unknown station"} level ${craft.level} · ${plan.batches} batch${plan.batches === 1 ? "" : "es"} · ${formatDuration(allocatedCraftTime)} allocated craft time.`;
		}
	}
	return "No complete priced acquisition route is currently available.";
}

export function describeChainRoute(plan: AcquisitionPlan, context: RouteContext) {
	if (plan.method === "flea") return "Flea market";
	if (plan.method === "sell") return "Sell value";
	if (plan.method === "trader" && plan.traderOffer) {
		return `Trader LL${plan.traderOffer.minTraderLevel}`;
	}
	if (plan.method === "unavailable") return "No priced route";
	if (plan.method === "barter" && plan.sourceId) {
		const barter = context.bartersById[plan.sourceId];
		return `Barter LL${barter?.minTraderLevel ?? "?"}${plan.batches > 1 ? ` · ${plan.batches} batches` : ""}`;
	}
	if (plan.method === "craft" && plan.sourceId) {
		const craft = context.craftsById[plan.sourceId];
		return `Craft level ${craft?.level ?? "?"}${plan.batches > 1 ? ` · ${plan.batches} batches` : ""}`;
	}
	return "Acquisition route";
}
