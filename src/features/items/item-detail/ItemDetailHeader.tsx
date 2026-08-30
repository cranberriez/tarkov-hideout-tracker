"use client";

import type { ItemDetails } from "@/types";
import type { NeedBreakdown } from "@/lib/utils/item-needs";
import { ExternalLink, PackageOpen } from "lucide-react";

interface ItemDetailHeaderProps {
    item: ItemDetails;
    totalRequiredCount: number;
    needsBreakdown: NeedBreakdown | null;
    hideoutRequiredCount: number;
    questRequiredCount: number;
}

export function ItemDetailHeader({
    item,
    totalRequiredCount,
    needsBreakdown,
    hideoutRequiredCount,
    questRequiredCount,
}: ItemDetailHeaderProps) {
    const imageLink =
        item.image512pxLink ?? item.gridImageLink ?? item.iconLink ?? item.baseImageLink;
    const categoryLabel =
        item.category?.normalizedName !== "item"
            ? item.category?.name.replace(/\s+item$/i, "")
            : null;

    return (
        <div className="flex min-w-0 flex-1 flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-color bg-black/30 shadow-inner sm:h-20 sm:w-20">
                    {imageLink ? (
                        <img
                            src={imageLink}
                            alt={item.name}
                            className="h-full w-full object-contain p-2"
                        />
                    ) : (
                        <PackageOpen className="h-7 w-7 text-muted-foreground" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    {categoryLabel && (
                        <div className="mb-1.5 flex flex-wrap gap-1.5">
                            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-tarkov-green-dim">
                                {categoryLabel}
                            </span>
                        </div>
                    )}
                    <h2 className="text-xl font-semibold leading-tight text-foreground">
                        {item.name}
                    </h2>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        {item.wikiLink && (
                            <a
                                href={item.wikiLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 transition-colors hover:text-tarkov-green"
                            >
                                Wiki <ExternalLink size={10} />
                            </a>
                        )}
                        {item.link && (
                            <a
                                href={item.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 transition-colors hover:text-tarkov-green"
                            >
                                Tarkov.dev <ExternalLink size={10} />
                            </a>
                        )}
                    </div>
                </div>
            </div>
            {totalRequiredCount > 0 && (
                <div className="grid w-full auto-cols-fr grid-flow-col overflow-hidden rounded-lg border border-border-color bg-black/20 lg:w-auto lg:min-w-[500px]">
                    <SummaryValue label="Required" value={totalRequiredCount} />
                    <SummaryValue
                        label="Need"
                        value={needsBreakdown?.neededNonFir ?? 0}
                        accent="green"
                    />
                    <SummaryValue
                        label="Need FiR"
                        value={needsBreakdown?.neededFir ?? 0}
                        accent="orange"
                    />
                    {hideoutRequiredCount > 0 && (
                        <SummaryValue label="Hideout" value={hideoutRequiredCount} />
                    )}
                    {questRequiredCount > 0 && (
                        <SummaryValue label="Quests" value={questRequiredCount} />
                    )}
                </div>
            )}
        </div>
    );
}

function SummaryValue({
    label,
    value,
    accent,
}: {
    label: string;
    value: number;
    accent?: "green" | "orange";
}) {
    return (
        <div className="border-r border-border-color px-3 py-2.5 last:border-r-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {label}
            </div>
            <div
                className={`mt-0.5 font-mono text-base font-semibold ${
                    accent === "green"
                        ? "text-tarkov-green"
                        : accent === "orange"
                          ? "text-orange-400"
                          : "text-foreground"
                }`}
            >
                {value}
            </div>
        </div>
    );
}
