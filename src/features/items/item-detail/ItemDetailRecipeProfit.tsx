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
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div className="grid grid-cols-2 gap-x-5 gap-y-1 sm:grid-cols-4">
                {loading ? (
                    <span className="col-span-2 text-[11px] text-muted-foreground">Calculating profit and ingredient routes…</span>
                ) : error ? (
                    <span className="col-span-2 text-[11px] text-amber-200">{error}</span>
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
                    <span className="col-span-2 text-[11px] text-muted-foreground">Profit data is unavailable.</span>
                )}
            </div>

            <Link
                href={`${route}?recipe=${encodeURIComponent(recipeId)}`}
                className="inline-flex shrink-0 items-center gap-1.5 self-start rounded border border-white/10 bg-white/[0.035] px-2.5 py-1.5 text-[10px] font-semibold text-foreground transition-colors hover:border-tarkov-green/40 hover:text-tarkov-green sm:self-auto"
            >
                Full profit details
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
        <span className="flex min-w-0 flex-col">
            <span className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</span>
            <span className={`font-mono text-[11px] font-semibold ${tone}`}>{value}</span>
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
