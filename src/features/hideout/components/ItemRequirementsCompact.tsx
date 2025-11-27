"use client";

import type { BaseItemRequirementsProps } from "./ItemRequirements";
import Image from "next/image";
import { CircleCheckBig, Check } from "lucide-react";
import { formatNumber } from "@/lib/utils/format-number";
import { useUserStore } from "@/lib/stores/useUserStore";
import { computeNeeds } from "@/lib/utils/item-needs";

export function CompactItemRequirements({
    nextLevelData,
    hideMoney,
    completedRequirements,
    toggleRequirement,
    onClickItem,
}: BaseItemRequirementsProps) {
    const itemCounts = useUserStore((state) => state.itemCounts);
    return (
        <div className="flex flex-wrap gap-2">
            {nextLevelData.itemRequirements
                .filter((req) => {
                    if (!hideMoney) return true;
                    const norm = req.item.normalizedName;
                    return norm !== "roubles" && norm !== "dollars" && norm !== "euros";
                })
                .map((req) => {
                    const quantity = req.count ?? req.quantity ?? 1;
                    const norm = req.item.normalizedName;
                    const isCurrency = norm === "roubles" || norm === "dollars" || norm === "euros";
                    const isFir = req.attributes.some(
                        (a) => a.name === "found_in_raid" && a.value === "true"
                    );

                    const owned = itemCounts[req.item.id] ?? { have: 0, haveFir: 0 };
                    const needs = isCurrency
                        ? computeNeeds({
                              totalRequired: quantity,
                              requiredFir: 0,
                              haveNonFir: 0,
                              haveFir: 0,
                          })
                        : computeNeeds({
                              totalRequired: quantity,
                              requiredFir: isFir ? quantity : 0,
                              // For non-FIR requirements, allow both non-FIR and FIR to contribute
                              haveNonFir: isFir ? 0 : owned.have,
                              haveFir: owned.haveFir,
                          });

                    const isCompleted = !isCurrency
                        ? isFir
                            ? needs.isSatisfied
                            : needs.isSatisfied && !needs.usesFirForNonFir
                        : false;

                    return (
                        <div
                            key={req.id}
                            onClick={() => onClickItem(req.item)}
                            className={`relative w-14 h-14 bg-black/40 border group cursor-pointer transition-all ${
                                isFir ? "border-orange-500" : "border-white/10"
                            } ${isCompleted ? "opacity-50 grayscale" : "hover:border-white/30"}`}
                            title={`${formatNumber(quantity)}x ${req.item.name}${
                                isFir ? " (Found In Raid)" : ""
                            }${isCompleted ? " (Completed)" : ""}`}
                        >
                            {req.item.iconLink && (
                                <Image
                                    src={req.item.iconLink}
                                    alt={req.item.name}
                                    fill
                                    className="object-contain p-1"
                                    unoptimized
                                />
                            )}
                            {isFir && (
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
                            <div className="absolute bottom-0 right-0 bg-black/80 px-1 text-[9px] font-mono text-gray-300 border-t border-l border-white/10 text-right leading-tight">
                                {isCurrency ? (
                                    <div className={isFir ? "text-orange-300" : "text-tarkov-green"}>
                                        {`x${formatNumber(quantity)}`}
                                    </div>
                                ) : isFir ? (
                                    <div className="text-orange-300">
                                        {formatNumber(needs.haveFirReserved)} / {formatNumber(needs.requiredFir)}
                                    </div>
                                ) : (
                                    <div className="text-tarkov-green">
                                        {formatNumber(needs.effectiveHave)}
                                        {owned.haveFir > 0 && (
                                            <span className="text-orange-300"> ({formatNumber(owned.haveFir)})</span>
                                        )}
                                        {` / ${formatNumber(needs.totalRequired)}`}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
}
