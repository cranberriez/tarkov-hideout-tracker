"use client";

import { useEffect, useMemo } from "react";
import { ItemDetails, Station } from "@/app/types";
import { X, ExternalLink, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface ItemDetailModalProps {
    item: ItemDetails | null;
    isOpen: boolean;
    onClose: () => void;
    stations: Station[] | null;
}

export function ItemDetailModal({ item, isOpen, onClose, stations }: ItemDetailModalProps) {
    // Prevent scrolling when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }
        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // Compute station requirements for this item
    const stationRequirements = useMemo(() => {
        if (!item || !stations) return [];

        const reqs: {
            stationName: string;
            level: number;
            count: number;
            isFir: boolean;
        }[] = [];

        stations.forEach((station) => {
            station.levels.forEach((level) => {
                level.itemRequirements.forEach((req) => {
                    if (req.item.id === item.id) {
                        const isFir = req.attributes.some(
                            (attr) => attr.name === "found_in_raid" && attr.value === "true"
                        );
                        reqs.push({
                            stationName: station.name,
                            level: level.level,
                            count: req.count ?? req.quantity ?? 0,
                            isFir,
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

        // Sort stations alphabetically
        return Object.entries(grouped).sort((a, b) => a[0].localeCompare(b[0]));
    }, [item, stations]);

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

    if (!isOpen || !item) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Modal Container */}
            <div className="relative w-full max-w-5xl h-[90vh] bg-[#1a1a1a] border border-white/10 rounded-lg shadow-2xl flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-white/10 bg-[#111]">
                    <div className="flex items-start gap-6">
                        <div className="w-24 h-24 bg-black/40 rounded-lg border border-white/5 flex items-center justify-center shrink-0 overflow-hidden relative">
                            {item.iconLink || item.gridImageLink ? (
                                <img
                                    src={item.gridImageLink || item.iconLink}
                                    alt={item.name}
                                    className="w-full h-full object-contain p-2"
                                />
                            ) : (
                                <div className="text-2xl text-gray-600">?</div>
                            )}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-gray-100 mb-2">{item.name}</h2>
                            <div className="flex items-center gap-4 text-sm">
                                <span className="text-gray-400 bg-white/5 px-2 py-1 rounded">
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
                <div className="flex-1 overflow-y-auto p-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        {/* Left Column: Market Data */}
                        <div className="space-y-6">
                            {/* Market Stats */}
                            <div>
                                <h3 className="text-lg font-bold text-tarkov-green mb-4 border-b border-white/10 pb-2">
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
                                    <div className="bg-black/30 p-3 rounded border border-white/5 flex flex-col">
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
                                <h3 className="text-lg font-bold text-tarkov-green mb-4 border-b border-white/10 pb-2">
                                    Trader Buy Prices
                                </h3>
                                <div className="bg-black/20 rounded overflow-hidden border border-white/5">
                                    {sellPrices.length > 0 ? (
                                        <div className="divide-y divide-white/5">
                                            {sellPrices.map((price, idx) => (
                                                <div
                                                    key={idx}
                                                    className="flex items-center justify-between p-3 hover:bg-white/5"
                                                >
                                                    <span className="font-medium text-gray-300">
                                                        {price.vendor.name}
                                                    </span>
                                                    <span className="font-mono text-tarkov-green">
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
                            <h3 className="text-lg font-bold text-tarkov-green mb-4 border-b border-white/10 pb-2">
                                Hideout Requirements
                            </h3>
                            <div className="space-y-4">
                                {stationRequirements.length > 0 ? (
                                    stationRequirements.map(([stationName, reqs]) => (
                                        <div
                                            key={stationName}
                                            className="bg-black/20 border border-white/5 rounded-lg overflow-hidden"
                                        >
                                            <div className="bg-white/5 px-4 py-2 font-bold text-gray-200 border-b border-white/5">
                                                {stationName}
                                            </div>
                                            <div className="divide-y divide-white/5">
                                                {reqs.map((req, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="px-4 py-3 flex items-center justify-between hover:bg-white/5"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="text-sm text-gray-400">
                                                                Level {req.level}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            {req.isFir && (
                                                                <span className="px-2 py-0.5 text-[10px] bg-orange-500/10 text-orange-400 border border-orange-500/20 rounded">
                                                                    Found in Raid
                                                                </span>
                                                            )}
                                                            <span className="font-mono font-bold text-tarkov-green">
                                                                x{req.count}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-gray-500 bg-black/20 rounded border border-white/5">
                                        No hideout stations require this item.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

function MarketStatBox({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-black/30 p-3 rounded border border-white/5 flex flex-col">
            <span className="text-xs text-gray-500 uppercase tracking-wider">{label}</span>
            <span className="mt-1 text-lg font-mono font-medium text-gray-200">{value}</span>
        </div>
    );
}
