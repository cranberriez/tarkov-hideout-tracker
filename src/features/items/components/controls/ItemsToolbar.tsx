"use client";

import { Filter, Grid3X3, LayoutList, List, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemsSegmentedButton } from "./ItemsSegmentedButton";
import type { ItemSize, ItemSourceFilter } from "@/lib/stores/useUserStore";

interface ItemsToolbarProps {
    filtersOpen: boolean;
    onToggleFilters: () => void;
    onOpenSearch: () => void;
    itemSourceFilter: ItemSourceFilter;
    onItemSourceFilterChange: (value: ItemSourceFilter) => void;
    itemsSize: ItemSize;
    onItemsSizeChange: (value: ItemSize) => void;
    showFirOnly: boolean;
    onShowFirOnlyChange: (value: boolean) => void;
    useCategorization: boolean;
    onUseCategorizationChange: (value: boolean) => void;
}

export function ItemsToolbar({
    filtersOpen,
    onToggleFilters,
    onOpenSearch,
    itemSourceFilter,
    onItemSourceFilterChange,
    itemsSize,
    onItemsSizeChange,
    showFirOnly,
    onShowFirOnlyChange,
    useCategorization,
    onUseCategorizationChange,
}: ItemsToolbarProps) {
    return (
        <div className="flex flex-wrap gap-1.5 rounded-md border bg-muted px-3 py-2">
            <button
                type="button"
                onClick={onToggleFilters}
                className={cn(
                    "flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-medium transition-all",
                    filtersOpen
                        ? "border-tarkov-green bg-tarkov-green/10 text-tarkov-green"
                        : "border-white/10 bg-black/20 text-gray-400 hover:border-white/30 hover:bg-black/40",
                )}
            >
                <Filter size={14} />
                Filters
            </button>

            <button
                type="button"
                onClick={onOpenSearch}
                className="group flex min-w-[140px] flex-1 items-center gap-2 rounded-sm border border-white/10 bg-black/40 px-3 py-1.5 text-gray-400 transition-all hover:border-tarkov-green/50 hover:bg-black/60 hover:text-white"
            >
                <Search
                    size={14}
                    className="shrink-0 text-gray-500 transition-colors group-hover:text-tarkov-green"
                />
                <span className="text-xs">Search items...</span>
            </button>

            <div className="flex min-w-[160px] flex-1 rounded-sm border border-white/10 bg-black/40 p-1">
                <ItemsSegmentedButton
                    active={itemSourceFilter === "all"}
                    onClick={() => onItemSourceFilterChange("all")}
                    grow
                >
                    All
                </ItemsSegmentedButton>
                <ItemsSegmentedButton
                    active={itemSourceFilter === "hideout"}
                    onClick={() => onItemSourceFilterChange("hideout")}
                    grow
                >
                    Hideout
                </ItemsSegmentedButton>
                <ItemsSegmentedButton
                    active={itemSourceFilter === "quest"}
                    onClick={() => onItemSourceFilterChange("quest")}
                    grow
                >
                    Quests
                </ItemsSegmentedButton>
            </div>

            <div className="flex shrink-0 rounded-sm border border-white/10 bg-black/40 p-1">
                <ItemsSegmentedButton
                    active={itemsSize === "Icon"}
                    onClick={() => onItemsSizeChange("Icon")}
                    icon={<Grid3X3 size={13} />}
                />
                <ItemsSegmentedButton
                    active={itemsSize === "Compact"}
                    onClick={() => onItemsSizeChange("Compact")}
                    icon={<List size={13} />}
                />
                <ItemsSegmentedButton
                    active={itemsSize === "Expanded"}
                    onClick={() => onItemsSizeChange("Expanded")}
                    icon={<LayoutList size={13} />}
                />
            </div>

            <button
                type="button"
                onClick={() => onShowFirOnlyChange(!showFirOnly)}
                className={cn(
                    "flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-medium transition-all",
                    showFirOnly
                        ? "border-tarkov-green bg-tarkov-green/10 text-tarkov-green"
                        : "border-white/10 bg-black/20 text-gray-400 hover:border-white/30 hover:bg-black/40",
                )}
            >
                FiR Only
            </button>

            <button
                type="button"
                onClick={() => onUseCategorizationChange(!useCategorization)}
                className={cn(
                    "flex items-center gap-2 rounded-sm border px-3 py-2 text-xs font-medium transition-all",
                    useCategorization
                        ? "border-tarkov-green bg-tarkov-green/10 text-tarkov-green"
                        : "border-white/10 bg-black/20 text-gray-400 hover:border-white/30 hover:bg-black/40",
                )}
            >
                Categorize
            </button>
        </div>
    );
}
