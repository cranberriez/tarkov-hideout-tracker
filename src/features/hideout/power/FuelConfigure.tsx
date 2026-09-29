"use client";

import { useId } from "react";
import { Crown, RotateCcw, Settings } from "lucide-react";
import { ItemImage } from "@/components/entities/item-image";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { RouteIcon } from "@/features/profit-pages/components/RouteIcon";
import { SkillRow } from "@/features/profit-pages/components/CraftingSettings";
import { useProfitOptions } from "@/features/profit-pages/useProfitOptions";
import { METAL_FUEL_TANK_ITEM_ID } from "@/lib/cfg/hideout-power";
import { hideoutManagementConsumptionReduction } from "@/lib/price-calculation/craft-rules";
import { useUserStore } from "@/lib/stores/useUserStore";
import { EmptyFuelValue } from "./EmptyFuelValue";
import { formatRoubles } from "./power-format";
import type { FuelRoute, FuelTank, HideoutPower } from "./useHideoutPower";
import { useFuelRouteChoices } from "./useFuelRouteChoices";

const METHOD_LABELS: Record<FuelRoute["method"], string> = {
	flea: "Flea market",
	trader: "Trader",
	barter: "Barter",
	craft: "Craft",
	sell: "Sell value",
	empty: "Empty value",
};

function routeDetail(route: FuelRoute, sources: HideoutPower["routeSources"]) {
	if (route.method === "trader" && route.traderOffer) {
		const name = sources.traders[route.traderOffer.traderId];
		return [name, route.traderOffer.minTraderLevel !== undefined && `LL${route.traderOffer.minTraderLevel}`];
	}
	if (route.method === "barter" && route.sourceId) {
		return [sources.traders[sources.barterTraderIds[route.sourceId] ?? ""]];
	}
	if (route.method === "craft" && route.sourceId) {
		return [sources.stations[sources.craftStationIds[route.sourceId] ?? ""]];
	}
	return [];
}

function TankSection({
	tank,
	sources,
	loading,
	chosen,
	onChoose,
}: {
	tank: FuelTank;
	sources: HideoutPower["routeSources"];
	loading: boolean;
	chosen: boolean;
	onChoose: (routeKey: string | undefined) => void;
}) {
	const name = tank.id === METAL_FUEL_TANK_ITEM_ID ? "Metal fuel tank" : "Expeditionary fuel tank";
	const groupId = useId();
	return (
		<section aria-labelledby={groupId} className="rounded-lg bg-shadow/20 p-4">
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
				<p className="text-xs font-medium text-muted-foreground" id={`${groupId}-routes`}>
					Acquisition route
				</p>
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
				<div role="radiogroup" aria-labelledby={`${groupId}-routes`} className="mt-1.5 flex flex-col gap-1">
					{tank.routes.map((route) => {
						const key = route.key;
						const reasons = route.lockReasons;
						const locked = reasons !== undefined;
						const selected = key === tank.selectedRouteKey;
						const detail = [...routeDetail(route, sources), ...(locked ? ["Locked"] : [])].filter(Boolean).join(" · ");
						return (
							<button
								key={key}
								type="button"
								role="radio"
								aria-checked={selected}
								onClick={() => onChoose(key)}
								className={`grid grid-cols-[18px_minmax(0,1fr)_auto] items-center gap-2.5 rounded border px-2.5 py-1.5 text-left transition-colors hover:bg-highlight/[0.07] focus-visible:outline-2 focus-visible:outline-brand ${selected ? "border-brand/50 bg-brand/10" : "border-transparent"}`}
							>
								<RouteIcon method={route.method} inline title={METHOD_LABELS[route.method]} />
								<span className="min-w-0">
									<span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
										{METHOD_LABELS[route.method]}
										{key === tank.recommendedRouteKey && (
											<span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase tracking-wide text-warning">
												<Crown aria-hidden className="size-3" />
												Best
											</span>
										)}
									</span>
									{detail && <span className="block truncate text-[11px] text-muted-foreground">{detail}</span>}
									{reasons && reasons.length > 0 && (
										<span
											title={[...new Set(reasons.map((reason) => reason.message))].join(", ")}
											className="block truncate text-[11px] text-danger"
										>
											{reasons[0].message}
											{reasons.length > 1 && ` (+${reasons.length - 1} more)`}
										</span>
									)}
								</span>
								<span className="font-mono text-xs font-semibold text-brand">{formatRoubles(route.totalCost)}</span>
							</button>
						);
					})}
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
				<div className="mt-5 flex flex-col gap-4">
					{power.tanks.map((tank) => (
						<TankSection
							key={tank.id}
							tank={tank}
							sources={power.routeSources}
							loading={power.pricing === "loading"}
							chosen={choices[tank.id] !== undefined}
							onChoose={(routeKey) => setChoice(tank.id, routeKey)}
						/>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
