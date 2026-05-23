"use client";

import { ChevronDown, Minus, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import type { QuestSortMode } from "@/lib/stores/useUserStore";
import {
    DropdownMenuCheckboxItem,
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
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
        visibilityMode,
        activeDepth,
        showHandInOnly,
        showFirHandInOnly,
        showPinnedOnly,
        showIgnored,
        showDebug,
        showPrereqs,
        setHideCompleted,
        setVisibilityMode,
        setActiveDepth,
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

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button
                        type="button"
                        className="flex shrink-0 items-center gap-2 rounded-sm border border-white/10 bg-black/20 px-3 py-2 text-xs font-medium text-gray-300 transition-colors hover:border-white/30 hover:bg-black/40 hover:text-white"
                    >
                        View Settings
                        <ChevronDown size={13} className="text-gray-500" />
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-52">
                    <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Quests
                    </DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                        checked={hideCompleted}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => setHideCompleted(checked === true)}
                    >
                        Hide Completed
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuRadioGroup
                        value={visibilityMode}
                        onValueChange={(value) => {
                            if (
                                value === "all" ||
                                value === "hideLocked" ||
                                value === "activeDepth"
                            ) {
                                setVisibilityMode(value);
                            }
                        }}
                    >
                        <DropdownMenuRadioItem value="all">All</DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="hideLocked">
                            Hide Locked
                        </DropdownMenuRadioItem>
                        <DropdownMenuRadioItem value="activeDepth">
                            Active + Depth
                        </DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                        checked={showPinnedOnly}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => setShowPinnedOnly(checked === true)}
                    >
                        Pinned Only
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={showIgnored}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => setShowIgnored(checked === true)}
                    >
                        Show Ignored
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={!showPrereqs}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => setShowPrereqs(checked !== true)}
                    >
                        Hide Pre-Req Links
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-gray-500">
                        Items
                    </DropdownMenuLabel>
                    <DropdownMenuCheckboxItem
                        checked={showHandInOnly}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => setShowHandInOnly(checked === true)}
                    >
                        Hand-In Only
                    </DropdownMenuCheckboxItem>
                    <DropdownMenuCheckboxItem
                        checked={showFirHandInOnly}
                        disabled={!showHandInOnly}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => setShowFirHandInOnly(checked === true)}
                    >
                        FiR Hand-Ins
                    </DropdownMenuCheckboxItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {visibilityMode === "activeDepth" && (
                <ActiveDepthInput value={activeDepth} onCommit={setActiveDepth} />
            )}

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

function ActiveDepthInput({
    value,
    onCommit,
}: {
    value: number;
    onCommit: (value: number) => void;
}) {
    const [draftValue, setDraftValue] = useState(String(value));

    useEffect(() => {
        setDraftValue(String(value));
    }, [value]);

    const commit = (nextDraftValue = draftValue) => {
        const parsed = Number(nextDraftValue.trim());
        if (!Number.isFinite(parsed)) {
            setDraftValue(String(value));
            return;
        }

        const nextValue = Math.max(0, Math.floor(parsed));
        onCommit(nextValue);
        setDraftValue(String(nextValue));
    };

    const step = (delta: number) => {
        const nextValue = Math.max(0, value + delta);
        onCommit(nextValue);
        setDraftValue(String(nextValue));
    };

    return (
        <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-gray-300">
            <span className="px-1">Depth</span>
            <div className="flex overflow-hidden rounded-sm border border-white/10 bg-black/20">
                <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={value <= 0}
                    title="Decrease depth"
                    className="grid h-8 w-8 place-items-center text-gray-300 transition-colors hover:bg-white/8 hover:text-white disabled:cursor-not-allowed disabled:text-gray-700 disabled:hover:bg-transparent"
                >
                    <Minus size={13} />
                </button>
                <input
                    type="text"
                    inputMode="numeric"
                    value={draftValue}
                    onChange={(event) => setDraftValue(event.target.value)}
                    onBlur={() => commit()}
                    onKeyDown={(event) => {
                        if (event.key === "Enter") {
                            event.currentTarget.blur();
                        } else if (event.key === "ArrowUp") {
                            event.preventDefault();
                            step(1);
                        } else if (event.key === "ArrowDown") {
                            event.preventDefault();
                            step(-1);
                        }
                    }}
                    className="h-8 w-11 border-x border-white/10 bg-white/5 text-center font-mono text-base font-semibold text-white outline-none transition-colors focus:bg-black/50"
                />
                <button
                    type="button"
                    onClick={() => step(1)}
                    title="Increase depth"
                    className="grid h-8 w-8 place-items-center text-gray-300 transition-colors hover:bg-white/8 hover:text-white"
                >
                    <Plus size={13} />
                </button>
            </div>
        </div>
    );
}
