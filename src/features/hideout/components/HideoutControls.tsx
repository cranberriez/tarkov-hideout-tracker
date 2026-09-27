"use client";

import { useUserStore } from "@/lib/stores/useUserStore";
import { FilterBar, FilterRadioGroup, FilterToggle } from "@/components/ui/filter-bar";
import { Grid2x2, Rows2 } from "lucide-react";

const layoutOptions = [
    { value: "expanded", label: "Expanded view", icon: <Rows2 size={14} aria-hidden="true" /> },
    { value: "compact", label: "Compact view", icon: <Grid2x2 size={14} aria-hidden="true" /> },
] as const;

export function HideoutControls() {
    const {
        showHidden,
        setShowHidden,
        hideoutCompactMode,
        setHideoutCompactMode,
        hideMoney,
        setHideMoney,
        hideRequirements,
        setHideRequirements,
    } = useUserStore();

    return (
        <FilterBar className="items-center">
            <FilterToggle checked={!hideRequirements} onCheckedChange={(checked) => setHideRequirements(!checked)}>
                Requirements
            </FilterToggle>
            <FilterToggle checked={!hideMoney} onCheckedChange={(checked) => setHideMoney(!checked)}>
                Money
            </FilterToggle>
            <FilterToggle checked={showHidden} onCheckedChange={setShowHidden}>
                Hidden stations
            </FilterToggle>
            <FilterRadioGroup
                label="Requirement layout"
                value={hideoutCompactMode ? "compact" : "expanded"}
                onValueChange={(value) => setHideoutCompactMode(value === "compact")}
                options={layoutOptions}
                className="min-w-20"
            />
        </FilterBar>
    );
}
