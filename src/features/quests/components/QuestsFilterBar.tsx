"use client";

import { useQuestsContext } from "../QuestsContext";
import { Divider, FilterButton, SegButton, SegGroup } from "./quest-ui";

export function QuestsFilterBar() {
    const {
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
        setViewMode,
    } = useQuestsContext();

    return (
        <div className="flex items-center gap-2 flex-wrap">
            <SegGroup>
                <SegButton active={viewMode === "list"} onClick={() => setViewMode("list")}>
                    List
                </SegButton>
                <SegButton active={viewMode === "byTrader"} onClick={() => setViewMode("byTrader")}>
                    By Trader
                </SegButton>
                <SegButton active={viewMode === "tree"} onClick={() => setViewMode("tree")}>
                    Tree
                </SegButton>
            </SegGroup>

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
        </div>
    );
}
