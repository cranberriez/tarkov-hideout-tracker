"use client";

import type { CurrentPrice } from "@/types/prices";
import { ArrowDownRight, ArrowUpRight, Check, Clock3, Store, X } from "lucide-react";
import { formatRoubles, getFleaPriceEstimate, hasFleaMarketData } from "@/lib/utils/market-price";
import { InfoHint } from "@/features/profit-pages/components/InfoHint";
import { ItemDetailSection } from "./ItemDetailSection";

interface ItemDetailMarketProps {
    marketPrice: CurrentPrice;
    relativeUpdatedAt: string | null;
    valuationCount: number;
    isFiat: boolean;
    minLevelForFlea?: number | null;
    playerLevel: number;
}

export function hasItemMarketData(marketPrice: CurrentPrice | null | undefined) {
    return Boolean(
        marketPrice &&
            (hasFleaMarketData(marketPrice) ||
                marketPrice.lastOfferCount != null ||
                marketPrice.sellFor?.some((offer) => offer.priceRUB > 0)),
    );
}

export function ItemDetailMarket({
    marketPrice,
    relativeUpdatedAt,
    valuationCount,
    isFiat,
    minLevelForFlea,
    playerLevel,
}: ItemDetailMarketProps) {
    if (!hasItemMarketData(marketPrice)) return null;

    const hasFleaData = hasFleaMarketData(marketPrice);
    const canSellOnFlea = minLevelForFlea != null && playerLevel >= minLevelForFlea;
    const fleaPrice = getFleaPriceEstimate(marketPrice);
    const unstable = !isFiat && marketPrice.fleaStability === "unstable";
    const traderValuationCount = Math.max(1, Math.floor(valuationCount));
    const topTraderValuations = (marketPrice.sellFor ?? [])
        .filter((offer) => offer.priceRUB > 0 && offer.vendor.normalizedName !== "flea-market")
        .sort((a, b) => b.priceRUB - a.priceRUB)
        .slice(0, 3);
    const details = [
        marketPrice.referencePrice != null
            ? { label: "Latest aggregate", value: formatRoubles(marketPrice.referencePrice) }
            : null,
        marketPrice.avg24hPrice != null
            ? { label: "Catalog 24h average", value: formatRoubles(marketPrice.avg24hPrice) }
            : null,
        marketPrice.lastLowPrice != null
            ? { label: "Latest minimum", value: formatRoubles(marketPrice.lastLowPrice) }
            : null,
        marketPrice.low24hPrice != null
            ? { label: "24h low", value: formatRoubles(marketPrice.low24hPrice) }
            : null,
        marketPrice.high24hPrice != null
            ? { label: "24h high", value: formatRoubles(marketPrice.high24hPrice) }
            : null,
    ].filter((detail): detail is { label: string; value: string } => Boolean(detail));

    return (
        <ItemDetailSection
            title={isFiat ? "Exchange value" : "Market"}
            className="border-t border-border-color"
            aside={
                <div className="flex items-center gap-2">
                    {!isFiat && (minLevelForFlea != null || !hasFleaData) && (
                        minLevelForFlea != null && hasFleaData ? (
                            <span className="flex items-center gap-1 rounded bg-white/[0.03] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
                                LVL {minLevelForFlea}
                                {canSellOnFlea ? (
                                    <Check size={11} strokeWidth={2.5} className="text-green-400" />
                                ) : (
                                    <X size={11} strokeWidth={2.5} className="text-red-400" />
                                )}
                            </span>
                        ) : (
                            <span className="rounded bg-red-400/8 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-red-300/90">
                                No flea
                            </span>
                        )
                    )}
                    {relativeUpdatedAt && (
                        <span className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                            <Clock3 size={11} /> {relativeUpdatedAt}
                        </span>
                    )}
                </div>
            }
        >
            {fleaPrice != null && (
                <div className="flex items-end justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-4 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            <span>{isFiat ? "Rouble cost" : "Flea estimate"}</span>
                            {!isFiat && marketPrice.lastOfferCount != null && (
                                <span className="text-right">
                                    {`${new Intl.NumberFormat("en-US").format(marketPrice.lastOfferCount)} offers`}
                                </span>
                            )}
                        </div>
                        <div className={`mt-1 flex items-center gap-1.5 font-mono text-2xl font-semibold ${unstable ? "text-amber-300" : "text-foreground"}`}>
                            {formatRoubles(fleaPrice)}
                            {unstable && <InfoHint title="Value unstable" tone="warning" compact />}
                        </div>
                    </div>
                    {marketPrice.changeLast48hPercent != null && (
                        <PriceChange value={marketPrice.changeLast48hPercent} />
                    )}
                </div>
            )}

            {!isFiat && marketPrice.fleaStability === "unavailable" && (
                <div className="mt-2 text-xs text-muted-foreground">Flea unavailable{marketPrice.lastOfferCount != null ? ` · ${marketPrice.lastOfferCount} offers` : ""}</div>
            )}

            {details.length > 0 && !isFiat && (
                <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border-color bg-border-color">
                    {details.map((detail) => (
                        <div key={detail.label} className="bg-black/25 px-3 py-2.5">
                            <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                {detail.label}
                            </div>
                            <div className="mt-1 font-mono text-sm text-foreground">
                                {detail.value}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {topTraderValuations.length > 0 && (
                <div className="mt-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                        <Store size={12} /> Trader value
                    </div>
                    <div className="space-y-1.5">
                        {topTraderValuations.map((offer) => {
                            const totalRoubles = offer.priceRUB * traderValuationCount;
                            return (
                                <div
                                    key={offer.vendor.normalizedName}
                                    className="flex min-w-0 items-center gap-2 rounded-md px-1 py-1 text-xs"
                                >
                                    {offer.vendor.imageLink && (
                                        <img
                                            src={offer.vendor.imageLink}
                                            alt=""
                                            className="h-5 w-5 shrink-0 rounded-full object-cover"
                                        />
                                    )}
                                    <span className="min-w-0 flex-1 truncate text-muted-foreground">
                                        {offer.vendor.name}
                                    </span>
                                    <span className="shrink-0 font-mono text-foreground">
                                        {formatRoubles(totalRoubles)}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </ItemDetailSection>
    );
}

function PriceChange({ value }: { value: number }) {
    const positive = value >= 0;
    const Icon = positive ? ArrowUpRight : ArrowDownRight;
    return (
        <span
            className={`flex items-center gap-1 rounded-md px-2 py-1 font-mono text-xs ${
                positive
                    ? "bg-tarkov-green/10 text-tarkov-green"
                    : "bg-red-400/10 text-red-300"
            }`}
        >
            <Icon size={13} />
            {Math.abs(value).toFixed(2)}%
        </span>
    );
}
