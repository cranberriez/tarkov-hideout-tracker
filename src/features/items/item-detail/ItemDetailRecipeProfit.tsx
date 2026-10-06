import { Maximize2 } from "lucide-react";
import type { RecipeEvaluation } from "@/lib/price-calculation";
import { formatCompactRoubles } from "@/lib/utils/market-price";
import { useUIStore } from "@/lib/stores/useUIStore";
import type { ItemSummary } from "@/types/items";

export function ItemDetailRecipeProfit({
	evaluation,
	recipeId,
	kind,
	outputItem,
	loading,
	error,
	onRetry,
	linkOnly = false,
}: {
	evaluation?: RecipeEvaluation;
	recipeId: string;
	kind: "barter" | "craft";
	/** The recipe's output; its graph backs the breakdown view. */
	outputItem: ItemSummary;
	loading: boolean;
	error: string | null;
	onRetry?: () => void;
	/** Show only the expand action (no metrics), for recipes whose profit graph is not loaded. */
	linkOnly?: boolean;
}) {
	const link = (
		<ExpandBreakdownButton onClick={() => useUIStore.getState().openRecipeBreakdown({ kind, recipeId, outputItem })} />
	);
	if (linkOnly) return <div className="ml-auto shrink-0">{link}</div>;

	return (
		<div className="flex w-full items-center gap-x-4 sm:ml-auto sm:w-auto sm:justify-end">
			<div className="flex min-w-0 flex-1 flex-wrap items-end gap-x-4 gap-y-2 sm:flex-none sm:flex-nowrap">
				{loading ? (
					<span className="text-[11px] text-muted-foreground">Calculating profit and ingredient routes…</span>
				) : error ? (
					<span className="flex items-center gap-2 text-[11px] text-warning">
						{error}
						{onRetry && (
							<button
								type="button"
								onClick={onRetry}
								className="rounded border border-warning/30 px-1.5 py-0.5 hover:bg-warning/10"
							>
								{error.startsWith("The data release changed") ? "Refresh page" : "Try again"}
							</button>
						)}
					</span>
				) : evaluation ? (
					<>
						<Metric label="Cost" value={formatPrice(evaluation.cost)} />
						<Metric label="Profit" value={formatSignedPrice(evaluation.profit)} tone={profitTone(evaluation.profit)} />
						{kind === "craft" && (
							<Metric
								label="Profit / hour"
								value={formatSignedPrice(evaluation.profitPerHour)}
								tone={profitTone(evaluation.profitPerHour)}
							/>
						)}
					</>
				) : (
					<span className="text-[11px] text-muted-foreground">Profit data is unavailable.</span>
				)}
			</div>
			{link}
		</div>
	);
}

/** Swaps the item dialog to this recipe's profit breakdown (Back returns). */
function ExpandBreakdownButton({ onClick }: { onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Show profit breakdown"
			title="Profit breakdown"
			className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-highlight/[0.06] hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
		>
			<Maximize2 size={14} aria-hidden="true" />
		</button>
	);
}

function Metric({ label, value, tone = "text-foreground" }: { label: string; value: string; tone?: string }) {
	return (
		<span className="flex min-w-0 flex-col whitespace-nowrap">
			<span className="text-[10px] font-medium uppercase tracking-wide text-foreground/70">{label}</span>
			<span className={`flex items-center gap-1 font-mono text-xs font-semibold ${tone}`}>{value}</span>
		</span>
	);
}

function formatPrice(value: number | null) {
	return value === null ? "—" : `${formatCompactRoubles(Math.round(value))} ₽`;
}

function formatSignedPrice(value: number | null) {
	if (value === null) return "—";
	return `${value > 0 ? "+" : ""}${formatCompactRoubles(Math.round(value))} ₽`;
}

function profitTone(value: number | null) {
	if (value === null || value === 0) return "text-muted-foreground";
	return value > 0 ? "text-success" : "text-danger";
}
