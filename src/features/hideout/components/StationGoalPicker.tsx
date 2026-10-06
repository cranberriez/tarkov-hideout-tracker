"use client";

import { useId } from "react";
import { Check, Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResolvedStationGoal } from "@/lib/utils/station-goals";
import type { Station } from "@/types/hideout";

interface StationGoalPickerProps {
	station: Station;
	currentLevel: number;
	goal: ResolvedStationGoal;
	onGoalChange: (level: number | null) => void;
}

/** Ignore, each level, and King (max level, the default); levels up to the cap count as demand. */
export function StationGoalPicker({ station, currentLevel, goal, onGoalChange }: StationGoalPickerProps) {
	const name = useId();
	const maxLevel = station.levels.length;
	const selected = goal.goal === undefined || goal.goal >= maxLevel ? null : goal.goal;
	const options: { value: number | null; level: number; label: string }[] = [
		{ value: 0, level: 0, label: "Ignore" },
		...Array.from({ length: Math.max(0, maxLevel - 1) }, (_, index) => ({
			value: index + 1,
			level: index + 1,
			label: `Level ${index + 1}`,
		})),
		...(maxLevel > 0 ? [{ value: null, level: maxLevel, label: `King (level ${maxLevel})` }] : []),
	];
	const ownCap = goal.goal ?? maxLevel;

	return (
		<div className="space-y-2 px-3 py-3">
			<div
				role="radiogroup"
				aria-label={`${station.name} goal`}
				className="flex gap-1 rounded-sm border border-highlight/10 bg-shadow/40 p-1"
			>
				{options.map((option) => {
					const isSelected = option.value === selected;
					const isBuilt = option.level > 0 && option.level <= currentLevel;
					const isPlanned = option.level > currentLevel && option.level <= ownCap;
					const isRequired = option.level > ownCap && option.level <= goal.cap;
					return (
						<label key={option.label} title={option.label} className="relative flex flex-1 cursor-pointer">
							<input
								type="radio"
								name={name}
								checked={isSelected}
								onChange={() => onGoalChange(option.value)}
								className="peer sr-only"
								aria-label={option.label}
							/>
							<span
								className={cn(
									"flex h-7 flex-1 items-center justify-center gap-1 rounded-xs px-1.5 font-mono text-xs font-medium transition-all peer-focus-visible:outline-2 peer-focus-visible:outline-brand",
									isSelected
										? "bg-brand text-inverse shadow-sm"
										: isRequired
											? "bg-warning/15 text-warning hover:bg-warning/25"
											: isPlanned
												? "bg-brand/15 text-brand hover:bg-brand/25"
												: isBuilt
													? "text-subtle-foreground hover:bg-highlight/5"
													: "text-muted-foreground hover:bg-highlight/5 hover:text-foreground",
								)}
							>
								{option.value === 0 ? (
									<span className="font-sans">Ignore</span>
								) : option.value === null ? (
									<Crown size={13} aria-hidden="true" />
								) : (
									option.level
								)}
								{isBuilt && !isSelected && <Check size={10} aria-hidden="true" />}
							</span>
						</label>
					);
				})}
			</div>
			<p className="text-[11px] leading-snug text-muted-foreground">{describeGoal(goal, currentLevel, maxLevel)}</p>
		</div>
	);
}

function describeGoal(goal: ResolvedStationGoal, currentLevel: number, maxLevel: number) {
	const required = [...new Set(goal.requiredBy.map((entry) => `${entry.stationName} level ${entry.level}`))];
	const requiredText = required.length > 0 ? ` Raised for ${required.join(", ")}.` : "";
	if (currentLevel >= maxLevel) return "Fully upgraded.";
	if (goal.cap <= currentLevel)
		return goal.goal === 0
			? "Ignored. No upgrade items are counted."
			: "Goal reached. No more upgrade items are counted.";
	const range = goal.cap === currentLevel + 1 ? `level ${goal.cap}` : `levels ${currentLevel + 1}–${goal.cap}`;
	if (goal.goal === undefined || goal.goal >= maxLevel) return `Counting items for ${range} (King).`;
	return `Counting items for ${range}.${requiredText}`;
}
