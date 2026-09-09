"use client";

import { useMemo, useState } from "react";
import { ChevronRight, Pin } from "lucide-react";
import type { ManualPriceOverride, RecipeEvaluation } from "@/lib/price-calculation";
import type { BarterRecord, CraftRecord } from "@/types/recipes";
import type { ItemSummary } from "@/types/items";
import type { ProfitStationSource } from "../types";
import type { Trader } from "@/types/traders";
import type { GoToRecipeHandler, PriceChangeHandler, RouteContext, SortKey } from "../types";
import { formatDuration, formatRoundedRoubles, formatSignedRoubles } from "../utils/formatters";
import { acquisitionRouteKey, hasRecipeRoute, withRequiredItemRoute } from "../utils/recipes";
import styles from "./ProfitTable.module.css";
import { ProfitCell, SellValueCell } from "./ProfitCells";
import { ProfitSourceCell } from "./ProfitSourceCell";
import { RecipeChain } from "./RecipeChain";
import { RecipeItem } from "./RecipeItem";

export function ProfitRow({
	evaluation: baseEvaluation,
	baselineEvaluation,
	itemById,
	sourceName,
	available,
	source,
	overrides,
	onPriceChange,
	bartersById,
	craftsById,
	tradersById,
	stationsById,
	onItemOpen,
	onGoToRecipe,
	highlighted,
	pinned,
	onTogglePinned,
	routeSelections,
	onRouteChange,
	sortKey,
}: {
	sortKey: SortKey;
	evaluation: RecipeEvaluation;
	baselineEvaluation?: RecipeEvaluation;
	itemById: Readonly<Record<string, ItemSummary>>;
	sourceName?: string;
	available: boolean;
	source?: Trader | ProfitStationSource;
	overrides: Record<string, ManualPriceOverride>;
	onPriceChange: PriceChangeHandler;
	bartersById: Readonly<Record<string, BarterRecord>>;
	craftsById: Readonly<Record<string, CraftRecord>>;
	tradersById: Readonly<Record<string, Trader>>;
	stationsById: Readonly<Record<string, ProfitStationSource>>;
	onItemOpen: (itemId: string) => void;
	onGoToRecipe: GoToRecipeHandler;
	highlighted: boolean;
	pinned: boolean;
	onTogglePinned?: () => void;
	routeSelections: Record<number, string>;
	onRouteChange: (requirementIndex: number, routeKey: string) => void;
}) {
	const [expanded, setExpanded] = useState(false);
	const evaluation = useMemo(
		() => Object.entries(routeSelections).reduce((current, [index, routeKey]) => withRequiredItemRoute(current, Number(index), routeKey), baseEvaluation),
		[baseEvaluation, routeSelections],
	);
	const originalEvaluation = useMemo(
		() =>
			baselineEvaluation
				? Object.entries(routeSelections).reduce((current, [index, routeKey]) => withRequiredItemRoute(current, Number(index), routeKey), baselineEvaluation)
				: undefined,
		[baselineEvaluation, routeSelections],
	);
	const output = itemById[evaluation.outputItemId];
	const routeContext: RouteContext = {
		itemById,
		bartersById,
		craftsById,
		tradersById,
		stationsById,
	};
	const headlineKey = sortKey === "profitPerHour" ? "profitPerHour" : "profit";
	const hasNestedRecipe = evaluation.requiredItems.some(hasRecipeRoute);
	return (
		<div
			data-output-locked={Boolean(evaluation.outputLockReasons?.length)}
			className={highlighted ? "bg-brand/[0.06] ring-1 ring-inset ring-brand/40" : undefined}
		>
			<div className={styles.row}>
				<div className={styles.actions}>
					{onTogglePinned && (
						<button
							type="button"
							aria-pressed={pinned}
							aria-label={pinned ? "Unpin craft" : "Pin craft"}
							title={pinned ? "Unpin craft" : "Pin craft"}
							onClick={onTogglePinned}
							className={`flex size-9 2xl:size-7 items-center justify-center rounded border transition ${pinned ? "border-info/40 bg-info/10 text-info" : "border-highlight/10 bg-highlight/[0.035] text-muted-foreground hover:border-info/40 hover:text-info"}`}
						>
							<Pin className={`size-4 ${pinned ? "fill-current" : ""}`} />
						</button>
					)}
					{hasNestedRecipe && (
						<button
							type="button"
							aria-expanded={expanded}
							aria-label={`${expanded ? "Collapse" : "Expand"} recipe chain`}
							title={`${expanded ? "Collapse" : "Expand"} recipe chain`}
							onClick={() => setExpanded((value) => !value)}
							className="flex size-9 2xl:size-7 items-center justify-center rounded border border-highlight/10 bg-highlight/[0.035] text-muted-foreground transition hover:border-brand/50 hover:text-brand"
						>
							<ChevronRight className={`size-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
						</button>
					)}
				</div>
				<div className={styles.source}>
					<ProfitSourceCell evaluation={evaluation} source={source} available={available} />
				</div>
				<div className={styles.output}>
					<RecipeItem
						item={output}
						count={evaluation.outputCount}
						method={evaluation.kind}
						totalPrice={evaluation.grossSellValue === undefined ? evaluation.sellValue : evaluation.grossSellValue}
						priceKind="sell"
						lockReasons={evaluation.outputLockReasons ?? []}
						sellValueIsEstimate={evaluation.sellValueIsEstimate ?? false}
						emphasized
						fillColumn
						showRouteIcon={false}
						overrides={overrides}
						onPriceChange={onPriceChange}
						routeContext={routeContext}
						onItemOpen={onItemOpen}
						recipePreview={{
							kind: evaluation.kind,
							sourceId: evaluation.id,
							outputItemId: evaluation.outputItemId,
							outputCount: evaluation.outputCount,
							batches: 1,
							requiredItems: evaluation.requiredItems,
							durationSeconds: evaluation.craft?.duration ?? 0,
						}}
						detail={
							evaluation.barter
								? `Barter with ${sourceName ?? "unknown trader"} at LL${evaluation.barter.minTraderLevel}`
								: `Craft at ${sourceName ?? "unknown station"} level ${evaluation.craft?.level ?? "?"} · ${formatDuration(evaluation.craft?.duration ?? 0)}`
						}
					/>
				</div>
				<div className={styles.headline}>
					<ProfitCell
						label={headlineKey === "profitPerHour" ? "Profit / hour" : "Profit"}
						showLabel
						value={evaluation[headlineKey]}
						customized={originalEvaluation !== undefined && evaluation[headlineKey] !== originalEvaluation[headlineKey]}
						originalValue={originalEvaluation ? formatSignedRoubles(originalEvaluation[headlineKey]) : undefined}
					>
						{formatSignedRoubles(evaluation[headlineKey])}
					</ProfitCell>
				</div>
				<div className={styles.ingredients}>
					<span className={styles.sectionLabel}>Required items</span>
					{evaluation.requiredItems.map((plan, index) => (
						<RecipeItem
							key={`${plan.itemId}:${plan.isTool === true}`}
							item={itemById[plan.itemId]}
							count={plan.quantity}
							method={plan.method}
							totalPrice={plan.totalCost}
							plan={plan}
							lockReasons={plan.lockReasons}
							priceKind="buy"
							overrides={overrides}
							onPriceChange={onPriceChange}
							routeContext={routeContext}
							compactLine
							onItemOpen={onItemOpen}
							onGoToRecipe={onGoToRecipe}
							onRouteChange={(routeKey) => onRouteChange(index, routeKey)}
							baseRouteKey={acquisitionRouteKey(baseEvaluation.requiredItems[index])}
						/>
					))}
				</div>
				<div className={styles.metrics}>
					<ProfitCell responsiveLabel label="Cost">
						{formatRoundedRoubles(evaluation.cost)}
					</ProfitCell>
					<SellValueCell
						responsiveLabel
						item={output}
						count={evaluation.outputCount}
						sellValue={evaluation.sellValue}
						sellSourceLabel={evaluation.sellSourceLabel}
						overrides={overrides}
					/>
					<ProfitCell
						responsiveLabel
						label="Profit"
						value={evaluation.profit}
						customized={originalEvaluation !== undefined && evaluation.profit !== originalEvaluation.profit}
						originalValue={originalEvaluation ? formatSignedRoubles(originalEvaluation.profit) : undefined}
						detail={`Total time ${evaluation.durationSeconds > 0 ? formatDuration(evaluation.durationSeconds) : "-"}`}
						infoTitle="Sell the ingredients instead"
						info={
							evaluation.profitVsSellingInputs !== null &&
							evaluation.profitVsSellingInputs < 0 &&
							evaluation.inputSellValue !== null &&
							evaluation.sellValue !== null ? (
								<>
									<span className="block">
										Selling all non-tool ingredients individually would return{" "}
										<strong className="text-foreground">{formatRoundedRoubles(evaluation.inputSellValue)}</strong>.
									</span>
									<span className="mt-1 block">
										The {evaluation.kind === "barter" ? "barter" : "craft"} output sells for{" "}
										<strong className="text-foreground">{formatRoundedRoubles(evaluation.sellValue)}</strong>.
									</span>
									<span className="mt-2 block border-t border-highlight/10 pt-2 text-warning">
										If you already own the ingredients, selling them separately is worth{" "}
										<strong>{formatRoundedRoubles(-evaluation.profitVsSellingInputs)}</strong> more.
									</span>
								</>
							) : undefined
						}
					>
						{formatSignedRoubles(evaluation.profit)}
					</ProfitCell>
					<ProfitCell
						responsiveLabel
						label="Profit / hour"
						value={evaluation.profitPerHour}
						customized={originalEvaluation !== undefined && evaluation.profitPerHour !== originalEvaluation.profitPerHour}
						originalValue={originalEvaluation ? formatSignedRoubles(originalEvaluation.profitPerHour) : undefined}
					>
						{formatSignedRoubles(evaluation.profitPerHour)}
					</ProfitCell>
				</div>
			</div>
			{expanded && hasNestedRecipe && <RecipeChain evaluation={evaluation} routeContext={routeContext} onGoToRecipe={onGoToRecipe} />}
		</div>
	);
}
