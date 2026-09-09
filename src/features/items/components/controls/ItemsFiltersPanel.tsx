"use client";

import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterCheckbox } from "@/components/ui/FilterCheckbox";
import { FilterNumberInput } from "@/components/ui/FilterNumberInput";
import { FilterRadioGroup, FilterSection as PanelSection } from "@/components/ui/filter-bar";
import type { ItemQuestVisibilityMode } from "@/lib/stores/useUserStore";

interface ItemsFiltersPanelProps {
    checklistViewMode: "all" | "nextLevel";
    onChecklistViewModeChange: (value: "all" | "nextLevel") => void;
    showHidden: boolean;
    onShowHiddenChange: (value: boolean) => void;
    itemQuestVisibilityMode: ItemQuestVisibilityMode;
    onItemQuestVisibilityModeChange: (value: ItemQuestVisibilityMode) => void;
    itemQuestCustomLookahead: number;
    onItemQuestCustomLookaheadChange: (value: number) => void;
    itemQuestCustomLevelLookahead: number;
    onItemQuestCustomLevelLookaheadChange: (value: number) => void;
    itemShowPinnedQuestOnly: boolean;
    onItemShowPinnedQuestOnlyChange: (value: boolean) => void;
    itemShowFutureFir: boolean;
    onItemShowFutureFirChange: (value: boolean) => void;
    itemShowIgnored: boolean;
    onItemShowIgnoredChange: (value: boolean) => void;
    hideCheap: boolean;
    onHideCheapChange: (value: boolean) => void;
    cheapPriceThreshold: number;
    onCheapPriceThresholdChange: (value: number) => void;
    className?: string;
}

export function ItemsFiltersPanel({
    checklistViewMode,
    onChecklistViewModeChange,
    showHidden,
    onShowHiddenChange,
    itemQuestVisibilityMode,
    onItemQuestVisibilityModeChange,
    itemQuestCustomLookahead,
    onItemQuestCustomLookaheadChange,
    itemQuestCustomLevelLookahead,
    onItemQuestCustomLevelLookaheadChange,
    itemShowPinnedQuestOnly,
    onItemShowPinnedQuestOnlyChange,
    itemShowFutureFir,
    onItemShowFutureFirChange,
    itemShowIgnored,
    onItemShowIgnoredChange,
    hideCheap,
    onHideCheapChange,
    cheapPriceThreshold,
    onCheapPriceThresholdChange,
    className,
}: ItemsFiltersPanelProps) {
    return (
        <aside className={cn("rounded-md border bg-muted p-4 shadow-sm", className)}>
            <div className="mb-4 flex items-center justify-between">
                <div className="text-sm font-semibold text-white">Filters</div>
                <Filter size={15} className="text-gray-500" />
            </div>

            <div className="space-y-4">
                <PanelSection title="Hideout">
                    <FilterRadioGroup
                        label="Hideout levels"
                        value={checklistViewMode}
                        onValueChange={onChecklistViewModeChange}
                        options={[
                            { value: "nextLevel", label: "Next Level" },
                            { value: "all", label: "All Future" },
                        ]}
                    />
                    <FilterCheckbox
                        id="items-filter-show-hidden"
                        label="Show Hidden Stations"
                        checked={showHidden}
                        onCheckedChange={onShowHiddenChange}
                    />
                </PanelSection>

                <PanelSection title="Quests">
                    <FilterRadioGroup
                        label="Quest visibility"
                        value={itemQuestVisibilityMode}
                        onValueChange={onItemQuestVisibilityModeChange}
                        className="flex-wrap"
                        options={[
                            { value: "available", label: "Available" },
                            { value: "nextLayer", label: "Next Layer" },
                            { value: "allFuture", label: "All Future" },
                            { value: "custom", label: "Custom" },
                        ]}
                    />
                    <div
                        className={cn(
                            "w-full rounded-md border px-3 py-3 text-left transition-colors",
                            itemQuestVisibilityMode === "custom"
                                ? "border-tarkov-green/40 bg-black/20"
                                : "border-white/10 bg-black/20 hover:border-white/20",
                        )}
                    >
                        <div className="space-y-3">
                            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-600">
                                Custom
                            </div>
                            <NumberRow
                                label="Quest Lookahead"
                                value={itemQuestCustomLookahead}
                                onChange={(value) => {
                                    if (itemQuestVisibilityMode !== "custom") {
                                        onItemQuestVisibilityModeChange("custom");
                                    }
                                    onItemQuestCustomLookaheadChange(value);
                                }}
                            />
                            <NumberRow
                                label="Level Lookahead"
                                value={itemQuestCustomLevelLookahead}
                                onChange={(value) => {
                                    if (itemQuestVisibilityMode !== "custom") {
                                        onItemQuestVisibilityModeChange("custom");
                                    }
                                    onItemQuestCustomLevelLookaheadChange(value);
                                }}
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <FilterCheckbox
                            id="items-filter-pinned-only"
                            label="Pinned Only"
                            checked={itemShowPinnedQuestOnly}
                            onCheckedChange={onItemShowPinnedQuestOnlyChange}
                        />
                        <FilterCheckbox
                            id="items-filter-all-future-fir"
                            label="All Future FiR"
                            checked={itemShowFutureFir}
                            onCheckedChange={onItemShowFutureFirChange}
                        />
                        <FilterCheckbox
                            id="items-filter-show-ignored"
                            label="Show Ignored"
                            checked={itemShowIgnored}
                            onCheckedChange={onItemShowIgnoredChange}
                        />
                    </div>
                </PanelSection>

                <PanelSection title="Value">
                    <FilterCheckbox
                        id="items-filter-hide-cheap"
                        label="Hide Cheap"
                        checked={hideCheap}
                        onCheckedChange={onHideCheapChange}
                        trailing={
                            <FilterNumberInput
                                label="Cheap price threshold in RUB"
                                value={cheapPriceThreshold}
                                onCommit={onCheapPriceThresholdChange}
                                widthClassName="w-20"
                                prefix="<"
                                suffix="RUB"
                                disabled={!hideCheap}
                                onInteract={() => {
                                    if (!hideCheap) {
                                        onHideCheapChange(true);
                                    }
                                }}
                            />
                        }
                    />
                </PanelSection>
            </div>
        </aside>
    );
}

function NumberRow({
    label,
    value,
    onChange,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
}) {
    return (
        <label className="flex items-center justify-between gap-3 px-1 py-1 text-xs text-gray-400">
            <span>{label}</span>
            <FilterNumberInput
                value={value}
                onCommit={onChange}
                widthClassName="w-12"
                suffix={<ChevronDown size={12} className="text-gray-600" />}
            />
        </label>
    );
}
