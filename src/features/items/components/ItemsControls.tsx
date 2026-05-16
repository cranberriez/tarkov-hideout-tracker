"use client";

import { cn } from "@/lib/utils";
import { useUserStore } from "@/lib/stores/useUserStore";
import { ItemsFiltersPanel } from "./controls/ItemsFiltersPanel";
import { ItemsToolbar } from "./controls/ItemsToolbar";

interface ItemsControlsProps {
    onOpenSearch: () => void;
    children: React.ReactNode;
}

export function ItemsControls({ onOpenSearch, children }: ItemsControlsProps) {
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
        questShowKappa,
        questShowLightkeeper,
        setItemQuestVisibilityMode,
        setItemQuestCustomLookahead,
        setItemQuestCustomLevelLookahead,
        setItemShowFutureFir,
        setItemShowIgnored,
        setQuestShowKappa,
        setQuestShowLightkeeper,
    } = useUserStore();

    return (
        <div className="space-y-3">
            <ItemsToolbar
                filtersOpen={itemFiltersOpen}
                onToggleFilters={() => setItemFiltersOpen(!itemFiltersOpen)}
                onOpenSearch={onOpenSearch}
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
                <div
                    className={cn(
                        "absolute left-0 top-0 z-45 w-full max-w-[340px] transition-all duration-200 ease-out",
                        itemFiltersOpen
                            ? "pointer-events-auto translate-x-0 opacity-100"
                            : "pointer-events-none -translate-x-4 opacity-0",
                    )}
                    aria-hidden={!itemFiltersOpen}
                    inert={!itemFiltersOpen}
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
                        showKappa={questShowKappa}
                        onShowKappaChange={setQuestShowKappa}
                        showLightkeeper={questShowLightkeeper}
                        onShowLightkeeperChange={setQuestShowLightkeeper}
                        hideCheap={hideCheap}
                        onHideCheapChange={setHideCheap}
                        cheapPriceThreshold={cheapPriceThreshold}
                        onCheapPriceThresholdChange={setCheapPriceThreshold}
                        className="w-full"
                    />
                </div>

                <div className="min-w-0 flex-1">{children}</div>
            </div>
        </div>
    );
}
