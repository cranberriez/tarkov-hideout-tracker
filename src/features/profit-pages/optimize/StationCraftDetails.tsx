"use client";
import { getItemSellComparison, type AcquisitionPlan, type RecipeCalculatorInput, type RecipeEvaluation } from "@/lib/price-calculation";
import { fleaTargetPrice, itemBasePrice } from "@/lib/price-calculation/calc-tax";
import type { PriceChangeHandler, ProfitStationSource } from "../types";
import { acquisitionRouteKey } from "../utils/recipes";
import { formatDuration, formatQuantity, formatRoundedRoubles, formatSignedRoubles } from "../utils/formatters";
import { CraftImage } from "./CraftImage";
import { boardCraftAvailable, boardVariants, requirementKey, selectedBoardCraft, type BoardChoice, type BoardCraft } from "./station-board";
import { StationCraftIngredient } from "./StationCraftIngredient";
import { StationCraftPriceField } from "./StationCraftPriceField";

export function StationCraftDetails({
	craft,
	row,
	choice,
	input,
	stations,
	traders,
	onChoice,
	onPriceChange,
	onItemOpen,
}: {
	craft: BoardCraft;
	row: RecipeEvaluation;
	choice?: BoardChoice;
	input: RecipeCalculatorInput;
	stations: Record<string, ProfitStationSource>;
	traders: Record<string, { name: string }>;
	onChoice: (choice: BoardChoice) => void;
	onPriceChange: PriceChangeHandler;
	onItemOpen: (id: string) => void;
}) {
	const selected = choice ?? { variant: "direct" };
	const estimatedRow = selectedBoardCraft(craft, { ...selected, unitCosts: undefined });
	const output = input.itemsById[row.outputItemId];
	const override = input.overrides?.[row.outputItemId] ?? {};
	const sale = getItemSellComparison(output, input.overrides, input, row.outputCount);
	const base = itemBasePrice(output?.marketPrice?.sellFor, input);
	const breakEven = base === null || row.cost === null ? null : fleaTargetPrice(base, row.outputCount, row.cost, input);
	const target = base === null || row.cost === null ? null : fleaTargetPrice(base, row.outputCount, row.cost * 1.1, input);
	const totalCost = row.cost === null || sale.fee === null ? null : row.cost + sale.fee;
	const saleSource =
		sale.saleDestination === "flea" ? "Flea" : sale.saleDestination === "trader" ? (sale.bestTraderOffer?.vendor.name ?? "Trader") : "Unavailable";
	const hasChain = row.requiredItems.some((part) => !part.isTool && part.children.length);
	const variants = boardVariants.filter((variant, index, all) => {
		const evaluated = craft.variants[variant.id];
		if (!evaluated) return false;
		if (variant.id === selected.variant) return true;
		const signature = (value: RecipeEvaluation | undefined) => JSON.stringify(value?.requiredItems.map((part) => [acquisitionRouteKey(part), part.totalCost]));
		return !all.slice(0, index).some((previous) => signature(craft.variants[previous.id]) === signature(evaluated));
	});
	function routeLabel(part: { method: string; sourceId?: string; traderOffer?: { traderId: string } }) {
		if (part.method === "flea") return "Flea";
		if (part.method === "trader") return traders[part.traderOffer?.traderId ?? ""]?.name ?? "Trader";
		if (part.method === "barter") return "Barter";
		if (part.method === "craft") return "Craft";
		return part.method === "sell" ? "Owned item value" : "Unavailable";
	}
	function chain(parts: AcquisitionPlan[], depth = 0): React.ReactNode {
		return parts.map((part) => (
			<div key={`${part.itemId}:${part.sourceId}:${part.isTool}`} className="py-1" style={{ paddingLeft: Math.min(depth, 4) * 12 }}>
				<button type="button" className="inline-flex items-center gap-2 text-left text-xs hover:text-tarkov-green" onClick={() => onItemOpen(part.itemId)}>
					<CraftImage item={input.itemsById[part.itemId]} size={24} />
					{formatQuantity(part.quantity)}× {input.itemsById[part.itemId]?.name ?? part.itemId}
				</button>
				<span className="ml-2 text-[11px] text-muted-foreground">
					{part.isTool
						? "Reusable tool"
						: part.method === "craft"
							? `Craft · ${stations[input.crafts.find((craft) => craft.id === part.sourceId)?.stationId ?? ""]?.name ?? "Station"}`
							: routeLabel(part)}
				</span>
				{!part.isTool && part.children.length > 0 && chain(part.children, depth + 1)}
			</div>
		));
	}
	return (
		<div className="mb-7 space-y-6 bg-black/10 px-4 pb-4 pt-2">
			{row.lockReasons.length > 0 && (
				<p role="status" className="text-xs text-amber-300">
					{row.lockReasons.map((reason) => reason.message).join(" · ")}
				</p>
			)}
			<div className="flex flex-wrap gap-2" aria-label="Acquisition approaches">
				{variants.map((variant) => {
					const option = selectedBoardCraft(craft, { variant: variant.id, unitCosts: selected.unitCosts });
					const available = boardCraftAvailable(option);
					return (
						<button
							key={variant.id}
							type="button"
							aria-pressed={selected.variant === variant.id}
							onClick={() => onChoice({ variant: variant.id, unitCosts: selected.unitCosts })}
							className={`rounded px-3 py-2 text-left text-xs ${selected.variant === variant.id ? "bg-white/10" : "hover:bg-white/5 text-muted-foreground"}`}
						>
							<span className="block font-medium">{variant.label}</span>
							<span className="mt-1 block text-[11px] text-muted-foreground">
								{available ? `${formatSignedRoubles(option.profit)} · ${formatDuration(option.durationSeconds)}` : "Check requirements"}
							</span>
						</button>
					);
				})}
			</div>
			<div className="grid gap-x-10 gap-y-6 md:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)]">
				<div className="min-w-0 space-y-5">
					<h3 className="text-xs font-medium">Ingredients</h3>
					{row.requiredItems.map((part, index) => (
						<StationCraftIngredient
							key={requirementKey(part)}
							part={part}
							estimate={estimatedRow.requiredItems[index]}
							selected={selected}
							input={input}
							routeLabel={routeLabel}
							onChoice={onChoice}
							onItemOpen={onItemOpen}
						/>
					))}
					<details className="text-[11px] text-muted-foreground">
						<summary className="w-fit cursor-pointer hover:text-foreground">Price edits</summary>
						<p className="mt-2">
							Prices are per unit; item totals include quantity. Input edits are saved for this craft. Clear a price or use the reset arrow to restore its
							estimate. Blue prices are custom.
						</p>
					</details>
				</div>
				<div className="min-w-0 space-y-6">
					<div className="space-y-2">
						<div className="flex flex-wrap items-center justify-between gap-2">
							<h3 className="text-xs font-medium">
								Sale{" "}
								<span className="text-[11px] font-normal text-muted-foreground">
									· {formatQuantity(row.outputCount)} {row.outputCount === 1 ? "item" : "items"}
								</span>
							</h3>
							<label className="sr-only" htmlFor={`sale-source-${row.id}`}>
								Sell to
							</label>
							<select
								id={`sale-source-${row.id}`}
								value={override.sellSource ?? "auto"}
								className="max-w-full rounded bg-background px-1 py-1 text-[11px] text-muted-foreground"
								onChange={(event) => {
									const source = event.target.value;
									if (source === "auto") {
										onPriceChange(row.outputItemId, { buy: override.buy });
										return;
									}
									const sellSource = source as "flea" | "trader";
									const price = sellSource === "flea" ? (sale.fleaPrice ?? override.sell) : sale.bestTraderOffer?.priceRUB;
									if (price !== null && price !== undefined) onPriceChange(row.outputItemId, { ...override, sellSource, sell: price });
								}}
							>
								<option value="auto">Best net return</option>
								<option value="flea" disabled={!!row.outputLockReasons.length || (sale.fleaPrice === null && override.sell === undefined)}>
									Flea market
								</option>
								<option value="trader" disabled={!sale.bestTraderOffer}>
									Trader
								</option>
							</select>
						</div>
						<div className="flex flex-wrap items-center gap-2">
							<StationCraftPriceField
								label={`Sale price per item for ${output?.name ?? row.id}`}
								source={saleSource}
								large
								value={override.sell}
								estimate={sale.selectedPrice}
								onChange={(sell) =>
									onPriceChange(row.outputItemId, {
										...override,
										sell,
										sellSource: sell === undefined ? undefined : (override.sellSource ?? sale.saleDestination ?? "flea"),
									})
								}
							/>
							<span className="text-[11px] text-muted-foreground">/ item</span>
						</div>
						<p className="text-[11px] text-muted-foreground">{formatRoundedRoubles(row.sellValue)} proceeds after fee</p>
					</div>
					<div className="space-y-2">
						<h3 className="text-xs font-medium">Costs</h3>
						<dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
							<dt>Ingredients</dt>
							<dd className="text-right font-mono">{formatRoundedRoubles(row.cost)}</dd>
							<dt>Flea fee</dt>
							<dd className="text-right font-mono">{formatRoundedRoubles(sale.fee)}</dd>
							<dt className="mt-1 text-xs text-foreground">Total</dt>
							<dd className="mt-1 text-right font-mono text-xs text-foreground">{formatRoundedRoubles(totalCost)}</dd>
						</dl>
						{sale.fee === null && <p className="text-xs text-amber-300">A flea fee cannot be estimated without a usable item base value.</p>}
					</div>
					<div className="space-y-2">
						<div className="flex flex-wrap items-baseline justify-between gap-2">
							<h3 className="text-xs font-medium">Estimated profit</h3>
							<span className="text-[11px] text-muted-foreground">{formatDuration(row.durationSeconds)} craft</span>
						</div>
						<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
							<span
								className={`font-mono text-2xl font-medium ${row.profit === null ? "text-muted-foreground" : row.profit > 0 ? "text-tarkov-green" : "text-red-300"}`}
							>
								{formatSignedRoubles(row.profit)}
							</span>
							<span className="font-mono text-[11px] text-muted-foreground">{formatSignedRoubles(row.profitPerHour)} / h</span>
						</div>
						{sale.saleDestination === "flea" && (
							<div className="space-y-1 text-[11px] text-muted-foreground">
								<p>
									<span className="font-mono text-foreground">{formatRoundedRoubles(breakEven)}</span> estimated break-even / item
								</p>
								<p>
									<span className="font-mono text-foreground">{formatRoundedRoubles(target)}</span> for 10% return / item
								</p>
							</div>
						)}
					</div>
				</div>
			</div>
			<details className="text-[11px] text-muted-foreground">
				<summary className="w-fit cursor-pointer hover:text-foreground">Calculation notes</summary>
				<p className="mt-2">
					Gross sale: {formatRoundedRoubles(sale.grossTotal)} for {formatQuantity(row.outputCount)} {row.outputCount === 1 ? "item" : "items"}. Sale edits also
					apply to this item in profit comparisons.
				</p>
				<p className="mt-2">Estimates exclude fuel and initial tool purchases. Listing price and stock are not guaranteed.</p>
			</details>
			{hasChain && (
				<details>
					<summary className="cursor-pointer text-xs font-medium">Acquisition steps</summary>
					<div className="mt-2">{chain(row.requiredItems)}</div>
					<p className="mt-2 text-[11px] text-muted-foreground">Duration includes allocated intermediate craft time. Starts and collections are manual.</p>
				</details>
			)}
		</div>
	);
}
