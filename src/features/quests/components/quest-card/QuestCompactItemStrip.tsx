"use client";

import { COMPACT_PREVIEW_ITEM_LIMIT } from "./styles";

interface CompactHandInItem {
    id: string;
    name: string;
    iconLink?: string | null;
    gridImageLink?: string | null;
    count: number;
    fir?: boolean;
}

interface QuestCompactItemStripProps {
    items: CompactHandInItem[];
    onItemClick?: (itemId: string) => void;
}

export function QuestCompactItemStrip({ items, onItemClick }: QuestCompactItemStripProps) {
    if (items.length === 0) return null;

    return (
        <div className="flex items-center gap-1 px-2.5 pb-2.5 pl-[3rem] sm:px-3 sm:pl-[52px]">
            {items.slice(0, COMPACT_PREVIEW_ITEM_LIMIT).map((item) => (
                <div
                    key={item.id}
                    className={`relative ${onItemClick ? "cursor-pointer" : ""}`}
                    title={`${item.name} x${item.count}${item.fir ? " (FiR)" : ""}${onItemClick ? " â€” click to view" : ""}`}
                    onClick={
                        onItemClick
                            ? (e) => {
                                  e.stopPropagation();
                                  onItemClick(item.id);
                              }
                            : undefined
                    }
                >
                    <img
                        src={item.iconLink ?? item.gridImageLink ?? ""}
                        alt={item.name}
                        className={`w-8 h-8 object-contain rounded bg-black/40 transition-opacity ${
                            onItemClick ? "hover:opacity-75" : ""
                        } ${item.fir ? "ring-1 ring-orange-500" : "border border-white/10"}`}
                    />
                    {item.fir && (
                        <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-orange-500 rounded-full" />
                    )}
                </div>
            ))}
            {items.length > COMPACT_PREVIEW_ITEM_LIMIT && (
                <span className="text-xs text-gray-600">
                    +{items.length - COMPACT_PREVIEW_ITEM_LIMIT}
                </span>
            )}
        </div>
    );
}

