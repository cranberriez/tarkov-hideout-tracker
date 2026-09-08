"use client";
import { getItemSellComparison, type AcquisitionPlan, type RecipeCalculatorInput, type RecipeEvaluation } from "@/lib/price-calculation";
import { fleaTargetPrice, itemBasePrice } from "@/lib/price-calculation/calc-tax";
import type { PriceChangeHandler, ProfitStationSource } from "../types";
import { acquisitionRouteKey, getAcquisitionRoutes } from "../utils/recipes";
import { formatDuration, formatQuantity, formatRoundedRoubles, formatSignedRoubles } from "../utils/formatters";
import { boardCraftAvailable, boardVariants, requirementKey, selectedBoardCraft, type BoardChoice, type BoardCraft } from "./station-board";

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
	const output = input.itemsById[row.outputItemId];
	const override = input.overrides?.[row.outputItemId] ?? {};
	const sale = getItemSellComparison(output, input.overrides, input, row.outputCount);
	const base = itemBasePrice(output?.marketPrice?.sellFor, input);
	const breakEven = base === null || row.cost === null ? null : fleaTargetPrice(base, row.outputCount, row.cost, input);
	const target = base === null || row.cost === null ? null : fleaTargetPrice(base, row.outputCount, row.cost * 1.1, input);
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
				<button type="button" className="text-left text-xs hover:text-tarkov-green" onClick={() => onItemOpen(part.itemId)}>
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
		<div className="space-y-4 bg-black/10 px-3 py-3">
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
							className={`min-w-36 rounded px-3 py-2 text-left text-xs ${selected.variant === variant.id ? "bg-white/10" : "hover:bg-white/5 text-muted-foreground"}`}
						>
							<span className="block font-medium">{variant.label}</span>
							<span className="mt-1 block">
								{available ? `${formatSignedRoubles(option.profit)} · ${formatDuration(option.durationSeconds)}` : "Check requirements"}
							</span>
						</button>
					);
				})}
			</div>
			<div className="grid gap-x-8 gap-y-4 lg:grid-cols-[minmax(0,1.65fr)_minmax(240px,1fr)]">
				<div className="min-w-0 space-y-3">
					<h3 className="text-xs font-medium">Inputs</h3>
					{row.requiredItems.map((part) => {
						const key = requirementKey(part);
						const routes = getAcquisitionRoutes(part);
						const custom = selected.unitCosts?.[key];
						return (
							<div key={key} className="space-y-1.5">
								<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
									<button type="button" className="text-left hover:text-tarkov-green" onClick={() => onItemOpen(part.itemId)}>
										{formatQuantity(part.quantity)}× {input.itemsById[part.itemId]?.name ?? part.itemId}
									</button>
									{part.isTool ? (
										<span className="text-muted-foreground">Reusable tool · excluded from cost</span>
									) : (
										<PriceField
											label={`Input cost per unit for ${input.itemsById[part.itemId]?.name ?? part.itemId}`}
											value={custom}
											estimate={part.quantity > 0 && part.totalCost !== null ? part.totalCost / part.quantity : null}
											onChange={(price) => {
												const unitCosts = { ...selected.unitCosts };
												if (price === undefined) delete unitCosts[key];
												else unitCosts[key] = price;
												onChoice({ ...selected, unitCosts });
											}}
										/>
									)}
								</div>
								{!part.isTool && (
									<div className="flex flex-wrap gap-1" aria-label={`Sources for ${input.itemsById[part.itemId]?.name ?? part.itemId}`}>
										{routes.map((route) => {
											const routeKey = acquisitionRouteKey(route);
											return (
												<button
													key={routeKey}
													type="button"
													aria-pressed={acquisitionRouteKey(part) === routeKey}
													title={route.durationSeconds ? `${formatDuration(route.durationSeconds)} additional time` : "Direct acquisition"}
													onClick={() => onChoice({ ...selected, routes: { ...selected.routes, [key]: routeKey } })}
													className={`rounded px-2 py-1 text-[11px] ${acquisitionRouteKey(part) === routeKey ? "bg-white/10 text-foreground" : "text-muted-foreground hover:bg-white/5"}`}
												>
													{routeLabel(route)} · {formatRoundedRoubles(route.totalCost)}
												</button>
											);
										})}
										{!routes.length && <span className="text-xs text-amber-300">No available acquisition route</span>}
									</div>
								)}
							</div>
						);
					})}
					<p className="text-[11px] text-muted-foreground">Input cost edits are saved for this craft. Clear a value to use its estimate.</p>
				</div>
				<div className="min-w-0 space-y-3">
					<h3 className="text-xs font-medium">Output · {formatQuantity(row.outputCount)} items</h3>
					<div className="flex flex-wrap items-center gap-2">
						<label className="text-xs text-muted-foreground" htmlFor={`sale-source-${row.id}`}>
							Sell to
						</label>
						<select
							id={`sale-source-${row.id}`}
							value={override.sellSource ?? "auto"}
							className="max-w-full rounded bg-background px-2 py-1.5 text-xs"
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
					<div className="flex flex-wrap items-center justify-between gap-2">
						<span className="text-xs text-muted-foreground">Sale price / item</span>
						<PriceField
							label={`Sale price per item for ${output?.name ?? row.id}`}
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
					</div>
					<dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
						<dt className="text-muted-foreground">Gross sale</dt>
						<dd className="font-mono text-right">{formatRoundedRoubles(sale.grossTotal)}</dd>
						<dt className="text-muted-foreground">Flea fee</dt>
						<dd className="font-mono text-right">{formatRoundedRoubles(sale.fee)}</dd>
						<dt className="text-muted-foreground">Sale proceeds</dt>
						<dd className="font-mono text-right">{formatRoundedRoubles(row.sellValue)}</dd>
						<dt className="text-muted-foreground">Input cost</dt>
						<dd className="font-mono text-right">{formatRoundedRoubles(row.cost)}</dd>
						<dt>Estimated profit</dt>
						<dd className={`font-mono text-right ${(row.profit ?? 0) > 0 ? "text-tarkov-green" : "text-red-300"}`}>{formatSignedRoubles(row.profit)}</dd>
					</dl>
					{sale.fee === null && <p className="text-xs text-amber-300">A flea fee cannot be estimated without a usable item base value.</p>}
					{sale.saleDestination === "flea" && (
						<div className="space-y-1 text-xs text-muted-foreground">
							<p>
								Estimated break-even <span className="float-right font-mono text-foreground">{formatRoundedRoubles(breakEven)} / item</span>
							</p>
							<p>
								For 10% return <span className="float-right font-mono text-foreground">{formatRoundedRoubles(target)} / item</span>
							</p>
						</div>
					)}
					<p className="text-[11px] text-muted-foreground">
						Sale edits also apply to this item in profit comparisons. Estimates exclude fuel and initial tool purchases. Listing price and stock are not
						guaranteed.
					</p>
				</div>
			</div>
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

function PriceField({
	label,
	value,
	estimate,
	onChange,
}: {
	label: string;
	value?: number;
	estimate: number | null;
	onChange: (value: number | undefined) => void;
}) {
	return (
		<span className="inline-flex items-center gap-1">
			<input
				aria-label={label}
				type="number"
				min="0"
				step="any"
				inputMode="decimal"
				value={value ?? ""}
				placeholder={estimate === null ? "Unknown" : String(Math.round(estimate))}
				onChange={(event) => {
					const raw = event.target.value;
					const parsed = Number(raw);
					if (!raw || (Number.isFinite(parsed) && parsed >= 0)) onChange(raw ? parsed : undefined);
				}}
				className={`w-28 rounded bg-background px-2 py-1.5 text-right font-mono text-xs ${value === undefined ? "text-foreground" : "text-sky-300"}`}
			/>
			<span className="text-xs text-muted-foreground">₽</span>
			{value !== undefined && (
				<button
					type="button"
					aria-label={`Reset ${label}`}
					title="Use estimate"
					onClick={() => onChange(undefined)}
					className="px-1 text-xs text-muted-foreground hover:text-foreground"
				>
					×
				</button>
			)}
		</span>
	);
}
