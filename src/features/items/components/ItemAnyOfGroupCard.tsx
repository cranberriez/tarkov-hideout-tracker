"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { ItemSize } from "@/lib/stores/useUserStore";
import type { ItemDetails } from "@/types";
import type { DerivedQuestAnyOfGroup } from "@/lib/utils/quest-item-index";
import { cn } from "@/lib/utils";

interface ItemAnyOfGroupCardProps {
    group: DerivedQuestAnyOfGroup;
    expanded: boolean;
    size: ItemSize;
    onToggleExpanded: () => void;
    onClickItem: (item: ItemDetails) => void;
}

export function ItemAnyOfGroupCard({
    group,
    expanded,
    size,
    onToggleExpanded,
    onClickItem,
}: ItemAnyOfGroupCardProps) {
    const previewItems = useMemo(() => group.items.slice(0, 3), [group.items]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const isIconMode = size === "Icon";
    const showCompactHeader = isIconMode && !expanded;
    const isFirRequired = group.requiredFirCount > 0;

    useEffect(() => {
        if (previewItems.length <= 1 || expanded) return;
        const interval = window.setInterval(() => {
            setPreviewIndex((current) => (current + 1) % previewItems.length);
        }, 1600);
        return () => window.clearInterval(interval);
    }, [expanded, previewItems.length]);

    return (
        <div
            className={cn(
                "rounded-lg border bg-card p-3 transition-colors",
                expanded ? "col-span-full border-blue-400/40" : "hover:border-blue-400",
            )}
        >
            <button
                type="button"
                onClick={onToggleExpanded}
                className={cn(
                    "flex w-full items-start gap-3 text-left",
                    showCompactHeader ? "" : "gap-2.5",
                )}
            >
                <div className="flex shrink-0 flex-col items-center gap-1.5">
                    <div
                        className={cn(
                            "relative flex items-center justify-center",
                            showCompactHeader ? "h-12 w-16" : "h-10 w-14",
                        )}
                    >
                        {previewItems.map((item, index) => {
                            const isActive = expanded ? true : index === previewIndex;
                            const layerClass = isActive
                                ? "z-40"
                                : index === 0
                                  ? "z-10"
                                  : index === 1
                                    ? "z-20"
                                    : "z-30";
                            return (
                                <div
                                    key={item.id}
                                    className={cn(
                                        "absolute flex items-center justify-center rounded border bg-black/40 transition-all duration-300",
                                        isFirRequired ? "border-orange-400/35" : "border-white/10",
                                        showCompactHeader ? "h-12 w-12" : "h-10 w-10",
                                        layerClass,
                                        index === 0 && "-translate-x-2 rotate-[-4deg]",
                                        index === 1 && "translate-x-0",
                                        index === 2 && "translate-x-2 rotate-[4deg]",
                                        isActive ? "opacity-100" : "opacity-35",
                                    )}
                                >
                                    {item.iconLink || item.gridImageLink ? (
                                        <img
                                            src={item.iconLink ?? item.gridImageLink ?? ""}
                                            alt={item.name}
                                            className={cn(
                                                "object-contain rounded-xs",
                                                showCompactHeader ? "h-11 w-11" : "h-9 w-9",
                                            )}
                                        />
                                    ) : (
                                        <span className="text-xs text-gray-600">?</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                            {!showCompactHeader && (
                                <h3 className="text-sm leading-tight font-bold text-balance text-gray-100">
                                    {group.objectiveLabel}
                                </h3>
                            )}
                        </div>
                        <span className="shrink-0 text-gray-500">
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </span>
                    </div>

                    {!showCompactHeader && (
                        <p className="mt-2 text-xs text-gray-500 text-pretty">{group.questName}</p>
                    )}

                    {showCompactHeader && (
                        <div className="mt-2 flex items-center gap-2 text-xs font-medium">
                            <span className="text-gray-200 tabular-nums">
                                {group.requiredCount}x
                            </span>
                            {isFirRequired && <span className="text-orange-400">FiR</span>}
                        </div>
                    )}
                </div>
            </button>

            {expanded && (
                <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-gray-400">
                            <span className="text-gray-200">{group.objectiveLabel}</span>
                            {" for "}
                            <span className="text-gray-200">{group.questName}</span>
                        </div>
                        <Link
                            href={`/quests#quest-${group.questId}`}
                            className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-tarkov-green"
                        >
                            Quest Link <ExternalLink size={12} />
                        </Link>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {group.items.map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() =>
                                    onClickItem({
                                        id: item.id,
                                        name: item.name,
                                        normalizedName: item.normalizedName,
                                        iconLink: item.iconLink,
                                        gridImageLink: item.gridImageLink,
                                    })
                                }
                                className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 p-2 text-left transition-colors hover:border-blue-400"
                            >
                                <div
                                    className={cn(
                                        "flex h-10 w-10 shrink-0 items-center justify-center rounded border bg-black/40",
                                        isFirRequired ? "border-orange-400/35" : "border-white/10",
                                    )}
                                >
                                    {item.iconLink || item.gridImageLink ? (
                                        <img
                                            src={item.iconLink ?? item.gridImageLink ?? ""}
                                            alt={item.name}
                                            className="h-8 w-8 object-contain"
                                        />
                                    ) : (
                                        <span className="text-xs text-gray-600">?</span>
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="truncate text-sm text-gray-100">
                                        {item.name}
                                    </div>
                                    <div className="text-[11px] text-gray-500">
                                        {item.normalizedName}
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
