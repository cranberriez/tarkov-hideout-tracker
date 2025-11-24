"use client";

import { ItemDetails } from "@/app/types";
import { ExternalLink, ShoppingCart } from "lucide-react";

interface ItemRowProps {
    item: ItemDetails;
    count: number;
    firCount?: number; // Optional FiR count
    compact: boolean;
    sellToPreference?: "best" | "flea" | "trader";
}

export function ItemRow({
    item,
    count,
    firCount = 0,
    compact,
    sellToPreference = "best",
}: ItemRowProps) {
    const formatPrice = (price?: number) => {
        if (price === undefined) return "???";
        return new Intl.NumberFormat("en-US").format(price);
    };

    // Helper to determine if an item is a currency for display purposes
    const isCurrency =
        item.normalizedName === "roubles" ||
        item.normalizedName === "dollars" ||
        item.normalizedName === "euros";

    // Calculate total estimated cost if we have price data
    const estimatedTotal = item.avg24hPrice ? item.avg24hPrice * count : 0;

    // Find best sell-to trader based on preference
    const getBestSell = () => {
        if (!item.sellFor || item.sellFor.length === 0) return undefined;

        let candidates = item.sellFor;

        // Filter based on preference
        if (sellToPreference === "flea") {
            candidates = item.sellFor.filter((s) => s.vendor.normalizedName === "flea-market");
        } else if (sellToPreference === "trader") {
            candidates = item.sellFor.filter((s) => s.vendor.normalizedName !== "flea-market");
        }
        // If "best", we consider all candidates (default behavior)

        // Fallback: if specific preference yields no results (e.g. no flea listing),
        // we might want to show nothing or fallback to best?
        // Requirement says "switch between flea, trader, and Best price".
        // If I select Flea and there is no Flea price, it should probably show nothing or N/A.
        if (candidates.length === 0) return undefined;

        // Find max priceRUB among candidates
        return candidates.reduce((prev, current) => {
            return prev.priceRUB > current.priceRUB ? prev : current;
        }, candidates[0]);
    };

    const bestSell = getBestSell();

    if (compact) {
        return (
            <div className="flex items-center gap-3 bg-black/20 border border-white/5 p-2 rounded hover:bg-black/40 transition-colors">
                <div className="w-10 h-10 bg-black/40  flex items-center justify-center shrink-0 overflow-hidden relative">
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
                        <span
                            className="text-sm font-medium text-gray-200 truncate mr-2"
                            title={item.name}
                        >
                            {item.name}
                        </span>
                        <div className="flex flex-col items-end">
                            <span className="text-sm font-bold text-tarkov-green shrink-0">
                                x{new Intl.NumberFormat("en-US").format(count)}
                            </span>
                            {firCount > 0 && (
                                <span className="text-[10px] text-orange-400">{firCount} FiR</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Large (Grid) View
    return (
        <div className="bg-black/20 border border-white/5 rounded-lg p-3 hover:bg-black/40 transition-colors flex flex-col gap-3 h-full">
            {/* Header: Icon & Name */}
            <div className="flex items-start gap-3 min-w-0">
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
                    <div className="flex items-center gap-2 mt-1">
                        <a
                            href={item.wikiLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] text-gray-500 hover:text-tarkov-green flex items-center gap-0.5"
                        >
                            Wiki <ExternalLink size={8} />
                        </a>
                        {item.link && (
                            <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-gray-500 hover:text-tarkov-green flex items-center gap-0.5"
                            >
                                Tarkov.dev <ExternalLink size={8} />
                            </a>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 gap-2 mt-auto pt-2 border-t border-white/5">
                {/* Required */}
                <div className="bg-black/30 p-1.5 rounded">
                    <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                        Required
                    </div>
                    <div className="text-lg font-bold text-tarkov-green leading-none">
                        x{new Intl.NumberFormat("en-US").format(count)}
                    </div>
                    {firCount > 0 && (
                        <div className="text-[10px] text-orange-400 mt-0.5">{firCount} FiR</div>
                    )}
                </div>

                {/* Est Cost */}
                {!isCurrency && item.avg24hPrice && (
                    <div className="bg-black/30 p-1.5 rounded">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                            Est. Cost
                        </div>
                        <div className="text-sm font-medium text-gray-300 leading-tight">
                            {formatPrice(estimatedTotal)}
                            <span className="text-[10px] text-gray-500 ml-0.5">₽</span>
                        </div>
                    </div>
                )}

                {/* Sell To (Full Width if present) */}
                {!isCurrency && bestSell && (
                    <div className="col-span-2 bg-black/30 p-1.5 rounded flex justify-between items-center">
                        <div className="text-[10px] text-gray-500 uppercase tracking-wide">
                            Sell To{" "}
                            <span className="text-gray-300 normal-case">
                                {bestSell.vendor.name}
                            </span>
                        </div>
                        <div className="text-xs text-gray-300 font-medium">
                            {bestSell.vendor.name == "Flea Market" && "~"}
                            {formatPrice(bestSell.price)} {bestSell.currency}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
