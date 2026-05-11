"use client";

import { useQuestsContext } from "../QuestsContext";
import { FilterButton } from "./quest-ui";

export function QuestsFilterBar() {
    const { hideCompleted, showAvailableOnly, setHideCompleted, setShowAvailableOnly } =
        useQuestsContext();

    return (
        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
    );
}
