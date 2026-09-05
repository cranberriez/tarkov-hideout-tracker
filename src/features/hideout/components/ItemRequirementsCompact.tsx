"use client";

import type { BaseItemRequirementsProps } from "./ItemRequirements";
import Image from "next/image";
import { CircleCheckBig, Check } from "lucide-react";
import { formatNumber } from "@/lib/utils/format-number";
import { useUserStore } from "@/lib/stores/useUserStore";
import { computeNeeds } from "@/lib/utils/item-needs";
import { formatCompactRoubles, getFleaPrice, hasFleaMarketData, fleaPriceStatusLabel } from "@/lib/utils/market-price";

export function CompactItemRequirements({
    nextLevelData,
    hideMoney,
    onClickItem,
    pooledFirByItem,
    itemById,
}: BaseItemRequirementsProps) {
    const itemCounts = useUserStore((state) => state.itemCounts);
    return (
        <div className="flex flex-wrap gap-2">
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
                            : null;

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
                            className={`relative w-16 h-16 bg-black/40 border group cursor-pointer transition-all ${
                                req.isFir ? "border-orange-500" : "border-white/10"
                            } ${isCompleted ? "opacity-50 grayscale" : "hover:border-white/30"}`}
                            title={`${formatNumber(req.count)} ${item.name}${
                                req.isFir ? " (Found In Raid)" : ""
                            }${priceLabel ? ` - ${priceLabel}` : ""}${
                                isCompleted ? " (Completed)" : ""
                            }`}
                        >
                            {item.iconLink && (
                                <Image
                                    src={item.iconLink}
                                    alt={item.name}
                                    fill
                                    className="object-contain p-1"
                                    unoptimized
                                />
                            )}
                            {req.isFir && (
                                <div
                                    className="absolute -top-1.5 -right-1.5 bg-black rounded-full z-10 text-orange-500"
                                    title="Found In Raid"
                                >
                                    <CircleCheckBig className="w-3.5 h-3.5 text-orange-500" />
                                </div>
                            )}
                            {isCompleted && (
                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                    <Check size={16} />
                                </div>
                            )}
                            <div className="absolute bottom-0 right-0 bg-black/40 px-1 text-[10px] font-mono text-gray-300 border-t border-l border-white/10 text-right leading-tight">
                                {isCurrency ? (
                                    <div
                                        className={req.isFir ? "text-orange-300" : "text-tarkov-green"}
                                    >
                                        {formatNumber(req.count)}
                                    </div>
                                ) : req.isFir ? (
                                    <div className="text-orange-300">
                                        {formatNumber(needs.haveFirReserved)} /{" "}
                                        {formatNumber(needs.requiredFir)}
                                    </div>
                                ) : (
                                    <div className="text-tarkov-green">
                                        {formatNumber(needs.effectiveHave)}{" "}
                                        {owned.haveFir > 0 && (
                                            <span className="text-orange-300">
                                                {formatNumber(owned.haveFir)}
                                            </span>
                                        )}
                                        {` / ${formatNumber(needs.totalRequired)}`}
                                    </div>
                                )}
                            </div>
                            {priceLabel && !isCurrency && (
                                <div className="absolute top-0 left-0 max-w-full bg-black/55 px-1 text-[9px] font-mono leading-4 text-gray-300">
                                    {priceLabel}
                                </div>
                            )}
                        </div>
                    );
                })}
        </div>
    );
}
