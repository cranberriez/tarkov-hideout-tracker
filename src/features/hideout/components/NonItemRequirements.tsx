"use client";

import type { Station } from "@/types/hideout";
import Image from "next/image";
import { RequirementChip } from "@/components/ui/requirement";

export interface NonItemRequirementsProps {
	station: Station;
	nextLevelData: Station["levels"][number];
	stations: Station[] | null;
	stationLevels: Record<string, number>;
}

function scrollToStation(stationId: string) {
	const card = document.getElementById(`hideout-station-${stationId}`);
	if (!card) return;

	const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	card.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "nearest" });
	for (const animation of card.getAnimations()) {
		if (animation.id === "station-border-pulse") animation.cancel();
	}
	const borderColor = getComputedStyle(card).borderColor;
	card.animate(
		reducedMotion
			? [{ borderColor: "var(--success)" }, { borderColor: "var(--success)" }]
			: [
					{ borderColor, offset: 0 },
					{ borderColor: "var(--success)", offset: 0.2 },
					{ borderColor: "var(--success)", offset: 0.6 },
					{ borderColor, offset: 1 },
				],
		{ id: "station-border-pulse", duration: 1800, easing: "ease-in-out" },
	);
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

					const chip = (
						<RequirementChip
							satisfied={isMet}
							className={reqStation ? "transition-colors group-hover/station:border-current" : undefined}
						>
							{reqStation?.name ?? req.station.normalizedName.replace(/-/g, " ")}
							<span className="ml-1 text-foreground">LVL {req.level}</span>
						</RequirementChip>
					);
					return reqStation ? (
						<button
							key={`st-${idx}`}
							type="button"
							onClick={() => scrollToStation(reqStation.id)}
							className="group/station cursor-pointer rounded-sm focus-visible:outline-2 focus-visible:outline-brand"
						>
							{chip}
						</button>
					) : (
						<span key={`st-${idx}`}>{chip}</span>
					);
				})}
			{nextLevelData.skillRequirements?.map((req, idx) => (
				<RequirementChip
					key={`sk-${idx}`}
					satisfied={null}
					icon={
						req.skill.imageLink ? (
							<Image
								src={req.skill.imageLink}
								alt=""
								width={12}
								height={12}
								className="size-3 object-contain"
								unoptimized
							/>
						) : undefined
					}
				>
					{req.skill.name}
					<span className="ml-1">LVL {req.level}</span>
				</RequirementChip>
			))}
			{nextLevelData.traderRequirements?.map((req, idx) => (
				<RequirementChip
					key={`tr-${idx}`}
					satisfied={null}
					icon={
						req.trader.imageLink ? (
							<Image
								src={req.trader.imageLink}
								alt=""
								width={12}
								height={12}
								className="size-3 rounded-full object-cover"
								unoptimized
							/>
						) : undefined
					}
				>
					{req.trader.name}
					<span className="ml-1">LL{req.value}</span>
				</RequirementChip>
			))}
		</div>
	);
}
