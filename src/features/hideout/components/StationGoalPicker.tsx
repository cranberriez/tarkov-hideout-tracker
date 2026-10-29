"use client";

import { useId, type ReactNode } from "react";
import { Ban, Check, Flag, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ResolvedStationGoal } from "@/lib/utils/station-goals";
import type { Station } from "@/types/hideout";

const pipStyles = {
	built: "bg-highlight/10 text-muted-foreground",
	counted: "border border-brand/50 text-brand",
	required: "border border-warning/50 bg-warning/10 text-warning",
	skipped: "border border-dashed border-highlight/20 text-subtle-foreground",
};
const pipBase = "flex items-center justify-center rounded-xs font-mono text-xs";

interface StationGoalPickerProps {
	station: Station;
	currentLevel: number;
	goal: ResolvedStationGoal;
	onGoalChange: (level: number | null) => void;
}

/** One pip per level plus Ignore; picking the current goal again clears it (unset counts every level). */
export function StationGoalPicker({ station, currentLevel, goal, onGoalChange }: StationGoalPickerProps) {
	const name = useId();
	const maxLevel = station.levels.length;
	const ownCap = goal.goal ?? maxLevel;
	const levels = Array.from({ length: maxLevel }, (_, index) => index + 1);
	const select = (level: number) => onGoalChange(goal.goal === level ? null : level);

	return (
		<div role="radiogroup" aria-label={`${station.name} goal`} className="flex items-center gap-1.5 px-3 py-3">
			{levels.map((level) => {
				const isGoal = goal.goal === level;
				const isBuilt = level <= currentLevel;
				const isRequired = !isBuilt && level > ownCap && level <= goal.cap;
				const isCounted = !isBuilt && level <= ownCap;
				const neededFor = isRequired
					? [
							...new Set(
								goal.requiredBy
									.filter((entry) => entry.stationId !== station.id && entry.requiredLevel >= level)
									.map((entry) => `${entry.stationName} ${entry.level}`),
							),
						]
					: [];
				const label = `Level ${level}`;
				return (
					<GoalOption
						key={level}
						name={name}
						label={label}
						title={neededFor.length > 0 ? `${label} · needed for ${neededFor.join(", ")}` : label}
						checked={isGoal}
						onSelect={() => select(level)}
						className={cn(
							pipStyles[isBuilt ? "built" : isRequired ? "required" : isCounted ? "counted" : "skipped"],
							isGoal && "ring-1 ring-brand",
						)}
					>
						{isGoal ? (
							<Flag size={13} aria-hidden="true" />
						) : isBuilt ? (
							<Check size={13} aria-hidden="true" />
						) : isRequired ? (
							<Link2 size={13} aria-hidden="true" />
						) : (
							level
						)}
					</GoalOption>
				);
			})}
			<div className="ml-auto flex">
				<GoalOption
					name={name}
					label="Ignore"
					title="Ignore"
					checked={goal.goal === 0}
					onSelect={() => select(0)}
					className={
						goal.goal === 0
							? "bg-highlight/15 text-foreground ring-1 ring-highlight/40"
							: "text-subtle-foreground hover:text-foreground"
					}
				>
					<Ban size={14} aria-hidden="true" />
				</GoalOption>
			</div>
		</div>
	);
}

function GoalOption({
	name,
	label,
	title,
	checked,
	onSelect,
	className,
	children,
}: {
	name: string;
	label: string;
	title: string;
	checked: boolean;
	onSelect: () => void;
	className: string;
	children: ReactNode;
}) {
	return (
		<label title={title} className="relative flex cursor-pointer">
			{/* onClick, not onChange: clicking the checked option clears the goal. */}
			<input
				type="radio"
				name={name}
				checked={checked}
				onChange={() => {}}
				onClick={onSelect}
				className="peer sr-only"
				aria-label={label}
			/>
			<span
				className={cn(
					pipBase,
					"size-7 transition-colors hover:brightness-125 peer-focus-visible:outline-2 peer-focus-visible:outline-brand",
					className,
				)}
			>
				{children}
			</span>
		</label>
	);
}

const keyEntries = [
	{ style: pipStyles.built, icon: <Check size={11} aria-hidden="true" />, label: "Built" },
	{ style: pipStyles.counted, icon: "2", label: "Counted" },
	{ style: pipStyles.required, icon: <Link2 size={11} aria-hidden="true" />, label: "Needed by another goal" },
	{ style: pipStyles.skipped, icon: "3", label: "Skipped" },
];

/** Legend for the automatic pip states. */
export function StationGoalKey() {
	return (
		<ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
			{keyEntries.map((entry) => (
				<li key={entry.label} className="flex items-center gap-1.5 text-muted-foreground">
					<span aria-hidden="true" className={cn(pipBase, "size-5 text-[10px]", entry.style)}>
						{entry.icon}
					</span>
					{entry.label}
				</li>
			))}
		</ul>
	);
}
