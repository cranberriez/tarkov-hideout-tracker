"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Crown } from "lucide-react";
import type { LockedAcquisitionAlternative, LockReason } from "@/lib/price-calculation";
import type { ItemSummary } from "@/types/items";
import type { RouteContext } from "../types";
import { formatCompactPrice } from "../utils/formatters";
import { LockReasons } from "./LockReasons";
import { RouteIcon } from "./RouteIcon";

export const routeLabels = {
	flea: "Flea",
	trader: "Trader",
	barter: "Barter",
	craft: "Craft",
	sell: "Sell value",
	empty: "Empty value",
} as const;

export type RouteOptionSource = Pick<LockedAcquisitionAlternative, "method" | "sourceId" | "traderOffer"> & {
	/** Present on locked routes. */
	lockReasons?: readonly LockReason[];
};

/** Trader or station providing a route, with the trader loyalty or station level it requires. */
export function routeSource(route: RouteOptionSource, context: RouteContext) {
	if (route.method === "trader")
		return {
			name: route.traderOffer && context.tradersById[route.traderOffer.traderId]?.name,
			level: route.traderOffer?.minTraderLevel,
		};
	if (route.method === "barter") {
		const barter = context.bartersById[route.sourceId ?? ""];
		return { name: context.tradersById[barter?.traderId ?? ""]?.name, level: barter?.minTraderLevel };
	}
	if (route.method === "craft") {
		const craft = context.craftsById[route.sourceId ?? ""];
		return { name: context.stationsById[craft?.stationId ?? ""]?.name, level: craft?.level };
	}
	return { name: undefined, level: undefined };
}

/** One acquisition route row: method, item, source, lock reasons and unit price. */
export function AcquisitionRouteOption({
	route,
	unitPrice,
	priceTitle,
	item,
	routeContext,
	selected,
	best,
	onSelect,
	trailing,
	expanded,
}: {
	route: RouteOptionSource;
	unitPrice: number | null;
	priceTitle?: string;
	item?: ItemSummary;
	routeContext: RouteContext;
	selected: boolean;
	best: boolean;
	onSelect: () => void;
	/** Extra column after the price, e.g. a disclosure chevron. */
	trailing?: ReactNode;
	/** Set when the row toggles a route list rather than choosing a route. */
	expanded?: boolean;
}) {
	const locked = route.lockReasons !== undefined;
	const source = routeSource(route, routeContext);
	return (
		<span
			className={`block cursor-pointer rounded border transition-colors hover:bg-highlight/[0.07] ${locked ? "border-danger/35" : "border-transparent"} ${selected ? "bg-brand/10" : ""}`}
			onClick={(event) => {
				if ((event.target as Element).closest("a, button")) return;
				onSelect();
			}}
		>
			{best && (
				<span className="mb-1 flex items-center gap-1 px-1.5 pt-1 text-[9px] font-bold uppercase tracking-wide text-warning">
					<Crown aria-hidden="true" className="size-3" />
					Best
				</span>
			)}
			{locked && <LockReasons reasons={route.lockReasons ?? []} />}
			<button
				type="button"
				aria-expanded={expanded}
				aria-pressed={expanded === undefined ? selected : undefined}
				onClick={(event) => {
					event.preventDefault();
					event.stopPropagation();
					onSelect();
				}}
				className={`grid w-full items-center gap-2 rounded px-2 py-1 text-left outline-none focus-visible:ring-1 focus-visible:ring-brand ${trailing ? "grid-cols-[18px_64px_30px_minmax(0,1fr)_auto_16px]" : "grid-cols-[18px_64px_30px_minmax(0,1fr)_auto]"}`}
			>
				<RouteIcon
					method={route.method}
					inline
					title={locked ? `${routeLabels[route.method]} locked` : routeLabels[route.method]}
				/>
				<span className="text-[9px] font-bold uppercase text-foreground">{routeLabels[route.method]}</span>
				{item?.iconLink ? (
					<Image src={item.iconLink} alt="" width={28} height={28} className="size-7 object-contain" unoptimized />
				) : (
					<span className="size-7" />
				)}
				<span className="min-w-0">
					<span className="block truncate text-[10px] text-foreground">
						{item?.shortName ?? item?.name ?? "Unknown item"}
					</span>
					{(source.name || source.level !== undefined) && (
						<span className="flex gap-1 text-[9px] leading-tight text-muted-foreground">
							<span className="truncate">{source.name ?? "Unknown source"}</span>
							{source.level !== undefined && (
								<span className="shrink-0">
									{route.method === "craft" ? `lvl ${source.level}` : `LL${source.level}`}
								</span>
							)}
						</span>
					)}
				</span>
				<span className="font-mono text-[10px] text-brand" title={priceTitle}>
					{formatCompactPrice(unitPrice)}
				</span>
				{trailing}
			</button>
		</span>
	);
}
