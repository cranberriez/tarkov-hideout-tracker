"use client";

import { useId, useState } from "react";
import { ChevronDown, RotateCcw, Settings } from "lucide-react";
import { ItemImage } from "@/components/entities/item-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AcquisitionRouteOption } from "@/features/profit-pages/components/AcquisitionRouteOption";
import { ProfitPricingContext } from "@/features/profit-pages/components/ProfitPricingContext";
import { SkillRow } from "@/features/profit-pages/components/CraftingSettings";
import type { RouteContext } from "@/features/profit-pages/types";
import { useProfitOptions } from "@/features/profit-pages/useProfitOptions";
import { METAL_FUEL_TANK_ITEM_ID } from "@/lib/cfg/hideout-power";
import { hideoutManagementConsumptionReduction } from "@/lib/price-calculation/craft-rules";
import { useUserStore } from "@/lib/stores/useUserStore";
import { EmptyFuelValue } from "./EmptyFuelValue";
import { formatRoubles } from "./power-format";
import type { FuelRoute, FuelTank, HideoutPower } from "./useHideoutPower";
import { useFuelRouteChoices } from "./useFuelRouteChoices";

function TankSection({
	tank,
	routeContext,
	loading,
	chosen,
	onChoose,
}: {
	tank: FuelTank;
	routeContext: RouteContext;
	loading: boolean;
	chosen: boolean;
	onChoose: (routeKey: string | undefined) => void;
}) {
	const name = tank.id === METAL_FUEL_TANK_ITEM_ID ? "Metal fuel tank" : "Expeditionary fuel tank";
	const groupId = useId();
	const [open, setOpen] = useState(false);
	const active = tank.routes.find((route) => route.key === tank.selectedRouteKey);
	// Without an active route (e.g. a stale saved choice) the list stays open so one can be picked.
	const expanded = open || !active;
	const others = tank.routes.filter((route) => route !== active);
	const option = (route: FuelRoute, onSelect: () => void) => ({
		route,
		unitPrice: route.totalCost,
		priceTitle: route.lockReasons && route.totalCost !== null ? "Estimated price; route is locked" : undefined,
		item: tank.item,
		routeContext,
		selected: route.key === tank.selectedRouteKey,
		best: route.key === tank.recommendedRouteKey,
		onSelect,
	});
	return (
		<section aria-labelledby={groupId} className="py-5 first:pt-0 last:pb-0">
			<div className="flex items-center gap-3">
				<ItemImage item={tank.item ?? { name }} size={40} />
				<div className="min-w-0 flex-1">
					<h3 id={groupId} className="truncate text-sm font-semibold text-foreground">
						{tank.item?.name ?? name}
					</h3>
					<p className="text-[11px] text-muted-foreground">
						{tank.units ? `${tank.units} units` : "Capacity unknown"} · cost {loading ? "…" : formatRoubles(tank.price)}
					</p>
				</div>
			</div>
			<div className="mt-4">
				<EmptyFuelValue key={`${tank.id}:${tank.emptyValue ?? ""}`} itemId={tank.id} item={tank.item} />
			</div>
			<div className="mt-4 flex items-center justify-between gap-2">
				<p className="text-xs font-medium text-muted-foreground">Acquisition route</p>
				{chosen && (
					<Button type="button" size="xs" variant="ghost" onClick={() => onChoose(undefined)}>
						<RotateCcw size={12} aria-hidden />
						Use recommended
					</Button>
				)}
			</div>
			{tank.routeMissing && (
				<p role="alert" className="mt-1.5 text-xs text-warning">
					The saved route is no longer available. Choose another to price this tank.
				</p>
			)}
			{tank.routes.length === 0 ? (
				<p className="mt-1.5 text-xs text-warning">No available acquisition route.</p>
			) : (
				<div className="mt-1.5 space-y-1">
					{active && <AcquisitionRouteOption {...option(active, () => setOpen(!open))} expanded={open} />}
					{active && others.length > 0 && (
						<Button
							type="button"
							size="xs"
							variant="ghost"
							aria-expanded={open}
							aria-controls={`${groupId}-routes`}
							onClick={() => setOpen(!open)}
						>
							<ChevronDown size={12} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
							{open ? "Hide other routes" : `Choose another route (${others.length})`}
						</Button>
					)}
					{expanded && (
						<div id={`${groupId}-routes`} className="space-y-1">
							{others.map((route) => (
								<AcquisitionRouteOption
									key={route.key}
									{...option(route, () => {
										onChoose(route.key);
										setOpen(false);
									})}
								/>
							))}
						</div>
					)}
				</div>
			)}
		</section>
	);
}

/** Fuel settings: Hideout Management, then per-tank sale price and acquisition route. */
export function FuelConfigure({ power }: { power: HideoutPower }) {
	const mode = useUserStore((state) => state.gameMode);
	const options = useProfitOptions(mode);
	const [choices, setChoice] = useFuelRouteChoices(mode);
	const skillId = useId();
	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button size="sm" className="rounded-full">
					<Settings size={14} aria-hidden />
					Configure
				</Button>
			</DialogTrigger>
			<DialogContent aria-describedby={undefined} className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:max-w-xl">
				<DialogHeader>
					<DialogTitle>Configure fuel</DialogTitle>
				</DialogHeader>
				<div className="mt-4 [&>div>div]:flex-wrap">
					<SkillRow
						id={skillId}
						label="Hideout Management"
						level={options.hideoutManagementSkillLevel}
						onLevelChange={options.setHideoutManagementSkillLevel}
						reduction={hideoutManagementConsumptionReduction}
						reductionLabel="fuel use"
						inputClassName="h-12 w-20 rounded border border-highlight/20 bg-background px-3 text-center font-mono text-lg outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
					/>
				</div>
				<ProfitPricingContext.Provider value={{ taskUnlocksById: power.taskUnlocksById }}>
					<div className="mt-5 flex flex-col divide-y divide-highlight/10">
						{power.tanks.map((tank) => (
							<TankSection
								key={tank.id}
								tank={tank}
								routeContext={power.routeContext}
								loading={power.pricing === "loading"}
								chosen={choices[tank.id] !== undefined}
								onChoose={(routeKey) => setChoice(tank.id, routeKey)}
							/>
						))}
					</div>
				</ProfitPricingContext.Provider>
			</DialogContent>
		</Dialog>
	);
}
