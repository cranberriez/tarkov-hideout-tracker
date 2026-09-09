"use client";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { AcquisitionPlan, RecipeCalculatorInput } from "@/lib/price-calculation";
import { acquisitionRouteKey } from "../utils/recipes";
import { formatDuration, formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import { CraftImage } from "./CraftImage";
import { requirementKey, type BoardChoice } from "./station-board";
import { ingredientSourceOptions } from "./station-craft-details-model";
import { StationCraftPriceField } from "./StationCraftPriceField";

export function StationCraftIngredient({
	part,
	estimate,
	selected,
	input,
	routeLabel,
	onChoice,
	onItemOpen,
}: {
	part: AcquisitionPlan;
	estimate: AcquisitionPlan;
	selected: BoardChoice;
	input: RecipeCalculatorInput;
	routeLabel: (part: { method: string; sourceId?: string; traderOffer?: { traderId: string } }) => string;
	onChoice: (choice: BoardChoice) => void;
	onItemOpen: (id: string) => void;
}) {
	const key = requirementKey(part);
	const sources = ingredientSourceOptions(estimate);
	const savedRoute = selected.routes?.[key];
	const missingSavedRoute = savedRoute !== undefined && !sources.routes.some((route) => acquisitionRouteKey(route) === savedRoute);
	const custom = selected.unitCosts?.[key];
	const name = input.itemsById[part.itemId]?.name ?? part.itemId;
	const selectRoute = (routeKey: string) => onChoice({ ...selected, routes: { ...selected.routes, [key]: routeKey } });
	const source =
		sources.hasMore || (missingSavedRoute && sources.routes.length > 0) ? (
			<DropdownMenu>
				<DropdownMenuTrigger asChild>
					<button type="button" aria-label={`All sources for ${name}`} className="inline-flex items-center gap-1 text-left hover:text-foreground">
						{missingSavedRoute ? "Choose source" : routeLabel(part)} <ChevronDown size={12} aria-hidden="true" />
					</button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start">
					{sources.routes.map((route) => (
						<DropdownMenuItem
							key={acquisitionRouteKey(route)}
							onSelect={() => selectRoute(acquisitionRouteKey(route))}
							className="flex flex-col items-start gap-0.5 text-xs"
						>
							<span>
								{routeLabel(route)} · {formatRoundedRoubles(route.totalCost)} total
								{acquisitionRouteKey(route) === (savedRoute ?? acquisitionRouteKey(part)) ? " · Selected" : ""}
							</span>
							<span className="text-[11px] text-muted-foreground">
								{route.durationSeconds ? `${formatDuration(route.durationSeconds)} additional time` : "Direct acquisition"}
							</span>
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>
		) : (
			routeLabel(part)
		);
	return (
		<div className="grid grid-cols-[32px_minmax(0,1fr)] items-start gap-2.5">
			<button type="button" aria-label={`Open ${name}`} onClick={() => onItemOpen(part.itemId)}>
				<CraftImage item={input.itemsById[part.itemId]} size={32} />
			</button>
			<div className="min-w-0 space-y-1.5">
				<div className="flex flex-wrap items-center justify-between gap-2 text-xs">
					<button type="button" className="text-left hover:text-brand" onClick={() => onItemOpen(part.itemId)}>
						{formatQuantity(part.quantity)}× {name}
					</button>
					{!part.isTool && part.quantity !== 1 && (
						<span className="font-mono text-[11px] text-muted-foreground" aria-label={`Total cost for ${name}`}>
							{formatRoundedRoubles(part.totalCost)}
						</span>
					)}
				</div>
				{part.isTool ? (
					<p className="text-[11px] text-muted-foreground">Reusable tool · no recurring cost</p>
				) : (
					<div className="flex flex-wrap items-center gap-1" aria-label={`Sources for ${name}`}>
						<StationCraftPriceField
							label={`Input cost per unit for ${name}`}
							source={source}
							value={custom}
							estimate={estimate.quantity > 0 && estimate.totalCost !== null ? estimate.totalCost / estimate.quantity : null}
							onChange={(price) => {
								const unitCosts = { ...selected.unitCosts };
								if (price === undefined) delete unitCosts[key];
								else unitCosts[key] = price;
								onChoice({ ...selected, unitCosts });
							}}
						/>
						{part.quantity !== 1 && <span className="mr-1 text-[11px] text-muted-foreground">/ each</span>}
						{sources.inline.map((route) => {
							const routeKey = acquisitionRouteKey(route);
							return (
								<button
									key={routeKey}
									type="button"
									aria-pressed={false}
									title={route.durationSeconds ? `${formatDuration(route.durationSeconds)} additional time` : "Direct acquisition"}
									onClick={() => selectRoute(routeKey)}
									className="rounded px-2 py-1 text-[11px] text-muted-foreground hover:bg-highlight/5 hover:text-foreground"
								>
									{routeLabel(route)} · {formatRoundedRoubles(part.quantity > 0 ? route.totalCost / part.quantity : null)}
									{part.quantity !== 1 ? " / each" : ""}
								</button>
							);
						})}
						{!sources.routes.length && <span className="text-xs text-warning">No available acquisition route</span>}
					</div>
				)}
			</div>
		</div>
	);
}
