"use client";

import { useQuestsContext } from "../QuestsContext";
import { Divider, FilterButton, SegButton, SegGroup } from "./quest-ui";

export function QuestsFilterBar() {
    const {
        faction,
        showKappa,
        showLightkeeper,
        hideCompleted,
        showAvailableOnly,
        toggleFaction,
        toggleKappa,
        toggleLightkeeper,
        setHideCompleted,
        setShowAvailableOnly,
    } = useQuestsContext();

    return (
        <div className="flex items-center gap-2 bg-muted px-3 py-2 rounded-md border flex-wrap">
            <SegGroup>
                <SegButton active={faction === "USEC"} onClick={() => toggleFaction("USEC")}>
                    USEC
                </SegButton>
                <SegButton active={faction === "BEAR"} onClick={() => toggleFaction("BEAR")}>
                    BEAR
                </SegButton>
            </SegGroup>

            <Divider />

            <SegGroup>
                <SegButton active={showKappa} onClick={toggleKappa}>
                    Kappa
                </SegButton>
                <SegButton active={showLightkeeper} onClick={toggleLightkeeper}>
                    LK
                </SegButton>
            </SegGroup>

            <div className="flex-1" />

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
        </div>
    );
}
