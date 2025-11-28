"use client";

import { ItemDetails } from "@/types";
import { ChevronRight } from "lucide-react";
import { usePriceStore } from "@/lib/stores/usePriceStore";
import { formatNumber } from "@/lib/utils/format-number";
import type { ItemSize } from "@/lib/stores/useUserStore";
import { useUserStore } from "@/lib/stores/useUserStore";
import { computeNeeds } from "@/lib/utils/item-needs";

interface ItemRowProps {
    item: ItemDetails;
    count: number;
    firCount?: number; // Optional FiR count
    size: ItemSize;
    sellToPreference?: "best" | "flea" | "trader";
    onClick?: () => void;
}

export function ItemRow({
    item,
    count,
    firCount = 0,
    size,
    sellToPreference = "best",
    onClick,
}: ItemRowProps) {
    const formatPrice = (price?: number) => {
        if (price === undefined) return "???";
        return new Intl.NumberFormat("en-US").format(price);
    };

    const { getPrice, loading } = usePriceStore();
    const { itemCounts } = useUserStore();
    const owned = itemCounts[item.id] ?? { have: 0, haveFir: 0 };
    const marketPrice = getPrice(item.normalizedName);
    const unitPrice = marketPrice?.avg24hPrice ?? marketPrice?.price;

    // Helper to determine if an item is a currency for display purposes
    const isCurrency =
        item.normalizedName === "roubles" ||
        item.normalizedName === "dollars" ||
        item.normalizedName === "euros";

    const needs = computeNeeds({
        totalRequired: count,
        requiredFir: firCount,
        haveNonFir: isCurrency ? 0 : owned.have,
        haveFir: isCurrency ? 0 : owned.haveFir,
    });

    // Calculate total estimated cost if we have price data
    const estimatedTotal = unitPrice ? unitPrice * needs.neededTotal : 0;

    const firRequired = firCount ?? 0;
    const nonFirRequired = Math.max(0, count - firRequired);
    const isAllFir = firRequired > 0 && nonFirRequired === 0;

    const isCompactLike = size === "Icon" || size === "Compact";
    const isIconOnly = size === "Icon";
    const formattedCompactCount = isIconOnly
        ? formatNumber(count)
        : new Intl.NumberFormat("en-US").format(count);

    if (isCompactLike) {
        return (
            <div
                className="flex items-center gap-3 bg-card border p-2 rounded hover:bg-black/40 hover:border-blue-400 transition-colors cursor-pointer relative group"
                onClick={onClick}
            >
                <div className="w-10 h-10 bg-black/40 flex items-center justify-center shrink-0 overflow-hidden relative">
                    {item.iconLink ? (
                        <img
                            src={item.iconLink}
                            alt={item.name}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="text-xs text-gray-600">?</div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between">
                        {!isIconOnly && (
                            <span
                                className="flex-1 text-sm font-medium text-gray-200 text-wrap mr-2"
                                title={item.name}
                            >
                                {item.name}
                            </span>
                        )}
                        <div className="flex whitespace-nowrap items-end line-clamp-1 gap-0.5 text-[12px] font-mono">
                            {isCurrency ? (
                                <span className="text-tarkov-green">x{formattedCompactCount}</span>
                            ) : isAllFir ? (
                                <span className="text-orange-400">
                                    FiR {formatNumber(owned.haveFir)}
                                    <span className="text-gray-400 mx-[2px]">/</span>
                                    {formatNumber(firRequired)}
                                </span>
                            ) : firRequired > 0 && nonFirRequired > 0 ? (
                                <div className="flex flex-col items-end leading-tight">
                                    <span className="text-tarkov-green">
                                        {formatNumber(owned.have)}
                                        <span className="text-gray-400 mx-[2px]">/</span>
                                        {formatNumber(nonFirRequired)}
                                    </span>
                                    <span className="text-orange-400">
                                        FiR {formatNumber(owned.haveFir)}
                                        <span className="text-gray-400 mx-[2px]">/</span>
                                        {formatNumber(firRequired)}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-tarkov-green">
                                    {formatNumber(owned.have)}
                                    <span className="text-gray-400 mx-[2px]">/</span>
                                    {formatNumber(nonFirRequired || firRequired || count)}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="absolute top-0 right-0 rounded-xs h-full w-full p-1 opacity-0 group-hover:opacity-100 transition-all bg-gradient-to-bl from-blue-400/15 to-transparent z-0">
                    <div className="flex items-start justify-end rounded-full h-full w-full">
                        <ChevronRight size={16} className="text-blue-100"/>
                    </div>
                </div>
            </div>
        );
    }

    // Large (Grid) View
    return (
        <div
            className="bg-card border rounded-lg p-3 group/item transition-colors flex flex-col gap-3 h-full cursor-pointer relative hover:border-blue-400"
            onClick={onClick}
        >
            {/* Header: Icon & Name */}
            <div className="flex items-start gap-3 min-w-0 z-1">
                <div className="w-12 h-12 bg-black/40 flex items-center justify-center shrink-0 overflow-hidden relative">
                    {item.iconLink ? (
                        <img
                            src={item.iconLink}
                            alt={item.name}
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <div className="text-gray-600 text-xs">?</div>
                    )}
                </div>

                <div className="min-w-0 flex-1">
                    <h3
                        className="text-sm font-bold text-gray-100 leading-tight line-clamp-2"
                        title={item.name}
                    >
                        {item.name}
                    </h3>
                    {/* <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 font-mono">
                        {isCurrency ? (
                            <>
                                <span className="uppercase tracking-wide">Required</span>
                                <span className="text-tarkov-green">x{formatNumber(count)}</span>
                            </>
                        ) : isAllFir ? (
                            <>
                                <span className="uppercase tracking-wide">FiR</span>
                                <span className="text-orange-400">
                                    {formatNumber(needs.haveFirReserved)} / {formatNumber(needs.requiredFir)}
                                </span>
                            </>
                        ) : (
                            <>
                                <span className="uppercase tracking-wide">Have</span>
                                <span className="text-tarkov-green">
                                    {formatNumber(needs.effectiveHave)}
                                    {needs.haveFirReserved > 0 && (
                                        <span className="text-orange-400">
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
            <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-white/5 z-1">
                {/* Required */}
                <div className="bg-black/30 p-1.5 rounded">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                        Required
                    </div>
                    <div className="flex flex-col gap-0.5 text-[11px] font-mono">
                        {isCurrency ? (
                            <div className="flex items-baseline justify-between">
                                <span className="text-tarkov-green">{count.toLocaleString()}</span>
                            </div>
                        ) : isAllFir ? (
                            <div className="flex items-baseline justify-between">
                                <span className="text-orange-400">
                                    {formatNumber(owned.haveFir)}
                                    <span className="text-gray-400 mx-[2px]">/</span>
                                    {formatNumber(firRequired)}
                                </span>
                            </div>
                        ) : firRequired > 0 && nonFirRequired > 0 ? (
                            <>
                                <div className="flex items-baseline justify-between">
                                    <span className="text-tarkov-green">
                                        {formatNumber(owned.have)}
                                        <span className="text-gray-400 mx-[2px]">/</span>
                                        {formatNumber(nonFirRequired)}
                                    </span>
                                </div>
                                <div className="flex items-baseline justify-between">
                                    <span className="text-orange-400">
                                        FiR {formatNumber(owned.haveFir)}
                                        <span className="text-gray-400 mx-[2px]">/</span>
                                        {formatNumber(firRequired)}
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="flex items-baseline justify-between">
                                <span className="text-tarkov-green">
                                    {formatNumber(owned.have)}
                                    <span className="text-gray-400 mx-[2px]">/</span>
                                    {formatNumber(nonFirRequired || count)}
                                </span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Est Cost */}
                {!isCurrency && (
                    <div className="bg-black/30 p-1.5 rounded">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                            Est. Cost
                        </div>
                        <div className="text-sm font-medium text-gray-300 leading-tight">
                            {loading && !marketPrice && <span className="text-gray-500">...</span>}
                            {!loading && marketPrice === null && (
                                <span className="text-gray-500">-</span>
                            )}
                            {!loading && marketPrice && unitPrice !== undefined && (
                                <>
                                    {formatPrice(estimatedTotal)}
                                    <span className="text-[12px] text-gray-500 ml-0.5">₽</span>
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>
            {/* <div className="opacity-0 h-full w-full group-hover/item:opacity-100 bg-linear-to-br from-bg-card to-white/5 transition-opacity absolute top-0 left-0 z-0 rounded-lg" /> */}
            <div className="absolute top-0 right-0 rounded-md h-full w-full p-1 opacity-0 group-hover/item:opacity-100 transition-all bg-gradient-to-bl from-blue-400/15 to-transparent z-0">
                <div className="flex items-start justify-end rounded-full h-full w-full">
                    <ChevronRight size={16} className="text-blue-100"/>
                </div>
            </div>
        </div>
    );
}
