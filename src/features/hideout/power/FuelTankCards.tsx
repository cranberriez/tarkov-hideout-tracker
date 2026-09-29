"use client";

import { ItemImage } from "@/components/entities/item-image";
import { ItemLink } from "@/components/entities/item-link";
import { formatRoubles, formatSpan } from "./power-format";
import type { FuelTank } from "./useHideoutPower";

/** Metal and Expeditionary tanks side by side at the current burn rate. */
export function FuelTankCards({ tanks, loading }: { tanks: FuelTank[]; loading: boolean }) {
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
						<span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Per hour</span>
						<span className="font-mono text-sm font-semibold leading-none text-foreground">
							{loading ? "…" : formatRoubles(tank.costPerHour)}
						</span>
					</span>
				</li>
			))}
		</ul>
	);
}
