"use client";

import { Check } from "lucide-react";
import { ItemLink } from "@/components/entities/item-link";
import { ItemThumbnail } from "@/components/entities/item-thumbnail";
import { cn } from "@/lib/utils";
import { formatNumber } from "@/lib/utils/format-number";
import { formatCompactRoubles } from "@/lib/utils/market-price";
import type { ItemSummary } from "@/types/items";
import { isCurrencyItem } from "../../station-model";
import { remainingItemNeeds, unitCostRoubles, type RemainingItem } from "../station-details-model";

/** Aggregated station demand to max, checked against the whole inventory. */
export function RemainingItemsList({
	items,
	itemById,
	itemCounts,
}: {
	items: readonly RemainingItem[];
	itemById: Readonly<Record<string, ItemSummary>>;
	itemCounts: Readonly<Record<string, { have: number; haveFir: number }>>;
}) {
	const rows = items
		.flatMap((entry) => {
			const item = itemById[entry.itemId];
			if (!item) return [];
			const currency = isCurrencyItem(item);
			const needs = remainingItemNeeds(entry, item, itemCounts[entry.itemId]);
			const unit = unitCostRoubles(item);
			return [{ entry, item, currency, needs, cost: unit == null ? null : unit * needs.neededTotal }];
		})
		.sort((a, b) => Number(a.needs.isSatisfied && !a.currency) - Number(b.needs.isSatisfied && !b.currency));

	return (
		<ul className="flex flex-col gap-1.5">
			{rows.map(({ entry, item, currency, needs, cost }) => {
				const done = !currency && needs.isSatisfied;
				return (
					<li key={entry.itemId}>
						<ItemLink
							item={item}
							className={cn(
								"flex w-full items-center gap-3 rounded-sm p-1 transition-colors focus-visible:outline-2 focus-visible:outline-brand",
								done ? "opacity-60 hover:bg-shadow/20" : "bg-shadow/40 hover:bg-shadow/60",
							)}
						>
							<ItemThumbnail item={item} size="sm" foundInRaid={entry.firCount > 0} completed={done} />
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="truncate font-mono text-xs font-bold text-foreground">
									{item.shortName || item.name}
								</span>
								<span className="flex flex-wrap gap-x-2 font-mono text-[10px] text-muted-foreground">
									{currency ? (
										<span className="text-brand">{formatNumber(entry.count)}</span>
									) : (
										<span className={done ? "text-success" : "text-brand"}>
											{formatNumber(needs.effectiveHave)} / {formatNumber(entry.count)}
										</span>
									)}
									{entry.firCount > 0 && (
										<span className="text-warning">
											FiR {formatNumber(needs.haveFirReserved)} / {formatNumber(entry.firCount)}
										</span>
									)}
									{!done && !currency && (
										<span className="text-subtle-foreground">
											{cost == null ? "No price" : `${formatCompactRoubles(cost)} ₽ to buy`}
										</span>
									)}
								</span>
							</span>
							{done && <Check size={16} className="mr-1 shrink-0 text-success" aria-label="Covered" />}
						</ItemLink>
					</li>
				);
			})}
		</ul>
	);
}
