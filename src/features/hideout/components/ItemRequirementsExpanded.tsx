"use client";

import type { BaseItemRequirementsProps } from "./ItemRequirements";
import Image from "next/image";
import { CircleCheckBig, Check } from "lucide-react";
import { formatNumber } from "@/lib/utils/format-number";
import { useUserStore } from "@/lib/stores/useUserStore";
import { computeNeeds } from "@/lib/utils/item-needs";
import { formatCompactRoubles, getFleaPrice, hasFleaMarketData, fleaPriceStatusLabel } from "@/lib/utils/market-price";

export function ExpandedItemRequirements({
    nextLevelData,
    hideMoney,
    onClickItem,
    pooledFirByItem,
    itemById,
}: BaseItemRequirementsProps) {
    const itemCounts = useUserStore((state) => state.itemCounts);
    return (
        <div className="flex flex-col gap-1.5">
            {nextLevelData.itemRequirements
                .filter((req) => {
                    const item = itemById[req.itemId];
                    if (!item) return false;
                    if (!hideMoney) return true;
                    const norm = item.normalizedName;
                    return norm !== "roubles" && norm !== "dollars" && norm !== "euros";
                })
                .map((req) => {
                    const item = itemById[req.itemId];
                    if (!item) return null;
                    const norm = item.normalizedName;
                    const isCurrency = norm === "roubles" || norm === "dollars" || norm === "euros";
                    const marketPrice = item.marketPrice;
                    const fleaPrice = getFleaPrice(marketPrice);
                    const priceLabel = marketPrice?.fleaStability === "unavailable" ? fleaPriceStatusLabel(marketPrice) : marketPrice && !hasFleaMarketData(marketPrice)
                          ? "No flea"
                          : fleaPrice != null
                            ? `${formatCompactRoubles(fleaPrice)} ₽`
                            : "No data";

                    const owned = itemCounts[req.itemId] ?? { have: 0, haveFir: 0 };
                    const globalFirRemaining = pooledFirByItem[req.itemId] ?? 0;
                    const firSurplus = Math.max(0, owned.haveFir - globalFirRemaining);
                    const needs = isCurrency
                        ? computeNeeds({
                              totalRequired: req.count,
                              requiredFir: 0,
                              haveNonFir: 0,
                              haveFir: 0,
                          })
                        : req.isFir
                        ? computeNeeds({
                              totalRequired: req.count,
                              requiredFir: req.count,
                              haveNonFir: 0,
                              haveFir: owned.haveFir,
                          })
                        : computeNeeds({
                              totalRequired: req.count,
                              requiredFir: 0,
                              haveNonFir: owned.have + firSurplus,
                              haveFir: 0,
                          });

                    const isCompleted = !isCurrency
                        ? req.isFir
                            ? needs.isSatisfied
                            : needs.isSatisfied && !needs.usesFirForNonFir
                        : false;

                    return (
                        <div
                            key={req.id}
                            onClick={() => onClickItem(item)}
                            className={`flex items-center gap-3 bg-black/20 p-1 border transition-colors cursor-pointer ${
                                isCompleted
                                    ? "border-green-500/30 opacity-60 bg-green-900/5"
                                    : "border-white/5 hover:border-white/10"
                            }`}
                        >
                            <div
                                className={`relative w-10 h-10 shrink-0 ${
                                    req.isFir ? "ring-1 ring-orange-500" : ""
                                }`}
                            >
                                {item.iconLink && (
                                    <Image
                                        src={item.iconLink}
                                        alt={item.name}
                                        fill
                                        className={`object-contain ${
                                            isCompleted ? "grayscale" : ""
                                        }`}
                                        unoptimized
                                    />
                                )}
                                {isCompleted && (
                                    <div className="absolute inset-0 flex items-center justify-center text-green-500">
                                        <Check size={24} strokeWidth={2} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center justify-between">
                                <div className="flex flex-col items-start gap-0.5 min-w-0">
                                    <div
                                        className={`text-xs truncate ${
                                            isCompleted ? "text-gray-500" : "text-gray-300"
                                        }`}
                                    >
                                        <span
                                            className={`font-bold mr-2 font-mono ${
                                                isCompleted ? "text-gray-600" : "text-gray-200"
                                            }`}
                                        >
                                            {item.shortName || item.name}
                                        </span>
                                    </div>
                                    <div className="text-[10px] font-mono text-gray-400">
                                        {isCurrency ? (
                                            <span className="text-tarkov-green">
                                                {formatNumber(req.count)}
                                            </span>
                                        ) : req.isFir ? (
                                            <span className="text-orange-400">
                                                FiR {formatNumber(needs.haveFirReserved)} /{" "}
                                                {formatNumber(needs.requiredFir)}
                                            </span>
                                        ) : (
                                            <span className="text-tarkov-green">
                                                {formatNumber(needs.effectiveHave)}
                                                {owned.haveFir > 0 && (
                                                    <span className="text-orange-400">
                                                        {` (${formatNumber(owned.haveFir)})`}
                                                    </span>
                                                )}
                                                {` / ${formatNumber(needs.totalRequired)}`}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {req.isFir && !isCompleted && (
                                    <div className="text-orange-500" title="Found In Raid">
                                        <CircleCheckBig className="w-4 h-4" />
                                    </div>
                                )}
                                {!isCurrency && (
                                    <div className="ml-2 shrink-0 text-right text-[10px] font-mono text-gray-500">
                                        {priceLabel}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
}
