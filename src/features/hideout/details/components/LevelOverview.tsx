"use client";

import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/utils/format-time";
import { formatCompactRoubles } from "@/lib/utils/market-price";
import type { LevelSelection } from "../StationDetailsContext";
import type { LevelOverviewRow, LevelState, summarizeRemaining } from "../station-details-model";

/** Built: filled green. Next: hollow dashed ring (green once ready). Locked: no dot. */
const STATE: Record<LevelState, { label: string; dot: string | null; meta: string }> = {
	built: { label: "Built", dot: "bg-success", meta: "text-success" },
	ready: { label: "Ready", dot: "border border-dashed border-success", meta: "text-success" },
	next: { label: "Next", dot: "border border-dashed border-info", meta: "text-info" },
	locked: { label: "Locked", dot: null, meta: "text-muted-foreground" },
};

function costLabel(remaining: number, unpriced: number) {
	if (remaining === 0 && unpriced > 0) return "—";
	if (remaining === 0) return "Covered";
	return `${formatCompactRoubles(remaining)} ₽${unpriced > 0 ? "+" : ""}`;
}

interface Tab {
	value: LevelSelection;
	label: string;
	dot: string | null;
	meta: string;
	metaClassName: string;
	title: string;
}

/** Compact level tabs: state dot, then state and remaining cost on one small line. */
export function LevelOverview({
	stationName,
	rows,
	remaining,
	selection,
	onSelect,
}: {
	stationName: string;
	rows: readonly LevelOverviewRow[];
	remaining: ReturnType<typeof summarizeRemaining>;
	selection: LevelSelection;
	onSelect: (selection: LevelSelection) => void;
}) {
	const tabs: Tab[] = rows.map((row) => {
		const state = STATE[row.state];
		const unpriced = row.unpricedItemIds.length + row.unresolvedItemIds.length;
		const cost = costLabel(row.remaining, unpriced);
		return {
			value: row.level,
			label: `Level ${row.level}`,
			dot: state.dot,
			// Non-breaking space keeps every tab the same height.
			meta: row.state === "built" ? "\u00a0" : cost,
			metaClassName: state.meta,
			title: [
				`Level ${row.level}: ${state.label}`,
				row.constructionTime > 0 ? formatDuration(row.constructionTime) : "instant build",
				unpriced > 0 ? `${unpriced} item${unpriced === 1 ? "" : "s"} without a price` : null,
			]
				.filter(Boolean)
				.join(" · "),
		};
	});
	if (remaining.levelCount > 1) {
		const unpriced = remaining.unpricedItemIds.length + remaining.unresolvedItemIds.length;
		tabs.push({
			value: "remaining",
			label: "All remaining",
			dot: null,
			meta: costLabel(remaining.remaining, unpriced),
			metaClassName: "text-muted-foreground",
			title: `Levels ${remaining.fromLevel}–${remaining.toLevel} · ${formatDuration(remaining.constructionTime)}`,
		});
	}
	return (
		<div
			role="radiogroup"
			aria-label={`${stationName} level to view`}
			className="flex overflow-x-auto overflow-y-hidden border-b border-highlight/8"
		>
			{tabs.map((tab) => {
				const selected = selection === tab.value;
				return (
					<button
						key={String(tab.value)}
						type="button"
						role="radio"
						aria-checked={selected}
						title={tab.title}
						onClick={() => onSelect(tab.value)}
						className={cn(
							"relative flex shrink-0 flex-col items-start gap-0.5 px-3.5 pb-2.5 pt-3 text-left transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand",
							selected ? "bg-highlight/4 text-foreground" : "text-muted-foreground hover:bg-highlight/3 hover:text-foreground",
							tab.value === "remaining" && "ml-auto",
						)}
					>
						<span className="flex items-center gap-1.5 text-sm font-semibold">
							{tab.dot && <span aria-hidden="true" className={cn("size-2 rounded-full", tab.dot)} />}
							{tab.label}
						</span>
						<span className={cn("font-mono text-[10px]", tab.metaClassName)}>{tab.meta}</span>
						{selected && <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-0.5 bg-brand" />}
					</button>
				);
			})}
		</div>
	);
}
