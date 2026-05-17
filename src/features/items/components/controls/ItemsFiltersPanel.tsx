"use client";

import { QuestFlagFilters } from "@/components/core/QuestFlagFilters";
import { ChevronDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { ItemsCheckboxControl } from "./ItemsCheckboxControl";
import { ItemsDraftNumberInput } from "./ItemsDraftNumberInput";
import { ItemsSegmentedButton } from "./ItemsSegmentedButton";
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
    showKappa: boolean;
    onShowKappaChange: (value: boolean) => void;
    showLightkeeper: boolean;
    onShowLightkeeperChange: (value: boolean) => void;
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
    showKappa,
    onShowKappaChange,
    showLightkeeper,
    onShowLightkeeperChange,
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
                    <div className="flex flex-wrap gap-2">
                        <ItemsSegmentedButton
                            active={checklistViewMode === "nextLevel"}
                            onClick={() => onChecklistViewModeChange("nextLevel")}
                        >
                            Next Level
                        </ItemsSegmentedButton>
                        <ItemsSegmentedButton
                            active={checklistViewMode === "all"}
                            onClick={() => onChecklistViewModeChange("all")}
                        >
                            All Future
                        </ItemsSegmentedButton>
                    </div>
                    <ItemsCheckboxControl
                        id="items-filter-show-hidden"
                        label="Show Hidden Stations"
                        checked={showHidden}
                        onCheckedChange={onShowHiddenChange}
                    />
                </PanelSection>

                <PanelSection title="Quests">
                    <div className="flex flex-wrap gap-2">
                        <ItemsSegmentedButton
                            active={itemQuestVisibilityMode === "available"}
                            onClick={() => onItemQuestVisibilityModeChange("available")}
                        >
                            Available
                        </ItemsSegmentedButton>
                        <ItemsSegmentedButton
                            active={itemQuestVisibilityMode === "nextLayer"}
                            onClick={() => onItemQuestVisibilityModeChange("nextLayer")}
                        >
                            Next Layer
                        </ItemsSegmentedButton>
                        <ItemsSegmentedButton
                            active={itemQuestVisibilityMode === "allFuture"}
                            onClick={() => onItemQuestVisibilityModeChange("allFuture")}
                        >
                            All Future
                        </ItemsSegmentedButton>
                    </div>

                    <div
                        role="button"
                        tabIndex={0}
                        onClick={() => onItemQuestVisibilityModeChange("custom")}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                onItemQuestVisibilityModeChange("custom");
                            }
                        }}
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
                        <QuestFlagFilters
                            showKappa={showKappa}
                            showLightkeeper={showLightkeeper}
                            onToggleKappa={() => onShowKappaChange(!showKappa)}
                            onToggleLightkeeper={() => onShowLightkeeperChange(!showLightkeeper)}
                            expand
                        />
                        <ItemsCheckboxControl
                            id="items-filter-pinned-only"
                            label="Pinned Only"
                            checked={itemShowPinnedQuestOnly}
                            onCheckedChange={onItemShowPinnedQuestOnlyChange}
                        />
                        <ItemsCheckboxControl
                            id="items-filter-all-future-fir"
                            label="All Future FiR"
                            checked={itemShowFutureFir}
                            onCheckedChange={onItemShowFutureFirChange}
                        />
                        <ItemsCheckboxControl
                            id="items-filter-show-ignored"
                            label="Show Ignored"
                            checked={itemShowIgnored}
                            onCheckedChange={onItemShowIgnoredChange}
                        />
                    </div>
                </PanelSection>

                <PanelSection title="Value">
                    <ItemsCheckboxControl
                        id="items-filter-hide-cheap"
                        label="Hide Cheap"
                        checked={hideCheap}
                        onCheckedChange={onHideCheapChange}
                        trailing={
                            <ItemsDraftNumberInput
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

function PanelSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-3 py-1">
            <div className="text-[10px] font-bold uppercase tracking-wide text-gray-600">{title}</div>
            {children}
        </section>
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
            <ItemsDraftNumberInput
                value={value}
                onCommit={onChange}
                widthClassName="w-12"
                suffix={<ChevronDown size={12} className="text-gray-600" />}
            />
        </label>
    );
}
