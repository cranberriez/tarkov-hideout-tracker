"use client";

import { ArrowDown } from "lucide-react";

import { ItemImage } from "@/components/entities/item-image";
import { ItemLink } from "@/components/entities/item-link";
import { METAL_FUEL_TANK_ITEM_ID } from "@/lib/cfg/hideout-power";
import { formatRoubles, formatSpan } from "./power-format";
import type { FuelTank } from "./useHideoutPower";
import { EmptyFuelValue } from "./EmptyFuelValue";
import { useUserStore } from "@/lib/stores/useUserStore";

/** Metal and Expeditionary tanks side by side at the current burn rate. */
export function FuelTankCards({
	tanks,
	loading,
	visual = false,
}: {
	tanks: FuelTank[];
	loading: boolean;
	visual?: boolean;
}) {
	const mode = useUserStore((state) => state.gameMode);
	if (visual) {
		const comparable = !loading && tanks.length > 1 && tanks.every((tank) => tank.costPerHour !== null);
		const lowestCost = comparable ? Math.min(...tanks.map((tank) => tank.costPerHour!)) : null;
		const highestCost = comparable ? Math.max(...tanks.map((tank) => tank.costPerHour!)) : null;
		return (
			<div className="w-full min-w-0">
				<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-4">
					{tanks.map((tank) => {
						const cheaper = lowestCost !== null && highestCost !== lowestCost && tank.costPerHour === lowestCost;
						return (
							<li
								key={tank.id}
								className={`min-w-0 rounded-lg p-3 ${cheaper ? "bg-linear-to-br from-success/10 to-transparent" : ""}`}
							>
								<div className="flex min-w-0 items-center gap-2.5">
									{tank.item ? (
										<ItemImage item={tank.item} size={44} opensModal />
									) : (
										<ItemImage item={{ name: "Missing fuel tank" }} size={44} />
									)}
									<div className="flex min-w-0 flex-1 flex-col gap-0.5">
										{tank.item ? (
											<ItemLink
												item={tank.item}
												className="truncate text-left text-sm font-medium text-foreground hover:text-brand"
											>
												{tank.id === METAL_FUEL_TANK_ITEM_ID ? "Metal" : "Expeditionary"}
											</ItemLink>
										) : (
											<span className="text-xs text-warning">Tank missing</span>
										)}
										<span className="text-[11px] text-muted-foreground">
											{tank.units ? `${tank.units} units` : "Capacity unknown"} ·{" "}
											{loading ? "…" : tank.price === null ? "Price unavailable" : formatRoubles(tank.price)}
										</span>
									</div>
									<EmptyFuelValue
										key={`${mode}:${tank.id}`}
										itemId={tank.id}
										name={tank.item?.name ?? "Fuel tank"}
										item={tank.item}
									/>
								</div>
								<div className="mt-4 grid grid-cols-[auto_auto] justify-between gap-2 tabular-nums">
									<div className="min-w-0">
										<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Lasts</p>
										<p className="mt-0.5 whitespace-nowrap font-mono text-sm font-semibold leading-none text-foreground">
											{tank.runtimeHours === null ? "—" : formatSpan(tank.runtimeHours * 3600)}
										</p>
									</div>
									<div className="min-w-0 text-right">
										<p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
											{tank.emptyValue !== null ? "Net / hour" : "Cost / hour"}
										</p>
										<p
											className={
												cheaper
													? "mt-0.5 inline-flex items-center gap-1 whitespace-nowrap font-mono text-sm font-semibold leading-none text-success"
													: "mt-0.5 whitespace-nowrap font-mono text-sm font-semibold leading-none text-foreground"
											}
										>
											{cheaper && <ArrowDown size={12} className="shrink-0" aria-label="Lower hourly cost" />}
											{loading ? "…" : formatRoubles(tank.costPerHour)}
										</p>
									</div>
								</div>
							</li>
						);
					})}
				</ul>
			</div>
		);
	}
	return (
		<ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
			{tanks.map((tank) => (
				<li
					key={tank.id}
					className="flex min-w-0 items-center gap-3 rounded-sm border border-highlight/8 bg-shadow/20 p-2.5"
				>
					{tank.item ? (
						<ItemImage item={tank.item} size={44} framed opensModal />
					) : (
						<ItemImage item={{ name: "Unknown fuel tank" }} size={44} framed />
					)}
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						{tank.item ? (
							<ItemLink
								item={tank.item}
								className="truncate text-left text-sm font-medium text-foreground hover:text-brand"
							>
								{tank.item.name}
							</ItemLink>
						) : (
							<span className="text-sm text-muted-foreground">Missing from catalog</span>
						)}
						<span className="text-xs text-muted-foreground">
							{loading ? "…" : formatRoubles(tank.price)}
							{tank.units ? ` · ${tank.units} units` : " · capacity unknown"}
							{tank.runtimeHours !== null && ` · lasts ${formatSpan(tank.runtimeHours * 3600)}`}
						</span>
					</div>
					<span className="flex shrink-0 flex-col items-end gap-0.5">
						<EmptyFuelValue
							key={`${mode}:${tank.id}`}
							itemId={tank.id}
							name={tank.item?.name ?? "Fuel tank"}
							item={tank.item}
						/>
						<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
							{tank.emptyValue !== null ? "Net / hour" : "Per hour"}
						</span>
						<span className="font-mono text-sm font-semibold leading-none text-foreground">
							{loading ? "…" : formatRoubles(tank.costPerHour)}
						</span>
					</span>
				</li>
			))}
		</ul>
	);
}
