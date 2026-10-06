import { QuestLink } from "@/components/entities/quest-link";
import { StationLink } from "@/components/entities/station-link";
import { cn } from "@/lib/utils";
import type { SaveReason } from "./item-demand-model";

const linkClass = "transition-colors hover:text-brand";

/**
 * One hideout, quest, or Kappa use of an item, with when it applies. `compact` puts
 * the timing in a fixed leading column so stacked lines align; `linked` makes the
 * station or quest a previewing link.
 */
export function DemandReasonLine({
	reason,
	compact = false,
	linked = false,
}: {
	reason: SaveReason;
	compact?: boolean;
	linked?: boolean;
}) {
	const label =
		linked && reason.station ? (
			<StationLink station={reason.station} className={linkClass}>
				{reason.label}
			</StationLink>
		) : linked && reason.questId ? (
			<QuestLink
				questId={reason.questId}
				name={reason.kind === "kappa" ? "The Collector" : reason.label}
				className={linkClass}
			>
				{reason.label}
			</QuestLink>
		) : (
			reason.label
		);
	const timing = (
		<span
			className={cn(
				"shrink-0 text-[10px] font-semibold uppercase tracking-wide",
				reason.now ? "text-brand" : "text-subtle-foreground",
				compact && "w-10 text-right",
			)}
		>
			{reason.now ? "Now" : reason.minPlayerLevel ? `Lvl ${reason.minPlayerLevel}` : "Later"}
		</span>
	);
	return (
		<li
			className={cn(
				"flex items-baseline gap-2",
				compact ? "py-px text-[11px]" : "justify-between text-xs",
			)}
		>
			{compact && timing}
			<span
				className={cn(
					"min-w-0",
					reason.kind === "kappa" ? "text-special" : "text-foreground",
					compact && linked && "text-xs",
				)}
			>
				{label}
				<span className="ml-1.5 text-[11px] text-muted-foreground">
					{reason.options
						? `${reason.filled} of ${reason.count} · any of ${reason.options}`
						: `×${reason.count}${reason.tool ? " · tool" : ""}`}
					{reason.firCount > 0 && <span className="text-fir"> · FIR</span>}
				</span>
			</span>
			{!compact && timing}
		</li>
	);
}
