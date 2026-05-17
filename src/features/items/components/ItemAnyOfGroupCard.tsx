"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import type { ItemSize } from "@/lib/stores/useUserStore";
import type { ItemDetails } from "@/types";
import type { DerivedQuestAnyOfGroup } from "@/lib/utils/quest-item-index";
import { cn } from "@/lib/utils";

const MAX_PREVIEW_ITEMS = 3;

type AnyOfGroupItem = DerivedQuestAnyOfGroup["items"][number];

interface ItemAnyOfGroupCardProps {
    group: DerivedQuestAnyOfGroup;
    expanded: boolean;
    size: ItemSize;
    onToggleExpanded: () => void;
    onClickItem: (item: ItemDetails) => void;
}

interface ItemPreviewStackProps {
    items: AnyOfGroupItem[];
    previewIndex: number;
    expanded: boolean;
    isIconMode: boolean;
    isFirRequired: boolean;
}

interface GroupHeaderProps {
    group: DerivedQuestAnyOfGroup;
    expanded: boolean;
    isIconMode: boolean;
}

interface GroupItemsGridProps {
    items: AnyOfGroupItem[];
    isFirRequired: boolean;
    onClickItem: (item: ItemDetails) => void;
}

function toItemDetails(item: AnyOfGroupItem): ItemDetails {
    return {
        id: item.id,
        name: item.name,
        normalizedName: item.normalizedName,
        iconLink: item.iconLink,
        gridImageLink: item.gridImageLink,
    };
}

function ItemImage({ item, className }: { item: AnyOfGroupItem; className: string }) {
    const imageSrc = item.iconLink ?? item.gridImageLink;

    if (!imageSrc) {
        return <span className="text-xs text-gray-600">?</span>;
    }

    return <img src={imageSrc} alt={item.name} className={cn("object-contain", className)} />;
}

function ItemPreviewStack({
    items,
    previewIndex,
    expanded,
    isIconMode,
    isFirRequired,
}: ItemPreviewStackProps) {
    return (
        <div
            className={cn(
                "relative flex shrink-0 items-center justify-center",
                isIconMode ? "h-12 w-16" : "h-10 w-14",
            )}
        >
            {items.map((item, index) => {
                const isActive = expanded || index === previewIndex;
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
                            "absolute flex items-center justify-center rounded border bg-black/40 transition-all duration-200",
                            isFirRequired ? "border-orange-400/35" : "border-white/10",
                            isIconMode ? "size-12" : "size-10",
                            layerClass,
                            index === 0 && "-translate-x-2 rotate-[-4deg]",
                            index === 1 && "translate-x-0",
                            index === 2 && "translate-x-2 rotate-[4deg]",
                            isActive ? "opacity-100" : "opacity-35",
                        )}
                    >
                        <ItemImage item={item} className={isIconMode ? "size-11" : "size-9"} />
                    </div>
                );
            })}
        </div>
    );
}

function GroupHeader({ group, expanded, isIconMode }: GroupHeaderProps) {
    return (
        <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <h3
                        className={cn(
                            "leading-tight font-bold text-balance line-clamp-2 text-gray-100",
                            isIconMode ? "line-clamp-2 text-xs" : "text-sm",
                        )}
                        title={group.questName}
                    >
                        {group.questName}
                    </h3>
                </div>

                <span className="shrink-0 text-gray-500">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
            </div>
        </div>
    );
}

function ObjectiveLabelRow({
    group,
    isIconMode,
    isFirRequired,
}: {
    group: DerivedQuestAnyOfGroup;
    isIconMode: boolean;
    isFirRequired: boolean;
}) {
    return (
        <div
            className={cn(
                "flex w-full items-start justify-between gap-3 text-pretty text-gray-400",
                isIconMode ? "text-[11px] leading-snug" : "text-xs",
            )}
        >
            <span className="flex shrink-0 items-center gap-2 font-medium">
                <span className="text-gray-200 tabular-nums">{group.requiredCount}x</span>
                {isFirRequired && <span className="text-orange-400">FiR</span>}
            </span>
            <span className="min-w-0 flex-1">{group.objectiveLabel}</span>
        </div>
    );
}

function GroupItemsGrid({ items, isFirRequired, onClickItem }: GroupItemsGridProps) {
    return (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((item) => (
                <button
                    key={item.id}
                    type="button"
                    onClick={() => onClickItem(toItemDetails(item))}
                    className="flex items-center gap-3 rounded-md border border-white/10 bg-black/20 p-2 text-left transition-colors hover:border-blue-400"
                >
                    <div
                        className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded border bg-black/40",
                            isFirRequired ? "border-orange-400/35" : "border-white/10",
                        )}
                    >
                        <ItemImage item={item} className="size-8" />
                    </div>

                    <div className="min-w-0">
                        <div className="line-clamp-2 text-sm text-gray-100">{item.name}</div>
                    </div>
                </button>
            ))}
        </div>
    );
}

export function ItemAnyOfGroupCard({
    group,
    expanded,
    size,
    onToggleExpanded,
    onClickItem,
}: ItemAnyOfGroupCardProps) {
    const previewItems = useMemo(() => group.items.slice(0, MAX_PREVIEW_ITEMS), [group.items]);
    const [previewIndex, setPreviewIndex] = useState(0);
    const isIconMode = size === "Icon";
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
                    "flex h-full w-full flex-col justify-between gap-2 text-left",
                    isIconMode ? "" : "gap-2.5",
                )}
            >
                <div className="flex w-full items-start gap-3">
                    <ItemPreviewStack
                        items={previewItems}
                        previewIndex={previewIndex}
                        expanded={expanded}
                        isIconMode={isIconMode}
                        isFirRequired={isFirRequired}
                    />

                    <GroupHeader group={group} expanded={expanded} isIconMode={isIconMode} />
                </div>

                <ObjectiveLabelRow
                    group={group}
                    isIconMode={isIconMode}
                    isFirRequired={isFirRequired}
                />
            </button>

            {expanded && (
                <div className="mt-4 space-y-3 border-t border-white/8 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs text-gray-400 text-pretty">
                            Select one of these items to satisfy the quest objective.
                        </div>
                        <Link
                            href={`/quests#quest-${group.questId}`}
                            className="inline-flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-tarkov-green"
                        >
                            Quest Link <ExternalLink size={12} />
                        </Link>
                    </div>

                    <GroupItemsGrid
                        items={group.items}
                        isFirRequired={isFirRequired}
                        onClickItem={onClickItem}
                    />
                </div>
            )}
        </div>
    );
}
