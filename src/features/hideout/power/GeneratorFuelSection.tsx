"use client";

import { type ReactNode } from "react";
import { Coins, Fuel, GraduationCap, Hourglass, PackageOpen } from "lucide-react";
import { StationImage } from "@/components/entities/station-image";
import { StationLink } from "@/components/entities/station-link";
import { BASE_FUEL_UNITS_PER_HOUR, FUEL_TANK_ITEM_IDS } from "@/lib/cfg/hideout-power";
import type { TarkovJsonGameMode } from "@/lib/game-mode";
import { cn } from "@/lib/utils";
import type { ProfitPageData } from "@/types/contracts";
import type { Station } from "@/types/hideout";
import { WikiSection } from "../details/components/WikiSection";
import { useStationDetails } from "../details/StationDetailsContext";
import { fuelMultiplier, stationSlots, unbuiltFuelSources } from "./hideout-power-model";
import { formatRoubles, formatSpan } from "./power-format";
import { formatPercent, groupFuelSources, StationPowerRow } from "./StationPowerRow";
import { useHideoutPower } from "./useHideoutPower";

function Stat({ icon, label, value, hint }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode }) {
	return (
		<div className="flex min-w-0 flex-col gap-1 rounded-lg bg-shadow/20 px-4 py-3">
			<span className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
				<span className="text-subtle-foreground [&>svg]:size-3.5">{icon}</span>
				{label}
			</span>
			<span className="font-mono text-xl font-semibold leading-tight text-foreground">{value}</span>
			{hint && <span className="truncate text-[11px] leading-snug text-muted-foreground">{hint}</span>}
		</div>
	);
}

/** A buff (green), debuff (red) or, when `ghost`, a modifier you could still unlock. Station modifiers link to the station. */
function Modifier({
	icon,
	name,
	effect,
	title,
	tone,
	ghost = false,
	station,
}: {
	icon: ReactNode;
	name: string;
	effect: string;
	title: string;
	tone: "buff" | "debuff";
	ghost?: boolean;
	station?: Station;
}) {
	const className = cn(
		"flex items-center gap-2 rounded-full py-1 pl-1.5 pr-3 text-xs",
		ghost
			? "border border-dashed border-highlight/20 text-muted-foreground"
			: tone === "buff"
				? "bg-success/10 text-success"
				: "bg-danger/10 text-danger",
		station &&
			"transition-colors hover:border-highlight/40 hover:bg-highlight/5 focus-visible:outline-2 focus-visible:outline-brand",
	);
	const content = (
		<>
			<span className={cn("flex size-5 shrink-0 items-center justify-center", ghost && "opacity-60")}>{icon}</span>
			<span className={cn("font-medium", !ghost && "text-foreground")}>{name}</span>
			<span className="font-mono font-semibold">{effect}</span>
		</>
	);
	return (
		<li title={station ? undefined : title}>
			{station ? (
				<StationLink station={station} aria-label={title} className={className}>
					{content}
				</StationLink>
			) : (
				<div className={className}>{content}</div>
			)}
		</li>
	);
}

const COST_ROW = "grid grid-cols-[minmax(5rem,1.2fr)_repeat(5,minmax(3.5rem,1fr))] gap-x-3 py-1.5";

/** Generator page: fuel headline stats, what changes the burn, and running costs. */
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
	const money = (value: number | null) => (loading ? "…" : formatRoubles(value));
	const cheapest = power.tanks
		.filter((tank) => tank.costPerHour !== null)
		.reduce<(typeof power.tanks)[number] | undefined>(
			(best, tank) => (best && best.costPerHour! <= tank.costPerHour! ? best : tank),
			undefined,
		);
	const unitCosts = power.tanks
		.filter((tank) => tank.netPrice !== null && tank.units)
		.map((tank) => tank.netPrice! / tank.units!);
	const cheapestUnitCost = unitCosts.length ? Math.min(...unitCosts) : null;
	const tankName = (id: string) => (id === FUEL_TANK_ITEM_IDS[0] ? "Metal" : "Expeditionary");

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
		return Math.abs(savedUnitsPerDay) < 1e-6 ? [] : [{ station: target, savedUnitsPerDay }];
	});
	const tankSlots = stationSlots(station, currentLevel, FUEL_TANK_ITEM_IDS[0]);
	const metal = power.tanks.find((tank) => tank.id === FUEL_TANK_ITEM_IDS[0]);
	const runtimeSeconds = metal?.runtimeHours != null && tankSlots ? metal.runtimeHours * tankSlots * 3600 : null;
	const weeklyTank = cheapest ?? metal;
	const burnChange = fuel.multiplier - 1;
	const modifiers = groupFuelSources(fuel.sources);

	return (
		<>
			<StationPowerRow power={power} />
			<WikiSection title="Fuel">
				<div className="@container flex flex-col gap-7">
					<div className="grid grid-cols-1 gap-2 @md:grid-cols-2 @3xl:grid-cols-4">
						<Stat
							icon={<Hourglass aria-hidden />}
							label="Full slots last"
							value={runtimeSeconds === null ? "—" : formatSpan(runtimeSeconds)}
							hint={
								tankSlots
									? `${tankSlots} Metal tanks${metal?.units ? ` · ${tankSlots * metal.units} units` : ""}`
									: "Build the Generator to add slots"
							}
						/>
						<Stat
							icon={<Coins aria-hidden />}
							label="Cheapest / day"
							value={cheapest ? money(cheapest.costPerHour! * 24) : "—"}
							hint={cheapest ? `${tankName(cheapest.id)} · ${money(cheapest.costPerHour!)} / hour` : undefined}
						/>
						<Stat
							icon={<Fuel aria-hidden />}
							label="Tanks / week"
							value={weeklyTank?.units ? ((fuel.unitsPerHour * 168) / weeklyTank.units).toFixed(1) : "—"}
							hint={`${weeklyTank ? `${tankName(weeklyTank.id)} · ` : ""}${(fuel.unitsPerHour * 24).toFixed(1)} u/day`}
						/>
						<Stat
							icon={<PackageOpen aria-hidden />}
							label="Fill all slots"
							value={
								cheapest && tankSlots ? money(cheapest.netPrice === null ? null : cheapest.netPrice * tankSlots) : "—"
							}
							hint={
								cheapest && tankSlots
									? `${tankSlots} × ${tankName(cheapest.id)}, after can resale`
									: tankSlots
										? undefined
										: "Build the Generator to add slots"
							}
						/>
					</div>

					<div className="grid grid-cols-1 gap-7 @4xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] @4xl:gap-10">
						<div>
							<div className="mb-2 flex items-baseline justify-between gap-3">
								<h3 className="text-sm font-semibold text-foreground">Modifiers</h3>
								<span
									title={`Burning ${fuel.unitsPerHour.toFixed(2)} units/hour against a base of ${BASE_FUEL_UNITS_PER_HOUR.toFixed(2)}`}
									className="font-mono text-[11px] text-muted-foreground"
								>
									net{" "}
									<span
										className={cn(
											"font-semibold",
											burnChange < -0.0005 ? "text-success" : burnChange > 0.0005 ? "text-danger" : "text-foreground",
										)}
									>
										{Math.abs(burnChange) < 0.0005 ? "base" : formatPercent(burnChange)}
									</span>
								</span>
							</div>
							{fuel.bonusDataMissing ? (
								<p className="text-xs text-muted-foreground">
									Modifier data is unavailable, so the base burn rate is shown.
								</p>
							) : (
								<>
									{modifiers.length > 0 || skill > 0 ? (
										<ul className="flex flex-wrap gap-2">
											{modifiers.map((entry) => {
												const source = stations.find((item) => item.id === entry.stationId);
												return (
													<Modifier
														key={entry.stationId}
														station={source}
														icon={source ? <StationImage station={source} size={20} className="border-0" /> : null}
														name={entry.name}
														effect={formatPercent(entry.value)}
														tone={entry.value < 0 ? "buff" : "debuff"}
														title={`${entry.name}: ${entry.value < 0 ? "reduces" : "increases"} the base fuel burn by ${Math.abs(Math.round(entry.value * 100))}%`}
													/>
												);
											})}
											{skill > 0 && (
												<Modifier
													icon={<GraduationCap size={16} aria-hidden />}
													name={`Hideout Management ${skill}`}
													effect={`−${skill / 2}% fuel use`}
													tone="buff"
													title={`Hideout Management ${skill} cuts fuel use by ${skill / 2}%`}
												/>
											)}
											{skill > 0 && modifiers.length > 0 && (
												<Modifier
													icon={<GraduationCap size={16} aria-hidden />}
													name={`Hideout Management ${skill}`}
													effect={`+${skill}% station bonuses`}
													tone="buff"
													title={`Hideout Management ${skill} strengthens station bonuses like Solar Power by ${skill}%`}
												/>
											)}
										</ul>
									) : (
										<p className="text-xs text-muted-foreground">Nothing is changing your fuel use yet.</p>
									)}
									{upgrades.length > 0 && (
										<>
											<h4 className="mb-2 mt-4 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
												Available upgrades
											</h4>
											<ul className="flex flex-wrap gap-2">
												{upgrades.map((upgrade) => {
													const saves = upgrade.savedUnitsPerDay > 0;
													const perDay = Math.abs(upgrade.savedUnitsPerDay).toFixed(1);
													const worth =
														saves && cheapestUnitCost !== null
															? ` (~${formatRoubles(upgrade.savedUnitsPerDay * cheapestUnitCost)})`
															: "";
													return (
														<Modifier
															key={upgrade.station.id}
															ghost
															station={upgrade.station}
															icon={<StationImage station={upgrade.station} size={20} className="border-0" />}
															name={upgrade.station.name}
															effect={`${saves ? "saves" : "adds"} ${perDay} u/day${worth}`}
															tone={saves ? "buff" : "debuff"}
															title={`Finishing ${upgrade.station.name} would ${saves ? "reduce" : "increase"} fuel use by ${perDay} units per day`}
														/>
													);
												})}
											</ul>
										</>
									)}
								</>
							)}
						</div>

						<div>
							<h3 className="mb-1 text-sm font-semibold text-foreground">Running cost</h3>
							<div role="table" aria-label="Running cost per fuel tank" className="overflow-x-auto text-xs">
								<div
									role="row"
									className={cn(COST_ROW, "text-[10px] font-medium uppercase tracking-wide text-muted-foreground")}
								>
									<span role="columnheader">Fuel</span>
									<span role="columnheader" className="text-right">
										Per tank
									</span>
									<span role="columnheader" className="text-right">
										Lasts
									</span>
									<span role="columnheader" className="text-right">
										Hour
									</span>
									<span role="columnheader" className="text-right">
										Day
									</span>
									<span role="columnheader" className="text-right">
										Week
									</span>
								</div>
								{power.tanks.map((tank) => (
									<div
										key={tank.id}
										role="row"
										className={cn(COST_ROW, "border-t border-highlight/6", cheapest?.id === tank.id && "text-success")}
									>
										<span role="cell" className="min-w-0 truncate font-medium text-foreground">
											{tankName(tank.id)}
										</span>
										<span role="cell" className="text-right font-mono font-semibold text-foreground">
											{money(tank.netPrice)}
										</span>
										<span role="cell" className="text-right font-mono font-semibold text-foreground">
											{tank.runtimeHours === null ? "—" : formatSpan(tank.runtimeHours * 3600)}
										</span>
										{[1, 24, 168].map((hours) => (
											<span key={hours} role="cell" className="text-right font-mono font-semibold">
												{tank.costPerHour === null ? "—" : money(tank.costPerHour * hours)}
											</span>
										))}
									</div>
								))}
							</div>
						</div>
					</div>
				</div>
			</WikiSection>
		</>
	);
}
