import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { RecipeEvaluation } from "@/lib/price-calculation";
import { formatCompactRoubles } from "@/lib/utils/market-price";

export function ItemDetailRecipeProfit({
    evaluation,
    recipeId,
    kind,
    loading,
    error,
}: {
    evaluation?: RecipeEvaluation;
    recipeId: string;
    kind: "barter" | "craft";
    loading: boolean;
    error: string | null;
}) {
    const route = kind === "barter" ? "/items/barter-profits" : "/items/crafting-profits";

    return (
        <div className="flex w-full flex-wrap items-end gap-x-4 gap-y-2 sm:ml-auto sm:w-auto sm:flex-nowrap sm:justify-end">
            <div className="flex flex-wrap items-end gap-x-4 gap-y-2 sm:flex-nowrap">
                {loading ? (
                    <span className="text-[11px] text-muted-foreground">
                        Calculating profit and ingredient routes…
                    </span>
                ) : error ? (
                    <span className="text-[11px] text-amber-200">{error}</span>
                ) : evaluation ? (
                    <>
                        <Metric label="Cost" value={formatPrice(evaluation.cost)} />
                        <Metric label="Sell value" value={formatPrice(evaluation.sellValue)} />
                        <Metric
                            label="Profit"
                            value={formatSignedPrice(evaluation.profit)}
                            tone={profitTone(evaluation.profit)}
                        />
                        {kind === "craft" && (
                            <Metric
                                label="Profit / hour"
                                value={formatSignedPrice(evaluation.profitPerHour)}
                                tone={profitTone(evaluation.profitPerHour)}
                            />
                        )}
                    </>
                ) : (
                    <span className="text-[11px] text-muted-foreground">
                        Profit data is unavailable.
                    </span>
                )}
            </div>

            <Link
                href={`${route}?recipe=${encodeURIComponent(recipeId)}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:border-tarkov-green/40 hover:text-tarkov-green"
            >
                Profit breakdown
                <ExternalLink size={11} />
            </Link>
        </div>
    );
}

function Metric({
    label,
    value,
    tone = "text-foreground",
}: {
    label: string;
    value: string;
    tone?: string;
}) {
    return (
        <span className="flex min-w-0 flex-col whitespace-nowrap">
            <span className="text-[10px] font-medium uppercase tracking-wide text-foreground/70">
                {label}
            </span>
            <span className={`flex items-center gap-1 font-mono text-xs font-semibold ${tone}`}>
                {value}
            </span>
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
    return value > 0 ? "text-tarkov-green" : "text-red-300";
}
