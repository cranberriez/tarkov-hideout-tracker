import { formatNumber } from "@/lib/utils/format-number";
import { formatDuration } from "@/lib/utils/format-time";
import { formatCompactRoubles } from "@/lib/utils/market-price";
import type { LevelOverviewRow, summarizeRemaining } from "../station-details-model";

interface SummaryColumn {
	heading: string;
	nonFirCost: number;
	firMissing: number;
	unpriced: number;
	constructionTime: number;
}

function cost(value: number, unpriced: number) {
	if (value === 0 && unpriced > 0) return "—";
	return `${formatCompactRoubles(value)} ₽${unpriced > 0 ? "+" : ""}`;
}

/** Data-only upgrade summary: buyable (non-FiR) cost, FiR still missing, and build time. */
export function LevelSummary({
	nextRow,
	remaining,
}: {
	nextRow: LevelOverviewRow | undefined;
	remaining: ReturnType<typeof summarizeRemaining>;
}) {
	if (!nextRow) return null;
	const columns: SummaryColumn[] = [
		{
			heading: `Level ${nextRow.level}`,
			nonFirCost: nextRow.nonFirCost,
			firMissing: nextRow.firMissing,
			unpriced: nextRow.unpricedItemIds.length + nextRow.unresolvedItemIds.length,
			constructionTime: nextRow.constructionTime,
		},
	];
	if (remaining.levelCount > 1) {
		columns.push({
			heading: `To level ${remaining.toLevel}`,
			nonFirCost: remaining.nonFirCost,
			firMissing: remaining.firMissing,
			unpriced: remaining.unpricedItemIds.length + remaining.unresolvedItemIds.length,
			constructionTime: remaining.constructionTime,
		});
	}
	const rows: Array<{ label: string; title: string; value: (column: SummaryColumn) => string }> = [
		{
			label: "Buy non-FiR",
			title: "Cost of missing items that do not need to be found in raid, including currency",
			value: (column) => cost(column.nonFirCost, column.unpriced),
		},
		{
			label: "FiR missing",
			title: "Found-in-raid units still missing",
			value: (column) => formatNumber(column.firMissing),
		},
		{
			label: "Build time",
			title: "Construction time before skill bonuses",
			value: (column) => (column.constructionTime > 0 ? formatDuration(column.constructionTime) : "Instant"),
		},
	];
	return (
		<table className="mt-3 w-full border-t border-highlight/8 text-xs">
			<thead>
				<tr>
					<th className="pb-1.5 pt-3 text-left font-normal" aria-label="Measure" />
					{columns.map((column) => (
						<th
							key={column.heading}
							scope="col"
							className="pb-1.5 pt-3 text-right text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground"
						>
							{column.heading}
						</th>
					))}
				</tr>
			</thead>
			<tbody>
				{rows.map((row) => (
					<tr key={row.label} title={row.title}>
						<th scope="row" className="py-1 text-left font-normal text-muted-foreground">
							{row.label}
						</th>
						{columns.map((column) => (
							<td key={column.heading} className="py-1 text-right font-mono text-foreground">
								{row.value(column)}
							</td>
						))}
					</tr>
				))}
			</tbody>
		</table>
	);
}
