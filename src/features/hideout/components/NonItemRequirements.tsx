import type { Station } from "@/types/hideout";
import Image from "next/image";
import { RequirementChip } from "@/components/ui/requirement";

export interface NonItemRequirementsProps {
	station: Station;
	nextLevelData: Station["levels"][number];
	stations: Station[] | null;
	stationLevels: Record<string, number>;
}

export function NonItemRequirements({ station, nextLevelData, stations, stationLevels }: NonItemRequirementsProps) {
	return (
		<div className="flex flex-wrap gap-2 mb-1">
			{nextLevelData.stationLevelRequirements
				?.filter((req) => req.station.normalizedName !== station.normalizedName)
				.map((req, idx) => {
					const reqStation = stations?.find((s) => s.normalizedName === req.station.normalizedName);
					const reqStationLevel = reqStation ? (stationLevels[reqStation.id] ?? 0) : 0;
					const isMet = reqStationLevel >= req.level;

					return (
						<RequirementChip key={`st-${idx}`} satisfied={isMet}>
							{reqStation?.name ?? req.station.normalizedName.replace(/-/g, " ")}
							<span className="ml-1 text-foreground">LVL {req.level}</span>
						</RequirementChip>
					);
				})}
			{nextLevelData.skillRequirements?.map((req, idx) => (
				<RequirementChip
					key={`sk-${idx}`}
					satisfied={null}
					icon={req.skill.imageLink ? (
						<Image src={req.skill.imageLink} alt="" width={12} height={12} className="size-3 object-contain" unoptimized />
					) : undefined}
				>
					{req.skill.name}
					<span className="ml-1">LVL {req.level}</span>
				</RequirementChip>
			))}
			{nextLevelData.traderRequirements?.map((req, idx) => (
				<RequirementChip
					key={`tr-${idx}`}
					satisfied={null}
					icon={req.trader.imageLink ? (
						<Image src={req.trader.imageLink} alt="" width={12} height={12} className="size-3 rounded-full object-cover" unoptimized />
					) : undefined}
				>
					{req.trader.name}
					<span className="ml-1">LL{req.value}</span>
				</RequirementChip>
			))}
		</div>
	);
}
