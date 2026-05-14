"use client";

import { useQuestsContext } from "../QuestsContext";
import { Divider, FilterButton, SegButton, SegGroup } from "./quest-ui";

export function QuestsFilterBar() {
    const {
        hideCompleted,
        showAvailableOnly,
        showDebug,
        setHideCompleted,
        setShowAvailableOnly,
        setShowDebug,
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
                active={showDebug}
                onClick={() => setShowDebug(!showDebug)}
                label="Debug"
            />
        </div>
    );
}
