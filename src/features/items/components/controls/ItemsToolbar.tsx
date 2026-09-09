"use client";

import { Filter, Grid3X3, LayoutList, List } from "lucide-react";
import {
    FilterBar,
    FilterPanelButton,
    FilterSearchInput,
    FilterRadioGroup,
    FilterToggle,
} from "@/components/ui/filter-bar";
import type { ItemSize, ItemSourceFilter } from "@/lib/stores/useUserStore";

interface ItemsToolbarProps {
    filtersOpen: boolean;
    onToggleFilters: () => void;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    panelId: string;
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
    searchQuery,
    onSearchQueryChange,
    panelId,
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
        <FilterBar aria-label="Item filters">
            <FilterPanelButton open={filtersOpen} panelId={panelId} onClick={onToggleFilters}>
                <Filter size={14} /> Filters
            </FilterPanelButton>
            <FilterSearchInput
                label="Search checklist items"
                placeholder="Search checklist items..."
                value={searchQuery}
                onValueChange={onSearchQueryChange}
            />
            <FilterRadioGroup
                label="Item source"
                value={itemSourceFilter}
                onValueChange={onItemSourceFilterChange}
                className="min-w-[160px] flex-1"
                options={[
                    { value: "all", label: "All" },
                    { value: "hideout", label: "Hideout" },
                    { value: "quest", label: "Quests" },
                ]}
            />
            <FilterRadioGroup
                label="Item size"
                value={itemsSize}
                onValueChange={onItemsSizeChange}
                className="shrink-0"
                options={[
                    { value: "Icon", label: "Icon", icon: <Grid3X3 size={13} /> },
                    { value: "Compact", label: "Compact", icon: <List size={13} /> },
                    { value: "Expanded", label: "Expanded", icon: <LayoutList size={13} /> },
                ]}
            />
            <FilterToggle checked={showFirOnly} onCheckedChange={onShowFirOnlyChange}>
                FiR Only
            </FilterToggle>
            <FilterToggle checked={useCategorization} onCheckedChange={onUseCategorizationChange}>
                Categorize
            </FilterToggle>
        </FilterBar>
    );
}
