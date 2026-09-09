import type { CurrentPrice, FleaPriceReason } from "@/types/prices";
import { formatCompactRoubles, getFleaPriceEstimate } from "@/lib/utils/market-price";

const reasonLabels: Record<FleaPriceReason, string> = {
    "insufficient-history": "Limited history",
    "sparse-offers": "Thin offers",
    "unknown-depth": "Offer count unknown",
    "divergent-reference": "Recent prices disagree",
    "price-jump": "Price move unconfirmed",
    "volatile-minimum": "Recent price swing ≥2×",
    "no-offers": "No offers",
    stale: "Price data over 72h old",
};

export function ItemDetailPriceStability({ marketPrice }: { marketPrice: CurrentPrice }) {
    const prices = [
        { label: "Estimate", value: getFleaPriceEstimate(marketPrice) },
        { label: "Latest low", value: marketPrice.lastLowPrice },
        { label: "Reported price", value: marketPrice.referencePrice },
    ].filter((entry): entry is { label: string; value: number } =>
        typeof entry.value === "number" && Number.isFinite(entry.value) && entry.value > 0,
    );
    const maximum = Math.max(...prices.map((entry) => entry.value));
    const reasons = [...new Set(marketPrice.fleaPriceReasons ?? [])];

    return (
        <div className="mt-2 space-y-2 rounded-md bg-warning/[0.04] px-2.5 py-2" aria-label="Price stability details">
            <div className="flex flex-wrap gap-x-2 gap-y-1 text-[10px] text-warning/90">
                {reasons.length ? reasons.map((reason) => (
                    <span key={reason}>{reasonLabels[reason]}</span>
                )) : <span>Stability details unavailable</span>}
            </div>
            {prices.length >= 2 && (
                <div className="space-y-1.5" aria-label="Price comparison, bars share a zero baseline">
                    {prices.map(({ label, value }) => (
                        <div key={label} className="grid grid-cols-[78px_minmax(0,1fr)_56px] items-center gap-2 text-[10px]">
                            <span className="text-muted-foreground">{label}</span>
                            <span className="h-1 overflow-hidden rounded-full bg-highlight/5" aria-hidden="true">
                                <span
                                    className={`block h-full rounded-full ${label === "Estimate" ? "bg-warning" : "bg-foreground/35"}`}
                                    style={{ width: `${value / maximum * 100}%` }}
                                />
                            </span>
                            <span className="text-right font-mono text-foreground/80">{formatCompactRoubles(value)} ₽</span>
                        </div>
                    ))}
                </div>
            )}
            {marketPrice.fleaSampleCount != null && (
                <div className="text-[9px] text-muted-foreground">
                    {marketPrice.fleaSampleCount} recent {marketPrice.fleaSampleCount === 1 ? "observation" : "observations"}
                </div>
            )}
        </div>
    );
}
