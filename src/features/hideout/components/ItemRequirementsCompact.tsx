import type { BaseItemRequirementsProps } from "./ItemRequirements";
import Image from "next/image";
import { CircleCheckBig, Check } from "lucide-react";
import { formatNumber } from "@/lib/utils/format-number";

export function CompactItemRequirements({
    nextLevelData,
    hideMoney,
    completedRequirements,
    toggleRequirement,
}: BaseItemRequirementsProps) {
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
                    const isFir = req.attributes.some(
                        (a) => a.name === "found_in_raid" && a.value === "true"
                    );
                    const isCompleted = completedRequirements[req.id];

                    return (
                        <div
                            key={req.id}
                            onClick={() => toggleRequirement(req.id)}
                            className={`relative w-12 h-12 bg-black/40 border group cursor-pointer transition-all ${
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
                            <div
                                className={`absolute bottom-0 right-0 bg-black/80 px-1 text-[11px] font-mono ${
                                    isFir ? "text-orange-300" : "text-tarkov-green"
                                } border-t border-l border-white/10`}
                            >
                                {formatNumber(quantity)}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
}
