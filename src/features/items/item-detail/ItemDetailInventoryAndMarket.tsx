"use client";

import type { Dispatch, SetStateAction } from "react";
import type { MarketPrice } from "@/types";
import { MarketStatBox } from "./MarketStatBox";
import { Minus, Plus } from "lucide-react";
import { formatRoubles, hasFleaMarketData } from "@/lib/utils/market-price";

interface ItemDetailInventoryAndMarketProps {
    isFiat: boolean;
    marketPrice: MarketPrice | null | undefined;
    loading: boolean;
    relativeUpdatedAt: string | null;
    draftNonFir: number;
    draftFir: number;
    setDraftNonFir: Dispatch<SetStateAction<number>>;
    setDraftFir: Dispatch<SetStateAction<number>>;
    hasInventoryChanges: boolean;
    onCancelChanges: () => void;
    onConfirmChanges: () => void;
    valuationCount: number;
    renderMarketValue: (value?: number | null) => string;
    renderPercentChange: (value?: number | null) => string;
}

export function ItemDetailInventoryAndMarket({
    isFiat,
    marketPrice,
    loading,
    relativeUpdatedAt,
    draftNonFir,
    draftFir,
    setDraftNonFir,
    setDraftFir,
    hasInventoryChanges,
    onCancelChanges,
    onConfirmChanges,
    valuationCount,
    renderMarketValue,
    renderPercentChange,
}: ItemDetailInventoryAndMarketProps) {
    const fleaUnavailable = !!marketPrice && !hasFleaMarketData(marketPrice);
    const traderValuationCount = Math.max(1, Math.floor(valuationCount));
    const topTraderValuations = (marketPrice?.sellFor ?? [])
        .filter((offer) => offer.priceRUB > 0 && offer.vendor.normalizedName !== "flea-market")
        .sort((a, b) => b.priceRUB - a.priceRUB)
        .slice(0, 3);

    const handleIncrement = (setter: Dispatch<SetStateAction<number>>, value: number) => {
        setter(value + 1);
    };

    const handleDecrement = (setter: Dispatch<SetStateAction<number>>, value: number) => {
        setter(Math.max(0, value - 1));
    };

    const formatDollars = (value: number | null | undefined) => {
        if (value == null || Number.isNaN(value)) return "-";
        return `$${new Intl.NumberFormat("en-US").format(value)}`;
    };

    return (
        <div className="space-y-6">
            <div className="bg-card/40 border border-border-color rounded-md p-4 space-y-3 shadow-sm">
                <h3 className="text-base font-semibold text-foreground">Inventory</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-muted-foreground text-sm">Non-FiR count</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handleDecrement(setDraftNonFir, draftNonFir)}
                                className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                                type="button"
                            >
                                <Minus size={14} />
                            </button>
                            <input
                                type="number"
                                min={0}
                                value={draftNonFir}
                                onChange={(e) =>
                                    setDraftNonFir(
                                        Math.max(0, Number.parseInt(e.target.value || "0", 10)),
                                    )
                                }
                                className="w-16 bg-black/40 border border-border-color px-1.5 py-1 rounded text-center font-mono text-sm text-foreground focus:ring-1 focus:ring-primary"
                            />
                            <button
                                onClick={() => handleIncrement(setDraftNonFir, draftNonFir)}
                                className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                                type="button"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-orange-400 text-sm">FiR count</span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handleDecrement(setDraftFir, draftFir)}
                                className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                                type="button"
                            >
                                <Minus size={14} />
                            </button>
                            <input
                                type="number"
                                min={0}
                                value={draftFir}
                                onChange={(e) =>
                                    setDraftFir(
                                        Math.max(0, Number.parseInt(e.target.value || "0", 10)),
                                    )
                                }
                                className="w-16 bg-black/40 border border-orange-500 px-1.5 py-1 rounded text-center font-mono text-sm text-foreground focus:ring-1 focus:ring-primary"
                            />
                            <button
                                onClick={() => handleIncrement(setDraftFir, draftFir)}
                                className="p-1 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded transition-colors"
                                type="button"
                            >
                                <Plus size={14} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border-color mt-2">
                        <button
                            type="button"
                            onClick={onCancelChanges}
                            className="px-3 py-1 text-xs rounded border border-border-color text-muted-foreground hover:bg-white/5 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={onConfirmChanges}
                            disabled={!hasInventoryChanges}
                            className="px-3 py-1 text-xs rounded border border-sky-500/60 bg-sky-600/70 text-white hover:bg-sky-500/80 transition-colors disabled:opacity-50"
                        >
                            Confirm Changes
                        </button>
                    </div>
                </div>
            </div>

            <div>
                <h3 className="text-base sm:text-lg font-semibold text-foreground mb-3 sm:mb-4">
                    Market Data
                </h3>

                {!isFiat ? (
                    <>
                        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2 sm:gap-3">
                            <MarketStatBox
                                label="Last Low"
                                value={
                                    fleaUnavailable
                                        ? "No flea"
                                        : renderMarketValue(marketPrice?.price)
                                }
                            />
                            <MarketStatBox
                                label="Avg 24h"
                                value={renderMarketValue(marketPrice?.avg24hPrice)}
                            />
                            <MarketStatBox
                                label="Low 24h"
                                value={renderMarketValue(marketPrice?.low24hPrice)}
                            />
                            <MarketStatBox
                                label="High 24h"
                                value={renderMarketValue(marketPrice?.high24hPrice)}
                            />
                            <MarketStatBox
                                label="Change 48h"
                                value={renderPercentChange(marketPrice?.changeLast48hPercent)}
                            />
                            <MarketStatBox
                                label="Offers"
                                value={
                                    marketPrice?.lastOfferCount == null
                                        ? "-"
                                        : new Intl.NumberFormat("en-US").format(
                                              marketPrice.lastOfferCount,
                                          )
                                }
                            />
                        </div>
                        {topTraderValuations.length > 0 && (
                            <div className="mt-2 flex flex-col gap-1">
                                {topTraderValuations.map((offer) => {
                                    const isPeacekeeper =
                                        offer.vendor.normalizedName === "peacekeeper" ||
                                        offer.currency === "USD";
                                    const totalPrice = offer.price * traderValuationCount;
                                    const totalRoubles = offer.priceRUB * traderValuationCount;

                                    return (
                                        <div
                                            key={offer.vendor.normalizedName}
                                            className="flex min-w-0 items-center gap-1.5 text-xs"
                                        >
                                            {offer.vendor.imageLink ? (
                                                <img
                                                    src={offer.vendor.imageLink}
                                                    alt={offer.vendor.name}
                                                    className="h-4 w-4 shrink-0 rounded-full object-cover"
                                                />
                                            ) : (
                                                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/10 text-[9px] text-gray-500">
                                                    {offer.vendor.name[0]}
                                                </span>
                                            )}
                                            <span className="min-w-0 truncate text-gray-400">
                                                {offer.vendor.name}
                                            </span>
                                            <span className="shrink-0 font-mono text-white">
                                                {isPeacekeeper
                                                    ? `${formatDollars(totalPrice)} (${formatRoubles(
                                                          totalRoubles,
                                                      )})`
                                                    : formatRoubles(totalRoubles)}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        <div className="mt-2 text-[11px] text-muted-foreground">
                            Last updated:{" "}
                            {loading && !marketPrice ? "..." : (relativeUpdatedAt ?? "-")}
                        </div>
                    </>
                ) : (
                    <MarketStatBox
                        label="Rouble Cost"
                        value={renderMarketValue(marketPrice?.price)}
                    />
                )}
            </div>
        </div>
    );
}
