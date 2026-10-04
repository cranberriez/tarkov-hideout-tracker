"use client";

import { ItemLink } from "@/components/entities/item-link";
import type { ItemSummary } from "@/types/items";
import { Bolt, BookOpen } from "lucide-react";
import { formatNumber } from "@/lib/utils/format-number";
import type { ItemSize } from "@/lib/stores/useUserStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { computeNeeds } from "@/lib/utils/item-needs";
import { describeFleaPrice, formatFleaPriceState } from "@/lib/utils/market-price";
import { itemImageUrl } from "@/lib/utils/item-images";

interface ItemRowProps {
	item: ItemSummary;
	count: number;
	firCount?: number;
	size: ItemSize;
	isHideout?: boolean;
	isQuest?: boolean;
}

function SourceBadges({ isHideout, isQuest, size }: { isHideout: boolean; isQuest: boolean; size: number }) {
	if (!isHideout && !isQuest) return null;
	return (
		<div className="flex flex-col items-center gap-1 m-0.5 shrink-0">
			{isHideout && (
				<span title="Required for hideout">
					<Bolt size={size} className="text-muted-foreground" />
				</span>
			)}
			{isQuest && (
				<span title="Required for quests">
					<BookOpen size={size} className="text-warning" />
				</span>
			)}
		</div>
	);
}

export function ItemRow({ item, count, firCount = 0, size, isHideout = false, isQuest = false }: ItemRowProps) {
	const itemCounts = useUserStore((state) => state.itemCounts);
	const owned = itemCounts[item.id] ?? { have: 0, haveFir: 0 };
	const priceState = describeFleaPrice(item);

	// Helper to determine if an item is a currency for display purposes
	const isCurrency =
		item.normalizedName === "roubles" || item.normalizedName === "dollars" || item.normalizedName === "euros";

	const needs = computeNeeds({
		totalRequired: count,
		requiredFir: firCount,
		haveNonFir: isCurrency ? 0 : owned.have,
		haveFir: isCurrency ? 0 : owned.haveFir,
	});

	const firRequired = firCount ?? 0;
	const nonFirRequired = Math.max(0, count - firRequired);
	const isAllFir = firRequired > 0 && nonFirRequired === 0;

	const firSurplus = Math.max(0, owned.haveFir - firRequired);
	const effectiveNonFirHave = owned.have + firSurplus;

	const isCompactLike = size === "Icon" || size === "Compact";
	const isIconOnly = size === "Icon";
	const formattedCompactCount = isIconOnly ? formatNumber(count) : new Intl.NumberFormat("en-US").format(count);

	if (isCompactLike) {
		return (
			<ItemLink
				item={item}
				preview={false}
				aria-label={isIconOnly ? item.name : undefined}
				className="flex items-center gap-3 bg-card border p-2 rounded hover:bg-shadow/40 hover:border-info transition-colors relative group focus-visible:outline-2 focus-visible:outline-brand"
			>
				<div className="w-10 h-10 bg-shadow/40 flex items-center justify-center shrink-0 overflow-hidden relative">
					<img src={itemImageUrl(item)} alt={item.name} className="w-full h-full object-contain" />
				</div>

				<div className="flex-1 min-w-0">
					<div className="flex items-baseline justify-between">
						{!isIconOnly && (
							<span className="flex-1 text-sm font-medium text-foreground text-wrap mr-2" title={item.name}>
								{item.name}
							</span>
						)}
						<div className="flex whitespace-nowrap items-end line-clamp-1 gap-0.5 text-[12px] font-mono">
							{isCurrency ? (
								<span className="text-brand">{formattedCompactCount}</span>
							) : isAllFir ? (
								<span className={needs.isSatisfied ? "text-success" : "text-fir"}>
									FiR {formatNumber(owned.haveFir)}
									<span className="text-muted-foreground mx-[2px]">/</span>
									{formatNumber(firRequired)}
								</span>
							) : firRequired > 0 && nonFirRequired > 0 ? (
								<div className="flex flex-col items-end leading-tight">
									<span className={needs.isSatisfied ? "text-success" : "text-brand"}>
										{formatNumber(effectiveNonFirHave)}
										<span className="text-muted-foreground mx-[2px]">/</span>
										{formatNumber(nonFirRequired)}
									</span>
									<span className={needs.isSatisfied ? "text-success" : "text-fir"}>
										FiR {formatNumber(owned.haveFir)}
										<span className="text-muted-foreground mx-[2px]">/</span>
										{formatNumber(firRequired)}
									</span>
								</div>
							) : (
								<span className={needs.isSatisfied ? "text-success" : "text-brand"}>
									{formatNumber(effectiveNonFirHave)}
									<span className="text-muted-foreground mx-[2px]">/</span>
									{formatNumber(nonFirRequired || firRequired || count)}
								</span>
							)}
						</div>
					</div>
				</div>

				<SourceBadges isHideout={isHideout} isQuest={isQuest} size={11} />

				<div className="absolute top-0 right-0 rounded-xs h-full w-full opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-bl from-info/15 to-transparent z-0" />
			</ItemLink>
		);
	}

	// Large (Grid) View
	return (
		<ItemLink
			item={item}
			preview={false}
			className="bg-card border rounded-lg p-3 group/item transition-colors flex flex-col gap-3 h-full relative hover:border-info focus-visible:outline-2 focus-visible:outline-brand"
		>
			{/* Header: Icon & Name */}
			<div className="flex items-start gap-3 min-w-0 z-1">
				<div className="w-12 h-12 bg-shadow/40 flex items-center justify-center shrink-0 overflow-hidden relative">
					<img src={itemImageUrl(item)} alt={item.name} className="w-full h-full object-contain" />
				</div>

				<div className="min-w-0 flex-1">
					<div className="flex items-start justify-between gap-1">
						<h3 className="text-sm font-bold text-foreground leading-tight line-clamp-2" title={item.name}>
							{item.name}
						</h3>
						<SourceBadges isHideout={isHideout} isQuest={isQuest} size={12} />
					</div>
					{/* <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground font-mono">
                        {isCurrency ? (
                            <>
                                <span className="uppercase tracking-wide">Required</span>
                                <span className="text-brand">x{formatNumber(count)}</span>
                            </>
                        ) : isAllFir ? (
                            <>
                                <span className="uppercase tracking-wide">FiR</span>
                                <span className={needs.isSatisfied ? "text-success" : "text-warning"}>
                                    {formatNumber(needs.haveFirReserved)} / {formatNumber(needs.requiredFir)}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="uppercase tracking-wide">Have</span>
                                <span className="text-brand">
                                    {formatNumber(needs.effectiveHave)}
                                    {needs.haveFirReserved > 0 && (
                                        <span className="text-warning">
                                            {` (${formatNumber(needs.haveFirReserved)})`}
                                        </span>
                                    )}
                                    {` / ${formatNumber(needs.totalRequired)}`}
                                </span>
                            </>
                        )}
                    </div> */}
				</div>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 gap-2 mt-auto z-1">
				{/* Required */}
				<div className="bg-shadow/30 p-1.5 rounded">
					<div className="text-[10px] text-subtle-foreground uppercase tracking-wide mb-0.5">Required</div>
					<div className="flex flex-col gap-0.5 text-[11px] font-mono">
						{isCurrency ? (
							<div className="flex items-baseline justify-between">
								<span className="text-brand">{count.toLocaleString()}</span>
							</div>
						) : isAllFir ? (
							<div className="flex items-baseline justify-between">
								<span className={needs.isSatisfied ? "text-success" : "text-fir"}>
									{formatNumber(owned.haveFir)}
									<span className="text-muted-foreground mx-[2px]">/</span>
									{formatNumber(firRequired)}
								</span>
							</div>
						) : firRequired > 0 && nonFirRequired > 0 ? (
							<>
								<div className="flex items-baseline justify-between">
									<span className={needs.isSatisfied ? "text-success" : "text-brand"}>
										{formatNumber(effectiveNonFirHave)}
										<span className="text-muted-foreground mx-[2px]">/</span>
										{formatNumber(nonFirRequired)}
									</span>
								</div>
								<div className="flex items-baseline justify-between">
									<span className={needs.isSatisfied ? "text-success" : "text-fir"}>
										FiR {formatNumber(owned.haveFir)}
										<span className="text-muted-foreground mx-[2px]">/</span>
										{formatNumber(firRequired)}
									</span>
								</div>
							</>
						) : (
							<div className="flex items-baseline justify-between">
								<span className={needs.isSatisfied ? "text-success" : "text-brand"}>
									{formatNumber(effectiveNonFirHave)}
									<span className="text-muted-foreground mx-[2px]">/</span>
									{formatNumber(nonFirRequired || count)}
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Est Cost */}
				{!isCurrency && (
					<div className="bg-shadow/30 p-1.5 rounded">
						<div className="text-[10px] text-subtle-foreground uppercase tracking-wide mb-0.5">Est. Cost</div>
						<div className="text-sm font-medium text-foreground leading-tight">
							{priceState.kind === "price" ? (
								formatFleaPriceState(priceState, { count: needs.neededNonFir })
							) : (
								<span className="text-subtle-foreground">{formatFleaPriceState(priceState)}</span>
							)}
						</div>
					</div>
				)}
			</div>
			{/* <div className="opacity-0 h-full w-full group-hover/item:opacity-100 bg-linear-to-br from-bg-card to-highlight/5 transition-opacity absolute top-0 left-0 z-0 rounded-lg" /> */}
			<div className="absolute top-0 right-0 rounded-md h-full w-full opacity-0 group-hover/item:opacity-100 transition-all bg-linear-to-bl from-info/15 to-transparent z-0" />
		</ItemLink>
	);
}
