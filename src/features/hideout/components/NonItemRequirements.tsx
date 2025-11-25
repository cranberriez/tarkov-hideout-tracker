import type { Station } from "@/types";
import Image from "next/image";
import { Lock, LockOpen } from "lucide-react";

export interface NonItemRequirementsProps {
    station: Station;
    nextLevelData: Station["levels"][number];
    stations: Station[] | null;
    stationLevels: Record<string, number>;
}

export function NonItemRequirements({
    station,
    nextLevelData,
    stations,
    stationLevels,
}: NonItemRequirementsProps) {
    return (
        <div className="flex flex-wrap gap-2 mb-1">
            {nextLevelData.stationLevelRequirements
                ?.filter((req) => req.station.normalizedName !== station.normalizedName)
                .map((req, idx) => {
                    const reqStation = stations?.find(
                        (s) => s.normalizedName === req.station.normalizedName
                    );
                    const reqStationLevel = reqStation ? stationLevels[reqStation.id] ?? 0 : 0;
                    const isMet = reqStationLevel >= req.level;

                    return (
                        <div
                            key={`st-${idx}`}
                            className={`flex items-center gap-2 px-2 py-1 rounded border ${
                                isMet
                                    ? "bg-green-900/20 border-green-500/20"
                                    : "bg-red-900/20 border-red-500/20"
                            }`}
                        >
                            {isMet ? (
                                <Lock size={12} className={"text-green-400"} />
                            ) : (
                                <LockOpen size={12} className={"text-red-400"} />
                            )}

                            <span
                                className={`text-[10px] font-medium uppercase ${
                                    isMet ? "text-green-200" : "text-red-200"
                                }`}
                            >
                                {req.station.normalizedName.replace(/-/g, " ")}{" "}
                                <span className="text-white ml-1">LVL {req.level}</span>
                            </span>
                        </div>
                    );
                })}
            {nextLevelData.skillRequirements?.map((req, idx) => (
                <div
                    key={`sk-${idx}`}
                    className="flex items-center gap-2 bg-blue-900/20 border border-blue-500/20 px-2 py-1 rounded"
                >
                    <div className="w-3 h-3 relative shrink-0">
                        {req.skill.imageLink && (
                            <Image
                                src={req.skill.imageLink}
                                alt={req.skill.name}
                                fill
                                className="object-contain"
                                unoptimized
                            />
                        )}
                    </div>
                    <span className="text-[10px] text-blue-200 font-medium uppercase">
                        {req.skill.name} <span className="text-white ml-1">LVL {req.level}</span>
                    </span>
                </div>
            ))}
            {nextLevelData.traderRequirements?.map((req, idx) => (
                <div
                    key={`tr-${idx}`}
                    className="flex items-center gap-2 bg-yellow-900/20 border border-yellow-500/20 px-2 py-1 rounded"
                >
                    <div className="w-3 h-3 relative shrink-0 rounded-full overflow-hidden">
                        {req.trader.imageLink && (
                            <Image
                                src={req.trader.imageLink}
                                alt={req.trader.name}
                                fill
                                className="object-cover"
                                unoptimized
                            />
                        )}
                    </div>
                    <span className="text-[10px] text-yellow-200 font-medium uppercase">
                        {req.trader.name} <span className="text-white ml-1">LL{req.value}</span>
                    </span>
                </div>
            ))}
        </div>
    );
}
