"use client";

import { useShallow } from "zustand/react/shallow";
import { useUserStore } from "@/lib/stores/useUserStore";
import { FilterBar, FilterRadioGroup, FilterToggle } from "@/components/ui/filter-bar";
import { Eye, EyeOff, Goal, Grid2x2, Rows2 } from "lucide-react";

const layoutOptions = [
	{ value: "expanded", label: "Expanded view", icon: <Rows2 size={14} aria-hidden="true" /> },
	{ value: "compact", label: "Compact view", icon: <Grid2x2 size={14} aria-hidden="true" /> },
] as const;

/** Lit only when changed from the default; the eye shows whether the content is visible. */
function VisibilityToggle({
	label,
	actionLabel,
	visible,
	pressed,
	onPressedChange,
}: {
	label: string;
	actionLabel: string;
	visible: boolean;
	pressed: boolean;
	onPressedChange: (pressed: boolean) => void;
}) {
	const Icon = visible ? Eye : EyeOff;
	return (
		<FilterToggle checked={pressed} onCheckedChange={onPressedChange} aria-label={actionLabel}>
			<Icon size={14} aria-hidden="true" />
			{label}
		</FilterToggle>
	);
}

export function HideoutControls({
	goalsMode,
	onGoalsModeChange,
}: {
	goalsMode: boolean;
	onGoalsModeChange: (value: boolean) => void;
}) {
	const {
		showHidden,
		setShowHidden,
		hideoutCompactMode,
		setHideoutCompactMode,
		hideMoney,
		setHideMoney,
		hideRequirements,
		setHideRequirements,
	} = useUserStore(
		useShallow((state) => ({
			showHidden: state.showHidden,
			setShowHidden: state.setShowHidden,
			hideoutCompactMode: state.hideoutCompactMode,
			setHideoutCompactMode: state.setHideoutCompactMode,
			hideMoney: state.hideMoney,
			setHideMoney: state.setHideMoney,
			hideRequirements: state.hideRequirements,
			setHideRequirements: state.setHideRequirements,
		})),
	);

	return (
		<FilterBar className="items-center">
			<FilterToggle checked={goalsMode} onCheckedChange={onGoalsModeChange} aria-label="Edit station goals">
				<Goal size={14} aria-hidden="true" />
				Goals
			</FilterToggle>
			<VisibilityToggle
				label="Requirements"
				actionLabel="Hide requirements"
				visible={!hideRequirements}
				pressed={hideRequirements}
				onPressedChange={setHideRequirements}
			/>
			<VisibilityToggle
				label="Money"
				actionLabel="Hide money requirements"
				visible={!hideMoney}
				pressed={hideMoney}
				onPressedChange={setHideMoney}
			/>
			<VisibilityToggle
				label="Hidden stations"
				actionLabel="Show hidden stations"
				visible={showHidden}
				pressed={showHidden}
				onPressedChange={setShowHidden}
			/>
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
