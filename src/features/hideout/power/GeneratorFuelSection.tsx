"use client";

import { type ReactNode } from "react";
import { DataNotice } from "@/components/ui/data-notice";
import { BASE_FUEL_UNITS_PER_HOUR, FUEL_TANK_ITEM_IDS } from "@/lib/cfg/hideout-power";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { cn } from "@/lib/utils";
import type { ProfitPageData } from "@/types/contracts";
import { WikiSection } from "../details/components/WikiSection";
import { useStationDetails } from "../details/StationDetailsContext";
import { FuelTankCards } from "./FuelTankCards";
import { fuelMultiplier, stationSlots, unbuiltFuelSources } from "./hideout-power-model";
import { formatRoubles, formatSpan } from "./power-format";
import { burnSummary, formatPercent, groupFuelSources } from "./StationPowerRow";
import { useHideoutPower } from "./useHideoutPower";
import { PowerSkills } from "./PowerSkills";

function Row({ label, value, muted = false }: { label: ReactNode; value: ReactNode; muted?: boolean }) {
	return (
		<div className={cn("flex items-baseline justify-between gap-4 py-1.5", muted && "text-muted-foreground")}>
			<dt className="min-w-0 text-xs">{label}</dt>
			<dd className="shrink-0 font-mono text-xs font-semibold">{value}</dd>
		</div>
	);
}

/** Generator page: burn modifiers, slot capacity and running costs. */
export function GeneratorFuelSection({
	mode,
	fallbackData,
}: {
	mode: TarkovJsonGameMode;
	fallbackData: ProfitPageData | null;
}) {
	const { station, stations, currentLevel } = useStationDetails();
	const power = useHideoutPower(mode, fallbackData, stations);
	const { fuel, hideoutManagementSkillLevel: skillLevel, stationLevels } = power;
	const skill = Math.min(50, skillLevel);
	const loading = power.pricing === "loading";
	const pricedTanks = power.tanks.filter((tank) => tank.price !== null && tank.units);
	const cheapestUnitCost = pricedTanks.length
		? Math.min(...pricedTanks.map((tank) => tank.price! / tank.units!))
		: null;

	// Per unbuilt station: what finishing it would change (Solar saves, the Wall's last stage removes its penalty).
	const unbuiltStations = [...new Set(unbuiltFuelSources(stations, stationLevels).map((source) => source.stationId))];
	const upgrades = unbuiltStations.flatMap((stationId) => {
		const target = stations.find((entry) => entry.id === stationId);
		if (!target) return [];
		const maxed = fuelMultiplier({
			stations,
			stationLevels: { ...stationLevels, [stationId]: target.levels.length },
			hideoutManagementSkillLevel: skillLevel,
		});
		const savedUnitsPerDay = (fuel.unitsPerHour - maxed.unitsPerHour) * 24;
		return Math.abs(savedUnitsPerDay) < 1e-6 ? [] : [{ name: target.name, savedUnitsPerDay }];
	});
	const tankSlots = stationSlots(station, currentLevel, FUEL_TANK_ITEM_IDS[0]);
	const metal = power.tanks.find((tank) => tank.id === FUEL_TANK_ITEM_IDS[0]);

	return (
		<WikiSection
			title="Fuel"
			description={burnSummary(fuel, skillLevel)}
			actions={<PowerSkills />}
			bodyClassName="flex flex-col gap-4"
		>
			{fuel.bonusDataMissing && (
				<DataNotice>
					Fuel modifiers (Solar Power, Defective Wall) are unavailable; showing the base burn rate.
				</DataNotice>
			)}
			{power.pricing === "unavailable" && <DataNotice>{power.unavailableReason}</DataNotice>}
			<FuelTankCards tanks={power.tanks} loading={loading} />

			<div className="grid gap-6 md:grid-cols-2">
				<div>
					<h3 className="mb-1 text-sm font-semibold text-foreground">Burn rate</h3>
					<dl className="divide-y divide-highlight/6">
						<Row label="Base generator burn" value={`${BASE_FUEL_UNITS_PER_HOUR.toFixed(2)} u/h`} />
						{groupFuelSources(fuel.sources).map((entry) => (
							<Row key={entry.name} label={entry.name} value={formatPercent(entry.value)} />
						))}
						{skill > 0 && (
							<>
								<Row label={`Hideout Management ${skill}: module bonuses`} value={`+${skill}%`} />
								<Row label={`Hideout Management ${skill}: fuel use`} value={`−${skill / 2}%`} />
							</>
						)}
						<Row
							label="Effective burn"
							value={`×${fuel.multiplier.toFixed(3)} · ${fuel.unitsPerHour.toFixed(2)} u/h · ${(fuel.unitsPerHour * 24).toFixed(1)} u/day`}
						/>
						{upgrades.map((upgrade) => (
							<Row
								key={upgrade.name}
								muted
								label={`Finishing ${upgrade.name}`}
								value={
									upgrade.savedUnitsPerDay > 0
										? `saves ${upgrade.savedUnitsPerDay.toFixed(1)} u/day${cheapestUnitCost !== null ? ` (~${formatRoubles(upgrade.savedUnitsPerDay * cheapestUnitCost)})` : ""}`
										: `adds ${(-upgrade.savedUnitsPerDay).toFixed(1)} u/day`
								}
							/>
						))}
					</dl>
				</div>
				<div>
					<h3 className="mb-1 text-sm font-semibold text-foreground">Running cost</h3>
					<dl className="divide-y divide-highlight/6">
						{tankSlots !== null && currentLevel > 0 && (
							<Row
								label={`${tankSlots} tank slots at level ${currentLevel}`}
								value={
									metal?.runtimeHours != null
										? `${formatSpan(metal.runtimeHours * tankSlots * 3600)} on full Metal tanks`
										: "—"
								}
							/>
						)}
						{power.tanks.map((tank) => (
							<Row
								key={tank.id}
								label={`${tank.item?.name ?? "Fuel tank"} per hour / day / week`}
								value={
									loading
										? "…"
										: tank.costPerHour === null
											? "—"
											: `${formatRoubles(tank.costPerHour)} / ${formatRoubles(tank.costPerHour * 24)} / ${formatRoubles(tank.costPerHour * 168)}`
								}
							/>
						))}
					</dl>
				</div>
			</div>
		</WikiSection>
	);
}
