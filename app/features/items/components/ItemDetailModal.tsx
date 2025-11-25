"use client";

import { useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ItemDetails, Station } from "@/app/types";
import { X, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { stationOrder } from "@/app/lib/cfg/stationOrder";

interface ItemDetailModalProps {
    item: ItemDetails | null;
    isOpen: boolean;
    onClose: () => void;
    stations: Station[] | null;
    stationLevels: Record<string, number>;
    hiddenStations: Record<string, boolean>;
}

export function ItemDetailModal({
    item,
    isOpen,
    onClose,
    stations,
    stationLevels,
    hiddenStations,
}: ItemDetailModalProps) {
    // Prevent scrolling when modal is open and handle Escape key
    // Dialog handles this automatically
    // useEffect(() => { ... }, [isOpen, onClose]);

    // Compute station requirements for this item
    const stationRequirements = useMemo(() => {
        if (!item || !stations) return [];

        const reqs: {
            stationName: string;
            stationNormalizedName: string;
            stationId: string;
            level: number;
            count: number;
            isFir: boolean;
            isCompleted: boolean;
            isStationMaxed: boolean;
        }[] = [];

        stations.forEach((station) => {
            const currentLevel = stationLevels[station.id] ?? 0;
            // Determine if station is maxed (assuming levels are 1-based and sorted, max level is the last one's level)
            // Actually we can just check if currentLevel >= max possible level
            const maxLevel =
                station.levels.length > 0 ? station.levels[station.levels.length - 1].level : 0;
            const isStationMaxed = currentLevel >= maxLevel;

            station.levels.forEach((level) => {
                level.itemRequirements.forEach((req) => {
                    if (req.item.id === item.id) {
                        const isFir = req.attributes.some(
                            (attr) => attr.name === "found_in_raid" && attr.value === "true"
                        );
                        reqs.push({
                            stationName: station.name,
                            stationNormalizedName: station.normalizedName,
                            stationId: station.id,
                            level: level.level,
                            count: req.count ?? req.quantity ?? 0,
                            isFir,
                            isCompleted: currentLevel >= level.level,
                            isStationMaxed,
                        });
                    }
                });
            });
        });

        // Group by station
        const grouped: Record<string, typeof reqs> = {};
        reqs.forEach((req) => {
            if (!grouped[req.stationName]) {
                grouped[req.stationName] = [];
            }
            grouped[req.stationName].push(req);
        });

        // Helper for sorting
        const orderMap = new Map(stationOrder.map((name, index) => [name, index]));
        const getOrder = (normalizedName: string) => orderMap.get(normalizedName) ?? 999;

        // Sort stations
        return Object.entries(grouped).sort((a, b) => {
            const reqA = a[1][0];
            const reqB = b[1][0];

            // 1. Push maxed stations to bottom
            if (reqA.isStationMaxed && !reqB.isStationMaxed) return 1;
            if (!reqA.isStationMaxed && reqB.isStationMaxed) return -1;

            // 2. Sort by defined station order
            return getOrder(reqA.stationNormalizedName) - getOrder(reqB.stationNormalizedName);
        });
    }, [item, stations, stationLevels]);

    // Compute sell prices (excluding flea)
    const sellPrices = useMemo(() => {
        if (!item?.sellFor) return [];
        return item.sellFor
            .filter((s) => s.vendor.normalizedName !== "flea-market")
            .sort((a, b) => b.priceRUB - a.priceRUB);
    }, [item]);

    const formatPrice = (price?: number, currency: string = "₽") => {
        if (price === undefined) return "-";
        return (
            new Intl.NumberFormat("en-US").format(price) +
            (currency === "₽" || currency === "RUB" ? " ₽" : ` ${currency}`)
        );
    };

    // Compute totals
    const { totalCount, totalFir } = useMemo(() => {
        let totalCount = 0;
        let totalFir = 0;

        stationRequirements.forEach(([, reqs]) => {
            reqs.forEach((req) => {
                if (!req.isCompleted) {
                    totalCount += req.count;
                    if (req.isFir) {
                        totalFir += req.count;
                    }
                }
            });
        });

        return { totalCount, totalFir };
    }, [stationRequirements]);

    if (!item) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                showCloseButton={false}
                className="max-w-5xl h-[90vh] p-0 gap-0 bg-[#0a0a0a] border-white/10 overflow-hidden flex flex-col"
            >
                <DialogTitle className="sr-only">{item.name}</DialogTitle>
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-white/10 bg-[#111]">
                    <div className="flex items-start gap-6">
                        <div className="w-24 h-24 bg-black/40 border border-white/5 flex items-center justify-center shrink-0 overflow-hidden relative">
                            {item.iconLink || item.gridImageLink ? (
                                <img
                                    src={item.iconLink || item.gridImageLink}
                                    alt={item.name}
                                    className="w-full h-full object-contain p-2"
                                />
                            ) : (
                                <div className="text-2xl text-gray-600">?</div>
                            )}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-100 mb-2">{item.name}</h2>
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-4 text-sm">
                                    <span className="text-gray-400 bg-white/5 px-2 py-1 rounded-sm">
                                        {item.category?.name || "Item"}
                                    </span>
                                    <div className="flex items-center gap-3">
                                        {item.wikiLink && (
                                            <a
                                                href={item.wikiLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-tarkov-green hover:underline flex items-center gap-1"
                                            >
                                                Wiki <ExternalLink size={12} />
                                            </a>
                                        )}
                                        {item.link && (
                                            <a
                                                href={item.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-tarkov-green hover:underline flex items-center gap-1"
                                            >
                                                Tarkov.dev <ExternalLink size={12} />
                                            </a>
                                        )}
                                    </div>
                                </div>
                                {/* Total Counts */}
                                <div className="flex items-center gap-4 text-sm font-medium mt-1">
                                    <div className="flex items-center gap-2 bg-tarkov-green/10 px-2 py-1 rounded-sm border border-tarkov-green/20">
                                        <span className="text-gray-400 uppercase text-xs font-bold tracking-wider">
                                            Needed
                                        </span>
                                        <span className="text-tarkov-green font-mono font-bold">
                                            x{totalCount}
                                        </span>
                                    </div>
                                    {totalFir > 0 && (
                                        <div className="flex items-center gap-2 bg-orange-500/10 px-2 py-1 rounded-sm border border-orange-500/20">
                                            <span className="text-orange-400 uppercase text-xs font-bold tracking-wider">
                                                FIR
                                            </span>
                                            <span className="text-orange-400 font-mono font-bold">
                                                x{totalFir}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 bg-[#0d0d0d]">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Market Data */}
                        <div className="space-y-8">
                            {/* Market Stats */}
                            <div>
                                <h3 className="text-lg font-bold text-tarkov-green mb-4 uppercase tracking-wider">
                                    Market Data
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <MarketStatBox
                                        label="Low 24h"
                                        value={formatPrice(item.low24hPrice)}
                                    />
                                    <MarketStatBox
                                        label="Avg 24h"
                                        value={formatPrice(item.avg24hPrice)}
                                    />
                                    <MarketStatBox
                                        label="Last Low"
                                        value={formatPrice(item.lastLowPrice)}
                                    />
                                    <div className="bg-[#151515] p-3 border-l-2 border-white/10 flex flex-col">
                                        <span className="text-xs text-gray-500 uppercase tracking-wider">
                                            Change 48h
                                        </span>
                                        <div className="mt-1 flex items-center gap-2">
                                            <span
                                                className={`text-lg font-mono font-bold ${
                                                    (item.changeLast48h || 0) > 0
                                                        ? "text-green-500"
                                                        : (item.changeLast48h || 0) < 0
                                                        ? "text-red-500"
                                                        : "text-gray-400"
                                                }`}
                                            >
                                                {item.changeLast48h}%
                                            </span>
                                            {(item.changeLast48h || 0) > 0 ? (
                                                <TrendingUp size={16} className="text-green-500" />
                                            ) : (item.changeLast48h || 0) < 0 ? (
                                                <TrendingDown size={16} className="text-red-500" />
                                            ) : (
                                                <Minus size={16} className="text-gray-400" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Trader Prices */}
                            <div>
                                <h3 className="text-lg font-bold text-tarkov-green mb-4 uppercase tracking-wider">
                                    Trader Buy Prices
                                </h3>
                                <div className="bg-[#151515] border border-white/5">
                                    {sellPrices.length > 0 ? (
                                        <div className="divide-y divide-white/5">
                                            {sellPrices.map((price, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                                >
                                                    <span className="font-medium text-gray-300">
                                                        {price.vendor.name}
                                                    </span>
                                                    <span className="font-mono text-tarkov-green font-bold text-lg">
                                                        {formatPrice(price.price, price.currency)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-4 text-center text-gray-500 italic">
                                            No trader price data available
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Hideout Requirements */}
                        <div className="lg:col-span-2">
                            <h3 className="text-lg font-bold text-tarkov-green mb-4 uppercase tracking-wider">
                                Hideout Requirements
                            </h3>
                            <div className="space-y-6">
                                {stationRequirements.length > 0 ? (
                                    stationRequirements.map(([stationName, reqs]) => {
                                        const stationId = reqs[0].stationId;
                                        const currentLevel = stationLevels[stationId] ?? 0;
                                        const isHidden = hiddenStations[stationId];

                                        return (
                                            <div
                                                key={stationName}
                                                className="bg-[#151515] border border-white/5"
                                            >
                                                <div className="bg-[#1a1a1a] px-4 py-3 border-b border-white/5 flex justify-between items-center">
                                                    <div className="font-bold text-gray-100">
                                                        {stationName}
                                                    </div>
                                                    <div className="flex items-center gap-3 text-xs">
                                                        {isHidden && (
                                                            <span className="text-red-400 bg-red-500/10 px-2 py-0.5 rounded-sm uppercase tracking-wider font-medium">
                                                                Hidden
                                                            </span>
                                                        )}
                                                        <span className="text-gray-500 uppercase tracking-wider font-medium">
                                                            Current Level: {currentLevel}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="divide-y divide-white/5">
                                                    {reqs.map((req, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={`px-4 py-4 flex items-center justify-between transition-colors ${
                                                                req.isCompleted
                                                                    ? "bg-white/[0.02] text-gray-500"
                                                                    : "hover:bg-white/5"
                                                            }`}
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <span
                                                                    className={`text-sm ${
                                                                        req.isCompleted
                                                                            ? "text-gray-500 line-through decoration-white/20"
                                                                            : "text-gray-400"
                                                                    }`}
                                                                >
                                                                    Level {req.level}
                                                                </span>
                                                                {req.isCompleted && (
                                                                    <span className="text-[10px] text-tarkov-green uppercase tracking-wider font-bold bg-tarkov-green/10 px-2 py-0.5 rounded-sm">
                                                                        Completed
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-4">
                                                                {req.isFir && (
                                                                    <span className="px-2 py-0.5 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded-sm uppercase font-bold tracking-wide">
                                                                        FIR
                                                                    </span>
                                                                )}
                                                                <span
                                                                    className={`font-mono font-bold text-lg ${
                                                                        req.isCompleted
                                                                            ? "text-gray-600"
                                                                            : "text-tarkov-green"
                                                                    }`}
                                                                >
                                                                    x{req.count}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <div className="p-8 text-center text-gray-500 bg-[#151515] border border-white/5">
                                        No hideout stations require this item.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function MarketStatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-[#151515] p-3 border-l-2 border-white/10 flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
            <span className="mt-1 text-lg font-mono font-medium text-gray-200">{value}</span>
        </div>
    );
}
