import { Circle, CircleCheck } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { GatheringBreakpoint } from "../lib/gathering-savings-model";
import { useBattlePassPlanContext } from "../useBattlePassPlan";
import { liftedControl, syncValue } from "./ui/field";

const usd = (cents: number) =>
	new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
const days = (count: number) => `${count} ${count === 1 ? "day" : "days"}`;
/** Breakpoints shown before "More": the first few, plus the recommended and chosen ones. */
const VISIBLE = 2;
/** At most this many extra options are shown directly instead of behind "More". */
const MAX_REVEALED_INLINE = 2;

/** Choose how much to gather: no gathering or one of the cash breakpoints. */
export function GatheringTargetPicker() {
	const target = useBattlePassPlanContext().gathering;
	const [more, setMore] = useState(false);
	const { breakpoints, recommended, selected, baselineCents } = target;
	if (baselineCents === null || !breakpoints.length) return null;
	const pinned = new Set([...breakpoints.slice(0, VISIBLE), recommended, selected].filter(Boolean));
	// Hiding only one or two options is not worth a button.
	const hidden = breakpoints.filter((point) => !pinned.has(point));
	const rest = hidden.length > MAX_REVEALED_INLINE ? hidden : [];
	const shown = more || !rest.length ? breakpoints : breakpoints.filter((point) => pinned.has(point));
	const option = (point: GatheringBreakpoint | undefined) => {
		const active = point === selected;
		const Check = active ? CircleCheck : Circle;
		return (
			<button
				key={point?.gathered ?? 0}
				type="button"
				role="radio"
				aria-checked={active}
				onClick={() => target.select(point?.gathered ?? 0)}
				className={cn(
					"group flex w-full items-start gap-2 rounded-lg p-3 text-left text-xs focus-visible:outline-2 focus-visible:outline-brand",
					liftedControl,
					active &&
						"bg-[color-mix(in_oklab,var(--brand)_4%,var(--surface-raised))] hover:bg-[color-mix(in_oklab,var(--brand)_7%,var(--surface-raised))]",
				)}
			>
				<Check
					className={cn(
						"mt-0.5 size-4 shrink-0",
						active ? "text-brand" : "text-muted-foreground group-hover:text-foreground",
					)}
					aria-hidden
				/>
				<span className="min-w-0 space-y-1">
					<span className="flex flex-wrap items-center gap-1.5 text-sm font-semibold">
						{point ? `Gather ${point.gathered}` : "No gathering"}
						{point && point === recommended && (
							<span className="rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-medium text-success">
								Recommended
							</span>
						)}
					</span>
					<span className="block tabular-nums">
						Pay {usd(point ? point.cashCents : baselineCents)}
						{point && <span className="text-success"> · save {usd(point.savingsCents)}</span>}
					</span>
					<span className="block text-muted-foreground">
						{point
							? point.windows.map((row) => `${row.profileLabel} ${row.quantity}`).join(", ") +
								` · ${days(point.parallelWindows)}`
							: "Buy every missing document"}
					</span>
				</span>
			</button>
		);
	};
	return (
		<section data-syncing={target.stale || undefined} className="group/sync w-full space-y-3">
			<div className="space-y-1">
				<h4 className="text-sm font-semibold">Gathering target</h4>
				<p className="text-xs leading-relaxed text-muted-foreground">
					Each option is the next drop in what you pay. The step plan follows your choice.
				</p>
			</div>
			<div
				className={cn("grid grid-cols-2 gap-2 lg:grid-cols-4", syncValue)}
				role="radiogroup"
				aria-label="Gathering target"
			>
				{option(undefined)}
				{shown.map(option)}
				{rest.length > 0 && (
					<button
						type="button"
						aria-expanded={more}
						onClick={() => setMore(!more)}
						className={cn(
							"h-8 self-center justify-self-start rounded-md px-3 text-xs font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-brand",
							liftedControl,
						)}
					>
						{more ? "Show fewer" : `${rest.length} more options`}
					</button>
				)}
			</div>
		</section>
	);
}
