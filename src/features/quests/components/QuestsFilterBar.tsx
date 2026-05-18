"use client";

import { ChevronDown } from "lucide-react";
import type { QuestSortMode } from "@/lib/stores/useUserStore";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuestsContext } from "../QuestsContext";
import { Divider, FilterButton, SegButton, SegGroup } from "./quest-ui";

const SORT_OPTIONS: { value: QuestSortMode; label: string }[] = [
    { value: "default", label: "Default" },
    { value: "level", label: "Level" },
    { value: "xp", label: "XP" },
    { value: "unlockImpact", label: "Unlock Impact" },
];

export function QuestsFilterBar() {
    const {
        selectedTraders,
        hideCompleted,
        showAvailableOnly,
        showHandInOnly,
        showFirHandInOnly,
        showPinnedOnly,
        showIgnored,
        showDebug,
        showPrereqs,
        setHideCompleted,
        setShowAvailableOnly,
        setShowHandInOnly,
        setShowFirHandInOnly,
        setShowPinnedOnly,
        setShowIgnored,
        setShowDebug,
        setShowPrereqs,
        viewMode,
        sortMode,
        setViewMode,
        setSortMode,
        clearTraders,
    } = useQuestsContext();
    const sortLabel = SORT_OPTIONS.find((option) => option.value === sortMode)?.label ?? "Default";

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <SegGroup>
                <SegButton active={viewMode === "tree"} onClick={() => setViewMode("tree")}>
                    Tree
                </SegButton>
                <SegButton active={viewMode === "byTrader"} onClick={() => setViewMode("byTrader")}>
                    By Trader
                </SegButton>
                <SegButton active={viewMode === "byMap"} onClick={() => setViewMode("byMap")}>
                    By Map
                </SegButton>
                <SegButton active={viewMode === "flatList"} onClick={() => setViewMode("flatList")}>
                    List
                </SegButton>
            </SegGroup>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        disabled={viewMode === "tree"}
                        className="flex shrink-0 items-center gap-2 rounded-sm border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-white/30 hover:bg-black/40 hover:text-white disabled:cursor-not-allowed disabled:border-white/5 disabled:bg-black/10 disabled:text-gray-600 disabled:hover:border-white/5 disabled:hover:bg-black/10 disabled:hover:text-gray-600"
                        title={
                            viewMode === "tree"
                                ? "Sort applies to By Trader, By Map, and List views"
                                : "Sort quests"
                        }
                    >
                        Sort: {sortLabel}
                        <ChevronDown size={13} className="text-gray-500" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    {SORT_OPTIONS.map((option) => (
                        <DropdownMenuItem
                            key={option.value}
                            onSelect={() => setSortMode(option.value)}
                            className={sortMode === option.value ? "text-tarkov-green" : ""}
                        >
                            {option.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Divider />

            <FilterButton
                active={hideCompleted}
                onClick={() => setHideCompleted(!hideCompleted)}
                label="Hide Completed"
            />
            <FilterButton
                active={showAvailableOnly}
                onClick={() => setShowAvailableOnly(!showAvailableOnly)}
                label="Available Only"
            />
            <FilterButton
                active={showHandInOnly}
                onClick={() => setShowHandInOnly(!showHandInOnly)}
                label="Hand-In Only"
            />
            <FilterButton
                active={showFirHandInOnly}
                disabled={!showHandInOnly}
                onClick={() => setShowFirHandInOnly(!showFirHandInOnly)}
                label="FiR Hand-Ins"
            />
            <FilterButton
                active={showPinnedOnly}
                onClick={() => setShowPinnedOnly(!showPinnedOnly)}
                label="Pinned Only"
            />
            <FilterButton
                active={showIgnored}
                onClick={() => setShowIgnored(!showIgnored)}
                label="Show Ignored"
            />
            <FilterButton
                active={!showPrereqs}
                onClick={() => setShowPrereqs(!showPrereqs)}
                label="Hide Pre-Req Links"
            />
            <FilterButton
                active={showDebug}
                onClick={() => setShowDebug(!showDebug)}
                label="Debug"
            />
            {showDebug && (
                <FilterButton
                    active={selectedTraders.size > 0}
                    disabled={selectedTraders.size === 0}
                    onClick={clearTraders}
                    label="Clear Trader Filter"
                />
            )}
        </div>
    );
}
