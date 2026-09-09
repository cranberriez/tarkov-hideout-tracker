"use client";

import { useId } from "react";
import { FilterPanel } from "@/components/ui/filter-bar";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemsFiltersPanel } from "./controls/ItemsFiltersPanel";
import { ItemsToolbar } from "./controls/ItemsToolbar";

interface ItemsControlsProps {
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    children: React.ReactNode;
}

export function ItemsControls({ searchQuery, onSearchQueryChange, children }: ItemsControlsProps) {
    const panelId = useId();
    const {
        itemFiltersOpen,
        setItemFiltersOpen,
        checklistViewMode,
        setChecklistViewMode,
        showHidden,
        setShowHidden,
        hideCheap,
        setHideCheap,
        itemsSize,
        setItemsSize,
        cheapPriceThreshold,
        setCheapPriceThreshold,
        useCategorization,
        setUseCategorization,
        showFirOnly,
        setShowFirOnly,
        itemSourceFilter,
        setItemSourceFilter,
        itemShowPinnedQuestOnly,
        setItemShowPinnedQuestOnly,
        itemQuestVisibilityMode,
        itemQuestCustomLookahead,
        itemQuestCustomLevelLookahead,
        itemShowFutureFir,
        itemShowIgnored,
        setItemQuestVisibilityMode,
        setItemQuestCustomLookahead,
        setItemQuestCustomLevelLookahead,
        setItemShowFutureFir,
        setItemShowIgnored,
    } = useUserStore();

    return (
        <div className="space-y-3">
            <ItemsToolbar
                filtersOpen={itemFiltersOpen}
                onToggleFilters={() => setItemFiltersOpen(!itemFiltersOpen)}
                searchQuery={searchQuery}
                onSearchQueryChange={onSearchQueryChange}
                panelId={panelId}
                itemSourceFilter={itemSourceFilter}
                onItemSourceFilterChange={setItemSourceFilter}
                itemsSize={itemsSize}
                onItemsSizeChange={setItemsSize}
                showFirOnly={showFirOnly}
                onShowFirOnlyChange={setShowFirOnly}
                useCategorization={useCategorization}
                onUseCategorizationChange={setUseCategorization}
            />

            <div className="relative min-h-0">
                <FilterPanel
                    id={panelId}
                    open={itemFiltersOpen}
                    onKeyDown={(event) => {
                        if (event.key === "Escape") {
                            setItemFiltersOpen(false);
                            document
                                .querySelector<HTMLButtonElement>(`[aria-controls="${panelId}"]`)
                                ?.focus();
                        }
                    }}
                >
                    <ItemsFiltersPanel
                        checklistViewMode={checklistViewMode}
                        onChecklistViewModeChange={setChecklistViewMode}
                        showHidden={showHidden}
                        onShowHiddenChange={setShowHidden}
                        itemQuestVisibilityMode={itemQuestVisibilityMode}
                        onItemQuestVisibilityModeChange={setItemQuestVisibilityMode}
                        itemQuestCustomLookahead={itemQuestCustomLookahead}
                        onItemQuestCustomLookaheadChange={setItemQuestCustomLookahead}
                        itemQuestCustomLevelLookahead={itemQuestCustomLevelLookahead}
                        onItemQuestCustomLevelLookaheadChange={setItemQuestCustomLevelLookahead}
                        itemShowPinnedQuestOnly={itemShowPinnedQuestOnly}
                        onItemShowPinnedQuestOnlyChange={setItemShowPinnedQuestOnly}
                        itemShowFutureFir={itemShowFutureFir}
                        onItemShowFutureFirChange={setItemShowFutureFir}
                        itemShowIgnored={itemShowIgnored}
                        onItemShowIgnoredChange={setItemShowIgnored}
                        hideCheap={hideCheap}
                        onHideCheapChange={setHideCheap}
                        cheapPriceThreshold={cheapPriceThreshold}
                        onCheapPriceThresholdChange={setCheapPriceThreshold}
                        className="w-full"
                    />
                </FilterPanel>

                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </div>
    );
}
