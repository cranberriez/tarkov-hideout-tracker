import Image from "next/image";
import { Clock3 } from "lucide-react";
import { ItemImage } from "@/components/entities/item-image";
import type { RecipePreviewData, RouteContext } from "../types";
import { formatDuration, formatQuantity, formatRoundedRoubles } from "../utils/formatters";
import { RouteIcon, routeChipClasses } from "./RouteIcon";

export function RecipePreviewCard({
	preview,
	routeContext,
}: {
	preview: RecipePreviewData;
	routeContext: RouteContext;
}) {
	const barter = preview.kind === "barter" ? routeContext.bartersById[preview.sourceId] : undefined;
	const craft = preview.kind === "craft" ? routeContext.craftsById[preview.sourceId] : undefined;
	const source = barter
		? routeContext.tradersById[barter.traderId]
		: craft
			? routeContext.stationsById[craft.stationId]
			: undefined;
	const totalCost = preview.requiredItems.reduce<number | null>(
		(total, requirement) =>
			requirement.isTool
				? total
				: total === null || requirement.totalCost === null
					? null
					: total + requirement.totalCost,
		0,
	);
	return (
		<span className="block min-w-0 flex-1 border-l border-highlight/10">
			<span className="flex items-center gap-2 border-b border-highlight/10 bg-highlight/[0.035] py-2 pl-3 pr-8">
				<RouteIcon method={preview.kind} preview filled />
				{source?.imageLink && (
					<Image
						src={source.imageLink}
						alt=""
						width={30}
						height={30}
						className="size-8 rounded object-contain"
						unoptimized
					/>
				)}
				<span className="min-w-0 truncate text-xs font-semibold text-foreground">
					{source?.name ?? (preview.kind === "craft" ? "Unknown station" : "Unknown trader")}
					{barter ? ` · LL${barter.minTraderLevel}` : craft ? ` · Level ${craft.level}` : ""}
					{preview.batches > 1 && (
						<span className="font-normal text-muted-foreground"> · {preview.batches} batches</span>
					)}
				</span>
			</span>
			<span className="block px-2.5 pt-2.5">
				<span className="block">
					{preview.requiredItems.map((requirement, index) => {
						const item = routeContext.itemById[requirement.itemId];
						return (
							<span
								key={`${requirement.itemId}:${requirement.isTool === true}:${index}`}
								className="flex h-9 items-center gap-2 border-t border-highlight/5 first:border-t-0"
							>
								{item ? (
									<ItemImage item={item} size={32} className="size-8 shrink-0 object-contain" />
								) : (
									<span className="size-8 shrink-0" />
								)}
								<span className="min-w-0 flex-1 truncate text-xs text-foreground" title={item?.name}>
									{item?.shortName ?? item?.name ?? "Unknown item"}
								</span>
								<span className="font-mono text-[11px] text-muted-foreground">
									×{formatQuantity(requirement.quantity)}
								</span>
								<span
									className={`rounded px-1 py-0.5 text-[9px] font-bold uppercase ${routeChipClasses(requirement.method)}`}
								>
									{requirement.method === "empty"
										? "Empty value"
										: requirement.method === "trader"
											? "Trader"
											: requirement.method}
								</span>
								{requirement.isTool ? (
									<span className="w-16 text-right text-[11px] text-muted-foreground">Tool</span>
								) : (
									<span className="w-16 text-right font-mono text-[11px] text-foreground">
										{formatRoundedRoubles(requirement.totalCost)}
									</span>
								)}
							</span>
						);
					})}
					<span className="flex items-center justify-between border-t border-highlight/10 py-1.5 font-mono text-[11px]">
						{preview.kind === "craft" && preview.durationSeconds > 0 ? (
							<span className="flex items-center gap-1 text-foreground">
								<Clock3 aria-hidden className="size-3 text-muted-foreground" />
								{formatDuration(preview.durationSeconds)}
							</span>
						) : (
							<span />
						)}
						<span className="font-semibold text-foreground">Total {formatRoundedRoubles(totalCost)}</span>
					</span>
				</span>
			</span>
		</span>
	);
}
