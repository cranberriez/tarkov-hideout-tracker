import type { BaseItemRequirementsProps } from "./ItemRequirements";
import Image from "next/image";
import { CircleCheckBig, Check } from "lucide-react";
import { formatNumber } from "@/lib/utils/format-number";

export function ExpandedItemRequirements({
    nextLevelData,
    hideMoney,
    completedRequirements,
    toggleRequirement,
}: BaseItemRequirementsProps) {
    return (
        <div className="flex flex-col gap-1.5">
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
                            className={`flex items-center gap-3 bg-black/20 p-1.5 border transition-colors cursor-pointer ${
                                isCompleted
                                    ? "border-green-500/30 opacity-60 bg-green-900/5"
                                    : "border-white/5 hover:border-white/10"
                            }`}
                        >
                            <div
                                className={`relative w-8 h-8 shrink-0 ${
                                    isFir ? "ring-1 ring-orange-500" : ""
                                }`}
                            >
                                {req.item.iconLink && (
                                    <Image
                                        src={req.item.iconLink}
                                        alt={req.item.name}
                                        fill
                                        className={`object-contain ${
                                            isCompleted ? "grayscale" : ""
                                        }`}
                                        unoptimized
                                    />
                                )}
                                {isCompleted && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <Check size={16} />
                                    </div>
                                )}
                            </div>
                            <div className="flex-1 min-w-0 flex items-center justify-between">
                                <div
                                    className={`text-xs truncate ${
                                        isCompleted
                                            ? "text-gray-500 line-through decoration-tarkov-green/50"
                                            : "text-gray-300"
                                    }`}
                                >
                                    <span
                                        className={`font-bold mr-2 font-mono ${
                                            isCompleted ? "text-gray-600" : "text-tarkov-green"
                                        }`}
                                    >
                                        {formatNumber(quantity)}x
                                    </span>
                                    {req.item.shortName || req.item.name}
                                </div>
                                {isFir && !isCompleted && (
                                    <div className="text-orange-500" title="Found In Raid">
                                        <CircleCheckBig className="w-4 h-4" />
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
        </div>
    );
}
