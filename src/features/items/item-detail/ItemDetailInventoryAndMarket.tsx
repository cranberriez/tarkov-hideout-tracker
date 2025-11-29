"use client";

import type { Dispatch, SetStateAction } from "react";
import type { MarketPrice } from "@/types";
import { MarketStatBox } from "./MarketStatBox";
import { Minus, Plus } from "lucide-react";

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
    renderMarketValue: (value?: number) => string;
    renderPercentChange: (value?: number) => string;
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
    renderMarketValue,
    renderPercentChange,
}: ItemDetailInventoryAndMarketProps) {
    const handleIncrement = (setter: Dispatch<SetStateAction<number>>, value: number) => {
        setter(value + 1);
    };

    const handleDecrement = (setter: Dispatch<SetStateAction<number>>, value: number) => {
        setter(Math.max(0, value - 1));
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
                                        Math.max(0, Number.parseInt(e.target.value || "0", 10))
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
                                        Math.max(0, Number.parseInt(e.target.value || "0", 10))
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
                    <div className="grid grid-cols-1 min-[480px]:grid-cols-2 gap-2 sm:gap-3">
                        <MarketStatBox
                            label="Current Price"
                            value={renderMarketValue(marketPrice?.price)}
                        />
                        <MarketStatBox
                            label="Avg 24h"
                            value={renderMarketValue(marketPrice?.avg24hPrice)}
                        />
                        <MarketStatBox
                            label="Change 24h"
                            value={renderPercentChange(marketPrice?.diff24h)}
                        />
                        <MarketStatBox
                            label="Avg 7 days"
                            value={renderMarketValue(marketPrice?.avg7daysPrice)}
                        />
                        <MarketStatBox
                            label="Last Updated"
                            value={
                                loading && !marketPrice ? "..." : relativeUpdatedAt ?? "-"
                            }
                        />
                        {marketPrice?.traderName && marketPrice.traderPrice !== undefined && (
                            <MarketStatBox
                                label={marketPrice.traderName}
                                value={renderMarketValue(marketPrice.traderPrice)}
                                labelClassName="text-blue-400"
                            />
                        )}
                    </div>
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
