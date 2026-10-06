"use client";

import Link from "next/link";
import { ArrowUpRight, RefreshCw, Wrench, X } from "lucide-react";
import { DialogTitle } from "@/components/ui/dialog";
import type { RecipeBreakdownTarget } from "@/lib/stores/useUIStore";
import { ProfitPricingContext } from "@/features/profit-pages/components/ProfitPricingContext";
import { MetricList, useSellSourceNote } from "@/features/profit-pages/components/ProfitCells";
import { RecipeChainBranch } from "@/features/profit-pages/components/RecipeChain";
import { RecipeItem } from "@/features/profit-pages/components/RecipeItem";
import { RecipeRequirements } from "@/features/profit-pages/components/RecipeRequirements";
import { formatDuration } from "@/features/profit-pages/utils/formatters";
import { acquisitionRouteKey } from "@/features/profit-pages/utils/recipes";
import { ingredientLockReasons, unpricedIngredientIds } from "@/features/profit-pages/utils/lock-summary";
import type { RecipeEvaluation } from "@/lib/price-calculation";
import { ITEM_DETAIL_LOADING_CLASS, ItemDetailLoading } from "./ItemDetailLoading";
import { BACK_PANEL_HEIGHT_CLASS, ItemDetailBackButton, PANEL_HEIGHT_CLASS } from "./ItemDetailBackButton";
import type { ItemDetailEntry } from "./item-detail-navigation";
import { useRecipeBreakdownController } from "./useRecipeBreakdownController";
import styles from "./RecipeBreakdownModal.module.css";

export interface RecipeBreakdownModalProps {
	recipe: RecipeBreakdownTarget;
	previousEntry: ItemDetailEntry | null;
	onBack: () => void;
	onClose: () => void;
}

/** Item-dialog view of one recipe's profit: replaces the item view; Back returns to it. */
export function RecipeBreakdownContent({ recipe, previousEntry, onBack, onClose }: RecipeBreakdownModalProps) {
	const vm = useRecipeBreakdownController(recipe);
	const kindLabel = recipe.kind === "barter" ? "Barter" : "Craft";
	const KindIcon = recipe.kind === "barter" ? RefreshCw : Wrench;

	return (
		// Same card as the dialog's Suspense fallback while loading, then widens into the full panel (as the item view does).
		<div
			aria-busy={vm.loading}
			className={
				vm.loading
					? ITEM_DETAIL_LOADING_CLASS
					: `${styles.panel} pointer-events-auto relative mx-auto w-full max-w-full lg:max-w-3xl`
			}
		>
			<DialogTitle className="sr-only">{`${kindLabel} breakdown: ${vm.output.name}`}</DialogTitle>
			{vm.loading ? (
				<ItemDetailLoading item={vm.output} onClose={onClose} label={`Loading ${kindLabel.toLowerCase()} breakdown…`} />
			) : (
				<>
					{previousEntry && <ItemDetailBackButton previousEntry={previousEntry} onBack={onBack} />}
					<div
						className={`flex w-full flex-col bg-background lg:min-h-0 lg:overflow-hidden lg:rounded-lg lg:border lg:border-border-color lg:shadow-2xl ${previousEntry ? BACK_PANEL_HEIGHT_CLASS : PANEL_HEIGHT_CLASS}`}
					>
						<header className="flex shrink-0 items-center gap-3 border-b border-border-color bg-gradient-to-br from-card via-card to-background px-3 py-2.5 sm:px-4">
							<div className="flex min-w-0 items-center gap-2.5">
								<span
									className={`flex size-10 shrink-0 items-center justify-center rounded-md ${recipe.kind === "barter" ? "bg-acquisition-barter/10 text-acquisition-barter" : "bg-acquisition-craft/10 text-acquisition-craft"}`}
								>
									<KindIcon size={22} aria-hidden="true" />
								</span>
								<p className="text-xs font-semibold uppercase tracking-wider text-foreground">{kindLabel} breakdown</p>
							</div>
							<div className="ml-auto flex items-center gap-3">
								<Link
									href={vm.profitHref}
									className="inline-flex items-center gap-0.5 rounded-xs text-[11px] font-medium text-muted-foreground transition-colors hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
								>
									Profit page
									<ArrowUpRight size={13} aria-hidden="true" className="shrink-0" />
								</Link>
								<button
									type="button"
									onClick={onClose}
									className="flex h-8 w-8 items-center justify-center rounded-full border border-transparent text-muted-foreground transition-colors hover:border-border-color hover:bg-shadow/20 hover:text-foreground"
									aria-label="Close item details"
								>
									<X size={18} />
								</button>
							</div>
						</header>

						<div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
							{vm.error || !vm.evaluation ? (
								<div className="flex flex-wrap items-center gap-3 px-4 py-6 text-sm text-warning">
									{vm.error ?? "Profit data is unavailable for this recipe."}
									<button
										type="button"
										onClick={vm.retry}
										className="rounded border border-warning/30 px-2 py-1 text-xs hover:bg-warning/10"
									>
										Try again
									</button>
								</div>
							) : (
								<ProfitPricingContext.Provider value={vm.pricingContext}>
									<Breakdown vm={vm} evaluation={vm.evaluation} />
								</ProfitPricingContext.Provider>
							)}
						</div>
					</div>
				</>
			)}
		</div>
	);
}

function Breakdown({
	vm,
	evaluation,
}: {
	vm: ReturnType<typeof useRecipeBreakdownController>;
	evaluation: RecipeEvaluation;
}) {
	const { routeContext, overrides, originalEvaluation } = vm;
	const sellSourceNote = useSellSourceNote(vm.output, evaluation.outputCount, evaluation.sellSourceLabel, overrides);
	const unpricedNames = unpricedIngredientIds(evaluation).map(
		(itemId) => routeContext.itemById[itemId]?.shortName ?? routeContext.itemById[itemId]?.name ?? itemId,
	);
	const sourceName = vm.source?.name;

	return (
		<>
			{vm.warning && <p className="border-b border-border-color px-4 py-2 text-xs text-warning">{vm.warning}</p>}
			<section className="grid gap-4 border-b border-border-color px-3 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(200px,240px)] sm:px-4">
				<div className="min-w-0">
					<RecipeItem
						item={vm.output}
						count={evaluation.outputCount}
						method={evaluation.kind}
						totalPrice={evaluation.grossSellValue === undefined ? evaluation.sellValue : evaluation.grossSellValue}
						priceKind="sell"
						sellValueIsEstimate={evaluation.sellValueIsEstimate ?? false}
						showRouteIcon={false}
						overrides={overrides}
						onPriceChange={vm.onPriceChange}
						routeContext={routeContext}
						detail={
							evaluation.barter
								? `Barter with ${sourceName ?? "unknown trader"} at LL${evaluation.barter.minTraderLevel}`
								: `Craft at ${sourceName ?? "unknown station"} level ${evaluation.craft?.level ?? "?"} · ${formatDuration(evaluation.craft?.duration ?? 0)}`
						}
					/>
					<RecipeRequirements evaluation={evaluation} source={vm.source} itemById={routeContext.itemById} />
				</div>
				<MetricList
					warning={unpricedNames.length ? `No price: ${unpricedNames.join(", ")}` : undefined}
					rows={[
						{ label: "Cost", value: evaluation.cost, originalValue: originalEvaluation?.cost },
						{ label: "Sale proceeds", note: sellSourceNote, value: evaluation.sellValue },
						{
							label: "Profit",
							note: evaluation.durationSeconds > 0 ? formatDuration(evaluation.durationSeconds) : undefined,
							value: evaluation.profit,
							signed: true,
							originalValue: originalEvaluation?.profit,
						},
						...(evaluation.kind === "craft"
							? [
									{
										label: "Profit / hour",
										value: evaluation.profitPerHour,
										signed: true,
										originalValue: originalEvaluation?.profitPerHour,
									},
								]
							: []),
					]}
				/>
			</section>

			<section className="px-3 py-3 sm:px-4">
				<h3 className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Ingredients</h3>
				<div className="@container/ingredients">
					{evaluation.requiredItems.map((plan, index) => (
						<div key={`${plan.itemId}:${plan.isTool === true}`}>
							<RecipeItem
								item={routeContext.itemById[plan.itemId]}
								count={plan.quantity}
								method={plan.method}
								totalPrice={plan.totalCost}
								plan={plan}
								lockReasons={ingredientLockReasons(plan)}
								priceKind="buy"
								overrides={overrides}
								onPriceChange={vm.onPriceChange}
								routeContext={routeContext}
								compactLine
								onGoToRecipe={vm.goToRecipe}
								onRouteChange={(routeKey) => vm.onRouteChange(index, routeKey)}
								baseRouteKey={
									vm.baseEvaluation?.requiredItems[index]
										? acquisitionRouteKey(vm.baseEvaluation.requiredItems[index])
										: undefined
								}
								recipeCost={evaluation.cost}
							/>
							{/* Below lg the ingredient row expands its own chain on tap, as on the profit pages. */}
							{(plan.method === "barter" || plan.method === "craft") && (
								<div className="max-lg:hidden">
									<RecipeChainBranch plan={plan} routeContext={routeContext} onGoToRecipe={vm.goToRecipe} />
								</div>
							)}
						</div>
					))}
				</div>
			</section>
		</>
	);
}
