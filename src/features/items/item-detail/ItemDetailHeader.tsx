"use client";

import type { ItemDetails } from "@/types";
import type { NeedBreakdown } from "@/lib/utils/item-needs";
import type { MarketPrice } from "@/types";
import { ExternalLink } from "lucide-react";

interface ItemDetailHeaderProps {
    item: ItemDetails;
    marketPrice: MarketPrice | null | undefined;
    totalCount: number;
    owned: { have: number; haveFir: number };
    needsBreakdown: NeedBreakdown | null;
}

export function ItemDetailHeader({
    item,
    marketPrice,
    totalCount,
    owned,
    needsBreakdown,
}: ItemDetailHeaderProps) {
    return (
        <div className="flex flex-col sm:items-start gap-3 flex-1 min-w-0">
            <div className="flex items-start gap-3">
                <div className="w-14 h-14 sm:w-20 sm:h-20 bg-card border border-border-color flex items-center justify-center shrink-0 overflow-hidden relative rounded-sm">
                    {item.iconLink || item.gridImageLink ? (
                        <img
                            src={item.iconLink || item.gridImageLink}
                            alt={item.name}
                            className="w-full h-full object-contain p-1.5"
                        />
                    ) : (
                        <div className="text-2xl text-muted-foreground">?</div>
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl font-bold text-foreground mb-1">
                        {item.name}
                    </h2>
                    <span className="inline-flex items-center text-muted-foreground bg-card border border-border-color px-1.5 py-0.5 rounded-sm text-[11px] mb-1.5">
                        {item.category?.name || "Item"}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {item.wikiLink && (
                            <a
                                href={item.wikiLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline hover:text-tarkov-green flex items-center gap-1 transition-colors"
                            >
                                Wiki <ExternalLink size={10} />
                            </a>
                        )}
                        {item.link && (
                            <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline hover:text-tarkov-green flex items-center gap-1 transition-colors"
                            >
                                Tarkov.dev <ExternalLink size={10} />
                            </a>
                        )}
                        {marketPrice?.link && (
                            <a
                                href={marketPrice.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="hover:underline hover:text-tarkov-green flex items-center gap-1 transition-colors"
                            >
                                Tarkov Market <ExternalLink size={10} />
                            </a>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm">
                <div className="flex items-center gap-2 bg-card px-2.5 py-1 rounded-md border border-border-color shadow-sm">
                    <span className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Total</span>
                    <span className="font-mono font-bold text-foreground text-base">x{totalCount}</span>
                </div>
                {needsBreakdown && (
                    <>
                        <div className="flex items-center gap-2 bg-card px-2.5 py-1 rounded-md border border-border-color shadow-sm">
                            <span className="text-muted-foreground font-medium text-xs uppercase tracking-wider">Non-FiR</span>
                            <span className="font-mono font-bold text-tarkov-green text-base">
                                {needsBreakdown.neededNonFir}
                            </span>
                            <span className="text-muted-foreground text-[10px] ml-0.5">(have {owned.have})</span>
                        </div>
                        <div className="flex items-center gap-2 bg-card px-2.5 py-1 rounded-md border border-border-color shadow-sm">
                            <span className="text-muted-foreground font-medium text-xs uppercase tracking-wider">FiR</span>
                            <span className="font-mono font-bold text-orange-500 text-base">
                                {needsBreakdown.neededFir}
                            </span>
                            <span className="text-muted-foreground text-[10px] ml-0.5">(have {owned.haveFir})</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
